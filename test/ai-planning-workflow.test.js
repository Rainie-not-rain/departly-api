import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCreation} from '../app/trip/creation-service.js';
import {planningRequest,planningRequestFromDraft,planToDraft,generatePlan,PLANNING_ERROR} from '../app/trip/ai-planning.js';
import {createTrip,updateDraftNode,addDraftDay,removeDraftDay} from '../app/trip/detail-service.js';
import {verifyPlanPlaces} from '../lib/trip-plan-poi.js';
import {protectTripPlanRequest} from '../lib/web-trip-plan-security.js';
import tripPlanHandler from '../api/ai/trip-plan.js';
import {callZhipu} from '../lib/zhipu.js';
import {parseAIJson,normalizeResult,validateInput} from '../lib/ai-json.js';
import {createPoiCache,VERIFIED_TTL_MS,NEGATIVE_TTL_MS} from '../lib/poi-cache.js';
import {matchAmapPoi,searchAmapPoi} from '../lib/amap-poi.js';
const input=()=>({...initialCreation(),form:{name:'',country:'中国',city:'上海',start:'2026-10-07',end:'2026-10-08'},mustVisitPlaces:'外滩、豫园\n外滩'});
// Fixtures are restricted to tests; the product has no mock/success fallback.
const result=()=>({days:[{dayIndex:1,date:'2026-10-07',items:[{placeName:'外滩',plannedStartTime:'09:00',plannedEndTime:'10:30'},{placeName:'豫园'}]},{dayIndex:2,date:'2026-10-08',items:[{placeName:'上海博物馆'},{placeName:'人民广场'}]}]});
test('JSON 围栏与少量前后文可提取，字符串花括号不影响边界，不修复损坏或截断 JSON',()=>{
 const value={days:[],reason:'brace } and escaped " quote'};
 assert.deepEqual(parseAIJson('```json\n'+JSON.stringify(value)+'\n```'),value);
 assert.deepEqual(parseAIJson('说明\n'+JSON.stringify(value)+'\n完成'),value);
 for(const raw of ['{"days":[{}]','{"days":[],}','[]'])assert.throws(()=>parseAIJson(raw),{code:'AI_RESPONSE_INVALID'});
 const {request}=planningRequest(input());const bad=result();bad.days[0].items[0]={title:'wrong field'};
 assert.throws(()=>normalizeResult(bad,validateInput(request,'plan'),'plan'),error=>error.diagnostic.field==='days[0].items[0].placeName');
});
test('输出截断准确定位 finish_reason，记录安全元数据并沿用已配置 token 额度',async()=>{
 const oldFetch=global.fetch,oldKey=process.env.ZHIPU_API_KEY,oldTokens=process.env.ZHIPU_MAX_TOKENS;
 try{
  process.env.ZHIPU_API_KEY='secret-not-for-log';process.env.ZHIPU_MAX_TOKENS='6000';const metadata=[];
  global.fetch=async(url,options)=>{assert.equal(JSON.parse(options.body).max_tokens,6000);return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'length',message:{content:'{"private":"secret-not-for-log"',reasoning_content:'private reasoning'}}],usage:{completion_tokens:6000}})};};
  await assert.rejects(callZhipu({model:'fixture-model',messages:[],onMetadata:meta=>metadata.push(meta)}),error=>error.code==='AI_RESPONSE_INVALID'&&error.diagnostic.field==='choices[0].finish_reason'&&error.diagnostic.reason==='output_truncated');
  assert.equal(metadata[0].httpStatus,200);assert.equal(metadata[1].finishReason,'length');assert.equal(metadata[1].contentType,'string');assert.equal(metadata[1].choicesLength,1);
  assert(!JSON.stringify(metadata).includes('secret-not-for-log'));assert(!JSON.stringify(metadata).includes('private reasoning'));
 }finally{global.fetch=oldFetch;oldKey===undefined?delete process.env.ZHIPU_API_KEY:process.env.ZHIPU_API_KEY=oldKey;oldTokens===undefined?delete process.env.ZHIPU_MAX_TOKENS:process.env.ZHIPU_MAX_TOKENS=oldTokens;}
});
test('选填名称默认命名，偏好最多五项，日期和地点名单按原 schema 校验',()=>{const {base,request}=planningRequest(input());assert.equal(base.name,'上海 2 日游');assert.equal(request.name,'');assert.deepEqual(request.mustVisitPlaces,['外滩','豫园']);assert.equal(request.preferences.pace,'moderate');assert.throws(()=>planningRequest({...input(),preferences:{styles:Array(6).fill('food')}}));assert.throws(()=>planningRequest({...input(),form:{...input().form,end:'2026-10-06'}}));});
test('结构化 API 结果转统一草稿，缺失可选字段补齐，不采信未经校验的 POI',()=>{const {base,request}=planningRequest(input()),raw=result();raw.days[0].items[0].poiVerified=true;const draft=planToDraft(base,raw,request);assert.equal(draft.creationMode,'ai_generate');assert.equal(draft.isDirty,false);assert.equal(draft.days.length,2);assert.equal(draft.days[0].items[0].durationMinutes,90);assert.equal(draft.days[0].items[1].plannedStartTime,'11:00');assert.equal(draft.days[0].items[1].plannedEndTime,'12:30');assert.equal(draft.days[0].items[0].poiVerified,false);assert.deepEqual(draft.memberIds,draft.members.map(m=>m.id));assert.deepEqual(planningRequestFromDraft(draft).mustVisitPlaces,['外滩','豫园']);assert.throws(()=>planToDraft(base,{days:[raw.days[0]]},request));assert.throws(()=>planToDraft(base,{days:[{...raw.days[0],items:[{},{}]},raw.days[1]]},request));});
test('前端只 POST 原 API；响应错误、非 JSON、空结果与取消均不生成假草稿',async()=>{const {base,request}=planningRequest(input());let calls=0;const fetcher=async(url,opts)=>{calls++;assert.equal(url,'/api/ai/trip-plan');assert.equal(opts.method,'POST');assert.equal(opts.credentials,'same-origin');assert.deepEqual(JSON.parse(opts.body),request);return {ok:true,json:async()=>({success:true,data:result()})};};const draft=await generatePlan(base,request,{fetcher});assert.equal(calls,1);assert.equal(draft.days.length,2);await assert.rejects(generatePlan(base,request,{fetcher:async()=>({ok:false,json:async()=>({success:false,error:{code:'AI_TIMEOUT'}})})}),new RegExp(PLANNING_ERROR));await assert.rejects(generatePlan(base,request,{fetcher:async()=>({ok:true,json:async()=>{throw Error('not JSON');}})}));await assert.rejects(generatePlan(base,request,{fetcher:async()=>({ok:true,json:async()=>({success:true,data:{days:[]}})})}));const controller=new AbortController();controller.abort();await assert.rejects(generatePlan(base,request,{fetcher,signal:controller.signal}));});
test('生成不直接创建 Trip；修改、增删 Day 后必须显式确认，至少保留一天',()=>{const {base,request}=planningRequest(input()),draft=planToDraft(base,result(),request),data={managerUserId:'u',trips:[],expenses:[],tickets:[],packing:[]};assert.equal(data.trips.length,0);const node=draft.days[0].items[0];updateDraftNode(draft,draft.days[0].id,node.id,{place:'北外滩',start:'09:00',end:'10:00',type:'景点',note:'调整后的地点'});assert.equal(draft.isDirty,true);addDraftDay(draft);removeDraftDay(draft,draft.days[2].id);createTrip(data,draft);assert.equal(data.trips.length,1);assert.equal(data.trips[0].days[0].nodes[0].place,'北外滩');assert.equal(data.currentTripId,draft.id);removeDraftDay(draft,draft.days[1].id);assert.throws(()=>removeDraftDay(draft,draft.days[0].id),/至少/);});
test('POI 独立步骤无适配器时保留全部地点，单点失败不影响整份草稿',async()=>{const raw=result(),unverified=await verifyPlanPlaces(raw);assert(unverified.days.every(d=>d.items.every(i=>i.poiVerified===false)));const checked=await verifyPlanPlaces(raw,async name=>{if(name!=='外滩')throw Error('offline');return {id:'poi',address:'上海',latitude:31.24,longitude:121.49};});assert.equal(checked.days[0].items[0].poiVerified,true);assert.equal(checked.days[0].items[1].poiVerified,false);assert.equal(checked.days[1].items.length,raw.days[1].items.length);});
test('Web 请求穿过原 handler 和 GLM 调用，再进入可编辑草稿，响应不泄露密钥',async()=>{const keys=['ZHIPU_API_KEY','ZHIPU_MODEL','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','WEB_APP_ORIGIN','AMAP_WEB_SERVICE_KEY'],before=keys.map(k=>process.env[k]),oldFetch=global.fetch;try{Object.assign(process.env,{AMAP_WEB_SERVICE_KEY:'fixture-service-key',ZHIPU_API_KEY:'provider-fixture-secret',ZHIPU_MODEL:'glm-5.3-flashx',UPSTASH_REDIS_REST_URL:'https://fixture-redis.example',UPSTASH_REDIS_REST_TOKEN:'redis-fixture-secret',WEB_APP_ORIGIN:'https://departly.example'});let providerCalls=0,amapCalls=0;global.fetch=async(url,options)=>{if(url.startsWith('https://restapi.amap.com/')){amapCalls++;return {ok:true,status:200,json:async()=>({status:'0',info:'ACCESS_TOO_FREQUENT',infocode:'10004'})};}if(url==='https://fixture-redis.example')return {ok:true,json:async()=>({result:1})};assert.equal(url,'https://open.bigmodel.cn/api/paas/v4/chat/completions');assert.equal(options.headers.Authorization,'Bearer provider-fixture-secret');assert.equal(JSON.parse(options.body).model,'glm-5.3-flashx');assert.equal(JSON.parse(options.body).reasoning_effort,'low');assert.equal(JSON.parse(options.body).thinking,undefined);providerCalls++;return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(result())}}]})};};const {base,request}=planningRequest(input());const draft=await generatePlan(base,request,{fetcher:async(url,options)=>{assert.equal(url,'/api/ai/trip-plan');const response={status(n){this.code=n;return this;},json(body){this.body=body;return this;},setHeader(){}};await tripPlanHandler({method:'POST',headers:{origin:'https://departly.example','sec-fetch-site':'same-origin'},socket:{remoteAddress:'127.0.0.1'},body:JSON.parse(options.body)},response);assert.equal(response.code,200);assert(!JSON.stringify(response.body).includes('fixture-secret'));return {ok:response.code===200,json:async()=>response.body};}});assert.equal(providerCalls,1);assert.equal(amapCalls,1);assert.equal(draft.creationMode,'ai_generate');assert.equal(draft.days.length,2);assert.equal(draft.isDirty,false);assert(draft.days.every(d=>d.items.every(i=>i.poiVerified===false)));}finally{global.fetch=oldFetch;keys.forEach((k,i)=>before[i]===undefined?delete process.env[k]:process.env[k]=before[i]);}});
test('Web 同源准入仍执行两级持久限流；缺配置、跨站、超限和无来源均拒绝',async()=>{const keys=['ZHIPU_API_KEY','ZHIPU_MODEL','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','WEB_APP_ORIGIN','NODE_ENV','WECHAT_APP_SECRET'],before=keys.map(k=>process.env[k]),oldFetch=global.fetch;try{Object.assign(process.env,{ZHIPU_API_KEY:'fixture-only',ZHIPU_MODEL:'fixture-model',UPSTASH_REDIS_REST_URL:'https://fixture-redis.example',UPSTASH_REDIS_REST_TOKEN:'fixture-only',WEB_APP_ORIGIN:'https://departly.example',NODE_ENV:'production',WECHAT_APP_SECRET:'fixture-only'});const req={headers:{origin:'https://departly.example','sec-fetch-site':'same-origin'},socket:{remoteAddress:'127.0.0.1'},body:{city:'上海'}};let calls=0;global.fetch=async()=>{calls++;return {ok:true,json:async()=>({result:1})};};await protectTripPlanRequest(req);assert.equal(calls,2);await assert.rejects(protectTripPlanRequest({...req,headers:{origin:'https://other.example'}}),{status:401});await assert.rejects(protectTripPlanRequest({...req,headers:{...req.headers,'sec-fetch-site':'cross-site'}}),{status:401});assert.equal(calls,2);delete process.env.UPSTASH_REDIS_REST_TOKEN;await assert.rejects(protectTripPlanRequest(req),{status:503});process.env.UPSTASH_REDIS_REST_TOKEN='fixture-only';global.fetch=async()=>({ok:true,json:async()=>({result:11})});await assert.rejects(protectTripPlanRequest(req),{status:429});await assert.rejects(protectTripPlanRequest({...req,headers:{}}),{status:401});}finally{global.fetch=oldFetch;keys.forEach((k,i)=>before[i]===undefined?delete process.env[k]:process.env[k]=before[i]);}});
test('开发缺 Redis 使用有配额的内存限流并警告，生产仍拒绝，不跳过已配置 Redis',async()=>{const keys=['ZHIPU_API_KEY','ZHIPU_MODEL','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','WEB_APP_ORIGIN','NODE_ENV'],before=keys.map(k=>process.env[k]),oldFetch=global.fetch,oldWarn=console.warn;try{Object.assign(process.env,{ZHIPU_API_KEY:'private-fixture-key',ZHIPU_MODEL:'fixture-model',WEB_APP_ORIGIN:'http://localhost:3000',NODE_ENV:'development'});delete process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_TOKEN;const logs=[];console.warn=(...args)=>logs.push(args.join(' '));global.fetch=async()=>{throw Error('unexpected Redis request');};const req={headers:{origin:'http://localhost:3000'},socket:{remoteAddress:'development-fixture-'+Date.now()},body:{city:'上海'}};for(let i=0;i<10;i++)await protectTripPlanRequest(req);await assert.rejects(protectTripPlanRequest(req),{status:429});assert(logs.some(s=>s.includes('development in-memory')));assert(!logs.join(' ').includes('private-fixture-key'));process.env.NODE_ENV='production';await assert.rejects(protectTripPlanRequest(req),{status:503});process.env.NODE_ENV='development';process.env.UPSTASH_REDIS_REST_URL='https://fixture-redis.example';process.env.UPSTASH_REDIS_REST_TOKEN='fixture';await assert.rejects(protectTripPlanRequest(req),{status:503});}finally{global.fetch=oldFetch;console.warn=oldWarn;keys.forEach((k,i)=>before[i]===undefined?delete process.env[k]:process.env[k]=before[i]);}});
test('上游 HTTP 诊断保留真实状态，不记录可能含密钥的响应正文',async()=>{const oldKey=process.env.ZHIPU_API_KEY,oldFetch=global.fetch,oldError=console.error;try{process.env.ZHIPU_API_KEY='do-not-log-fixture-key';const logs=[];console.error=(...args)=>logs.push(args.join(' '));for(const status of [401,429]){global.fetch=async()=>({ok:false,status,text:async()=>{throw Error('must not read sensitive error body');}});await assert.rejects(callZhipu({model:'fixture-model',messages:[],timeoutMs:1000}),{code:'AI_REQUEST_FAILED'});assert(logs.some(s=>s.includes('Zhipu request failed: '+status)));}assert(!logs.join(' ').includes('do-not-log-fixture-key'));}finally{global.fetch=oldFetch;console.error=oldError;oldKey===undefined?delete process.env.ZHIPU_API_KEY:process.env.ZHIPU_API_KEY=oldKey;}});

