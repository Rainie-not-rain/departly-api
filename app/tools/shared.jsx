"use client";
import Link from 'next/link';
import './tools.css';
export function ToolHeader({title,back='/tools'}){return <header className="tool-header"><Link href={back} aria-label="返回上一页"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></Link><h1>{title}</h1></header>;}
