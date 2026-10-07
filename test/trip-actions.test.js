import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTripContext,contextToText} from '../lib/trip-context.js';
import {validateTripActionProposal,executeTripAction,contextVersion,actionIntentAllowed,proposalPreview,rebaseIndependentProposals} from '../lib/trip-actions.js';
import {normalizeCopilotResponse} from '../lib/copilot.js';
import {answerExtras,saveAnswerFeedback,dedupeSuggestions} from '../lib/copilot-experience.js';
const trip=()=>({id:'t',name:'重庆',start:'2026-10-07',end:'2026-10-09',members:[],preferences:['美食'],transports:[{id:'transport'}],stays:[{id:'stay'}],days:[{id:'d1',date:'2026-10-07',nodes:[{id:'h',place:'洪崖洞',start:'17:30',end:'19:00',note:'夜景'}]},{id:'d2',date:'2026-10-08',nodes:[{id:'c',place:'磁器口',start:'15:00',end:'17:00',note:'游览',poiId:'p',poiVerified:true,checkinId:'check'}]},{id:'d3',date:'2026-10-09',nodes:[{id:'b',place:'白象居',start:'14:00',end:'16:00'}]}]});
const move={type:'move_item',itemId:'c',fromDayId:'d2',toDayId:'d3',proposedStartTime:'14:30'};
const remove={type:'remove_item',itemId:'c',dayId:'d2'};
const add={type:'add_item',dayId:'d3',title:'长江索道',placeName:'长江索道',proposedStartTime:'16:00',durationMinutes:90};
const update={type:'update_time',itemId:'h',dayId:'d1',proposedStartTime:'19:00',proposedEndTime:'20:30'};
function pending(raw,t=trip()){return {...raw,id:'p',status:'pending',contextVersion:contextVersion(buildTripContext(t))};}
test('Context contains actual stable Day and Item IDs in structured and model text',()=>{const c=buildTripContext(trip());assert.equal(c.days[1].id,'d2');assert.match(contextToText(c),/dayId: d2/);assert.match(contextToText(c),/itemId: c/);});
test('move preview is non-mutating; confirmation moves, preserves duration, metadata and other nodes',()=>{const t=trip(),before=JSON.stringify(t),p=pending(move,t);const v=proposalPreview(p,t);assert.equal(v.name,'磁器口');assert.equal(JSON.stringify(t),before);const r=executeTripAction(t,p);assert.equal(JSON.stringify(t),before);assert.equal(r.trip.days[1].nodes.length,0);const n=r.trip.days[2].nodes.find(n=>n.id==='c');assert.equal(n.start,'14:30');assert.equal(n.end,'16:30');assert.equal(n.poiId,'p');assert.equal(n.checkinId,'check');assert.equal(n.dayId,'d3');assert.equal(r.trip.days[2].nodes[0].start,'14:00');assert.deepEqual(r.trip.transports,t.transports);});
test('remove requires confirmation and preserves unrelated arrangements',()=>{const t=trip();validateTripActionProposal(pending(remove,t),t);assert.equal(t.days[1].nodes.length,1);const r=executeTripAction(t,pending(remove,t));assert.equal(r.trip.days[1].nodes.length,0);assert.equal(r.trip.days[0].nodes.length,1);assert.deepEqual(r.trip.stays,t.stays);});
test('add generates stable ID, is unverified, and keeps nodes/items synchronized',()=>{const r=executeTripAction(trip(),pending(add), 'new-item');const n=r.trip.days[2].nodes.find(n=>n.id==='new-item');assert.ok(n);assert.equal(n.poiVerified,false);assert.equal(n.end,'17:30');assert.deepEqual(r.trip.days[2].items,r.trip.days[2].nodes);assert.equal(JSON.parse(JSON.stringify(r.trip)).days[2].nodes[1].id,'new-item');});
test('update_time updates both time field pairs and preserves note',()=>{const r=executeTripAction(trip(),pending(update));const n=r.trip.days[0].nodes[0];assert.equal(n.start,'19:00');assert.equal(n.plannedStartTime,'19:00');assert.equal(n.end,'20:30');assert.equal(n.note,'夜景');});
test('manual modification after proposal invalidates it without mutation',()=>{const t=trip(),p=pending(move,t);t.days[1].nodes[0].start='16:00';const before=JSON.stringify(t);assert.throws(()=>executeTripAction(t,p),/失效/);assert.equal(JSON.stringify(t),before);});
test('after action next Context reflects new current placement',()=>{const r=executeTripAction(trip(),pending(move));const c=buildTripContext(r.trip);assert.equal(c.days[1].items.length,0);assert.ok(c.days[2].items.some(n=>n.id==='c'));});
test('overlap warning never reschedules existing item',()=>{const t=trip(),p=pending(move);assert.match(validateTripActionProposal(p,t).warnings[0],/白象居/);const r=executeTripAction(t,p);assert.equal(r.trip.days[2].nodes.find(n=>n.id==='b').start,'14:00');});
test('fake item/day, wrong owner day, duplicate identities and unknown action are rejected',()=>{for(const p of [{...move,itemId:'fake'},{...move,fromDayId:'d1'},{...move,toDayId:'fake'},{type:'delete_trip'}])assert.throws(()=>validateTripActionProposal(p,trip()));const t=trip();t.days[2].id='d2';assert.throws(()=>validateTripActionProposal(move,t));});
test('invalid time, reversed range, late duration and oversized duration rejected',()=>{for(const p of [{...move,proposedStartTime:'24:00'},{...update,proposedEndTime:'18:00'},{...add,proposedStartTime:'23:30'},{...add,durationMinutes:1000}])assert.throws(()=>validateTripActionProposal(p,trip()));});
test('discussions and open optimization never authorize actions',()=>{assert.equal(actionIntentAllowed(remove,'磁器口是不是可以不去了？'),false);assert.equal(actionIntentAllowed(remove,'磁器口好像可以不去了吧'),false);assert.equal(actionIntentAllowed(remove,'帮我把行程优化一下'),false);assert.equal(actionIntentAllowed(remove,'把磁器口删掉'),true);assert.equal(actionIntentAllowed(remove,'不要删除磁器口'),false);assert.equal(actionIntentAllowed(add,'不要添加长江索道'),false);});
test('AI cannot invent additions absent from explicit query',()=>{const c=buildTripContext(trip());const r=normalizeCopilotResponse({reply:'建议',proposals:[add]},c,'第三天下午加一个景点',()=> 'p');assert.equal(r.proposals.length,0);assert.equal(r.invalidCount,1);assert.equal(normalizeCopilotResponse({reply:'建议',proposals:[add]},c,'第三天下午加长江索道',()=> 'p').proposals.length,1);});
test('ordinary Q&A returns empty proposals; strict schema rejects over 3 or non-array',()=>{const c=buildTripContext(trip());assert.deepEqual(normalizeCopilotResponse({reply:'第二天去磁器口',proposals:[]},c,'第二天去哪',()=> 'p').proposals,[]);assert.throws(()=>normalizeCopilotResponse({reply:'回答',proposals:Array(4).fill(remove)},c,'删掉磁器口',()=> 'p'));});
test('invalid provider proposals cannot appear as executable cards',()=>{const c=buildTripContext(trip());for(const p of [{...move,itemId:'fake'},{type:'delete_trip'},remove]){const r=normalizeCopilotResponse({reply:'已完成',proposals:[p]},c,'第二天是不是太赶',()=> 'p');assert.equal(r.proposals.length,0);}});
test('applied or dismissed proposal cannot be executed again',()=>{for(const status of ['applied','dismissed','invalid'])assert.throws(()=>executeTripAction(trip(),{...pending(remove),status}));const r=executeTripAction(trip(),pending(add),'new');assert.throws(()=>executeTripAction(r.trip,pending(add),'new'));});
test('grounded evidence includes only context; follow-ups bounded and non-repeating',()=>{const c=buildTripContext(trip()),r=answerExtras(c,'第二天是不是太赶？');assert.match(r.evidence[0].label,/磁器口/);assert.doesNotMatch(JSON.stringify(r.evidence),/长江索道/);assert.ok(r.suggestions.length<=3);assert.ok(!r.suggestions.includes('第二天是不是太赶？'));});

