const {
  createCapturedGarment,
  getRemainingSlots,
  getState,
  isGarmentLimitReached,
} = require('../../utils/store');
const { UI_ICONS, decorateGarment } = require('../../utils/presenter');

const CAPTURE_DRAFTS = {
  camera: {
    name: '新拍摄的浅燕麦短外套',
    type: '外套',
    subType: '短外套',
    color: '浅燕麦',
    season: ['春', '秋'],
    warmthLevel: 2,
    texture: '软呢',
    scene: '通勤',
    accent: '#ccb79f',
  },
  album: {
    name: '相册导入的雾蓝衬衫',
    type: '上装',
    subType: '长袖衬衫',
    color: '雾蓝',
    season: ['春', '秋'],
    warmthLevel: 2,
    texture: '棉感',
    scene: '通勤',
    accent: '#9db4cf',
  },
};

const TYPE_ORDER = ['外套', '上装', '下装', '连衣裙', '鞋子', '包'];
const COLOR_ORDER = ['浅燕麦', '雾蓝', '奶油白', '炭灰', '雾粉'];

function withSeasonText(draft) {
  return decorateGarment({
    ...draft,
    seasonText: draft.season.join(' / '),
    lastWornAt: '待入橱',
  });
}

Page({
  data: {
    icons: UI_ICONS,
    statusMessage: '',
    step: 'capture',
    source: '',
    draft: null,
    remainingSlots: 0,
    limitReached: false,
  },

  onLoad(options) {
    this.refreshState();
    if (options && options.source) {
      this.chooseSourceByValue(options.source);
    }
  },

  async refreshState() {
    try {
      const state = await getState(true);
      this.setData({
        statusMessage: state.statusMessage,
        remainingSlots: getRemainingSlots(state),
        limitReached: isGarmentLimitReached(state),
      });
    } catch (error) {
      this.setData({
        statusMessage: error.message || '入橱数据加载失败',
      });
    }
  },

  chooseSource(event) {
    this.chooseSourceByValue(event.currentTarget.dataset.source);
  },

  async chooseSourceByValue(source) {
    try {
      const state = await getState(true);
      if (isGarmentLimitReached(state)) {
        this.setData({
          limitReached: true,
          statusMessage: '当前免费额度已满，请先由后台管理员开通特权。',
        });
        return;
      }

      this.setData({
        source,
        step: 'processing',
        draft: withSeasonText(CAPTURE_DRAFTS[source]),
        statusMessage: source === 'camera' ? '已拉起拍照流程，正在模拟抠图识别。' : '已读取相册图片，正在模拟抠图识别。',
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '无法进入入橱流程',
        icon: 'none',
      });
    }
  },

  completeProcessing() {
    this.setData({
      step: 'confirm',
      statusMessage: '识别完成，请确认衣物类型、颜色和厚薄度后再保存。',
    });
  },

  cycleType() {
    const draft = this.data.draft;
    if (!draft) {
      return;
    }
    const currentIndex = TYPE_ORDER.indexOf(draft.type);
    const nextType = TYPE_ORDER[(currentIndex + 1) % TYPE_ORDER.length];
    this.setData({
      draft: withSeasonText({
        ...draft,
        type: nextType,
      }),
    });
  },

  cycleColor() {
    const draft = this.data.draft;
    if (!draft) {
      return;
    }
    const currentIndex = COLOR_ORDER.indexOf(draft.color);
    const nextColor = COLOR_ORDER[(currentIndex + 1) % COLOR_ORDER.length];
    this.setData({
      draft: withSeasonText({
        ...draft,
        color: nextColor,
      }),
    });
  },

  increaseWarmth() {
    const draft = this.data.draft;
    if (!draft) {
      return;
    }
    this.setData({
      draft: withSeasonText({
        ...draft,
        warmthLevel: draft.warmthLevel >= 4 ? 1 : draft.warmthLevel + 1,
      }),
    });
  },

  async saveCapture() {
    if (!this.data.draft) {
      return;
    }
    const state = await getState(true);
    if (isGarmentLimitReached(state)) {
      this.setData({
        limitReached: true,
      });
      return;
    }

    try {
      await createCapturedGarment({
        name: this.data.draft.name,
        type: this.data.draft.type,
        subType: this.data.draft.subType,
        color: this.data.draft.color,
        season: this.data.draft.season,
        warmthLevel: this.data.draft.warmthLevel,
        texture: this.data.draft.texture,
        scene: this.data.draft.scene,
        accent: this.data.draft.accent,
      });
      wx.showToast({ title: '保存成功', icon: 'success' });
      wx.redirectTo({ url: '/pages/closet/index' });
    } catch (error) {
      wx.showToast({
        title: error.message || '保存失败',
        icon: 'none',
      });
    }
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }
    wx.redirectTo({ url: '/pages/home/index' });
  },
});
