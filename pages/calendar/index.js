const { assignRecommendationToDate, getActiveRecommendation, getState } = require('../../utils/store');

function decoratePlans(state) {
  return state.plans.map((plan) => {
    const outfit = state.outfits.find((item) => item.id === plan.outfitId);
    return {
      ...plan,
      outfitName: outfit ? outfit.name : '待挑选',
    };
  });
}

Page({
  data: {
    loading: false,
    error: '',
    statusMessage: '',
    plans: [],
    selectedDate: '',
    selectedPlan: null,
    recommendationName: '',
  },

  onShow() {
    this.refreshPage();
  },

  async refreshPage(forceDate) {
    this.setData({ loading: true, error: '' });
    try {
      const state = await getState(true);
      const selectedDate = forceDate || this.data.selectedDate || ((state.plans.find((plan) => plan.label === '明天') || {}).date || state.plans[0].date);
      this.syncPage(state, selectedDate);
    } catch (e) {
      this.setData({ error: '日历加载失败' });
      wx.showToast({ title: '日历加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  syncPage(state, selectedDate) {
    const snapshot = state;
    const plans = decoratePlans(snapshot);
    const selectedPlan = plans.find((plan) => plan.date === selectedDate) || plans[0] || null;
    const recommendation = getActiveRecommendation(snapshot);

    this.setData({
      statusMessage: snapshot.statusMessage,
      plans,
      selectedDate: selectedPlan ? selectedPlan.date : '',
      selectedPlan,
      recommendationName: recommendation ? recommendation.name : '当前暂无推荐',
    });
  },

  choosePlan(event) {
    this.setData({
      selectedDate: event.currentTarget.dataset.date,
      selectedPlan: this.data.plans.find((plan) => plan.date === event.currentTarget.dataset.date) || null,
    });
  },

  async useRecommendationForSelectedDate() {
    if (!this.data.selectedPlan) {
      return;
    }

    try {
      await assignRecommendationToDate(this.data.selectedPlan.date);
      wx.showToast({ title: '已更新计划', icon: 'success' });
      this.refreshPage(this.data.selectedPlan.date);
    } catch (error) {
      wx.showToast({
        title: error.message || '更新计划失败',
        icon: 'none',
      });
    }
  },

  handleCapture() {
    wx.navigateTo({ url: '/pages/capture/index' });
  },
});
