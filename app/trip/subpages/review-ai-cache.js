const key=id=>`departly_trip_review_ai_${encodeURIComponent(id)}`;
const narrativeFields=value=>({title:value?.title,narrative:value?.narrative,tags:value?.tags});
export function readReviewCache(storage,tripId,contextVersion){try{const value=JSON.parse(storage.getItem(key(tripId)));return value?.tripId===tripId&&value.contextVersion===contextVersion?value:null;}catch{return null;}}
export function writeReviewCache(storage,tripId,contextVersion,value){const entry={tripId,contextVersion,title:value.title,narrative:value.narrative,tags:value.tags,generatedAt:Date.now()};try{storage.setItem(key(tripId),JSON.stringify(entry));return true;}catch{return false;}}
export async function resolveReviewAI({context,contextVersion,storage,hasData,fallback,validate,fetcher=fetch,force=false,signal,timeoutMs=40000}){
 if(!hasData)return {value:fallback,source:'empty'};
 if(!force){const cached=readReviewCache(storage,context.trip.id,contextVersion);if(cached){try{return {value:validate(narrativeFields(cached),context),source:'cache'};}catch{/* Invalid cached derivatives must be regenerated. */}}}
 const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();const timer=setTimeout(abort,timeoutMs);
 try{const response=await fetcher('/api/ai/trip-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reviewContext:context}),signal:controller.signal});const body=await response.json();if(!response.ok||!body.success)throw Error('Review unavailable');const value=validate(narrativeFields(body.data),context);if(controller.signal.aborted)throw Error('Review interrupted');if(!body.data.fallback)writeReviewCache(storage,context.trip.id,contextVersion,value);return {value,source:body.data.fallback?'fallback':'provider'};}catch{return {value:fallback,source:'fallback'};}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
