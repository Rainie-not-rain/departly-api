import {syncAll,currentMemberId,statusLabels,tripLabels,money} from './settlement.js';
import {isOwner,ownerId} from '../../trips/ownership.js';
import {title as tripTitle} from './expenseBook.js';
import {presentExpense} from './tripMembers.js';
const signed=fen=>(fen>0?'+':'')+money(fen);
export function settlementView(data,id){
 const copy=JSON.parse(JSON.stringify(data)),trip=copy.trips.find(t=>t.id===id&&!t.isDeleted);if(!trip)throw Error('旅程不存在或已删除');syncAll(copy);
 const plan=copy.settlementPlans[id],me=currentMemberId(copy,trip),canManage=isOwner(copy,trip);
 const members=plan.members.map(x=>({...x,paidText:money(x.paidFen),shareText:money(x.shareFen),balanceText:x.balanceFen>0?'应收 ¥'+money(x.balanceFen):x.balanceFen<0?'应付 ¥'+money(-x.balanceFen):'已平衡',netText:signed(x.balanceFen)}));
 const transfers=plan.transfers.map(x=>({...x,amountText:money(x.amountFen),statusText:statusLabels[x.status],canConfirm:canManage&&x.status!=='settled'})),pending=transfers.filter(t=>t.status!=='settled');
 const groups=[{title:'需要付给我的',rows:pending.filter(t=>t.toMemberId===me)},{title:'我需要付的',rows:pending.filter(t=>t.fromMemberId===me)},{title:'其他成员结算',rows:pending.filter(t=>t.fromMemberId!==me&&t.toMemberId!==me)}].filter(g=>g.rows.length);
 const matrix=plan.rows.map(row=>({...row,cells:members.map(m=>{const share=row.shares.find(x=>x.memberId===m.id),fen=(row.valid&&row.payerId===m.id?row.amountFen:0)-(row.valid&&share?share.amountFen:0);return {id:m.id,text:row.valid?signed(fen):'—',positive:fen>0};})}));
 return {trip,plan,managerId:ownerId(copy),canManage,members,transfers,groups,matrix,issues:plan.issues,settledTransfers:transfers.filter(t=>t.status==='settled'),title:tripTitle(trip),dateRange:trip.start.replace(/-/g,'.')+' — '+trip.end.replace(/-/g,'.'),totalText:money(plan.totalFen),expenseCount:plan.expenseCount,missing:plan.issues.length,statusText:plan.issues.length?'待完善账目':tripLabels[plan.status]};
}
export function settlementSheets(view){
 const expenses=[['日期','项目','分类','原币金额','币种','折合人民币','付款人','参与人','分摊方式','备注']];
 for(const row of view.plan.rows){const x=row.expense,shown=presentExpense(view.trip,x);expenses.push([x.expenseDate||x.date,row.title,x.category,Number(x.originalAmount??x.amount),x.currency||'CNY',row.amountFen===null?'未折算':Number(money(row.amountFen)),shown.payerName,shown.participantNames,shown.splitLabel,x.note]);}
 const transfers=[['付款方','收款方','金额','状态','结清操作人','结清时间']];
 for(const t of view.plan.transfers){const d=t.settledAt?new Date(t.settledAt):null,time=d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`:'';transfers.push([t.fromName,t.toName,Number(money(t.amountFen)),statusLabels[t.status],t.settledByUserId||'',time]);}
 if(view.issues.length)transfers.push(['账目未完善，尚未生成最终结算方案']);else if(!view.transfers.length)transfers.push(['无需结算']);
 return [{name:'账目明细',rows:expenses},{name:'结算结果',rows:transfers}];
}
