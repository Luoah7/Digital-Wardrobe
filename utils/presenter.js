const GARMENT_PLACEHOLDERS = {
  外套: '/assets/garments/coat.svg',
  上装: '/assets/garments/top.svg',
  下装: '/assets/garments/pants.svg',
  连衣裙: '/assets/garments/dress.svg',
  鞋子: '/assets/garments/shoes.svg',
  包: '/assets/garments/bag.svg',
};

const UI_ICONS = {
  home: '/assets/ui/home.svg',
  closet: '/assets/ui/closet.svg',
  studio: '/assets/ui/studio.svg',
  calendar: '/assets/ui/calendar.svg',
  profile: '/assets/ui/profile.svg',
  camera: '/assets/ui/camera.svg',
  album: '/assets/ui/album.svg',
  mapPin: '/assets/ui/map-pin.svg',
  clock: '/assets/ui/clock.svg',
  cloudRain: '/assets/ui/cloud-rain.svg',
  umbrella: '/assets/ui/umbrella.svg',
  wind: '/assets/ui/wind.svg',
  search: '/assets/ui/search.svg',
  filter: '/assets/ui/filter.svg',
  plus: '/assets/ui/plus.svg',
  arrowRight: '/assets/ui/arrow-right.svg',
  heart: '/assets/ui/heart.svg',
  logout: '/assets/ui/logout.svg',
};

function decorateGarment(garment) {
  if (!garment) {
    return null;
  }

  return {
    ...garment,
    placeholderImage: GARMENT_PLACEHOLDERS[garment.type] || GARMENT_PLACEHOLDERS['上装'],
    seasonText: Array.isArray(garment.season) ? garment.season.join(' / ') : '',
    detailLine: `${garment.type} · ${garment.color} · ${garment.subType}`,
    noteLine: `${garment.texture} · 最近穿着 ${garment.lastWornAt}`,
  };
}

function decorateGarments(garments) {
  return (garments || []).map(decorateGarment);
}

module.exports = {
  UI_ICONS,
  decorateGarment,
  decorateGarments,
};
