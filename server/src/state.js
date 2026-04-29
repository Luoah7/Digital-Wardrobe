const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createDefaultState } = require('../../services/mock-backend');

const SLOT_ORDER = ['outer', 'upper', 'bottom', 'shoes', 'bag'];
const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'app.db');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function ensureDbDirectory(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

function getGarmentMap(garments) {
  return garments.reduce((map, garment) => {
    map[garment.id] = garment;
    return map;
  }, {});
}

function getAvailableRecommendations(state) {
  const garmentMap = getGarmentMap(state.garments);
  return state.outfits.filter((outfit) => outfit.garmentIds.every((id) => Boolean(garmentMap[id])));
}

function getActiveRecommendation(state) {
  const available = getAvailableRecommendations(state);
  if (!available.length) {
    return null;
  }

  return available[state.recommendationIndex % available.length];
}

function nextId(prefix, items) {
  const max = items.reduce((currentMax, item) => {
    const match = String(item.id || '').match(new RegExp(`^${prefix}-(\\d+)$`));
    if (!match) {
      return currentMax;
    }
    return Math.max(currentMax, Number(match[1]));
  }, 0);

  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

function upsertPlan(state, matcher, factory) {
  const index = state.plans.findIndex(matcher);
  if (index >= 0) {
    state.plans[index] = {
      ...state.plans[index],
      ...factory(state.plans[index]),
    };
    return;
  }

  state.plans.push(factory(null));
}

function createInitialUserState(userId, userName) {
  const state = createDefaultState();
  state.user = {
    ...state.user,
    id: `u-${userId}`,
    name: userName,
  };
  delete state.user.isGuest;
  return state;
}

function buildGuestState() {
  const state = createDefaultState();
  return {
    ...state,
    user: {
      id: 'guest',
      name: '游客',
      city: state.user.city,
      weatherUpdatedAt: state.user.weatherUpdatedAt,
      commuteMode: state.user.commuteMode,
      preferenceSummary: '当前为游客模式，登录后可同步你的穿着记录、搭配计划和特权状态。',
      privilege: {
        unlocked: false,
        expiresAt: null,
        garmentLimit: state.user.privilege.garmentLimit,
      },
      isGuest: true,
    },
    statusMessage: '当前为游客模式，可先浏览页面；如需保存衣物、搭配和计划，请先到“我的”页登录。',
  };
}

function maskOpenid(openid) {
  if (!openid || openid.length <= 10) {
    return openid || '';
  }

  return `${openid.slice(0, 6)}...${openid.slice(-4)}`;
}

function createSqliteStateStore(options = {}) {
  const dbPath = options.dbPath || DEFAULT_DB_PATH;
  ensureDbDirectory(dbPath);

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openid TEXT NOT NULL UNIQUE,
      unionid TEXT,
      session_key TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_states (
      user_id INTEGER PRIMARY KEY,
      state_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  const selectUserByOpenidStmt = db.prepare('SELECT * FROM users WHERE openid = ?');
  const selectSessionStmt = db.prepare(`
    SELECT
      s.token,
      s.user_id,
      u.name,
      u.openid,
      u.unionid,
      us.state_json
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    JOIN user_states us ON us.user_id = u.id
    WHERE s.token = ?
  `);
  const insertUserStmt = db.prepare(`
    INSERT INTO users (openid, unionid, session_key, name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const updateUserStmt = db.prepare(`
    UPDATE users
    SET unionid = ?, session_key = ?, updated_at = ?
    WHERE id = ?
  `);
  const insertUserStateStmt = db.prepare(`
    INSERT INTO user_states (user_id, state_json, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);
  const selectUserStateStmt = db.prepare('SELECT state_json FROM user_states WHERE user_id = ?');
  const updateUserStateStmt = db.prepare(`
    UPDATE user_states
    SET state_json = ?, updated_at = ?
    WHERE user_id = ?
  `);
  const insertSessionStmt = db.prepare(`
    INSERT INTO sessions (token, user_id, created_at, last_used_at)
    VALUES (?, ?, ?, ?)
  `);
  const touchSessionStmt = db.prepare('UPDATE sessions SET last_used_at = ? WHERE token = ?');

  function hydrateUserState(userId, userName, stateJson) {
    const state = JSON.parse(stateJson);
    state.user = {
      ...state.user,
      id: `u-${userId}`,
      name: userName,
      isGuest: false,
    };
    return state;
  }

  function persistUserState(userId, state) {
    const nextState = clone(state);
    nextState.user = {
      ...nextState.user,
      id: `u-${userId}`,
    };
    delete nextState.user.isGuest;
    updateUserStateStmt.run(JSON.stringify(nextState), nowIso(), userId);
    return hydrateUserState(userId, nextState.user.name, JSON.stringify(nextState));
  }

  function resolveSession(token) {
    const row = selectSessionStmt.get(token);
    if (!row) {
      return null;
    }

    // Check session expiry (7 days)
    const lastUsed = new Date(row.last_used_at);
    const maxAge = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - lastUsed.getTime() > maxAge) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      return null;
    }

    touchSessionStmt.run(nowIso(), token);
    return {
      token: row.token,
      userId: row.user_id,
      userName: row.name,
      openid: row.openid,
      unionid: row.unionid,
      state: hydrateUserState(row.user_id, row.name, row.state_json),
    };
  }

  // Clean expired sessions on startup
  const expiredCount = db.prepare("DELETE FROM sessions WHERE last_used_at < datetime('now', '-7 days')").run();
  if (expiredCount.changes > 0) {
    console.log(`[startup] cleaned ${expiredCount.changes} expired session(s)`);
  }

  return {
    getGuestState() {
      return buildGuestState();
    },

    createSessionForWechatUser(identity) {
      const timestamp = nowIso();
      let user = selectUserByOpenidStmt.get(identity.openid);
      const isNewUser = !user;

      if (!user) {
        const result = insertUserStmt.run(
          identity.openid,
          identity.unionid || null,
          identity.sessionKey,
          '微信用户',
          timestamp,
          timestamp,
        );
        const userId = Number(result.lastInsertRowid);
        const initialState = createInitialUserState(userId, '微信用户');
        insertUserStateStmt.run(userId, JSON.stringify(initialState), timestamp, timestamp);
        user = selectUserByOpenidStmt.get(identity.openid);
      } else {
        updateUserStmt.run(identity.unionid || null, identity.sessionKey, timestamp, user.id);
        const stateRow = selectUserStateStmt.get(user.id);
        if (!stateRow) {
          const initialState = createInitialUserState(user.id, user.name);
          insertUserStateStmt.run(user.id, JSON.stringify(initialState), timestamp, timestamp);
        }
      }

      const token = crypto.randomBytes(24).toString('hex');
      insertSessionStmt.run(token, user.id, timestamp, timestamp);

      return {
        token,
        user: {
          id: `u-${user.id}`,
          name: user.name,
        },
        loginMeta: {
          userId: user.id,
          isNewUser,
          openidMasked: maskOpenid(identity.openid),
          hasUnionid: Boolean(identity.unionid),
        },
      };
    },

    getStateByToken(token) {
      const session = resolveSession(token);
      return session ? clone(session.state) : null;
    },

    rotateRecommendation(token) {
      const session = resolveSession(token);
      if (!session) {
        return null;
      }

      session.state.recommendationIndex += 1;
      session.state.statusMessage = '已根据今天的天气重新换一套，仍会优先避开最近穿过的单品。';
      return persistUserState(session.userId, session.state);
    },

    createGarment(token, payload) {
      const session = resolveSession(token);
      if (!session) {
        return null;
      }

      const garment = {
        id: nextId('g', session.state.garments),
        name: payload.name,
        type: payload.type,
        subType: payload.subType,
        color: payload.color,
        season: payload.season,
        warmthLevel: payload.warmthLevel,
        texture: payload.texture,
        scene: payload.scene,
        accent: payload.accent,
        imageUrl: payload.imageUrl || '',
        lastWornAt: '刚刚入橱',
      };

      session.state.garments.unshift(garment);
      session.state.statusMessage = `已把「${payload.name}」加入电子衣橱，识别结果可继续微调。`;
      return persistUserState(session.userId, session.state);
    },

    assignRecommendationToTomorrow(token) {
      const session = resolveSession(token);
      if (!session) {
        return null;
      }

      const recommendation = getActiveRecommendation(session.state);
      if (!recommendation) {
        return clone(session.state);
      }

      upsertPlan(
        session.state,
        (plan) => plan.label === '明天',
        (previous) => ({
          date: previous ? previous.date : 'tomorrow',
          label: '明天',
          status: '已安排',
          outfitId: recommendation.id,
          weather: previous ? previous.weather : session.state.weather.summary,
        }),
      );

      session.state.statusMessage = '已经把当前推荐加入明天计划，天气变化时会提醒你重选。';
      return persistUserState(session.userId, session.state);
    },

    assignRecommendationToDate(token, date) {
      const session = resolveSession(token);
      if (!session) {
        return null;
      }

      const recommendation = getActiveRecommendation(session.state);
      if (!recommendation) {
        return clone(session.state);
      }

      upsertPlan(
        session.state,
        (plan) => plan.date === date,
        (previous) => ({
          date,
          label: previous ? previous.label : date,
          status: '已安排',
          outfitId: recommendation.id,
          weather: previous ? previous.weather : session.state.weather.summary,
        }),
      );

      session.state.statusMessage = `已把「${recommendation.name}」安排到 ${date}。`;
      return persistUserState(session.userId, session.state);
    },

    markRecommendationWorn(token) {
      const session = resolveSession(token);
      if (!session) {
        return null;
      }

      const recommendation = getActiveRecommendation(session.state);
      if (!recommendation) {
        return clone(session.state);
      }

      session.state.garments = session.state.garments.map((garment) => (
        recommendation.garmentIds.includes(garment.id)
          ? { ...garment, lastWornAt: '今天' }
          : garment
      ));

      session.state.statusMessage = `已标记「${recommendation.name}」为今天穿搭，后续推荐会尽量避开重复。`;
      return persistUserState(session.userId, session.state);
    },

    saveOutfit(token, slots) {
      const session = resolveSession(token);
      if (!session) {
        return null;
      }

      const garmentMap = getGarmentMap(session.state.garments);
      const garmentIds = SLOT_ORDER.map((slotId) => slots[slotId]).filter(Boolean);

      if (garmentIds.length) {
        const pieces = garmentIds.map((id) => garmentMap[id]).filter(Boolean);
        const reasonDetails = pieces.map((piece) => `选择了${piece.color}${piece.subType || piece.type}`);
        session.state.outfits.unshift({
          id: nextId('o', session.state.outfits),
          name: `我的搭配 ${session.state.savedOutfitCount + 1}`,
          label: pieces.map((piece) => piece.type).join(' + '),
          garmentIds,
          reason: '由用户在搭配台手动保存。',
          reasonDetails,
          weatherFit: '自定义搭配',
          note: '这是一套刚保存的手动搭配。',
        });
      }

      session.state.savedOutfitCount += 1;
      session.state.statusMessage = '当前搭配已保存到“我的搭配”，并可直接加入穿搭日历。';
      return persistUserState(session.userId, session.state);
    },

    markGarmentWorn(token, garmentId) {
      const session = resolveSession(token);
      if (!session) {
        return null;
      }

      session.state.garments = session.state.garments.map((garment) => (
        garment.id === garmentId
          ? { ...garment, lastWornAt: '今天' }
          : garment
      ));

      session.state.statusMessage = '已标记该单品今天穿过，后续推荐会尽量绕开它。';
      return persistUserState(session.userId, session.state);
    },

    updateGarment(token, garmentId, updates) {
      const session = resolveSession(token);
      if (!session) {
        return null;
      }

      const index = session.state.garments.findIndex((g) => g.id === garmentId);
      if (index === -1) {
        return { notFound: true };
      }

      const allowedFields = ['name', 'type', 'subType', 'color', 'season', 'warmthLevel', 'texture', 'scene', 'accent', 'imageUrl'];
      const current = session.state.garments[index];
      const patched = { ...current };
      for (const key of allowedFields) {
        if (updates[key] !== undefined) {
          patched[key] = updates[key];
        }
      }
      session.state.garments[index] = patched;
      session.state.statusMessage = `已更新「${patched.name}」的信息。`;
      return persistUserState(session.userId, session.state);
    },

    deleteGarment(token, garmentId) {
      const session = resolveSession(token);
      if (!session) {
        return null;
      }

      const index = session.state.garments.findIndex((g) => g.id === garmentId);
      if (index === -1) {
        return { notFound: true };
      }

      const deleted = session.state.garments[index];
      session.state.garments.splice(index, 1);

      // Remove garment references from outfits
      session.state.outfits = session.state.outfits
        .map((outfit) => ({
          ...outfit,
          garmentIds: outfit.garmentIds.filter((id) => id !== garmentId),
        }))
        .filter((outfit) => outfit.garmentIds.length > 0);

      session.state.statusMessage = `已把「${deleted.name}」从衣橱中移除。`;
      return { state: persistUserState(session.userId, session.state), deleted };
    },

    getDb() {
      return db;
    },

    close() {
      db.close();
    },
  };
}

module.exports = {
  DEFAULT_DB_PATH,
  createSqliteStateStore,
};
