"use client";
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {readTrips} from '../trips/trip-service';
import {getMapModel} from '../../lib/footprint-map.js';
import {renderMap} from './render-map.js';
import {Sheet} from '../trip/subpages/shared.jsx';
import './map.css';
export default function FootprintShare(){const canvasRef=useRef(null),[scope,setScope]=useState('china'),[showNumbers,setShowNumbers]=useState(true),[image,setImage]=useState(''),[error,setError]=useState(''),[preview,setPreview]=useState(false);
 useEffect(()=>{if(new URLSearchParams(location.search).get('scope')==='global')setScope('global');},[]);
 useEffect(()=>{try{const canvas=canvasRef.current,{locations,stats}=getMapModel(readTrips(),{scope,status:'visited'});
 canvas.width=750;canvas.height=1100;const ctx=canvas.getContext('2d');ctx.fillStyle='#F7F4EC';ctx.fillRect(0,0,750,1100);ctx.fillStyle='#19352C';ctx.font='bold 42px sans-serif';ctx.fillText('我的旅行足迹',54,94);
 ctx.font='25px sans-serif';ctx.fillStyle='#456056';const title=showNumbers?(scope==='china'?'我点亮了中国 '+stats.cityCount+' 城':'我点亮了 '+stats.countryCount+' 国 · '+stats.cityCount+' 城'):'把走过的地方，慢慢收藏';ctx.fillText(title,54,142);
 ctx.save();ctx.translate(30,200);renderMap(ctx,{scope:scope,status:'visited',locations,width:690,height:540});ctx.restore();
 if(stats.unresolvedCount){ctx.fillStyle='#66756D';ctx.font='20px sans-serif';ctx.fillText(stats.unresolvedCount+' 个地点尚待解析，暂未显示点位',54,786)}
 if(showNumbers){const items=[[scope==='china'?stats.provinceCount:stats.countryCount,scope==='china'?'省级地区':'国家 / 地区'],[stats.cityCount,'城市'],[stats.tripCount,'旅行'],[stats.ticketCount,'票根']];for(let i=0;i<items.length;i++){const x=110+i*176;ctx.textAlign='center';ctx.fillStyle='#215C45';ctx.font='bold 42px sans-serif';ctx.fillText(String(items[i][0]),x,888);ctx.fillStyle='#66756D';ctx.font='22px sans-serif';ctx.fillText(items[i][1],x,930)}}
 ctx.textAlign='left';ctx.strokeStyle='#D7DFD4';ctx.beginPath();ctx.moveTo(54,994);ctx.lineTo(696,994);ctx.stroke();ctx.fillStyle='#215C45';ctx.font='24px sans-serif';ctx.fillText('出发簿 · 认真记录每一次出发',54,1044);ctx.font='18px sans-serif';ctx.textAlign='right';ctx.fillStyle='#66756D';ctx.fillText(new Date().toLocaleDateString(),696,1044);

setImage(canvas.toDataURL('image/png'));setError('');}catch(e){setImage('');setError(e.message||'生成失败，请重试');}},[scope,showNumbers]);
 return <main className="fp-share-page"><header><Link href={`/footprints/map?scope=${scope}`} aria-label="返回地图">‹</Link><h1>我的足迹图</h1></header><div className="fp-share-controls"><div className="fp-map-segments">{['china','global'].map(s=><button key={s} className={scope===s?'active':''} onClick={()=>setScope(s)}>{s==='china'?'中国':'全球'}</button>)}</div><label>显示数字<input type="checkbox" checked={showNumbers} onChange={e=>setShowNumbers(e.target.checked)}/></label></div>{error&&<p role="alert">{error}</p>}{image&&<><img className="fp-share-poster" src={image} alt="我的旅行足迹分享图"/><div className="fp-share-actions"><a href={image} download="我的旅行足迹.png">保存图片</a><button onClick={()=>setPreview(true)}>预览图片</button></div></>}<p className="fp-share-caption">仅分享这张图片，不包含原始旅行记录或照片。保存图片后可自行分享。</p><canvas className="fp-share-canvas" ref={canvasRef}/>{preview&&<Sheet title="我的足迹图" onClose={()=>setPreview(false)} className="fp-share-preview"><img src={image} alt="我的旅行足迹分享图"/></Sheet>}</main>;
}
