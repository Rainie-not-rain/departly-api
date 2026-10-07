import test from 'node:test';
import assert from 'node:assert/strict';
import {identifyTripSource} from '../lib/trip-source-input.js';
import {extractTripSource} from '../app/trip/trip-source.js';
import {resolveContent} from '../lib/content/resolver.js';
import {generateImport,importRequest} from '../app/trip/ai-import.js';
import {initialCreation} from '../app/trip/creation-service.js';
import resolveHandler from '../api/content/resolve.js';
import {extractTripSource as serverExtract} from '../lib/content/trip-source.js';
import parseHandler from '../api/ai/trip-parse.js';
const url='https://www.xiaohongshu.com/explore/abcdef012345abcdef012345';
const text='Day1 上午去浅草寺，然后去仲见世吃饭。下午去东京国立博物馆，晚上去上野公园散步。沿路慢慢走，多留一点拍照时间，不要着急赶路。这一天就按这个顺序安排，第二天自由活动。';
test('输入识别：正文优先、短分享走链接、拒绝非白名单及凭证/端口/文件 URL',async()=>{
 assert.equal(identifyTripSource(text+'\n'+url).inputType,'xiaohongshu_url');assert.equal(identifyTripSource('东京旅游攻略\n作者：小明\n'+url,'东京').inputType,'xiaohongshu_url');
 const titleShare='58 【重庆三天两夜旅游攻略 自由行附路线！很详细，建议收藏，出发前一定看看，安排三天两夜省心出行，不绕路的旅行攻略推荐 – 作者 | 小红书 – 你的生活兴趣社区】\nM1FsjEusfzs0jMD 😄\n'+url;
 assert.equal(identifyTripSource(titleShare,'重庆').inputType,'xiaohongshu_url');
 const stages=[];let calls=0;const extracted=await extractTripSource({text:titleShare,city:'重庆'},{onStage:stage=>stages.push(stage),fetcher:async(path)=>{calls++;assert.equal(path,'/api/content/resolve');return {ok:true,json:async()=>({success:true,data:{text,sourceUrl:url}})}}});assert.equal(calls,1);assert.equal(extracted.sourceType,'xiaohongshu');assert.deepEqual(stages,['reading']);
 for(const bad of ['https://localhost/a','https://127.0.0.1/a','https://example.com/a','https://www.xiaohongshu.com.evil.example/a','file:///a','https://user:secret@www.xiaohongshu.com/a','https://www.xiaohongshu.com:8080/a'])assert.throws(()=>identifyTripSource(bad));
 assert.equal(identifyTripSource('https://xhslink.com/a/test').inputType,'xiaohongshu_url');
 const source=await extractTripSource({text},{fetcher:async()=>{throw Error('must not call Firecrawl')}});assert.equal(source.sourceType,'text');assert(!source.text.includes('https://'));
 await assert.rejects(extractTripSource({text:url},{fetcher:async()=>{throw Error('offline')}}),{code:'SOURCE_FETCH_FAILED'});
 await assert.rejects(extractTripSource({text:url},{fetcher:async()=>({ok:false,json:async()=>({error:{code:'SOURCE_EMPTY_CONTENT',message:'empty'}})})}),{code:'SOURCE_EMPTY_CONTENT'});
});
test('旧 Firecrawl 服务/缓存复用，经两个原接口进入统一 TripDraft；空正文与缺 Key 安全失败',async()=>{
 const keys=['NODE_ENV','WEB_APP_ORIGIN','ZHIPU_API_KEY','ZHIPU_MODEL','FIRECRAWL_API_KEY','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'],before=keys.map(k=>process.env[k]),oldFetch=global.fetch;
 try{
  Object.assign(process.env,{NODE_ENV:'production',WEB_APP_ORIGIN:'https://departly.example',ZHIPU_API_KEY:'fixture-glm-secret',ZHIPU_MODEL:'glm-5.3-flashx',FIRECRAWL_API_KEY:'fixture-firecrawl-secret',UPSTASH_REDIS_REST_URL:'https://fixture-redis.example',UPSTASH_REDIS_REST_TOKEN:'fixture'});
  let scrapes=0,empty=false;global.fetch=async(target,options)=>{if(target==='https://fixture-redis.example')return {ok:true,json:async()=>({result:1})};if(target==='https://api.firecrawl.dev/v2/scrape'){scrapes++;assert.equal(options.headers.Authorization,'Bearer fixture-firecrawl-secret');return {ok:true,json:async()=>({success:true,data:{markdown:empty?'':text,metadata:{title:'东京攻略'}}})}};assert.equal(target,'https://open.bigmodel.cn/api/paas/v4/chat/completions');return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({days:[{dayIndex:1,items:[{placeName:'浅草寺'},{placeName:'仲见世'}]}]})}}]})};};
  const input={...initialCreation(),form:{name:'',country:'日本',city:'东京',start:'2026-10-07',end:'2026-10-07'},text:url},request=importRequest(input),stages=[];
  const fetcher=async(path,options)=>{const res={status(n){this.code=n;return this},json(v){this.body=v;return this},setHeader(){}};await (path==='/api/content/resolve'?resolveHandler:parseHandler)({method:'POST',headers:{origin:'https://departly.example'},socket:{remoteAddress:'127.0.0.1'},body:JSON.parse(options.body)},res);return {ok:res.code===200,json:async()=>res.body};};
  const draft=await generateImport(request.base,request.request,{fetcher,onStage:stage=>stages.push(stage)});assert.equal(draft.creationMode,'text_import');assert.equal(draft.sourceType,'xiaohongshu');assert.equal(draft.days[0].items[0].placeName,'浅草寺');assert.deepEqual(stages,['reading','parsing']);assert(!JSON.stringify(draft).includes('fixture-firecrawl-secret'));assert.equal(scrapes,1);
  await resolveContent(url+'?xsec_token=second');assert.equal(scrapes,1);
  empty=true;const res={status(n){this.code=n;return this},json(v){this.body=v;return this},setHeader(){}};await resolveHandler({method:'POST',headers:{origin:'https://departly.example'},socket:{remoteAddress:'127.0.0.1'},body:{url:'https://www.xiaohongshu.com/explore/111111111111111111111111'}},res);assert.equal(res.body.error.code,'SOURCE_EMPTY_CONTENT');
  delete process.env.FIRECRAWL_API_KEY;await resolveHandler({method:'POST',headers:{origin:'https://departly.example'},socket:{remoteAddress:'127.0.0.1'},body:{url:'https://www.xiaohongshu.com/explore/222222222222222222222222'}},res);assert.equal(res.body.error.code,'SOURCE_FETCH_FAILED');assert(!JSON.stringify(res.body).includes('fixture-firecrawl-secret'));
 }finally{global.fetch=oldFetch;keys.forEach((k,i)=>before[i]===undefined?delete process.env[k]:process.env[k]=before[i])}
});

