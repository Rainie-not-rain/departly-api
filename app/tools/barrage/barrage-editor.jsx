"use client";
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {ToolHeader} from '../shared';
import {colors,defaults,speedLabels,normalize,load,save,similarColors} from '../../../lib/barrage.js';
import './barrage.css';
export default function BarrageEditor(){
 const router=useRouter(),[config,setConfig]=useState(defaults),[error,setError]=useState(''),current=useRef(defaults),dirty=useRef(false);
 useEffect(()=>{try{const saved=load();current.current=saved;setConfig(saved)}catch(e){setError(`上次配置无法读取：${e.message}。已载入默认设置，显示时将保存新配置。`)}
 const persist=()=>{if(!dirty.current)return;try{save(current.current);dirty.current=false}catch(e){setError(e.message||'设置保存失败')}};
 const hidden=()=>{if(document.visibilityState==='hidden')persist()};document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',persist);
 return()=>{persist();document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',persist)};
 },[]);
 function update(field,value){const next=normalize({...current.current,[field]:value});current.current=next;dirty.current=true;setConfig(next)}
 function display(){try{save(config);dirty.current=false;router.push('/tools/barrage/display')}catch(e){setError(e.message||'设置保存失败')}}
 const swatches=field=><div className="barrage-swatches">{colors.map(c=><button key={c.value} type="button" className={config[field]===c.value?'selected':''} style={{background:c.value}} aria-label={c.name} aria-pressed={config[field]===c.value} onClick={()=>update(field,c.value)}>{config[field]===c.value&&<i/>}</button>)}</div>;
 const options=(field,values)=><div className="barrage-segments">{values.map(([value,label])=><button key={value} type="button" aria-pressed={config[field]===value} className={config[field]===value?'active':''} onClick={()=>update(field,value)}>{label}</button>)}</div>;
 return <div className="web-frame tools-frame"><ToolHeader title="手持弹幕"/><main className="barrage-editor">{error&&<p role="alert" className="barrage-warning">{error}</p>}
 <div className="barrage-preview" style={{background:config.backgroundColor,color:config.textColor,fontSize:Math.min(60,config.fontSize*.5),fontWeight:config.fontWeight}}>{config.text||'输入想展示的话…'}</div><p className="barrage-preview-note">实时样式预览，滚动与闪烁将在全屏展示时播放</p>
 <section><div className="barrage-row"><h2>弹幕内容</h2><button className="barrage-clear" onClick={()=>update('text','')}>清空</button></div><textarea aria-label="弹幕内容" value={config.text} onChange={e=>update('text',e.target.value)} placeholder="输入想展示的话..."/><p className="barrage-count">{Array.from(config.text).length} / 100</p></section>
 <section><h2>文字样式</h2><label className="barrage-row" htmlFor="font-size">文字大小 <span>{config.fontSize}</span></label><input id="font-size" type="range" min="32" max="120" step="4" value={config.fontSize} onChange={e=>update('fontSize',Number(e.target.value))}/><p>文字颜色</p>{swatches('textColor')}<label className="barrage-row">文字加粗<input type="checkbox" checked={config.fontWeight==='bold'} onChange={e=>update('fontWeight',e.target.checked?'bold':'normal')}/></label></section>
 <section><h2>弹幕效果</h2>{options('mode',[['scroll','滚动'],['static','静止']])}{config.mode==='scroll'&&<><label className="barrage-row" htmlFor="speed">滚动速度<span>{speedLabels[config.speedLevel-1]}</span></label><input id="speed" type="range" min="1" max="5" step="1" value={config.speedLevel} onChange={e=>update('speedLevel',Number(e.target.value))}/></>}<label className="barrage-row">文字闪烁<input type="checkbox" checked={config.blinkEnabled} onChange={e=>update('blinkEnabled',e.target.checked)}/></label></section>
 <section><h2>背景</h2>{swatches('backgroundColor')}{similarColors(config.textColor,config.backgroundColor)&&<p className="barrage-warning">文字和背景颜色比较接近，可能看不清</p>}</section>
 <section><h2>显示方向</h2>{options('orientation',[['landscape','横屏'],['portrait','竖屏']])}</section><button className="barrage-display-button" disabled={!config.text.trim()} onClick={display}>显示弹幕</button></main></div>;
}
