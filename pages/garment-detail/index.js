const { getState, markGarmentWorn } = require('../../utils/store');
const { UI_ICONS, decorateGarment } = require('../../utils/presenter');

Page({
  data: {
    icons: UI_ICONS,
    garment: null,
    relatedOutfits: [],
  },

  onLoad(options) {
    this.garmentId = options.id;
  },

  onShow() {
    this.refreshPage();
  },

  async refreshPage() {
    try {
      const state = await getState(true);
      const garment = state.garments.find((item) => item.id === this.garmentId) || null;
      const relatedOutfits = state.outfits.filter((outfit) => outfit.garmentIds.indexOf(this.garmentId) >= 0);
      this.setData({
        garment: garment ? decorateGarment(garment) : null,
        relatedOutfits,
      });
    } catch (error) {
      wx.showToast({
        title: '单品详情加载失败',
        icon: 'none',
      });
    }
  },

  async markTodayWorn() {
    try {
      await markGarmentWorn(this.garmentId);
      wx.showToast({ title: '已标记', icon: 'success' });
      this.refreshPage();
    } catch (error) {
      wx.showToast({
        title: error.message || '标记失败',
        icon: 'none',
      });
    }
  },

  goStudio() {
    wx.redirectTo({ url: '/pages/studio/index' });
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }
    wx.redirectTo({ url: '/pages/closet/index' });
  },
});
