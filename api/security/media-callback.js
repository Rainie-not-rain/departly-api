import {verifyCallback,acceptCallback} from '../../lib/media-security.js';
import {failure,apiError} from '../../lib/response.js';
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');try{if(req.method==='GET')return res.status(200).send(verifyCallback(req.query||{},null));if(req.method!=='POST')throw apiError('METHOD_NOT_ALLOWED','请求方式不支持',405);await acceptCallback(verifyCallback(req.query||{},req.body));return res.status(200).send('success')}catch(error){return failure(res,error)}}
