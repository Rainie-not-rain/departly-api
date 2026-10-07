import test from 'node:test';
import assert from 'node:assert/strict';
import { groupedTrips, editTrip, deleteTrip, restoreTrip, purgeTrip, readTrips, writeTrips } from '../app/trips/trip-service.ts';
import { purgeExpired, RETENTION } from '../app/trips/trip-recycle.js';

const trip = (id, start, end, extra = {}) => ({ id, name: id, city: '杭州', country: '中国', start, end, ownerUserId: 'me', ...extra });
const data = trips => ({ managerUserId: 'me', currentTripId: trips[0]?.id, trips, packing: [], expenses: [], tickets: [] });
const now = new Date(2026, 9, 6, 12);
const form = t => ({ name: t.name, city: t.city, country: t.country, start: t.start, end: t.end, cover: t.cover || '' });

test('原三种分组与排序，已删除旅程不进入列表，空即将出行组保留', () => {
  assert.deepEqual(groupedTrips(data([]), now), []);
  const value = data([trip('past-old', '2026-09-01', '2026-09-02'), trip('next-later', '2026-10-20', '2026-10-22'), trip('ongoing-later', '2026-10-05', '2026-10-08'), trip('past-new', '2026-10-01', '2026-10-05'), trip('next', '2026-10-07', '2026-10-09'), trip('ongoing-first', '2026-10-01', '2026-10-10'), trip('deleted', '2026-10-06', '2026-10-07', { isDeleted: true })]);
  const groups = groupedTrips(value, now);
  assert.deepEqual(groups.map(s => s.title), ['旅行中', '即将出行', '过往出行']);
  assert.deepEqual(groups.map(s => s.trips.map(t => t.id)), [['ongoing-first', 'ongoing-later'], ['next', 'next-later'], ['past-new', 'past-old']]);
  assert.equal(groups[1].trips[0].dateRange, '2026.10.7—2026.10.9');
  assert.equal(groups[1].trips[0].duration, 3);
  assert.equal(groupedTrips(data([value.trips[0]]), now)[0].title, '即将出行');
});

test('原准备项与过往摘要：足迹去重，照片计数，未知外币不累计', () => {
  const value = data([trip('active', '2026-10-06', '2026-10-07', { countries: ['中国、日本', '法国/日本'], stays: [{}], days: [{ nodes: [{ id: 'node', place: '西湖', start: '09:00', type: 'place', done: true }] }] })]);
  value.packing.push({ tripId: 'active', packed: true });
  value.tickets.push({ tripId: 'active', nodeId: 'node', photos: ['photo1', 'photo2'] });
  value.expenses.push({ tripId: 'active', amount: 12.34 }, { tripId: 'active', currency: 'USD', amount: 100 }, { tripId: 'active', currency: 'USD', convertedAmountCNY: 7.66 });
  const rendered = groupedTrips(value, now)[0].trips[0];
  assert.equal(rendered.summary, '1 个足迹 · 2 张照片 · ¥20.00');
  assert.deepEqual(rendered.countries, ['中国', '日本', '法国']);
  assert(rendered.prepItems.every(p => p.done));
});

test('编辑按原状态限制：待出发可改目的地，旅行中不能改目的地，过往只能改名称封面', () => {
  for (const [status, start, end] of [['upcoming', '2026-10-07', '2026-10-09'], ['ongoing', '2026-10-05', '2026-10-07'], ['completed', '2026-10-01', '2026-10-03']]) {
    const t = trip(status, start, end, { members: [{ id: 'owner' }] }), value = data([t]);
    editTrip(value, t.id, { ...form(t), name: '新名称', city: '上海', start: '2026-10-08', end: '2026-10-10', cover: 'data:image/png;base64,test' }, now);
    assert.equal(t.name, '新名称');
    assert.equal(t.city, status === 'upcoming' ? '上海' : '杭州');
    assert.equal(t.start, status === 'completed' ? start : '2026-10-08');
    assert.deepEqual(t.members, [{ id: 'owner' }]);
  }
});

