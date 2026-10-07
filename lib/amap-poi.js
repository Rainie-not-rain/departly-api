const text=value=>typeof value==='string'?value.trim():'';
export const normalizePoiName=value=>text(value).normalize('NFKC').toLowerCase().replace(/[\s·•・]/g,'');
const cityName=value=>normalizePoiName(value).replace(/市$/,'');
const domestic=country=>['中国','中华人民共和国','china','cn'].includes(normalizePoiName(country));
// Do not verify overseas POIs against domestic namesakes.
export function matchAmapPoi(pois,placeName,city){
 if(!Array.isArray(pois)||!pois.length)return {reason:'no_result'};
 const candidates=pois.filter(p=>cityName(p.cityname)===cityName(city)&&cityName(city));
 if(!candidates.length)return {reason:'city_mismatch'};
 const matches=candidates.filter(p=>normalizePoiName(p.name)===normalizePoiName(placeName));
 const unique=[...new Map(matches.map(p=>[p.id,p])).values()];
 if(unique.length!==1)return {reason:unique.length>1?'ambiguous':'name_mismatch'};
 const p=unique[0],parts=text(p.location).split(',');
 const longitude=parts[0]?.trim()?Number(parts[0]):NaN,latitude=parts[1]?.trim()?Number(parts[1]):NaN;
 if(!text(p.id)||parts.length!==2||!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)return {reason:'invalid_coordinates'};
 return {id:p.id,placeName:text(p.name),address:[text(p.pname),text(p.cityname),text(p.adname),text(p.address)].filter(Boolean).join(''),latitude,longitude};
}
const rejectionReason=code=>['10003','10004','10014','10019','10020','10021','10029','10044'].includes(code)?'quota_exceeded':['10001','10009','10013'].includes(code)?'invalid_key':code.startsWith('200')&&code!=='20003'?'invalid_request':'provider_rejected';
export async function searchAmapPoi(placeName,city,{country='',timeoutMs=1500,fetcher=fetch,key=process.env.AMAP_WEB_SERVICE_KEY}={}){
 if(!domestic(country))return {reason:country?'unsupported_country':'country_unknown'};
 if(!text(city))return {reason:'city_missing'};
 if(!key)return {reason:'missing_key'};
 const started=Date.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 // Never log a raw fetch Error: its message may contain the URL and secret key.
 const safe=value=>{let out=typeof value==='string'?value:'';for(const secret of [key,process.env.AMAP_WEB_SERVICE_KEY,process.env.ZHIPU_API_KEY].filter(Boolean))out=out.split(secret).join('[redacted]').split(encodeURIComponent(secret)).join('[redacted]');return out.replace(/https?:\/\/[^\s"'<>]+/gi,'[url redacted]').replace(/(?:authorization|secret|key)\s*[=:]\s*[^\s,;]+/gi,'[secret redacted]').slice(0,240)};
 let httpStatus=null,body=null,stage='fetch';
 const diagnostic=(reason,error)=>{if(process.env.NODE_ENV==='development')console.log('[Amap POI provider]',{placeName:safe(placeName),city:safe(city),httpStatus,status:safe(String(body?.status??'')),info:safe(body?.info),infocode:safe(String(body?.infocode??'')),poisCount:Array.isArray(body?.pois)?body.pois.length:null,providerSuccess:reason==='success',reason,durationMs:Date.now()-started,timeoutMs,...(error?{errorName:safe(error.name),errorMessage:safe(error.message)}:{})})};
 try{
  const params=new URLSearchParams({key,keywords:placeName,city:text(city),citylimit:'true',offset:'20',page:'1',extensions:'base',output:'JSON'});
  const response=await fetcher('https://restapi.amap.com/v3/place/text?'+params,{signal:controller.signal});httpStatus=response.status??null;stage='response';
  try{body=await response.json()}catch(error){const reason=controller.signal.aborted?'timeout':response.ok?'provider_rejected':'provider_error';diagnostic(reason,error);return {reason}}
  if(!response.ok){diagnostic('provider_error');return {reason:'provider_error'}}
  if(String(body?.status)!=='1'){const reason=rejectionReason(String(body?.infocode??''));diagnostic(reason);return {reason}}
  if(!Array.isArray(body.pois)){diagnostic('provider_rejected');return {reason:'provider_rejected'}}
  diagnostic('success');return matchAmapPoi(body.pois,placeName,city);
 }catch(error){const reason=controller.signal.aborted?'timeout':stage==='fetch'?'network_error':'provider_rejected';diagnostic(reason,error);return {reason}}finally{clearTimeout(timer)}
}
