export const VERIFIED_TTL_MS=24*60*60*1000;
export const NEGATIVE_TTL_MS=5*60*1000;
export function createPoiCache({now=Date.now,maxEntries=500}={}){
 const entries=new Map();
 return {
  get(key){const entry=entries.get(key);if(!entry)return null;if(entry.expiresAt<=now()){entries.delete(key);return null}return {...entry.value}},
  set(key,value){const verified=!!value?.id&&Number.isFinite(value.latitude)&&Number.isFinite(value.longitude)&&Math.abs(value.latitude)<=90&&Math.abs(value.longitude)<=180;
   const ttl=verified?VERIFIED_TTL_MS:['no_result','ambiguous'].includes(value?.reason)?NEGATIVE_TTL_MS:0;if(!ttl)return;
   if(entries.size>=maxEntries&&!entries.has(key))entries.delete(entries.keys().next().value);
   entries.set(key,{value:{...value,poiVerified:verified,matchedAt:now()},expiresAt:now()+ttl});
  }
 };
}
// Process-local only: cleared by restart; no Redis dependency or persistent store.
const cacheSymbol=Symbol.for('departly.poi-cache');
export const poiCache=globalThis[cacheSymbol]||(globalThis[cacheSymbol]=createPoiCache());
