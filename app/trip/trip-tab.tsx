"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {readTrips,localDate} from "../trips/trip-service";
import {defaultTrip} from "./detail-service.js";
import BottomNavigation from "../components/bottom-navigation";
import Xiaobu from "../components/xiaobu";
import "./detail.css";
export default function TripTab() {
  const router=useRouter(),[ready,setReady]=useState(false),[error,setError]=useState("");
  function load(){try{const trip=defaultTrip(readTrips(),localDate());if(trip)router.replace(`/trip/${encodeURIComponent(trip.id)}`);else setReady(true);setError("");}catch(e){setError(e instanceof Error?e.message:"无法读取旅程");}}
  useEffect(()=>{load();window.addEventListener("storage",load);window.addEventListener("focus",load);return()=>{window.removeEventListener("storage",load);window.removeEventListener("focus",load);};},[]);
  const unavailable=(name:string)=>window.alert(`${name}页面尚未迁移到 Web`);
  return <div className="web-frame"><main className="page empty trip-detail trip-tab-empty">{error?<p role="alert">{error}<button onClick={load}>重试</button></p>:ready?<div className="card empty-card"><h1 className="section-title">还没有任何行程…</h1><span className="muted">创建后可安排路线、行李、账目和打卡</span><Link className="primary" href="/trip/create">创建行程</Link></div>:<p className="muted">读取旅程中…</p>}</main><Xiaobu onUnavailable={unavailable}/><BottomNavigation selected={1} onUnavailable={unavailable}/></div>;
}
