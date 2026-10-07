import Arrangements from "../../subpages/arrangements";
export default async function Page({params,searchParams}:{params:Promise<{tripId:string}>;searchParams:Promise<{[key:string]:string|undefined}>}){const {tripId}=await params;const query=await searchParams;return <Arrangements key={tripId} tripId={tripId} kind={query.kind==='stay'?'stay':'transport'} date={query.date||''}/>;}
