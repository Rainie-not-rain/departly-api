import test from 'node:test'
import assert from 'node:assert/strict'
import {parseExplicitItinerary} from '../lib/trip-text-parser.js'
import {validateInput,normalizeResult} from '../lib/ai-json.js'
import handler from '../api/ai/trip-parse.js'
const names=result=>result.days.map(day=>day.items.map(item=>item.placeName))
const basic='Day1：三坊七巷 ➡ 林则徐纪念馆 ➡ 西湖公园\nDay2：鼓山 ➡ 烟台山 ➡ 上下杭'
test('箭头结构保留六地点，无时间直接兼容 normalize',()=>{const result=parseExplicitItinerary(basic);assert.deepEqual(names(result),[['三坊七巷','林则徐纪念馆','西湖公园'],['鼓山','烟台山','上下杭']]);const out=normalizeResult(result,validateInput({text:basic},'parse'),'parse');assert.equal(out.days[0].items[0].plannedStartTime,null)})
test('小红书地点介绍不重复提取、不吞入路线',()=>{const result=parseExplicitItinerary('Day1：三坊七巷 ➡ 林则徐纪念馆 ➡ 西湖公园\n\n✔三坊七巷：福州城市名片\n✔林则徐纪念馆：历史纪念馆\n\nDay2：鼓山 ➡ 烟台山');assert.deepEqual(names(result),[['三坊七巷','林则徐纪念馆','西湖公园'],['鼓山','烟台山']])})
test('单独美食、住宿推荐不进入路线',()=>assert.deepEqual(names(parseExplicitItinerary('Day1：三坊七巷 ➡ 西湖公园\n\n美食打卡：\n海顶记\n天然居\n阿信鲜捞\n住宿推荐\n东街口附近')),[['三坊七巷','西湖公园']]))
test('自由叙事返回 null',()=>{assert.equal(parseExplicitItinerary('第一天早上先去清水寺，\n然后沿着二年坂慢慢走，\n下午再去伏见稻荷。'),null);assert.equal(parseExplicitItinerary('Day1：早上先去清水寺，然后走二年坂'),null)})
for(const title of ['Day1','Day 1','day1','DAY1','第1天','第一天','第二天','第三天'])test('识别标题 '+title,()=>assert.equal(parseExplicitItinerary(title+'：鼓山 → 烟台山').days[0].items.length,2))
for(const delimiter of ['➡','➡️','➠','→','>','＞','-','—','、','，',';'])test('识别分隔符 '+delimiter,()=>assert.deepEqual(names(parseExplicitItinerary('Day1：鼓山 '+delimiter+' 烟台山')),[['鼓山','烟台山']]))
test('轻量清洗前缀，保留 S湾 原名和跨城市地点',()=>{const text='Day1：✔️ 三坊七巷 ➡ 🔸 童话小镇S湾';const result=parseExplicitItinerary(text);assert.deepEqual(names(result),[['三坊七巷','童话小镇S湾']]);assert.equal(normalizeResult(result,validateInput({text,city:'福州'},'parse'),'parse').days[0].items.length,2)})
test('换行箭头续接，同一行下一 Day 不吞入',()=>{assert.deepEqual(names(parseExplicitItinerary('Day1：鼓山 ➡\n烟台山 ➡ 上下杭\nDay2：龙王头 → 仙人井')),[['鼓山','烟台山','上下杭'],['龙王头','仙人井']]);assert.deepEqual(names(parseExplicitItinerary('Day1：鼓山 → 烟台山 Day2：龙王头 → 仙人井')),[['鼓山','烟台山'],['龙王头','仙人井']])})
test('不静默丢弃不能解析的 Day',()=>assert.equal(parseExplicitItinerary('Day1：鼓山 → 烟台山\nDay2：下午再去未知景点。'),null))
const full='Day1：三坊七巷 ➡ 林则徐纪念馆 ➡ 西湖公园 ➡ 福建省博物馆 ➡ 西禅古寺 ➡ 福道\nDay2：鼓山 ➡ 烟台山 ➡ 中洲岛 ➡ 青年广场 ➡ 上下杭 ➡ 闽江夜游\nDay3：白沙公园 ➡ 风车森林公园 ➡ 北部湾 ➡ 童话小镇S湾 ➡ 猫头墘 ➡ 和平村\nDay4：龙王头 ➡ 仙人井 ➡ 北港文创村 ➡ 最美环岛路 ➡ 镜沙 ➡ 长江澳'
test('福州平潭四天24地点，handler不调用 GLM',async()=>{const fetch=global.fetch,log=console.log,logs=[];let calls=0;global.fetch=async()=>{calls++;throw Error('must not call')};console.log=(...args)=>logs.push(args);try{const response={status(n){this.statusCode=n;return this},json(body){this.body=body},setHeader(){}};await handler({method:'POST',body:{text:full,city:'福州',startDate:'2026-10-03'}},response);assert.equal(response.statusCode,200);assert.equal(response.body.success,true);assert.deepEqual(response.body.data.days.map(day=>day.items.length),[6,6,6,6]);assert.deepEqual(names(response.body.data),names(parseExplicitItinerary(full)));assert.equal(calls,0);assert(logs.some(row=>row[0]==='[trip-parse strategy]'&&row[1]==='deterministic'));assert(logs.some(row=>row[0]==='[trip-parse deterministic count]'&&row[1]===24))}finally{global.fetch=fetch;console.log=log}})
