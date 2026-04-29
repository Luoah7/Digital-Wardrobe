const TYPE_SLOT_MAP = {
  '外套': 'outer',
  '上装': 'upper',
  '下装': 'bottom',
  '连衣裙': 'upper',
  '鞋子': 'shoes',
  '包': 'bag',
};

const WARMTH_FOR_TEMP = [
  { maxTemp: 5, warmth: 4 },
  { maxTemp: 15, warmth: 3 },
  { maxTemp: 25, warmth: 2 },
  { maxTemp: 100, warmth: 1 },
];

function getTargetWarmth(tempCurrent) {
  for (const rule of WARMTH_FOR_TEMP) {
    if (tempCurrent <= rule.maxTemp) return rule.warmth;
  }
  return 2;
}

function warmthScore(garment, targetWarmth) {
  const diff = Math.abs(garment.warmthLevel - targetWarmth);
  if (diff === 0) return 3;
  if (diff === 1) return 1;
  return 0;
}

function recencyScore(garment) {
  if (!garment.lastWornAt || garment.lastWornAt === '刚刚入橱' || garment.lastWornAt === '待入橱') {
    return 2;
  }
  if (garment.lastWornAt === '今天') return 0;

  const days = parseInt(garment.lastWornAt, 10);
  if (isNaN(days)) return 2;
  if (days <= 3) return 0;
  if (days <= 7) return 1;
  return 2;
}

function colorScore(garment, selectedSoFar) {
  if (selectedSoFar.length === 0) return 2;
  const colors = selectedSoFar.map((g) => g.color);
  if (colors.includes(garment.color)) return 0;
  return 2;
}

function totalScore(garment, targetWarmth, selectedSoFar) {
  return (
    warmthScore(garment, targetWarmth) * 3 +
    recencyScore(garment) * 2 +
    colorScore(garment, selectedSoFar) * 1
  );
}

function pickBest(candidates, targetWarmth, selectedSoFar) {
  if (!candidates.length) return null;
  let best = candidates[0];
  let bestScore = totalScore(best, targetWarmth, selectedSoFar);
  for (let i = 1; i < candidates.length; i++) {
    const s = totalScore(candidates[i], targetWarmth, selectedSoFar);
    if (s > bestScore) {
      best = candidates[i];
      bestScore = s;
    }
  }
  return best;
}

function buildReason(weather, pieces) {
  const targetWarmth = getTargetWarmth(weather.tempCurrent);
  const warmthNames = { 1: '薄款', 2: '适中', 3: '偏厚', 4: '厚款' };
  const details = [];

  details.push(`今日气温 ${weather.tempCurrent}°C，适合${warmthNames[targetWarmth]}搭配`);

  const recentlyWorn = pieces.filter((p) => p.lastWornAt === '今天' || parseInt(p.lastWornAt, 10) <= 3);
  if (recentlyWorn.length === 0) {
    details.push('所有单品近期未重复穿着');
  }

  const colors = [...new Set(pieces.map((p) => p.color))];
  if (colors.length > 1) {
    details.push(`颜色搭配：${colors.join(' + ')}`);
  }

  return {
    reason: `根据当前天气（${weather.condition} ${weather.tempCurrent}°C）和穿着记录推荐`,
    reasonDetails: details,
    weatherFit: `适合 ${weather.tempLow}-${weather.tempHigh}°C ${weather.condition}天气`,
  };
}

function generate(garments, outfits, weather) {
  if (!garments || garments.length === 0) {
    return {
      recommended: null,
      alternatives: [],
      reason: '衣橱中还没有衣物，请先入橱',
      reasonDetails: ['添加几件衣物后，系统会根据天气智能推荐搭配'],
      weatherFit: '',
    };
  }

  const targetWarmth = getTargetWarmth(weather.tempCurrent);
  const selected = [];
  const used = new Set();

  const slots = ['outer', 'upper', 'bottom', 'shoes', 'bag'];
  for (const slot of slots) {
    const candidates = garments.filter((g) => {
      if (used.has(g.id)) return false;
      const mappedSlot = TYPE_SLOT_MAP[g.type];
      if (slot === 'upper' && (mappedSlot === 'upper')) return true;
      return mappedSlot === slot;
    });

    if (slot === 'upper') {
      const dress = candidates.find((g) => g.type === '连衣裙');
      if (dress) {
        selected.push(dress);
        used.add(dress.id);
        const idx = slots.indexOf('bottom');
        if (idx >= 0) slots.splice(idx, 1);
        continue;
      }
    }

    const best = pickBest(candidates, targetWarmth, selected);
    if (best) {
      selected.push(best);
      used.add(best.id);
    }
  }

  if (selected.length === 0) {
    return {
      recommended: null,
      alternatives: [],
      reason: '无法生成推荐',
      reasonDetails: ['当前衣物信息不完整，请检查季节和类型标注'],
      weatherFit: '',
    };
  }

  const { reason, reasonDetails, weatherFit } = buildReason(weather, selected);

  const recommended = {
    id: 'auto-recommended',
    name: '今日推荐搭配',
    label: selected.map((g) => g.type).join(' + '),
    garmentIds: selected.map((g) => g.id),
    reason,
    reasonDetails,
    weatherFit,
  };

  const alternatives = [];
  for (let i = 0; i < 2; i++) {
    const altSelected = [];
    const altUsed = new Set();
    const altSlots = ['outer', 'upper', 'bottom', 'shoes', 'bag'];
    for (const slot of altSlots) {
      const candidates = garments.filter((g) => {
        if (altUsed.has(g.id) || used.has(g.id)) return false;
        const mappedSlot = TYPE_SLOT_MAP[g.type];
        if (slot === 'upper' && mappedSlot === 'upper') return true;
        return mappedSlot === slot;
      });
      const best = pickBest(candidates, targetWarmth, altSelected);
      if (best) {
        altSelected.push(best);
        altUsed.add(best.id);
      }
    }
    if (altSelected.length > 0) {
      const altReason = buildReason(weather, altSelected);
      alternatives.push({
        id: `auto-alt-${i + 1}`,
        name: `备选搭配 ${i + 1}`,
        label: altSelected.map((g) => g.type).join(' + '),
        garmentIds: altSelected.map((g) => g.id),
        ...altReason,
      });
      altSelected.forEach((g) => used.add(g.id));
    }
  }

  return { recommended, alternatives };
}

module.exports = {
  generate,
  getTargetWarmth,
  TYPE_SLOT_MAP,
  WARMTH_FOR_TEMP,
};
