import {currentMemberId,validateExpenseMembers} from './tripMembers.js'
import {symbols,cnyAmount} from './expenseBook.js'
import {assertOwner,ownerId} from '../../trips/ownership.js'
const statusLabels={pending:'待结算',settled:'已结清 ✓'}
const tripLabels={pending:'待结算',settled:'已结清',no_settlement:'无需结算'}
const money=fen=>(fen/100).toFixed(2)
function invalid(message){const error=new Error(message);error.name='SettlementValidationError';throw error}
// Validate all financial inputs before any member totals are changed.
function validateExpenseForSettlement(expense,trip){
  const original=Number(expense.originalAmount??expense.amount);
  if(!Number.isFinite(original)||original<=0||!Number.isSafeInteger(Math.round(original*100)))invalid('原币金额无效');
  if(!Object.hasOwn(symbols,expense.currency||'CNY'))invalid('币种无效');
  const amount=cnyAmount(expense),fen=Math.round(amount*100);
  if(amount===null||!Number.isFinite(amount)||!Number.isSafeInteger(fen)||fen<0)invalid('缺少有效的人民币折算金额');
  validateExpenseMembers(trip,expense,fen);
  return {fen,shares:expense.splits.map(x=>({...x}))};
}
function build(data,trip){
  const members=new Map((trip.members||[]).map(x=>[x.id,{id:x.id,name:x.name,avatar:x.avatar,paidFen:0,shareFen:0,balanceFen:0}])),issues=[],rows=[];
  const expenses=(data.expenses||[]).filter(x=>x.tripId===trip.id).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  for(const expense of expenses){
    const row={id:expense.id,expense,title:expense.note||expense.category||'支出',amountFen:null,payerId:expense.payerId||null,shares:[],valid:false};rows.push(row);
    try{
      const {fen,shares}=validateExpenseForSettlement(expense,trip);
      row.amountFen=fen;row.shares=shares;row.valid=true;
      members.get(expense.payerId).paidFen+=fen;
      for(const share of shares)members.get(share.memberId).shareFen+=share.amountFen;
    }catch(error){if(!['SettlementValidationError','MemberValidationError'].includes(error.name))throw error;row.error=error.message;issues.push({id:expense.id,title:row.title,reason:error.message})}
  }
  const memberRows=[...members.values()].map(x=>({...x,balanceFen:x.paidFen-x.shareFen})).sort((a,b)=>a.id.localeCompare(b.id));
  const signature=JSON.stringify(rows.map(x=>[x.id,x.amountFen,x.payerId,x.shares,x.valid,x.valid?'':x.error]));const transfers=[];
  if(!issues.length){
    const creditors=memberRows.filter(x=>x.balanceFen>0).map(x=>({...x,remaining:x.balanceFen})).sort((a,b)=>b.remaining-a.remaining||a.id.localeCompare(b.id));
    const debtors=memberRows.filter(x=>x.balanceFen<0).map(x=>({...x,remaining:-x.balanceFen})).sort((a,b)=>b.remaining-a.remaining||a.id.localeCompare(b.id));
    let ci=0,di=0;while(ci<creditors.length&&di<debtors.length){const to=creditors[ci],from=debtors[di],amountFen=Math.min(to.remaining,from.remaining);transfers.push({id:trip.id+':'+encodeURIComponent(from.id)+':'+encodeURIComponent(to.id),tripId:trip.id,fromMemberId:from.id,fromName:from.name,fromAvatar:from.avatar,toMemberId:to.id,toName:to.name,toAvatar:to.avatar,amountFen,settledByUserId:null,settledAt:null,status:'pending'});to.remaining-=amountFen;from.remaining-=amountFen;if(!to.remaining)ci++;if(!from.remaining)di++}
  }
  return {tripId:trip.id,signature,members:memberRows,rows,issues,transfers,totalFen:rows.filter(x=>x.valid).reduce((sum,x)=>sum+x.amountFen,0),expenseCount:expenses.length}
}
function transferStatus(t){const legacy='payerConfirmed' in t||'receiverConfirmed' in t;return (legacy?t.payerConfirmed&&t.receiverConfirmed:t.status==='settled')?'settled':'pending'}
function tripStatus(transfers){return !transfers.length?'no_settlement':transfers.every(x=>x.status==='settled')?'settled':'pending'}
function syncAll(data){
  let changed=false;if(!data.settlementPlans){data.settlementPlans={};changed=true}
  for(const trip of data.trips||[]){
    const fresh=build(data,trip),old=data.settlementPlans[trip.id];
    if(old&&old.signature===fresh.signature){fresh.transfers=fresh.transfers.map(t=>{const previous=old.transfers.find(x=>x.id===t.id&&x.amountFen===t.amountFen);return previous?{...t,status:transferStatus(previous),settledByUserId:transferStatus(previous)==='settled'?(previous.settledByUserId||trip.ownerUserId):null,settledAt:transferStatus(previous)==='settled'?(previous.settledAt||previous.receiverConfirmedAt||previous.payerConfirmedAt||old.generatedAt):null}:t});fresh.revision=old.revision;fresh.generatedAt=old.generatedAt}
    else{
      fresh.revision=(old&&old.revision||0)+1;fresh.generatedAt=new Date().toISOString();
      if(old&&old.transfers.length){(data.settlementHistory||(data.settlementHistory=[])).push({tripId:trip.id,revision:old.revision,generatedAt:old.generatedAt,invalidatedAt:fresh.generatedAt,transfers:old.transfers});}
    }
    fresh.transfers.forEach(t=>t.status=transferStatus(t));fresh.status=fresh.issues.length?'pending':tripStatus(fresh.transfers);
    // rows 中保留原账目，供透视与导出使用。签名只包括影响结算的内容。
    if(JSON.stringify(old)!==JSON.stringify(fresh)){data.settlementPlans[trip.id]=fresh;changed=true}
    if(trip.settlementStatus!==fresh.status){trip.settlementStatus=fresh.status;changed=true}
  }
  return changed
}
function confirmTransfer(data,tripId,id,signature,userId){
  const trip=(data.trips||[]).find(x=>x.id===tripId&&!x.isDeleted);if(!trip)throw new Error('旅程不存在或已删除');syncAll(data);const plan=data.settlementPlans[tripId];
  assertOwner(data,trip);if(ownerId(data)!==userId)throw new Error('当前管理员身份已变化');
  if(!plan||plan.signature!==signature||plan.issues.length)throw new Error('账目已变化，请核对新的结算方案');
  const transfer=plan.transfers.find(x=>x.id===id);if(!transfer)throw new Error('转账关系已失效');
  if(transfer.status!=='settled'){transfer.status='settled';transfer.settledByUserId=userId;transfer.settledAt=Date.now()}
  plan.status=tripStatus(plan.transfers);trip.settlementStatus=plan.status;return transfer
}
export default {build,syncAll,confirmTransfer,currentMemberId,transferStatus,tripStatus,statusLabels,tripLabels,money}

export {build,syncAll,confirmTransfer,currentMemberId,transferStatus,tripStatus,statusLabels,tripLabels,money};
