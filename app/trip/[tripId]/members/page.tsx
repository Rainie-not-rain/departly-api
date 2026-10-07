import Members from "../../subpages/members";
export default async function Page({params,searchParams}:{params:Promise<{tripId:string}>;searchParams:Promise<{[key:string]:string|undefined}>}){const {tripId}=await params;const query=await searchParams;return <Members key={tripId} tripId={tripId}/>;}
