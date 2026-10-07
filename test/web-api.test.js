import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';

const root = new URL('../', import.meta.url);

async function routes(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(new URL(directory, root), { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await routes(directory + entry.name + '/', name + '/'));
    else if (entry.name.endsWith('.js')) result.push(name);
  }
  return result.sort();
}

test('Next.js 接口入口完整覆盖原接口，并直接复用原处理函数', async () => {
  const original = await routes('api/');
  assert.deepEqual(await routes('pages/api/'), original);
  for (const route of original) {
    const source = await import(new URL('api/' + route, root));
    const web = await import(new URL('pages/api/' + route, root));
    assert.equal(web.default, source.default, route);
  }
});

test('Next.js 入口保留接口时限、图片大小支持和原清理定时任务', async () => {
  const vercel = JSON.parse(await readFile(new URL('vercel.json', root), 'utf8'));
  assert.equal(vercel.framework, 'nextjs');
  assert.deepEqual(vercel.crons, [{ path: '/api/security/media-cleanup', schedule: '0 2 * * *' }]);
  for (const [path, settings] of Object.entries(vercel.functions)) {
    const route = await import(new URL(path, root));
    assert.equal(route.config.maxDuration, settings.maxDuration, path);
  }
  const media = await import(new URL('pages/api/security/media.js', root));
  assert.equal(media.config.api.bodyParser.sizeLimit, '3mb');
});

test('Web 入口保持健康检查、AI 方法限制和已停用测试接口的行为', async () => {
  const response = () => ({
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  });
  const health = (await import(new URL('pages/api/health.js', root))).default;
  const healthy = response();
  health({ method: 'GET' }, healthy);
  assert.equal(healthy.statusCode, 200);
  assert.equal(healthy.body.data.service, 'departly-api');
  for (const route of ['chat', 'trip-plan', 'trip-parse', 'scrapbook-route']) {
    const handler = (await import(new URL(`pages/api/ai/${route}.js`, root))).default;
    const result = response();
    await handler({ method: 'GET' }, result);
    const original = (await import(new URL(`api/ai/${route}.js`, root))).default;
    const expected = response();
    await original({ method: 'GET' }, expected);
    assert.equal(result.statusCode, 405, route);
    assert.deepEqual(result.headers, expected.headers, route);
    assert.deepEqual(result.body, expected.body, route);
  }
  const disabled = (await import(new URL('pages/api/ai/test.js', root))).default;
  const result = response();
  disabled({ method: 'GET' }, result);
  assert.equal(result.statusCode, 404);
});

test('Web 行程规划入口仍调用智谱并返回原结果，不请求微信审核', async () => {
  const settings = {
    WECHAT_APP_SECRET: 'web-test-secret',
    UPSTASH_REDIS_REST_URL: 'https://web-redis.test',
    UPSTASH_REDIS_REST_TOKEN: 'redis',
    ZHIPU_API_KEY: 'fixture-key',
    ZHIPU_MODEL: 'fixture-model',
  };
  const before = Object.keys(settings).map(key => process.env[key]);
  const originalFetch = global.fetch;
  Object.assign(process.env, settings);
  const payload = Buffer.from(JSON.stringify({ sub: 'web-user', exp: Date.now() / 1000 + 300 })).toString('base64url');
  const token = payload + '.' + createHmac('sha256', settings.WECHAT_APP_SECRET).update(payload).digest('base64url');
  const days = [{ dayIndex: 1, date: '2026-10-06', items: [
    { placeName: '西湖', plannedStartTime: '09:00', plannedEndTime: '10:00', durationMinutes: 60 },
    { placeName: '灵隐寺', plannedStartTime: '11:00', plannedEndTime: '12:00', durationMinutes: 60 },
  ] }];
  let redisCalls = 0, modelCalls = 0;
  global.fetch = async (url, options) => {
    if (url === settings.UPSTASH_REDIS_REST_URL) {
      redisCalls++;
      return { ok: true, json: async () => ({ result: 1 }) };
    }
    assert.equal(url, 'https://open.bigmodel.cn/api/paas/v4/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer fixture-key');
    assert.equal(JSON.parse(options.body).model, settings.ZHIPU_MODEL);
    modelCalls++;
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ days }) } }] }) };
  };
  try {
    const handler = (await import(new URL('pages/api/ai/trip-plan.js', root))).default;
    const res = { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ method: 'POST', headers: { authorization: 'Bearer ' + token }, body: { city: '杭州', startDate: '2026-10-06', endDate: '2026-10-06' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.days[0].items[0].placeName, '西湖');
    assert.equal(redisCalls, 2);
    assert.equal(modelCalls, 1);
  } finally {
    global.fetch = originalFetch;
    Object.keys(settings).forEach((key, index) => before[index] === undefined ? delete process.env[key] : process.env[key] = before[index]);
  }
});
