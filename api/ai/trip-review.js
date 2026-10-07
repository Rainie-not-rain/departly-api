import {requestBudget} from '../../lib/api-security.js';
import {protectTripPlanRequest} from '../../lib/web-trip-plan-security.js';
import {callZhipu} from '../../lib/zhipu.js';
import {parseAIJson} from '../../lib/ai-json.js';
import {reviewAIInput,TRIP_REVIEW_SYSTEM,validateTripReviewAI} from '../../lib/trip-review-ai.js';
import {hasTripReviewData,fallbackTripReview} from '../../lib/trip-review-context.js';
import {success,failure,apiError} from '../../lib/response.js';
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return failure(res,apiError('METHOD_NOT_ALLOWED','请使用 POST 请求',405));}
 const started=Date.now(),budget=requestBudget();let context;
 try{await protectTripPlanRequest(req,budget);context=reviewAIInput(typeof req.body==='string'?JSON.parse(req.body):req.body);}catch(e){return failure(res,e);}
 if(!hasTripReviewData(context))return success(res,{...fallbackTripReview(context),fallback:true});
 try{const model=process.env.ZHIPU_MODEL,content=await callZhipu({messages:[{role:'system',content:TRIP_REVIEW_SYSTEM},{role:'user',content:JSON.stringify(context)}],temperature:0.2,maxTokens:1800,timeoutMs:budget.remaining(35000),model,reasoningEffort:/^glm-5[.]3-flashx?$/i.test(model||'')?'low':undefined});return success(res,{...validateTripReviewAI(parseAIJson(content),context),fallback:false});}
 catch(e){if(process.env.NODE_ENV==='development')console.warn('[Trip Review]',{tripId:context.trip.id,reason:e.code||e.name,fallback:true,durationMs:Date.now()-started});return success(res,{...fallbackTripReview(context),fallback:true});}
}
