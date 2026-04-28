const {
  getRemainingSlots,
  getState,
  isMockMode,
  isGarmentLimitReached,
  loginUser,
  logoutUser,
  resetState,
} = require('../../utils/store');

Page({
  data: {
    icons: require('../../utils/presenter').UI_ICONS,
    statusMessage: '',
    isGuest: false,
    userName: '',
    loginLoading: false,
    weatherInline: '',
    weatherUpdatedAt: '',
    privilegeSummary: '',
    preferenceSummary: '',
    remainingText: '',
    apiModeText: '',
  },

  onShow() {
    this.refreshPage();
  },

  async refreshPage() {
    try {
      const state = await getState(true);
      const remainingSlots = getRemainingSlots(state);
      const limitReached = isGarmentLimitReached(state);

      this.setData({
        statusMessage: state.statusMessage,
        isGuest: state.user.isGuest === true,
        userName: state.user.name,
        weatherInline: `${state.user.city} ${state.weather.condition} · ${state.weather.minTemp}°-${state.weather.maxTemp}°`,
        weatherUpdatedAt: state.user.weatherUpdatedAt,
        preferenceSummary: state.user.preferenceSummary,
        apiModeText: isMockMode ? '当前为 mock 接口模式，可切到真实域名后联调。' : '当前为真实接口模式，页面数据直接来自后端接口。',
        privilegeSummary: state.user.privilege.unlocked
          ? state.user.privilege.expiresAt
            ? `已开通特权，有效期至${state.user.privilege.expiresAt}`
            : '已开通永久特权，衣橱容量无上限'
          : '当前为免费版，特权仅支持后台管理员手动开通',
        remainingText: state.user.privilege.unlocked
          ? '当前衣橱容量不受数量限制。'
          : limitReached
            ? '当前免费额度已用完，请联系管理员开通特权。'
            : `当前还可以继续添加${remainingSlots}件衣物。`,
      });
    } catch (error) {
      wx.showToast({
        title: '个人页加载失败',
        icon: 'none',
      });
    }
  },

  async handleLogin() {
    if (this.data.loginLoading) {
      return;
    }

    this.setData({ loginLoading: true });
    try {
      await loginUser();
      wx.showToast({ title: '登录成功', icon: 'success' });
      this.refreshPage();
    } catch (error) {
      wx.showToast({
        title: error.message || '登录失败',
        icon: 'none',
      });
    } finally {
      this.setData({ loginLoading: false });
    }
  },

  async handleLogout() {
    try {
      await logoutUser();
      wx.showToast({ title: '已退出登录', icon: 'success' });
      this.refreshPage();
    } catch (error) {
      wx.showToast({
        title: error.message || '退出登录失败',
        icon: 'none',
      });
    }
  },

  showPrivilegeGuide() {
    wx.showModal({
      title: '特权说明',
      content: '正式版仅支持后台管理员为指定用户开通、延长或撤销特权，小程序端不提供自助兑换入口。',
      showCancel: false,
    });
  },

  resetDemo() {
    if (!isMockMode) {
      wx.showModal({
        title: '当前为真实接口模式',
        content: '真实接口模式下不建议在小程序里直接重置数据，请改用后台或测试环境接口处理。',
        showCancel: false,
      });
      return;
    }

    wx.showModal({
      title: '重置演示数据',
      content: '这会清空当前本地操作记录，并恢复到初始演示数据。',
      success: async (result) => {
        if (!result.confirm) {
          return;
        }
        try {
          await resetState();
          wx.showToast({ title: '已重置', icon: 'success' });
          this.refreshPage();
        } catch (error) {
          wx.showToast({
            title: error.message || '重置失败',
            icon: 'none',
          });
        }
      },
    });
  },

  handleCapture() {
    wx.navigateTo({ url: '/pages/capture/index' });
  },
});
