import test from 'node:test';
import assert from 'node:assert/strict';
import {saveConfirmedExpense} from '../app/trip/subpages/expense-confirmation.js';
import {buildExpenseDraft} from '../lib/expense-draft.js';
const fixture=()=>({managerUserId:'u',currentTripId:'b',trips:[{id:'a',name:'北京5日游',ownerUserId:'u',members:[{id:'me',name:'我',isCurrentUser:true}]},{id:'b',name:'景德镇3日游',ownerUserId:'u',members:[{id:'other',name:'我',isCurrentUser:true}]}],expenses:[]});
const draft=data=>buildExpenseDraft({amount:500,category:'餐饮',payerReference:'我',participantReferences:['我们'],splitType:'equal'},{trip:data.trips[0],data,text:'我们均摊',today:'2026-10-07'});
test('草稿不入账，持久化成功后才返回真实旅程成功消息，activeTrip不改变归属',()=>{let data=fixture();const d=draft(data);assert.equal(data.expenses.length,0);const result=saveConfirmedExpense(mutator=>{const next=structuredClone(data);mutator(next);data=next;},d,{rate:1,date:'2026-10-07'});assert.equal(result.message,'已记入「北京5日游」账本 🌿');assert.equal(data.expenses[0].tripId,'a');assert.equal(data.settlementPlans.a.totalFen,50000);assert.equal(data.settlementPlans.b.totalFen,0);});
test('存储失败和保存校验失败均无成功结果且保留草稿',()=>{const data=fixture(),d=draft(data),before=structuredClone(d);assert.throws(()=>saveConfirmedExpense(mutator=>{mutator(structuredClone(data));throw Error('存储失败');},d,null),/存储失败/);assert.deepEqual(d,before);assert.equal(data.expenses.length,0);for(const patch of [{payerId:'missing'},{amount:0},{tripId:'deleted'}])assert.throws(()=>saveConfirmedExpense(mutator=>mutator(structuredClone(data)),{...d,...patch},null));});
