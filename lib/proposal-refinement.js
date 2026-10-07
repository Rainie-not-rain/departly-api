import {validateTripActionProposal,timeMinutes,contextVersion} from './trip-actions.js';
const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
const windows={morning:[480,720],afternoon:[720,1080],evening:[1080,1320],any:[480,1320]};
export function findAvailableSlot({day,durationMinutes,period='any',excludeItemId,notBefore}){
 if(!Number.isInteger(durationMinutes)||durationMinutes<=0||!windows[period])return null;
 const [low,high]=windows[period],start=Math.max(low,timeMinutes(notBefore)??low);
 const occupied=day.items.filter(n=>n.id!==excludeItemId).map(n=>[timeMinutes(n.startTime),timeMinutes(n.endTime)]).filter(([s,e])=>s!==null&&e!==null&&e>s).sort((a,b)=>a[0]-b[0]);
 let candidate=start;
 for(const [s,e] of occupied){if(e<=candidate)continue;if(candidate+durationMinutes<=s)break;candidate=Math.max(candidate,e);}
 return candidate+durationMinutes<=high?{startTime:clock(candidate),endTime:clock(candidate+durationMinutes)}:null;
}
export function pendingProposalContexts(proposals,context){
 return proposals.flatMap(p=>{try{
  if(p.status!=='pending'||typeof p.id!=='string')return [];
  const v=validateTripActionProposal(p,context),start=timeMinutes(v.startTime),end=timeMinutes(v.endTime);
  return [{...p,itemTitle:v.item?.placeName||p.placeName,fromDayId:v.from.id,fromDayIndex:v.from.dayIndex,originalStartTime:v.item?.startTime,originalEndTime:v.item?.endTime,toDayId:v.to.id,toDayIndex:v.to.dayIndex,proposedEndTime:v.endTime,conflicts:v.to.items.filter(n=>n.id!==p.itemId&&timeMinutes(n.startTime)!==null&&timeMinutes(n.endTime)!==null&&start<timeMinutes(n.endTime)&&end>timeMinutes(n.startTime)).map(n=>({itemId:n.id,title:n.placeName,startTime:n.startTime,endTime:n.endTime}))}];
 }catch{return [];}});
}
export function refinementIntent(query){return /换.{0,12}(时间|不冲突)|不冲突.{0,8}时间|晚一点|提前一点|改到.{0,8}点|还是放.{0,4}(上午|下午|晚上)|换到第.{1,3}天|不要和.{1,30}撞|这个时间不行|刚才那个|调整.{0,30}不冲突/.test(query);}
export function refinePendingProposal(context,pending,query,makeId){
 if(!refinementIntent(query))return null;
 if(!pending.length&&context.days.some(d=>d.items.some(n=>n.placeName&&query.includes(n.placeName))))return null;
 const empty=reply=>({reply,proposals:[],evidence:[],suggestions:[]});
 if(pending.length!==1)return empty(pending.length?'你想调整哪一条建议？':'你想调整哪个地点、哪一天的时间？');
 const old=pending[0];if(old.type==='remove_item')return empty('这条建议是移除地点，你想如何调整？');
 const v=validateTripActionProposal(old,context),duration=timeMinutes(v.endTime)-timeMinutes(v.startTime);
 const p={...old,id:makeId(),status:'pending',contextVersion:contextVersion(context)};
 let day=v.to;
 const dayMatch=query.match(/第([一二三四五六七八九十]|\d{1,2})天/);
 if(dayMatch){const index=Number(dayMatch[1])||'一二三四五六七八九十'.indexOf(dayMatch[1])+1;day=context.days.find(d=>d.dayIndex===index);if(!day)return empty('行程里没有这一天，请选择已有日期。');if(p.type==='move_item')p.toDayId=day.id;else p.dayId=day.id;}
 const precise=query.match(/([01]?\d|2[0-3]):([0-5]\d)/),hour=/晚一点|提前一点/.test(query)?null:query.match(/([一二三四五六七八九十两]|1?\d|2[0-3])点(半)?/);
 const named=query.match(/上午|下午|晚上/),period=named?({上午:'morning',下午:'afternoon',晚上:'evening'})[named[0]]:timeMinutes(old.proposedStartTime)<720?'morning':timeMinutes(old.proposedStartTime)<1080?'afternoon':'evening';
 let start;
 if(precise)start=Number(precise[1])*60+Number(precise[2]);
 else if(hour){let h=Number(hour[1])||({一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10})[hour[1]];if(period!=='morning'&&h<12)h+=12;start=h*60+(hour[2]?30:0);}
 else if(/晚一点|提前一点/.test(query))start=timeMinutes(old.proposedStartTime)+(/晚一点/.test(query)?30:-30);
 else{
  const slot=findAvailableSlot({day,durationMinutes:duration,period,excludeItemId:p.itemId,notBefore:named||dayMatch?undefined:old.proposedStartTime});
  if(!slot)return empty(`第${day.dayIndex}天${{morning:'上午',afternoon:'下午',evening:'晚上',any:''}[period]}暂时没有完整的 ${duration/60} 小时空档。`);
  start=timeMinutes(slot.startTime);
 }
 if(start<0||start+duration>=1440)return empty('这个时间无法保留原来的停留时长，请换一个时间。');
 p.proposedStartTime=clock(start);p.proposedEndTime=clock(start+duration);
 try{const checked=validateTripActionProposal(p,context);return {reply:'建议改为下面的时间，确认后才会应用到行程。',proposals:[p],supersedesProposalId:old.id,suggestions:[],evidence:[{type:'day_summary',label:`目标为 Day ${day.dayIndex}；已有安排：${day.items.filter(n=>n.id!==p.itemId).map(n=>`${n.placeName} ${n.startTime}–${n.endTime}`).join('、')||'暂无'}`},{type:'duration',label:`${old.itemTitle}保留原计划时长 ${duration/60} 小时`},{type:'time_range',label:checked.warnings.join('；')||`${p.proposedStartTime}–${p.proposedEndTime} 与已记录的安排不重叠`}]};}catch{return empty('这条建议已经不适用，请重新选择目标日期或时间。');}
}
