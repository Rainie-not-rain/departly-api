import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCreation} from '../app/trip/creation-service.js';
import {importRequest,generateImport,parseToDraft,IMPORT_ERROR} from '../app/trip/ai-import.js';
import {updateDraftNode,createTrip} from '../app/trip/detail-service.js';
import {prepareTripParseText,INSUFFICIENT_CONTENT} from '../lib/trip-parse-text.js';
import {callZhipu} from '../lib/zhipu.js';
import handler from '../api/ai/trip-parse.js';
const form=()=>({...initialCreation(),form:{name:'东京攻略',country:'日本',city:'东京',start:'2026-10-07',end:'2026-10-08'},text:'Day1 09:00 浅草寺，14:00 东京国立博物馆。Day2 上午上野公园散步'});
const result=()=>({days:[{dayIndex:1,items:[{placeName:'浅草寺',plannedStartTime:'09:00',startTimeSource:'source',sourceTimeText:'09:00'},{placeName:'东京国立博物馆',plannedStartTime:'14:00',startTimeSource:'source',sourceTimeText:'14:00'}]},{dayIndex:2,items:[{placeName:'上野公园',plannedStartTime:'09:30',startTimeSource:'inferred',sourceTimeText:'上午',reason:'散步'}]}]});
test('原文地点与 Day 保留，明确/模糊/补齐来源保存，编辑确认后 Trip 可序列化恢复',()=>{
 const {base,request}=importRequest(form()),draft=parseToDraft(base,result(),request);
 assert.equal(draft.creationMode,'text_import');assert.equal(draft.sourceText,form().text);assert.equal(draft.days.length,2);assert.equal(draft.days[0].items[0].startTimeSource,'source');assert.equal(draft.days[1].items[0].startTimeSource,'inferred');assert.equal(draft.days[0].items[0].durationSource,'suggested');assert.equal(draft.days[1].items[0].note,'散步');
 const bad=result();bad.days[0].items[0].placeName='东京塔';assert.throws(()=>parseToDraft(base,bad,request),{code:'AI_RESPONSE_INVALID'});
 const id=draft.days[0].items[0].id;updateDraftNode(draft,draft.days[0].id,id,{place:'浅草寺',start:'09:00',end:'10:00',type:'景点',note:'调整'});assert.equal(draft.isDirty,true);
 const data={managerUserId:'u',trips:[],expenses:[],tickets:[],packing:[]};createTrip(data,draft);const restored=JSON.parse(JSON.stringify(data));assert.equal(restored.trips[0].creationMode,'text_import');assert.equal(restored.trips[0].days[0].nodes[0].place,'浅草寺');assert.equal(restored.trips[0].sourceText,form().text);
});
test('URL-only 不请求 API；失败保留原文，不生成假草稿',async()=>{
 assert.throws(()=>importRequest({...form(),text:'https://example.com/trip'}),{code:'SOURCE_UNSUPPORTED'});
 const input=form(),{base,request}=importRequest(input);let calls=0;
 await assert.rejects(generateImport(base,{...request,text:'https://example.com/trip'},{fetcher:async()=>{calls++;throw Error('must not request')}}));assert.equal(calls,0);
 await assert.rejects(generateImport(base,request,{fetcher:async()=>({ok:false,json:async()=>({success:false})})}),new RegExp(IMPORT_ERROR));assert.equal(input.text,form().text);assert.equal(base.sourceText,form().text);
});
test('复用原 handler 真实调用路径，GLM 解析后进入草稿；高德 quota 不影响 200，坏 JSON 正常失败',async()=>{
 const keys=['NODE_ENV','ZHIPU_API_KEY','ZHIPU_MODEL','AMAP_WEB_SERVICE_KEY','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','WEB_APP_ORIGIN'],before=keys.map(k=>process.env[k]),oldFetch=global.fetch;
 try{
  Object.assign(process.env,{NODE_ENV:'production',ZHIPU_API_KEY:'fixture-secret',ZHIPU_MODEL:'glm-5.3-flashx',AMAP_WEB_SERVICE_KEY:'fixture-key',UPSTASH_REDIS_REST_URL:'https://fixture-redis.example',UPSTASH_REDIS_REST_TOKEN:'fixture-redis',WEB_APP_ORIGIN:'https://departly.example'});
  let invalid=false,empty=false,glm=0,amap=0;global.fetch=async(url,options)=>{if(url==='https://fixture-redis.example')return {ok:true,json:async()=>({result:1})};if(url.startsWith('https://restapi.amap.com/')){amap++;return {ok:true,status:200,json:async()=>({status:'0',infocode:'10004',info:'ACCESS_TOO_FREQUENT'})}};glm++;assert.equal(JSON.parse(options.body).reasoning_effort,'low');return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content:invalid?'broken json':JSON.stringify(empty?{days:[]}:result())}}]})};};
  const input={...form(),form:{...form().form,country:'中国',city:'测试城市'}},{base,request}=importRequest(input);
  const invoke=async()=>{const res={status(n){this.code=n;return this},json(v){this.body=v;return this},setHeader(){}};await handler({method:'POST',headers:{origin:'https://departly.example'},socket:{remoteAddress:'127.0.0.1'},body:request},res);return res};
  const res=await invoke();assert.equal(res.code,200);assert.equal(glm,1);assert.equal(amap,1);assert.equal(parseToDraft(base,res.body.data,request).creationMode,'text_import');assert(!JSON.stringify(res.body).includes('fixture-secret'));
  empty=true;const insufficient=await invoke();assert.equal(insufficient.code,422);assert.equal(insufficient.body.error.code,'TRIP_PARSE_INSUFFICIENT_CONTENT');empty=false;invalid=true;const failed=await invoke();assert.equal(failed.code,502);assert.equal(failed.body.error.code,'AI_RESPONSE_INVALID');
 }finally{global.fetch=oldFetch;keys.forEach((k,i)=>before[i]===undefined?delete process.env[k]:process.env[k]=before[i])}
});

