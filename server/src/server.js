const http = require('node:http');
const { URL } = require('node:url');
const { createSqliteStateStore } = require('./state');
const { createWechatAuthClient } = require('./wechat-auth');

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
}

function ok(response, data, message = 'ok') {
  sendJson(response, 200, {
    code: 0,
    message,
    data,
  });
}

function fail(response, statusCode, code, message) {
  sendJson(response, statusCode, {
    code,
    message,
    data: null,
  });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';

    request.on('data', (chunk) => {
      raw += chunk;
    });

    request.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('请求体不是合法 JSON'));
      }
    });

    request.on('error', reject);
  });
}

function getBearerToken(request) {
  const authorization = request.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

function requireAuth(request, response, store) {
  const token = getBearerToken(request);
  const state = token ? store.getStateByToken(token) : null;
  if (!state) {
    fail(response, 401, 401, '未登录或登录已失效');
    return null;
  }

  return token;
}

function logWechatLogin(loginPayload) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const meta = loginPayload.loginMeta;
  if (!meta) {
    return;
  }

  // Do not log session_key or raw openid.
  console.log(
    `[wechat-login] userId=${meta.userId} isNew=${meta.isNewUser} openid=${meta.openidMasked} unionid=${meta.hasUnionid ? 'yes' : 'no'}`,
  );
}

function createServer(options = {}) {
  const store = createSqliteStateStore(options);
  const wechatAuthClient = options.wechatAuthClient || createWechatAuthClient(options);

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');

    try {
      if (request.method === 'POST' && url.pathname === '/v1/auth/wechat/login') {
        const body = await readJsonBody(request);
        if (!body.code) {
          fail(response, 400, 400, '缺少微信登录 code');
          return;
        }

        const identity = await wechatAuthClient.code2Session(body.code);
        const loginPayload = store.createSessionForWechatUser(identity);
        logWechatLogin(loginPayload);
        ok(response, {
          token: loginPayload.token,
          user: loginPayload.user,
        });
        return;
      }

      if (url.pathname === '/v1/app/bootstrap' && request.method === 'GET') {
        const token = getBearerToken(request);
        if (!token) {
          ok(response, store.getGuestState());
          return;
        }

        const state = store.getStateByToken(token);
        if (!state) {
          fail(response, 401, 401, '未登录或登录已失效');
          return;
        }

        ok(response, state);
        return;
      }

      if (url.pathname === '/v1/recommendations/today/refresh' && request.method === 'POST') {
        const token = requireAuth(request, response, store);
        if (!token) {
          return;
        }
        ok(response, { state: store.rotateRecommendation(token) }, '已更新推荐');
        return;
      }

      if (url.pathname === '/v1/recommendations/today/schedule' && request.method === 'POST') {
        const token = requireAuth(request, response, store);
        if (!token) {
          return;
        }
        ok(response, { state: store.assignRecommendationToTomorrow(token) }, '已加入明天计划');
        return;
      }

      if (url.pathname === '/v1/recommendations/today/mark-worn' && request.method === 'POST') {
        const token = requireAuth(request, response, store);
        if (!token) {
          return;
        }
        ok(response, { state: store.markRecommendationWorn(token) }, '已标记今日穿搭');
        return;
      }

      if (url.pathname === '/v1/garments' && request.method === 'POST') {
        const token = requireAuth(request, response, store);
        if (!token) {
          return;
        }
        const body = await readJsonBody(request);
        ok(response, { state: store.createGarment(token, body) }, '保存成功');
        return;
      }

      if (url.pathname === '/v1/outfits' && request.method === 'POST') {
        const token = requireAuth(request, response, store);
        if (!token) {
          return;
        }
        const body = await readJsonBody(request);
        ok(response, { state: store.saveOutfit(token, body.slots || {}) }, '搭配已保存');
        return;
      }

      const markGarmentMatch = url.pathname.match(/^\/v1\/garments\/([^/]+)\/mark-worn$/);
      if (markGarmentMatch && request.method === 'POST') {
        const token = requireAuth(request, response, store);
        if (!token) {
          return;
        }
        ok(response, { state: store.markGarmentWorn(token, decodeURIComponent(markGarmentMatch[1])) }, '已标记');
        return;
      }

      const planRecommendationMatch = url.pathname.match(/^\/v1\/plans\/([^/]+)\/recommendation$/);
      if (planRecommendationMatch && request.method === 'POST') {
        const token = requireAuth(request, response, store);
        if (!token) {
          return;
        }
        ok(response, { state: store.assignRecommendationToDate(token, decodeURIComponent(planRecommendationMatch[1])) }, '计划已更新');
        return;
      }

      fail(response, 404, 404, '接口不存在');
    } catch (error) {
      fail(response, 500, 500, error.message || '服务器内部错误');
    }
  });

  server.on('close', () => {
    store.close();
  });

  return server;
}

module.exports = {
  createServer,
};
