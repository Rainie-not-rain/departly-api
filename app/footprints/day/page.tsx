import FootprintDay from '../day';
export default async function Page({searchParams}:{searchParams:Promise<{date?:string}>}){const q=await searchParams;return <FootprintDay date={q.date||''}/>;}
