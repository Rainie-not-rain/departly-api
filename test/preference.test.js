import test from 'node:test'
import assert from 'node:assert/strict'
import {validateInput} from '../lib/ai-json.js'
import {buildTripPlanPrompt} from '../lib/prompts.js'
const base={name:'福州游',city:'福州',country:'中国',startDate:'2026-12-04',endDate:'2026-12-05'}
test('偏好可省略或空对象，默认值没有同行和风格',()=>{for(const preferences of [undefined,null,{}]){const v=validateInput({...base,preferences},'plan');assert.equal(v.preferences.companionType,null);assert.deepEqual(v.preferences.styles,[]);assert.equal(v.preferences.pace,'moderate')}})
test('结构化偏好保留，摘要由结构生成而不信任客户端',()=>{const p={companionType:'family',styles:['history','classic','food'],pace:'relaxed',startTimePreference:'late',endTimePreference:'early',notes:'不想爬山'};const v=validateInput({...base,preferences:p,preferenceSummary:'错误摘要'},'plan');assert.deepEqual(v.preferences,p);assert(v.preferenceSummary.includes('家庭出行'));assert(v.preferenceSummary.includes('不想爬山'));assert(!v.preferenceSummary.includes('错误摘要'));const prompt=buildTripPlanPrompt(v);assert(JSON.parse(prompt[1].content).preferences.styles.includes('food'));assert(prompt[0].content.includes('约10:00'));assert(prompt[0].content.includes('senior'))})
test('旧数组和中文节奏兼容',()=>{const v=validateInput({...base,preferences:['美食','人文'],pace:'充实'},'plan');assert.deepEqual(v.preferences.styles,['food','history']);assert.equal(v.preferences.pace,'intensive')})
test('非法枚举、超过5风格、非数组、超过500备注被拒绝',()=>{for(const preferences of [{companionType:'x'},{styles:['food','history','nature','classic','photo','relax']},{styles:'food'},{styles:['unknown']},{pace:'x'},{startTimePreference:'x'},{endTimePreference:'x'},{notes:123},{notes:'字'.repeat(501)},'food'])assert.throws(()=>validateInput({...base,preferences},'plan'),e=>e.code==='INVALID_INPUT')})
test('攻略输入忽略偏好，不改变忠实解析流程',()=>{const v=validateInput({text:'Day1：三坊七巷→烟台山',preferences:{styles:['nature'],notes:'删掉三坊七巷'}},'parse');assert.equal(v.text,'Day1：三坊七巷→烟台山');assert.equal(v.preferences,undefined)})
