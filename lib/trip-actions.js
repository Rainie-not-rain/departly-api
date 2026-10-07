import {buildTripContext} from './trip-context.js';
export const ACTION_TYPES=['move_item','remove_item','add_item','update_time'];
const fail=(message,field='proposal',reason='invalid_reference')=>{throw Object.assign(new Error(message || '行程已经发生变化，这条调整建议失效了。'),{diagnostic:{field,reason}});};
const id=v=>typeof v==='string'&&v.length>0&&v.length<=128;
export const timeMinutes=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v)?Number(v.slice(0,2))*60+Number(v.slice(3)):null;
const format=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
export function contextVersion(context){return JSON.stringify(context);}
export function actionIntentAllowed(p,query){
 if(typeof query!=='string'||/是不是|好像|是否|可以不去|考虑|优化一下|优化行程|不要|别|不需要|不用|暂不|先不|不想|撤销|取消删除/.test(query))return false;
 const cues={move_item:/移|挪|调到/,remove_item:/删|移除|去掉|取消/,add_item:/加|添加|新增|安排一个/,update_time:/改|调整|调成|调到/};
 if(!cues[p.type]?.test(query))return false;
 return p.type!=='add_item'||(typeof p.placeName==='string'&&query.includes(p.placeName));
}
export function validateTripActionProposal(p,trip){
 const c=trip.trip?trip:buildTripContext(trip);
 if(!p||!ACTION_TYPES.includes(p.type))fail('不支持这类调整','type','unsupported_action');
 if(p.status&&p.status!=='pending')fail('这条建议已处理');
 if(p.contextVersion&&p.contextVersion!==contextVersion(c))fail();
 const day=key=>{if(!id(p[key]))fail(undefined,key,'missing_day_reference');const matches=c.days.filter(d=>d.id===p[key]);if(matches.length!==1)fail(undefined,key,matches.length?'duplicate_day_id':'day_not_found');return matches[0];};
 const from=p.type==='move_item'?day('fromDayId'):day('dayId');
 const item=p.type==='add_item'?null:from.items.find(n=>n.id===p.itemId);
 if(p.type!=='add_item'&&(!id(p.itemId)||!item))fail(undefined,'itemId','item_not_in_source_day');
 if(p.type!=='add_item'&&c.days.reduce((count,d)=>count+d.items.filter(n=>n.id===p.itemId).length,0)!==1)fail(undefined,'itemId','duplicate_item_id');
 const to=p.type==='move_item'?day('toDayId'):from;
 if(p.type==='move_item'&&from.id===to.id)fail('请选择其他日期');
 let start=null,end=null;
 if(p.type!=='remove_item'){
  start=timeMinutes(p.proposedStartTime);if(start===null)fail('开始时间无效','proposedStartTime','invalid_time');
  if(p.type==='add_item'){
   if(typeof p.title!=='string'||!p.title.trim()||p.title.length>200||typeof p.placeName!=='string'||!p.placeName.trim()||p.placeName.length>200||p.title!==p.placeName)fail('地点名称无效');
   if(!Number.isInteger(p.durationMinutes)||p.durationMinutes<15||p.durationMinutes>720)fail('停留时长无效');
   if(to.items.length>=30)fail('当天安排过多，请先手动整理');end=start+p.durationMinutes;
  }else if(p.type==='update_time'){end=p.proposedEndTime==null?start+originalDuration(item):timeMinutes(p.proposedEndTime);if(end===null)fail('结束时间无效');}
  else{end=start+originalDuration(item);}
  if(end<=start||end>=1440)fail('结束时间必须晚于开始时间，且在当天内');
 }
 const collisions=start===null?[]:to.items.filter(n=>n.id!==item?.id&&timeMinutes(n.startTime)!==null&&timeMinutes(n.endTime)!==null&&start<timeMinutes(n.endTime)&&end>timeMinutes(n.startTime)).map(n=>n.placeName);
 return {context:c,from,to,item,startTime:start===null?null:format(start),endTime:end===null?null:format(end),warnings:collisions.length?['这个时间可能和'+collisions.join('、')+'的安排重叠。']:[]};
}
export function proposalPreview(p,trip){
 const v=validateTripActionProposal(p,trip),name=v.item?.placeName||p.placeName;
 const labels={move_item:'调整行程',remove_item:'移除行程',add_item:'新增行程',update_time:'调整时间'};
 return {title:labels[p.type],name,before:p.type==='add_item'?'':`Day ${v.from.dayIndex} · ${v.item.startTime || '时间未记录'}${v.item.endTime?'–'+v.item.endTime:''}`,after:p.type==='remove_item'?'移除后不会影响其他节点':`Day ${v.to.dayIndex} · ${v.startTime}–${v.endTime}`,warnings:v.warnings};
}
// Pure executor: no network, storage or model access; caller persists only after confirmation.
export function executeTripAction(trip,p,newId){
 const v=validateTripActionProposal(p,trip),next=structuredClone(trip);
 const from=next.days.find(d=>d.id===v.from.id),to=next.days.find(d=>d.id===v.to.id);
 const rows=d=>d.nodes || d.items || [];
 let item=p.type==='add_item'?{id:newId||globalThis.crypto.randomUUID(),title:p.title,place:p.placeName,placeName:p.placeName,type:'景点',poiVerified:false,poiId:null,address:null,latitude:null,longitude:null,status:'planned',note:'',checkinId:null}:rows(from).find(n=>n.id===p.itemId);
 if(p.type==='add_item'&&(!id(item.id)||next.days.some(d=>rows(d).some(n=>n.id===item.id))))fail('新节点标识无效');
 if(p.type==='remove_item'||p.type==='move_item'){from.nodes=rows(from).filter(n=>n.id!==p.itemId);}
 if(p.type!=='remove_item'){
  Object.assign(item,{tripId:trip.id,dayId:to.id,start:v.startTime,end:v.endTime,plannedStartTime:v.startTime,plannedEndTime:v.endTime,durationMinutes:timeMinutes(v.endTime)-timeMinutes(v.startTime),startTimeSource:'source',endTimeSource:'source',durationSource:'source',sourceTimeText:null,sourceDurationText:null});
  if(p.type==='move_item'||p.type==='add_item')to.nodes=[...rows(to),item];else to.nodes=rows(to);
 }
 for(const d of new Set([from,to])){d.nodes=rows(d).slice().sort((a,b)=>(timeMinutes(a.start??a.plannedStartTime)??1440)-(timeMinutes(b.start??b.plannedStartTime)??1440));d.items=d.nodes.map(n=>({...n}));}
 next.updatedAt=Date.now();
 const name=v.item?.placeName||p.placeName;
 const reply={move_item:`好啦，${name}已经移到 Day ${v.to.dayIndex} 🌿`,remove_item:`已经从 Day ${v.from.dayIndex} 移除${name}。`,add_item:`${name}已经加入 Day ${v.to.dayIndex}。`,update_time:`${name}的时间已经调整好了。`}[p.type];
 return {trip:next,reply,warnings:v.warnings};
}

