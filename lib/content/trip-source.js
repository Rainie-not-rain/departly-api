import {identifyTripSource} from '../trip-source-input.js';
import {resolveContent} from './resolver.js';
import {apiError} from '../response.js';
export async function extractTripSource(input){
 const started=Date.now(),source=identifyTripSource(input.text,input.city);
 const development=process.env.NODE_ENV==='development';
 if(source.inputType==='text'){
  if(development)console.log('[Trip Source]',{sourceType:'text',urlDetected:false,firecrawlCalled:false,fetchSuccess:true,extractedTextLength:source.text.length,durationMs:Date.now()-started});
  return {sourceType:'text',sourceUrl:null,text:source.text};
 }
 let firecrawlCalled=false;
 try{
  if(!process.env.FIRECRAWL_API_KEY){if(development)console.warn('[Trip Source] Missing FIRECRAWL_API_KEY');throw apiError('SOURCE_FETCH_FAILED','暂时没能读取这篇攻略，可以复制攻略正文后再试。',503)}
  firecrawlCalled=true;const content=await resolveContent(source.sourceUrl);
  if(development)console.log('[Trip Source]',{sourceType:'xiaohongshu',urlDetected:true,firecrawlCalled:!content.cached,fetchSuccess:true,extractedTextLength:content.text.length,cached:content.cached,durationMs:Date.now()-started});
  return {...content,sourceType:'xiaohongshu',sourceUrl:content.sourceUrl,text:[content.title,content.text].filter(Boolean).join('\n').slice(0,10000)};
 }catch(error){
  const code=error.code==='CONTENT_TOO_SHORT'?'SOURCE_EMPTY_CONTENT':error.code==='INVALID_INPUT'?'SOURCE_INVALID_URL':'SOURCE_FETCH_FAILED';
  if(development)console.warn('[Trip Source]',{sourceType:'xiaohongshu',urlDetected:true,firecrawlCalled,fetchSuccess:false,extractedTextLength:0,durationMs:Date.now()-started,reason:!process.env.FIRECRAWL_API_KEY?'missing_key':code});
  throw apiError(code,'暂时没能读取这篇攻略，可以复制攻略正文后再试。',error.status||422);
 }
}
