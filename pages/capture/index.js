const env = require('../../config/env');
const {
  createCapturedGarment,
  getRemainingSlots,
  getState,
  isGarmentLimitReached,
} = require('../../utils/store');
const { getToken } = require('../../utils/session');
const { UI_ICONS, decorateGarment } = require('../../utils/presenter');

const TYPE_OPTIONS = [
  { value: '外套', label: '外套' },
  { value: '上装', label: '上装' },
  { value: '下装', label: '下装' },
  { value: '连衣裙', label: '连衣裙' },
  { value: '鞋子', label: '鞋子' },
  { value: '包', label: '包' },
];

const COLOR_OPTIONS = [
  { value: '浅燕麦', hex: '#ccb79f' },
  { value: '雾蓝', hex: '#9db4cf' },
  { value: '奶油白', hex: '#efe3cf' },
  { value: '炭灰', hex: '#7f7d86' },
  { value: '墨黑', hex: '#3b3a41' },
  { value: '雾粉', hex: '#d7afb8' },
  { value: '奶白', hex: '#ddd1c4' },
  { value: '黑色', hex: '#29272f' },
  { value: '燕麦', hex: '#cab69d' },
];

const SEASON_OPTIONS = ['春', '夏', '秋', '冬'];

const DEFAULT_DRAFT = {
  name: '新入橱单品',
  type: '上装',
  subType: '',
  color: '浅燕麦',
  season: ['春', '秋'],
  warmthLevel: 2,
  texture: '',
  scene: '通勤',
  accent: '#ccb79f',
};

function withSeasonText(draft) {
  return decorateGarment({
    ...draft,
    seasonText: draft.season.join(' / '),
    lastWornAt: '待入橱',
  });
}

function buildSeasonOptions(draft) {
  if (!draft) return SEASON_OPTIONS.map((s) => ({ value: s, active: false }));
  return SEASON_OPTIONS.map((s) => ({ value: s, active: draft.season.indexOf(s) >= 0 }));
}

