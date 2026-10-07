"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Xiaobu from "../components/xiaobu";
import { readDraft, saveDraft } from "./draft-storage";
import { updateDraftNode } from "./detail-service.js";
import "./detail.css";
import "./editor.css";
const types=["景点","餐饮","住宿","交通","自由活动"];
export default function NodeEditor({ tripId,dayId,nodeId,day }: { tripId?:string;dayId:string;nodeId:string;day:number }) {
  const router=useRouter(),back=tripId?`/trip/${encodeURIComponent(tripId)}/edit?day=${day}`:`/trip/create/draft?day=${day}`;
  const [ready,setReady]=useState(false),[error,setError]=useState("");
  const [form,setForm]=useState({date:"",start:"",end:"",place:"",type:"景点",note:""});
  useEffect(()=>{try{const draft=readDraft(tripId),selected=draft.days.find(d=>d.id===dayId);if(!selected)throw Error("草稿或日期已不存在");const item=selected.items?.find(n=>n.id===nodeId);if(nodeId&&!item)throw Error("节点已不存在");setForm({date:selected.date||"",start:item?.plannedStartTime||"",end:item?.plannedEndTime||"",place:item?.placeName||"",type:item?.type==="place"?"景点":item?.type||"景点",note:item?.note||""});setReady(true);}catch(e){setError(e instanceof Error?e.message:"无法编辑节点");}},[tripId,dayId,nodeId]);
  function field(key:keyof typeof form,value:string){setForm(previous=>({...previous,[key]:value,...(key==="start"&&previous.end&&previous.end<=value?{end:""}:{})}));}
  function save(){try{const draft=readDraft(tripId);updateDraftNode(draft,dayId,nodeId,form);saveDraft(draft);router.push(back);}catch(e){setError(e instanceof Error?e.message:"保存失败");}}
  const control=(key:"date"|"start"|"end"|"place",label:string,type="text")=><label className="form-card"><span className="label">{label}</span><input className="input" type={type} value={form[key]} placeholder={key==="place"?"搜索或手动填写地点":"请选择"} onChange={e=>field(key,e.target.value)} /></label>;
  return <div className="web-frame"><main className="page top-space node-editor trip-detail"><header className="row header"><Link className="back press" href={back} aria-label="返回编辑行程">‹</Link><h1 className="page-title">编辑行程节点</h1></header>{error&&<p className="editor-error" role="alert">{error}</p>}{ready&&<form onSubmit={e=>{e.preventDefault();save();}}>{control("date","日期","date")}<div className="grid-2">{control("start","开始时间","time")}{control("end","结束时间","time")}</div>{control("place","地点 *")}<div className="form-card"><span className="label">类型</span><div className="tags">{types.map(type=><button type="button" key={type} className={`pill ${form.type===type?"active":""}`} onClick={()=>field("type",type)}>{type}</button>)}</div></div><label className="form-card"><span className="label">备注</span><textarea className="input textarea" value={form.note} placeholder="选填" onChange={e=>field("note",e.target.value)} /></label><div className="fixed-actions"><button className="primary">保存节点</button></div></form>}</main><Xiaobu onUnavailable={name=>window.alert(`${name}页面尚未迁移到 Web`)} /></div>;
}
