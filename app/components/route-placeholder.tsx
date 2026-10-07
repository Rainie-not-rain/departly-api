"use client";

import Link from "next/link";
import BottomNavigation from "./bottom-navigation";

export default function RoutePlaceholder({ title, tripId }: { title: string; tripId?: string }) {
  return <div className="web-frame"><main className="page top-space"><div className="row"><Link className="back" href="/trips" aria-label="返回我的旅程">‹</Link><h1 className="page-title">{title}</h1></div><p className="muted placeholder-note">此页面尚未迁移。</p>{tripId && <p className="muted">旅程编号：{tripId}</p>}{title === "回收站" && <p className="muted">已删除旅程在本地保留7天，本轮未迁移回收站界面。</p>}</main><BottomNavigation selected={title === "创建旅程" ? 2 : 1} onUnavailable={name => window.alert(`${name}页面尚未迁移到 Web`)} /></div>;
}
