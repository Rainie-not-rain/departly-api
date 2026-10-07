"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {readTrips} from '../trips/trip-service';
import Xiaobu from '../components/xiaobu';
import './footprints.css';
export function useFootprints(){
 const [data,setData]=useState(null),[error,setError]=useState('');
 const refresh=()=>{try{setData(readTrips());setError('');}catch(e){setData(null);setError(e.message);}};
 useEffect(()=>{refresh();window.addEventListener('storage',refresh);window.addEventListener('departly-data-change',refresh);window.addEventListener('focus',refresh);return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('departly-data-change',refresh);window.removeEventListener('focus',refresh);};},[]);
 return {data,error,setError,refresh};
}
export function FootprintFrame({title,children,error,back='/footprints'}){return <div className="web-frame footprints-page"><main className="page top-space memory-page"><header className="row header"><Link className="back" href={back} aria-label="返回">‹</Link><h1 className="page-title">{title}</h1></header>{error&&<p role="alert" className="footprint-error">{error}</p>}{children}</main><Xiaobu onUnavailable={()=>{}}/></div>;}
