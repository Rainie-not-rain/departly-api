import {requestBudget} from '../../lib/api-security.js'
import {protectTripPlanRequest} from '../../lib/web-trip-plan-security.js'
import {verifyPlanPlaces} from '../../lib/trip-plan-poi.js'
import {randomUUID} from 'node:crypto'
import {callZhipu} from '../../lib/zhipu.js'
import {buildTripPlanPrompt} from '../../lib/prompts.js'
import {parseAIJson,validateInput,normalizeResult} from '../../lib/ai-json.js'
import {success,failure,apiError} from '../../lib/response.js'
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return failure(res,apiError('METHOD_NOT_ALLOWED','请使用 POST 请求',405))}
 const budget=requestBudget();const started=Date.now(),requestId=randomUUID(),model=process.env.ZHIPU_MODEL;let input,stage='security';
 const log=code=>({requestId,task:'trip-plan',model,days:input?.dayCount||0,ms:Date.now()-started,code});
 try{
  await protectTripPlanRequest(req,budget);stage='input';input=validateInput(req.body,'plan');console.log('[trip-plan request]',log(null));
  stage='provider';const content=await callZhipu({messages:buildTripPlanPrompt(input),temperature:0.3,timeoutMs:budget.remaining(35000),model,reasoningEffort:/^glm-5[.]3-flashx?$/i.test(model||'')?'low':undefined,onMetadata:meta=>{if(process.env.NODE_ENV==='development')console.log('[TripPlan] provider diagnostic',{requestId,...meta});}});
  stage='json';const parsed=parseAIJson(content);if(process.env.NODE_ENV==='development')console.log('[TripPlan] JSON parsed',{requestId});stage='schema';const normalized=normalizeResult(parsed,input,'plan');if(process.env.NODE_ENV==='development')console.log('[TripPlan] schema valid',{requestId});let groundingMs=0;try{groundingMs=budget.remaining(4000)}catch{}const result=await verifyPlanPlaces(normalized,undefined,{country:input.country,city:input.city,timeoutMs:groundingMs});if(process.env.NODE_ENV==='development')console.log('[TripPlan] normalized trip plan returned',{requestId});console.log('[trip-plan success]',log(null));return success(res,result)
 }catch(error){if(process.env.NODE_ENV==='development')console.error('[TripPlan] response diagnostic',{requestId,stage,...error.diagnostic});if(stage==='json')console.error('[TripPlan] JSON parse failed');else if(stage==='schema'||error.code==='AI_RESPONSE_INVALID'||error.code==='AI_EMPTY_RESULT')console.error('[TripPlan] Invalid model response');console.error('[trip-plan error]',{...log(error.code||'AI_REQUEST_FAILED'),stage});return failure(res,error)}
}
