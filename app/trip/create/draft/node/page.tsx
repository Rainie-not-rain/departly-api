import NodeEditor from "../../../node-editor";
export default async function Page({searchParams}:{searchParams:Promise<{dayId?:string;nodeId?:string;day?:string}>}){const query=await searchParams;return <NodeEditor dayId={query.dayId||""} nodeId={query.nodeId||""} day={Number.isFinite(Number(query.day))?Math.max(0,Math.floor(Number(query.day))):0}/>;}