test('服务端缺 Firecrawl Key 明确诊断，不发网络请求，不将标题交给 GLM',async()=>{
 const oldKey=process.env.FIRECRAWL_API_KEY,oldEnv=process.env.NODE_ENV,oldFetch=global.fetch,oldWarn=console.warn,logs=[];
 try{delete process.env.FIRECRAWL_API_KEY;process.env.NODE_ENV='development';let calls=0;global.fetch=async()=>{calls++;throw Error('must not call provider')};console.warn=(...args)=>logs.push(args);
 await assert.rejects(serverExtract({text:'58 【重庆三天两夜旅游攻略 自由行附路线】 分享口令\n'+url}),{code:'SOURCE_FETCH_FAILED'});assert.equal(calls,0);assert(logs.some(a=>a[0]==='[Trip Source] Missing FIRECRAWL_API_KEY'));assert(logs.some(a=>a[1]?.urlDetected===true&&a[1]?.firecrawlCalled===false&&a[1]?.reason==='missing_key'));
 }finally{global.fetch=oldFetch;console.warn=oldWarn;oldKey===undefined?delete process.env.FIRECRAWL_API_KEY:process.env.FIRECRAWL_API_KEY=oldKey;oldEnv===undefined?delete process.env.NODE_ENV:process.env.NODE_ENV=oldEnv}
});
