"use client";
import './create/create.css';
export default function PlanningLoading({importing=false,reading=false,onCancel}:{importing?:boolean;reading?:boolean;onCancel?:()=>void}){return <div className="planning-loading"><div role="status" aria-live="polite"><div className="planning-spinner"/><h2>{reading?"小簿正在读取攻略…":importing?"正在整理地点和路线…":"小簿正在生成行程…"}</h2><p className="muted">处理可能需要一些时间，请稍候。</p></div>{onCancel&&<><button type="button" className="secondary planning-cancel" onClick={onCancel}>取消等待</button><p className="muted">已填写的内容会保留</p></>}</div>;}