test('confirmed storage flow persists, survives reload, blocks replay and denies non-owner',async()=>{
 const {readFileSync}=await import('node:fs'),{transpileModule}=await import('typescript');
 const file=new URL('../app/trip/trip-action-service.ts',import.meta.url);
 let source=transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:99,target:9}}).outputText;
 source=source.replace(/from '([^']+)'/g,(_,path)=>`from '${new URL(path.endsWith('.js')?path:path+'.ts',file).href}'`);
 const service=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const {readTrips}=await import('../app/trips/trip-service.ts');
 const oldStorage=globalThis.localStorage,oldWindow=globalThis.window,rows=new Map();
 const t=trip();t.ownerUserId='owner';t.collaborationMode='managed';
 rows.set('departly_mvp_data_v1',JSON.stringify({managerUserId:'owner',trips:[t],packing:[],tickets:[],expenses:[]}));
 let notifications=0;
 globalThis.localStorage={getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,v)};globalThis.window={dispatchEvent:()=>notifications++};
 try{
  const p=pending(move,t);assert.equal(readTrips().trips[0].days[1].nodes.length,1);
  service.applyConfirmedTripAction('t',p);
  assert.equal(readTrips().trips[0].days[1].nodes.length,0);assert.equal(readTrips().trips[0].days[2].nodes.find(n=>n.id==='c').start,'14:30');assert.equal(notifications,1);
  const saved=rows.get('departly_mvp_data_v1');assert.throws(()=>service.applyConfirmedTripAction('t',p));assert.equal(rows.get('departly_mvp_data_v1'),saved);
  const data=JSON.parse(saved);data.managerUserId='other';rows.set('departly_mvp_data_v1',JSON.stringify(data));assert.throws(()=>service.applyConfirmedTripAction('t',pending(add,data.trips[0])),/创建者/);
  const owned=JSON.parse(saved),before=JSON.stringify(owned);rows.set('departly_mvp_data_v1',before);globalThis.localStorage.setItem=()=>{throw Error('storage quota');};assert.throws(()=>service.applyConfirmedTripAction('t',{...pending(add,owned.trips[0]),id:'new-proposal'}),/storage quota/);assert.equal(rows.get('departly_mvp_data_v1'),before);
 }finally{globalThis.localStorage=oldStorage;globalThis.window=oldWindow;}
});

