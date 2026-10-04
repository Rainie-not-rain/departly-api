import {randomUUID} from 'node:crypto'
import {callZhipu} from '../../lib/zhipu.js'
import {buildTripPlanPrompt} from '../../lib/prompts.js'
import {parseAIJson,validateInput,normalizeResult} from '../../lib/ai-json.js'
import {success,failure,apiError} from '../../lib/response.js'
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return failure(res,apiError('METHOD_NOT_ALLOWED','请使用 POST 请求',405))}
 const started=Date.now(),requestId=randomUUID(),model=process.env.ZHIPU_MODEL;let input;
 const log=code=>({requestId,task:'trip-plan',model,days:input?.dayCount||0,ms:Date.now()-started,code});
 try{
  input=validateInput(req.body,'plan');console.log('[trip-plan request]',log(null));
  const content=await callZhipu({messages:buildTripPlanPrompt(input),temperature:0.3,maxTokens:3000,timeoutMs:35000,model});
  const result=normalizeResult(parseAIJson(content),input,'plan');console.log('[trip-plan success]',log(null));return success(res,result)
 }catch(error){console.error('[trip-plan error]',log(error.code||'AI_REQUEST_FAILED'));return failure(res,error)}
}
