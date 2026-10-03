import {resolveWithFirecrawl} from './firecrawl.js'
import {validateContent} from '../normalize.js'
// 增加 Adapter 或调整此顺序即可替换 Provider，不改变 API 和前端。
const providers=[resolveWithFirecrawl]
export async function resolveWithProviders(url,adapters=providers){let lastCode='CONTENT_RESOLVE_FAILED';for(const adapter of adapters){try{const result=await adapter(url);if(result?.success&&result.content?.text)return {...result,content:validateContent(result.content)}}catch(error){lastCode=['CONTENT_PROVIDER_UNAVAILABLE','CONTENT_TOO_SHORT','CONTENT_RESOLVE_FAILED'].includes(error.code)?error.code:'CONTENT_PROVIDER_UNAVAILABLE';console.warn('[content-provider-failed]',{code:lastCode})}}return {success:false,errorCode:lastCode}}
