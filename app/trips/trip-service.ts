import type { Trip } from "../home-state";
import { ensureOwnership, isOwner, assertOwner } from "./ownership.js";
import { ensureRecycle, purgeExpired, trash, restore, purge } from "./trip-recycle.js";

export type ManagedTrip = Trip & { ownerUserId?: string; cover?: string; country?: string; countries?: string[]; startDate?: string; endDate?: string; deletedAt?: number; permanentlyDeleteAt?: number; members?: unknown[]; [key: string]: unknown };
type RecordRow = { tripId?: string; id?: string; nodeId?: string; place?: string; photos?: unknown[]; currency?: string; convertedAmountCNY?: number; originalAmount?: number; amount?: number; [key: string]: unknown };
export type TripData = { managerUserId?: string; currentTripId?: string | null; trips: ManagedTrip[]; packing: { tripId: string; packed?: boolean }[]; tickets: RecordRow[]; expenses: RecordRow[]; [key: string]: unknown };
export type EditForm = { name: string; city: string; country: string; start: string; end: string; cover: string };
const fallbackCover = "/images/departly/trip-japan.jpg";
const DATA_KEY = "departly_mvp_data_v1";
export const localDate = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
export const statusOf = (trip: ManagedTrip, today = localDate()) => trip.end < today ? "completed" : trip.start > today ? "upcoming" : "ongoing";
export function dateAt(start: string, index: number) { const date = new Date(start + "T00:00:00Z"); date.setUTCDate(date.getUTCDate() + index); return date.toISOString().slice(0, 10); }

export function readTrips(): TripData {
  const raw = localStorage.getItem(DATA_KEY);
  const data: TripData = raw ? JSON.parse(raw) : { trips: [], packing: [], tickets: [], expenses: [], currentTripId: null };
  if (!data || typeof data !== "object" || Array.isArray(data)) throw Error("本地旅程数据格式无效");
  for (const key of ["trips", "packing", "tickets", "expenses"] as const) {
    if (data[key] == null) data[key] = [];
    if (!Array.isArray(data[key])) throw Error("本地旅程数据格式无效");
  }
  const changed = ensureOwnership(data);
  const recycled = ensureRecycle(data);
  const removed = purgeExpired(data);
  if (changed || recycled || removed.length) localStorage.setItem(DATA_KEY, JSON.stringify(data));
  return data;
}
export function writeTrips(mutator: (data: TripData) => void) {
  const data = readTrips();
  mutator(data);
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event("departly-data-change"));
  return data;
}
export function groupedTrips(data: TripData, now = new Date()) {
  const today = localDate(now);
  const trips = data.trips.filter(t => !t.isDeleted).map(trip => {
    const days = trip.days || [], packing = data.packing.filter(p => p.tripId === trip.id);
    const records = data.tickets.filter(r => r.tripId === trip.id), places = new Set<string | undefined>();
    for (const day of days) for (const node of day.nodes || []) if (node.completed || node.done || (node as { status?: string }).status === "completed") places.add((node as { id?: string }).id || node.place);
    for (const record of records) places.add(record.nodeId || record.place || record.id);
    const photos = records.reduce((n, r) => n + (Array.isArray(r.photos) ? r.photos.length : 0), 0);
    const cny = (r: RecordRow) => typeof r.convertedAmountCNY === "number" && Number.isFinite(r.convertedAmountCNY) ? r.convertedAmountCNY : (r.currency || "CNY") === "CNY" ? Number(r.originalAmount ?? r.amount) : null;
    const known = data.expenses.filter(r => r.tripId === trip.id && cny(r) !== null), total = known.reduce((n, r) => n + Math.round(cny(r)! * 100), 0);
    const summary: string[] = [];
    if (places.size) summary.push(`${places.size} 个足迹`);
    if (photos) summary.push(`${photos} 张照片`);
    if (known.length) summary.push(`¥${(total / 100).toFixed(2)}`);
    const format = (value: string) => value.split("-").map(Number).join(".");
    return { ...trip, status: statusOf(trip, today), canManage: isOwner(data, trip), summary: summary.join(" · "), dateRange: `${format(trip.start)}—${format(trip.end)}`, cover: trip.cover || fallbackCover, countries: [...new Set((trip.countries || [trip.country]).flatMap(c => String(c || "").split(/[、,，/]/)).map(c => c.trim()).filter(Boolean))].slice(0, 3), duration: Math.floor((Date.parse(trip.end + "T00:00:00Z") - Date.parse(trip.start + "T00:00:00Z")) / 86400000) + 1, prepItems: [{ name: "行程规划", done: days.length > 0 && days.every(d => d.nodes?.length && d.nodes.every(n => n.place && n.start && n.type)) }, { name: trip.stays?.length ? "住宿已安排" : "住宿待完善", done: !!trip.stays?.length }, { name: "行李清单", done: packing.length > 0 && packing.every(p => p.packed) }] };
  });
  return [{ title: "旅行中", kind: "active", trips: trips.filter(t => t.start <= today && t.end >= today).sort((a, b) => a.start.localeCompare(b.start)) }, { title: "即将出行", kind: "upcoming", trips: trips.filter(t => t.start > today).sort((a, b) => a.start.localeCompare(b.start)) }, { title: "过往出行", kind: "past", trips: trips.filter(t => t.end < today).sort((a, b) => b.end.localeCompare(a.end)) }].filter(s => s.trips.length || s.kind === "upcoming" && trips.length);
}
export function editTrip(data: TripData, id: string, form: EditForm, now = new Date()) {
  const trip = data.trips.find(t => t.id === id && !t.isDeleted);
  if (!trip) throw Error("旅程已不存在或已删除");
  assertOwner(data, trip);
  const status = statusOf(trip, localDate(now));
  if (!form.name.trim()) throw Error("请填写旅程名称");
  if (status !== "completed") {
    const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
    if (!valid(form.start) || !valid(form.end) || form.end < form.start) throw Error("请填写有效日期");
    if (trip.days?.length && dateAt(form.start, trip.days.length - 1) > form.end) throw Error("结束日期需覆盖已有每日安排，请先调整行程天数");
  }
  if (status === "upcoming" && !form.city.trim()) throw Error("请填写目的地");
  Object.assign(trip, { name: form.name.trim(), cover: form.cover });
  if (status === "upcoming") Object.assign(trip, { city: form.city.trim(), country: form.country });
  if (status !== "completed") {
    if (form.start !== trip.start) for (const [index, day] of (trip.days || []).entries()) day.date = dateAt(form.start, index);
    Object.assign(trip, { start: form.start, end: form.end, startDate: form.start, endDate: form.end });
  }
}
export const deleteTrip = (data: TripData, id: string, now = Date.now()) => trash(data, id, now);
export const restoreTrip = (data: TripData, id: string, now = Date.now()) => restore(data, id, now);
export const purgeTrip = (data: TripData, id: string) => purge(data, id);
export function selectTrip(id: string) { writeTrips(data => { if (!data.trips.some(t => t.id === id && !t.isDeleted)) throw Error("该旅程已不存在"); data.currentTripId = id; }); }
