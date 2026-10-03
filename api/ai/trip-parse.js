import {randomUUID} from 'node:crypto'
import {callZhipu} from '../../lib/zhipu.js'
import {buildTripParsePrompt} from '../../lib/prompts.js'
import {parseAIJson,validateInput,normalizeResult} from '../../lib/ai-json.js'
import {success,failure,apiError} from '../../lib/response.js'
export default async function handler(req,res){if(req.method!=='POST'){res.setHeader('Allow','POST');return failure(res,apiError('METHOD_NOT_ALLOWED','请使用 POST 请求',405))}const started=Date.now(),requestId=randomUUID();try{const input=validateInput(req.body,'parse'),content=await callZhipu({messages:buildTripParsePrompt(input),temperature:0.1});return success(res,normalizeResult(parseAIJson(content),input,'parse'))}catch(error){console.error({requestId,task:'trip-parse',model:process.env.ZHIPU_MODEL,ms:Date.now()-started,code:error.code||'AI_REQUEST_FAILED'});return failure(res,error)}}
