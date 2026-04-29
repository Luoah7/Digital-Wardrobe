const env = require('../config/env');
const { request } = require('./request');
const {
  clearSession,
  ensureAuthenticated,
  getToken,
  loginWithWechat,
} = require('./session');
const mockBackend = require('../services/mock-backend');

const FREE_GARMENT_LIMIT = mockBackend.FREE_GARMENT_LIMIT;

let cachedState = null;
let pendingBootstrapPromise = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isStateLike(value) {
  return value
    && typeof value === 'object'
    && Array.isArray(value.garments)
    && Array.isArray(value.outfits)
    && Array.isArray(value.plans)
    && value.user
    && value.weather;
}

function cacheState(nextState) {
  if (!isStateLike(nextState)) {
    return null;
  }

  cachedState = clone(nextState);
  return clone(cachedState);
}

async function initializeState() {
  if (env.useMockApi) {
    mockBackend.initializeMockState();
  }
}

async function fetchBootstrapFromApi() {
  const token = getToken();
  try {
    return await request({
      path: '/v1/app/bootstrap',
      method: 'GET',
      header: token
        ? {
          Authorization: `Bearer ${token}`,
        }
        : {},
    });
  } catch (error) {
    if (token && /HTTP 401/.test(error.message || '')) {
      clearSession();
      return request({
        path: '/v1/app/bootstrap',
        method: 'GET',
      });
    }
    throw error;
  }
}

async function loginUser() {
  if (env.useMockApi) {
    await ensureAuthenticated(true);
    return getState(true);
  }

  await loginWithWechat(true);
  cachedState = null;
  pendingBootstrapPromise = null;
  return getState(true);
}

async function logoutUser() {
  clearSession();
  cachedState = null;
  pendingBootstrapPromise = null;
  return getState(true);
}

async function requireLoggedIn() {
  if (!getToken()) {
    throw new Error('请先到“我的”页登录');
  }
}

async function authedRequest(options) {
  await requireLoggedIn();
  try {
    return await request({
      ...options,
      header: {
        Authorization: `Bearer ${getToken()}`,
        ...(options && options.header ? options.header : {}),
      },
    });
  } catch (error) {
    if (/HTTP 401/.test(error.message || '')) {
      clearSession();
      cachedState = null;
      pendingBootstrapPromise = null;
      throw new Error('登录已失效，请先到“我的”页重新登录');
    }
    throw error;
  }
}

async function syncMutationState(result) {
  if (isStateLike(result)) {
    return cacheState(result);
  }

  if (result && isStateLike(result.state)) {
    return cacheState(result.state);
  }

  return getState(true);
}

async function rotateRecommendation() {
  if (env.useMockApi) {
    return syncMutationState(await mockBackend.rotateRecommendation());
  }

  return syncMutationState(await authedRequest({
    path: '/v1/recommendations/today/refresh',
    method: 'POST',
  }));
}

async function getState(forceRefresh) {
  if (env.useMockApi) {
    return cacheState(await mockBackend.bootstrapApp());
  }

  if (!forceRefresh && cachedState) {
    return clone(cachedState);
  }

  if (pendingBootstrapPromise && !forceRefresh) {
    return pendingBootstrapPromise;
  }

  pendingBootstrapPromise = fetchBootstrapFromApi()
    .then((result) => cacheState(result))
    .finally(() => {
      pendingBootstrapPromise = null;
    });

  return pendingBootstrapPromise;
}

async function createCapturedGarment(payload) {
  if (env.useMockApi) {
    return syncMutationState(await mockBackend.createGarment(payload));
  }

  return syncMutationState(await authedRequest({
    path: '/v1/garments',
    method: 'POST',
    data: payload,
  }));
}

async function assignRecommendationToTomorrow() {
  if (env.useMockApi) {
    return syncMutationState(await mockBackend.assignRecommendationToTomorrow());
  }

  return syncMutationState(await authedRequest({
    path: '/v1/recommendations/today/schedule',
    method: 'POST',
    data: {
      target: 'tomorrow',
    },
  }));
}

async function assignRecommendationToDate(date) {
  if (env.useMockApi) {
    return syncMutationState(await mockBackend.assignRecommendationToDate(date));
  }

  return syncMutationState(await authedRequest({
    path: `/v1/plans/${encodeURIComponent(date)}/recommendation`,
    method: 'POST',
  }));
}

async function markRecommendationWorn() {
  if (env.useMockApi) {
    return syncMutationState(await mockBackend.markRecommendationWorn());
  }

  return syncMutationState(await authedRequest({
    path: '/v1/recommendations/today/mark-worn',
    method: 'POST',
  }));
}

async function saveOutfitBoard(slots) {
  if (env.useMockApi) {
    return syncMutationState(await mockBackend.saveOutfitBoard(slots));
  }

  return syncMutationState(await authedRequest({
    path: '/v1/outfits',
    method: 'POST',
    data: {
      slots,
    },
  }));
}

async function markGarmentWorn(garmentId) {
  if (env.useMockApi) {
    return syncMutationState(await mockBackend.markGarmentWorn(garmentId));
  }

  return syncMutationState(await authedRequest({
    path: `/v1/garments/${encodeURIComponent(garmentId)}/mark-worn`,
    method: 'POST',
  }));
}

async function resetState() {
  if (env.useMockApi) {
    return syncMutationState(await mockBackend.resetState());
  }

  throw new Error('真实接口模式下不支持在小程序里直接重置数据');
}

function getGarmentMap(garments) {
  const map = {};
  garments.forEach((garment) => {
    map[garment.id] = garment;
  });
  return map;
}

function getAvailableRecommendations(state) {
  const garmentMap = getGarmentMap(state.garments);
  return state.outfits.filter((outfit) => outfit.garmentIds.every((garmentId) => Boolean(garmentMap[garmentId])));
}

function getActiveRecommendation(state) {
  const available = getAvailableRecommendations(state);
  if (!available.length) {
    return null;
  }
  const safeIndex = state.recommendationIndex % available.length;
  return available[safeIndex];
}

function getRemainingSlots(state) {
  if (state.user.privilege.unlocked) {
    return null;
  }
  return Math.max(0, state.user.privilege.garmentLimit - state.garments.length);
}

function isGarmentLimitReached(state) {
  if (state.user.privilege.unlocked) {
    return false;
  }
  return state.garments.length >= state.user.privilege.garmentLimit;
}

async function updateGarment(garmentId, updates) {
  if (env.useMockApi) {
    return syncMutationState(await mockBackend.updateGarment(garmentId, updates));
  }

  return syncMutationState(await authedRequest({
    path: `/v1/garments/${encodeURIComponent(garmentId)}`,
    method: 'PUT',
    data: updates,
  }));
}

async function deleteGarment(garmentId) {
  if (env.useMockApi) {
    return syncMutationState(await mockBackend.deleteGarment(garmentId));
  }

  return syncMutationState(await authedRequest({
    path: `/v1/garments/${encodeURIComponent(garmentId)}`,
    method: 'DELETE',
  }));
}

module.exports = {
  FREE_GARMENT_LIMIT,
  assignRecommendationToDate,
  assignRecommendationToTomorrow,
  createCapturedGarment,
  deleteGarment,
  getActiveRecommendation,
  getAvailableRecommendations,
  getGarmentMap,
  getRemainingSlots,
  getState,
  initializeState,
  isGarmentLimitReached,
  isMockMode: env.useMockApi,
  loginUser,
  logoutUser,
  markGarmentWorn,
  markRecommendationWorn,
  resetState,
  rotateRecommendation,
  saveOutfitBoard,
  updateGarment,
};
