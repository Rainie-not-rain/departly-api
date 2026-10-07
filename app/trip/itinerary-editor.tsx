"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Xiaobu from "../components/xiaobu";
import ConfirmationDialog from "../components/confirmation-dialog";
import { writeTrips } from "../trips/trip-service";
import { addDraftDay, removeDraftDay, removeDraftNode, commitDraft, createTrip, DRAFT_KEY } from "./detail-service.js";
import { DayTabs, ItineraryTimeline, type ItineraryDay, type ItineraryNode } from "./detail-components";
import { readDraft, saveDraft, type Draft } from "./draft-storage";
import {generatePlan,planningRequestFromDraft,PLANNING_ERROR} from "./ai-planning.js";
import {generateImport,importRequestFromDraft,IMPORT_ERROR} from "./ai-import.js";
import PlanningLoading from "./planning-loading";
import "./detail.css";
import "./editor.css";

export default function ItineraryEditor({ tripId, initialDay }: { tripId?: string; initialDay: number }) {
  const router=useRouter(),base=tripId?`/trip/${encodeURIComponent(tripId)}`:"/trip/create",editorBase=tripId?`${base}/edit`:"/trip/create/draft";
  const [draft,setDraft]=useState<Draft|null>(null),[day,setDay]=useState(initialDay),[error,setError]=useState("");
  const [removing,setRemoving]=useState<{kind:"day"|"node";id:string;title:string;content:string}|null>(null);
  const [sourceStage,setSourceStage]=useState("parsing");
  const [generating,setGenerating]=useState(false),[regenerateConfirm,setRegenerateConfirm]=useState(false);
  const basicRef=useRef<HTMLDivElement>(null);
  const controller=useRef<AbortController|null>(null),generatingRef=useRef(false);
  useEffect(()=>()=>{controller.current?.abort();controller.current=null;},[]);
  useEffect(()=>{try{const next=readDraft(tripId);setDraft(next);setDay(Math.max(0,Math.min(initialDay,next.days.length-1)));}catch(e){setError(e instanceof Error?e.message:"无法编辑");}},[tripId,initialDay]);
  function failure(e:unknown){const message=e instanceof Error?e.message:"保存失败";setError(message);const key=/名称/.test(message)?"name":/国家/.test(message)?"country":/城市|目的地/.test(message)?"city":null;requestAnimationFrame(()=>{const target=key?basicRef.current?.querySelector<HTMLElement>(`[data-field="${key}"]`):null;target?.scrollIntoView({block:"center",behavior:"smooth"});target?.focus({preventScroll:true});});}
  function cancelRegenerate(){controller.current?.abort();controller.current=null;generatingRef.current=false;setGenerating(false);setError("");}
  function change(mutator:(next:Draft)=>void,index=day){try{const next=readDraft(tripId);mutator(next);next.isDirty=true;setDraft(saveDraft(next));setDay(Math.max(0,Math.min(index,next.days.length-1)));setError("");}catch(e){failure(e);}}
  function removeDay(target:ItineraryDay){if(!draft)return;if(draft.days.length<=1){setError("至少需要保留 1 天行程");return;}setRemoving({kind:"day",id:target.id,title:`删除 Day ${target.dayIndex}？`,content:`这一天包含 ${target.items?.length||0} 个行程节点，删除后无法自动恢复。`});}
  function removeNode(item:ItineraryNode){setRemoving({kind:"node",id:item.id,title:"删除节点",content:"确认删除此行程节点？"});}
  function confirmRemove(){if(!removing||!draft)return;change(next=>{if(removing.kind==="day")removeDraftDay(next,removing.id);else removeDraftNode(next,draft.days[day].id,removing.id);});setRemoving(null);}
  function save(){try{const next=readDraft(tripId);writeTrips(data=>{if(tripId)commitDraft(data,tripId,next);else createTrip(data,next);});localStorage.removeItem(DRAFT_KEY);router.push(`/trip/${encodeURIComponent(next.id)}`);}catch(e){failure(e);}}
  function openNode(item?:ItineraryNode){router.push(`${editorBase}/node?dayId=${encodeURIComponent(draft?.days[day]?.id||"")}&day=${day}${item?`&nodeId=${encodeURIComponent(item.id)}`:""}`);}
  async function runRegenerate(){if(generatingRef.current)return;generatingRef.current=true;setSourceStage("parsing");setGenerating(true);setError("");const requestController=new AbortController();controller.current=requestController;const timeout=setTimeout(()=>requestController.abort(),draft?.creationMode==="text_import"?80000:45000);try{const current=readDraft();const before=JSON.stringify(current);const next=await (current.creationMode==="text_import"?generateImport(current,importRequestFromDraft(current),{signal:requestController.signal,onStage:(stage:string)=>{if(controller.current===requestController&&!requestController.signal.aborted)setSourceStage(stage);}}):generatePlan(current,planningRequestFromDraft(current),{signal:requestController.signal}));if(requestController.signal.aborted||controller.current!==requestController)return;if(JSON.stringify(readDraft())!==before)throw Error("生成期间草稿已发生变化，保留当前草稿");setDraft(saveDraft(next));setDay(0);}catch(e){if(controller.current!==requestController)return;console.error("[trip-plan regenerate]",e);setError(e instanceof Error&&"code" in e&&(e.code==="TRIP_PARSE_INSUFFICIENT_CONTENT"||String(e.code).startsWith("SOURCE_"))?e.message:draft?.creationMode==="text_import"?IMPORT_ERROR:PLANNING_ERROR);}finally{clearTimeout(timeout);if(controller.current===requestController){controller.current=null;generatingRef.current=false;setGenerating(false);}}}
  function regenerate(){if(!["ai_generate","text_import"].includes(draft?.creationMode||"")){window.alert("此行程不支持重新生成");return;}try{if(readDraft().isDirty)setRegenerateConfirm(true);else void runRegenerate();}catch(e){failure(e);}}
  return <div className="web-frame"><main className="page top-space draft-page trip-detail itinerary-editor"><header className="row"><Link className="back press" href={base} aria-label="返回行程">‹</Link><h1 className="page-title">{tripId?"编辑行程":"行程草稿"}</h1></header>{error&&<p className="editor-error" role="alert">{error}</p>}{draft?<>
    {draft.creationMode==="text_import"&&<div ref={basicRef} className="form-card draft-basic"><span className="label">攻略识别结果（可修改）</span><span className="basic-hint">请确认名称和目的地，未识别的信息请补充</span>{([['name','旅行名称 *'],['country','国家 / 地区 *'],['city','城市 / 目的地 *']] as const).map(([key,label])=><label className="basic-field" key={key}><span className="field-label">{label}</span><input data-field={key} className="input" maxLength={100} value={key==="name"?draft.name||"":draft.destination[key]} onChange={e=>change(next=>{if(key==="name")next.name=e.target.value;else{const previous=next.destination.city;next.destination[key]=e.target.value;if(key==="city")for(const d of next.days)if(!d.city||d.city===previous)d.city=e.target.value;}})} /></label>)}</div>}
    <div className="heading"><span>{tripId?"点击节点可编辑，修改后保存":"草稿已生成，可调整后保存"}</span><span className="muted">点击 ··· 可删除 Day / 节点</span></div>
    <DayTabs days={draft.days} selected={day} onChoose={setDay} onAdd={()=>change(addDraftDay,draft.days.length)} onRemove={removeDay} />
    <ItineraryTimeline nodes={draft.days[day]?.items||[]} draftMode showUnverified onEdit={openNode} onRemove={removeNode} onAdd={()=>openNode()} />
    <div className="fixed-actions">{error&&<p className="editor-submit-error" role="alert">{error}</p>}<div className="editor-submit-buttons">{!tripId&&draft.creationMode!=="manual"&&<button disabled={generating} className="secondary" onClick={regenerate}>{draft.creationMode==="text_import"?"重新解析":"重新生成"}</button>}<button disabled={generating} className="primary" onClick={save}>{tripId?"保存修改":"确认创建"}</button></div></div>
  </>:!error&&<p className="muted">读取草稿中…</p>}{removing&&<ConfirmationDialog title={removing.title} content={removing.content} confirmText="删除" onCancel={()=>setRemoving(null)} onConfirm={confirmRemove} />}{regenerateConfirm&&<ConfirmationDialog title={draft?.creationMode==="text_import"?"重新解析攻略":"重新生成行程"} content={draft?.creationMode==="text_import"?"重新解析会覆盖你当前的修改，是否继续？":"重新生成会覆盖你当前的修改，是否继续？"} confirmText={draft?.creationMode==="text_import"?"重新解析":"重新生成"} onCancel={()=>setRegenerateConfirm(false)} onConfirm={()=>{setRegenerateConfirm(false);void runRegenerate();}}/>}{generating&&<PlanningLoading importing={draft?.creationMode==="text_import"} reading={sourceStage==="reading"} onCancel={cancelRegenerate}/>}</main><Xiaobu onUnavailable={name=>window.alert(`${name}暂时不可用，请稍后再试`)} /></div>;
}
