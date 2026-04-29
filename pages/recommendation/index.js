const {
  assignRecommendationToTomorrow: assignRecommendationToTomorrowAction,
  getActiveRecommendation,
  getAvailableRecommendations,
  getGarmentMap,
  getState,
  markRecommendationWorn: markRecommendationWornAction,
  rotateRecommendation: rotateRecommendationAction,
} = require('../../utils/store');
const { UI_ICONS, decorateGarment, decorateGarments } = require('../../utils/presenter');

function getPieces(outfit, garments) {
  const garmentMap = getGarmentMap(garments);
  return outfit.garmentIds.map((garmentId) => garmentMap[garmentId]).filter(Boolean);
}

Page({
  data: {
    icons: UI_ICONS,
    loading: false,
    error: '',
    weatherText: '',
    recommendation: null,
    reasonDetails: [],
    pieces: [],
    alternatives: [],
  },

  onShow() {
    this.refreshPage();
  },

  async refreshPage() {
    this.setData({ loading: true, error: '' });
    try {
      const state = await getState(true);
      const recommendation = getActiveRecommendation(state);
      const alternatives = getAvailableRecommendations(state).filter((outfit) => !recommendation || outfit.id !== recommendation.id);

      this.setData({
        weatherText: `${state.weather.city} · ${state.weather.minTemp}°-${state.weather.maxTemp}° · ${state.weather.condition}`,
        recommendation,
        reasonDetails: (recommendation && recommendation.reasonDetails) || [],
        pieces: recommendation ? decorateGarments(getPieces(recommendation, state.garments)) : [],
        alternatives: alternatives.slice(0, 2).map((item) => ({
          ...item,
          previewPieces: decorateGarments(getPieces(item, state.garments).slice(0, 3)),
        })),
      });
    } catch (e) {
      this.setData({ error: '推荐加载失败' });
      wx.showToast({ title: '推荐加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  async rotateRecommendation() {
    try {
      await rotateRecommendationAction();
      this.refreshPage();
    } catch (error) {
      wx.showToast({
        title: error.message || '换一套失败',
        icon: 'none',
      });
    }
  },

  async addToTomorrow() {
    try {
      await assignRecommendationToTomorrowAction();
      wx.showToast({ title: '已加入明天计划', icon: 'success' });
    } catch (error) {
      wx.showToast({
        title: error.message || '加入计划失败',
        icon: 'none',
      });
    }
  },

  async markWorn() {
    try {
      await markRecommendationWornAction();
      wx.showToast({ title: '已标记为今日穿搭', icon: 'success' });
      this.refreshPage();
    } catch (error) {
      wx.showToast({
        title: error.message || '标记失败',
        icon: 'none',
      });
    }
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }
    wx.reLaunch({ url: '/pages/home/index' });
  },
});
