const { getActiveRecommendation, getGarmentMap, getState, saveOutfitBoard } = require('../../utils/store');
const { UI_ICONS, decorateGarment, decorateGarments } = require('../../utils/presenter');

const SLOT_DEFS = [
  { id: 'outer', label: '外套', types: ['外套'] },
  { id: 'upper', label: '上装 / 连衣裙', types: ['上装', '连衣裙'] },
  { id: 'bottom', label: '下装', types: ['下装'] },
  { id: 'shoes', label: '鞋子', types: ['鞋子'] },
  { id: 'bag', label: '包', types: ['包'] },
];

function buildDefaultOutfit(state) {
  const recommendation = getActiveRecommendation(state);
  const garmentMap = getGarmentMap(state.garments);
  if (recommendation) {
    return {
      outer: recommendation.garmentIds.find((id) => garmentMap[id] && garmentMap[id].type === '外套') || null,
      upper: recommendation.garmentIds.find((id) => garmentMap[id] && ['上装', '连衣裙'].indexOf(garmentMap[id].type) >= 0) || null,
      bottom: recommendation.garmentIds.find((id) => garmentMap[id] && garmentMap[id].type === '下装') || null,
      shoes: recommendation.garmentIds.find((id) => garmentMap[id] && garmentMap[id].type === '鞋子') || null,
      bag: recommendation.garmentIds.find((id) => garmentMap[id] && garmentMap[id].type === '包') || null,
    };
  }

  return {
    outer: null,
    upper: null,
    bottom: null,
    shoes: null,
    bag: null,
  };
}

Page({
  data: {
    icons: UI_ICONS,
    statusMessage: '',
    slotCards: [],
    selectedPieces: [],
    pickerSlot: '',
    candidateGarments: [],
    savedOutfitCount: 0,
  },

  onShow() {
    this.refreshPage();
  },

  async refreshPage() {
    try {
      const state = await getState(true);
      if (!this.currentOutfit) {
        this.currentOutfit = buildDefaultOutfit(state);
      }
      this.localStatusMessage = '';
      this.syncPage(state);
    } catch (error) {
      wx.showToast({
        title: '搭配台加载失败',
        icon: 'none',
      });
    }
  },

  syncPage(state) {
    const snapshot = state;
    if (!snapshot) {
      return;
    }
    const garmentMap = getGarmentMap(snapshot.garments);
    const currentUpper = this.currentOutfit.upper ? garmentMap[this.currentOutfit.upper] : null;
    const dressMode = currentUpper && currentUpper.type === '连衣裙';

    this.setData({
      statusMessage: this.localStatusMessage || snapshot.statusMessage,
      savedOutfitCount: snapshot.savedOutfitCount,
      slotCards: SLOT_DEFS.map((slot) => {
        const garment = this.currentOutfit[slot.id] ? decorateGarment(garmentMap[this.currentOutfit[slot.id]]) : null;
        const hidden = slot.id === 'bottom' && dressMode;
        return {
          id: slot.id,
          label: slot.label,
          hidden,
          garment,
          name: garment ? garment.name : '点击选择',
          note: garment ? `${garment.color} · ${garment.subType}` : '从衣橱中挑选',
        };
      }),
      selectedPieces: Object.keys(this.currentOutfit)
        .map((slotId) => decorateGarment(garmentMap[this.currentOutfit[slotId]]))
        .filter(Boolean),
      candidateGarments: decorateGarments(this.buildCandidates(snapshot.garments, garmentMap, this.data.pickerSlot || 'outer')),
    });
  },

  buildCandidates(garments, garmentMap, slotId) {
    const slot = SLOT_DEFS.find((item) => item.id === slotId);
    if (!slot) {
      return [];
    }
    const currentUpper = this.currentOutfit.upper ? garmentMap[this.currentOutfit.upper] : null;
    const dressMode = currentUpper && currentUpper.type === '连衣裙';
    if (slotId === 'bottom' && dressMode) {
      return [];
    }
    return garments.filter((garment) => slot.types.indexOf(garment.type) >= 0);
  },

  async chooseSlot(event) {
    try {
      const state = await getState();
      const slotId = event.currentTarget.dataset.slot;
      this.setData({
        pickerSlot: slotId,
        candidateGarments: decorateGarments(this.buildCandidates(state.garments, getGarmentMap(state.garments), slotId)),
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '无法加载可选单品',
        icon: 'none',
      });
    }
  },

  async pickGarment(event) {
    try {
      const state = await getState();
      const garmentMap = getGarmentMap(state.garments);
      const slotId = this.data.pickerSlot;
      const garmentId = event.currentTarget.dataset.id;
      const nextOutfit = { ...this.currentOutfit, [slotId]: garmentId };
      const chosenGarment = garmentMap[garmentId];

      if (slotId === 'upper' && chosenGarment && chosenGarment.type === '连衣裙') {
        nextOutfit.bottom = null;
      }
      if (slotId === 'upper' && chosenGarment && chosenGarment.type !== '连衣裙' && !nextOutfit.bottom) {
        const fallbackBottom = state.garments.find((garment) => garment.type === '下装');
        nextOutfit.bottom = fallbackBottom ? fallbackBottom.id : null;
      }

      this.currentOutfit = nextOutfit;
      this.localStatusMessage = `已把「${chosenGarment.name}」加入当前搭配。`;
      this.setData({
        pickerSlot: slotId,
      });
      this.syncPage(state);
    } catch (error) {
      wx.showToast({
        title: error.message || '替换单品失败',
        icon: 'none',
      });
    }
  },

  async saveOutfit() {
    try {
      const state = await saveOutfitBoard(this.currentOutfit);
      this.localStatusMessage = '';
      wx.showToast({ title: '已保存搭配', icon: 'success' });
      this.syncPage(state);
    } catch (error) {
      wx.showToast({
        title: error.message || '保存搭配失败',
        icon: 'none',
      });
    }
  },

  handleCapture() {
    wx.navigateTo({ url: '/pages/capture/index' });
  },
});
