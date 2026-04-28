const env = require('../config/env');

function buildUrl(path) {
  if (!path) {
    return env.apiBaseUrl;
  }

  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${env.apiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function normalizeResponseBody(body) {
  if (body === null || typeof body === 'undefined') {
    return null;
  }

  if (typeof body !== 'object') {
    return body;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'success')) {
    if (!body.success) {
      throw new Error(body.message || '接口返回失败');
    }
    if (Object.prototype.hasOwnProperty.call(body, 'data')) {
      return body.data;
    }
    return body;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'code')) {
    if (body.code !== 0 && body.code !== 200) {
      throw new Error(body.message || '接口返回失败');
    }
    if (Object.prototype.hasOwnProperty.call(body, 'data')) {
      return body.data;
    }
    return body;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'data') && Object.keys(body).length <= 3) {
    return body.data;
  }

  return body;
}

function request(options) {
  const {
    path,
    method = 'GET',
    data,
    header = {},
    timeout = env.requestTimeout,
  } = options || {};

  return new Promise((resolve, reject) => {
    wx.request({
      url: buildUrl(path),
      method,
      data,
      timeout,
      header: {
        'content-type': 'application/json',
        ...header,
      },
      success(response) {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`请求失败：HTTP ${response.statusCode}`));
          return;
        }

        try {
          resolve(normalizeResponseBody(response.data));
        } catch (error) {
          reject(error);
        }
      },
      fail(error) {
        reject(new Error(error.errMsg || '网络请求失败'));
      },
    });
  });
}

module.exports = {
  request,
};
