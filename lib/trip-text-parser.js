// Only explicit Day summaries are deterministic; prose stays with the LLM.
const header=/(?:\bday\s*(\d{1,3})|第\s*([0-9一二三四五六七八九十百两]+)\s*天)\s*[:：]/gi
const separator=/(?:[➡➠→➜➔>＞]+\uFE0F?|\s*[-—]\s*|[、,，;；])/
function dayNumber(value){if(/^\d+$/.test(value))return Number(value);const digits={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};if(digits[value])return digits[value];if(/^[一二三四五六七八九]?十[一二三四五六七八九]?$/.test(value)){const [tens,ones]=value.split('十');return (digits[tens]||1)*10+(digits[ones]||0)}return null}
function place(value){return value.trim().replace(/^(?:(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F|[✔✓☑⭕🔸•●·*])\s*)+/u,'').trim()}
function item(placeName){return {placeName,sourceTimeText:null,sourceDurationText:null,plannedStartTime:null,plannedEndTime:null,startTimeSource:null,durationMinutes:null,durationSource:null}}
function route(block){
 const lines=block.trimStart().split(/\r?\n/);
 if(!lines[0])return null;
 let summary=lines[0].trim();
 // Permit wrapped arrow chains, but stop before descriptions or a new paragraph.
 for(let i=1;i<lines.length;i++){
  const next=lines[i].trim();
  if(!next||/[：:。！？!?]/.test(next))break;
  if(/[➡➠→➜➔>＞—-]\uFE0F?$/.test(summary)||/^[➡➠→➜➔>＞—-]/.test(next))summary+=' '+next;
  else break;
 }
 const names=summary.split(separator).map(place).filter(Boolean);
 if(!names.length||names.length>20)return null;
 // Description sentences, recommendation headings and time prose are not place names.
 if(names.some(name=>name.length>80||/[：:。！？!?]/.test(name)||/^(?:美食打卡|美食推荐|住宿推荐|住宿建议|酒店推荐)|早上先|上午先|下午再|我们|建议游玩|然后|逛完|准备去|先去/.test(name)))return null;
 return names.map(item);
}
export function parseExplicitItinerary(text){
 if(typeof text!=='string')return null;
 const headings=[...text.matchAll(header)];
 if(!headings.length)return null;
 const days=[],seen=new Set();
 for(let i=0;i<headings.length;i++){
  const heading=headings[i],dayIndex=dayNumber(heading[1]||heading[2]);
  if(!dayIndex||dayIndex>365||seen.has(dayIndex))return null;
  const block=text.slice(heading.index+heading[0].length,headings[i+1]?.index??text.length),items=route(block);
  // Never return a partial itinerary when an explicit Day cannot be read reliably.
  if(!items)return null;
  seen.add(dayIndex);days.push({dayIndex,items});
 }
 return {name:null,destination:{country:null,city:null},days};
}
