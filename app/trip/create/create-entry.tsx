"use client";
import Link from "next/link";
import BottomNavigation from "../../components/bottom-navigation";
import Xiaobu from "../../components/xiaobu";
import {formKey} from "./creation-form-store";
import type {CreationMode} from "../trip-draft";
import "./create.css";
export default function CreateEntry(){
  const unavailable=(name:string)=>window.alert(`${name}页面尚未迁移到 Web`);
  const fresh=(e:React.MouseEvent,mode:CreationMode)=>{try{sessionStorage.removeItem(formKey(mode));}catch(error){e.preventDefault();window.alert(error instanceof Error?error.message:"无法打开创建表单");}};
  return <div className="web-frame"><main className="page top-space create-page"><h1 className="page-title center">创建行程</h1><div className="choice-stage"><div className="choices"><Link className="card main-choice press" href="/trip/create/ai" onClick={e=>fresh(e,"ai_generate")}><div className="choice-heading"><img className="spark" src="/images/icons/ai-spark.svg" alt=""/><span className="choice-title">小簿帮我规划</span></div><div className="choice-description"><span className="muted">选择目的地和旅行偏好</span><span className="muted">小簿为你生成一版旅行草稿</span></div><span className="link">开启智能规划 →</span></Link><div className="grid-2"><Link className="card small-choice press" href="/trip/create/manual" onClick={e=>fresh(e,"manual")}><span className="choice-title">自己规划</span><span className="muted">从空白开始</span></Link><Link className="card small-choice press" href="/trip/create/import" onClick={e=>fresh(e,"text_import")}><span className="choice-title">粘贴攻略</span><span className="muted">快速提取</span></Link></div></div></div></main><Xiaobu onUnavailable={unavailable}/><BottomNavigation selected={2} onUnavailable={unavailable}/></div>;
}
