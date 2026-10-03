export function apiError(code,message,status=400){return Object.assign(new Error(message),{code,status})}
export function success(res,data){return res.status(200).json({success:true,data,error:null})}
export function failure(res,error){const known=['INVALID_INPUT','TRIP_TOO_LONG','AI_REQUEST_FAILED','AI_TIMEOUT','AI_RESPONSE_INVALID','AI_EMPTY_RESULT','METHOD_NOT_ALLOWED'];const safe=known.includes(error.code);return res.status(safe?error.status||502:502).json({success:false,data:null,error:{code:safe?error.code:'AI_REQUEST_FAILED',message:safe?error.message:'这次没有整理成功，请稍后重试'}})}
