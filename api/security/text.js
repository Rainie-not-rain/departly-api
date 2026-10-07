import {authenticate,rateLimit,validateText} from '../../lib/api-security.js';


export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({success:false,error:{message:'请使用 POST 请求'}});
  try{
    const identity=authenticate(req);validateText(req.body?.content);await rateLimit(identity);
    // 保留旧响应字段；明确标注未执行内容审核。
    return res.status(200).json({success:true,data:{suggest:'pass',moderation:'disabled'},error:null});
  }catch(error){return res.status(error.status||502).json({success:false,error:{code:error.code||'TEXT_VALIDATION_FAILED',message:error.message}})}
}
