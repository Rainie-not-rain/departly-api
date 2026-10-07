import {assertOwner} from '../../trips/ownership.js';
import {equalSplits,prepareExpense,validateExpenseMembers} from './tripMembers.js';
import {symbols} from './expenseBook.js';
import {syncAll} from './settlement.js';
import {generateId} from '../detail-service.js';
export const categories=[['交通','transport'],['住宿','lodging'],['餐饮','dining'],['娱乐','entertainment'],['购物','shopping'],['其他','other']];
export function saveExpense(data,tripId,input,id='',rate=null){
 const trip=data.trips.find(t=>t.id===tripId&&!t.isDeleted);if(!trip)throw Error('旅程不存在或已删除');assertOwner(data,trip);
 const previous=id&&data.expenses.find(e=>e.id===id&&e.tripId===tripId);if(id&&!previous)throw Error('账目归属不一致或已被删除');
 if(!Object.hasOwn(symbols,input.currency))throw Error('请选择有效币种');
 const amount=Number(input.amount),originalFen=Math.round(amount*100);
 if(!/^\d+(\.\d{1,2})?$/.test(String(input.amount))||amount<=0||!Number.isSafeInteger(originalFen))throw Error('请输入有效金额（最多两位小数）');
 if(!categories.some(([name])=>name===input.category))throw Error('请选择支出分类');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||!Number.isFinite(Date.parse(input.date))||new Date(input.date+'T00:00:00Z').toISOString().slice(0,10)!==input.date)throw Error('请填写有效日期');
 validateExpenseMembers(trip,input,null);
 const snapshot=input.currency==='CNY'?{rate:1,date:input.date}:rate;
 if(snapshot&&(!Number.isFinite(snapshot.rate)||snapshot.rate<=0||!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.date)))throw Error('汇率无效');
 const cnyFen=snapshot?Math.round(amount*snapshot.rate*100):null;
 if(cnyFen!==null&&(!Number.isSafeInteger(cnyFen)||cnyFen<0))throw Error('折算金额超出有效范围');
 let original=input.originalSplits;
 if(input.splitType==='equal')original=equalSplits(trip,input.participantIds,originalFen).map(x=>({memberId:x.memberId,originalAmountFen:x.amountFen}));
 if(!Array.isArray(original)||original.length!==input.participantIds.length||new Set(original.map(x=>x.memberId)).size!==original.length||original.some(x=>!x||!input.participantIds.includes(x.memberId)||!Number.isSafeInteger(x.originalAmountFen)||x.originalAmountFen<0)||original.reduce((n,x)=>n+x.originalAmountFen,0)!==originalFen)throw Error('分摊金额合计需等于账目金额');
 const splits=cnyFen===null?[]:original.map(x=>{const exact=x.originalAmountFen*cnyFen/originalFen;return {memberId:x.memberId,amountFen:Math.floor(exact),remainder:exact-Math.floor(exact),originalAmount:x.originalAmountFen/100,currency:input.currency};});
 if(cnyFen!==null){const sorted=splits.slice().sort((a,b)=>b.remainder-a.remainder);let extra=cnyFen-splits.reduce((n,x)=>n+x.amountFen,0);for(let i=0;i<extra;i++)sorted[i%sorted.length].amountFen++;}
 const record=prepareExpense(trip,{...previous,...input,id:previous?.id||generateId('e'),tripId,amount,originalAmount:amount,originalSplits:original,splits:splits.map(({remainder,...x})=>({...x,convertedAmountCNYFen:x.amountFen})),exchangeRate:snapshot?.rate??null,exchangeRateBase:'CNY',exchangeRateDate:snapshot?.date??null,convertedAmountCNY:cnyFen===null?null:cnyFen/100,expenseDate:input.date});
 if(previous)data.expenses[data.expenses.indexOf(previous)]=record;else data.expenses.unshift(record);syncAll(data);return record;
}
export function deleteExpense(data,tripId,id){const trip=data.trips.find(t=>t.id===tripId&&!t.isDeleted);if(!trip)throw Error('旅程不存在或已删除');assertOwner(data,trip);if(!data.expenses.some(e=>e.tripId===tripId&&e.id===id))throw Error('账目已不存在');data.expenses=data.expenses.filter(e=>e.tripId!==tripId||e.id!==id);syncAll(data);}
