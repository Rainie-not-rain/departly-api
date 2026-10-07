import {readMedia} from '../../lib/media-security.js';
import {failure,apiError} from '../../lib/response.js';
export default async function handler(req,res){res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');try{if(!['GET','HEAD'].includes(req.method))throw apiError('METHOD_NOT_ALLOWED','请求方式不支持',405);const file=await readMedia(req.query||{});res.setHeader('Content-Type',file.type);return res.status(200).send(req.method==='HEAD'?'':file.bytes)}catch(error){return failure(res,error)}}
