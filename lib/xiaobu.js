import {apiError} from './response.js'
import {basePrompt,workflows,getXiaobuIntent} from './xiaobu-workflows.js'
export {getXiaobuIntent} from './xiaobu-workflows.js'
const fail=()=>apiError('INVALID_INPUT','请补充有效的问题和旅程信息')
const invalid=(field='response_schema')=>Object.assign(apiError('AI_RESPONSE_INVALID','这次没有整理成功，请重新试试',502),{validationReason:field})
const text=(value,max=100)=>typeof value==='string'?value.trim().slice(0,max):''
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)
const index=value=>Number.isInteger(value)&&value>0&&value<=365
function item(value){if(!object(value)||!text(value.id)||!text(value.placeName))throw fail();return {id:text(value.id,120),placeName:text(value.placeName,80),startTime:text(value.startTime,5),endTime:text(value.endTime,5),status:text(value.status,20),checkedIn:value.checkedIn===true,...(value.protected===true?{protected:true}:{})}}
function day(value,detail=false){if(!object(value)||!index(value.dayIndex))throw fail();const out={id:text(value.id,120),dayIndex:value.dayIndex,date:text(value.date,10),city:text(value.city,60)};if(detail){if(!Array.isArray(value.items)||value.items.length>40)throw fail();out.items=value.items.map(item);if(Number.isInteger(value.omittedItemCount)&&value.omittedItemCount>0)out.omittedItemCount=value.omittedItemCount;if(new Set(out.items.map(x=>x.id)).size!==out.items.length)throw fail()}else{const places=value.places||[];if(typeof places==='string'){out.places=text(places,100)}else{if(!Array.isArray(places)||places.length>40||places.some(x=>typeof x!=='string'))throw fail();out.places=places.map(x=>text(x,80))}if(Number.isInteger(value.itemCount)&&value.itemCount>=0)out.itemCount=Math.min(value.itemCount,100)}return out}
export function validateXiaobuInput(raw){
 if(typeof raw==='string'){try{raw=JSON.parse(raw)}catch{throw fail()}}
 if(!object(raw)||typeof raw.message!=='string'||!raw.message.trim()||raw.message.length>1000||!object(raw.tripContext)||!object(raw.contextScope))throw fail()
 const scope=raw.contextScope;if(!['trip','day'].includes(scope.type)||scope.type==='day'&&!index(scope.dayIndex))throw fail()
 const source=raw.tripContext;if(!text(source.tripId)||!text(source.name))throw fail()
 const destination=source.destination||{};if(!object(destination))throw fail()
 let preferences=[];if(Array.isArray(source.preferences)){if(source.preferences.length>10||source.preferences.some(x=>typeof x!=='string'))throw fail();preferences=source.preferences.map(x=>text(x,60))}else if(object(source.preferences)){preferences={companionType:text(source.preferences.companionType,30),styles:Array.isArray(source.preferences.styles)?source.preferences.styles.slice(0,5).map(x=>text(x,30)):[],pace:text(source.preferences.pace,30),startTimePreference:text(source.preferences.startTimePreference,20),endTimePreference:text(source.preferences.endTimePreference,20),notes:text(source.preferences.notes,160)}}
 const tripContext={tripId:text(source.tripId,120),name:text(source.name),destination:{country:text(destination.country,60),city:text(destination.city,60)},startDate:text(source.startDate,10),endDate:text(source.endDate,10),preferences,pace:text(source.pace,30),companions:typeof source.companions==='number'?Math.max(0,Math.min(50,Math.floor(source.companions))):text(source.companions,100),companionCount:Number.isInteger(source.companionCount)?Math.max(0,Math.min(50,source.companionCount)):0}
 if(scope.type==='trip'||Array.isArray(source.days)){if(!Array.isArray(source.days)||source.days.length>60)throw fail();tripContext.days=source.days.map(x=>day(x));if(Number.isInteger(source.omittedDayCount)&&source.omittedDayCount>0)tripContext.omittedDayCount=source.omittedDayCount;if(new Set(tripContext.days.map(x=>x.dayIndex)).size!==tripContext.days.length)throw fail()}
 if(source.actionDays!=null){if(!Array.isArray(source.actionDays)||source.actionDays.length>4)throw fail();tripContext.actionDays=source.actionDays.map(d=>day(d,true));if(new Set(tripContext.actionDays.map(d=>d.id)).size!==tripContext.actionDays.length)throw fail()}
 if(Number.isInteger(source.omittedRelatedDayCount)&&source.omittedRelatedDayCount>0)tripContext.omittedRelatedDayCount=source.omittedRelatedDayCount
 if(object(source.expenseContext)){const e=source.expenseContext;if(!Array.isArray(e.members)||e.members.length>30)throw fail();tripContext.expenseContext={members:e.members.map(m=>({id:text(m.id,120),name:text(m.name,20)})),currentMemberId:text(e.currentMemberId,120),currency:text(e.currency,3),currentDate:text(e.currentDate,10)}}
 if(object(source.expenseSummary))tripContext.expenseSummary={count:Number.isInteger(source.expenseSummary.count)?source.expenseSummary.count:0,convertedAmountCNY:Number.isFinite(source.expenseSummary.convertedAmountCNY)?source.expenseSummary.convertedAmountCNY:null,unconvertedCount:Number.isInteger(source.expenseSummary.unconvertedCount)?source.expenseSummary.unconvertedCount:0}
 const dayContext=scope.type==='day'?day(raw.dayContext,true):null;if(dayContext&&dayContext.dayIndex!==scope.dayIndex)throw fail()
 const contextScope={type:scope.type,dayIndex:scope.type==='day'?scope.dayIndex:null}
 if(JSON.stringify({tripContext,contextScope,dayContext}).length>2500)throw apiError('INVALID_INPUT','当前旅程信息较多，请选择具体一天再提问')
 const history=raw.conversationHistory||[];if(!Array.isArray(history)||history.length>100)throw fail()
 const conversationHistory=history.slice(-8).map(x=>{if(!object(x)||!['user','assistant'].includes(x.role)||typeof x.content!=='string')throw fail();return {role:x.role,content:text(x.content,800)}}).filter(x=>x.content)
 return {message:raw.message.trim(),tripContext,contextScope,dayContext,conversationHistory}
}
function normalizeLegacyResponse(value,input){
 if(!object(value)||typeof value.answer!=='string'||!value.answer.trim()||value.answer.length>800||value.summary!=null&&typeof value.summary!=='string')throw invalid()
 const list=(key,max,length)=>{if(!Array.isArray(value[key])||value[key].length>max||value[key].some(x=>typeof x!=='string'||!x.trim()||x.length>length))throw invalid(key);return value[key].map(x=>x.trim())}
 const reasoningSummary=list('reasoningSummary',4,60),followUps=list('followUps',3,80)
 if(!Array.isArray(value.actions)||value.actions.length>3)throw invalid('actions')
 const knownDays=input.dayContext?[input.dayContext]:input.tripContext.days||[]
 const actions=value.actions.map(action=>{
  if(!object(action)||!['suggest','replace_day_plan','add_itinerary_item','create_day'].includes(action.type)||!text(action.label)||!object(action.payload))throw invalid('action_type_label_payload')
  const out={type:action.type,label:text(action.label,40),payload:{}};if(action.type==='suggest')return out
  const payload=action.payload
  if(action.type==='create_day'){
   const date=payload.date,start=input.tripContext.startDate,end=input.tripContext.endDate
   if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!start||!end||date<start||date>end||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||(input.tripContext.days||[]).some(d=>d.date===date)||(input.tripContext.actionDays||[]).some(d=>d.date===date)||input.dayContext?.date===date||!Array.isArray(payload.items)||payload.items.length>5)throw invalid('create_day_date_or_items')
   out.payload={date,items:payload.items.map(i=>{if(!object(i)||!text(i.placeName)||i.placeName.length>80||i.suggestedTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(i.suggestedTime))throw invalid('create_day_item');return {placeName:i.placeName.trim(),suggestedTime:i.suggestedTime||'',reason:text(i.reason,160)}})};return out
  }
  const known=knownDays.find(x=>x.dayIndex===payload.dayIndex);if(!known)throw invalid('action_day_not_in_context')
  if(action.type==='replace_day_plan'){
   if(known.omittedItemCount>0||!Array.isArray(known.items)||!Array.isArray(payload.itemIds)||!payload.itemIds.length||payload.itemIds.length>known.items.length||new Set(payload.itemIds).size!==payload.itemIds.length||payload.itemIds.some(id=>!known.items.some(x=>x.id===id)))throw invalid()
   if(known.items.some(x=>(x.checkedIn||x.status==='completed')&&!payload.itemIds.includes(x.id)))throw invalid('replace_day_protected_item')
   out.payload={dayIndex:payload.dayIndex,itemIds:payload.itemIds}
  }else{
   if(typeof payload.placeName!=='string'||!payload.placeName.trim()||payload.placeName.length>80||payload.suggestedTime!=null&&payload.suggestedTime!==''&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(payload.suggestedTime)||payload.reason!=null&&typeof payload.reason!=='string')throw invalid()
   out.payload={dayIndex:payload.dayIndex,placeName:payload.placeName.trim(),suggestedTime:payload.suggestedTime||'',reason:text(payload.reason,160)}
  }
  return out
 })
 return {answer:value.answer.trim(),summary:text(value.summary,120)||null,reasoningSummary,actions,followUps}
}

