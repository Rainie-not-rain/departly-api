export type Stop = { place?: string; start?: string; type?: string; status?: string; done?: boolean; completed?: boolean; visited?: boolean };
export type Trip = { id: string; name?: string; city?: string; adcode?: string; start: string; end: string; isDeleted?: boolean; stays?: unknown[]; days?: { date?: string; city?: string; adcode?: string; nodes?: Stop[] }[] };
export type HomeData = { currentTripId?: string | null; trips?: Trip[]; packing?: { tripId: string; packed?: boolean }[] };
export const DATA_KEY = "departly_mvp_data_v1";
export const SEASON_KEY = "departly_home_season";
export const seasons = ["spring", "summer", "autumn", "winter"] as const;
export type Season = typeof seasons[number];
export function homeQuickDestination(data: HomeData, now: Date, kind: 'ledger/entry' | 'checkin') {
  const trips=(data.trips||[]).filter(t=>!t.isDeleted);
  const trip=homeState(data,now).trip||trips.find(t=>t.id===data.currentTripId)||trips[0];
  return trip?{tripId:trip.id,href:`/trip/${encodeURIComponent(trip.id)}/${kind}`}:{tripId:null,href:'/trip/create'};
}
export function monthSeason(month: number): Season {
  return month >= 3 && month <= 5 ? "spring" : month >= 6 && month <= 8 ? "summer" : month >= 9 && month <= 11 ? "autumn" : "winter";
}
const dateValue = (value: string) => { const [y, m, d] = value.split("-").map(Number); return Date.UTC(y, m - 1, d); };
export function homeState(data: HomeData, now: Date) {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const trips = (data.trips || []).filter(t => !t.isDeleted && t.start && t.end && t.end >= t.start);
  const active = trips.filter(t => t.start <= today && t.end >= today);
  const trip = active.find(t => t.id === data.currentTripId) || active.sort((a, b) => a.start.localeCompare(b.start))[0] || trips.filter(t => t.start > today).sort((a, b) => a.start.localeCompare(b.start))[0] || null;
  const state = trip ? trip.start > today ? "upcoming" : "active" : "none";
  const day = trip ? Math.max(0, Math.floor((dateValue(today) - dateValue(trip.start)) / 86400000)) : 0;
  const days = trip?.days || [], todayPlan = days.find(d => d.date === today) || days[day], todayNodes = todayPlan?.nodes || [];
  const planningDone = days.length > 0 && days.every(d => d.nodes?.length && d.nodes.every(n => n.place && n.start && n.type));
  const packing = (data.packing || []).filter(p => p.tripId === trip?.id), packed = packing.filter(p => p.packed).length;
  const destination = trip && (trip.city || trip.name), daysLeft = trip ? Math.floor((dateValue(trip.start) - dateValue(today)) / 86400000) : 0;
  const duration = trip ? Math.floor((dateValue(trip.end) - dateValue(trip.start)) / 86400000) + 1 : 0;
  return {
    trip, state, day, todayNodes, completedStops: todayNodes.filter(n => n.status === 'completed' || n.done === true || n.completed === true || n.visited === true).length,
    weatherCity: todayPlan?.adcode || todayPlan?.city || trip?.adcode || trip?.city || "",
    title: state === "upcoming" ? `距离出发${destination}，\n还有${daysLeft}天` : state === "active" ? `${destination} · Day ${day + 1}` : "下一次出发，\n去哪里？",
    action: state === "none" ? "创建一趟旅行" : state === "upcoming" ? "继续准备" : "继续今天的旅程",
    summary: trip ? `${destination} · ${duration}日游` : "",
    tripDate: trip ? `${trip.start.replace(/-/g, ".")}—${trip.end.replace(/-/g, ".")}` : "",
    todayContext: `${now.getMonth() + 1}月${now.getDate()}日 · ${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][now.getDay()]}`,
    greeting: now.getHours() < 11 ? "早上好" : now.getHours() < 18 ? "下午好" : "晚上好",
    prepItems: [{ name: planningDone ? "行程已安排" : "行程待完善", done: planningDone }, { name: trip?.stays?.length ? "住宿已安排" : "住宿待完善", done: !!trip?.stays?.length }, { name: `行李 ${packed}/${packing.length}`, done: packing.length > 0 && packed === packing.length }],
  };
}
