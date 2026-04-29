const { getState } = require('../../utils/store');
const { UI_ICONS, decorateGarments } = require('../../utils/presenter');

const TYPE_FILTERS = ['全部', '上装', '下装', '外套', '连衣裙', '鞋子', '包'];
const COLOR_FILTERS = ['全部', '米白', '炭灰', '奶油白', '墨黑', '雾粉', '燕麦', '黑色'];
const SEASON_FILTERS = ['全部', '春', '夏', '秋', '四季'];

Page({
  data: {
    icons: UI_ICONS,
    loading: false,
    error: '',
    statusMessage: '',
    typeFilters: TYPE_FILTERS,
    colorFilters: COLOR_FILTERS,
    seasonFilters: SEASON_FILTERS,
    activeType: '全部',
    activeColor: '全部',
    activeSeason: '全部',
    keyword: '',
    garments: [],
    emptyText: '',
  },

  onShow() {
    this.refreshPage();
  },

  async refreshPage() {
    this.setData({ loading: true, error: '' });
    try {
      const state = await getState(true);
      this.stateSnapshot = state;
      this.applyFilters(state);
    } catch (e) {
      this.setData({
        error: '衣橱加载失败',
        garments: [],
        emptyText: '当前无法获取衣橱数据，请检查接口配置或网络状态。',
      });
      wx.showToast({ title: '衣橱加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  applyFilters(state) {
    const snapshot = state || this.stateSnapshot;
    if (!snapshot) {
      return;
    }

    const keyword = this.data.keyword.trim().toLowerCase();
    const garments = snapshot.garments.filter((garment) => {
      const matchesKeyword = !keyword
        || garment.name.toLowerCase().includes(keyword)
        || garment.color.toLowerCase().includes(keyword)
        || garment.subType.toLowerCase().includes(keyword);
      const matchesType = this.data.activeType === '全部' || garment.type === this.data.activeType;
      const matchesColor = this.data.activeColor === '全部' || garment.color === this.data.activeColor;
      const matchesSeason = this.data.activeSeason === '全部' || garment.season.indexOf(this.data.activeSeason) >= 0;
      return matchesKeyword && matchesType && matchesColor && matchesSeason;
    });

    this.setData({
      statusMessage: snapshot.statusMessage,
      garments: decorateGarments(garments),
      emptyText: garments.length ? '' : '当前筛选条件下没有可展示的单品，换个颜色或季节试试。',
    });
  },

  updateKeyword(event) {
    this.setData({ keyword: event.detail.value });
    this.applyFilters();
  },

  chooseType(event) {
    this.setData({ activeType: event.currentTarget.dataset.value });
    this.applyFilters();
  },

  chooseColor(event) {
    this.setData({ activeColor: event.currentTarget.dataset.value });
    this.applyFilters();
  },

  chooseSeason(event) {
    this.setData({ activeSeason: event.currentTarget.dataset.value });
    this.applyFilters();
  },

  openGarmentDetail(event) {
    wx.navigateTo({
      url: `/pages/garment-detail/index?id=${event.currentTarget.dataset.id}`,
    });
  },

  openAlbumCapture() {
    wx.navigateTo({ url: '/pages/capture/index?source=album' });
  },

  handleCapture() {
    wx.navigateTo({ url: '/pages/capture/index' });
  },
});
