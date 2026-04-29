const VALID_GARMENT_TYPES = ['外套', '上装', '下装', '连衣裙', '鞋子', '包'];
const VALID_SEASONS = ['春', '夏', '秋', '冬'];
const VALID_COLORS = ['浅燕麦', '雾蓝', '奶油白', '炭灰', '墨黑', '雾粉', '奶白', '黑色', '燕麦'];
const VALID_SCENES = ['通勤', '休闲', '运动', '正式', '居家'];
const MAX_BODY_BYTES = 1 * 1024 * 1024; // 1 MB

const MAX_LENGTHS = {
  name: 30,
  color: 10,
  subType: 20,
  texture: 20,
  scene: 10,
};

const XSS_PATTERN = /<\s*script[^>]*>|<\/\s*script\s*>|javascript\s*:|on\w+\s*=/gi;

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(XSS_PATTERN, '').trim();
}

function checkStringLength(value, field, maxLen) {
  if (typeof value === 'string' && value.length > maxLen) {
    return `${field}不能超过 ${maxLen} 个字符`;
  }
  return null;
}

function fail(response, statusCode, code, message) {
  const body = JSON.stringify({ code, message, data: null });
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
}

function validateGarmentFields(payload, { partial = false } = {}) {
  const errors = [];

  if (!partial || payload.name !== undefined) {
    if (!payload.name || typeof payload.name !== 'string' || !payload.name.trim()) {
      errors.push('衣物名称不能为空');
    } else {
      const lenErr = checkStringLength(payload.name, '名称', MAX_LENGTHS.name);
      if (lenErr) errors.push(lenErr);
    }
  }

  if (!partial || payload.type !== undefined) {
    if (!payload.type || !VALID_GARMENT_TYPES.includes(payload.type)) {
      errors.push(`衣物类型必须是：${VALID_GARMENT_TYPES.join('、')}`);
    }
  }

  if (!partial || payload.color !== undefined) {
    if (!payload.color || typeof payload.color !== 'string' || !payload.color.trim()) {
      errors.push('颜色不能为空');
    } else {
      const lenErr = checkStringLength(payload.color, '颜色', MAX_LENGTHS.color);
      if (lenErr) errors.push(lenErr);
    }
  }

  if (!partial || payload.subType !== undefined) {
    if (payload.subType !== undefined && payload.subType !== '') {
      const lenErr = checkStringLength(payload.subType, '子类型', MAX_LENGTHS.subType);
      if (lenErr) errors.push(lenErr);
    }
  }

  if (!partial || payload.season !== undefined) {
    if (!Array.isArray(payload.season) || payload.season.length === 0) {
      errors.push('季节至少选择一个');
    } else {
      const invalid = payload.season.filter((s) => !VALID_SEASONS.includes(s));
      if (invalid.length > 0) {
        errors.push(`无效的季节：${invalid.join('、')}`);
      }
    }
  }

  if (!partial || payload.warmthLevel !== undefined) {
    const level = payload.warmthLevel;
    if (level !== undefined && level !== null) {
      if (typeof level !== 'number' || level < 1 || level > 4 || !Number.isInteger(level)) {
        errors.push('保暖等级必须是 1-4 的整数');
      }
    }
  }

  return errors;
}

function validateGarmentLimit(state) {
  const limit = state.user && state.user.privilege && state.user.privilege.garmentLimit;
  const unlocked = state.user && state.user.privilege && state.user.privilege.unlocked;
  if (unlocked) {
    return null;
  }
  if (limit && state.garments && state.garments.length >= limit) {
    return `免费用户最多保存 ${limit} 件衣物，请删除一些后再添加`;
  }
  return null;
}

module.exports = {
  VALID_GARMENT_TYPES,
  VALID_SEASONS,
  VALID_COLORS,
  VALID_SCENES,
  MAX_BODY_BYTES,
  MAX_LENGTHS,
  fail,
  sanitizeString,
  validateGarmentFields,
  validateGarmentLimit,
};
