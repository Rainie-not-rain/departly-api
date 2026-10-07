import SettlementPage from "../../subpages/settlement-page";
export default async function Page({params}:{params:Promise<{tripId:string}>}){const {tripId}=await params;return <SettlementPage key={tripId} tripId={tripId}/>;}
