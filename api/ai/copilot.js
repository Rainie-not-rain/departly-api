import {refinePendingProposal} from '../../lib/proposal-refinement.js';
import {randomUUID} from 'node:crypto';
import {requestBudget} from '../../lib/api-security.js';
import {protectTripPlanRequest} from '../../lib/web-trip-plan-security.js';
import {callZhipu} from '../../lib/zhipu.js';
import {copilotInput,normalizeCopilotResponse} from '../../lib/copilot.js';
import {parseAIJson} from '../../lib/ai-json.js';
import {answerExtras} from '../../lib/copilot-experience.js';
import {success,failure,apiError} from '../../lib/response.js';
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return failure(res,apiError('METHOD_NOT_ALLOWED','请使用 POST 请求',405));}
 const started=Date.now(),requestId=randomUUID(),budget=requestBudget();let input,ok=false;
 try{
  await protectTripPlanRequest(req,budget);
  input=copilotInput(typeof req.body==='string'?JSON.parse(req.body):req.body);
  const refinement=refinePendingProposal(input.context,input.pending,input.messages.at(-1).content,randomUUID);
  if(refinement){ok=true;return success(res,refinement);}
  const model=process.env.ZHIPU_MODEL;
  const content=await callZhipu({messages:input.messages,temperature:0.2,maxTokens:2400,timeoutMs:budget.remaining(35000),model,reasoningEffort:/^glm-5[.]3-flashx?$/i.test(model||'')?'low':undefined});
  const parsed=parseAIJson(content),query=input.messages.at(-1).content;
  const result=normalizeCopilotResponse(parsed,input.context,query,()=>randomUUID());
  if(process.env.NODE_ENV==='development'&&result.invalidCount)console.warn('[Copilot Action rejected]',{requestId,invalidCount:result.invalidCount,missingDayIds:input.context.days.filter(d=>!d.id).length,missingItemIds:input.context.days.reduce((n,d)=>n+d.items.filter(i=>!i.id).length,0),diagnostics:result.diagnostics});
  if(process.env.NODE_ENV==='development')console.log('[Copilot Action]',{requestId,proposalCount:parsed.proposals?.length||0,proposalTypes:result.proposals.map(p=>p.type),validCount:result.proposals.length});
  ok=true;return success(res,{reply:result.reply,proposals:result.proposals,...answerExtras(input.context,query)});
 }catch(error){return failure(res,error);}finally{
  if(process.env.NODE_ENV==='development')console.log('[Copilot]',{requestId,tripId:input?.context.trip.id,contextDays:input?.context.days.length,contextItems:input?.context.days.reduce((n,d)=>n+d.items.length,0),messageCount:input?input.messages.length-2:0,model:process.env.ZHIPU_MODEL,ms:Date.now()-started,success:ok});
 }
}
