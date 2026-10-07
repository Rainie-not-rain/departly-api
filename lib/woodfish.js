export const WOODFISH_KEY='departly_woodfish_settings';
export const sounds={crisp:'/assets/audio/woodfish/crisp.wav',warm:'/assets/audio/woodfish/warm.wav',deep:'/assets/audio/woodfish/deep.wav'};
export const speeds={slow:1200,normal:800,fast:500};
export const defaults={meritCount:0,selectedSound:'crisp',autoSpeed:'normal',hapticEnabled:true};
export function normalizeWoodfish(value={}){return {meritCount:Number.isSafeInteger(value?.meritCount)&&value.meritCount>=0?value.meritCount:0,selectedSound:Object.hasOwn(sounds,value?.selectedSound)?value.selectedSound:'crisp',autoSpeed:Object.hasOwn(speeds,value?.autoSpeed)?value.autoSpeed:'normal',hapticEnabled:typeof value?.hapticEnabled==='boolean'?value.hapticEnabled:true};}
export function loadWoodfish(storage){const raw=storage.getItem(WOODFISH_KEY);return raw?normalizeWoodfish(JSON.parse(raw)): {...defaults};}
export function saveWoodfish(storage,value){storage.setItem(WOODFISH_KEY,JSON.stringify(normalizeWoodfish(value)));}
export function incrementWoodfish(value){if(!Number.isSafeInteger(value)||value<0||value===Number.MAX_SAFE_INTEGER)throw Error('计数已达上限，请重置后继续。');return value+1;}
