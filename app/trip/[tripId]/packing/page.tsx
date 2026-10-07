import TripSubpagePlaceholder from "../../subpage-placeholder";
export default async function Page({params}:{params:Promise<{tripId:string}>}) {const {tripId}=await params;return <TripSubpagePlaceholder title="行李清单" tripId={tripId} />;}
