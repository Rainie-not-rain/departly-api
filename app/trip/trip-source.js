import {identifyTripSource} from '../../lib/trip-source-input.js';
export const SOURCE_ERROR='暂时没能读取这篇攻略，可以复制攻略正文后再试。';
/** @param {{signal?: AbortSignal, fetcher?: typeof fetch, onStage?: (stage: string)=>void}} options */
export async function extractTripSource(input,options={}){
 const {signal,fetcher=fetch,onStage=()=>{}}=options,source=identifyTripSource(input.text,input.city);
 if(process.env.NODE_ENV==='development')console.log('[Trip Source input]',{inputType:source.inputType,hasSourceUrl:!!source.sourceUrl,textLength:source.text.length});
 if(source.inputType==='text')return {sourceType:'text',sourceUrl:null,text:source.text};
 onStage('reading');
 try{const response=await fetcher('/api/content/resolve',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:source.sourceUrl}),signal});
 const payload=await response.json();
 if(!response.ok||!payload?.success||!payload.data?.text)throw Object.assign(Error(payload?.error?.message||SOURCE_ERROR),{code:payload?.error?.code||'SOURCE_FETCH_FAILED'});
 if(signal?.aborted)throw Error(SOURCE_ERROR);
 return {sourceType:'xiaohongshu',sourceUrl:payload.data.sourceUrl||source.sourceUrl,text:[payload.data.title,payload.data.text].filter(Boolean).join('\n').slice(0,10000)};
 }catch(error){if(String(error.code||'').startsWith('SOURCE_'))throw error;throw Object.assign(Error(SOURCE_ERROR),{code:'SOURCE_FETCH_FAILED'})}
}
