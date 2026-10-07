const symbols={CNY:'¥',USD:'$',EUR:'€',GBP:'£',JPY:'¥',KRW:'₩',HKD:'HK$',TWD:'NT$',AUD:'A$',CAD:'C$',SGD:'S$',THB:'฿'}

function title(trip){return (trip.city||trip.name)+' · '+(Math.floor((Date.UTC(...trip.end.split('-').map((x,i)=>i===1?Number(x)-1:Number(x)))-Date.UTC(...trip.start.split('-').map((x,i)=>i===1?Number(x)-1:Number(x))))/86400000)+1)+'日游'}
function cnyAmount(x){return typeof x.convertedAmountCNY==='number'&&Number.isFinite(x.convertedAmountCNY)?x.convertedAmountCNY:(x.currency||'CNY')==='CNY'?Number(x.originalAmount??x.amount):null}
function defaultCurrency(trip){if(trip&&trip.defaultCurrency)return trip.defaultCurrency;const text=(trip&&trip.country||'')+' '+(trip&&trip.city||'');return ([[/香港/,'HKD'],[/日本|东京|京都|大阪/,'JPY'],[/法国|南法|巴黎/,'EUR'],[/美国/,'USD'],[/韩国/,'KRW'],[/泰国/,'THB'],[/英国/,'GBP'],[/澳大利亚/,'AUD'],[/新加坡/,'SGD']].find(x=>x[0].test(text))||[null,'CNY'])[1]}
export default {symbols,title,cnyAmount,defaultCurrency}

export {symbols,title,cnyAmount,defaultCurrency};
