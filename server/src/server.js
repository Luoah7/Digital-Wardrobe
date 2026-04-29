const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { createSqliteStateStore } = require('./state');
const { createWechatAuthClient } = require('./wechat-auth');
const {
  fail: sendFail,
  MAX_BODY_BYTES,
  validateGarmentFields,
  validateGarmentLimit,
} = require('./validate');
const { parseContentType, parseMultipart, readMultipartBody } = require('./multipart');
const { getWeather } = require('./weather');
const recommender = require('./recommender');

const isProduction = process.env.NODE_ENV === 'production';

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB
const IMAGE_MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  });
  response.end(body);
}

function logRequest(method, pathname, statusCode, ms) {
  if (isProduction) {
    console.log(`[${new Date().toISOString()}] ${method} ${pathname} ${statusCode} ${ms}ms`);
  }
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
    let totalBytes = 0;

    request.on('data', (chunk) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        reject(new Error('请求体过大'));
        return;
      }
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

function collectReferencedImages(store) {
  const referenced = new Set();
  try {
    const db = store.getDb ? store.getDb() : null;
    if (!db) return referenced;
    const rows = db.prepare('SELECT state_json FROM user_states').all();
    for (const row of rows) {
      const state = JSON.parse(row.state_json);
      for (const garment of (state.garments || [])) {
        if (garment.imageUrl && garment.imageUrl.startsWith('/v1/images/')) {
          referenced.add(path.basename(garment.imageUrl));
        }
      }
    }
  } catch (_) {
    // ignore
  }
  return referenced;
}

function cleanupOrphanedImages(store) {
  if (!fs.existsSync(UPLOAD_DIR)) return 0;
  const referenced = collectReferencedImages(store);
  let removed = 0;
  const files = fs.readdirSync(UPLOAD_DIR);
  for (const file of files) {
    if (file === '.gitkeep') continue;
    if (!referenced.has(file)) {
      try {
        fs.unlinkSync(path.join(UPLOAD_DIR, file));
        removed++;
      } catch (_) {
        // ignore
      }
    }
  }
  return removed;
}

function createServer(options = {}) {
  const store = createSqliteStateStore(options);
  const wechatAuthClient = options.wechatAuthClient || createWechatAuthClient(options);

  // Clean orphaned images on startup
  const cleanedCount = cleanupOrphanedImages(store);
  if (cleanedCount > 0) {
    console.log(`[startup] cleaned ${cleanedCount} orphaned image(s) from uploads/`);
  }

  const server = http.createServer(async (request, response) => {
    const startTime = Date.now();
    const url = new URL(request.url, 'http://127.0.0.1');

    try {
      // Health check (no auth, no logging)
      if (url.pathname === '/v1/health' && request.method === 'GET') {
        ok(response, {
          status: 'ok',
          uptime: Math.floor(process.uptime()),
          dbConnected: true,
        });
        return;
      }
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
          const guestState = store.getGuestState();
          const weather = await getWeather(guestState.user.city);
          guestState.weather = weather;
          ok(response, guestState);
          return;
        }

        const state = store.getStateByToken(token);
        if (!state) {
          fail(response, 401, 401, '未登录或登录已失效');
          return;
        }

        // Fetch real weather
        const weather = await getWeather(state.user.city || '上海');
        state.weather = weather;

        // Generate recommendation using rule engine
        if (state.garments && state.garments.length > 0) {
          const rec = recommender.generate(state.garments, state.outfits, weather);
          state.recommendation = rec.recommended;
          state.alternatives = rec.alternatives;
          state.statusMessage = rec.reason;
        }

        ok(response, state);
        return;
      }

      if (url.pathname === '/v1/recommendations/today/refresh' && request.method === 'POST') {
        const token = requireAuth(request, response, store);
        if (!token) {
          return;
        }
        const state = store.rotateRecommendation(token);
        // Re-generate recommendation with rule engine
        const weather = await getWeather(state.user.city || '上海');
        state.weather = weather;
        if (state.garments && state.garments.length > 0) {
          const rec = recommender.generate(state.garments, state.outfits, weather);
          state.recommendation = rec.recommended;
          state.alternatives = rec.alternatives;
          state.statusMessage = '已根据天气和穿着记录重新推荐';
        }
        ok(response, { state }, '已更新推荐');
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
        const fieldErrors = validateGarmentFields(body);
        if (fieldErrors.length > 0) {
          sendFail(response, 400, 400, fieldErrors.join('；'));
          return;
        }
        const limitError = validateGarmentLimit(store.getStateByToken(token));
        if (limitError) {
          sendFail(response, 400, 400, limitError);
          return;
        }
        ok(response, { state: store.createGarment(token, body) }, '保存成功');
        return;
      }

      if (url.pathname === '/v1/outfits' && request.method === 'POST') {
        const token = requireAuth(request, response, store);
        if (!token) {
          return;
        }
        const body = await readJsonBody(request);
        const slots = body.slots || {};
        const filledSlots = Object.values(slots).filter(Boolean);
        if (filledSlots.length === 0) {
          sendFail(response, 400, 400, '搭配至少需要选择一件衣物');
          return;
        }
        ok(response, { state: store.saveOutfit(token, slots) }, '搭配已保存');
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

      // PUT /v1/garments/:id — edit garment
      const editGarmentMatch = url.pathname.match(/^\/v1\/garments\/([^/]+)$/);
      if (editGarmentMatch && request.method === 'PUT') {
        const token = requireAuth(request, response, store);
        if (!token) {
          return;
        }
        const body = await readJsonBody(request);
        const fieldErrors = validateGarmentFields(body, { partial: true });
        if (fieldErrors.length > 0) {
          sendFail(response, 400, 400, fieldErrors.join('；'));
          return;
        }
        const result = store.updateGarment(token, decodeURIComponent(editGarmentMatch[1]), body);
        if (result && result.notFound) {
          sendFail(response, 404, 404, '衣物不存在');
          return;
        }
        ok(response, { state: result }, '更新成功');
        return;
      }

      // DELETE /v1/garments/:id — delete garment
      const deleteGarmentMatch = url.pathname.match(/^\/v1\/garments\/([^/]+)$/);
      if (deleteGarmentMatch && request.method === 'DELETE') {
        const token = requireAuth(request, response, store);
        if (!token) {
          return;
        }
        const result = store.deleteGarment(token, decodeURIComponent(deleteGarmentMatch[1]));
        if (result && result.notFound) {
          sendFail(response, 404, 404, '衣物不存在');
          return;
        }
        // Best-effort image cleanup
        if (result.deleted && result.deleted.imageUrl) {
          const imageFilename = path.basename(result.deleted.imageUrl);
          const imageFilePath = path.join(UPLOAD_DIR, imageFilename);
          try {
            if (fs.existsSync(imageFilePath)) {
              fs.unlinkSync(imageFilePath);
            }
          } catch (_) {
            // ignore cleanup failure
          }
        }
        ok(response, { state: result.state }, '删除成功');
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

      // POST /v1/upload/garment-image — upload image
      if (url.pathname === '/v1/upload/garment-image' && request.method === 'POST') {
        const token = requireAuth(request, response, store);
        if (!token) {
          return;
        }

        const boundary = parseContentType(request.headers['content-type']);
        if (!boundary) {
          sendFail(response, 400, 400, '请求格式错误，需要 multipart/form-data');
          return;
        }

        const rawBody = await readMultipartBody(request);
        const filePart = parseMultipart(rawBody, boundary);
        if (!filePart || !filePart.buffer || filePart.buffer.length === 0) {
          sendFail(response, 400, 400, '未找到上传文件');
          return;
        }

        if (filePart.buffer.length > MAX_IMAGE_BYTES) {
          sendFail(response, 413, 413, `图片大小 ${(filePart.buffer.length / 1024 / 1024).toFixed(1)}MB 超过 2MB 限制，请压缩后再上传`);
          return;
        }

        const ext = path.extname(filePart.originalName).toLowerCase() || '.jpg';
        const safeExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const finalExt = safeExts.includes(ext) ? ext : '.jpg';
        const filename = `${crypto.randomUUID()}${finalExt}`;
        const filePath = path.join(UPLOAD_DIR, filename);

        fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        fs.writeFileSync(filePath, filePart.buffer);

        ok(response, { imageUrl: `/v1/images/${filename}` }, '上传成功');
        return;
      }

      // GET /v1/images/:filename — serve uploaded image (streaming)
      const imageMatch = url.pathname.match(/^\/v1\/images\/([^/]+)$/);
      if (imageMatch && request.method === 'GET') {
        const filename = imageMatch[1];
        // Prevent path traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\0')) {
          sendFail(response, 400, 400, '文件名不合法');
          return;
        }
        const filePath = path.join(UPLOAD_DIR, filename);
        if (!fs.existsSync(filePath)) {
          sendFail(response, 404, 404, '图片不存在');
          return;
        }
        const stat = fs.statSync(filePath);
        const etag = `"${stat.mtimeMs.toString(36)}-${stat.size.toString(36)}"`;
        if (request.headers['if-none-match'] === etag) {
          response.writeHead(304);
          response.end();
          return;
        }
        const ext = path.extname(filename).toLowerCase();
        const contentType = IMAGE_MIME_TYPES[ext] || 'application/octet-stream';
        response.writeHead(200, {
          'content-type': contentType,
          'content-length': stat.size,
          'cache-control': 'public, max-age=86400',
          'etag': etag,
        });
        fs.createReadStream(filePath).pipe(response);
        return;
      }

      fail(response, 404, 404, '接口不存在');
    } catch (error) {
      const msg = isProduction ? '服务器内部错误' : (error.message || '服务器内部错误');
      fail(response, 500, 500, msg);
    } finally {
      logRequest(request.method, url.pathname, response.statusCode, Date.now() - startTime);
    }
  });

  server.cleanupOrphans = () => cleanupOrphanedImages(store);

  server.gracefulShutdown = () => {
    console.log('[shutdown] closing server...');
    server.close(() => {
      console.log('[shutdown] closing database...');
      store.close();
      process.exit(0);
    });
    setTimeout(() => {
      console.log('[shutdown] forced exit after timeout');
      process.exit(1);
    }, 10000);
  };

  server.on('close', () => {
    store.close();
  });

  return server;
}

module.exports = {
  createServer,
};
