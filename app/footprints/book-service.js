import {getFootprints,getScrapbooks} from '../../lib/footprints.js';
import {assertOwner} from '../trips/ownership.js';
export const templates=['postcard','collage','photo_note','magazine'];
const legacyTemplates={template_01_postcard:'postcard',template_02_collage:'collage',template_03_photo_note:'photo_note',template_04_magazine:'magazine'};
export function availableTemplates(count){return count===1?['postcard','magazine','photo_note']:count===2?['collage','postcard','magazine','photo_note']:[];}
function stableHash(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function buildBook(data,id){
 const trip=(data.trips||[]).find(t=>t.id===id&&!t.isDeleted),book=getScrapbooks(data).find(b=>b.tripId===id);
 if(!trip||!book)return null;
 const rows=getFootprints(data),records=rows.filter(r=>r.tripId===id);
 const summary={checkinCount:records.length,ticketCount:book.pages.length,cityCount:new Set(records.map(r=>r.city).filter(Boolean)).size,countryCount:new Set(records.map(r=>r.country).filter(Boolean)).size};
function buildScrapbookPages(id){const b=book;if(!b)return [];const records=rows.filter(r=>r.tripId===id),hidden=new Set((trip.scrapbookOverrides||{}).hiddenPhotoIds||[]);return b.pages.map(p=>({...p,moodIcon:({happy:'☺',calm:'☁',tired:'☾',开心:'☺',平静:'☁',疲惫:'☾'})[p.mood]||({开心:'☺',平静:'☁',疲惫:'☾'})[p.moodText]||'',spotName:p.placeName,spotPinyin:p.spotPinyin||'',imagePath:p.originalImagePath,imageUrl:p.originalImageUrl,hidden:hidden.has(p.photoId),dayIndex:records.find(r=>r.id===p.checkinId)?.dayIndex||0,checkinTime:records.find(r=>r.id===p.checkinId)?.completedAt||records.find(r=>r.id===p.checkinId)?.createdAt||0})).sort((a,b)=>a.dayIndex-b.dayIndex||a.checkinTime-b.checkinTime)}
function buildDailyRoutes(trip,records){
 const days=trip?.days||[];
 if(!days.length){const grouped=new Map();for(const r of records){const dayIndex=r.dayIndex||1;if(!grouped.has(dayIndex))grouped.set(dayIndex,{dayIndex,places:[]});if(r.placeName)grouped.get(dayIndex).places.push(r.placeName)}return [...grouped.values()]}
 return days.map((day,i)=>{const nodes=day.nodes||day.items||[],places=nodes.map(n=>n.placeName||n.place||n.title).filter(x=>typeof x==='string'&&x.trim());for(const r of records.filter(r=>(day.id&&r.dayId===day.id)||r.dayIndex===i+1))if(r.placeName&&!nodes.some(n=>r.itineraryItemId&&n.id===r.itineraryItemId)&&!places.includes(r.placeName))places.push(r.placeName);return {dayIndex:i+1,places}})
}
function routeLines(text,columns=12){const lines=[];let line='',width=0;for(const char of String(text)){const weight=1;if(char==='\n'){lines.push(line);line='';width=0;continue}if(width+weight>columns){lines.push(line);line='';width=0}line+=char;width+=weight}if(line||!lines.length)lines.push(line);return lines}
function paginateDailyRoutes(routes){const pages=[];let page=[],used=0;const flush=()=>{if(page.length)pages.push(page);page=[];used=0};for(const route of routes){const lines=route.places.flatMap(p=>routeLines(p)),total=lines.length+2;if(total<=10&&used+total>10)flush();if(!lines.length){if(used+3>10)flush();page.push({...route,places:[],continuation:false});used+=3;continue}let offset=0;while(offset<lines.length){if(used+3>10)flush();const count=Math.min(lines.length-offset,10-used-2);page.push({dayIndex:route.dayIndex,places:lines.slice(offset,offset+count),continuation:offset>0});used+=count+2;offset+=count;if(offset<lines.length)flush()}}flush();return pages}
function buildScrapbookSpreads(id,raw=false){const b=book;if(!b)return [];const pages=buildScrapbookPages(id).filter(p=>!p.hidden),groups=new Map(),o=(trip.scrapbookOverrides||{}),memorySummary=summary,records=rows.filter(r=>r.tripId===id).sort((a,b)=>(a.dayIndex||0)-(b.dayIndex||0)||(a.completedAt||a.createdAt||0)-(b.completedAt||b.createdAt||0));for(const p of pages){const pair=(o.mergedPhotoPairs||[]).find(pair=>pair.includes(p.photoId)),group=pair?'merged_'+pair[0]:p.checkinId;if(!groups.has(group))groups.set(group,[]);groups.get(group).push(p)}const routes=buildDailyRoutes(trip,records);const common={scrapbookId:b.id,tripId:id,createdAt:b.createdAt,title:b.title,startDate:b.startDate,endDate:b.endDate,coverPhoto:b.coverPhoto,summary:memorySummary,routePoints:b.routeMap.points,routeImage:o.routeMap?.imagePath||null,routes};const routePages=paginateDailyRoutes(routes);const list=[{...common,id:'cover_'+id,type:'cover',pageIds:[]},{...common,id:'intro_'+id,type:'intro',routePage:routePages[0]||[],pageIds:[]}];for(let i=1;i<routePages.length;i+=2)list.push({...common,id:'itinerary_'+id+'_'+i,type:'itinerary',leftRoutes:routePages[i],rightRoutes:routePages[i+1]||null,pageIds:[]});for(const photos of groups.values()){const sizes=Array.from({length:Math.ceil(photos.length/2)},(_,i)=>Math.min(2,photos.length-i*2));let offset=0;for(const size of sizes){const assets=photos.slice(offset,offset+size);offset+=size;const key='spread_'+assets[0].id,allowed=availableTemplates(assets.length),stored=o.templateOverrides?.[key],choice=legacyTemplates[stored]||stored;const base={...common,id:key,type:'memory',pageIds:assets.map(p=>p.id),assets,lead:assets[0],ticketIds:assets.map(p=>p.id),layoutNeedsReview:!!choice&&!allowed.includes(choice),templateOverride:choice||null,templateId:allowed.includes(choice)?choice:assets.length===2?'collage':allowed[stableHash(id+'-'+key)%allowed.length]};if(assets.length===2&&base.templateId!=='collage'){for(const asset of assets){const singleKey='spread_'+asset.id,custom=legacyTemplates[o.templateOverrides?.[singleKey]]||o.templateOverrides?.[singleKey];list.push({...base,id:singleKey,assets:[asset],lead:asset,pageIds:[asset.id],ticketIds:[asset.id],templateId:availableTemplates(1).includes(custom)?custom:base.templateId})}}else list.push(base)}}list.push({...common,id:'ending_'+id,type:'ending',pageIds:[]},{...common,id:'back_'+id,type:'back_cover',pageIds:[]});const reading=[];for(let i=0;i<list.length;i++){const left=list[i];if(!raw&&left.type==='memory'&&left.templateType!=='photo_note'&&left.templateId!=='photo_note'){const next=list[i+1];const right=next?.type==='memory'&&next.templateId!=='photo_note'?next:null;if(right)i++;reading.push({...left,left,right,assets:[...left.assets,...(right?.assets||[])],pageIds:[...left.pageIds,...(right?.pageIds||[])]})}else reading.push(left)}return reading.map((s,i)=>({...s,pageItems:s.assets||[],ticketIds:s.ticketIds||[],spreadIndex:i,templateId:s.templateId||null,templateType:s.templateId||null}))}

 return {...book,pages:buildScrapbookPages(id),spreads:buildScrapbookSpreads(id),rawSpreads:buildScrapbookSpreads(id,true)};
}
// All edits reuse the original Trip scrapbookOverrides; no derived scrapbook is persisted.
export function editBook(data,tripId,action){
 const trip=(data.trips||[]).find(t=>t.id===tripId&&!t.isDeleted);if(!trip)throw Error('旅程不存在');assertOwner(data,trip);
 const book=buildBook(data,tripId);if(!book)throw Error('手账不存在');
 const before=trip.scrapbookOverrides||{},next=JSON.parse(JSON.stringify(before));next.tripId=tripId;
 next.hiddenPhotoIds=next.hiddenPhotoIds||[];next.templateOverrides=next.templateOverrides||{};
 const page=id=>{const found=book.pages.find(p=>p.photoId===id);if(!found)throw Error('照片不属于此旅程');return found;};
 if(action.type==='cover'){
  const cover=action.cover;if(!['first_checkin','checkin_photo','custom'].includes(cover?.source))throw Error('封面类型无效');
  if(cover.source==='checkin_photo')page(cover.photoId);
  if(cover.source==='custom'&&!/^data:image\/(jpeg|png|webp|gif);base64,/.test(cover.customImagePath||''))throw Error('请选择有效封面图片');
  next.cover={...cover};
 }else if(action.type==='hide'||action.type==='restore'){
  page(action.photoId);next.hiddenPhotoIds=action.type==='hide'?[...new Set([...next.hiddenPhotoIds,action.photoId])]:next.hiddenPhotoIds.filter(id=>id!==action.photoId);
 }else if(action.type==='layout'){
  const spread=book.rawSpreads.find(s=>s.id===action.spreadId);if(!spread?.assets||!availableTemplates(spread.assets.length).includes(action.template))throw Error('此版式不适合当前照片数量');
  next.templateOverrides[spread.id]=action.template;
 }else if(action.type==='merge'){
  const ids=action.photoIds,visible=book.pages.filter(p=>!p.hidden);if(!Array.isArray(ids)||ids.length!==2||ids[0]===ids[1])throw Error('请选择两张可见照片');
  const positions=ids.map(id=>visible.findIndex(p=>p.photoId===id));if(positions.some(i=>i<0)||Math.abs(positions[0]-positions[1])!==1)throw Error('只能合并相邻照片');
  const pair=positions.sort((a,b)=>a-b).map(i=>visible[i].photoId);next.mergedPhotoPairs=(next.mergedPhotoPairs||[]).filter(pair=>!pair.some(id=>ids.includes(id)));next.mergedPhotoPairs.push(pair);
  for(const id of ids)delete next.templateOverrides['spread_'+page(id).id];next.templateOverrides['spread_'+page(pair[0]).id]='collage';
 }else if(action.type==='note'){
  if(typeof action.note!=='string'||action.note.length>500)throw Error('文案最多500字');
  const record=[...(data.checkins||[]),...(data.tickets||[])].find(r=>r.id===action.checkinId&&r.tripId===tripId);if(!record)throw Error('打卡记录不存在');record.note=action.note;if(Object.prototype.hasOwnProperty.call(record,'message'))record.message=action.note;record.updatedAt=Date.now();return;
 }else throw Error('手账操作无效');
 next.updatedAt=Date.now();trip.scrapbookOverrides=next;
}
