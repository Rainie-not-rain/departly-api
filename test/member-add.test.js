import test from 'node:test';
import assert from 'node:assert/strict';
import {memberAddRequest,addConfirmedMembers} from '../lib/member-add.js';
import {createOwner} from '../app/trip/subpages/tripMembers.js';
import {buildExpenseDraft} from '../lib/expense-draft.js';
test('明确添加命令生成名单；讨论和否定不添加',()=>{assert.deepEqual(memberAddRequest('添加同行人小A、小B'),['小A','小B']);assert.deepEqual(memberAddRequest('帮我添加成员：小A，小B'),['小A','小B']);assert.equal(memberAddRequest('不要添加同行人小A'),null);assert.equal(memberAddRequest('如何添加同行人'),null);assert.throws(()=>memberAddRequest('添加同行人小A、小A'));});
test('确认前不改成员；确认后稳定ID；重复或批量错误不部分添加',()=>{const trip={id:'t',members:[createOwner('t')]},before=structuredClone(trip);const names=memberAddRequest('添加同行人小A、小B');assert.deepEqual(trip,before);addConfirmedMembers(trip,names);assert.equal(trip.members.length,3);assert.equal(new Set(trip.members.map(m=>m.id)).size,3);assert.equal(trip.members[1].tripId,'t');const saved=structuredClone(trip);assert.throws(()=>addConfirmedMembers(trip,['小C','小A']));assert.deepEqual(trip,saved);});
test('添加成员后原记账Intent可重新绑定，不创建账目或猜付款人',()=>{const trip={id:'t',members:[createOwner('t')]},intent={amount:800,participantReferences:['我','小A','小B'],payerReference:null,splitType:'equal'},args={trip,text:'三个吃饭800，我、小A、小B',today:'2026-10-07',id:'d'};const old=buildExpenseDraft(intent,args);assert.equal(old.participantIds.length,0);addConfirmedMembers(trip,['小A','小B']);const next=buildExpenseDraft(intent,args);assert.equal(next.participantIds.length,3);assert.equal(next.payerId,null);assert.ok(next.unresolvedFields.includes('payerId'));});
