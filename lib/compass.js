export const normalize=n=>((n%360)+360)%360;
export const delta=(a,b)=>normalize(b-a+180)-180;
const names=['北','东北','东','东南','南','西南','西','西北'],codes=['N','NE','E','SE','S','SW','W','NW'];
export function direction(n){const i=Math.floor((normalize(n)+22.5)/45)%8;return {directionName:names[i],directionCode:codes[i]};}
export function eventHeading(event,screenAngle=0){if(Number.isFinite(event.webkitCompassHeading)&&event.webkitCompassHeading>=0&&event.webkitCompassAccuracy!==-1)return normalize(event.webkitCompassHeading+screenAngle);if(event.absolute===true&&Number.isFinite(event.alpha))return normalize(360-event.alpha+screenAngle);return null;}
export function listenCompass(onHeading,env=globalThis){
 let previous=null,smoothed=null,last=0;
 const listener=event=>{const value=eventHeading(event,Number(env.screen?.orientation?.angle||env.orientation)||0);if(value===null)return;smoothed=previous===null?value:smoothed+.2*delta(normalize(smoothed),value);previous=value;const now=Date.now();if(now-last<80)return;last=now;onHeading({heading:normalize(Math.round(smoothed)),rotation:-smoothed,...direction(smoothed)});};
 env.addEventListener('deviceorientation',listener);env.addEventListener('deviceorientationabsolute',listener);return()=>{env.removeEventListener('deviceorientation',listener);env.removeEventListener('deviceorientationabsolute',listener);};
}
