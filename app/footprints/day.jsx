"use client";
import {useState} from 'react';
import Link from 'next/link';
import {getByDate,photoPath} from '../../lib/footprints.js';
import {isOwner} from '../trips/ownership.js';
import checkins from '../trip/subpages/checkinService.js';
import {Sheet} from '../trip/subpages/shared';
import {useFootprints,FootprintFrame} from './shared';
export default function FootprintDay({date}){
 const {data,error,setError,refresh}=useFootprints(),[preview,setPreview]=useState(null),[remove,setRemove]=useState(null),rows=data?getByDate(data,date):[];
 const confirm=()=>{try{checkins.deleteCheckin(remove.id);setRemove(null);refresh();}catch(e){setError(e.message);}};
 return <FootprintFrame title="当天足迹" error={error}><p className="muted">{date}</p>{rows.map(row=><section key={row.id} className="card record"><strong className="label">{row.placeName}</strong><span className="muted">{row.tripName}{row.dayIndex?` · Day ${row.dayIndex}`:''}</span>{row.moodText&&<span>{row.moodText}</span>}{row.note&&<p>{row.note}</p>}<div className="photos">{row.photos.map((photo,i)=><button key={photo.id} aria-label={`查看${row.placeName}照片${i+1}`} onClick={()=>setPreview({paths:row.photos.map(photoPath),index:i})}><img src={photoPath(photo)} alt={row.placeName}/></button>)}</div>{isOwner(data,data.trips.find(t=>t.id===row.tripId))&&<div className="actions">{row.itineraryItemId&&<Link href={`/trip/${encodeURIComponent(row.tripId)}/checkin?itemId=${encodeURIComponent(row.itineraryItemId)}&dayId=${encodeURIComponent(row.dayId||'')}`}>编辑记录</Link>}{!row.completionOnly&&<button onClick={()=>setRemove(row)}>删除</button>}</div>}</section>)}{data&&!rows.length&&<p className="empty">这一天还没有留下足迹</p>}{preview&&<Sheet title="照片预览" className="footprint-photo-preview" onClose={()=>setPreview(null)}><img src={preview.paths[preview.index]} alt="足迹照片"/><div className="between"><button disabled={preview.index===0} onClick={()=>setPreview({...preview,index:preview.index-1})}>上一张</button><span>{preview.index+1} / {preview.paths.length}</span><button disabled={preview.index===preview.paths.length-1} onClick={()=>setPreview({...preview,index:preview.index+1})}>下一张</button></div></Sheet>}{remove&&<Sheet title="删除这条足迹？" onClose={()=>setRemove(null)}><p>对应照片、票根和手账页也会移除。</p><div className="between"><button className="secondary" onClick={()=>setRemove(null)}>取消</button><button className="primary" onClick={confirm}>确认删除</button></div></Sheet>}</FootprintFrame>;
}
