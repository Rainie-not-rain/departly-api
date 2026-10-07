// Shared pure projection: never reads or writes browser storage.
const text = (value, limit = 200) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
export function buildTripContext(trip) {
 if (!trip || typeof trip !== 'object') throw Error('旅程数据无效');
 const preferences = Array.isArray(trip.preferences) ? trip.preferences : trip.preferences?.styles || [];
 const context = {
  trip: {id:text(trip.id,128),name:text(trip.name),destination:{country:text(trip.country || trip.destination?.country),city:text(trip.city || trip.destination?.city)},startDate:text(trip.startDate || trip.start,10),endDate:text(trip.endDate || trip.end,10),preferences:preferences.slice(0,5).map(p=>text(p,40))},
  members:(trip.members || []).map(m=>({id:text(m.id,128),name:text(m.name,80),isCurrentUser:m.isCurrentUser===true})),
  days:(trip.days || []).map((d,i)=>({id:text(d.id,128),dayIndex:i+1,date:text(d.date,10),city:text(d.city),items:(d.nodes || d.items || []).map(n=>({id:text(n.id,128),title:text(n.place || n.placeName || n.title),placeName:text(n.place || n.placeName || n.title),startTime:text(n.start || n.plannedStartTime || n.startTime,5),endTime:text(n.end || n.plannedEndTime || n.endTime,5),durationMinutes:Number.isInteger(n.durationMinutes)?n.durationMinutes:null,note:text(n.note,400)}))}))
 };
 if(context.days.length>31 || context.members.length>30 || context.days.some(d=>d.items.length>30) || JSON.stringify(context).length>18000) throw Error('这趟旅行信息较多，暂时无法问答');
 return context;
}
export function contextToText(context) {
 const {trip,members,days}=context;
 return [`【旅程】\n${trip.name}\n目的地：${trip.destination.country} · ${trip.destination.city}\n日期：${trip.startDate} ～ ${trip.endDate}\n偏好：${trip.preferences.join('、') || '未记录'}`,
 `【同行成员】\n${members.map(m=>m.name).join('、') || '未记录'}`,
 ...days.map(d=>`【Day ${d.dayIndex} · ${d.date} · ${d.city}】\ndayId: ${d.id || "未记录，不能操作"}\n${d.items.map(n=>`${n.startTime || '时间未记录'}${n.endTime?'-'+n.endTime:''} ${n.placeName} [itemId: ${n.id || '未记录，不能操作'}]${n.note?'\n备注：'+n.note:''}`).join('\n') || '当天没有记录安排'}`)].join('\n\n');
}
export function suggestedQuestions(context) {
 return [context.days.length>1?'我第二天都去哪？':'我第一天都去哪？','哪一天安排最满？','帮我看看有没有太赶的地方',context.days.length>=3?'第三天下午有什么安排？':'第一天下午有什么安排？'];
}
