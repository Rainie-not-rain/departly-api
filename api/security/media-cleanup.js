import {cleanupMedia} from '../../lib/media-security.js';
import {success,failure,apiError} from '../../lib/response.js';
export default async function handler(req,res){try{if(!process.env.CRON_SECRET||req.headers?.authorization!=='Bearer '+process.env.CRON_SECRET)throw apiError('UNAUTHORIZED','无权清理照片',401);return success(res,await cleanupMedia())}catch(error){return failure(res,error)}}