Page({
  setDraft(draft) {
    this.setData({ draft, seasonOptions: buildSeasonOptions(draft) });
  },

  data: {
    icons: UI_ICONS,
    statusMessage: '',
    step: 'capture',
    source: '',
    draft: null,
    remainingSlots: 0,
    limitReached: false,
    uploading: false,
    typeOptions: TYPE_OPTIONS,
    colorOptions: COLOR_OPTIONS,
    seasonOptions: SEASON_OPTIONS.map((s) => ({ value: s, active: false })),
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

      const sourceType = source === 'camera' ? ['camera'] : ['album'];

      wx.chooseImage({
        count: 1,
        sourceType,
        success: (res) => {
          const tempFilePath = res.tempFilePaths[0];
          if (!tempFilePath) {
            wx.showToast({ title: '未获取到图片', icon: 'none' });
            return;
          }
          // Always compress to ensure under 2MB
          this.compressAndHandle(tempFilePath, source);
        },
        fail: (err) => {
          if (err.errMsg && err.errMsg.indexOf('cancel') !== -1) {
            return;
          }
          if (err.errMsg && err.errMsg.indexOf('80051') !== -1) {
            wx.showModal({
              title: '图片太大',
              content: '微信要求图片不超过 2MB。请在相册中选择一张较小的图片，或用其他 App 压缩后再试。',
              showCancel: false,
            });
            return;
          }
          wx.showToast({ title: '图片选取失败', icon: 'none' });
        },
      });
    } catch (error) {
      wx.showToast({
        title: error.message || '无法进入入橱流程',
        icon: 'none',
      });
    }
  },

  async handleImageSelected(tempFilePath, source) {
    const draft = withSeasonText({ ...DEFAULT_DRAFT, imageUrl: tempFilePath });
    this.setData({
      source,
      uploading: true,
      statusMessage: '正在上传图片...',
      draft,
      seasonOptions: buildSeasonOptions(draft),
    });

    try {
      const imageUrl = await this.uploadImage(tempFilePath);
      const savedDraft = withSeasonText({ ...DEFAULT_DRAFT, imageUrl });
      this.setData({
        uploading: false,
        step: 'confirm',
        draft: savedDraft,
        seasonOptions: buildSeasonOptions(savedDraft),
        statusMessage: '上传完成，请选择衣物类型和信息后保存。',
      });
    } catch (error) {
      this.setData({
        uploading: false,
        step: 'confirm',
        statusMessage: '图片上传失败，将保存本地图片。请确认衣物信息。',
      });
    }
  },

  compressAndHandle(tempFilePath, source) {
    wx.showLoading({ title: '压缩图片中...' });
    this.doCompress(tempFilePath, 80, (compressedPath) => {
      wx.hideLoading();
      wx.getFileInfo({
        filePath: compressedPath,
        success: (info) => {
          const sizeMB = info.size / 1024 / 1024;
          if (sizeMB > 2) {
            wx.showModal({
              title: '图片仍然太大',
              content: `压缩后仍有 ${sizeMB.toFixed(1)}MB，超过 2MB 限制。建议用手机相机重新拍照（降低分辨率），或用其他 App 手动压缩后再试。`,
              showCancel: false,
            });
            return;
          }
          this.handleImageSelected(compressedPath, source);
        },
        fail: () => this.handleImageSelected(compressedPath, source),
      });
    });
  },

  doCompress(src, quality, callback) {
    wx.compressImage({
      src,
      quality,
      success: (res) => {
        wx.getFileInfo({
          filePath: res.tempFilePath,
          success: (info) => {
            const sizeKB = info.size / 1024;
            if (sizeKB > 1900 && quality > 10) {
              this.doCompress(res.tempFilePath, Math.max(10, quality - 20), callback);
            } else {
              callback(res.tempFilePath);
            }
          },
          fail: () => callback(res.tempFilePath),
        });
      },
      fail: () => callback(src),
    });
  },

  uploadImage(tempFilePath) {
    if (env.useMockApi) {
      return Promise.resolve(tempFilePath);
    }

    return new Promise((resolve, reject) => {
      const token = getToken();
      wx.uploadFile({
        url: `${env.apiBaseUrl}/v1/upload/garment-image`,
        filePath: tempFilePath,
        name: 'file',
        header: {
          Authorization: token ? `Bearer ${token}` : '',
        },
        success: (res) => {
          if (res.statusCode === 413) {
            reject(new Error('图片超过 2MB 限制，请压缩后再试'));
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error('上传请求失败'));
            return;
          }
          try {
            const body = JSON.parse(res.data);
            if (body.code === 0 && body.data && body.data.imageUrl) {
              resolve(body.data.imageUrl);
            } else {
              reject(new Error(body.message || '上传失败'));
            }
          } catch (e) {
            reject(new Error('上传响应解析失败'));
          }
        },
        fail: () => {
          reject(new Error('网络请求失败'));
        },
      });
    });
  },

  selectType(e) {
    const type = e.currentTarget.dataset.value;
    const draft = this.data.draft;
    if (!draft) return;
    this.setDraft(withSeasonText({ ...draft, type }));
  },

  selectColor(e) {
    const color = e.currentTarget.dataset.value;
    const hex = e.currentTarget.dataset.hex;
    const draft = this.data.draft;
    if (!draft) return;
    this.setDraft(withSeasonText({ ...draft, color, accent: hex }));
  },

  toggleSeason(e) {
    const season = e.currentTarget.dataset.value;
    const draft = this.data.draft;
    if (!draft) return;
    const seasons = draft.season.includes(season)
      ? draft.season.filter((s) => s !== season)
      : [...draft.season, season];
    if (seasons.length === 0) return;
    this.setDraft(withSeasonText({ ...draft, season: seasons }));
  },

  increaseWarmth() {
    const draft = this.data.draft;
    if (!draft) return;
    this.setDraft(withSeasonText({
      ...draft,
      warmthLevel: draft.warmthLevel >= 4 ? 1 : draft.warmthLevel + 1,
    }));
  },

  onNameInput(e) {
    const draft = this.data.draft;
    if (!draft) return;
    this.setDraft(withSeasonText({ ...draft, name: e.detail.value }));
  },

  async saveCapture() {
    if (!this.data.draft) return;
    const state = await getState(true);
    if (isGarmentLimitReached(state)) {
      this.setData({ limitReached: true });
      return;
    }

    try {
      const d = this.data.draft;
      await createCapturedGarment({
        name: d.name,
        type: d.type,
        subType: d.subType,
        color: d.color,
        season: d.season,
        warmthLevel: d.warmthLevel,
        texture: d.texture,
        scene: d.scene,
        accent: d.accent,
        imageUrl: d.imageUrl,
      });
      wx.showToast({ title: '保存成功', icon: 'success' });
      wx.reLaunch({ url: '/pages/closet/index' });
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
    wx.reLaunch({ url: '/pages/home/index' });
  },
});
