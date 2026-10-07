import './security-fixture.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import handler,{EXPENSE_PARSE_SYSTEM} from '../api/ai/expense-parse.js';
async function request(text,method='POST'){let status,payload;await handler({method,headers:{origin:'http://localhost:3000','sec-fetch-site':'same-origin'},socket:{remoteAddress:'expense-api-fixture'},body:{text}},{setHeader(){},status(s){status=s;return this;},json(p){payload=p;return this;}});return {status,payload};}
test('expense API uses existing GLM, returns Intent only, and protects against invalid JSON/IDs/provider errors',async()=>{
 const saved={fetch:global.fetch,key:process.env.ZHIPU_API_KEY,model:process.env.ZHIPU_MODEL,node:process.env.NODE_ENV};process.env.ZHIPU_API_KEY='expense-test-key';process.env.ZHIPU_MODEL='glm-5.3-flashx';process.env.NODE_ENV='development';
 let raw={amount:168,currency:null,category:'餐饮',note:'午饭',expenseDateText:null,payerReference:'我',participantReferences:['大家'],excludedParticipantReferences:[],splitType:'equal',customSplitReferences:[]},calls=0;
 try{
  global.fetch=async(url,opts)=>{calls++;assert.equal(url,'https://open.bigmodel.cn/api/paas/v4/chat/completions');const b=JSON.parse(opts.body);assert.equal(b.messages[0].content,EXPENSE_PARSE_SYSTEM);assert.equal(b.messages[1].content,'午饭168，我付的，大家平摊');assert.doesNotMatch(opts.body,/member_[0-9]/);return {ok:true,status:200,json:async()=>({choices:[{finish_reason:'stop',message:{content:'```json\n'+JSON.stringify(raw)+'\n```'}}]})};};
  const r=await request('午饭168，我付的，大家平摊');assert.equal(r.status,200);assert.equal(r.payload.data.intent.amount,168);assert.equal(calls,1);assert.doesNotMatch(JSON.stringify(r.payload),/expense-test-key|payerId|amountFen|convertedAmountCNY/);
  raw={...raw,payerId:'member_123'};assert.equal((await request('午饭168，我付的，大家平摊')).status,502);
  global.fetch=async()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:'{malformed'},finish_reason:'stop'}]})});assert.equal((await request('午饭')).status,502);
  global.fetch=async()=>({ok:false,status:503});assert.equal((await request('午饭')).status,502);
  assert.equal((await request('')).status,400);assert.equal((await request('a'.repeat(1001))).status,400);assert.equal((await request('午饭','GET')).status,405);
 }finally{global.fetch=saved.fetch;for(const [k,v] of [['ZHIPU_API_KEY',saved.key],['ZHIPU_MODEL',saved.model],['NODE_ENV',saved.node]])if(v===undefined)delete process.env[k];else process.env[k]=v;}
});
