import { normalizePreferences, buildPreferenceSummary } from "./preference.js";
import { assertOwner, isOwner } from "../trips/ownership.js";
import { suggestTimeSlots, sortItemsByTime, validateTimes } from "./trip-schedule.js";
const AVATARS=Array.from({length:10},(_,i)=>({id:(i<5?'male_':'female_')+String(i%5+1).padStart(2,'0'),src:'/images/user/'+(i+1)+'.png',label:(i<5?'男生':'女生')+' '+(i%5+1)}))
function validationError(message){const error=new Error(message);error.name='MemberValidationError';return error}
const validAvatar=avatar=>AVATARS.some(x=>x.src===avatar)
function checkedName(value,members,except){const name=String(value||'').trim();if(!name)throw validationError('昵称不能为空');if(name.length>20)throw validationError('昵称最多20个字');if(members.some(x=>x.id!==except&&x.name===name))throw validationError('本旅程中已存在相同昵称');return name}
export function validateMembers(members,tripId){if(!Array.isArray(members)||!members.length)throw validationError('请至少保留本人');if(members.filter(x=>x.isOwner).length!==1||members.filter(x=>x.isCurrentUser).length!==1)throw validationError('旅程需有一位创建者和当前用户');const ids=new Set();for(const member of members){if(!member.id||ids.has(member.id)||member.tripId!==tripId)throw validationError('成员身份或旅程归属不正确');ids.add(member.id);checkedName(member.name,members,member.id);if(!validAvatar(member.avatar))throw validationError('请选择有效头像')}return true}
export const DRAFT_KEY = "departly_trip_draft";
export const generateId = prefix => prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,10);
export function dateAt(start,index) { const date=new Date(start+"T00:00:00Z"); date.setUTCDate(date.getUTCDate()+index); return date.toISOString().slice(0,10); }
export function getTrip(data,id) { const trip=data.trips.find(t=>t.id===id&&!t.isDeleted); if(!trip) throw Error("旅程不存在或已删除"); return trip; }
export function normalizeItem(item={}) { const start=item.plannedStartTime??item.start??null,end=item.plannedEndTime??item.end??null; return {...item,id:item.id||generateId("item"),type:item.type||"place",title:item.title||item.placeName||item.place||"",placeName:item.placeName||item.place||item.title||"",poiId:item.poiId||null,address:item.address||null,latitude:item.latitude??null,longitude:item.longitude??null,plannedStartTime:start,plannedEndTime:end,durationMinutes:item.durationMinutes??null,startTimeSource:item.startTimeSource||(start?"suggested":null),durationSource:item.durationSource||(item.durationMinutes!=null?"suggested":null),note:item.note||"",poiVerified:item.poiVerified===true}; }
// 原详情页加载时补齐旧节点身份；攻略导入的缺失时间仅使用原建议算法。
export function prepareDetails(data) {
  const before=JSON.stringify(data);
  for(const trip of data.trips.filter(t=>!t.isDeleted&&isOwner(data,t))) for(const day of trip.days||[]) {
    const nodes=day.nodes||[];
    if(trip.creationMode==="text_import"&&nodes.some(n=>!n.start||!n.end)) {
      suggestTimeSlots(nodes.map(normalizeItem)).forEach((item,index)=>{ const node=nodes[index]; Object.assign(node,{plannedStartTime:item.plannedStartTime,plannedEndTime:item.plannedEndTime,start:item.plannedStartTime||"",end:item.plannedEndTime||"",durationMinutes:item.durationMinutes,startTimeSource:item.startTimeSource,durationSource:item.durationSource,endTimeSource:item.endTimeSource}); const original=(day.items||[]).find(x=>x.id===node.id); if(original)Object.assign(original,item); });
    }
    day.id=day.id||generateId("day");
    for(const node of nodes) { node.id=node.id||generateId("item"); node.tripId=trip.id; node.dayId=day.id; node.placeName=node.placeName||node.place||node.title; node.status=node.status==="completed"||node.completed||node.done||node.visited?"completed":"planned"; node.checkinId=node.checkinId||null; const item=(day.items||[]).find(x=>x.id===node.id); if(item)Object.assign(item,{tripId:trip.id,dayId:day.id,status:node.status,checkinId:node.checkinId}); }
  }
  return JSON.stringify(data)!==before;
}
export const photoPath = p => typeof p==="string"?p:p?.url||p?.localPath||p?.path||p?.tempFilePath||"";
/** @param {any} data @param {string} id @param {number|null} selectedDay @param {string} today */
export function detailState(data,id,selectedDay=null,today=new Date().toLocaleDateString("en-CA")) {
  const trip=getTrip(data,id),days=trip.days||[],elapsed=today>=trip.start?Math.floor((Date.parse(today)-Date.parse(trip.start))/86400000):0;
  const day=Math.max(0,Math.min(selectedDay??elapsed,Math.max(0,days.length-1))),date=dateAt(trip.start,day);
  const packing=(data.packing||[]).filter(x=>x.tripId===id),packed=packing.filter(x=>x.packed).length;
  const transports=(trip.transports||[]).filter(x=>x.departureDate===date).sort((a,b)=>(a.departureTime||"").localeCompare(b.departureTime||""));
  const stays=(trip.stays||[]).filter(x=>x.checkInDate<=date&&date<x.checkOutDate);
  const ids=new Set((data.checkins||[]).map(x=>x.id));
  const records=[...(data.checkins||[]),...(data.tickets||[]).filter(x=>!ids.has(x.id)).map(x=>({...x,itineraryItemId:x.itineraryItemId||x.nodeId, note:x.note||x.message}))].filter(x=>x.tripId===id);
  const nodes=(days[day]?.nodes||[]).map(node=>{ const record=records.find(x=>x.id===node.checkinId||x.itineraryItemId===node.id); return {...node,checkin:record||null,thumbnails:(record?.photos||[]).slice(0,3).map(photoPath),extraPhotos:Math.max(0,(record?.photos?.length||0)-3),recordText:[({happy:"开心",calm:"平静",tired:"疲惫"})[record?.mood]||record?.mood,record?.note||record?.message].filter(Boolean).join(" · "),stateText:record?"✓ 已打卡":node.status==="completed"?"✓ 已完成":"○ 打卡"}; });
  return {trip,days,day,date,nodes,transports,stays,packingCount:packing.length,packedCount:packed,packingPercent:packing.length?Math.round(packed/packing.length*100):0,status:trip.status==="completed"?"completed":today<trip.start?"upcoming":today>trip.end?"completed":"traveling"};
}
export function makeDraft(data,id) {
  const trip=getTrip(data,id); assertOwner(data,trip);
  return normalizeDraft({...trip,days:(trip.days||[]).map(day=>({...day,items:day.nodes||day.items||[]}))});
}
export function normalizeDraft(input) {
  const trip=input;
  const draft=structuredClone(trip);
  draft.destination=draft.destination||{country:trip.country||"",city:trip.city||""}; draft.startDate=trip.startDate||trip.start; draft.endDate=trip.endDate||trip.end;
  draft.creationMode=draft.creationMode||"manual";
  draft.createdAt=draft.createdAt||Date.now();draft.updatedAt=Date.now();
  draft.members=draft.members||[];draft.memberIds=draft.members.map(m=>m.id);
  draft.preferences=normalizePreferences(draft.preferences||draft.interests,draft.pace||draft.rhythm);draft.preferenceSummary=buildPreferenceSummary(draft.preferences);
  draft.days=(trip.days?.length?trip.days:[{}]).map((day,index)=>({...structuredClone(day),id:day.id||generateId("day"),dayIndex:index+1,date:day.date||dateAt(draft.startDate,index),city:day.city||draft.destination.city,items:draft.creationMode==="text_import"?(day.items||day.nodes||[]).map(normalizeItem):sortItemsByTime((day.items||day.nodes||[]).map(normalizeItem))}));
  for(const key of ["city","country","start","end"])delete draft[key];
  for(const day of draft.days){delete day.nodes;delete day.label;}
  return draft;
}
export function updateDraftNode(draft,dayId,nodeId,form) {
  const day=draft.days.find(d=>d.id===dayId); if(!day)throw Error("草稿或日期已不存在");
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.end))throw Error("请填写开始和结束时间");
  validateTimes({start:form.start,end:form.end}); if(!form.place.trim())throw Error("地点不能为空");
  const index=day.items.findIndex(x=>x.id===nodeId); if(nodeId&&index<0)throw Error("节点已不存在");
  const old=index>=0?day.items[index]:{},same=old.placeName===form.place.trim();
  const duration=Number(form.end.slice(0,2))*60+Number(form.end.slice(3))-Number(form.start.slice(0,2))*60-Number(form.start.slice(3));
  const item=normalizeItem({...old,placeName:form.place.trim(),title:form.place.trim(),type:form.type==="景点"?"place":form.type,plannedStartTime:form.start,plannedEndTime:form.end,durationMinutes:duration,durationSource:duration===old.durationMinutes?old.durationSource:"source",startTimeSource:old.plannedStartTime===form.start?old.startTimeSource:"source",note:form.note,poiVerified:same&&old.poiVerified,poiId:same?old.poiId:null,address:same?old.address:null,latitude:same?old.latitude:null,longitude:same?old.longitude:null});
  if(index>=0)day.items[index]=item;else day.items.push(item); if(draft.creationMode!=="text_import")day.items=sortItemsByTime(day.items); draft.isDirty=true;
}
export function addDraftDay(draft) { draft.days.push({id:generateId("day"),dayIndex:draft.days.length+1,date:dateAt(draft.startDate,draft.days.length),city:draft.destination.city,items:[]}); draft.isDirty=true; }
export function removeDraftDay(draft,id) { if(draft.days.length<=1)throw Error("至少需要保留 1 天行程"); if(!draft.days.some(d=>d.id===id))throw Error("行程日期不存在"); draft.days=draft.days.filter(d=>d.id!==id);draft.days.forEach((d,i)=>d.dayIndex=i+1);draft.isDirty=true; }
export function removeDraftNode(draft,dayId,id) { const day=draft.days.find(d=>d.id===dayId);if(!day||!day.items.some(n=>n.id===id))throw Error("节点已不存在");day.items=day.items.filter(n=>n.id!==id);draft.isDirty=true; }
function saveTrip(data,id,draft,creating) {
  if(creating&&data.trips.some(t=>t.id===id))throw Error("旅程已经存在");
  const previous=creating?{}:getTrip(data,id);if(!creating)assertOwner(data,previous);if(draft.id!==id)throw Error("草稿不属于此旅程");
  if(!draft.name?.trim()||draft.name==="待命名旅行")throw Error("请填写旅行名称");if(!draft.destination?.city?.trim())throw Error("请填写城市 / 目的地");if(draft.creationMode==="text_import"&&!draft.destination?.country?.trim())throw Error("请填写国家 / 地区");
  if(!draft.days?.length)throw Error("至少需要保留 1 天行程");
  const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||"")&&dateAt(d,0)===d;
  if(!validDate(draft.startDate)||!validDate(draft.endDate)||draft.startDate>draft.endDate)throw Error("旅行日期无效");
  if(dateAt(draft.startDate,draft.days.length-1)>draft.endDate)throw Error("结束日期需覆盖已有每日安排，请先调整行程天数");
  validateMembers(draft.members||[],id);
  const trip={...draft,country:draft.destination.country,city:draft.destination.city,start:draft.startDate,end:draft.endDate,days:draft.days.map((day,index)=>({...day,dayIndex:index+1,date:dateAt(draft.startDate,index),label:`Day ${index+1} ${day.city}`,nodes:(draft.creationMode==="text_import"?day.items:sortItemsByTime(day.items)).map(item=>{validateTimes(item);return {...item,tripId:id,dayId:day.id,status:item.status==="completed"?"completed":"planned",checkinId:item.checkinId||null,place:item.placeName,start:item.plannedStartTime||"",end:item.plannedEndTime||"",type:item.type==="place"?"景点":item.type};})})),transports:previous.transports||[],stays:previous.stays||[],members:creating?draft.members:previous.members,ownerUserId:creating?data.managerUserId:previous.ownerUserId,collaborationMode:"managed"};
  if(creating)data.trips.unshift(trip);else data.trips[data.trips.findIndex(t=>t.id===id)]=trip;data.currentTripId=id;return trip;
}

export function defaultTrip(data,today) {
  const trips=data.trips.filter(t=>!t.isDeleted);const value=d=>Date.parse(d+"T00:00:00Z");
  const distance=t=>t.start<=today&&t.end>=today?0:t.start>today?value(t.start)-value(today):value(today)-value(t.end);
  return trips.find(t=>t.start<=today&&t.end>=today)||trips.find(t=>t.id===data.currentTripId)||trips.slice().sort((a,b)=>distance(a)-distance(b))[0]||null;
}

export const commitDraft=(data,id,draft)=>saveTrip(data,id,draft,false);
export const createTrip=(data,draft)=>saveTrip(data,draft.id,draft,true);
