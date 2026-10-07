import test from 'node:test';
import assert from 'node:assert/strict';
import {initialCreation} from '../app/trip/creation-service.js';
import {planningRequest,generatePlan} from '../app/trip/ai-planning.js';
import {importRequest,generateImport} from '../app/trip/ai-import.js';
const input=()=>({...initialCreation(),form:{name:'重庆旅程',country:'中国',city:'重庆',start:'2026-10-07',end:'2026-10-08'},text:'Day1 解放碑，下午山城步道。Day2 上午磁器口散步'});
test('已取消的规划和攻略解析不发起任何请求，保留输入',async()=>{
 const form=input(),before=JSON.stringify(form),controller=new AbortController();controller.abort();let calls=0;
 for(const [prepare,generate] of [[planningRequest,generatePlan],[importRequest,generateImport]]){const {base,request}=prepare(form);await assert.rejects(generate(base,request,{signal:controller.signal,fetcher:async()=>{calls++;throw Error('不可请求');}}),{name:'AbortError'});}
 assert.equal(calls,0);assert.equal(JSON.stringify(form),before);
});
test('取消后晚到的模型响应不生成规划或解析草稿',async()=>{
 for(const [prepare,generate] of [[planningRequest,generatePlan],[importRequest,generateImport]]){const {base,request}=prepare(input()),before=JSON.stringify(base),controller=new AbortController();
 await assert.rejects(generate(base,request,{signal:controller.signal,fetcher:async()=>({ok:true,json:async()=>{controller.abort();return {success:true,data:{days:[{dayIndex:1,items:[{placeName:'解放碑'}]}]}};}})}),{name:'AbortError'});assert.equal(JSON.stringify(base),before);}
});
test('读取小红书时取消，不继续请求 Trip Parse',async()=>{
 const {base,request}=importRequest({...input(),text:'重庆攻略 https://www.xiaohongshu.com/explore/123456789012345678901234'}),controller=new AbortController();let calls=0;
 await assert.rejects(generateImport(base,request,{signal:controller.signal,fetcher:async url=>{calls++;assert.equal(url,'/api/content/resolve');return {ok:true,json:async()=>{controller.abort();return {success:true,data:{text:'Day1 解放碑。Day2 磁器口'}};}};}}));assert.equal(calls,1);
});
