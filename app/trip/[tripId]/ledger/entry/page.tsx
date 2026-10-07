import ExpenseForm from "../../../subpages/expense-form";
export default async function Page({params,searchParams}:{params:Promise<{tripId:string}>;searchParams:Promise<{[key:string]:string|undefined}>}){const {tripId}=await params;const query=await searchParams;return <ExpenseForm key={tripId} tripId={tripId} expenseId={query.expenseId||''} draftId={query.draftId||''}/>;}
