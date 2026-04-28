const {
  FREE_GARMENT_LIMIT,
  getActiveRecommendation,
  getAvailableRecommendations,
  getGarmentMap,
  getRemainingSlots,
  getState,
  isGarmentLimitReached,
} = require('../../utils/store');
const { UI_ICONS, decorateGarments } = require('../../utils/presenter');

function getOutfitPieces(outfit, garments) {
  const garmentMap = getGarmentMap(garments);
  return outfit.garmentIds
    .map((garmentId) => garmentMap[garmentId])
    .filter(Boolean);
}

Page({
  data: {
    icons: UI_ICONS,
    statusMessage: '',
    weatherLine: '',
    weatherBadges: [],
    recommendation: null,
    garmentsCountText: '',
    garmentsNote: '',
    privilegeTitle: '',
    privilegeBody: '',
    quickActions: [],
    tomorrowPlan: null,
    recentStory: '',
    outfitCards: [],
    savedOutfitCount: 0,
    tomorrowCount: 0,
  },

  onShow() {
    this.refreshPage();
  },

  async refreshPage() {
    try {
      const state = await getState(true);
      const activeRecommendation = getActiveRecommendation(state);
      const availableRecommendations = getAvailableRecommendations(state);
      const garmentLimitReached = isGarmentLimitReached(state);
      const remainingSlots = getRemainingSlots(state);
      const wornToday = state.garments.filter((garment) => garment.lastWornAt === '今天').slice(0, 2);
      const tomorrowPlan = state.plans.find((plan) => plan.label === '明天') || null;

      this.setData({
        statusMessage: state.statusMessage,
        weatherLine: `${state.weather.city} · 周四 · ${state.weather.minTemp}°-${state.weather.maxTemp}° · ${state.weather.condition}`,
        weatherBadges: [
          { icon: UI_ICONS.cloudRain, text: '小雨通勤' },
          { icon: UI_ICONS.umbrella, text: `降雨 ${state.weather.rainChance}` },
          { icon: UI_ICONS.wind, text: state.weather.wind },
        ],
        recommendation: activeRecommendation ? {
          id: activeRecommendation.id,
          label: activeRecommendation.label,
          note: activeRecommendation.note,
          reason: activeRecommendation.reason,
          pieces: decorateGarments(getOutfitPieces(activeRecommendation, state.garments).slice(0, 3)),
        } : null,
        garmentsCountText: state.user.privilege.unlocked
          ? `${state.garments.length}`
          : `${state.garments.length}/${FREE_GARMENT_LIMIT}`,
        garmentsNote: state.user.privilege.unlocked
          ? '特权已解锁 · 无上限'
          : garmentLimitReached
            ? '免费额度已满'
            : `还可新增${remainingSlots}件`,
        privilegeTitle: state.user.privilege.unlocked
          ? '已解锁无限衣橱容量'
          : '非特权用户仅可添加 10 件衣物',
        privilegeBody: state.user.privilege.unlocked
          ? state.user.privilege.expiresAt
            ? `后台已为你开通特权，有效期至${state.user.privilege.expiresAt}。`
            : '后台已为你开通特权，后续拍照入橱不再受数量限制。'
          : garmentLimitReached
            ? '当前衣橱已满 10/10，继续入橱前需要后台管理员先开通特权。'
            : `当前还剩${remainingSlots}个免费衣橱名额，特权仅支持后台管理员手动开通。`,
        quickActions: [
          {
            key: 'capture',
            icon: UI_ICONS.camera,
            title: garmentLimitReached ? '免费额度已满' : '马上入橱',
            desc: state.user.privilege.unlocked
              ? '特权已生效，继续拍一件自动抠图分类'
              : garmentLimitReached
                ? '已达 10 件上限，请先让后台管理员开通特权'
                : `当前免费额度还剩${remainingSlots}件`,
          },
          {
            key: 'studio',
            icon: UI_ICONS.studio,
            title: '打开搭配台',
            desc: '从现有衣服拼一套通勤 Look',
          },
          {
            key: 'calendar',
            icon: UI_ICONS.calendar,
            title: '安排明天',
            desc: '先把明早要穿的放进日历',
          },
          {
            key: 'closet',
            icon: UI_ICONS.closet,
            title: '查看衣橱',
            desc: '筛选最近没穿过的单品',
          },
        ],
        tomorrowPlan: tomorrowPlan ? {
          label: tomorrowPlan.label,
          status: tomorrowPlan.status,
          weather: tomorrowPlan.weather,
          outfitName: (state.outfits.find((outfit) => outfit.id === tomorrowPlan.outfitId) || {}).name || '待挑选',
        } : null,
        savedOutfitCount: state.savedOutfitCount,
        tomorrowCount: state.plans.filter((plan) => plan.status === '已安排' || plan.label === '明天').length,
        recentStory: wornToday.length
          ? `你今天已经穿过${wornToday.map((item) => item.name).join('和')}，今日推荐会优先绕开这两个单品。`
          : '最近穿过避让已开启，推荐会优先考虑尚未高频穿着的单品。',
        outfitCards: availableRecommendations.slice(0, 3).map((outfit) => ({
          id: outfit.id,
          name: outfit.name,
          weatherFit: outfit.weatherFit,
          pieces: decorateGarments(getOutfitPieces(outfit, state.garments).slice(0, 3)),
          pieceSummary: getOutfitPieces(outfit, state.garments).slice(0, 3).map((piece) => piece.name).join(' · '),
        })),
      });
    } catch (error) {
      wx.showToast({
        title: '首页数据加载失败',
        icon: 'none',
      });
      this.setData({
        statusMessage: error.message || '首页数据加载失败',
      });
    }
  },

  openRecommendation() {
    wx.navigateTo({ url: '/pages/recommendation/index' });
  },

  handleQuickAction(event) {
    const { key } = event.currentTarget.dataset;
    if (key === 'capture') {
      wx.navigateTo({ url: '/pages/capture/index?source=camera' });
      return;
    }
    if (key === 'studio') {
      wx.redirectTo({ url: '/pages/studio/index' });
      return;
    }
    if (key === 'calendar') {
      wx.redirectTo({ url: '/pages/calendar/index' });
      return;
    }
    wx.redirectTo({ url: '/pages/closet/index' });
  },

  handleCapture() {
    wx.navigateTo({ url: '/pages/capture/index' });
  },
});
