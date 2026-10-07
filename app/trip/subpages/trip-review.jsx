"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {Shell,tripUrl} from './shared';
import {buildTripReviewContext,reviewContextVersion,hasTripReviewData,fallbackTripReview,tripReviewRecords} from '../../../lib/trip-review-context.js';
import {validateTripReviewAI} from '../../../lib/trip-review-ai.js';
import {resolveReviewAI} from './review-ai-cache.js';
import './trip-review.css';
const photoPath=p=>typeof p==='string'?p:p?.url||p?.localPath||p?.path||p?.tempFilePath||'';
export default function TripReview({tripId}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[ai,setAI]=useState(null),[busy,setBusy]=useState(false),[hint,setHint]=useState('');const active=useRef(null);
 useEffect(()=>{const refresh=()=>{try{const value=JSON.parse(localStorage.getItem('departly_mvp_data_v1')||'{}');if(!value.trips?.some(t=>t.id===tripId&&!t.isDeleted))throw Error('旅程不存在或已删除');setData(value);setError('');}catch(e){setError(e.message);setData(null);}};refresh();window.addEventListener('storage',refresh);window.addEventListener('departly-data-change',refresh);window.addEventListener('focus',refresh);return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('departly-data-change',refresh);window.removeEventListener('focus',refresh);};},[tripId]);
 const context=useMemo(()=>data?buildTripReviewContext(tripId,data):null,[tripId,data]),version=context?reviewContextVersion(context):'',fallback=context?fallbackTripReview(context):null;
 const generate=async(force=false)=>{if(!context)return;active.current?.abort();const controller=new AbortController();active.current=controller;setBusy(true);setHint('');const result=await resolveReviewAI({context,contextVersion:version,storage:localStorage,hasData:hasTripReviewData(context),fallback,validate:validateTripReviewAI,force,signal:controller.signal});if(controller.signal.aborted)return;setAI({version,value:result.value});setHint(result.source==='fallback'?'暂时使用记录摘要，稍后可以重新生成。':'');setBusy(false);};
 useEffect(()=>{if(context)generate();return()=>active.current?.abort();},[version]);
 const value=ai?.version===version?ai.value:fallback,records=data?tripReviewRecords(data,tripId):[],photos=[...new Set(records.flatMap(r=>(r.photos||[]).map(photoPath)).filter(Boolean))];
 return <Shell id={tripId} title="旅程回顾" kind="trip-review-page" error={error}>{context&&<>
 <section className="review-hero"><h2>{context.trip.name}</h2><p>{context.trip.startDate} — {context.trip.endDate}</p><p>{context.members.length} 位同行成员 · {context.members.map(m=>m.name).join(' / ')}</p></section>
 <section className="card review-story"><h2>{value.title}</h2><p>{value.narrative}</p>{busy&&<p className="muted" role="status">小簿正在整理这趟旅行…</p>}{hint&&<p className="muted" role="status">{hint}</p>}{hasTripReviewData(context)&&<button className="review-regenerate" disabled={busy} onClick={()=>generate(true)}>重新生成回顾</button>}</section>
 <section className="card review-summary">{[[context.trip.durationDays,'天'],[context.visitedPlaces.length,'个足迹'],[context.photos.count,'张照片'],[`¥${context.expenses.totalCNY.toFixed(2)}`,'已折算花费']].map(([count,label])=><div key={label}><strong>{count}</strong><span>{label}</span></div>)}</section>
 <section className="card review-module"><h2>这趟旅行很像你</h2><div className="review-tags">{value.tags.map(tag=><span key={tag}>{tag}</span>)}</div>{!value.tags.length&&<p className="muted">还没有足够的记录形成旅行标签</p>}</section>
 <section className="card review-module"><h2>旅程路线</h2>{context.routeSummary.map(day=><div className="review-route" key={`${day.dayIndex}-${day.date}`}><strong>Day {day.dayIndex}</strong><span>{day.places.join(' → ')}</span></div>)}{!context.routeSummary.length&&<p className="muted">还没有已完成的行程路线</p>}</section>
 <section className="card review-module"><h2>旅途足迹</h2>{context.visitedPlaces.map((place,index)=><div className="review-place" key={`${place.itemId}-${index}`}><strong>{place.title}</strong>{place.memoryText&&<p className="muted">{place.memoryText}</p>}</div>)}{!context.visitedPlaces.length&&<p className="muted">这趟旅行还没有完成或打卡的地点</p>}</section>
 <section className="card review-module"><h2>旅途瞬间</h2><div className="review-photos">{photos.map(path=><img key={path} src={path} alt="旅途照片" loading="lazy"/>)}</div>{records.filter(r=>r.note).map(r=><div className="review-place" key={r.id}><strong>{r.placeName||r.place}</strong><p className="muted">{r.note}</p></div>)}{!photos.length&&!records.some(r=>r.note)&&<p className="muted">还没有留下旅途瞬间</p>}</section>
 <section className="card review-module"><h2>旅行账本摘要</h2><p>{context.expenses.recordCount??context.expenses.count} 笔账目 · 已折算 ¥{context.expenses.totalCNY.toFixed(2)}</p>{context.expenses.recordCount>context.expenses.count&&<p className="muted">另有 {context.expenses.recordCount-context.expenses.count} 笔未折算或需补全的账目，未计入总花费。</p>}{context.expenses.categories.map(category=><div className="between" key={category.category}><span>{category.category}</span><span>¥{category.totalCNY.toFixed(2)}</span></div>)}<Link className="review-link" href={`${tripUrl(tripId)}/ledger`}>查看账本详情 →</Link></section>
 <Link className="secondary review-original" href={tripUrl(tripId)}>查看原行程 →</Link>
 </>}</Shell>;
}
