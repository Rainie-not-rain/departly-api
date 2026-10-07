import {currentMemberId} from '../app/trip/subpages/tripMembers.js';
import {symbols,defaultCurrency} from '../app/trip/subpages/expenseBook.js';
import {categories} from '../app/trip/subpages/expense-service.js';
import {normalizeExpenseIntent} from './expense-intent.js';

const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const fen=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&/^\d+(\.\d{1,2})?$/.test(String(v))&&Number.isSafeInteger(Math.round(v*100))?Math.round(v*100):null;
export function normalizeExpenseCurrency(value,trip){const aliases={'人民币':'CNY','元':'CNY','块':'CNY','日元':'JPY','円':'JPY','美元':'USD','刀':'USD','欧元':'EUR','港币':'HKD','英镑':'GBP','韩元':'KRW','台币':'TWD','澳元':'AUD','加元':'CAD','新币':'SGD','泰铢':'THB'};const code=value==null?defaultCurrency(trip):aliases[value]||String(value).trim().toUpperCase();return Object.hasOwn(symbols,code)?code:null}
export function resolveExpenseDate(text,{today,trip}={}){
 today=today||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 if(!validDate(today))return null;if(!text||text==='今天')return today;if(text==='昨天'||text==='前天'){return new Date(Date.parse(today+'T00:00:00Z')-(text==='昨天'?1:2)*86400000).toISOString().slice(0,10)}
 if(validDate(text))return text;const m=/^(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日?$/.exec(text);if(!m)return null;
 const year=m[1]||(trip?.startDate||trip?.start||today).slice(0,4),date=`${year}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;return validDate(date)?date:null;
}
const numbers={'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10};
const countIn=text=>{const m=/(\d+|[一二两三四五六七八九十])\s*个?人/.exec(text||'');return m?(numbers[m[1]]||Number(m[1])):null};
export function resolveExpenseMembers(intent,{trip,data={},text=''}={}){
 const members=trip.members||[],issues=[],resolve=ref=>{const matches=ref==='我'?members.filter(m=>m.id===currentMemberId(data,trip)):members.filter(m=>m.name===ref);if(matches.length!==1){issues.push(matches.length?'同行成员名称有歧义，请手动选择':`未找到同行成员『${ref}』`);return null}return matches[0].id};
 const payerId=intent.payerReference?resolve(intent.payerReference):null;
 const expectedParticipantCount=countIn(text)||countIn(intent.participantReferences.join(' '));
 // “我们均摊” is an explicit all-members product rule, not a model default.
 const references=/我们\s*(均摊|平摊)/.test(text)&&!expectedParticipantCount&&intent.splitType!=='custom'&&!/只有|仅|我和|和我|参与|参加/.test(text)?['全部成员']:intent.participantReferences;
 let ids=[],unresolved=false;
 const embeddedExclusions=[];
 for(const ref of references){if(/^除了.+/.test(ref)){embeddedExclusions.push(ref.slice(2));ids.push(...members.map(m=>m.id));}else if(/^(大家|所有人|全部成员|全体成员|我们|我们均摊|我们平摊)$/.test(ref)||/^(我们)?(?:\d+|[一二两三四五六七八九十])个?人$/.test(ref)){ids.push(...members.map(m=>m.id));}else{const id=resolve(ref);if(id)ids.push(id);else unresolved=true}}
 const excluded=[...intent.excludedParticipantReferences,...embeddedExclusions].map(ref=>resolve(ref.replace(/^除了/,'')));if(excluded.some(x=>!x))unresolved=true;
 if(expectedParticipantCount&&!intent.participantReferences.length&&!excluded.length&&expectedParticipantCount===members.length)ids=members.map(m=>m.id);
 if(excluded.length&&!intent.participantReferences.length)ids=members.map(m=>m.id);
 ids=[...new Set(ids)].filter(id=>!excluded.includes(id));
 if(expectedParticipantCount&&ids.length!==expectedParticipantCount){unresolved=true;issues.push(`请选择 ${expectedParticipantCount} 位参与成员`)}
 return {payerId,participantIds:unresolved?[]:ids,expectedParticipantCount,memberIssues:issues,resolve};
}
export function buildExpenseDraft(value,{trip,data={},text='',today,id}={}){
 const intent=normalizeExpenseIntent(value),members=resolveExpenseMembers(intent,{trip,data,text});
 const originalSplits=intent.customSplitReferences.map(x=>({memberId:members.resolve(x.memberReference),originalAmountFen:fen(x.amount)}));
 if(intent.splitType==='custom'&&!members.participantIds.length&&!intent.participantReferences.length&&!members.expectedParticipantCount)members.participantIds=originalSplits.map(x=>x.memberId).filter(Boolean);
 const category=categories.some(([name])=>name===intent.category)?intent.category:intent.category==='门票'?'娱乐':'其他';
 const draft={id:id||globalThis.crypto.randomUUID(),tripId:trip.id,amount:intent.amount,currency:normalizeExpenseCurrency(intent.currency,trip),category,note:intent.note||'',expenseDate:resolveExpenseDate(intent.expenseDateText,{today,trip}),payerId:members.payerId,participantIds:members.participantIds,splitType:intent.splitType||'equal',originalSplits,expectedParticipantCount:members.expectedParticipantCount,memberIssues:members.memberIssues,unresolvedFields:[],source:'ai_natural_language',originalText:text};
 draft.unresolvedFields=validateExpenseDraft(draft,trip).unresolvedFields;return draft;
}
export function validateExpenseDraft(draft,trip){
 const unresolvedFields=[],errors=[],add=(field,msg)=>{unresolvedFields.push(field);errors.push(msg)},ids=new Set((trip?.members||[]).map(m=>m.id));
 if(!trip||trip.isDeleted||draft.tripId!==trip.id)add('tripId','旅程不存在或已变化');
 if(!['number','string'].includes(typeof draft.amount)||!/^\d+(\.\d{1,2})?$/.test(String(draft.amount))||fen(Number(draft.amount))===null||Number(draft.amount)<=0)add('amount','请填写有效金额（最多两位小数）');
 if(!Object.hasOwn(symbols,draft.currency))add('currency','请选择有效币种');
 if(!validDate(draft.expenseDate))add('expenseDate','请选择有效日期');
 if(typeof draft.payerId!=='string'||!draft.payerId||!ids.has(draft.payerId))add('payerId','请选择付款人');
 if(!Array.isArray(draft.participantIds)||!draft.participantIds.length||new Set(draft.participantIds).size!==draft.participantIds.length||draft.participantIds.some(id=>typeof id!=='string'||!id||!ids.has(id))||draft.expectedParticipantCount&&draft.participantIds.length!==draft.expectedParticipantCount)add('participantIds',draft.expectedParticipantCount?`请选择 ${draft.expectedParticipantCount} 位参与成员`:'请选择参与人');
 if(!['equal','custom'].includes(draft.splitType))add('splitType','请选择分摊方式');
 if(!categories.some(([name])=>name===draft.category))add('category','请选择支出分类');
 if(draft.splitType==='custom'){const rows=draft.originalSplits;if(!Array.isArray(rows)||rows.length!==draft.participantIds?.length||new Set(rows.map(x=>x?.memberId)).size!==rows.length||rows.some(x=>!x||!draft.participantIds?.includes(x.memberId)||!Number.isSafeInteger(x.originalAmountFen)||x.originalAmountFen<0)||rows.reduce((sum,x)=>sum+x.originalAmountFen,0)!==fen(Number(draft.amount)))add('originalSplits','分摊金额合计需等于账目金额')}
 return {valid:!errors.length,unresolvedFields,errors};
}
export function expenseDraftInput(draft){return {amount:draft.amount,currency:draft.currency,category:draft.category,note:draft.note,date:draft.expenseDate,payerId:draft.payerId,participantIds:[...draft.participantIds],splitType:draft.splitType,originalSplits:draft.splitType==='custom'?draft.originalSplits.map(x=>({...x})):undefined}}
