import {styleLabels} from '../app/trip/preference.js';
export function visiblePreferenceLabels(values){return [...new Set((values||[]).map(v=>styleLabels[String(v).toLowerCase()] || (Object.values(styleLabels).includes(v)?v:['美食','人文','户外','亲子','购物'].includes(v)?v:null)).filter(Boolean))];}
export function answerExtras(context,query){
 const match=query.match(/(?:第|Day\s*)([一二三四五六七八九十]|\d+)(?:天)?/i),number=match?Number(match[1])||'一二三四五六七八九十'.indexOf(match[1])+1:null;
 const days=number?context.days.filter(d=>d.dayIndex===number):context.days;
 const evidence=days.flatMap(d=>{const times=d.items.flatMap(n=>[n.startTime,n.endTime]).filter(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t)).sort();return [{type:'day_summary',label:`Day ${d.dayIndex} 共安排 ${d.items.length} 个地点${d.items.length?'：'+d.items.map(n=>n.placeName).join('、'):''}`},...(times.length?[{type:'time_range',label:`Day ${d.dayIndex} 已记录时间：${times[0]}–${times.at(-1)}`}]:[])];});
 const preferences=visiblePreferenceLabels(context.trip.preferences);
 if(preferences.length)evidence.push({type:'preferences',label:'旅行偏好：'+preferences.join('、')});
 const suggestions=[number&&context.days.some(d=>d.dayIndex===number)?`第${number}天下午有哪些安排？`:null,'哪一天安排最满？',context.days.length>=3?'第三天有哪些安排？':'第一天有哪些安排？','哪一天最轻松？'].filter(Boolean);
 return {evidence:evidence.slice(0,8),evidenceRefs:days.filter(d=>d.id).map(d=>({dayId:d.id,itemIds:d.items.filter(n=>n.id).map(n=>n.id)})),suggestions:dedupeSuggestions(suggestions,query)};
}

export function saveAnswerFeedback(storage,messageId,value){
 if(!messageId||!['up','down'].includes(value))throw Error('反馈无效');
 const key='departly_copilot_feedback',raw=storage.getItem(key),stored=raw?JSON.parse(raw):{};
 if(!stored||typeof stored!=='object'||Array.isArray(stored))throw Error('反馈记录无效');
 const feedback=stored[messageId]===value?null:value;
 storage.setItem(key,JSON.stringify({...stored,[messageId]:feedback}));return feedback;
}

export function normalizeSuggestion(value){
 return String(value).toLowerCase().replace(/day\s*(\d+)/g,'第$1天').replace(/第([一二三四五六七八九十])天/g,(_,n)=>'第'+('一二三四五六七八九十'.indexOf(n)+1)+'天').replace(/有哪些|有什么/g,'有什么').replace(/[\s？?。！!，,]/g,'');
}
export function dedupeSuggestions(values,query=''){
 const seen=new Set([normalizeSuggestion(query)]),result=[];
 for(const value of values){const key=normalizeSuggestion(value);if(key&&!seen.has(key)){seen.add(key);result.push(value);}if(result.length===3)break;}
 return result;
}