test('same batch unaffected proposal remains independently confirmable after own action',()=>{
 const t=trip(),before=buildTripContext(t),p1={...pending(move,t),id:'p1'},p2={...pending(update,t),id:'p2'};
 const result=executeTripAction(t,p1),after=buildTripContext(result.trip),rebased=rebaseIndependentProposals([p1,p2],before,after,'p1');
 assert.equal(rebased[0].status,'applied');assert.equal(rebased[1].status,'pending');assert.doesNotThrow(()=>executeTripAction(result.trip,rebased[1]));
 const other={...pending(remove,t),id:'p3'};assert.equal(rebaseIndependentProposals([p1,other],before,after,'p1')[1].status,'invalid');
});

test('feedback persists independently, toggles mutually and cancels on repeated vote',()=>{const rows=new Map(),storage={getItem:k=>rows.get(k)||null,setItem:(k,v)=>rows.set(k,v)};assert.equal(saveAnswerFeedback(storage,'message','up'),'up');assert.equal(JSON.parse(rows.get('departly_copilot_feedback')).message,'up');assert.equal(saveAnswerFeedback(storage,'message','down'),'down');assert.equal(saveAnswerFeedback(storage,'message','down'),null);assert.equal(JSON.parse(rows.get('departly_copilot_feedback')).message,null);assert.equal(rows.size,1);});

test('evidence preference labels reuse visible UI names and exclude unknown backend codes',()=>{const c=buildTripContext(trip());c.trip.preferences=['history','citywalk','photo','relax','family_friendly','internal_debug'];const r=answerExtras(c,'第二天去哪？'),label=r.evidence.find(e=>e.type==='preferences').label;assert.match(label,/历史人文、城市漫步、拍照出片、休闲度假、亲子友好/);assert.doesNotMatch(label,/history|citywalk|family_friendly|internal_debug/);c.trip.preferences=['unknown_internal'];assert.ok(!answerExtras(c,'第二天去哪？').evidence.some(e=>e.type==='preferences'));});

