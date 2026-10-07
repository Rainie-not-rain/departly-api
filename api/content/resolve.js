import {protectTripPlanRequest} from '../../lib/web-trip-plan-security.js'
import {extractTripSource} from '../../lib/content/trip-source.js'
import {apiError,success,failure} from '../../lib/response.js'
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return failure(res,apiError('METHOD_NOT_ALLOWED','请使用 POST 请求',405))}
 try{await protectTripPlanRequest(req);let body=req.body;if(typeof body==='string')body=JSON.parse(body);return success(res,await extractTripSource({text:body?.url||'',city:body?.city||''}))}
 catch(error){return failure(res,error)}
}
