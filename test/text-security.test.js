import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import handler from '../api/security/text.js';
test('文字接口停用审核，保留登录、限流和长度校验',async()=>{
 const keys=['WECHAT_APP_SECRET','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'],before=keys.map(k=>process.env[k]),original=global.fetch;
 Object.assign(process.env,{WECHAT_APP_SECRET:'test-secret',UPSTASH_REDIS_REST_URL:'https://redis.test',UPSTASH_REDIS_REST_TOKEN:'redis'});
 const payload=Buffer.from(JSON.stringify({sub:'user',exp:Date.now()/1000+300})).toString('base64url'),token=payload+'.'+createHmac('sha256','test-secret').update(payload).digest('base64url');
 const response=()=>({setHeader(){},status(n){this.statusCode=n;return this},json(v){this.body=v;return this}});
 let calls=0;global.fetch=async url=>{assert.equal(url,'https://redis.test');calls++;return {ok:true,json:async()=>({result:1})}};
 try{
  const req={method:'POST',headers:{authorization:'Bearer '+token},body:{content:'hello'}},accepted=response();await handler(req,accepted);assert.equal(accepted.statusCode,200);assert.deepEqual(accepted.body.data,{suggest:'pass',moderation:'disabled'});assert.equal(calls,2);
  const forged=response();await handler({...req,headers:{authorization:'Bearer forged'}},forged);assert.equal(forged.statusCode,401);
  for(const content of ['', '字'.repeat(801)]){const invalid=response();await handler({...req,body:{content}},invalid);assert.equal(invalid.statusCode,400)}assert.equal(calls,2);
  global.fetch=async()=>({ok:true,json:async()=>({result:11})});const limited=response();await handler(req,limited);assert.equal(limited.statusCode,429);
 }finally{global.fetch=original;keys.forEach((k,i)=>before[i]===undefined?delete process.env[k]:process.env[k]=before[i])}
});
