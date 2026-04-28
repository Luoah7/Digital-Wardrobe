const env = require('../config/env');
const { request } = require('./request');
const mockBackend = require('../services/mock-backend');

const TOKEN_STORAGE_KEY = 'digital-wardrobe-access-token';
const USER_STORAGE_KEY = 'digital-wardrobe-session-user';

let pendingLoginPromise = null;

function getToken() {
  return wx.getStorageSync(TOKEN_STORAGE_KEY) || '';
}

function setSession(session) {
  if (!session || !session.token) {
    return;
  }

  wx.setStorageSync(TOKEN_STORAGE_KEY, session.token);
  if (session.user) {
    wx.setStorageSync(USER_STORAGE_KEY, session.user);
  }
}

function clearSession() {
  wx.removeStorageSync(TOKEN_STORAGE_KEY);
  wx.removeStorageSync(USER_STORAGE_KEY);
}

function runWxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(result) {
        if (!result.code) {
          reject(new Error('微信登录失败，未获取到 code'));
          return;
        }
        resolve(result.code);
      },
      fail(error) {
        reject(new Error(error.errMsg || '微信登录失败'));
      },
    });
  });
}

async function performLogin() {
  const code = await runWxLogin();
  const session = env.useMockApi
    ? await mockBackend.login({ code })
    : await request({
      path: '/v1/auth/wechat/login',
      method: 'POST',
      data: { code },
    });

  setSession(session);
  return session;
}

async function loginWithWechat(forceRefresh) {
  if (!forceRefresh && getToken()) {
    return {
      token: getToken(),
      user: wx.getStorageSync(USER_STORAGE_KEY) || null,
    };
  }

  if (pendingLoginPromise) {
    return pendingLoginPromise;
  }

  pendingLoginPromise = performLogin().finally(() => {
    pendingLoginPromise = null;
  });

  return pendingLoginPromise;
}

async function ensureAuthenticated(forceRefresh) {
  return loginWithWechat(forceRefresh);
}

module.exports = {
  clearSession,
  ensureAuthenticated,
  getToken,
  loginWithWechat,
};
