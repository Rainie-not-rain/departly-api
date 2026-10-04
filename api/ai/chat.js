import {randomUUID} from 'node:crypto'
import {callZhipu} from '../../lib/zhipu.js'
import {parseAIJson} from '../../lib/ai-json.js'
import {validateXiaobuInput,buildXiaobuPrompt,normalizeXiaobuResponse} from '../../lib/xiaobu.js'
import {success,failure,apiError} from '../../lib/response.js'
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return failure(res,apiError('METHOD_NOT_ALLOWED','请使用 POST 请求',405))}
 const started=Date.now(),requestId=randomUUID(),model=process.env.ZHIPU_CHAT_MODEL?.trim()||process.env.ZHIPU_MODEL,maxTokens=1000,timeoutMs=38000
 let promptChars=0,historyCount=0,upstreamMs=0,errorCode=null,stage='input',metadata={},validationReason=null
 try{
  const input=validateXiaobuInput(req.body),messages=buildXiaobuPrompt(input)
  promptChars=messages.reduce((sum,m)=>sum+m.content.length,0);historyCount=messages.filter(m=>m.role!=='system').length-1
  const upstreamStarted=Date.now();let content;stage='upstream'
  try{content=await callZhipu({messages,temperature:0.3,maxTokens,timeoutMs,model,responseFormat:{type:'json_object'},reasoningEffort:/^glm-5\.3(?:-|$)/i.test(model||'')?'low':undefined,onMetadata:value=>metadata=value})}finally{upstreamMs=Date.now()-upstreamStarted}
  stage='json_parse';const parsed=parseAIJson(content);stage='schema_validation';const result=normalizeXiaobuResponse(parsed,input);stage='success';return success(res,result)
 }catch(error){errorCode=error.code||'AI_REQUEST_FAILED';validationReason=error.validationReason||null;return failure(res,error)}
 finally{console.log('[xiaobu performance]',{requestId,model:model||null,promptChars,historyCount,maxTokens,timeoutMs,upstreamMs,totalMs:Date.now()-started,errorCode,stage,validationReason,...metadata})}
}
