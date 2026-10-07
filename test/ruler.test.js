import test from 'node:test';import assert from 'node:assert/strict';
import {makeCalibration,parseCalibration,reading,ticks,angle,boardPoint} from '../lib/ruler.js';
import {readFileSync} from 'node:fs';
test('银行卡短边与5cm校准保持真实CSS像素换算',()=>{assert.equal(makeCalibration('id_card',269.9).mmPerPx,.2);assert.equal(makeCalibration('5cm',250).mmPerPx,.2);assert.equal(reading(250,.2,'cm'),'5.0 cm');assert.equal(reading(127,.2,'inch'),'1.00 inch');assert.throws(()=>makeCalibration('id_card',0));assert.throws(()=>makeCalibration('fake',250));});
test('无校准或损坏存储不标为已校准',()=>{assert.equal(parseCalibration(null).calibrated,false);assert.equal(parseCalibration({mmPerPx:0}).invalid,true);assert.equal(parseCalibration(makeCalibration('5cm',250)).calibrated,true);});
test('直尺刻度与量角器确定性角度',()=>{assert.equal(ticks(100,.2,'cm')[10].x,50);assert.equal(angle(0,100,100,100),0);assert.equal(angle(100,0,100,100),90);assert.equal(angle(200,100,100,100),180);assert.equal(angle(100,100,100,100,32),32);});
test('横屏旋转后触点仍对应真实测量坐标',()=>{const rect={left:10,top:20,right:210};assert.deepEqual(boardPoint(60,100,rect),{x:50,y:80});assert.deepEqual(boardPoint(160,100,rect,true),{x:80,y:50});assert.equal(angle(...Object.values(boardPoint(110,120,rect,true)),100,100),90);});
test('相机需用户点击启动并清理迟到响应和离开页面的轨道',()=>{const source=readFileSync(new URL('../app/tools/ruler/ruler.jsx',import.meta.url),'utf8');assert.match(source,/onClick=\{start\}/);assert.match(source,/token!==session\.current/);assert.match(source,/media\.getTracks\(\)\.forEach\(t=>t\.stop\(\)\)/);assert.match(source,/removeEventListener\('visibilitychange',pause\)/);assert.doesNotMatch(source,/fetch\(/);});

test('相机权限等待15秒超时并使晚到响应失效',()=>{const source=readFileSync(new URL('../app/tools/ruler/ruler.jsx',import.meta.url),'utf8');assert.match(source,/等待相机权限超时/);assert.match(source,/session\.current\+\+;setLoading\(false\);setError/);assert.match(source,/,15000\)/);assert.match(source,/clearTimeout\(timeout\)/);});
