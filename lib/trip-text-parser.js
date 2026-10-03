// Only explicit Day summaries are deterministic; prose stays with the LLM.
const header=/(?:day\s*(\d{1,3})|第\s*([0-9一二三四五六七八九十百两]+)\s*天)\s*[:：]/gi
const separator=/(?:[➡➠→➜➔>＞]+\uFE0F?|\s*[-—]\s*|[、,，;；])/
function dayNumber(value){if(/^\d+$/.test(value))return Number(value);const digits={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};if(digits[value])return digits[value];if(/^[一二三四五六七八九]?十[一二三四五六七八九]?$/.test(value)){const [tens,ones]=value.split('十');return (digits[tens]||1)*10+(digits[ones]||0)}return null}
function place(value){return value.trim().replace(/^(?:(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F|[✔✓☑⭕🔸•●·*])\s*)+/u,'').trim()}
function item(placeName){return {placeName,sourceTimeText:null,sourceDurationText:null,plannedStartTime:null,plannedEndTime:null,startTimeSource:null,durationMinutes:null,durationSource:null}}
function route(block){
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
 const places=routeText.split(split).map(place).filter(Boolean);
 const valid=places.length>0&&places.length<=20&&!places.some(name=>name.length>80||/[：:。！？!?]/.test(name)||/^(?:美食打卡|美食推荐|住宿推荐|住宿建议|酒店推荐)|早上先|上午先|下午再|我们|建议游玩|然后|逛完|准备去|先去/.test(name));
 return {routeText,places,items:valid?places.map(item):null};
}
export function parseExplicitItinerary(text){
 if(typeof text!=='string')return null;
 const normalized=String(text||'').replace(/\\t/g,'\n').replace(/\t/g,'\n').replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ');
 const headings=[...normalized.matchAll(header)];
 console.log('[trip-text-parser markers]',headings.map(x=>({dayIndex:dayNumber(x[1]||x[2]),index:x.index})));
 if(!headings.length)return null;
 const days=[],seen=new Set();
 for(let i=0;i<headings.length;i++){
  const heading=headings[i],dayIndex=dayNumber(heading[1]||heading[2]);
  if(!dayIndex||dayIndex>365||seen.has(dayIndex))return null;
  const block=normalized.slice(heading.index+heading[0].length,headings[i+1]?.index??normalized.length),{routeText,places,items}=route(block);
  console.log('[trip-text-parser route]',{dayIndex,routeText,places});
  // Never return a partial itinerary when an explicit Day cannot be read reliably.
  if(!items)return null;
  seen.add(dayIndex);days.push({dayIndex,items});
 }
 const result={name:null,destination:{country:null,city:null},days};
 console.log('[trip-text-parser result]',JSON.stringify(result));
 return result;
}