test('分享标题与 URL 不冒充正文；保留实际路线、时间和无 Day 的地点',async()=>{
 assert.throws(()=>prepareTripParseText('https://www.xiaohongshu.com/abc'),/暂不支持直接读取链接/);
 assert.throws(()=>prepareTripParseText('重庆三天两夜旅游攻略\n作者：小明\nhttps://www.xiaohongshu.com/abc','重庆'),{code:'TRIP_PARSE_INSUFFICIENT_CONTENT'});
 const body='重庆三天两夜\nDay1 上午去解放碑，下午去洪崖洞\nDay2 14:00 李子坝';
 assert.equal(prepareTripParseText(body+'\n作者：小明\nhttps://www.xiaohongshu.com/abc','重庆'),body);
 assert.equal(prepareTripParseText('先去解放碑，然后洪崖洞'),'先去解放碑，然后洪崖洞');
 const {base,request}=importRequest(form());await assert.rejects(generateImport(base,request,{fetcher:async()=>({ok:false,json:async()=>({error:{code:'TRIP_PARSE_INSUFFICIENT_CONTENT'}})})}),error=>error.code==='TRIP_PARSE_INSUFFICIENT_CONTENT'&&error.message===INSUFFICIENT_CONTENT);
});
test('provider content 真正为空仍属于模型异常，不能转成输入不足',async()=>{
 const oldKey=process.env.ZHIPU_API_KEY,oldFetch=global.fetch;try{process.env.ZHIPU_API_KEY='fixture';global.fetch=async()=>({ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content:''}}]})});await assert.rejects(callZhipu({model:'fixture',messages:[]}),error=>error.code==='AI_EMPTY_RESULT'&&error.diagnostic.field==='choices[0].message.content');}finally{global.fetch=oldFetch;oldKey===undefined?delete process.env.ZHIPU_API_KEY:process.env.ZHIPU_API_KEY=oldKey}
});
