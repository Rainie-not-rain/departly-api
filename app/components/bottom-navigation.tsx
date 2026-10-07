"use client";

import Link from "next/link";

const tabs = [
  { name: "首页", href: "/", icon: "home.png", active: "home-active.png" },
  { name: "行程", href: "/trip", icon: "business.png", active: "business-active.png" },
  { name: "创建行程", href: "/trip/create", icon: "add", active: "add" },
  { name: "工具", href: "/tools", icon: "goods.png", active: "goods-active.png" },
  { name: "足迹", href: "/footprints", icon: "footprint.svg", active: "footprint-active.svg" },
];
export default function BottomNavigation({ selected, onUnavailable, tripHref }: { selected: number; onUnavailable: (name: string) => void; tripHref?: string }) {
  return <nav className="tab-shell" aria-label="底部导航">{tabs.map((tab, index) => {
    const className = `tab-item ${selected === index ? "selected" : ""} ${tab.icon === "add" ? "add-item" : ""}`;
    const contents = tab.icon === "add" ? <span className="add-icon" aria-hidden="true" /> : <><img className="tab-icon" src={`/images/icons/${selected === index ? tab.active : tab.icon}`} alt="" /><span>{tab.name}</span></>;
    return tab.href ? <Link key={tab.name} className={className} href={index === 1 && tripHref ? tripHref : tab.href} aria-label={tab.name} aria-current={selected === index ? "page" : undefined}>{contents}</Link> : <button key={tab.name} className={className} aria-label={tab.name} onClick={() => onUnavailable(tab.name)}>{contents}</button>;
  })}</nav>;
}
