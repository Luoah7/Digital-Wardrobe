Component({
  properties: {
    current: {
      type: String,
      value: 'home',
    },
    captureLabel: {
      type: String,
      value: '入橱',
    },
  },

  data: {
    items: [
      { id: 'home', label: '首页', icon: '/assets/ui/home.svg', path: '/pages/home/index' },
      { id: 'closet', label: '衣橱', icon: '/assets/ui/closet.svg', path: '/pages/closet/index' },
      { id: 'studio', label: '搭配', icon: '/assets/ui/studio.svg', path: '/pages/studio/index' },
      { id: 'calendar', label: '日历', icon: '/assets/ui/calendar.svg', path: '/pages/calendar/index' },
      { id: 'profile', label: '我的', icon: '/assets/ui/profile.svg', path: '/pages/profile/index' },
    ],
  },

  methods: {
    handleNavigate(event) {
      const { path, id } = event.currentTarget.dataset;
      if (id === this.properties.current) {
        return;
      }
      wx.redirectTo({ url: path });
    },

    handleCapture() {
      this.triggerEvent('capture');
    },
  },
});
