import {randomUUID} from 'node:crypto'
import {resolveContent} from '../../lib/content/resolver.js'
import {apiError,success,failure} from '../../lib/response.js'
export default async function handler(req,res){if(req.method!=='POST'){res.setHeader('Allow','POST');return failure(res,apiError('METHOD_NOT_ALLOWED','请使用 POST 请求',405))}const requestId=randomUUID();try{let body=req.body;if(typeof body==='string'){try{body=JSON.parse(body)}catch{throw apiError('INVALID_INPUT','请求数据格式不正确')}}return success(res,await resolveContent(body?.url))}catch(error){console.warn('[content-resolve-failed]',{requestId,code:error.code||'CONTENT_RESOLVE_FAILED'});return failure(res,error)}}
