// Suggestions only: source times/durations are preserved, edits are never rescheduled.
export function suggestTimeSlots(items){
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


