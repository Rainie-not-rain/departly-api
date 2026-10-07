import ItineraryEditor from "../../itinerary-editor";
export default async function Page({searchParams}:{searchParams:Promise<{day?:string}>}){const {day}=await searchParams;return <ItineraryEditor initialDay={Number.isFinite(Number(day))?Math.max(0,Math.floor(Number(day))):0}/>;}