const validTime=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v)
function normalizeAction(action,input){
 if(!object(action))throw invalid('action_object')
 if(!['itinerary_action','expense_create'].includes(action.type)){const out=normalizeLegacyResponse({answer:'校验',summary:null,reasoningSummary:[],followUps:[],actions:[action]},input).actions[0];return {...out,requiresConfirmation:out.type!=='suggest'}}
 if(action.requiresConfirmation!==true)throw invalid('action_confirmation')
 if(action.type==='expense_create'){
  const p=action.payload,e=input.tripContext.expenseContext,ids=new Set((e?.members||[]).map(m=>m.id))
  if(!object(p)||!Number.isFinite(p.amount)||p.amount<=0||!Number.isSafeInteger(Math.round(p.amount*100))||Math.abs(p.amount*100-Math.round(p.amount*100))>0.00001||!['CNY','USD','EUR','GBP','JPY','KRW','HKD','TWD','AUD','CAD','SGD','THB'].includes(p.currency)||!['交通','住宿','餐饮','娱乐','购物','其他'].includes(p.category)||!text(p.description,100)||!ids.has(p.payerId)||!Array.isArray(p.participantIds)||!p.participantIds.length||new Set(p.participantIds).size!==p.participantIds.length||p.participantIds.some(id=>!ids.has(id))||p.splitType!=='equal'||!/^\d{4}-\d{2}-\d{2}$/.test(p.expenseDate||'')||!Number.isFinite(Date.parse(p.expenseDate+'T00:00:00Z'))||new Date(p.expenseDate+'T00:00:00Z').toISOString().slice(0,10)!==p.expenseDate)throw invalid('expense_draft')
  return {type:action.type,label:'确认记账',requiresConfirmation:true,payload:{amount:p.amount,currency:p.currency,category:p.category,description:text(p.description,100),payerId:p.payerId,participantIds:p.participantIds,splitType:'equal',expenseDate:p.expenseDate,relatedPlace:text(p.relatedPlace,80)}}
 }
 const days=input.tripContext.actionDays||[],findItem=id=>days.flatMap(d=>d.items).find(i=>i.id===id)
 if(!Array.isArray(action.operations)||!action.operations.length||action.operations.length>8)throw invalid('itinerary_operations')
 const operations=action.operations.map(op=>{
  if(!object(op)||!['add','delete','move','reorder','update_time'].includes(op.operation))throw invalid('itinerary_operation')
  const out={operation:op.operation},d=days.find(d=>d.id===op.dayId),i=findItem(op.itemId)
  if(['add','move','reorder'].includes(op.operation)){if(!d)throw invalid('itinerary_day');out.dayId=d.id}
  if(['delete','move','update_time'].includes(op.operation)){if(!i)throw invalid('itinerary_item');if(['delete','move'].includes(op.operation)&&(i.protected||i.checkedIn||i.status==='completed'))throw invalid('itinerary_protected');out.itemId=i.id}
  if(op.operation==='add'){if(!text(op.placeName)||op.placeName.length>80)throw invalid('itinerary_place');out.placeName=op.placeName.trim();out.poiVerified=false}
  if(op.operation==='reorder'){if(d.omittedItemCount||!Array.isArray(op.itemIds)||op.itemIds.length!==d.items.length||new Set(op.itemIds).size!==d.items.length||op.itemIds.some(id=>!d.items.some(i=>i.id===id)))throw invalid('itinerary_order');out.itemIds=op.itemIds}
  if(op.operation==='update_time'||op.startTime!=null){if(!validTime(op.startTime))throw invalid('itinerary_time');out.startTime=op.startTime}
  if(op.endTime!=null){if(!validTime(op.startTime)||!validTime(op.endTime)||op.endTime<op.startTime)throw invalid('itinerary_time');out.endTime=op.endTime}
  return out
 })
 return {type:'itinerary_action',label:'确认调整行程',requiresConfirmation:true,operations}
}
export function normalizeXiaobuResponse(value,input){
 if(!object(value)||typeof value.answer!=='string'||!value.answer.trim()||value.answer.length>800)throw invalid('answer')
 const scene=getXiaobuIntent(input.message,input.conversationHistory),list=(key,max,len)=>{const v=key==='reasoningSummary'?value[key]:(value[key]??[]);if(!Array.isArray(v)||v.length>max||v.some(x=>typeof x!=='string'||!x.trim()||x.length>len))throw invalid(key);return v.map(x=>x.trim())}
 const reasoningSummary=list('reasoningSummary',4,60),followUps=list('followUps',3,80)
 let action=null,actionValidationReason=null
 try{const candidates=value.action!=null?[value.action]:(value.actions??[]);if(!Array.isArray(candidates)||candidates.length>3)throw invalid('actions');if(candidates.length){const proposed=normalizeAction(candidates[0],input);if(['itinerary_action','replace_day_plan','add_itinerary_item','create_day'].includes(proposed.type)&&scene!=='itinerary_modify')throw invalid('scene_action');if(proposed.type==='expense_create'&&scene!=='expense_record')throw invalid('scene_action');action=proposed}}
 catch(error){if(error.code!=='AI_RESPONSE_INVALID')throw error;actionValidationReason=error.validationReason||'action_schema'}
 if(!action&&!actionValidationReason&&scene==='itinerary_modify'){
 const latestAssistant=input.conversationHistory.slice(-8).reverse().find(m=>m.role==='assistant'),isAddFollowUp=/确认(?:写入|添加|新增)/.test(input.message)||/新增(?:行程)?节点|添加.*(?:行程|节点)/.test(latestAssistant?.content||'');
 const query=isAddFollowUp?'':getXiaobuIntent(input.message)==='itinerary_modify'?input.message:input.conversationHistory.slice(-8).reverse().find(m=>m.role==='user'&&getXiaobuIntent(m.content)==='itinerary_modify')?.content||'';
 const times=query.match(/(?:[01]?\d|2[0-3]):[0-5]\d/g)||[],matches=(input.tripContext.actionDays||[]).flatMap(d=>d.items.map(i=>({...i,date:d.date}))).filter(i=>i.placeName&&query.includes(i.placeName));
 if(times.length===2&&matches.length===1&&/改|调整|修改/.test(query)){const startTime=times[0].padStart(5,'0'),endTime=times[1].padStart(5,'0'),date=query.match(/(\d{1,2})月(\d{1,2})日/),target=matches[0];if(endTime>=startTime&&(!date||target.date?.slice(5)===date[1].padStart(2,'0')+'-'+date[2].padStart(2,'0')))action=normalizeAction({type:'itinerary_action',requiresConfirmation:true,operations:[{operation:'update_time',itemId:target.id,startTime,endTime}]},input)}
 }
 return {answer:value.answer.trim(),scene,summary:text(value.summary,120)||null,reasoningSummary,action,actions:action?[action]:[],followUps,...(!action&&scene==='itinerary_modify'?{actionNotice:'尚未生成可执行的修改，本次没有写入。请明确日期、地点和操作，再点击实际确认按钮。'}:{}),...(actionValidationReason?{actionValidationReason}:{})}
}
function compactContext(input,scene){
 const source=input.tripContext,tripContext={name:source.name,destination:source.destination},d=input.dayContext
 if(scene==='expense_record')return {tripContext:{tripId:source.tripId,name:source.name,...source.expenseContext},message:input.message}
 if(['place_guide','local_recommendation','itinerary_optimize','trip_prepare'].includes(scene)){tripContext.preferences=source.preferences;tripContext.pace=source.pace}
 if(['itinerary_modify','trip_prepare','trip_review'].includes(scene)){tripContext.startDate=source.startDate;tripContext.endDate=source.endDate}
 if(source.days){tripContext.days=source.days.map(d=>({dayIndex:d.dayIndex,date:d.date,places:d.places}));if(source.omittedDayCount)tripContext.omittedDayCount=source.omittedDayCount}
 if(scene==='itinerary_modify'){tripContext.actionDays=source.actionDays||[];tripContext.omittedRelatedDayCount=source.omittedRelatedDayCount}
 if(scene==='trip_review'){tripContext.completedDays=source.actionDays?.map(d=>({dayIndex:d.dayIndex,city:d.city,places:d.items.filter(i=>i.status==='completed'||i.checkedIn).map(i=>i.placeName),omittedItemCount:d.omittedItemCount}));tripContext.expenseSummary=source.expenseSummary;tripContext.omittedRelatedDayCount=source.omittedRelatedDayCount}
 const dayContext=d?{dayIndex:d.dayIndex,date:d.date,city:d.city,omittedItemCount:d.omittedItemCount,items:d.items.map(i=>({placeName:i.placeName,startTime:i.startTime,endTime:i.endTime,status:i.status,checkedIn:i.checkedIn}))}:null
 if(['trip_qa','place_guide','local_recommendation','itinerary_optimize'].includes(scene)&&source.actionDays){tripContext.omittedRelatedDayCount=source.omittedRelatedDayCount;tripContext.relatedDays=source.actionDays.map(d=>({dayIndex:d.dayIndex,date:d.date,city:d.city,omittedItemCount:d.omittedItemCount,items:d.items.map(({id,...i})=>i)}))}
 return {tripContext,contextScope:input.contextScope,dayContext,message:input.message}
}
export function buildXiaobuPrompt(input){const scene=getXiaobuIntent(input.message,input.conversationHistory),history=input.conversationHistory.slice(-4).map(m=>({role:m.role,content:m.content.slice(0,500)}));return [{role:'system',content:basePrompt+'\nscene='+scene+'\n'+workflows[scene]},...history,{role:'user',content:JSON.stringify(compactContext(input,scene))}]}
