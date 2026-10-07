"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import Xiaobu from '../../components/xiaobu';
import {readTrips,writeTrips} from '../../trips/trip-service';
import {isOwner} from '../../trips/ownership.js';
import {ensureTripMembers} from './tripMembers.js';
import {prepareDetails} from '../detail-service.js';
import './subpages.css';

export const tripUrl=id=>`/trip/${encodeURIComponent(id)}`;
export function useTrip(id){
 const [data,setData]=useState(null),[error,setError]=useState('');
 const refresh=()=>{try{const data=readTrips(),before=JSON.stringify(data);const trip=data.trips.find(t=>t.id===id&&!t.isDeleted);if(!trip)throw Error('旅程不存在或已删除');if(isOwner(data,trip)){ensureTripMembers({...data,trips:[trip]});prepareDetails(data);if(JSON.stringify(data)!==before)writeTrips(current=>Object.assign(current,data));}setData(data);setError('');}catch(e){setError(e.message);}};
 useEffect(()=>{refresh();window.addEventListener('storage',refresh);window.addEventListener('departly-data-change',refresh);return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('departly-data-change',refresh);};},[id]);
 return {data,trip:data?.trips.find(t=>t.id===id&&!t.isDeleted),error,setError,refresh};
}
export function Shell({id,title,kind,children,error,backHref}){return <div className={`web-frame trip-subpages ${kind}`}><main className="page top-space"><header className="row"><Link className="back" href={backHref||tripUrl(id)} aria-label="返回">‹</Link><h1 className="page-title">{title}</h1></header>{error&&<p className="error" role="alert">{error}</p>}{children}</main><Xiaobu onUnavailable={()=>window.alert('暂时无法打开小簿，请稍后再试。')}/></div>;}
export function Sheet({title,onClose,children,className=''}){
 const ref=useRef(null);
 useEffect(()=>{const dialog=ref.current,previous=document.activeElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.showModal();return()=>{dialog.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};},[]);
 return <dialog ref={ref} className={`subpage-sheet ${className}`} aria-label={title} onClick={e=>{if(e.target===e.currentTarget)onClose();}} onCancel={e=>{e.preventDefault();onClose();}}><div className="between"><h2 className="sheet-title">{title}</h2><button aria-label="关闭" className="close" onClick={onClose}>×</button></div>{children}</dialog>;
}
