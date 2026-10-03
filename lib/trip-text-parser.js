// Only explicit Day summaries are deterministic; prose stays with the LLM.
const header=/(?:day\s*(\d{1,3})|第\s*([0-9一二三四五六七八九十百两]+)\s*天)\s*[:：]?/gi
const separator=/(?:[➡➠→➜➔>＞]+\uFE0F?|\s*[-—]\s*|[、,，;；])/
function dayNumber(value){if(/^\d+$/.test(value))return Number(value);const digits={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};if(digits[value])return digits[value];if(/^[一二三四五六七八九]?十[一二三四五六七八九]?$/.test(value)){const [tens,ones]=value.split('十');return (digits[tens]||1)*10+(digits[ones]||0)}return null}
function normalizeDayKeycap(text){return text.replace(/(day\s*\d*)([0-9])\uFE0F?\u20E3/gi,'$1$2 ')}
function cleanDecorativeEmoji(value){return value.replace(/^(?:(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F|\u200D|[✔✓☑⭕🔸🔹•●·*])\s*)+|(?:\s*(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F|\u200D))+$/gu,'')}
function cleanPlaceName(value){return cleanDecorativeEmoji(value.trim()).trim()}
function isNonPoiActivity(value){return /^(?:收拾|整理行李|返程|回家|休息|自由活动|购物|逛街采购|逛街买伴手礼|买伴手礼|晚餐|早餐|午餐|吃饭|酒店入住|办理入住|退房|寄存行李)(?:$|[\s➕+、，,]|.*(?:返程|行李|伴手礼))/.test(value)}
function validPlace(value){return value.length>0&&value.length<=80&&!/[：:。！？!?]/.test(value)&&! /^(?:美食打卡|美食推荐|住宿推荐|住宿建议|酒店推荐)|早上先|上午先|下午再|我们|建议游玩|然后|逛完|准备去|先去|想去/.test(value)}
function extractDayMarkers(text){return [...text.matchAll(header)].filter(match=>!match[0].startsWith('第')||/[：:]/.test(match[0])||!/[\p{L}\p{N}]/u.test(text[match.index-1]||'')).map(match=>({dayIndex:dayNumber(match[1]||match[2]),index:match.index,end:match.index+match[0].length}))}
function extractNumberedPlaces(section){
 const matches=[...section.matchAll(/(?:[①-⑳]|(?:^|\n)\s*\d{1,2}[.、])([^\n①-⑳]*)/g)];
 if(!matches.length)return null;
 // Recommendations are outside the itinerary, including their numbered lists.
 const stop=section.search(/(?:^|\n)\s*(?:美食(?:打卡|推荐|合集)|住宿推荐|酒店推荐)/);
 const titles=matches.filter(match=>stop<0||match.index<stop).map(match=>cleanPlaceName(match[1].split(/[：:]/)[0]));
 if(!titles.length)return null;
 const places=titles.filter(value=>!isNonPoiActivity(value));
 if(places.some(value=>!validPlace(value)))return null;
 return [...new Set(places)];
}
function item(placeName){return {placeName,sourceTimeText:null,sourceDurationText:null,plannedStartTime:null,plannedEndTime:null,startTimeSource:null,durationMinutes:null,durationSource:null}}
function extractRoutePlaces(block){
 let routeText=block.trimStart();
 // Stop inline introductions even when Firecrawl has flattened all paragraphs.
 const boundaries=/[✔✅⭕🔸🔹]|美食(?:打卡|推荐|合集|[:：])|住宿|酒店|推荐|-{3,}|—{3,}/gu;
 for(const match of routeText.matchAll(boundaries)){
  const before=routeText.slice(0,match.index).trimEnd();
  // An icon decorating an arrow-separated place is not an introduction.
  if(match.index===0||/[➡➠→➜➔>＞]\uFE0F?$/.test(before))continue;
  routeText=routeText.slice(0,match.index);break;
 }
 // A newline is a boundary unless it explicitly continues an arrow chain.
 for(const match of routeText.matchAll(/\n/g)){
  const before=routeText.slice(0,match.index).trimEnd(),after=routeText.slice(match.index+1).trimStart();
  if(/[➡➠→➜➔>＞—-]\uFE0F?$/.test(before)||/^[➡➠→➜➔>＞—-]/.test(after))continue;
  routeText=routeText.slice(0,match.index);break;
 }
 routeText=routeText.trim().replace(/[\s▶⏩\uFE0F]+$/u,'');
 // Arrows outrank comma/list separators to avoid splitting descriptive text.
 const split=/[➡➠→➜➔>＞]/.test(routeText)?/[➡➠→➜➔>＞]+\uFE0F?/:separator;
 const places=routeText.split(split).map(cleanPlaceName).filter(Boolean).filter(value=>!isNonPoiActivity(value));
 const valid=places.length<=20&&places.every(validPlace);
 return {routeText,places,items:valid?[...new Set(places)].map(item):null};
}
export function parseExplicitItinerary(text){
 if(typeof text!=='string')return null;
 const normalized=normalizeDayKeycap(String(text||'')).replace(/\\t/g,'\n').replace(/\t/g,'\n').replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ');
 const headings=extractDayMarkers(normalized);
 console.log('[trip-text-parser markers]',headings.map(x=>({dayIndex:x.dayIndex,index:x.index})));
 if(!headings.length)return null;
 const days=[],seen=new Set();
 for(let i=0;i<headings.length;i++){
  const heading=headings[i],dayIndex=heading.dayIndex;
  if(!dayIndex||dayIndex>365||seen.has(dayIndex))return null;
  const block=normalized.slice(heading.end,headings[i+1]?.index??normalized.length),numberedPlaces=extractNumberedPlaces(block),{routeText,places,items:routeItems}=extractRoutePlaces(block);
  const items=numberedPlaces!==null?numberedPlaces.map(item):routeItems;
  console.log('[trip-text-parser numbered]',{dayIndex,places:numberedPlaces||[]});
  console.log('[trip-text-parser route]',{dayIndex,routeText,places});
  // Never return a partial itinerary when an explicit Day cannot be read reliably.
  if(!items)return null;
  seen.add(dayIndex);days.push({dayIndex,items});
 }
 const result={name:null,destination:{country:null,city:null},days};
 console.log('[trip-text-parser result]',JSON.stringify(result));
 return result;
}
