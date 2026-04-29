const http = require('node:http');

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const cache = new Map();

const CITY_LOCATION_MAP = {
  '上海': '101020100',
  '北京': '101010100',
  '广州': '101280101',
  '深圳': '101280601',
  '杭州': '101210101',
  '成都': '101270101',
  '武汉': '101200101',
  '南京': '101190101',
  '苏州': '101190401',
  '西安': '101110101',
};

function getApiKey() {
  return process.env.WEATHER_API_KEY || '';
}

function getFallbackWeather(city) {
  const now = new Date();
  const hour = now.getHours();
  const month = now.getMonth() + 1;

  let tempLow, tempHigh, condition;
  if (month >= 6 && month <= 9) {
    tempLow = 24; tempHigh = 33; condition = '晴';
  } else if (month >= 11 || month <= 2) {
    tempLow = 2; tempHigh = 10; condition = '多云';
  } else {
    tempLow = 14; tempHigh = 22; condition = '多云';
  }

  return {
    city: city || '上海',
    tempLow,
    tempHigh,
    tempCurrent: Math.round((tempLow + tempHigh) / 2),
    condition,
    updatedAt: now.toISOString(),
    fallback: true,
  };
}

function fetchWeatherFromApi(city) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return Promise.resolve(getFallbackWeather(city));
  }

  const locationId = CITY_LOCATION_MAP[city] || CITY_LOCATION_MAP['上海'];

  return new Promise((resolve) => {
    const url = `http://devapi.qweather.com/v7/weather/now?location=${locationId}&key=${apiKey}`;

    http.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const body = JSON.parse(data);
          if (body.code === '200' && body.now) {
            const now = body.now;
            resolve({
              city: city || '上海',
              tempLow: Number(now.temp) - 3,
              tempHigh: Number(now.temp) + 3,
              tempCurrent: Number(now.temp),
              condition: now.text || '晴',
              updatedAt: new Date().toISOString(),
              fallback: false,
            });
            return;
          }
        } catch (_) {
          // fall through
        }
        resolve(getFallbackWeather(city));
      });
      res.on('error', () => resolve(getFallbackWeather(city)));
    }).on('error', () => resolve(getFallbackWeather(city)));
  });
}

async function getWeather(city) {
  const cacheKey = city || '上海';
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const weather = await fetchWeatherFromApi(cacheKey);
  cache.set(cacheKey, { data: weather, timestamp: Date.now() });
  return weather;
}

function clearCache() {
  cache.clear();
}

module.exports = {
  getWeather,
  clearCache,
  getFallbackWeather,
  CITY_LOCATION_MAP,
};
