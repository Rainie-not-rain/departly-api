import ItineraryEditor from "../../itinerary-editor";
export default async function EditPage({params,searchParams}:{params:Promise<{tripId:string}>;searchParams:Promise<{day?:string}>}) {const {tripId}=await params;const {day}=await searchParams;return <ItineraryEditor tripId={tripId} initialDay={Number.isFinite(Number(day))?Math.max(0,Math.floor(Number(day))):0} />;}
