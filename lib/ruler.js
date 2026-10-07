export const CALIBRATION_KEY='departly_ruler_calibration';
export const fallback=()=>({mmPerPx:.18,calibrationMethod:'default',calibrated:false,calibratedAt:null});
export const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function parseCalibration(value){if(!value)return fallback();if(!Number.isFinite(value.mmPerPx)||value.mmPerPx<=0||value.mmPerPx>5||!['id_card','5cm'].includes(value.calibrationMethod)||value.calibrated!==true)return {...fallback(),invalid:true};return value;}
export function makeCalibration(method,pixels){if(!['id_card','5cm'].includes(method)||!Number.isFinite(pixels)||pixels<20)throw Error('请将校准线拉到物体的实际长度');return {mmPerPx:(method==='id_card'?53.98:50)/pixels,calibrationMethod:method,calibrated:true,calibratedAt:new Date().toISOString()};}
export function reading(px,scale,unit){const mm=px*scale;return unit==='inch'?(mm/25.4).toFixed(2)+' inch':(mm/10).toFixed(1)+' cm';}
export function ticks(width,scale,unit){if(!Number.isFinite(scale)||scale<=0)return [];const step=unit==='inch'?25.4/8:1,rows=[];for(let i=0;i*step/scale<=width&&i<3000;i++){const major=i%(unit==='inch'?8:10)===0,medium=i%(unit==='inch'?4:5)===0;rows.push({x:i*step/scale,length:major?34:medium?24:14,major,label:major?String(i/(unit==='inch'?8:10)):''});}return rows;}
export function angle(x,y,cx,cy,previous=90){const dx=x-cx,dy=y-cy;if(Math.hypot(dx,dy)<2)return previous;return Math.round(clamp(Math.atan2(Math.max(0,-dy),-dx)*180/Math.PI,0,180));}
export function boardPoint(clientX,clientY,rect,rotated=false){return rotated?{x:clientY-rect.top,y:rect.right-clientX}:{x:clientX-rect.left,y:clientY-rect.top};}
