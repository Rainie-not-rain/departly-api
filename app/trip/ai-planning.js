import {creationDraft} from './creation-service.js';
import {normalizeDraft,generateId} from './detail-service.js';
import {validateInput,normalizeResult} from '../../lib/ai-json.js';
export const PLANNING_ERROR='小簿刚刚走神了，请再试一次';
export function planningRequest(input){
 const base=creationDraft('ai_generate',input),places=String(input.mustVisitPlaces||'').split(/[\n、,，;；]/).map(s=>s.trim()).filter(Boolean);
 const request={name:input.form.name.trim(),country:base.destination.country,city:base.destination.city,startDate:base.startDate,endDate:base.endDate,preferences:base.preferences,pace:base.preferences.pace,mustVisitPlaces:[...new Set(places)]};
 validateInput(request,'plan');return {base,request};
}
export function planningRequestFromDraft(draft){
 const request={name:draft.name||'',country:draft.destination.country,city:draft.destination.city,startDate:draft.startDate,endDate:draft.endDate,preferences:draft.preferences,pace:draft.pace||draft.preferences?.pace,mustVisitPlaces:draft.mustVisitPlaces||[]};validateInput(request,'plan');return request;
}
export function planToDraft(base,result,request){
 const validated=validateInput(request,'plan'),normalized=normalizeResult(result,validated,'plan');
 return normalizeDraft({...base,creationMode:'ai_generate',preferences:validated.preferences,pace:validated.preferences.pace,mustVisitPlaces:validated.mustVisitPlaces,isDirty:false,days:normalized.days.map((day,index)=>({...day,id:generateId('day'),items:day.items.map((item,i)=>{const poi=result.days[index]?.items?.[i],verified=poi?.poiVerified===true&&typeof poi.poiId==='string'&&!!poi.poiId&&Number.isFinite(poi.latitude)&&Number.isFinite(poi.longitude)&&Math.abs(poi.latitude)<=90&&Math.abs(poi.longitude)<=180;return {...item,id:generateId('item'),type:'place',note:item.reason||'',originalPlaceName:typeof poi?.originalPlaceName==='string'?poi.originalPlaceName:item.placeName,poiVerified:verified,poiId:verified?poi.poiId:null,address:verified&&typeof poi.address==='string'?poi.address:null,latitude:verified?poi.latitude:null,longitude:verified?poi.longitude:null};})}))});
}
/** @param {{signal?: AbortSignal, fetcher?: typeof fetch}} options */
export async function generatePlan(base,request,options={}){
 const {signal,fetcher=fetch}=options;
 if(signal?.aborted)throw Object.assign(Error("请求已取消"),{name:"AbortError"});
 const response=await fetcher('/api/ai/trip-plan',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal});
 const payload=await response.json();if(signal?.aborted)throw Object.assign(Error("请求已取消"),{name:"AbortError"});if(!response.ok||payload?.success!==true||!payload.data)throw Error(PLANNING_ERROR);
 return planToDraft(base,payload.data,request);
}
