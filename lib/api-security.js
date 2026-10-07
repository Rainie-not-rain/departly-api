import {createHmac,timingSafeEqual} from 'node:crypto';
import {apiError} from './response.js';
export function requestBudget(durationMs=45000){const deadline=Date.now()+durationMs-3000;return {remaining(cap=Infinity){const ms=deadline-Date.now();if(ms<1000)throw apiError('AI_TIMEOUT','生成时间有点久，请重新试试',504);return Math.min(cap,ms)}}}
export function authenticate(req){
 const secret=process.env.WECHAT_APP_SECRET;if(!secret)throw apiError('SECURITY_UNAVAILABLE','微信身份服务尚未配置',503);
 try{const token=String(req.headers?.authorization||'').replace(/^Bearer /,'');if(token.length>2048)throw Error();const parts=token.split('.');if(parts.length!==2)throw Error();const signature=Buffer.from(parts[1],'base64url'),expected=createHmac('sha256',secret).update(parts[0]).digest();if(signature.length!==expected.length||!timingSafeEqual(signature,expected))throw Error();const value=JSON.parse(Buffer.from(parts[0],'base64url').toString());if(typeof value.sub!=='string'||!value.sub||value.sub.length>128||!Number.isFinite(value.exp)||value.exp<=Date.now()/1000)throw Error();return value;}catch{throw apiError('UNAUTHORIZED',"微信身份已失效，请重新获取",401)}
}
export async function rateLimit(identity,budget,secret=process.env.WECHAT_APP_SECRET){
 const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;
 if(!url||!token||!url.startsWith('https://'))throw apiError('SECURITY_UNAVAILABLE',"服务限流尚未配置",503);
 const script="local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end;return n";
 try{for(const [window,limit] of [[60,10],[86400,100]]){const key='departly:paid:'+createHmac('sha256',secret).update(identity.sub).digest('hex')+':'+window+':'+Math.floor(Date.now()/1000/window);const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(['EVAL',script,'1',key,String(window+1)]),signal:AbortSignal.timeout(budget?budget.remaining(5000):5000)});if(!response.ok)throw Error();const result=await response.json();if(!Number.isInteger(result.result)||result.result<1)throw Error();if(result.result>limit)throw apiError('RATE_LIMITED',"请求过于频繁，请稍后重试",429)}}catch(error){if(error.code==='RATE_LIMITED'||error.code==='AI_TIMEOUT')throw error;throw apiError('SECURITY_UNAVAILABLE',"请求额度检查失败，请稍后重试",503)}
}
export function validateText(content){
 if(typeof content!=='string'||!content.trim()||Buffer.byteLength(content)>2400)throw apiError('INVALID_INPUT','文字内容为空或过长',400);
}
export async function protectRequest(req,budget){
 const identity=authenticate(req);let encoded;try{encoded=JSON.stringify(req.body)}catch{throw apiError('INVALID_INPUT',"请求数据格式不正确",400)}
 if(typeof encoded!=='string'||Buffer.byteLength(encoded)>32000)throw apiError('INVALID_INPUT',"请求内容过长，请精简后重试",400);
 await rateLimit(identity,budget);
 const validateDepth=(value,depth=0)=>{if(depth>20)throw apiError('INVALID_INPUT','请求数据层级过多',400);if(value&&typeof value==='object')Object.values(value).forEach(v=>validateDepth(v,depth+1))};validateDepth(req.body);
 return identity;
}