// Only rebase the remaining suggestions from the same batch after our own confirmed action.
// External/manual edits still fail the original contextVersion check at execution.
export function rebaseIndependentProposals(proposals,before,after,appliedId){
 return proposals.map(p=>{
  if(p.id===appliedId)return {...p,status:'applied'};
  if(p.status!=='pending')return p;
  try{
   const old=validateTripActionProposal({...p,contextVersion:undefined},before);
   const current=validateTripActionProposal({...p,contextVersion:undefined},after);
   if(JSON.stringify(old.item)!==JSON.stringify(current.item)||old.from.date!==current.from.date||old.to.date!==current.to.date)throw Error();
   return {...p,contextVersion:contextVersion(after)};
  }catch{return {...p,status:'invalid'};}
 });
}

function originalDuration(item){
 const start=timeMinutes(item?.startTime),end=timeMinutes(item?.endTime);
 const duration=start!==null&&end!==null&&end>start?end-start:item?.durationMinutes;
 if(!Number.isInteger(duration)||duration<=0||duration>720)fail('原节点缺少有效时长，请先手动补齐','item.durationMinutes','missing_original_duration');
 return duration;
}
// Complete time only; IDs must already be supplied correctly by the model.
export function completeProposalTiming(raw,context,query){
 const p={...raw};if(!['move_item','add_item','update_time'].includes(p.type))return p;
 const from=context.days.find(d=>d.id===(p.fromDayId||p.dayId)),item=from?.items.find(n=>n.id===p.itemId);
 if(item&&context.days.flatMap(d=>d.items).filter(n=>n.placeName===item.placeName).length>1){const position=query.indexOf(item.placeName),prefix=position<0?'':query.slice(0,position),chinese='一二三四五六七八九十'[from.dayIndex-1];if(!prefix.includes('第'+from.dayIndex+'天')&&!prefix.includes('第'+chinese+'天')&&!prefix.toLowerCase().includes('day '+from.dayIndex))fail('行程里有多个同名地点，请说明原来的日期','query','ambiguous_item');}
 let duration=p.type==='add_item'?p.durationMinutes:item?originalDuration(item):null;
 if(p.type==='add_item'&&duration==null){duration=90;p.durationMinutes=90;}
 if(p.proposedStartTime==null){
  const target=context.days.find(d=>d.id===(p.toDayId||p.dayId)),period=query.match(/上午|下午|傍晚|晚上/)?.[0];
  const precise=query.match(/(?:^|[^\d])([01]?\d|2[0-3]):([0-5]\d)/);
  const hour=query.match(/(上午|下午|傍晚|晚上)?\s*([一二三四五六七八九十两]|1?\d|2[0-3])点(半)?/);
  if(precise)p.proposedStartTime=precise[1].padStart(2,'0')+':'+precise[2];
  else if(hour){let h=Number(hour[2])||({一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10})[hour[2]];if(['下午','傍晚','晚上'].includes(hour[1]||period)&&h<12)h+=12;p.proposedStartTime=format(h*60+(hour[3]?30:0));}
  else if(period){
   const start={上午:540,下午:840,傍晚:1050,晚上:1140}[period],limit={上午:720,下午:1080,傍晚:1140,晚上:1440}[period];
   const candidates=[start,...(target?.items||[]).map(n=>timeMinutes(n.endTime)).filter(n=>n!==null&&n>=start&&n<limit)].sort((a,b)=>a-b);
   const available=duration&&candidates.find(candidate=>candidate+duration<1440&&candidate+duration<=limit&&!(target?.items||[]).some(n=>n.id!==p.itemId&&timeMinutes(n.startTime)!==null&&timeMinutes(n.endTime)!==null&&candidate<timeMinutes(n.endTime)&&candidate+duration>timeMinutes(n.startTime)));
   p.proposedStartTime=format(available===false||available==null?start:available);
  }
 }
 if(p.type==='update_time'&&p.proposedEndTime==null&&timeMinutes(p.proposedStartTime)!==null&&duration)p.proposedEndTime=format(timeMinutes(p.proposedStartTime)+duration);
 return p;
}
