"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BottomNavigation from "./components/bottom-navigation";
import Xiaobu from "./components/xiaobu";
import { selectTrip } from "./trips/trip-service";
import { DATA_KEY, SEASON_KEY, homeState, homeQuickDestination, monthSeason, seasons, type HomeData, type Season } from "./home-state";

type Weather = { city: string; temperature: string; condition: string; icon: string; tip: string };

export default function Home() {
  const router = useRouter();
  const [data, setData] = useState<HomeData>({});
  const [now, setNow] = useState<Date | null>(null);
  const [season, setSeason] = useState<Season>("summer");
  const [notice, setNotice] = useState("");
  const [weather, setWeather] = useState<Weather | null>(null);
  const [weatherError, setWeatherError] = useState("");
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherRetry, setWeatherRetry] = useState(0);
  const frame = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const state = homeState(data, now || new Date(2026, 0, 1, 8));

  useEffect(() => {
    function load() {
      setNow(new Date());
      try {
        const raw = localStorage.getItem(DATA_KEY);
        const stored = raw ? JSON.parse(raw) : {};
        if (typeof stored !== "object" || stored === null || (stored.trips && !Array.isArray(stored.trips)) || (stored.packing && !Array.isArray(stored.packing))) throw Error("首页旅行数据格式无效");
        setData(stored);
        const saved = localStorage.getItem(SEASON_KEY);
        const next = seasons.includes(saved as Season) ? saved as Season : monthSeason(new Date().getMonth() + 1);
        setSeason(next);
        if (!saved) localStorage.setItem(SEASON_KEY, next);

      } catch (error) {
        console.error(error);
        setNotice(error instanceof Error ? error.message : "无法读取浏览器本地数据");
      }
    }
    load();
    window.addEventListener("storage", load);
    window.addEventListener("departly-data-change", load);
    window.addEventListener("focus", load);
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => { window.removeEventListener("storage", load); window.removeEventListener("departly-data-change", load); window.removeEventListener("focus", load); clearInterval(timer); if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  useEffect(() => {
    if (state.state !== "active") return;
    const controller = new AbortController();
    let disposed = false;
    const key = process.env.NEXT_PUBLIC_AMAP_WEB_KEY;
    setWeather(null);
    setWeatherError("");
    if (!state.weatherCity || !key) {
      setWeatherLoading(false);
      setWeatherError(!state.weatherCity ? "请先填写当天行程城市" : "Web 天气服务尚未配置");
      return;
    }
    setWeatherLoading(true);
    async function loadWeather() {
      async function get(path: string, params: Record<string, string>) {
        const response = await fetch(`https://restapi.amap.com/v3/${path}?${new URLSearchParams({ key: key!, ...params })}`, { signal: controller.signal });
        if (!response.ok) throw Error("天气查询失败");
        const result = await response.json();
        if (String(result.status) !== "1") throw Error(`高德接口：${result.info || "响应异常"}（${result.infocode || "未知"}）`);
        return result;
      }
      let city = state.weatherCity;
      if (!/^\d{6}$/.test(city)) {
        const result = await get("config/district", { keywords: city, subdistrict: "0" });
        const matches = (result.districts || []).filter((d: { level: string; name: string }) => d.level === "city" || d.level === "district" || d.level === "province" && ["北京", "上海", "天津", "重庆"].some(n => d.name.startsWith(n)));
        if (matches.length !== 1) throw Error("该城市暂无天气数据或名称不明确");
        city = matches[0].adcode;
      }
      const result = await get("weather/weatherInfo", { city, extensions: "base" });
      const live = result.lives?.[0];
      if (!live || live.temperature == null || !live.weather) throw Error("暂无实时天气数据");
      const condition = live.weather, temp = Number(live.temperature);
      if (disposed) return;
      setWeather({ city: live.city, temperature: live.temperature, condition, icon: /雪/.test(condition) ? "snow" : /雨/.test(condition) ? "rain" : /阴|雾|霾/.test(condition) ? "overcast" : /云/.test(condition) ? "cloud" : "sun", tip: /雨|雪/.test(condition) ? "记得携带雨具，注意路面湿滑" : temp >= 30 ? "注意防晒补水，避开午后高温" : temp <= 10 ? "天气较凉，出门注意保暖" : "天气舒适，适合城市漫步" });
    }
    const timeout = setTimeout(() => controller.abort(), 20000);
    loadWeather().catch(error => { if (disposed) return; if (!controller.signal.aborted) setWeatherError(error.message || "天气加载失败，请稍后重试"); else setWeatherError("天气请求超时"); }).finally(() => { clearTimeout(timeout); if (!disposed) setWeatherLoading(false); });
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); };
  }, [state.state, state.weatherCity, weatherRetry]);

  function toast(text: string) { setNotice(text); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setNotice(""), 2200); }
  function unopened(name: string) { toast(`暂时无法打开${name}，请稍后再试。`); }
  function openQuick(name: string) {
    if (name === '我的旅程') { router.push('/trips'); return; }
    const target=homeQuickDestination(data,now||new Date(),name==='快速记账'?'ledger/entry':'checkin');
    try { if(target.tripId)selectTrip(target.tripId);router.push(target.href); }
    catch (error) { toast(error instanceof Error ? error.message : '无法打开旅程'); }
  }
  function cycleSeason() {
    const next = seasons[(seasons.indexOf(season) + 1) % seasons.length];
    try { localStorage.setItem(SEASON_KEY, next); setSeason(next); toast(`已切换为${{ spring: "春季", summer: "夏季", autumn: "秋季", winter: "冬季" }[next]}`); } catch { toast("无法保存季节设置"); }
  }

  return (
    <div className="web-frame" ref={frame}>
      <main className="home page">
        <section className="weather-card" onClick={cycleSeason} aria-label="旅行概览，点击背景切换季节">
          {/* 原素材直接复用，不使用会重新裁切原图的远程图片服务。 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="season-bg" src={`/images/departly/season-${season}.jpg`} alt="" />
          <div className="weather-shade" />
          <div className="weather-content">
            <h1 className={`hero-title ${state.state === "upcoming" ? "departure-title" : ""}`} onClick={e => e.stopPropagation()}>{state.title}</h1>
            <div className="weather-copy" onClick={e => e.stopPropagation()}>
              {state.state === "none" ? <><span className="greeting">{state.greeting}，旅行者！</span><span className="hero-guide">世界很大，总有一段旅程在等你</span></> : state.state === "upcoming" ? <><span className="greeting">{state.summary}</span><span className="hero-date">{state.tripDate}</span><div className="hero-prep">{state.prepItems.map(item => <span key={item.name} className={item.done ? "ready" : "pending"}>{item.done ? "✓" : "○"} {item.name}</span>)}</div></> : <>
                <span className="hero-date">{state.todayContext}</span>
                <div className="journey-weather">{weather ? <><div className="journey-weather-row"><img className="weather-icon" src={`/images/icons/weather-${weather.icon}.svg`} alt={weather.condition} /><span>{weather.city}</span><span>{weather.temperature}°C</span><span>{weather.condition}</span></div><span className="journey-weather-tip">{weather.tip}</span></> : weatherLoading ? <span className="journey-weather-tip">天气加载中…</span> : <div className="weather-error"><span className="journey-weather-tip">{weatherError}</span><button className="weather-retry" onClick={() => setWeatherRetry(n => n + 1)}>重试</button></div>}</div>
                <div className="today-card"><div className="today-icon" aria-hidden="true"><span>✓</span><div /></div><div className="today-copy"><span className="today-title">今日行程</span><span className="today-progress">{state.todayNodes.length} 个地点 · 已完成 {state.completedStops} 个</span></div></div>
              </>}
            </div>
            <button className={`hero-action ${state.state === "upcoming" ? "hero-prepare" : ""} press`} onClick={e => { e.stopPropagation(); try { if (state.trip) selectTrip(state.trip.id); router.push(state.trip ? `/trip/${encodeURIComponent(state.trip.id)}` : "/trip/create"); } catch (error) { toast(error instanceof Error ? error.message : "无法打开旅程"); } }}>{state.action}<span className="hero-cta-arrow">→</span></button>
          </div>
        </section>
        <h2 className="section-title">旅途快捷入口</h2>
        <div className="grid-3 quick-grid">
          {[{ name: "我的旅程", color: "sage", icon: "quick-map.svg" }, { name: "快速记账", color: "sky", icon: "quick-ledger.png" }, { name: "景点打卡", color: "yellow", icon: "quick-checkin.svg" }].map(item => <button key={item.name} className={`quick ${item.color} press`} onClick={() => openQuick(item.name)}><img className="quick-icon-image" src={`/images/icons/${item.icon}`} alt="" /><span>{item.name}</span></button>)}
        </div>
      </main>
      <Xiaobu onUnavailable={unopened} />
      <BottomNavigation selected={0} onUnavailable={unopened} />
      {notice && <div className="home-toast" role="status">{notice}</div>}
    </div>
  );
}
