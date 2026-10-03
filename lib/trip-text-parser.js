// Five stages: sections -> route source -> candidates -> classification -> business items.
const arrow=/[➡➠→➜➔>＞]+\uFE0F?/;
const routeLabels=/(?:游玩路线|打卡路线|今日行程|今日路线|行程|路线)\s*[:：]/g;
const categoryHeading=/(?:美食(?:打卡|推荐|合集)?|住宿(?:推荐)?|酒店推荐|门票|交通|Tips|费用)\s*[:：]|(?:美食推荐|美食合集|住宿推荐|酒店推荐)/gi;
const numbering=/[①-⑳]|\d{1,2}\uFE0F?\u20E3|(?:^|\n)[ \t]*\d{1,2}[.、]/g;
function dayNumber(value){
 if(/^\d+$/.test(value))return Number(value);
 const digits={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
 if(digits[value])return digits[value];
 if(/^[一二三四五六七八九]?十[一二三四五六七八九]?$/.test(value)){const [a,b]=value.split('十');return (digits[a]||1)*10+(digits[b]||0)}
 return null;
}
function normalizeText(text){
 return text.replace(/\\t/g,'\n').replace(/\t/g,'\n').replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ')
  .replace(/((?:day|\bd)\s*\d*)([0-9])\uFE0F?\u20E3/gi,'$1$2 ');
}
function extractDayMarkers(text){
 const regex=/(?:day[ \t]*(\d{1,3})|\bd[ \t]*(\d{1,3})|第[ \t]*([0-9一二三四五六七八九十两]+)[ \t]*天)[ \t]*[:：|｜]?/gi;
 return [...text.matchAll(regex)].filter(m=>!m[0].startsWith('第')||/[：:]/.test(m[0])||!/[\p{L}\p{N}]/u.test(text[m.index-1]||''))
  .map(m=>({dayIndex:dayNumber(m[1]||m[2]||m[3]),index:m.index,end:m.index+m[0].length}));
}
function cleanPlaceName(value){
 return value.trim().replace(/^(?:(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F|\u200D|[✔✓☑•●·*])\s*)+|(?:\s*(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F|\u200D))+$/gu,'').trim();
}
export function classifyRouteNode(value){
 if(/返程|回家|接站|送站|(?:坐|乘|搭).*(?:高铁|飞机|火车|地铁)|^高铁|^去机场|^租(?:电动车|车)|(?:站|机场)(?:返程)?$/.test(value))return 'transport';
 if(/酒店|民宿|住宿|入住|退房|寄存行李|^住[\p{L}]/u.test(value))return 'accommodation';
 if(/^(?:吃|早餐$|午餐$|晚餐$|用餐$)|烤鸭|涮肉|私房菜|餐厅|美食|小吃店/.test(value))return 'food';
 if(/DIY|体验|制陶|收拾|整理|休息|休整|自由活动|逛街采购|购物|买伴手礼|妆造|起晚|集合|^落地|一日游$|市区$|^逛街买/.test(value))return 'activity';
 return 'poi';
}
function keepCandidate(value){
 if(!value||value.length>80||/[：:。！？!?]/.test(value)||/早上先|上午先|下午再|我们|然后|逛完|准备去|先去|想去|需提前|可以俯瞰|分钟|小时/.test(value))return false;
 const kind=classifyRouteNode(value);
 if(kind==='transport'||kind==='accommodation')return false;
 if(kind==='activity')return /DIY|制陶|体验/.test(value)&&! /妆造|收拾|返程|自由活动/.test(value);
 if(kind==='food')return !/^(?:吃|早餐|午餐|晚餐|用餐)/.test(value);
 return true;
}
function candidates(routeText){
 const split=arrow.test(routeText)?arrow:/[、，,;；]/;
 return routeText.split(split).map(cleanPlaceName).filter(Boolean);
}
function normalizeCandidates(values,transitCities=new Set()){return [...new Set(values.map(value=>value.replace(/吃(?:早饭|午饭|晚饭)$/,'')).filter((value,index)=>keepCandidate(value)&&!(values.length>1&&(index===0||index===values.length-1)&&transitCities.has(value))))]}
function routeSummary(section){
 let text=section.replace(/^[ \t]*[:：|｜][ \t]*/,'');
 let end=text.length;
 for(const match of text.matchAll(categoryHeading))end=Math.min(end,match.index);
 for(const match of text.matchAll(numbering))end=Math.min(end,match.index);
 for(const match of text.matchAll(/[✔✅⭕🔸🔹]|-{3,}|—{3,}/gu)){
  const before=text.slice(0,match.index).trimEnd();
  if(match.index===0||/[➡➠→➜➔>＞]\uFE0F?$/.test(before))continue;
  end=Math.min(end,match.index);break;
 }
 text=text.slice(0,end);
 for(const match of text.matchAll(/\n/g)){
  const before=text.slice(0,match.index).trimEnd(),after=text.slice(match.index+1).trimStart();
  if(arrow.test(before.slice(-3))||/^[➡➠→➜➔>＞]/.test(after))continue;
  text=text.slice(0,match.index);break;
 }
 return text.trim().replace(/[\s▶⏩\uFE0F]+$/u,'');
}
function extractLabeledRoute(section){
 const match=[...section.matchAll(routeLabels)][0];
 if(!match)return null;
 const rest=section.slice(match.index+match[0].length),next=[...rest.matchAll(routeLabels)][0];
 return routeSummary(rest.slice(0,next?.index??rest.length).trimStart());
}
function extractNumberedPlaces(section){
 const marks=[...section.matchAll(numbering)];
 let categoryStart=-1;
 // Only standalone recommendation headers own following numbered lists.
 for(const match of section.matchAll(/(?:^|\n)[ \t]*(?:美食推荐|美食合集|美食打卡|住宿推荐|酒店推荐)[：:]?[ \t]*(?=\n|$)/g))categoryStart=categoryStart<0?match.index:Math.min(categoryStart,match.index);
 return marks.filter(m=>categoryStart<0||m.index<categoryStart).map((m,i,list)=>{
  const rest=section.slice(m.index+m[0].length,list[i+1]?.index??section.length);
  return cleanPlaceName(rest.split(/[\n：:]/)[0]);
 }).filter(Boolean);
}
function refineHeader(headerCandidates,numbered){
 const route=normalizeCandidates(headerCandidates),details=normalizeCandidates(numbered);
 const matches=(a,b)=>a.toLowerCase().includes(b.toLowerCase())||b.toLowerCase().includes(a.toLowerCase());
 // Complete corresponding numbered names may refine a route, never expand it.
 const aligned=details.filter(detail=>route.some(place=>matches(detail,place)));
 if(route.length&&route.every(place=>aligned.some(detail=>matches(detail,place))))return aligned;
 return route;
}
function detectRouteSource(section){
 const labeled=extractLabeledRoute(section),headerText=routeSummary(section),numbered=extractNumberedPlaces(section);
 if(labeled!==null)return {strategy:'labeled',routeText:labeled,values:candidates(labeled),numbered};
 if(arrow.test(headerText))return {strategy:'header_route',routeText:headerText,values:refineHeader(candidates(headerText),numbered),numbered};
 if(numbered.length)return {strategy:'numbered',routeText:'',values:numbered,numbered};
 if(headerText&&!/[。！？!?]|早上|上午|下午|晚上|然后|先去|我们/.test(headerText))return {strategy:'single_header',routeText:headerText,values:candidates(headerText),numbered};
 return {strategy:'unresolved',routeText:'',values:[],numbered};
}
function item(placeName){return {placeName,sourceTimeText:null,sourceDurationText:null,plannedStartTime:null,plannedEndTime:null,startTimeSource:null,durationMinutes:null,durationSource:null}}
export function parseExplicitItinerary(text){
 if(typeof text!=='string')return null;
 const normalized=normalizeText(text),markers=extractDayMarkers(normalized);
 console.log('[trip-text-parser markers]',markers.map(({dayIndex,index})=>({dayIndex,index})));
 if(!markers.length)return null;
 const sources=markers.map((marker,index)=>detectRouteSource(normalized.slice(marker.end,markers[index+1]?.index??normalized.length)));
 const transitCities=new Set();
 for(const source of sources)for(const value of candidates(source.routeText)){const match=value.match(/^(?:住)([\p{L}]+)$/u)||value.match(/^([\p{L}]+?)(?:集合|[东西南北]?站)$/u);if(match)transitCities.add(match[1])}
 const days=[],seen=new Set();
 for(let index=0;index<markers.length;index++){
  const marker=markers[index],dayIndex=marker.dayIndex;
  if(!dayIndex||dayIndex>365||seen.has(dayIndex))return null;
  const source=sources[index];
  const places=normalizeCandidates(source.values,transitCities);
  console.log('[trip-text-parser numbered]',{dayIndex,places:normalizeCandidates(source.numbered)});
  console.log('[trip-text-parser route]',{dayIndex,source:source.strategy,routeText:source.routeText,places});
  days.push({dayIndex,items:places.map(item)});seen.add(dayIndex);
 }
 const itemCount=days.reduce((sum,day)=>sum+day.items.length,0);
 const parseMeta={strategy:'deterministic',detectedDays:days.length,parsedDays:days.filter(day=>day.items.length).length,itemCount};
 console.log('[trip-text-parser meta]',parseMeta);
 if(!itemCount)return null;
 const result={name:null,destination:{country:null,city:null},days,parseMeta};
 console.log('[trip-text-parser result]',JSON.stringify(result));return result;
}
