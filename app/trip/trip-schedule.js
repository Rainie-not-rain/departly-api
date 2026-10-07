// Suggestions only: source times/durations are preserved, edits are never rescheduled.
function suggestTimeSlots(items){
 const minutes=value=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value)?Number(value.slice(0,2))*60+Number(value.slice(3)):null;
 const clock=value=>String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
 const rows=items.map(item=>({...item})),gap=20,dayEnd=21*60;
 let cursor=9*60,index=0;
 while(index<rows.length){
  const row=rows[index],start=minutes(row.plannedStartTime),end=minutes(row.plannedEndTime);
  if(start!==null||end!==null){
   const duration=row.durationMinutes||90;
   if(start!==null&&end!==null){if(!row.durationMinutes){row.durationMinutes=end-start;row.durationSource='suggested'}cursor=Math.max(cursor,end+gap)}
   else if(start!==null){
    const next=rows.slice(index+1).find(item=>minutes(item.plannedStartTime)!==null),limit=next?minutes(next.plannedStartTime)-gap:dayEnd;
    const available=limit-start;
    if(available>=15&&(!row.durationMinutes||duration<=available)){const chosen=row.durationMinutes||Math.min(duration,available);row.plannedEndTime=clock(start+chosen);row.endTimeSource='suggested';if(!row.durationMinutes){row.durationMinutes=chosen;row.durationSource='suggested'}cursor=Math.max(cursor,start+chosen+gap)}
    else cursor=Math.max(cursor,start+duration+gap);
   }else{
    if(end-duration>=cursor){row.plannedStartTime=clock(end-duration);row.startTimeSource='suggested';if(!row.durationMinutes){row.durationMinutes=duration;row.durationSource='suggested'}}
    cursor=Math.max(cursor,end+gap);
   }
   index++;continue;
  }
  let stop=index;
  while(stop<rows.length&&minutes(rows[stop].plannedStartTime)===null&&minutes(rows[stop].plannedEndTime)===null)stop++;
  const anchor=rows[stop],anchorStart=anchor?minutes(anchor.plannedStartTime):null,anchorEnd=anchor?minutes(anchor.plannedEndTime):null;
  const limit=anchorStart!==null?anchorStart-gap:anchorEnd!==null?anchorEnd-(anchor.durationMinutes||90)-gap:dayEnd;
  const block=rows.slice(index,stop),isFixed=item=>item.durationMinutes&&item.durationSource!=='suggested',fixed=block.reduce((sum,item)=>sum+(isFixed(item)?item.durationMinutes:0),0),flexible=block.filter(item=>!isFixed(item)).length;
  const available=limit-cursor-gap*Math.max(0,block.length-1)-fixed;
  const duration=flexible?Math.min(90,Math.floor(available/flexible/5)*5):0;
  if(available>=0&&(!flexible||duration>=15)){
   for(const item of block){const chosen=isFixed(item)?item.durationMinutes:duration;item.plannedStartTime=clock(cursor);item.plannedEndTime=clock(cursor+chosen);item.startTimeSource='suggested';item.endTimeSource='suggested';if(!isFixed(item)){item.durationMinutes=chosen;item.durationSource='suggested'}cursor+=chosen+gap}
  }
  index=stop;
 }
 return rows;
}

// Stable chronological order; sorting never changes times or linked records.
function sortItemsByTime(items){const time=item=>{const raw=item.plannedStartTime||item.start||'';const match=typeof raw==='string'&&raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);return match?Number(match[1])*60+Number(match[2]):Infinity};return items.map((item,index)=>({item,index,time:time(item)})).sort((a,b)=>(a.time===b.time?0:a.time-b.time)||a.index-b.index).map(row=>row.item)}
function sortDayByTime(day){for(const key of ['nodes','items'])if(Array.isArray(day[key]))day[key]=sortItemsByTime(day[key]);return day}
function validateTimes(item){const valid=t=>typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t),values=[item.start,item.end,item.plannedStartTime,item.plannedEndTime],filled=t=>t!==null&&t!==undefined&&t!=='';if(values.some(t=>filled(t)&&!valid(t)))throw Error('节点时间格式无效');if((item.plannedEndTime||item.end)&&!(item.plannedStartTime||item.start))throw Error('请先填写开始时间');for(const [start,end]of [[item.start,item.end],[item.plannedStartTime,item.plannedEndTime],[item.plannedStartTime||item.start,item.plannedEndTime||item.end]]){if(filled(start)&&filled(end)&&end<=start)throw Error('结束时间必须晚于开始时间')}}
export {validateTimes,suggestTimeSlots,sortItemsByTime,sortDayByTime}
