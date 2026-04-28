const STORAGE_KEY = 'digital-wardrobe-mock-api-state-v2';
const FREE_GARMENT_LIMIT = 10;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function delay(result) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(clone(result));
    }, 120);
  });
}

function createDefaultState() {
  return {
    user: {
      id: 'user-xiaomei',
      name: '小美',
      city: '上海',
      weatherUpdatedAt: '07:40',
      commuteMode: true,
      preferenceSummary: '最近穿过避让已开启，优先给出通勤场景推荐。',
      privilege: {
        unlocked: false,
        expiresAt: null,
        garmentLimit: FREE_GARMENT_LIMIT,
      },
    },
    weather: {
      city: '上海',
      minTemp: 18,
      maxTemp: 24,
      condition: '小雨转阴',
      rainChance: '30%',
      wind: '东南风 3 级',
      summary: '建议带一件可穿脱外搭，优先避开最近穿过的单品。',
    },
    garments: [
      {
        id: 'g-001',
        name: '米白针织开衫',
        type: '外套',
        subType: '开衫',
        color: '米白',
        season: ['春', '秋'],
        warmthLevel: 2,
        texture: '针织',
        scene: '通勤',
        lastWornAt: '4 月 7 日',
        accent: '#d9c8b4',
      },
      {
        id: 'g-002',
        name: '炭灰廓形风衣',
        type: '外套',
        subType: '风衣',
        color: '炭灰',
        season: ['春', '秋'],
        warmthLevel: 3,
        texture: '挺括',
        scene: '通勤',
        lastWornAt: '4 月 4 日',
        accent: '#7f7d86',
      },
      {
        id: 'g-003',
        name: '奶油白短袖衬衫',
        type: '上装',
        subType: '短袖衬衫',
        color: '奶油白',
        season: ['春', '夏'],
        warmthLevel: 1,
        texture: '府绸',
        scene: '通勤',
        lastWornAt: '今天',
        accent: '#efe3cf',
      },
      {
        id: 'g-004',
        name: '墨黑短袖针织',
        type: '上装',
        subType: '短袖针织',
        color: '墨黑',
        season: ['春', '秋'],
        warmthLevel: 2,
        texture: '细针织',
        scene: '通勤',
        lastWornAt: '4 月 5 日',
        accent: '#3b3a41',
      },
      {
        id: 'g-005',
        name: '雾粉真丝衬衫',
        type: '上装',
        subType: '长袖衬衫',
        color: '雾粉',
        season: ['春', '秋'],
        warmthLevel: 2,
        texture: '真丝',
        scene: '通勤',
        lastWornAt: '4 月 1 日',
        accent: '#d7afb8',
      },
      {
        id: 'g-006',
        name: '燕麦色锥形西裤',
        type: '下装',
        subType: '西裤',
        color: '燕麦',
        season: ['春', '秋'],
        warmthLevel: 2,
        texture: '羊毛混纺',
        scene: '通勤',
        lastWornAt: '4 月 3 日',
        accent: '#cab69d',
      },
      {
        id: 'g-007',
        name: '奶白低跟乐福鞋',
        type: '鞋子',
        subType: '乐福鞋',
        color: '奶白',
        season: ['春', '秋'],
        warmthLevel: 1,
        texture: '皮质',
        scene: '通勤',
        lastWornAt: '4 月 7 日',
        accent: '#ddd1c4',
      },
      {
        id: 'g-008',
        name: '黑色软皮托特包',
        type: '包',
        subType: '托特包',
        color: '黑色',
        season: ['四季'],
        warmthLevel: 1,
        texture: '软皮',
        scene: '通勤',
        lastWornAt: '4 月 6 日',
        accent: '#29272f',
      },
    ],
    outfits: [
      {
        id: 'o-001',
        name: '雾光通勤一号',
        label: '薄外套 + 深色内搭 + 长裤',
        garmentIds: ['g-001', 'g-004', 'g-006', 'g-007', 'g-008'],
        reason: '今天 18°-24° 且早晚有风，适合带一件可穿脱的针织外搭。',
        weatherFit: '温差日 · 通勤',
        note: '这套会优先避开今天已经穿过的奶油白衬衫。',
      },
      {
        id: 'o-002',
        name: '风衣轻雨一号',
        label: '风衣 + 浅色内搭 + 长裤',
        garmentIds: ['g-002', 'g-003', 'g-006', 'g-007', 'g-008'],
        reason: '今天有轻微降雨，外层用挺括风衣更适合通勤途中应对小雨和风。',
        weatherFit: '小雨通勤',
        note: '上装更轻，适合会议日或稍正式的工作安排。',
      },
      {
        id: 'o-003',
        name: '衬衫柔光备选',
        label: '针织开衫 + 真丝衬衫 + 西裤',
        garmentIds: ['g-001', 'g-005', 'g-006', 'g-007', 'g-008'],
        reason: '如果今天节奏更平稳，可以用真丝衬衫做更柔和的通勤方案。',
        weatherFit: '通勤会议日',
        note: '色彩更柔和，适合需要气质感的工作场景。',
      },
    ],
    plans: [
      { date: '04-09', label: '今天', status: '已安排', outfitId: 'o-001', weather: '18°-24° 小雨转阴' },
      { date: '04-10', label: '明天', status: '待确认', outfitId: 'o-002', weather: '17°-23° 阴' },
      { date: '04-11', label: '周六', status: '需重选', outfitId: 'o-003', weather: '15°-21° 大风' },
      { date: '04-12', label: '周日', status: '待确认', outfitId: 'o-001', weather: '19°-26° 晴' },
    ],
    savedOutfitCount: 14,
    recommendationIndex: 0,
    statusMessage: '当前为非特权模式，衣橱免费额度 10 件；如需解除上限，请联系后台管理员开通特权。',
  };
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

function readState() {
  const stored = wx.getStorageSync(STORAGE_KEY);
  if (isStateLike(stored)) {
    return clone(stored);
  }

  const fallback = createDefaultState();
  wx.setStorageSync(STORAGE_KEY, fallback);
  return clone(fallback);
}

function writeState(nextState) {
  wx.setStorageSync(STORAGE_KEY, clone(nextState));
}

function getGarmentMap(garments) {
  const map = {};
  garments.forEach((garment) => {
    map[garment.id] = garment;
  });
  return map;
}

function getActiveRecommendation(state) {
  const garmentMap = getGarmentMap(state.garments);
  const available = state.outfits.filter((outfit) => outfit.garmentIds.every((id) => Boolean(garmentMap[id])));
  if (!available.length) {
    return null;
  }
  return available[state.recommendationIndex % available.length];
}

function initializeMockState() {
  readState();
}

async function login() {
  return delay({
    token: 'mock-access-token',
    user: {
      id: 'user-xiaomei',
      name: '小美',
    },
  });
}

async function bootstrapApp() {
  return delay(readState());
}

async function createGarment(payload) {
  const state = readState();
  state.garments.unshift({
    id: `g-${Date.now()}`,
    name: payload.name,
    type: payload.type,
    subType: payload.subType,
    color: payload.color,
    season: payload.season,
    warmthLevel: payload.warmthLevel,
    texture: payload.texture,
    scene: payload.scene,
    accent: payload.accent,
    lastWornAt: '刚刚入橱',
  });
  state.statusMessage = `已把「${payload.name}」加入电子衣橱，识别结果可继续微调。`;
  writeState(state);
  return delay(state);
}

async function rotateRecommendation() {
  const state = readState();
  state.recommendationIndex += 1;
  state.statusMessage = '已根据今天的天气重新换一套，仍会优先避开最近穿过的单品。';
  writeState(state);
  return delay(state);
}

function assignRecommendationToDateState(state, date, labelFallback) {
  const recommendation = getActiveRecommendation(state);
  if (!recommendation) {
    return state;
  }

  state.plans = state.plans.map((plan) => {
    if (plan.date === date || (labelFallback && plan.label === labelFallback)) {
      return {
        ...plan,
        outfitId: recommendation.id,
        status: '已安排',
      };
    }
    return plan;
  });
  return state;
}

async function assignRecommendationToTomorrow() {
  const state = readState();
  const recommendation = getActiveRecommendation(state);
  if (!recommendation) {
    return delay(state);
  }

  assignRecommendationToDateState(state, '', '明天');
  state.statusMessage = '已经把当前推荐加入明天计划，天气变化时会提醒你重选。';
  writeState(state);
  return delay(state);
}

async function assignRecommendationToDate(date) {
  const state = readState();
  const recommendation = getActiveRecommendation(state);
  if (!recommendation) {
    return delay(state);
  }

  assignRecommendationToDateState(state, date);
  const plan = state.plans.find((item) => item.date === date);
  state.statusMessage = `已把「${recommendation.name}」安排到 ${plan ? plan.label : '选中日期'}。`;
  writeState(state);
  return delay(state);
}

async function markRecommendationWorn() {
  const state = readState();
  const recommendation = getActiveRecommendation(state);
  if (!recommendation) {
    return delay(state);
  }

  state.garments = state.garments.map((garment) => {
    if (recommendation.garmentIds.indexOf(garment.id) >= 0) {
      return {
        ...garment,
        lastWornAt: '今天',
      };
    }
    return garment;
  });
  state.statusMessage = `已标记「${recommendation.name}」为今天穿搭，后续推荐会尽量避开重复。`;
  writeState(state);
  return delay(state);
}

async function saveOutfitBoard(slots) {
  const state = readState();
  const garmentMap = getGarmentMap(state.garments);
  const slotOrder = ['outer', 'upper', 'bottom', 'shoes', 'bag'];
  const garmentIds = slotOrder
    .map((slotId) => slots[slotId])
    .filter(Boolean);

  if (garmentIds.length) {
    const pieces = garmentIds.map((id) => garmentMap[id]).filter(Boolean);
    state.outfits.unshift({
      id: `o-${Date.now()}`,
      name: `我的搭配 ${state.savedOutfitCount + 1}`,
      label: pieces.map((piece) => piece.type).join(' + '),
      garmentIds,
      reason: '由用户在搭配台手动保存。',
      weatherFit: '自定义搭配',
      note: '这是一套刚保存的手动搭配。',
    });
  }

  state.savedOutfitCount += 1;
  state.statusMessage = '当前搭配已保存到“我的搭配”，并可直接加入穿搭日历。';
  writeState(state);
  return delay(state);
}

async function markGarmentWorn(garmentId) {
  const state = readState();
  state.garments = state.garments.map((garment) => {
    if (garment.id === garmentId) {
      return {
        ...garment,
        lastWornAt: '今天',
      };
    }
    return garment;
  });
  state.statusMessage = '已标记该单品今天穿过，后续推荐会尽量绕开它。';
  writeState(state);
  return delay(state);
}

async function resetState() {
  const nextState = createDefaultState();
  writeState(nextState);
  return delay(nextState);
}

module.exports = {
  FREE_GARMENT_LIMIT,
  bootstrapApp,
  createDefaultState,
  createGarment,
  initializeMockState,
  login,
  markGarmentWorn,
  markRecommendationWorn,
  resetState,
  rotateRecommendation,
  saveOutfitBoard,
  assignRecommendationToDate,
  assignRecommendationToTomorrow,
};
