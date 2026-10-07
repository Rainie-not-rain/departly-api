import {apiError} from './response.js';

const fields=new Set(['amount','currency','category','note','expenseDateText','payerReference','participantReferences','excludedParticipantReferences','splitType','customSplitReferences','confidence']);
const invalid=()=>{throw apiError('AI_RESPONSE_INVALID','这笔账小簿没整理明白，可以再说得具体一点。',502)};
export function normalizeExpenseIntent(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!fields.has(k)))invalid();
 const string=k=>{const v=value[k];if(v==null)return null;if(typeof v!=='string'||v.length>500)invalid();return v.trim()||null};
 const refs=k=>{const v=value[k]??[];if(!Array.isArray(v)||v.length>30||v.some(x=>typeof x!=='string'||!x.trim()||x.length>100))invalid();return [...new Set(v.map(x=>x.trim()))]};
 if(value.amount!=null&&(typeof value.amount!=='number'||!Number.isFinite(value.amount)))invalid();
 if(value.splitType!=null&&!['equal','custom'].includes(value.splitType))invalid();
 const custom=value.customSplitReferences??[];
 if(!Array.isArray(custom)||custom.length>30||custom.some(x=>!x||typeof x!=='object'||Object.keys(x).some(k=>!['memberReference','amount'].includes(k))||typeof x.memberReference!=='string'||!x.memberReference.trim()||x.memberReference.length>100||typeof x.amount!=='number'||!Number.isFinite(x.amount)))invalid();
 if(value.confidence!=null&&(!value.confidence||typeof value.confidence!=='object'||Object.keys(value.confidence).some(k=>!['amount','payer','participants'].includes(k))||Object.values(value.confidence).some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>1)))invalid();
 return {amount:value.amount??null,currency:string('currency'),category:string('category'),note:string('note'),expenseDateText:string('expenseDateText'),payerReference:string('payerReference'),participantReferences:refs('participantReferences'),excludedParticipantReferences:refs('excludedParticipantReferences'),splitType:value.splitType??null,customSplitReferences:custom.map(x=>({memberReference:x.memberReference.trim(),amount:x.amount}))};
}

// Route concrete expense statements to the shared draft workflow, never to automatic saving.
export function expenseQuery(text){
 const query=String(text||'').trim();
 if(!query||/不要记账|不用记账|取消记账|先别记账|怎么|如何|怎样/.test(query))return null;
 const explicit=/(记账|记一笔|记笔|记个|记录.{0,8}(消费|支出))/.test(query);
 if(!explicit){
  if(/预算|预计|多少钱|费用多少|贵不贵|是不是|是否|付款人是谁|谁付的[？?]|[？?]/.test(query))return null;
  if(/移动|移到|挪到|删除|删掉|改到|调整.{0,6}(时间|行程)/.test(query))return null;
  const amount=/\d+(?:\.\d{1,2})?(?![\d.]|分钟|小时|点|个人|人|天|号|月|年)/.test(query);
  const expense=/(打车|车费|出租车|午饭|晚饭|早饭|早餐|午餐|晚餐|餐费|吃饭|咖啡|酒店|住宿|门票|买水|便利店|购物|消费|花了|付款|付的|支付|平摊|均摊)/.test(query);
  if(!amount||!expense)return null;
 }
 return /帮我记账/.test(query)?query:`帮我记账，${query}`;
}
