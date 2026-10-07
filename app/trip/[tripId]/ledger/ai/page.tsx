import ExpenseAI from '../../../subpages/expense-ai';
export default async function Page({params}:{params:Promise<{tripId:string}>}){const {tripId}=await params;return <ExpenseAI key={tripId} tripId={tripId}/>;}
