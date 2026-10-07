"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import BottomNavigation from "../components/bottom-navigation";
import Xiaobu from "../components/xiaobu";
import { readTrips, writeTrips, localDate, selectTrip, type TripData, type ManagedTrip } from "../trips/trip-service";
import { detailState, prepareDetails } from "./detail-service.js";
import { TripHeader, DayTabs, ItineraryTimeline, type ItineraryNode } from "./detail-components";
import { beginDraft } from "./draft-storage";
import "./detail.css";

export default function TripDetail({ tripId, initialDay = null }: { tripId: string; initialDay?: number|null }) {
  const router=useRouter();
  const [data,setData]=useState<TripData|null>(null),[error,setError]=useState("");
  const [day,setDay]=useState<number|null>(initialDay),[today,setToday]=useState("");
  const [choosing,setChoosing]=useState(false),[choice,setChoice]=useState(tripId);
  const dialog=useRef<HTMLDialogElement>(null);
  function refresh() { try { let next=readTrips();const changed=prepareDetails(next);if(changed)next=writeTrips(latest=>{prepareDetails(latest);});setData(next);setToday(localDate());setError(""); }catch(e){setError(e instanceof Error?e.message:"无法读取旅程");} }
  useEffect(()=>{ refresh();window.addEventListener("storage",refresh);window.addEventListener("departly-data-change",refresh);window.addEventListener("focus",refresh);const timer=setInterval(refresh,60000);return ()=>{clearInterval(timer);window.removeEventListener("storage",refresh);window.removeEventListener("departly-data-change",refresh);window.removeEventListener("focus",refresh);}; },[tripId]);
  useEffect(()=>{if(!choosing)return;const el=dialog.current!,previous=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;document.body.style.overflow="hidden";el.showModal();return ()=>{el.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};},[choosing]);
  const unavailable=(name:string)=>window.alert(`暂时无法打开${name}，请稍后再试。`);
  const trip=data?.trips.find(t=>t.id===tripId&&!t.isDeleted);
  const view=trip&&today?detailState(data,tripId,day,today):null;
  const base=`/trip/${encodeURIComponent(tripId)}`;
  const memberRows=(trip?.members||[]) as {id:string;avatar?:string}[];
  const checkinHref=(item?:ItineraryNode)=>`${base}/checkin?dayId=${encodeURIComponent(view?.days[view.day]?.id||"")}${item?`&itemId=${encodeURIComponent(item.id)}`:""}`;
  const transport=view?.transports[0],stay=view?.stays[0];
  const itinerary=view&&<>
      <div className="between itinerary-heading"><h2 className="section-title">{view.date===today?"今日行程":"行程安排"}</h2><Link className="pill itinerary-edit" href={`${base}/edit?day=${view.day}`} onClick={e=>{try{beginDraft(tripId);}catch(error){e.preventDefault();window.alert(error instanceof Error?error.message:"无法编辑");}}}>编辑</Link></div>
      <DayTabs days={view.days} selected={view.day} onChoose={setDay} /><ItineraryTimeline nodes={view.nodes} checkinHref={checkinHref} />
  </>;
  return <div className="web-frame"><main className="page top-space trip-page trip-detail">
    {error?<div role="alert">{error}<button onClick={refresh}>重试</button></div>:!data?<p className="muted">读取旅程中…</p>:!view?<div className="card detail-empty"><h1 className="section-title">旅程不存在或已删除</h1><Link className="primary" href="/trips">返回我的旅程</Link></div>:<>
      <TripHeader trip={view.trip} onSwitch={()=>{setChoice(tripId);setChoosing(true);}} />
      <Link className="card trip-members-entry press" href={`${base}/members`}><span>同行成员</span><div>{memberRows.slice(0,3).map(member=>member.avatar&&<img key={member.id} src={member.avatar} alt="成员头像" />)}<span>{memberRows.length}人 ›</span></div></Link>
      <div className="day-lead">当前查看第 <span>{view.day+1}</span> 天</div>
      {view.status==="upcoming"&&<section className="trip-packing"><h2 className="section-title packing-heading">行李清单</h2><div className="card packing-summary"><img className="packing-summary-bg" src="/images/departly/packing-hero.jpg" alt="" /><div className="packing-ring" style={{background:`conic-gradient(#215C45 ${view.packingPercent}%,#E4E9DD 0)`}}><div>{view.packingPercent}%</div></div><div className="packing-count"><span>已准备</span><span className="packing-number">{view.packedCount}<span className="packing-total">/{view.packingCount}</span></span></div><Link className="packing-continue press" href={`${base}/packing`}>{view.packingCount?"继续打包":"创建清单"}</Link></div></section>}
      <h2 className="section-title travel-heading">今日机酒</h2><div className="travel-grid"><Link className="travel-card press" href={`${base}/arrangements?date=${view.date}&kind=transport`}><span className="travel-card-title">✈ 今日交通</span>{transport?<><span className="travel-main">{transport.departurePlace} → {transport.arrivalPlace}</span><span className="travel-sub">{transport.departureTime||"时间未填写"}{transport.arrivalTime?`–${transport.arrivalTime}`:""}</span><span className="travel-sub">{view.transports.length>1?`+${view.transports.length-1} 段`:transport.number}</span></>:<><span className="travel-sub">尚未添加</span><span className="travel-add">＋ 添加交通</span></>}</Link><Link className="travel-card press" href={`${base}/arrangements?date=${view.date}&kind=stay`}><span className="travel-card-title">🏨 今晚住宿</span>{stay?<><span className="travel-main">{stay.hotelName}</span><span className="travel-sub">{stay.checkInDate.slice(5)}–{stay.checkOutDate.slice(5)}</span><span className="travel-sub">{view.stays.length>1?`+${view.stays.length-1} 个住宿安排`:`${Math.round((Date.parse(stay.checkOutDate)-Date.parse(stay.checkInDate))/86400000)}晚`}</span></>:<><span className="travel-sub">尚未添加</span><span className="travel-add">＋ 添加住宿</span></>}</Link></div>
      <h2 className="section-title helper-title">旅途帮手</h2><div className="helper-grid"><Link className="secondary press helper-button" href={`${base}/ledger`}><img src="/images/icons/quick-ledger.png" alt="" /><span>快速记账</span></Link><Link className="secondary press helper-button" href={checkinHref()}><img src="/images/icons/quick-footprint.png" alt="" /><span>景点打卡</span></Link></div>

      {itinerary}
    </>}
    {choosing&&<dialog ref={dialog} className="trip-switcher" onCancel={e=>{e.preventDefault();setChoosing(false);}}><div className="switch-actions"><button onClick={()=>setChoosing(false)}>取消</button><button onClick={()=>{try{selectTrip(choice);setChoosing(false);if(choice!==tripId)router.push(`/trip/${encodeURIComponent(choice)}`);else setDay(0);}catch(e){window.alert(e instanceof Error?e.message:"切换失败");}}}>确定</button></div><select autoFocus size={5} value={choice} aria-label="选择旅程" onChange={e=>setChoice(e.target.value)}>{data?.trips.filter(t=>!t.isDeleted).map((t:ManagedTrip)=><option value={t.id} key={t.id}>{t.name}</option>)}</select></dialog>}
  </main><Xiaobu onUnavailable={unavailable} /><BottomNavigation selected={1} onUnavailable={unavailable} tripHref={base} /></div>;
}
