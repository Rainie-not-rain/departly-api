import Copilot from '../../copilot';
export default async function Page({params}:{params:Promise<{tripId:string}>}){const {tripId}=await params;return <Copilot tripId={tripId}/>;}
