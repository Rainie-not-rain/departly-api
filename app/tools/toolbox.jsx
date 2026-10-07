"use client";
import Link from 'next/link';
import BottomNavigation from '../components/bottom-navigation';
import Xiaobu from '../components/xiaobu';
import './tools.css';
const tools=[['decision','做个决定','转一下，纠结交给运气'],['barrage','手持弹幕','接机举牌不用纸'],['ruler','屏幕量尺','随手一量就清楚'],['compass','指南针','抬起手机，认准方向'],['woodfish','电子木鱼','敲一下，功德 +1']];
export default function Toolbox(){return <div className="web-frame tools-frame"><main className="page top-space toolbox"><h1 className="tools-title">旅途工具箱</h1><p className="muted tools-sub">轻装出发，把麻烦留给工具</p><div className="tool-grid">{tools.map(([id,title,description])=><Link className="tool-card" key={id} href={`/tools/${id}`}><div className={`tool-icon ${id}`}><img src={`/images/icons/tool-${id}.svg`} alt=""/></div><strong>{title}</strong><span>{description}</span></Link>)}</div><a className="feedback-entry press" href="https://www.wjx.cn/vm/tCrfYUG.aspx" target="_blank" rel="noopener noreferrer"><strong>帮助与反馈</strong><span>有问题或建议？告诉我们</span></a></main><BottomNavigation selected={3} onUnavailable={()=>{}}/><Xiaobu onUnavailable={()=>{}}/></div>;}
