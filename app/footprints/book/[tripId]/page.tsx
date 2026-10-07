import Book from "../../book";
export default async function Page({params}:{params:Promise<{tripId:string}>}){const {tripId}=await params;return <Book tripId={tripId}/>;}
