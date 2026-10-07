import {protectRequest,rateLimit} from './api-security.js';
import {apiError} from './response.js';
const localKey=Symbol.for('departly.trip-plan.development-limits');
const localLimits=globalThis[localKey]||(globalThis[localKey]=new Map());
function developmentRateLimit(identity){
 const now=Date.now();for(const [key,row] of localLimits)if(row.expiresAt<=now)localLimits.delete(key);
 for(const [seconds,limit] of [[60,10],[86400,100]]){const window=Math.floor(now/(seconds*1000)),key=identity+':'+seconds+':'+window,row=localLimits.get(key)||{count:0,expiresAt:(window+1)*seconds*1000};row.count++;localLimits.set(key,row);if(row.count>limit)throw apiError('RATE_LIMITED','请求过于频繁，请稍后重试',429);}
}
// Existing signed clients retain their authentication. Trip-plan, trip-parse and content-resolve accept
// anonymous, same-origin Web requests; every request still uses durable limits.
export async function protectTripPlanRequest(req,budget){
 if(req.headers?.authorization||!req.headers?.origin)return protectRequest(req,budget);
 const origin=req.headers.origin,site=req.headers['sec-fetch-site'];
 const allowed=process.env.WEB_APP_ORIGIN?[process.env.WEB_APP_ORIGIN]:process.env.NODE_ENV!=='production'?['http://localhost:3000','http://127.0.0.1:3000']:[];
 if(!allowed.includes(origin)||(site&&site!=='same-origin'))throw apiError('UNAUTHORIZED','请求来源不正确',401);
 if(!process.env.ZHIPU_API_KEY||!process.env.ZHIPU_MODEL){for(const key of ['ZHIPU_API_KEY','ZHIPU_MODEL'])if(!process.env[key])console.error('[TripPlan] Missing '+key);throw apiError('SECURITY_UNAVAILABLE','AI 服务尚未配置',503);}
 let encoded;try{encoded=JSON.stringify(req.body);}catch{throw apiError('INVALID_INPUT','请求数据格式不正确',400);}
 if(!encoded||Buffer.byteLength(encoded)>32000)throw apiError('INVALID_INPUT','请求内容过长，请精简后重试',400);
 // Do not trust caller-supplied forwarded addresses. On shared reverse proxies
 // the transport peer shares an allowance, rather than allowing quota bypass.
 const identity='web-trip-plan:'+String(req.socket?.remoteAddress||'shared');
 if(process.env.NODE_ENV==='development'&&(!process.env.UPSTASH_REDIS_REST_URL||!process.env.UPSTASH_REDIS_REST_TOKEN)){
  console.warn('[TripPlan] Redis not configured; development in-memory limit: 10/min, 100/day (resets on server restart)');
  developmentRateLimit(identity);return;
 }
 try{await rateLimit({sub:identity},budget,process.env.ZHIPU_API_KEY);}catch(error){if(error.code==='SECURITY_UNAVAILABLE')console.error('[TripPlan] Redis unavailable');throw error;}
}
