export const validExpenseRate=row=>row&&Number.isFinite(row.rate)&&row.rate>0&&/^\d{4}-\d{2}-\d{2}$/.test(row.date);
export async function loadExpenseRate(currency,{date,existing,signal,storage=globalThis.localStorage,fetchImpl=globalThis.fetch,onWarning=()=>{}}={}){
 if(!currency)return {rate:null,cached:false};
 if(currency==='CNY')return {rate:{rate:1,date},cached:false};
 if(existing?.currency===currency&&existing.exchangeRate>0&&existing.exchangeRateDate)return {rate:{rate:existing.exchangeRate,date:existing.exchangeRateDate},cached:false};
 const controller=new AbortController(),abort=()=>controller.abort(signal?.reason),timer=setTimeout(()=>controller.abort('timeout'),8000);
 signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 try{const response=await fetchImpl(`https://api.frankfurter.dev/v2/rate/${currency.toLowerCase()}/cny`,{signal:controller.signal}),row=await response.json();if(!response.ok||row.base!==currency||row.quote!=='CNY'||!validExpenseRate(row))throw Error('汇率不可用');if(signal?.aborted)throw Error('请求已取消');const rate={rate:row.rate,date:row.date};try{storage?.setItem('departly_fx_'+currency,JSON.stringify(rate));}catch{onWarning('汇率已获取，但本地缓存保存失败');}return {rate,cached:false};
 }catch(error){if(signal?.aborted)throw error;try{const row=JSON.parse(storage?.getItem('departly_fx_'+currency)||'null');if(validExpenseRate(row))return {rate:row,cached:true};}catch{onWarning('汇率缓存读取失败，可保存原币账目');}return {rate:null,cached:false};
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