const amapPoi=(changes={})=>({id:'poi-1',name:'外滩',cityname:'上海市',pname:'上海市',adname:'黄浦区',address:'中山东一路',location:'121.49,31.24',...changes});
test('高德名称与城市可靠匹配；同名歧义、异城、无结果、非法坐标不验证',()=>{
 assert.equal(matchAmapPoi([amapPoi()],' 外滩 ','上海').id,'poi-1');
 assert.equal(matchAmapPoi([amapPoi({cityname:'北京市'})],'外滩','上海').reason,'city_mismatch');
 assert.equal(matchAmapPoi([amapPoi(),amapPoi({id:'poi-2'})],'外滩','上海').reason,'ambiguous');
 assert.equal(matchAmapPoi([],'外滩','上海').reason,'no_result');
 assert.equal(matchAmapPoi([amapPoi({name:'外滩饭店'})],'外滩','上海').reason,'name_mismatch');
 assert.equal(matchAmapPoi([amapPoi({location:',31.24'})],'外滩','上海').reason,'invalid_coordinates');
});
test('服务端查询限制城市、使用独立 Key，海外和未知国家保守降级，API 错误不抛出',async()=>{
 let calls=0;const fetcher=async url=>{calls++;const u=new URL(url);assert.equal(u.origin+u.pathname,'https://restapi.amap.com/v3/place/text');assert.equal(u.searchParams.get('citylimit'),'true');assert.equal(u.searchParams.get('city'),'上海');assert.equal(u.searchParams.get('key'),'fixture-service-key');return {ok:true,json:async()=>({status:'1',pois:[amapPoi()]})}};
 const opts={country:'中国',key:'fixture-service-key',fetcher};assert.equal((await searchAmapPoi('外滩','上海',opts)).id,'poi-1');
 assert.equal((await searchAmapPoi('浅草寺','东京',{...opts,country:'日本'})).reason,'unsupported_country');assert.equal(calls,1);
 assert.equal((await searchAmapPoi('外滩','上海',{...opts,country:''})).reason,'country_unknown');
 assert.equal((await searchAmapPoi('外滩','上海',{...opts,fetcher:async()=>{throw Error('network with private key')}})).reason,'network_error');
 assert.equal((await searchAmapPoi('外滩','上海',{...opts,fetcher:async()=>({ok:true,json:async()=>({status:'0',infocode:'10003'})})})).reason,'quota_exceeded');
});
test('有限并发和单次请求去重；部分失败保留地点，转换草稿并编辑清除旧 POI',async()=>{
 const {base,request}=planningRequest(input());const raw=result();raw.days[0].items.push({placeName:' 外滩 '});let calls=0,active=0,peak=0;
 const grounded=await verifyPlanPlaces(raw,async name=>{calls++;active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,5));active--;if(name.trim()!=='外滩')throw Error('provider unavailable');return {id:'poi-1',placeName:'外滩',address:'中山东一路',latitude:31.24,longitude:121.49}},{country:'中国',city:'上海'});
 assert.equal(calls,4);assert.equal(peak,1);assert.equal(grounded.days[0].items[2].poiVerified,true);assert.equal(grounded.days[0].items[1].poiVerified,false);
 const draft=planToDraft(base,grounded,request),item=draft.days[0].items[0];assert.equal(item.originalPlaceName,'外滩');assert.equal(item.poiVerified,true);
 updateDraftNode(draft,draft.days[0].id,item.id,{place:'上海塔',start:'09:00',end:'10:30',type:'景点',note:''});
 const changed=draft.days[0].items[0];assert.equal(changed.poiVerified,false);for(const field of ['poiId','address','latitude','longitude'])assert.equal(changed[field],null);assert.equal(draft.isDirty,true);
 const exhausted=await verifyPlanPlaces(raw,()=>{throw Error('must not query')},{timeoutMs:0});assert(exhausted.days.every(d=>d.items.every(i=>!i.poiVerified)));
});

