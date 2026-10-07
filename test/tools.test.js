import test from 'node:test';
import assert from 'node:assert/strict';
import {capabilities,tryFullscreen,exitFullscreen,vibrate,requestWakeLock,requestOrientationPermission,playSound} from '../lib/browser-capabilities.js';
import {eventHeading,direction,delta,listenCompass} from '../lib/compass.js';
import {defaults,loadWoodfish,saveWoodfish,incrementWoodfish,WOODFISH_KEY} from '../lib/woodfish.js';

test('unsupported or denied browser capabilities return explicit failure',async()=>{
 assert.equal(capabilities({}).deviceOrientation,false);
 assert.equal(await requestOrientationPermission({}),'unsupported');
 assert.equal(await requestOrientationPermission({DeviceOrientationEvent:{requestPermission:async()=> 'denied'}}),'denied');
 assert.equal(await requestOrientationPermission({DeviceOrientationEvent:{requestPermission:async()=>{throw Error('denied');}}}),'error');
 assert.equal(await tryFullscreen({requestFullscreen:async()=>{throw Error('denied');}}),false);
 assert.equal(await exitFullscreen({document:{}}),false);
 assert.equal(vibrate(20,{}),false);
 assert.equal(await requestWakeLock({}),null);
 assert.equal(await playSound(null,'x'),false);
 assert.equal(await playSound({pause(){},play(){throw Error('denied');}},'x'),false);
});

test('compass rejects relative angles and invalid sensor values',()=>{
 assert.equal(eventHeading({alpha:123,absolute:false}),null);
 assert.equal(eventHeading({alpha:NaN,absolute:true}),null);
 assert.equal(eventHeading({webkitCompassHeading:25,webkitCompassAccuracy:-1}),null);
 assert.equal(eventHeading({webkitCompassHeading:350},90),80);
 assert.equal(eventHeading({alpha:270,absolute:true}),90);
 assert.equal(direction(359).directionCode,'N');
 assert.equal(direction(90).directionName,'东');
 assert.equal(delta(359,1),2);
});

test('compass subscription emits only real headings and removes both listeners',()=>{
 const handlers=new Map(),results=[];
 const env={addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:(name,fn)=>{assert.equal(handlers.get(name),fn);handlers.delete(name);}};
 const stop=listenCompass(value=>results.push(value),env);
 handlers.get('deviceorientation')({alpha:30,absolute:false});
 assert.equal(results.length,0);
 handlers.get('deviceorientationabsolute')({alpha:270,absolute:true});
 assert.equal(results[0].heading,90);
 stop();assert.equal(handlers.size,0);
});

test('woodfish settings and count persist without another data model',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 assert.deepEqual(loadWoodfish(storage),defaults);
 saveWoodfish(storage,{meritCount:17,selectedSound:'deep',autoSpeed:'fast',hapticEnabled:false});
 assert.equal(loadWoodfish(storage).meritCount,17);
 assert.equal(loadWoodfish(storage).selectedSound,'deep');
 assert.equal(incrementWoodfish(17),18);
 assert.throws(()=>incrementWoodfish(Number.MAX_SAFE_INTEGER));
 values.set(WOODFISH_KEY,'invalid');assert.throws(()=>loadWoodfish(storage));
 assert.throws(()=>saveWoodfish({setItem(){throw Error('quota');}},defaults));
});
