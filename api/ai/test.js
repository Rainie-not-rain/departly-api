export default function handler(req,res){return res.status(404).json({success:false,data:null,error:{code:'NOT_FOUND',message:'此接口已停用'}})}