test('高德 provider 区分业务拒绝、HTTP、网络、超时、空结果，诊断不泄露 Key',async()=>{
 const oldEnv=process.env.NODE_ENV,oldLog=console.log,logs=[];console.log=(...args)=>logs.push(args);process.env.NODE_ENV='development';
 const opts={country:'中国',key:'test-private-amap-key',timeoutMs:15};
 try{
  for(const [code,expected] of [['10003','quota_exceeded'],['10004','quota_exceeded'],['10001','invalid_key'],['10009','invalid_key'],['20001','invalid_request'],['10005','provider_rejected']]){
   const poi=await searchAmapPoi('天坛公园','北京',{...opts,fetcher:async()=>({ok:true,status:200,json:async()=>({status:'0',info:'REJECTED',infocode:code})})});assert.equal(poi.reason,expected);
  }
  for(const status of [403,500])assert.equal((await searchAmapPoi('天安门','北京',{...opts,fetcher:async()=>({ok:false,status,json:async()=>({status:'0',info:'ERROR',infocode:'10005'})})})).reason,'provider_error');
  assert.equal((await searchAmapPoi('鼓楼','北京',{...opts,fetcher:async()=>{throw Error('fetch https://restapi.amap.com/v3/place/text?key=test-private-amap-key')}})).reason,'network_error');
  assert.equal((await searchAmapPoi('什刹海','北京',{...opts,fetcher:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))))})).reason,'timeout');
  assert.equal((await searchAmapPoi('南锣鼓巷','北京',{...opts,fetcher:async()=>({ok:true,status:200,json:async()=>({status:'1',info:'OK',infocode:'10000',pois:[]})})})).reason,'no_result');
  const signals=new Set();let count=0;
  const mixed=await verifyPlanPlaces({days:[{city:'北京',items:['天安门','故宫博物院','景山公园','颐和园','天坛公园','南锣鼓巷','什刹海','鼓楼'].map(placeName=>({placeName}))}]},(name,city)=>searchAmapPoi(name,city,{...opts,fetcher:async(url,{signal})=>{signals.add(signal);const u=new URL(url);assert.equal(u.searchParams.get('city'),'北京');assert.equal(u.searchParams.has('types'),false);count++;if(count===1)throw Error('one query failed');return {ok:true,status:200,json:async()=>({status:'1',info:'OK',infocode:'10000',pois:[amapPoi({id:u.searchParams.get('keywords'),name:u.searchParams.get('keywords'),cityname:'北京市'})]})};}}));
  assert.equal(count,8);assert.equal(signals.size,8);assert.equal(mixed.days[0].items.filter(i=>i.poiVerified).length,7);
  const serialized=JSON.stringify(logs);assert(!serialized.includes(opts.key));assert(!serialized.includes('https://restapi.amap.com'));assert(logs.some(args=>args[1]?.httpStatus===200&&args[1]?.infocode==='10003'));assert(logs.some(args=>args[1]?.providerSuccess===true&&args[1]?.poisCount===0));
  logs.length=0;process.env.NODE_ENV='production';await searchAmapPoi('鼓楼','北京',{...opts,fetcher:async()=>{throw Error('network')}});assert.equal(logs.length,0);
 }finally{console.log=oldLog;oldEnv===undefined?delete process.env.NODE_ENV:process.env.NODE_ENV=oldEnv}
});