test('编辑同步每日日期，拒绝缩短已有安排、空名称和无权限写入', () => {
  const t = trip('t', '2026-10-07', '2026-10-09', { days: [{ date: '2026-10-07', nodes: [{ place: '西湖' }] }, { date: '2026-10-08' }, { date: '2026-10-09' }] }), value = data([t]);
  assert.throws(() => editTrip(value, 't', { ...form(t), end: '2026-10-08' }, now), /覆盖已有每日安排/);
  assert.equal(t.end, '2026-10-09');
  assert.throws(() => editTrip(value, 't', { ...form(t), name: ' ' }, now));
  assert.throws(() => editTrip(value, 't', { ...form(t), start: '2026-02-30' }, now));
  editTrip(value, 't', { ...form(t), start: '2026-10-10', end: '2026-10-12' }, now);
  assert.deepEqual(t.days.map(d => d.date), ['2026-10-10', '2026-10-11', '2026-10-12']);
  assert.equal(t.days[0].nodes[0].place, '西湖');
  t.ownerUserId = 'other';
  assert.throws(() => editTrip(value, 't', form(t), now));
  assert.throws(() => deleteTrip(value, 't'));
});

test('删除保留关联数据7天，恢复保留原数据，到期仅清理对应旅程与关联项', () => {
  const value = data([trip('t', '2026-10-07', '2026-10-09'), trip('kept', '2026-10-08', '2026-10-10')]), time = now.getTime();
  for (const key of ['expenses', 'packing', 'tickets', 'photos', 'reviews', 'tripMembers', 'transfers', 'checkins', 'settlementHistory']) value[key] = [{ tripId: 't', id: key }, { tripId: 'kept', id: 'keep-' + key }];
  deleteTrip(value, 't', time);
  assert.equal(value.trips[0].permanentlyDeleteAt, time + RETENTION);
  assert.equal(value.currentTripId, 'kept');
  assert.equal(value.expenses.length, 2);
  restoreTrip(value, 't', time + RETENTION - 1);
  assert.equal(value.trips[0].isDeleted, false);
  deleteTrip(value, 't', time);
  assert.throws(() => restoreTrip(value, 't', time + RETENTION));
  assert.deepEqual(purgeExpired(value, time + RETENTION - 1), []);
  assert.deepEqual(purgeExpired(value, time + RETENTION), ['t']);
  assert.deepEqual(value.trips.map(t => t.id), ['kept']);
  assert.equal(value.expenses.length, 1);
  assert.equal(value.expenses[0].tripId, 'kept');
  assert.throws(() => purgeTrip(value, 'kept'));
});

test('localStorage 沿用原键，迁移旧创建者字段，保存失败不覆盖旧数据', () => {
  const memory = new Map(), previousStorage = global.localStorage, previousWindow = global.window;
  global.localStorage = { getItem: k => memory.get(k) || null, setItem: (k, v) => memory.set(k, v) };
  global.window = { dispatchEvent() {} };
  try {
    const initial = readTrips(); assert.equal(initial.trips.length, 0); assert(initial.managerUserId);
    const legacy = trip('legacy', '2026-10-07', '2026-10-09'); delete legacy.ownerUserId;
    memory.set('departly_mvp_data_v1', JSON.stringify({ trips: [legacy], custom: { keep: true } }));
    const migrated = readTrips(); assert.equal(migrated.trips[0].ownerUserId, migrated.managerUserId);
    assert.deepEqual(migrated.custom, { keep: true });
    const before = memory.get('departly_mvp_data_v1');
    global.localStorage.setItem = () => { throw Error('QuotaExceededError'); };
    assert.throws(() => writeTrips(d => editTrip(d, 'legacy', { ...form(d.trips[0]), name: 'new' }, now)), /Quota/);
    assert.equal(memory.get('departly_mvp_data_v1'), before);
  } finally { global.localStorage = previousStorage; global.window = previousWindow; }
});
