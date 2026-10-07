"use client";
import ExpenseAI from './subpages/expense-ai';
import {memberAddRequest} from '../../lib/member-add.js';
import {confirmMemberAddition} from './member-add-service';
import {expenseQuery} from '../../lib/expense-intent.js';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import type {TripData} from '../trips/trip-service';
import {DATA_KEY} from '../home-state';
// Read the existing store without triggering migration, cleanup or persistence.
function readTrips():TripData {const raw=localStorage.getItem(DATA_KEY);if(!raw)throw Error('旅程不存在或已删除');const data=JSON.parse(raw);if(!Array.isArray(data.trips))throw Error('旅程数据无效');return data;}
import {buildTripContext,suggestedQuestions} from '../../lib/trip-context.js';
import {saveAnswerFeedback} from '../../lib/copilot-experience.js';
import {proposalPreview,rebaseIndependentProposals} from '../../lib/trip-actions.js';
import {applyConfirmedTripAction,type TripActionProposal} from './trip-action-service';
import {pendingProposalContexts} from '../../lib/proposal-refinement.js';
import './copilot.css';
type Message={id?:string;role:'user'|'assistant';content:string;proposals?:TripActionProposal[];evidence?:{type:string;label:string}[];suggestions?:string[];feedback?:'up'|'down'|null;memberNames?:string[];memberStatus?:'pending'|'applied'|'dismissed';expenseText?:string;expenseSaved?:boolean;expenseSuccessMessage?:string;requestContext?:ReturnType<typeof buildTripContext>;requestHistory?:{role:'user'|'assistant';content:string}[]};
type Session={id:string;title:string;createdAt:number;messages:Message[]};
export type CopilotPageState={messages:Message[];query:string;sessions:Session[];sessionId:string};
function AnswerIcon({name}:{name:'refresh'|'copy'|'up'|'down'|'send'}){
 const thumbs=<path d="M7 10v11H3V10h4Zm0 0 5-7c1-1 3 0 2 3l-1 4h6c1.5 0 2 1 1.7 2.5l-1.3 6c-.3 1.5-1 2.5-2.4 2.5H7"/>;
 return <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{name==='refresh'?<><path d="M4 7v5h5"/><path d="M4 12a8 8 0 1 0 3-6"/></>:name==='copy'?<><path d="M9 9h11v12H9z"/><path d="M15 9V3H4v12h5"/></>:name==='send'?<><path d="M12 21V3"/><path d="m6 9 6-6 6 6"/></>:name==='down'?<g transform="translate(24 24) rotate(180)">{thumbs}</g>:thumbs}</svg>;
}
export default function Copilot({tripId,initialState,onStateChange}:{tripId:string;initialState?:CopilotPageState;onStateChange?:(state:CopilotPageState)=>void}){
 const [context,setContext]=useState<ReturnType<typeof buildTripContext>|null>(null),[messages,setMessages]=useState<Message[]>(initialState?.messages||[]),[query,setQuery]=useState(initialState?.query||''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loadError,setLoadError]=useState(''),[showTrip,setShowTrip]=useState(false);
 const [sessions,setSessions]=useState<Session[]>(initialState?.sessions||[{id:"initial",title:"新对话",createdAt:0,messages:[]}]),[sessionId,setSessionId]=useState(initialState?.sessionId||"initial");
 const drawer=useRef<HTMLDialogElement>(null),menu=useRef<HTMLButtonElement>(null);
 useEffect(()=>{setSessions(rows=>rows.map(r=>({...r,createdAt:r.createdAt||Date.now()})));},[]);
 useEffect(()=>{onStateChange?.({messages,query,sessions,sessionId});},[messages,query,sessions,sessionId,onStateChange]);
 useEffect(()=>{setSessions(rows=>rows.map(r=>r.id===sessionId?{...r,messages,title:messages.find(m=>m.role==="user")?.content.slice(0,24)||"新对话"}:r));},[messages,sessionId]);
 useEffect(()=>{if(!showTrip)return;const el=drawer.current;if(!el)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";el.showModal();return()=>{el.close();document.body.style.overflow=previous;menu.current?.focus();};},[showTrip]);
 function newSession(){if(pending.current)return;const id=crypto.randomUUID();setSessions(rows=>[{id,title:"新对话",createdAt:Date.now(),messages:[]},...rows]);setSessionId(id);setMessages([]);setQuery("");setError("");setRegenerationFailed(false);setShowTrip(false);}
 function chooseSession(row:Session){if(pending.current)return;setSessionId(row.id);setMessages(row.messages);setQuery("");setError("");setRegenerationFailed(false);setShowTrip(false);}
 const [notice,setNotice]=useState(''),[regenerationFailed,setRegenerationFailed]=useState(false),[keyboardInset,setKeyboardInset]=useState(0);
 const composer=useRef<HTMLTextAreaElement>(null);
 const pending=useRef(false),controller=useRef<AbortController|null>(null),end=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!tripId)return()=>controller.current?.abort();try{const trip=readTrips().trips.find(t=>t.id===tripId&&!t.isDeleted);if(!trip)throw Error('旅程不存在或已删除');setContext(buildTripContext(trip));}catch(e){setLoadError(e instanceof Error?e.message:'无法读取旅程');}return()=>controller.current?.abort();},[tripId]);
 useEffect(()=>{if(messages.length||busy||error)end.current?.scrollIntoView({block:'nearest'});},[messages,busy,error]);
 useEffect(()=>{const viewport=window.visualViewport;if(!viewport)return;let frame=0;const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const inset=Math.max(0,window.innerHeight-viewport.height-viewport.offsetTop);setKeyboardInset(document.activeElement===composer.current&&inset>120?inset:0);});};viewport.addEventListener('resize',update);viewport.addEventListener('scroll',update);document.addEventListener('focusin',update);document.addEventListener('focusout',update);return()=>{cancelAnimationFrame(frame);viewport.removeEventListener('resize',update);viewport.removeEventListener('scroll',update);document.removeEventListener('focusin',update);document.removeEventListener('focusout',update);};},[]);
 useEffect(()=>{if(keyboardInset)end.current?.scrollIntoView({block:'nearest'});},[keyboardInset]);
 async function copyReply(text:string){try{try{await navigator.clipboard.writeText(text);}catch{const el=document.createElement('textarea');el.value=text;el.style.position='fixed';el.style.opacity='0';document.body.appendChild(el);el.select();const ok=document.execCommand('copy');el.remove();if(!ok)throw Error();}setNotice('已复制');}catch{setNotice('复制失败，请选中回答文字复制');}}
 function feedback(id:string,value:'up'|'down'){try{const feedback=saveAnswerFeedback(localStorage,id,value);setMessages(rows=>rows.map(m=>m.id===id?{...m,feedback}:m));}catch{setNotice('反馈未能保存，请重试');}}

 function applyProposal(id:string){
  if(pending.current||!context)return;
  const proposal=messages.flatMap(m=>m.proposals||[]).find(p=>p.id===id);if(!proposal||proposal.status!=='pending')return;
  let executed=false;
  try{
   const reply=applyConfirmedTripAction(tripId,proposal);executed=true;
   const trip=readTrips().trips.find(t=>t.id===tripId&&!t.isDeleted),fresh=trip?buildTripContext(trip):context;
   setMessages(rows=>[...rows.map(m=>m.proposals?.some(p=>p.id===id)?{...m,requestContext:fresh,proposals:rebaseIndependentProposals(m.proposals,m.requestContext||context,fresh,id) as TripActionProposal[]}:m),{id:crypto.randomUUID(),role:'assistant' as const,content:reply}].slice(-10));
   if(fresh)setContext(fresh);setNotice(reply);
  }catch(e){
   if((e as {code?:string}).code==='ACTION_INVALID')setMessages(rows=>rows.map(m=>({...m,proposals:m.proposals?.map(p=>p.id===id?{...p,status:'invalid' as const}:p)})));
   setNotice(e instanceof Error?e.message:'未能保存调整，请重试');
  }finally{if(process.env.NODE_ENV==='development')console.log('[Trip Action]',{proposalId:id,type:proposal.type,validationPassed:executed,executed,tripId});}
 }

 function applyMembers(message:Message){
  if(message.memberStatus!=='pending'||!message.memberNames)return;
  try{confirmMemberAddition(tripId,message.memberNames);const trip=readTrips().trips.find(t=>t.id===tripId&&!t.isDeleted);if(trip)setContext(buildTripContext(trip));setMessages(rows=>rows.map(m=>m.id===message.id?{...m,memberStatus:'applied'}:m));setNotice('同行成员已添加');}catch(e){setNotice(e instanceof Error?e.message:'添加失败，请重试');}
 }
 function dismiss(id:string){setMessages(rows=>rows.map(m=>({...m,proposals:m.proposals?.map(p=>p.id===id?{...p,status:'dismissed' as const}:p)})));}
 async function send(value:string,retry=false,regenerate=false){
  if(pending.current||!value.trim())return;
  setRegenerationFailed(false);
  if(value.trim().length>1000){setError('问题请控制在 1000 字以内');return;}
  let current:ReturnType<typeof buildTripContext>|undefined;
  if(tripId)try{const trip=readTrips().trips.find(t=>t.id===tripId&&!t.isDeleted);if(!trip)throw Error('旅程不存在或已删除');current=buildTripContext(trip);setContext(current);}catch(e){setLoadError(e instanceof Error?e.message:'无法读取旅程');return;}
  if(tripId&&!regenerate){try{const names=memberAddRequest(value);if(names){setQuery('');setError('');setMessages(rows=>[...rows,{id:crypto.randomUUID(),role:'user' as const,content:value.trim()},{id:crypto.randomUUID(),role:'assistant' as const,content:'请确认要添加的同行成员。',memberNames:names,memberStatus:'pending' as const}].slice(-10));return;}}catch(e){setError(e instanceof Error?e.message:'请检查成员昵称');return;}}
  const expenseText=tripId&&!regenerate?expenseQuery(value):null;
  if(expenseText){
   if(expenseText.length>1000){setError('记账描述请控制在 990 字以内');return;}
   setQuery('');setError('');setMessages(rows=>[...rows,{id:crypto.randomUUID(),role:'user' as const,content:expenseText},{id:crypto.randomUUID(),role:'assistant' as const,content:'我来整理这笔消费，请核对后确认记账。',expenseText}].slice(-10));return;
  }
  const previous=regenerate?messages.at(-1):undefined;
  const next:Message[]=regenerate?messages.slice(0,-1):retry?messages:[...messages,{id:crypto.randomUUID(),role:'user' as const,content:value.trim()}].slice(-10);
  const history=regenerate&&previous?.requestHistory?previous.requestHistory:next.slice(-10).map(m=>({role:m.role,content:m.content}));
  const requestContext=current;
  pending.current=true;setBusy(true);setError('');setRegenerationFailed(false);if(!regenerate){setQuery('');setMessages(next);}
  const abort=new AbortController();controller.current=abort;const timer=setTimeout(()=>abort.abort(),45000);
  try{
   const response=await fetch('/api/ai/copilot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tripContext:requestContext||null,messages:history,pendingProposalContext:requestContext?pendingProposalContexts(next.flatMap(m=>m.proposals||[]),requestContext):[]}),signal:abort.signal});
   const result=await response.json();if(abort.signal.aborted)throw Error('request_cancelled');if(!response.ok||!result.success||typeof result.data?.reply!=='string')throw Error('request_failed');
   setMessages([...next.map(m=>({...m,proposals:m.proposals?.map(p=>p.id===result.data.supersedesProposalId?{...p,status:'superseded' as const}:p)})),{id:crypto.randomUUID(),role:'assistant',content:result.data.reply,proposals:result.data.proposals||[],evidence:result.data.evidence||[],suggestions:result.data.suggestions||[],requestContext,requestHistory:history}].slice(-10) as Message[]);
  }catch{if(controller.current===abort){setRegenerationFailed(regenerate);setError(regenerate?'重新生成失败，原回答和调整建议已保留。可以再试一次。':'小簿刚刚没想明白，再问一次试试？');}}finally{clearTimeout(timer);pending.current=false;setBusy(false);controller.current=null;}
 }
 return <div className="web-frame"><main className={`page copilot-page ${keyboardInset?"copilot-keyboard-open":""}`} style={{paddingBottom:`calc(194 * var(--rpx) + env(safe-area-inset-bottom) + ${keyboardInset}px)`}}><header className="copilot-header"><Link href={tripId?`/trip/${encodeURIComponent(tripId)}`:"/"} aria-label="返回">‹</Link><button ref={menu} className="copilot-menu" aria-label="会话管理" aria-expanded={showTrip} onClick={()=>setShowTrip(!showTrip)}><span/><span/><span/></button></header>{showTrip&&<dialog ref={drawer} className="copilot-drawer-dialog" aria-labelledby="copilot-drawer-title" onCancel={e=>{e.preventDefault();setShowTrip(false);}} onClick={e=>{if(e.target===e.currentTarget)setShowTrip(false);}}><aside className="copilot-drawer"><div className="copilot-drawer-heading"><h2 id="copilot-drawer-title">小簿会话</h2><button autoFocus aria-label="关闭会话管理" onClick={()=>setShowTrip(false)}>×</button></div><button className="copilot-new-session" disabled={busy} onClick={newSession}><span aria-hidden="true">＋</span>新建会话</button><div className="copilot-session-list">{["今天","更早"].map(group=>{const rows=sessions.filter(row=>(new Date(row.createdAt).toDateString()===new Date().toDateString()?"今天":"更早")===group);return rows.length>0&&<section key={group}><p className="copilot-session-group">{group}</p>{rows.map(row=><button key={row.id} className={`copilot-session ${row.id===sessionId?"selected":""}`} disabled={busy} aria-current={row.id===sessionId?"true":undefined} onClick={()=>chooseSession(row)}><span>{row.title}</span><time>{group} {new Date(row.createdAt).toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})}</time></button>)}</section>;})}</div></aside></dialog>}

 {loadError?<p role="alert">{loadError}</p>:tripId&&!context?<p>读取旅程中…</p>:<><section className="copilot-messages" aria-label="对话" aria-live="polite">{!messages.length&&<div className="copilot-welcome"><img src="/images/departly/xiaobu.png" alt="小簿"/><h2>我是小簿</h2><p className="muted">今天想怎么走？</p></div>}{messages.map((m,i)=><div key={m.id||i}><div className={`copilot-bubble ${m.role}`}><span className="muted">{m.role==='user'?'我':'小簿'}</span><p>{m.content}</p></div>{m.memberNames&&<div className="copilot-proposal"><strong>添加同行成员</strong><p>{m.memberNames.join('、')}</p>{m.memberStatus==='pending'?<div className="copilot-proposal-actions"><button className="secondary" disabled={busy} onClick={()=>setMessages(rows=>rows.map(row=>row.id===m.id?{...row,memberStatus:'dismissed'}:row))}>暂不添加</button><button className="primary" disabled={busy} onClick={()=>applyMembers(m)}>确认添加</button></div>:<p role="status">{m.memberStatus==='applied'?'已添加':'已取消添加'}</p>}</div>}{m.expenseText&&(m.expenseSaved?<p role="status">{m.expenseSuccessMessage}</p>:<ExpenseAI key={m.id} tripId={tripId} initialText={m.expenseText} embedded onSaved={(message:string)=>setMessages(rows=>rows.map(row=>row.id===m.id?{...row,expenseSaved:true,expenseSuccessMessage:message}:row))}/>)}{m.proposals?.map(p=>{let preview;try{preview=proposalPreview({...p,status:'pending'},m.requestContext||context);}catch{return null;}return <div className="copilot-proposal" key={p.id}><strong>{preview.title}</strong><h3>{preview.name}</h3><p>{preview.before}</p>{p.type==='move_item'&&<span>↓</span>}<p>{preview.after}</p>{p.type==='add_item'&&<p className="muted">地点待确认 · 约 {p.durationMinutes} 分钟</p>}{preview.warnings.map(w=><p className="copilot-warning" key={w}>{w}</p>)}{p.status==='pending'?<div className="copilot-proposal-actions"><button className="secondary" disabled={busy} onClick={()=>dismiss(p.id)}>{p.type==='remove_item'?'保留':'暂不调整'}</button><button className="primary" disabled={busy} onClick={()=>applyProposal(p.id)}>{preview.warnings.length?'仍然应用':p.type==='remove_item'?'确认移除':p.type==='add_item'?'添加到行程':'应用调整'}</button></div>:<p role="status">{p.status==='applied'?'✓ 已应用':p.status==='dismissed'?'已保留原行程':p.status==='superseded'?'已更新建议':'行程已经发生变化，这条调整建议失效了。'}</p>}</div>;})}{!!m.evidence?.length&&<details className="copilot-evidence"><summary><span className="copilot-evidence-star" aria-hidden="true">✦</span><span>建议依据</span><span className="copilot-evidence-chevron" aria-hidden="true"/></summary><ul>{m.evidence.map((e,index)=><li key={index}>{e.label}</li>)}</ul></details>}{m.role==='assistant'&&m.requestHistory&&<div className="copilot-answer-tools">{i===messages.length-1&&<button disabled={busy||m.proposals?.some(p=>p.status==='applied')} onClick={()=>send(m.requestHistory?.at(-1)?.content||'',false,true)}><AnswerIcon name="refresh"/>重新生成</button>}<div><button aria-label="复制回答" onClick={()=>copyReply(m.content)}><AnswerIcon name="copy"/></button><button aria-label="有帮助" aria-pressed={m.feedback==='up'} onClick={()=>feedback(m.id!,'up')}><AnswerIcon name="up"/></button><button aria-label="没有帮助" aria-pressed={m.feedback==='down'} onClick={()=>feedback(m.id!,'down')}><AnswerIcon name="down"/></button></div></div>}{m.role==='assistant'&&i===messages.length-1&&!!m.suggestions?.length&&<div className="copilot-follow-ups"><strong>猜你还需要</strong>{m.suggestions.map(q=><button key={q} disabled={busy} onClick={()=>send(q)}>{q}</button>)}</div>}</div>)}{busy&&<div className="copilot-processing" role="status"><strong>小簿正在整理回答…</strong><p>需要一点时间，请稍候。</p></div>}{error&&<div role="alert"><p>{error}</p>{regenerationFailed?<button className="secondary" disabled={busy} onClick={()=>send(messages.at(-1)?.requestHistory?.at(-1)?.content||'',false,true)}>重新生成</button>:messages.at(-1)?.role==='user'&&<button className="secondary" disabled={busy} onClick={()=>send(messages.at(-1)!.content,true)}>重试</button>}</div>}<div ref={end}/></section>
 <div className={`copilot-questions ${messages.length?"has-messages":""}`}>{(context?suggestedQuestions(context):["帮我列一份出发前准备清单","周末旅行怎么安排？","旅行预算怎么规划？","带孩子旅行要注意什么？"]).map((q:string,index:number)=><button className="copilot-question" key={q} disabled={busy} onClick={()=>send(q)}><img src={`/images/icons/${["quick-checkin.svg","expense-dining.svg","assistant-bag.svg","quick-map.svg"][index]}`} alt=""/><span>{q}</span><span aria-hidden="true">›</span></button>)}</div>
 <p className="copilot-notice" role="status">{notice}{!tripId&&messages.length>0&&<Link href="/trip/create">创建旅程</Link>}</p><form className="copilot-input" style={keyboardInset?{bottom:keyboardInset+12}:undefined} onSubmit={e=>{e.preventDefault();send(query);}}><textarea ref={composer} aria-label="问问小簿" placeholder="问路线、时间、行程安排…" maxLength={1000} value={query} disabled={busy} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send(query);}}}/><button className="primary" aria-label="发送" disabled={busy||!query.trim()}><AnswerIcon name="send"/></button></form></>}
 </main></div>;
}