test('POI cache 长短 TTL，临时错误不污染缓存或覆盖成功结果',()=>{
 let clock=0;const cache=createPoiCache({now:()=>clock}),poi={id:'p',latitude:31,longitude:121};cache.set('ok',poi);assert.equal(cache.get('ok').poiVerified,true);assert.equal(cache.get('ok').matchedAt,0);
 for(const reason of ['no_result','ambiguous'])cache.set(reason,{reason});
 for(const reason of ['provider_error','quota_exceeded','network_error','timeout']){cache.set(reason,{reason});assert.equal(cache.get(reason),null);cache.set('ok',{reason});assert.equal(cache.get('ok').id,'p')}
 clock=NEGATIVE_TTL_MS;assert.equal(cache.get('no_result'),null);assert.equal(cache.get('ambiguous'),null);assert(cache.get('ok'));clock=VERIFIED_TTL_MS;assert.equal(cache.get('ok'),null);
});
test('跨请求缓存、单次去重与 quota 熔断，下一次请求重新允许 provider',async()=>{
 const cache=createPoiCache(),raw={days:[{city:'北京',items:[{placeName:'天安门'},{placeName:'故宫'},{placeName:'天坛'}]},{city:'北京市',items:[{placeName:' 天安门 '},{placeName:'鼓楼'}]}]};let calls=0;
 const adapter=async name=>{calls++;return name==='故宫'?{reason:'quota_exceeded'}:{id:name,placeName:name,latitude:39,longitude:116}};
 const options={country:'中国',cache,intervalMs:0};const logs=[],oldLog=console.log,oldEnv=process.env.NODE_ENV;console.log=(...args)=>logs.push(args);process.env.NODE_ENV='development';
 try{
  const first=await verifyPlanPlaces(raw,adapter,options);assert.equal(calls,2);assert.equal(first.days[1].items[0].poiVerified,true);assert.equal(first.days[1].items[1].poiVerified,false);
  const stats=logs.find(a=>a[0]==='[POI Grounding]')[1];assert.equal(stats.providerRequests,2);assert.equal(stats.quotaExceeded,1);assert.equal(stats.quotaSkipped,2);assert.equal(stats.failedRequests,1);
  logs.length=0;await verifyPlanPlaces(raw,adapter,options);assert.equal(calls,3);assert.equal(logs.find(a=>a[0]==='[POI Grounding]')[1].cacheHits,1);
  const negativeCache=createPoiCache();let negativeCalls=0;for(let i=0;i<2;i++)await verifyPlanPlaces({days:[{city:'北京',items:[{placeName:'不存在'}]}]},async()=>{negativeCalls++;return {reason:'no_result'}},{...options,cache:negativeCache});assert.equal(negativeCalls,1);
 }finally{console.log=oldLog;oldEnv===undefined?delete process.env.NODE_ENV:process.env.NODE_ENV=oldEnv}
});
