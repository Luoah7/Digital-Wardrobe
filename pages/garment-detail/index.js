const { getState, markGarmentWorn, updateGarment, deleteGarment } = require('../../utils/store');
const { UI_ICONS, decorateGarment } = require('../../utils/presenter');

const TYPE_ORDER = ['外套', '上装', '下装', '连衣裙', '鞋子', '包'];
const COLOR_ORDER = ['浅燕麦', '雾蓝', '奶油白', '炭灰', '墨黑', '雾粉'];

Page({
  data: {
    icons: UI_ICONS,
    loading: false,
    error: '',
    garment: null,
    relatedOutfits: [],
    editing: false,
    editDraft: null,
  },

  onLoad(options) {
    this.garmentId = options.id;
  },

  onShow() {
    this.refreshPage();
  },

  async refreshPage() {
    this.setData({ loading: true, error: '' });
    try {
      const state = await getState(true);
      const garment = state.garments.find((item) => item.id === this.garmentId) || null;
      const relatedOutfits = state.outfits.filter((outfit) => outfit.garmentIds.indexOf(this.garmentId) >= 0);
      this.setData({
        garment: garment ? decorateGarment(garment) : null,
        relatedOutfits,
        editing: false,
        editDraft: null,
      });
    } catch (e) {
      this.setData({ error: '单品详情加载失败' });
      wx.showToast({ title: '单品详情加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  startEdit() {
    const g = this.data.garment;
    if (!g) return;
    this.setData({
      editing: true,
      editDraft: {
        name: g.name,
        type: g.type,
        color: g.color,
        warmthLevel: g.warmthLevel,
      },
    });
  },

  cancelEdit() {
    this.setData({ editing: false, editDraft: null });
  },

  onEditNameInput(e) {
    this.setData({ 'editDraft.name': e.detail.value });
  },

  cycleEditType() {
    const draft = this.data.editDraft;
    if (!draft) return;
    const idx = TYPE_ORDER.indexOf(draft.type);
    this.setData({ 'editDraft.type': TYPE_ORDER[(idx + 1) % TYPE_ORDER.length] });
  },

  cycleEditColor() {
    const draft = this.data.editDraft;
    if (!draft) return;
    const idx = COLOR_ORDER.indexOf(draft.color);
    this.setData({ 'editDraft.color': COLOR_ORDER[(idx + 1) % COLOR_ORDER.length] });
  },

  increaseEditWarmth() {
    const draft = this.data.editDraft;
    if (!draft) return;
    this.setData({ 'editDraft.warmthLevel': draft.warmthLevel >= 4 ? 1 : draft.warmthLevel + 1 });
  },

  async saveEdit() {
    const draft = this.data.editDraft;
    if (!draft || !draft.name.trim()) {
      wx.showToast({ title: '名称不能为空', icon: 'none' });
      return;
    }
    try {
      await updateGarment(this.garmentId, {
        name: draft.name,
        type: draft.type,
        color: draft.color,
        warmthLevel: draft.warmthLevel,
      });
      wx.showToast({ title: '已更新', icon: 'success' });
      this.refreshPage();
    } catch (error) {
      wx.showToast({ title: error.message || '更新失败', icon: 'none' });
    }
  },

  confirmDelete() {
    wx.showModal({
      title: '确认删除',
      content: `确定要把「${this.data.garment.name}」从衣橱中移除吗？关联的搭配也会被清理。`,
      confirmColor: '#e74c3c',
      success: (res) => {
        if (res.confirm) {
          this.doDelete();
        }
      },
    });
  },

  async doDelete() {
    try {
      await deleteGarment(this.garmentId);
      wx.showToast({ title: '已删除', icon: 'success' });
      wx.reLaunch({ url: '/pages/closet/index' });
    } catch (error) {
      wx.showToast({ title: error.message || '删除失败', icon: 'none' });
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
    wx.reLaunch({ url: '/pages/studio/index' });
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }
    wx.reLaunch({ url: '/pages/closet/index' });
  },
});
