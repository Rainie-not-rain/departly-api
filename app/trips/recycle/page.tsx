"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Xiaobu from "../../components/xiaobu";
import ConfirmationDialog from "../../components/confirmation-dialog";
import { readTrips, writeTrips, restoreTrip, purgeTrip, type TripData } from "../trip-service";
import { isOwner } from "../ownership.js";
import "./recycle.css";

export default function RecyclePage() {
  const [data, setData] = useState<TripData | null>(null);
  const [now, setNow] = useState(0);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function refresh() { try { setData(readTrips()); setNow(Date.now()); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "无法读取回收站"); } }
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("storage", refresh); window.addEventListener("focus", refresh); window.addEventListener("departly-data-change", refresh);
    return () => { clearInterval(timer); if (toastTimer.current) clearTimeout(toastTimer.current); window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); window.removeEventListener("departly-data-change", refresh); };
  }, []);
  function notify(message: string) { setToast(message); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 2200); }
  function manage(id: string, permanent: boolean) {
    setDeleting("");
    try { writeTrips(data => permanent ? purgeTrip(data, id) : restoreTrip(data, id)); refresh(); notify(permanent ? "已永久删除" : "旅程已恢复"); }
    catch (e) { refresh(); window.alert(`${permanent ? "删除失败" : "无法恢复"}：${e instanceof Error ? e.message : "请重试"}`); }
  }
  const trips = data ? data.trips.filter(trip => trip.isDeleted && isOwner(data, trip)).sort((a, b) => Number(b.deletedAt) - Number(a.deletedAt)) : [];
  return <div className="web-frame"><main className="page top-space recycle-page">
    <header className="row"><Link className="back press" href="/trips" aria-label="返回我的旅程">‹</Link><h1 className="page-title">回收站</h1></header>
    <p className="recycle-note">旅程保留 7 天，可在到期前恢复。到期后再次打开 Web App 或回收站时永久清理。</p>
    {error ? <p role="alert">{error}<button onClick={refresh}>重试</button></p> : !data ? <p className="muted">读取回收站中…</p> : !trips.length ? <div className="card recycle-empty">回收站是空的</div> : trips.map(trip => <article key={trip.id} className="card recycle-card">
      <h2 className="recycle-name">{trip.name}</h2><span className="muted">{trip.start}—{trip.end}</span>
      <span className="recycle-expiry">{Math.max(1, Math.ceil((Number(trip.permanentlyDeleteAt) - now) / 86400000))} 天后永久删除</span>
      <div className="recycle-actions"><button className="primary" onClick={() => manage(trip.id, false)}>恢复</button><button className="secondary" onClick={() => setDeleting(trip.id)}>永久删除</button></div>
    </article>)}
    {deleting && <ConfirmationDialog title="永久删除后无法恢复" content="将永久删除该旅程的行程、成员、行李清单、账本、打卡记录、图片/票根和旅程回顾。" confirmText="永久删除" onCancel={() => setDeleting("")} onConfirm={() => manage(deleting, true)} />}
  </main><Xiaobu onUnavailable={name => notify(`暂时无法打开${name}，请稍后再试。`)} />{toast && <div className="home-toast" role="status">{toast}</div>}</div>;
}