test('rejected action diagnostics identify exact fields without exposing names or context',()=>{const c=buildTripContext(trip());const r=normalizeCopilotResponse({reply:'建议',proposals:[{...move,toDayId:'fake'}]},c,'把磁器口移到第三天下午',()=> 'p');assert.equal(r.diagnostics[0].field,'toDayId');assert.equal(r.diagnostics[0].reason,'day_not_found');assert.doesNotMatch(JSON.stringify(r.diagnostics),/磁器口|重庆|fake/);assert.equal(r.proposals.length,0);});

test('clear move request with afternoon and missing clock produces pending proposal without modifying Trip',()=>{
 const t=trip();t.days[1].nodes[0].place='颐和园';const c=buildTripContext(t),before=JSON.stringify(t);
 const raw={type:'move_item',itemId:'c',fromDayId:'d2',toDayId:'d3'};
 const r=normalizeCopilotResponse({reply:'建议移到第三天下午',proposals:[raw]},c,'把颐和园移到第三天下午',()=> 'p');
 assert.equal(r.proposals.length,1);assert.equal(r.proposals[0].proposedStartTime,'16:00');assert.equal(JSON.stringify(t),before);
 const result=executeTripAction(t,r.proposals[0]);assert.equal(result.trip.days[2].nodes.find(n=>n.id==='c').start,'16:00');
});
test('occupied whole afternoon still generates default time with overlap warning',()=>{const t=trip();t.days[2].nodes[0].end='18:00';const c=buildTripContext(t);const r=normalizeCopilotResponse({reply:'建议',proposals:[{type:'move_item',itemId:'c',fromDayId:'d2',toDayId:'d3'}]},c,'把磁器口移到第三天下午',()=> 'p');assert.equal(r.proposals[0].proposedStartTime,'14:00');assert.match(proposalPreview(r.proposals[0],t).warnings[0],/白象居/);});
test('missing end clock retains stored duration for move and update_time',()=>{const t=trip();t.days[0].nodes[0].end='';t.days[0].nodes[0].durationMinutes=90;const c=buildTripContext(t);const r=normalizeCopilotResponse({reply:'调整',proposals:[{type:'update_time',dayId:'d1',itemId:'h'}]},c,'洪崖洞改成晚上七点',()=> 'p');assert.equal(r.proposals[0].proposedStartTime,'19:00');assert.equal(r.proposals[0].proposedEndTime,'20:30');assert.equal(executeTripAction(t,r.proposals[0]).trip.days[0].nodes[0].end,'20:30');});
test('unrelated legacy missing identity does not reject a valid exact-ID action',()=>{const t=trip();t.days[0].nodes.push({place:'旧节点'});t.days.push({nodes:[]});assert.doesNotThrow(()=>validateTripActionProposal(move,t));assert.equal(executeTripAction(t,pending(move,t)).trip.days[2].nodes.find(n=>n.id==='c').dayId,'d3');});
test('missing or duplicate targeted IDs remain rejected',()=>{const t=trip();delete t.days[2].id;assert.throws(()=>validateTripActionProposal(move,t));const other=trip();other.days[0].nodes.push({...other.days[1].nodes[0]});assert.throws(()=>validateTripActionProposal(move,other));});
test('duplicate place names require source-day clarification rather than arbitrary model choice',()=>{const t=trip();t.days[0].nodes.push({id:'other',place:'磁器口',start:'09:00',end:'10:00'});const c=buildTripContext(t),response={reply:'建议',proposals:[move]};assert.equal(normalizeCopilotResponse(response,c,'把磁器口移到第三天下午',()=> 'p').proposals.length,0);assert.equal(normalizeCopilotResponse(response,c,'把第二天的磁器口移到第三天下午',()=> 'p').proposals.length,1);});
test('follow-up normalization deduplicates Chinese, numeric and Day references',()=>{assert.deepEqual(dedupeSuggestions(['第3天下午有哪些安排？','第三天下午有什么安排？','Day 3 下午有哪些安排？','哪一天最轻松？']),['第3天下午有哪些安排？','哪一天最轻松？']);assert.deepEqual(dedupeSuggestions(['第3天下午有哪些安排？','哪一天最轻松？'],'第三天下午有什么安排？'),['哪一天最轻松？']);});
