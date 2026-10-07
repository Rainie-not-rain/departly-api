import { readTrips } from "../trips/trip-service";
import { assertOwner } from "../trips/ownership.js";
import { DRAFT_KEY, makeDraft } from "./detail-service.js";
import { validateTimes, sortItemsByTime, suggestTimeSlots } from "./trip-schedule.js";
import type { TripDraft } from "./trip-draft";
export type Draft = TripDraft;
function checkOwnership(draft: Draft) { const data=readTrips(),trip=data.trips.find(t=>t.id===draft.id);if(trip){if(trip.isDeleted)throw Error("旅程不存在或已删除");assertOwner(data,trip);} }
export function saveDraft(draft: Draft) { checkOwnership(draft);if(!["ai_generate","manual","text_import"].includes(draft.creationMode)||!Array.isArray(draft.days)||!draft.days.length)throw Error("行程草稿格式无效");for(const day of draft.days){for(const item of day.items||[])validateTimes(item);day.items=draft.creationMode==="text_import"?suggestTimeSlots(day.items||[]):sortItemsByTime(day.items||[]);}draft.updatedAt=Date.now();localStorage.setItem(DRAFT_KEY,JSON.stringify(draft));return draft; }
export function readDraft(tripId?: string): Draft { const raw=localStorage.getItem(DRAFT_KEY);if(raw){const draft=JSON.parse(raw);if(!tripId||draft.id===tripId){checkOwnership(draft);if(!Array.isArray(draft.days)||!draft.days.length)throw Error("行程草稿格式无效");return draft;}}if(tripId)return saveDraft(makeDraft(readTrips(),tripId));throw Error("还没有行程草稿，请先填写创建信息"); }
export function beginDraft(tripId: string) { return saveDraft(makeDraft(readTrips(),tripId)); }
