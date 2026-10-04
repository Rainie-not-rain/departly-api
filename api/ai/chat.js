import {randomUUID} from 'node:crypto'
import {callZhipu} from '../../lib/zhipu.js'
import {parseAIJson} from '../../lib/ai-json.js'
import {validateXiaobuInput,buildXiaobuPrompt,normalizeXiaobuResponse} from '../../lib/xiaobu.js'
import {success,failure,apiError} from '../../lib/response.js'
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return failure(res,apiError('METHOD_NOT_ALLOWED','请使用 POST 请求',405))}
 const started=Date.now(),requestId=randomUUID(),model=process.env.ZHIPU_MODEL
 try{const input=validateXiaobuInput(req.body);const content=await callZhipu({messages:buildXiaobuPrompt(input),temperature:0.35,maxTokens:1800,timeoutMs:35000,model});const result=normalizeXiaobuResponse(parseAIJson(content),input);console.log('[xiaobu success]',{requestId,model,ms:Date.now()-started});return success(res,result)}catch(error){console.error('[xiaobu error]',{requestId,ms:Date.now()-started,code:error.code||'AI_REQUEST_FAILED'});return failure(res,error)}
}
