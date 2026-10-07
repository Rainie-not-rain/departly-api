import {normalizePoiName,searchAmapPoi} from './amap-poi.js';
import {poiCache,createPoiCache} from './poi-cache.js';
export async function verifyPlanPlaces(result,verifyPlace,options={}){
 const started=Date.now(),deadline=started+(options.timeoutMs??4000),country=options.country||'';
 const sharedCache=options.cache||(verifyPlace?createPoiCache():poiCache),queries=new Map();
 const stats={total:0,cacheHits:0,providerRequests:0,verified:0,unverified:0,quotaExceeded:0,quotaSkipped:0,failedRequests:0};
 const days=result.days.map(day=>({...day,items:day.items.map(item=>({...item,originalPlaceName:item.originalPlaceName||item.placeName,poiId:null,address:null,latitude:null,longitude:null,poiVerified:false}))}));
 const adapter=verifyPlace||((name,city)=>searchAmapPoi(name,city,{country,timeoutMs:Math.max(1,Math.min(1500,deadline-Date.now()))}));
 let quotaOpen=false,lastRequestEnd=0;
 for(const day of days)for(const item of day.items){
  stats.total++;const city=day.city||options.city||'',key=JSON.stringify([normalizePoiName(country),normalizePoiName(city).replace(/市$/,''),normalizePoiName(item.placeName)]);
  let poi=queries.get(key);
  if(!poi){poi=sharedCache.get(key);if(poi)stats.cacheHits++;
   if(!poi){
    if(quotaOpen)poi={reason:'quota_skipped'};
    else if(!verifyPlace&&!['中国','中华人民共和国','china','cn'].includes(normalizePoiName(country)))poi={reason:country?'unsupported_country':'country_unknown'};
    else if(!verifyPlace&&!process.env.AMAP_WEB_SERVICE_KEY)poi={reason:'missing_key'};
    else if(Date.now()>=deadline)poi={reason:'budget_exhausted'};
    else{
     const wait=Math.max(0,(options.intervalMs??500)-(Date.now()-lastRequestEnd));
     if(Date.now()+wait>=deadline)poi={reason:'budget_exhausted'};
     else{
      if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
      stats.providerRequests++;
      try{poi=await adapter(item.placeName,city)||{reason:'no_result'}}catch{poi={reason:'provider_error'}}
      lastRequestEnd=Date.now();
      if(['provider_error','network_error','provider_rejected','quota_exceeded','invalid_key','invalid_request','timeout'].includes(poi.reason))stats.failedRequests++;
      if(poi.reason==='quota_exceeded'){quotaOpen=true;stats.quotaExceeded++}
      sharedCache.set(key,poi);
     }
    }
   }
   queries.set(key,poi);
  }
  if(poi.reason==='quota_skipped')stats.quotaSkipped++;
  if(poi?.id&&Number.isFinite(poi.latitude)&&Number.isFinite(poi.longitude)&&Math.abs(poi.latitude)<=90&&Math.abs(poi.longitude)<=180){Object.assign(item,{placeName:poi.placeName||item.placeName,poiId:poi.id,address:poi.address||null,latitude:poi.latitude,longitude:poi.longitude,poiVerified:true});stats.verified++}
  else{stats.unverified++;if(process.env.NODE_ENV==='development')console.log('[POI Grounding] unmatched',{placeName:item.placeName,reason:poi.reason||'no_result'})}
 }
 if(process.env.NODE_ENV==='development')console.log('[POI Grounding]',{...stats,durationMs:Date.now()-started});
 return {...result,days};
}
