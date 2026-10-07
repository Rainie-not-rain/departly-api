import test from 'node:test';
import assert from 'node:assert/strict';
import { homeState, homeQuickDestination, monthSeason } from '../app/home-state.ts';

const now = new Date(2026, 9, 6, 21, 20);
const trip = (id, start, end, extra = {}) => ({ id, city: '杭州', start, end, ...extra });

test('无旅程和已结束、已删除旅程均显示原首页空状态', () => {
  for (const data of [{}, { trips: [trip('old', '2026-10-01', '2026-10-05'), trip('deleted', '2026-10-06', '2026-10-07', { isDeleted: true })] }]) {
    const state = homeState(data, now);
    assert.equal(state.state, 'none');
    assert.equal(state.title, '下一次出发，\n去哪里？');
    assert.equal(state.action, '创建一趟旅行');
    assert.equal(state.greeting, '晚上好');
  }
});

test('待出发选择最近旅程，倒计时、日期和准备项保持原逻辑', () => {
  const data = { trips: [trip('later', '2026-10-20', '2026-10-22'), trip('next', '2026-10-08', '2026-10-10', { stays: [{}], days: [{ nodes: [{ place: '西湖', start: '09:00', type: 'place' }] }] })], packing: [{ tripId: 'next', packed: true }, { tripId: 'later', packed: false }] };
  const state = homeState(data, now);
  assert.equal(state.state, 'upcoming');
  assert.equal(state.trip.id, 'next');
  assert.equal(state.title, '距离出发杭州，\n还有2天');
  assert.equal(state.summary, '杭州 · 3日游');
  assert.equal(state.tripDate, '2026.10.08—2026.10.10');
  assert.deepEqual(state.prepItems.map(p => p.done), [true, true, true]);
  assert.equal(state.prepItems[2].name, '行李 1/1');
});

test('旅行中优先当前旅程，按日期选今日安排并计算完成地点', () => {
  const data = { currentTripId: 'current', trips: [trip('earlier', '2026-10-01', '2026-10-09'), trip('current', '2026-10-05', '2026-10-07', { days: [{ date: '2026-10-06', city: '宁波', nodes: [{ done: true }, { completed: true }, {}] }] })] };
  const state = homeState(data, now);
  assert.equal(state.state, 'active');
  assert.equal(state.trip.id, 'current');
  assert.equal(state.title, '杭州 · Day 2');
  assert.equal(state.weatherCity, '宁波');
  assert.equal(state.todayNodes.length, 3);
  assert.equal(state.completedStops, 2);
  assert.equal(state.action, '继续今天的旅程');
});

test('日期边界包含出发和结束日，无当前旅程时优先最早出发的旅行中旅程', () => {
  assert.equal(homeState({ trips: [trip('t', '2026-10-06', '2026-10-06')] }, now).state, 'active');
  const data = { trips: [trip('later', '2026-10-05', '2026-10-07'), trip('earlier', '2026-10-01', '2026-10-06')] };
  assert.equal(homeState(data, now).trip.id, 'earlier');
});

test('问候与月份四季保持原首页规则', () => {
  assert.deepEqual([1, 3, 6, 9, 12].map(monthSeason), ['winter', 'spring', 'summer', 'autumn', 'winter']);
  assert.deepEqual([10, 11, 17, 18].map(h => homeState({}, new Date(2026, 9, 6, h)).greeting), ['早上好', '下午好', '下午好', '晚上好']);
});

test('今日进度兼容新打卡状态与旧完成标记，未完成不计入', () => {
  const data={trips:[trip('t','2026-10-06','2026-10-07',{days:[{date:'2026-10-06',nodes:[{status:'completed'},{completed:true},{done:true},{visited:true},{status:'planned'},{}]}]})]};
  assert.equal(homeState(data,now).completedStops,4);
  data.trips[0].days[0].nodes[0].status='planned';
  assert.equal(homeState(data,now).completedStops,3);
});

test('首页快捷入口覆盖无旅程、待出发、旅行中及已结束旅程，排除已删除旅程',()=>{
  assert.equal(homeQuickDestination({},now,'checkin').href,'/trip/create');
  for(const [start,end] of [['2026-10-08','2026-10-10'],['2026-10-06','2026-10-07'],['2026-10-01','2026-10-05']]){
    const data={currentTripId:'t',trips:[trip('deleted',start,end,{isDeleted:true}),trip('t',start,end)]};
    assert.equal(homeQuickDestination(data,now,'ledger/entry').href,'/trip/t/ledger/entry');
    assert.equal(homeQuickDestination(data,now,'checkin').href,'/trip/t/checkin');
  }
  assert.equal(homeQuickDestination({trips:[trip('deleted','2026-10-06','2026-10-07',{isDeleted:true})]},now,'checkin').href,'/trip/create');
});
