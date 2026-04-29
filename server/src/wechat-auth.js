const fs = require('node:fs');
const path = require('node:path');

function readAppIdFromConfig(filename) {
  try {
    const configPath = path.join(__dirname, '..', '..', filename);
    const content = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(content);
    return config.appid || '';
  } catch (error) {
    return '';
  }
}

function readAppIdFromLocalConfig() {
  return readAppIdFromConfig('project.private.config.json') || readAppIdFromConfig('project.config.json');
}

function loadLocalEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  });
}

function createWechatAuthClient(options = {}) {
  loadLocalEnvFile();

  const appId = options.wechatAppId || process.env.WECHAT_MINI_APP_ID || readAppIdFromLocalConfig();
  const appSecret = options.wechatAppSecret || process.env.WECHAT_MINI_APP_SECRET || process.env.WECHAT_APP_SECRET || '';

  return {
    async code2Session(code) {
      if (!appId) {
        throw new Error('未配置微信小程序 AppID');
      }

      if (!appSecret) {
        throw new Error('未配置微信小程序 AppSecret');
      }

      const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
      url.searchParams.set('appid', appId);
      url.searchParams.set('secret', appSecret);
      url.searchParams.set('js_code', code);
      url.searchParams.set('grant_type', 'authorization_code');

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`微信登录失败：HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.errcode) {
        throw new Error(`微信登录失败：${data.errmsg || data.errcode}`);
      }

      if (!data.openid || !data.session_key) {
        throw new Error('微信登录失败：未返回 openid 或 session_key');
      }

      return {
        openid: data.openid,
        sessionKey: data.session_key,
        unionid: data.unionid || null,
      };
    },
  };
}

module.exports = {
  createWechatAuthClient,
};
