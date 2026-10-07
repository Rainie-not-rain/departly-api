import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import checkins from '../app/trip/subpages/checkinService.js';
import {getFootprints,getScrapbooks,getByDate} from '../lib/footprints.js';
import {getMapModel} from '../lib/footprint-map.js';
const key='departly_mvp_data_v1';
test('现有打卡保存→足迹/手账/地图→确认删除保持同一份持久化数据',()=>{
 const saved={storage:global.localStorage,window:global.window};let raw=JSON.stringify({managerUserId:'owner',currentTripId:'t',trips:[{id:'t',ownerUserId:'owner',name:'北京游',country:'中国',city:'北京',start:'2026-10-01',end:'2026-10-09',days:[{id:'d',date:'2026-10-01',nodes:[{id:'n',placeName:'故宫',status:'planned',latitude:39.9,longitude:116.4}],items:[{id:'n',placeName:'故宫',status:'planned'}]}]}],packing:[],expenses:[],checkins:[],tickets:[]});
 global.localStorage={getItem:k=>k===key?raw:null,setItem:(k,v)=>{if(k===key)raw=v;}};global.window={dispatchEvent(){}};
 try{
  assert.equal(getFootprints(JSON.parse(raw)).length,0);
  const row=checkins.createCheckin({tripId:'t',dayId:'d',itineraryItemId:'n',note:'看了红墙',mood:'happy',photos:[{id:'p',localPath:'actual-photo'}]});
  const data=JSON.parse(raw),copy=JSON.parse(JSON.stringify(data));
  assert.equal(getFootprints(copy).length,1);assert.equal(getByDate(copy,row.date)[0].note,'看了红墙');assert.equal(getScrapbooks(copy)[0].pages[0].checkinId,row.id);assert.equal(getMapModel(copy).stats.ticketCount,1);assert.equal(getMapModel(copy,{status:'wishlist'}).stats.cityCount,0);assert.deepEqual(copy,data);
  checkins.deleteCheckin(row.id);const after=JSON.parse(raw);assert.equal(getFootprints(after).length,0);assert.equal(getScrapbooks(after).length,0);assert.equal(getMapModel(after).stats.checkinCount,0);assert.equal(after.trips[0].days[0].nodes[0].status,'planned');
 }finally{global.localStorage=saved.storage;global.window=saved.window;}
});
test('足迹导航与子页入口完整，原图标存在，删除确认后才调用原服务',()=>{
 const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
 assert.match(read('app/components/bottom-navigation.tsx'),/name: "足迹", href: "\/footprints"/);
 for(const route of ['page.tsx','calendar/page.tsx','day/page.tsx','map/page.tsx','share/page.tsx','book/[tripId]/page.tsx'])assert.ok(existsSync(new URL('../app/footprints/'+route,import.meta.url)),route);
 assert.ok(existsSync(new URL('../public/images/icons/footprint-active.svg',import.meta.url)));
 const source=read('app/footprints/day.jsx');assert.match(source,/对应照片、票根和手账页也会移除/);assert.match(source,/确认删除/);assert.match(source,/checkins.deleteCheckin\(remove.id\)/);
});
