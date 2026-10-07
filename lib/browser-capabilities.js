// Optional device enhancements must never prevent a local tool from working.
export function capabilities(env=globalThis){return {fullscreen:typeof env.document?.documentElement?.requestFullscreen==='function',vibration:typeof env.navigator?.vibrate==='function',deviceOrientation:!!env.DeviceOrientationEvent&&env.isSecureContext!==false,orientationPermission:typeof env.DeviceOrientationEvent?.requestPermission==='function',audio:typeof env.Audio==='function',camera:typeof env.navigator?.mediaDevices?.getUserMedia==='function'};}
export async function tryFullscreen(element){try{if(typeof element?.requestFullscreen!=='function')return false;await element.requestFullscreen();return true;}catch{return false;}}
export async function exitFullscreen(env=globalThis){try{if(!env.document?.fullscreenElement)return false;await env.document.exitFullscreen();return true;}catch{return false;}}
export function vibrate(ms=20,env=globalThis){try{return !!env.navigator?.vibrate?.(ms);}catch{return false;}}
export async function requestWakeLock(env=globalThis){try{return await env.navigator?.wakeLock?.request('screen')||null;}catch{return null;}}
export function cameraSupported(env=globalThis){return capabilities(env).camera;}
export async function requestOrientationPermission(env=globalThis){if(!capabilities(env).deviceOrientation)return 'unsupported';try{return typeof env.DeviceOrientationEvent.requestPermission==='function'?await env.DeviceOrientationEvent.requestPermission():'granted';}catch{return 'error';}}
export async function playSound(audio,src){if(!audio)return false;try{audio.pause();if((audio.getAttribute?.('src')??audio.src)!==src)audio.src=src;audio.currentTime=0;await audio.play();return true;}catch{return false;}}
