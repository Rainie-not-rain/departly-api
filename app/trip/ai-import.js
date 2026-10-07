import {identifyTripSource} from '../../lib/trip-source-input.js';
import {extractTripSource} from './trip-source.js';
import {INSUFFICIENT_CONTENT} from '../../lib/trip-parse-text.js';
import {creationDraft} from './creation-service.js';
import {normalizeDraft,generateId} from './detail-service.js';
import {validateInput,normalizeResult} from '../../lib/ai-json.js';
import {suggestTimeSlots} from '../../lib/trip-schedule.js';
export const IMPORT_ERROR='这份攻略有点难整理，请再试一次';
export const URL_ONLY_ERROR='暂不支持直接读取链接，请复制攻略正文后粘贴。';
export function importRequest(input){
 const raw=String(input.text||'');const source=identifyTripSource(raw,input.form.city);
 const base=creationDraft('text_import',input),request={name:input.form.name.trim(),country:base.destination.country,city:base.destination.city,startDate:base.startDate,endDate:base.endDate,text:raw};
 if(source.inputType==='text')validateInput(request,'parse');return {base,request};
}
export function importRequestFromDraft(draft){const request={name:draft.name||'',country:draft.destination.country,city:draft.destination.city,startDate:draft.startDate,endDate:draft.endDate,text:draft.sourceText||''};validateInput(request,'parse');return request;}
export function parseToDraft(base,result,request){
 const input=validateInput(request,'parse');
 // Grounded names may differ in whitespace; validate the original extracted name first.
 const raw={...result,days:result.days?.map(day=>({...day,items:day.items?.map(item=>({...item,placeName:item.originalPlaceName||item.placeName}))}))};
 const normalized=normalizeResult(raw,input,'parse'),count=(Date.parse(base.endDate)-Date.parse(base.startDate))/86400000+1;
 if(normalized.days.some(day=>day.dayIndex>count))throw Error('攻略天数超出所选日期，请调整日期后重新解析');
 const days=Array.from({length:count},(_,index)=>{const day=normalized.days.find(d=>d.dayIndex===index+1),original=result.days.find(d=>d.dayIndex===index+1);return {...day,id:generateId('day'),dayIndex:index+1,items:suggestTimeSlots((day?.items||[]).map((item,i)=>{const poi=original?.items[i],verified=poi?.poiVerified===true&&typeof poi.poiId==='string'&&!!poi.poiId&&Number.isFinite(poi.latitude)&&Number.isFinite(poi.longitude)&&Math.abs(poi.latitude)<=90&&Math.abs(poi.longitude)<=180;return {...item,id:generateId('item'),type:'place',placeName:verified?poi.placeName:item.placeName,note:item.reason||'',originalPlaceName:item.placeName,poiVerified:verified,poiId:verified?poi.poiId:null,address:verified?poi.address:null,latitude:verified?poi.latitude:null,longitude:verified?poi.longitude:null};}))};});
 return normalizeDraft({...base,creationMode:'text_import',name:request.name||normalized.name||'导入的旅行攻略',destination:{country:request.country||normalized.destination.country||'',city:request.city||normalized.destination.city||''},sourceText:request.text,days,isDirty:false});
}
/** @param {{signal?: AbortSignal, fetcher?: typeof fetch, onStage?: (stage: string)=>void}} options */
export async function generateImport(base,request,options={}){
 const {signal,fetcher=fetch}=options;
 if(signal?.aborted)throw Object.assign(Error("请求已取消"),{name:"AbortError"});
 const source=await extractTripSource(request,options);if(signal?.aborted)throw Object.assign(Error("请求已取消"),{name:"AbortError"});request={...request,text:source.text,sourceType:source.sourceType};validateInput(request,'parse');options.onStage?.('parsing');
 const response=await fetcher('/api/ai/trip-parse',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal});
 const payload=await response.json();if(signal?.aborted)throw Object.assign(Error("请求已取消"),{name:"AbortError"});if(payload?.error?.code==='TRIP_PARSE_INSUFFICIENT_CONTENT')throw Object.assign(Error(INSUFFICIENT_CONTENT),{code:'TRIP_PARSE_INSUFFICIENT_CONTENT'});if(signal?.aborted||!response.ok||payload?.success!==true||!payload.data)throw Error(IMPORT_ERROR);
 return {...parseToDraft(base,payload.data,request),sourceType:base.sourceType||source.sourceType,sourceUrl:base.sourceUrl||source.sourceUrl,sourceInput:base.sourceInput||base.sourceText};
}
