import {createHmac,timingSafeEqual} from 'node:crypto';
import {wechatAccessToken} from '../../lib/wechat-link.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({success:false,error:{message:'请使用 POST 请求'}});
  try{
    const secret=process.env.WECHAT_APP_SECRET;
    if(!secret)throw Error('后端尚未配置微信登录');
    const token=String(req.headers?.authorization||'').replace(/^Bearer /,'');
    const parts=token.split('.');
    if(parts.length!==2)throw Error('请重新微信登录');
    const expected=createHmac('sha256',secret).update(parts[0]).digest();
    const signature=Buffer.from(parts[1],'base64url');
    if(signature.length!==expected.length||!timingSafeEqual(signature,expected))throw Error('请重新微信登录');
    const identity=JSON.parse(Buffer.from(parts[0],'base64url').toString());
    if(typeof identity.sub!=='string'||!identity.sub||!Number.isFinite(identity.exp)||identity.exp<=Date.now()/1000)throw Error('请重新微信登录');
    const content=req.body?.content;
    if(typeof content!=='string'||!content.trim()||Buffer.byteLength(content,'utf8')>2400)throw Error('文字内容为空或过长，请分段提交');
    const accessToken=await wechatAccessToken();
    const response=await fetch('https://api.weixin.qq.com/wxa/msg_sec_check?access_token='+encodeURIComponent(accessToken),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({openid:identity.sub,version:2,scene:2,content}),signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw Error('内容检测服务暂不可用，请重试');
    const data=await response.json(),suggest=data.result?.suggest;
    if(data.errcode!==0||!['pass','review','risky'].includes(suggest))throw Error('内容检测未完成，请重试');
    return res.status(200).json({success:true,data:{suggest},error:null});
  }catch(error){return res.status(502).json({success:false,error:{message:error.name==='TimeoutError'?'内容检测超时，请重试':error instanceof SyntaxError?'请重新微信登录':error.message}})}
}
