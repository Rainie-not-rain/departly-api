import Checkin from "../../subpages/checkin";
export default async function Page({params,searchParams}:{params:Promise<{tripId:string}>;searchParams:Promise<{[key:string]:string|undefined}>}){const {tripId}=await params;const query=await searchParams;return <Checkin key={tripId} tripId={tripId} dayId={query.dayId||''} itemId={query.itemId||query.nodeId||''}/>;}
