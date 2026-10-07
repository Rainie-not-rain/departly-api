"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {localDate,dateAt,getFootprints} from '../../lib/footprints.js';
import {useFootprints,FootprintFrame} from './shared';
export default function Calendar(){
 const {data,error}=useFootprints(),[month,setMonth]=useState('');useEffect(()=>setMonth(localDate().slice(0,7)),[]);
 const first=month+'-01',date=new Date(first+'T00:00:00Z'),count=month?new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate():0,visited=new Set(data?getFootprints(data).map(r=>r.date):[]),cells=month?[...Array.from({length:date.getUTCDay()},(_,i)=>({id:'blank'+i})),...Array.from({length:count},(_,i)=>({id:dateAt(first,i),date:dateAt(first,i),label:i+1}))]:[];
 const change=step=>{const [y,m]=month.split('-').map(Number);setMonth(new Date(Date.UTC(y,m-1+step,1)).toISOString().slice(0,7));};
 return <FootprintFrame title="足迹日历" error={error}>{month&&<section className="card"><div className="between month"><button aria-label="上个月" onClick={()=>change(-1)}>‹</button><span>{month}</span><button aria-label="下个月" onClick={()=>change(1)}>›</button></div><div className="calendar">{['日','一','二','三','四','五','六'].map(w=><span className="muted" key={w}>{w}</span>)}{cells.map(cell=>cell.date?<Link key={cell.id} href={`/footprints/day?date=${cell.date}`} aria-label={`${cell.date}${visited.has(cell.date)?' 有足迹':''}`}><span>{cell.label}</span><i className={`dot ${visited.has(cell.date)?'lit':''}`}/></Link>:<span key={cell.id}/>)}</div></section>}</FootprintFrame>;
}
