const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createServer } = require('../src/server');

function createWechatAuthClientStub() {
  return {
    async code2Session(code) {
      const mapping = {
        'test-code': { openid: 'openid-test-code', sessionKey: 'session-key-test-code' },
        'user-a-code': { openid: 'openid-user-a', sessionKey: 'session-key-user-a' },
        'user-b-code': { openid: 'openid-user-b', sessionKey: 'session-key-user-b' },
      };

      if (!mapping[code]) {
        throw new Error(`unexpected test code: ${code}`);
      }

      return mapping[code];
    },
  };
}

async function startTestServer(options = {}) {
  const tempDir = options.dbPath ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'digital-wardrobe-server-'));
  const dbPath = options.dbPath || path.join(tempDir, 'app.db');
  const server = createServer({
    wechatAuthClient: createWechatAuthClientStub(),
    ...options,
    dbPath,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    cleanup() {
      if (tempDir) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    },
  };
}

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let body = null;
  const text = await response.text();
  if (text) {
    body = JSON.parse(text);
  }

  return { response, body };
}

async function loginAndGetToken(baseUrl) {
  const loginResult = await requestJson(baseUrl, '/v1/auth/wechat/login', {
    method: 'POST',
    body: JSON.stringify({ code: 'test-code' }),
  });

  return loginResult.body.data.token;
}

test('POST /v1/auth/wechat/login returns token and user', async (t) => {
  const { server, baseUrl, cleanup } = await startTestServer();
  t.after(() => server.close());
  t.after(() => cleanup());

  const { response, body } = await requestJson(baseUrl, '/v1/auth/wechat/login', {
    method: 'POST',
    body: JSON.stringify({ code: 'test-code' }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.code, 0);
  assert.ok(body.data.token);
  assert.ok(body.data.user.id);
  assert.ok(body.data.user.name);
});

test('GET /v1/app/bootstrap returns guest state when no bearer token is provided', async (t) => {
  const { server, baseUrl, cleanup } = await startTestServer();
  t.after(() => server.close());
  t.after(() => cleanup());

  const { response, body } = await requestJson(baseUrl, '/v1/app/bootstrap');

  assert.equal(response.status, 200);
  assert.equal(body.code, 0);
  assert.equal(body.data.user.name, '游客');
  assert.equal(body.data.user.isGuest, true);
});

test('POST /v1/garments still requires bearer token in guest mode', async (t) => {
  const { server, baseUrl, cleanup } = await startTestServer();
  t.after(() => server.close());
  t.after(() => cleanup());

  const { response, body } = await requestJson(baseUrl, '/v1/garments', {
    method: 'POST',
    body: JSON.stringify({
      name: '未登录不能保存',
      type: '上装',
      subType: '长袖衬衫',
      color: '白色',
      season: ['春'],
      warmthLevel: 2,
      texture: '棉',
      scene: '通勤',
      accent: '#ffffff',
    }),
  });

  assert.equal(response.status, 401);
  assert.equal(body.code, 401);
});

test('GET /v1/app/bootstrap returns aggregate state after login', async (t) => {
  const { server, baseUrl, cleanup } = await startTestServer();
  t.after(() => server.close());
  t.after(() => cleanup());

  const token = await loginAndGetToken(baseUrl);
  const { response, body } = await requestJson(baseUrl, '/v1/app/bootstrap', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.status, 200);
  assert.equal(body.code, 0);
  assert.ok(body.data.user);
  assert.notEqual(body.data.user.isGuest, true);
  assert.ok(Array.isArray(body.data.garments));
  assert.ok(Array.isArray(body.data.outfits));
  assert.ok(Array.isArray(body.data.plans));
  assert.equal(typeof body.data.savedOutfitCount, 'number');
  assert.equal(typeof body.data.recommendationIndex, 'number');
});

test('POST /v1/recommendations/today/refresh rotates recommendation index', async (t) => {
  const { server, baseUrl, cleanup } = await startTestServer();
  t.after(() => server.close());
  t.after(() => cleanup());

  const token = await loginAndGetToken(baseUrl);
  const { response, body } = await requestJson(baseUrl, '/v1/recommendations/today/refresh', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.status, 200);
  assert.equal(body.code, 0);
  assert.equal(body.data.state.recommendationIndex, 1);
});

test('POST /v1/recommendations/today/schedule assigns current recommendation to tomorrow', async (t) => {
  const { server, baseUrl, cleanup } = await startTestServer();
  t.after(() => server.close());
  t.after(() => cleanup());

  const token = await loginAndGetToken(baseUrl);
  const { response, body } = await requestJson(baseUrl, '/v1/recommendations/today/schedule', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ target: 'tomorrow' }),
  });

  const tomorrowPlan = body.data.state.plans.find((item) => item.label === '明天');
  assert.equal(response.status, 200);
  assert.equal(body.code, 0);
  assert.equal(tomorrowPlan.outfitId, 'o-001');
  assert.equal(tomorrowPlan.status, '已安排');
});

