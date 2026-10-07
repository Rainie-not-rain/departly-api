"use client";
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState} from 'react';
import {DATA_KEY} from '../home-state';
import type {ManagedTrip} from '../trips/trip-service';
import Copilot,{type CopilotPageState} from '../trip/copilot';
import '../trip/copilot.css';
export default function Assistant(){
 const conversations=useRef<Record<string,CopilotPageState>>({});
 const [trips,setTrips]=useState<ManagedTrip[]|null>(null),[selected,setSelected]=useState(''),[error,setError]=useState('');
 const remember=useCallback((state:CopilotPageState)=>{conversations.current[selected]=state;},[selected]);
 useEffect(()=>{try{const raw=localStorage.getItem(DATA_KEY),data=raw?JSON.parse(raw):{trips:[]};if(!Array.isArray(data.trips))throw Error('旅程数据无效');const rows=data.trips.filter((t:ManagedTrip)=>!t.isDeleted);setTrips(rows);setSelected(rows.find((t:ManagedTrip)=>t.id===data.currentTripId)?.id||rows[0]?.id||'');}catch(e){setError(e instanceof Error?e.message:'无法读取旅程');}},[]);
 if(error)return <div className="web-frame"><main className="page top-space"><Link href="/">‹ 返回</Link><p role="alert">{error}</p></main></div>;
 if(!trips)return <div className="web-frame"><main className="page top-space">读取旅程中…</main></div>;
 if(!selected)return <div className="web-frame"><main className="page top-space"><Link href="/">‹ 返回</Link><div className="assistant-welcome"><img src="/images/departly/xiaobu.png" alt="小簿"/><h1>我是小簿</h1><p className="muted">今天想怎么走？</p><p>先创建一趟旅行，再来问我行程、时间和路线吧。</p><Link className="primary" href="/trip/create">创建旅程</Link></div></main></div>;
 return <><div className="assistant-trip-picker"><label htmlFor="assistant-trip">当前旅程</label><select id="assistant-trip" value={selected} onChange={e=>setSelected(e.target.value)}>{trips.map(t=><option key={t.id} value={t.id}>{t.name||t.city||'未命名旅程'}</option>)}</select></div><Copilot key={selected} tripId={selected} initialState={conversations.current[selected]} onStateChange={remember}/></>;
}
