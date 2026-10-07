"use client";
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {load,geometry} from '../../../lib/barrage.js';
import {tryFullscreen,exitFullscreen,requestWakeLock} from '../../../lib/browser-capabilities.js';
import './barrage.css';
export default function BarrageDisplay(){
 const router=useRouter(),[config,setConfig]=useState(null),[view,setView]=useState(null),[error,setError]=useState(''),[controls,setControls]=useState(true),[paused,setPaused]=useState(false),[textWidth,setTextWidth]=useState(0),[notice,setNotice]=useState(''),board=useRef(null),measure=useRef(null),timer=useRef(null);
 useEffect(()=>{let alive=true,lock=null,serial=0;let p;try{p=load();if(!p.text.trim())throw Error('请先填写弹幕内容');setConfig(p)}catch(e){setError(e.message);return}
 const resize=()=>setView(geometry(p,window.innerWidth,window.innerHeight));resize();window.addEventListener('resize',resize);
 async function keep(){const generation=++serial;const held=lock;lock=null;if(held)await held.release().catch(()=>{});if(document.visibilityState==='hidden'||!alive)return;const next=await requestWakeLock();if(!alive||generation!==serial){await next?.release().catch(()=>{});return}lock=next}
 const visible=()=>{setPaused(document.visibilityState==='hidden');keep()};document.addEventListener('visibilitychange',visible);keep();timer.current=setTimeout(()=>setControls(false),3000);
 return()=>{alive=false;serial++;clearTimeout(timer.current);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visible);lock?.release().catch(()=>{});exitFullscreen()};
 },[]);
 useEffect(()=>{if(measure.current)setTextWidth(measure.current.getBoundingClientRect().width)},[view,config]);
 function tap(){clearTimeout(timer.current);setControls(value=>{if(!value)timer.current=setTimeout(()=>setControls(false),3000);return !value})}
 async function fullscreen(e){e.stopPropagation();if(!await tryFullscreen(board.current)){setNotice('浏览器不支持全屏，仍可正常显示弹幕');setControls(true)}}
 function exit(e){e.stopPropagation();router.push('/tools/barrage')}
 if(error)return <main className="barrage-error"><p role="alert">{error}</p><button onClick={exit}>返回编辑</button></main>;
 if(!config||!view)return <main className="barrage-error">正在读取弹幕…</main>;
 const width=textWidth||Array.from(view.displayText).length*view.font;
 return <main ref={board} className={`barrage-screen ${paused?'paused':''}`} style={{background:config.backgroundColor}} onClick={tap}>
 <span ref={measure} className="barrage-measure" style={{fontSize:view.font,fontWeight:config.fontWeight}} aria-hidden="true">{view.displayText}</span>
 <div className="barrage-board" style={{width:view.boardWidth,height:view.boardHeight,transform:`translate(-50%,-50%) rotate(${view.rotate}deg)`,color:config.textColor,fontSize:view.font,fontWeight:config.fontWeight}}>
 {config.mode==='scroll'?<div className="barrage-scroll-line"><div className="barrage-runner" style={{width:view.boardWidth+width,animationDuration:`${view.duration}s`}}><span className={config.blinkEnabled?'barrage-blink':''} style={{marginLeft:view.boardWidth}}>{view.displayText}</span></div></div>:<div className="barrage-static"><span className={config.blinkEnabled?'barrage-blink':''}>{view.displayText}</span></div>}</div>
 {controls&&<div className="barrage-controls"><button onClick={exit}>‹ 退出弹幕</button><button onClick={fullscreen}>全屏显示</button><button onClick={exit}>编辑</button></div>}
 {notice&&<p role="status" className="barrage-orientation">{notice}</p>}
 {!notice&&controls&&config.orientation==='landscape'&&view.rotate!==0&&<p className="barrage-orientation">横屏观看效果更好 · 轻点屏幕显示控制</p>}
 </main>;
}