test('POST /v1/recommendations/today/mark-worn marks current recommendation garments as worn today', async (t) => {
  const { server, baseUrl, cleanup } = await startTestServer();
  t.after(() => server.close());
  t.after(() => cleanup());

  const token = await loginAndGetToken(baseUrl);
  const { response, body } = await requestJson(baseUrl, '/v1/recommendations/today/mark-worn', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const wornIds = ['g-001', 'g-004', 'g-006', 'g-007', 'g-008'];
  const marked = body.data.state.garments.filter((item) => wornIds.includes(item.id));

  assert.equal(response.status, 200);
  assert.equal(body.code, 0);
  assert.equal(marked.length, wornIds.length);
  assert.ok(marked.every((item) => item.lastWornAt === '今天'));
});

test('POST /v1/garments creates a new garment and returns state', async (t) => {
  const { server, baseUrl, cleanup } = await startTestServer();
  t.after(() => server.close());
  t.after(() => cleanup());

  const token = await loginAndGetToken(baseUrl);
  const { response, body } = await requestJson(baseUrl, '/v1/garments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: '雾蓝衬衫',
      type: '上装',
      subType: '长袖衬衫',
      color: '雾蓝',
      season: ['春', '秋'],
      warmthLevel: 2,
      texture: '棉感',
      scene: '通勤',
      accent: '#9db4cf',
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.code, 0);
  assert.equal(body.data.state.garments.length, 9);
  assert.equal(body.data.state.garments[0].name, '雾蓝衬衫');
});

test('POST /v1/garments/{id}/mark-worn marks a garment as worn today', async (t) => {
  const { server, baseUrl, cleanup } = await startTestServer();
  t.after(() => server.close());
  t.after(() => cleanup());

  const token = await loginAndGetToken(baseUrl);
  const { response, body } = await requestJson(baseUrl, '/v1/garments/g-001/mark-worn', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const garment = body.data.state.garments.find((item) => item.id === 'g-001');
  assert.equal(response.status, 200);
  assert.equal(body.code, 0);
  assert.equal(garment.lastWornAt, '今天');
});

test('POST /v1/plans/{date}/recommendation updates the selected plan', async (t) => {
  const { server, baseUrl, cleanup } = await startTestServer();
  t.after(() => server.close());
  t.after(() => cleanup());

  const token = await loginAndGetToken(baseUrl);
  const { response, body } = await requestJson(baseUrl, '/v1/plans/04-11/recommendation', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const plan = body.data.state.plans.find((item) => item.date === '04-11');
  assert.equal(response.status, 200);
  assert.equal(body.code, 0);
  assert.equal(plan.outfitId, 'o-001');
  assert.equal(plan.status, '已安排');
});

test('POST /v1/outfits creates a manual outfit and increments saved count', async (t) => {
  const { server, baseUrl, cleanup } = await startTestServer();
  t.after(() => server.close());
  t.after(() => cleanup());

  const token = await loginAndGetToken(baseUrl);
  const { response, body } = await requestJson(baseUrl, '/v1/outfits', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      slots: {
        outer: 'g-001',
        upper: 'g-005',
        bottom: 'g-006',
        shoes: 'g-007',
        bag: 'g-008',
      },
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(body.code, 0);
  assert.equal(body.data.state.savedOutfitCount, 15);
  assert.equal(body.data.state.outfits[0].name, '我的搭配 15');
});

test('mutations persist across server restart when using the same sqlite database', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'digital-wardrobe-server-'));
  const dbPath = path.join(tempDir, 'app.db');
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  const first = await startTestServer({ dbPath });
  const token = await loginAndGetToken(first.baseUrl);

  const createResult = await requestJson(first.baseUrl, '/v1/garments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: '重启后还在的衬衫',
      type: '上装',
      subType: '长袖衬衫',
      color: '雾蓝',
      season: ['春', '秋'],
      warmthLevel: 2,
      texture: '棉感',
      scene: '通勤',
      accent: '#9db4cf',
    }),
  });

  assert.equal(createResult.response.status, 200);
  first.server.close();

  const second = await startTestServer({ dbPath });
  t.after(() => second.server.close());
  const secondToken = await loginAndGetToken(second.baseUrl);
  const bootstrap = await requestJson(second.baseUrl, '/v1/app/bootstrap', {
    headers: {
      Authorization: `Bearer ${secondToken}`,
    },
  });

  const createdGarment = bootstrap.body.data.garments.find((item) => item.name === '重启后还在的衬衫');
  assert.equal(bootstrap.response.status, 200);
  assert.ok(createdGarment);
});

test('different openid users have isolated states', async (t) => {
  const { server, baseUrl, cleanup } = await startTestServer();
  t.after(() => server.close());
  t.after(() => cleanup());

  const loginA = await requestJson(baseUrl, '/v1/auth/wechat/login', {
    method: 'POST',
    body: JSON.stringify({ code: 'user-a-code' }),
  });
  const tokenA = loginA.body.data.token;

  await requestJson(baseUrl, '/v1/garments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      name: '只属于 A 的衬衫',
      type: '上装',
      subType: '长袖衬衫',
      color: '蓝色',
      season: ['春'],
      warmthLevel: 2,
      texture: '棉',
      scene: '通勤',
      accent: '#88aadd',
    }),
  });

  const loginB = await requestJson(baseUrl, '/v1/auth/wechat/login', {
    method: 'POST',
    body: JSON.stringify({ code: 'user-b-code' }),
  });
  const tokenB = loginB.body.data.token;

  const bootstrapA = await requestJson(baseUrl, '/v1/app/bootstrap', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const bootstrapB = await requestJson(baseUrl, '/v1/app/bootstrap', {
    headers: { Authorization: `Bearer ${tokenB}` },
  });

  assert.ok(bootstrapA.body.data.garments.some((item) => item.name === '只属于 A 的衬衫'));
  assert.ok(!bootstrapB.body.data.garments.some((item) => item.name === '只属于 A 的衬衫'));
});
