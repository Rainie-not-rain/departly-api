import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from '../app/trip/subpages/settlement.js';
import {saveExpense} from '../app/trip/subpages/expense-service.js';
import {equalSplits} from '../app/trip/subpages/tripMembers.js';
const trip={id:'t',ownerUserId:'u',members:[{id:'A',isCurrentUser:true},{id:'B'},{id:'C'}]};
const expense=()=>({id:'e',tripId:'t',amount:100,currency:'CNY',payerId:'A',participantIds:['A','B'],splitType:'custom',splits:[{memberId:'A',amountFen:5000},{memberId:'B',amountFen:5000}]});
const plan=rows=>build({expenses:rows},trip);
test('合法账目完整计入实付、分摊、余额及转账',()=>{const r=plan([expense()]),a=r.members.find(m=>m.id==='A');assert.deepEqual([a.paidFen,a.shareFen,a.balanceFen],[10000,5000,5000]);assert.equal(r.totalFen,10000);assert.equal(r.transfers[0].amountFen,5000);});
const cases=[
 ['分摊合计不等于总额',e=>e.splits[1].amountFen=4000],
 ['付款人不存在',e=>e.payerId='missing'],
 ['参与人不存在',e=>e.participantIds[1]='missing'],
 ['重复分摊成员',e=>e.splits[1].memberId='A'],
 ['参与人为空',e=>e.participantIds=[]],
 ['参与人重复',e=>e.participantIds=['A','A']],
 ['分摊成员不存在',e=>e.splits[1].memberId='missing'],
 ['负分摊金额',e=>{e.splits[0].amountFen=-1;e.splits[1].amountFen=10001;}],
 ['非整数分摊',e=>e.splits[0].amountFen=5000.5],
 ['缺少分摊',e=>delete e.splits],
 ['空分摊对象',e=>e.splits[0]=null],
 ['非法金额',e=>e.amount=Infinity],
 ['零金额',e=>e.amount=0],
 ['非法币种',e=>e.currency='FAKE'],
 ['未折算外币',e=>{e.currency='JPY';e.convertedAmountCNY=null;}],
 ['非法折算',e=>e.convertedAmountCNY=-100]
];
for(const [name,change] of cases)test(name+'：整笔跳过且不修改原账目',()=>{const e=expense();change(e);const before=structuredClone(e),r=plan([e]);assert.equal(r.issues.length,1);assert.equal(r.rows[0].valid,false);assert.equal(r.totalFen,0);assert.equal(r.transfers.length,0);for(const m of r.members)assert.deepEqual([m.paidFen,m.shareFen,m.balanceFen],[0,0,0]);assert.deepEqual(e,before);});
test('合法与异常混合仅聚合合法账目，修复后恢复正常结算',()=>{const bad={...expense(),id:'bad',amount:300};let r=plan([expense(),bad]);assert.equal(r.totalFen,10000);assert.equal(r.members.find(m=>m.id==='A').paidFen,10000);assert.equal(r.members.reduce((n,m)=>n+m.balanceFen,0),0);assert.equal(r.transfers.length,0);bad.splits=[{memberId:'A',amountFen:15000},{memberId:'B',amountFen:15000}];r=plan([expense(),bad]);assert.equal(r.issues.length,0);assert.equal(r.totalFen,40000);assert.equal(r.transfers[0].amountFen,20000);});
test('均摊余分优先当前用户而非付款人，并保持成员顺序',()=>{assert.deepEqual(equalSplits(trip,['B','C','A'],10000),[{memberId:'A',amountFen:3334},{memberId:'B',amountFen:3333},{memberId:'C',amountFen:3333}]);assert.deepEqual(equalSplits(trip,['C','B'],10001),[{memberId:'B',amountFen:5001},{memberId:'C',amountFen:5000}]);});
test('正式保存拒绝无效成员与分摊，拒绝后原数据不变',()=>{const input={amount:'100',currency:'CNY',category:'餐饮',note:'午餐',date:'2026-10-07',payerId:'A',participantIds:['A','B'],splitType:'equal'};
 for(const patch of [{payerId:'missing'},{participantIds:[]},{participantIds:['A','missing']},{participantIds:['A','A']},{participantIds:undefined},{amount:'0'},{currency:'FAKE'},{splitType:'custom',originalSplits:[{memberId:'A',originalAmountFen:-1},{memberId:'B',originalAmountFen:10001}]},{splitType:'custom',originalSplits:[null,null]}]){const data={managerUserId:'u',trips:[structuredClone(trip)],expenses:[]},before=structuredClone(data);assert.throws(()=>saveExpense(data,'t',{...input,...patch}));assert.deepEqual(data,before);}
 const data={managerUserId:'u',trips:[structuredClone(trip)],expenses:[]};assert.throws(()=>saveExpense(data,'t',{...input,currency:'USD'},'',{rate:1e20,date:'2026-10-07'}),/折算金额/);assert.equal(data.expenses.length,0);
});
