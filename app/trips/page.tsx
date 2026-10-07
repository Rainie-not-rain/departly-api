"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Xiaobu from "../components/xiaobu";
import ConfirmationDialog from "../components/confirmation-dialog";
import { readTrips, writeTrips, groupedTrips, editTrip, deleteTrip, statusOf, selectTrip, type TripData, type EditForm } from "./trip-service";
import { isOwner } from "./ownership.js";
import "./trips.css";

export default function TripsPage() {
  const [data, setData] = useState<TripData | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");
  const [editId, setEditId] = useState("");
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState<EditForm>({ name: "", city: "", country: "", start: "", end: "", cover: "" });
  const fileInput = useRef<HTMLInputElement>(null);
  const fileEpoch = useRef(0);
  const [picking, setPicking] = useState(false);
  const sections = data && now ? groupedTrips(data, now) : [];
  const empty = data && !sections.length;
  const edited = data?.trips.find(t => t.id === editId);
  const editStatus = edited ? statusOf(edited) : "";

  function refresh() { try { setData(readTrips()); setNow(new Date()); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "无法读取本地旅程"); } }
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("storage", refresh); window.addEventListener("focus", refresh); window.addEventListener("departly-data-change", refresh);
    return () => { clearInterval(timer); fileEpoch.current++; window.removeEventListener("storage", refresh); window.removeEventListener("focus", refresh); window.removeEventListener("departly-data-change", refresh); };
  }, []);
  useEffect(() => {
    if (!editId && !actionId) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { closeEdit(); setActionId(""); }
      if (e.key !== "Tab") return;
      const items = Array.from(document.querySelectorAll<HTMLElement>('.journeys [role="dialog"] button:not([disabled]), .journeys [role="dialog"] input:not([hidden]):not([disabled]), .journeys [role="dialog"] a[href]'));
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", handler);
    return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", handler); if (previous?.isConnected) previous.focus(); };
  }, [editId, actionId]);
  function showError(e: unknown) { window.alert(e instanceof Error ? e.message : "操作失败，请重试"); }
  function openEdit(id: string) {
    try { const latest = readTrips(), trip = latest.trips.find(t => t.id === id && !t.isDeleted); if (!trip || !isOwner(latest, trip)) throw Error("只有创建者可以编辑旅程"); fileEpoch.current++; setData(latest); setActionId(""); setEditId(id); setForm({ name: trip.name || "", city: trip.city || "", country: trip.country || "", start: trip.start, end: trip.end, cover: trip.cover || "/images/departly/trip-japan.jpg" }); } catch (e) { showError(e); }
  }
  function closeEdit() { fileEpoch.current++; setPicking(false); setEditId(""); }
  function save() {
    try {
      const latest = readTrips();
      const current = latest.trips.find(t => t.id === editId && !t.isDeleted);
      if (!current) throw Error("旅程已不存在或已删除");
      editTrip(structuredClone(latest), editId, form);
      if (statusOf(current) === "ongoing" && (current.start !== form.start || current.end !== form.end) && !window.confirm("修改旅行日期？\n日期修改会影响旅程状态和当前查看的日期，请确认。")) return;
      writeTrips(data => editTrip(data, editId, form)); closeEdit(); refresh();
    } catch (e) { showError(e); }
  }
  function remove(id: string) {
    setActionId("");
    try { const trip = readTrips().trips.find(t => t.id === id && !t.isDeleted); if (!trip) throw Error("该旅程已不存在"); setDeleting({ id, name: trip.name || "" }); } catch (e) { showError(e); }
  }
  function confirmDelete() {
    if (!deleting) return;
    try { writeTrips(data => deleteTrip(data, deleting.id)); setDeleting(null); refresh(); } catch (e) { setDeleting(null); showError(e); }
  }
  async function chooseCover(file?: File) {
    if (!file) return;
    const epoch = fileEpoch.current;
    try {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 2 * 1024 * 1024) throw Error("请选择2MB以内的 JPG、PNG 或 WebP 照片");
      setPicking(true);
      const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(Error("照片读取失败")); reader.readAsDataURL(file); });
      const image = new Image(); image.src = url; await image.decode();
      if (epoch === fileEpoch.current) setForm(f => ({ ...f, cover: url }));
    } catch (e) { if (epoch === fileEpoch.current) showError(e); } finally { if (epoch === fileEpoch.current) setPicking(false); if (fileInput.current) fileInput.current.value = ""; }
  }
  function fallbackImage(e: React.SyntheticEvent<HTMLImageElement>) { const img = e.currentTarget; if (img.getAttribute("src") !== "/images/departly/trip-japan.jpg") { img.src = "/images/departly/trip-japan.jpg"; img.alt = "原封面无法读取，显示默认封面"; img.title = "原封面无法读取，显示默认封面"; } }
  const field = (key: keyof EditForm, value: string) => setForm(f => ({ ...f, [key]: value }));

  return <div className="web-frame"><main className={`page top-space journeys ${empty ? "journeys-empty" : ""}`}>
    <header className="row header"><Link className="back press" href="/" aria-label="返回首页">‹</Link><h1 className="page-title">我的旅程</h1></header>
    {error ? <p role="alert">{error}<button onClick={refresh}>重试</button></p> : !data ? <p className="muted">读取旅程中…</p> : empty ? <div className="journey-empty"><span className="muted">还没有旅程，创建你的第一次出发吧</span><Link className="primary press" href="/trip/create">创建一趟旅行</Link><Link className="recycle-footer press" href="/trips/recycle">回收站 ›</Link></div> : <>
      {sections.map(section => <section key={section.title}><h2 className="section-title block">{section.title}</h2><div className={section.kind === "upcoming" ? "trip-scroll" : ""}>{!section.trips.length && <span className="muted">暂无即将出行的旅程</span>}{section.trips.map(trip => {
        const href = `/trip/${encodeURIComponent(trip.id)}${trip.status === "completed" ? "/review" : "?day=0"}`;
        const cover = <img className={section.kind === "active" ? "active-cover" : "cover"} src={trip.cover} alt="旅程封面" loading="lazy" onError={fallbackImage} />;
        return <div key={trip.id} className={`trip-card-wrap ${section.kind === "upcoming" ? "trip-mini-wrap" : ""}`}><Link className={`card card-open press ${section.kind === "active" ? "active-trip" : section.kind === "upcoming" ? "trip-mini" : "past"}`} href={href} onClick={e => { if (trip.status === "completed") return; try { selectTrip(trip.id); } catch (error) { e.preventDefault(); showError(error); } }}>{cover}
          {section.kind === "active" ? <div className="active-info"><div className="active-head"><span className="active-name">{trip.name}</span><div className="country-tags">{trip.countries.map(country => <span className="country-tag" key={country}>{country}</span>)}</div><span className="active-arrow">›</span></div><span className="active-date">{trip.dateRange}</span><div className="prep-list">{trip.prepItems.map(prep => <div key={prep.name} className={`prep-item ${prep.done ? "done" : "pending"}`}><span>{prep.done ? "✓" : "●"}</span><span>{prep.name}</span></div>)}</div></div> : section.kind === "upcoming" ? <div className="trip-mini-copy"><div className="mini-title-row"><span className="journey-name">{trip.name} · {trip.duration}天</span><span className="trip-mini-arrow" aria-hidden="true">›</span></div><span className="muted">{trip.dateRange}</span></div> : <><div className="past-copy"><span className="journey-name">{trip.name}</span><span className="muted">{trip.dateRange}</span>{trip.summary && <span className="muted">{trip.summary}</span>}</div><span>›</span></>}
        </Link>{trip.canManage && <button className="trip-menu" aria-label={`管理旅程 ${trip.name}`} onClick={() => setActionId(trip.id)}>···</button>}</div>;
      })}</div></section>)}<Link className="recycle-footer press" href="/trips/recycle">回收站 ›</Link>
    </>}
    <Link className="trip-add-fab" href="/trip/create" aria-label="创建一趟旅行"><span className="trip-add-plus" /></Link>
    {deleting && <ConfirmationDialog title={`删除「${deleting.name}」？`} content="删除后将进入回收站保留 7 天，期间可以恢复。关联行程、成员、账本、打卡和照片暂时不会永久删除。" confirmText="删除" onCancel={() => setDeleting(null)} onConfirm={confirmDelete} />}
    {actionId && <div className="edit-mask" onClick={() => setActionId("")}><div className="trip-action-sheet" role="dialog" aria-modal="true" aria-label="旅程操作" onClick={e => e.stopPropagation()}><button className="trip-action-edit" autoFocus onClick={() => openEdit(actionId)}>编辑旅程</button><button className="trip-action-delete" onClick={() => remove(actionId)}>删除旅程</button><button className="trip-action-cancel" onClick={() => setActionId("")}>取消</button></div></div>}
    {editId && <div className="edit-mask" onClick={closeEdit}><form className="edit-sheet" role="dialog" aria-modal="true" aria-label="编辑旅程" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); save(); }}><div className="row between"><h2 className="section-title">编辑旅程</h2><button type="button" onClick={closeEdit} aria-label="关闭">×</button></div><label className="label" htmlFor="trip-name">旅程名称</label><input id="trip-name" className="input" autoFocus value={form.name} onChange={e => field("name", e.target.value)} />{editStatus === "upcoming" && <><label className="label" htmlFor="trip-city">目的地</label><input id="trip-city" className="input" value={form.city} onChange={e => field("city", e.target.value)} /></>}{editStatus !== "completed" && <div className="edit-dates"><input className="input" type="date" aria-label="出发日期" value={form.start} onChange={e => field("start", e.target.value)} /><input className="input" type="date" aria-label="结束日期" value={form.end} onChange={e => field("end", e.target.value)} /></div>}<button type="button" className="edit-cover" disabled={picking} onClick={() => fileInput.current?.click()}><img src={form.cover} alt="旅程封面" onError={fallbackImage} /><span>修改封面 ›</span></button><input ref={fileInput} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e => chooseCover(e.target.files?.[0])} />{editStatus !== "completed" && <Link className="edit-members" href={`/trip/${encodeURIComponent(editId)}/members`}>同行成员管理 ›</Link>}<div className="edit-actions"><button type="button" className="secondary" onClick={closeEdit}>取消</button><button className="primary" disabled={picking}>保存</button></div></form></div>}
  </main><Xiaobu onUnavailable={name => window.alert(`暂时无法打开${name}，请稍后再试。`)} /></div>;
}
