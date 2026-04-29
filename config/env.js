const ENV_CONFIG = {
  dev: {
    envName: 'dev',
    useMockApi: false,
    apiBaseUrl: 'http://127.0.0.1:3000',
    requestTimeout: 10000,
  },
  staging: {
    envName: 'staging',
    useMockApi: false,
    apiBaseUrl: 'https://staging-api.example.com',
    requestTimeout: 10000,
  },
  production: {
    envName: 'production',
    useMockApi: false,
    apiBaseUrl: 'https://api.example.com',
    requestTimeout: 8000,
  },
};

const currentEnv = typeof __wxConfig !== 'undefined' && __wxConfig.envVersion
  ? (__wxConfig.envVersion === 'develop' ? 'dev' : __wxConfig.envVersion)
  : 'dev';

module.exports = ENV_CONFIG[currentEnv] || ENV_CONFIG.dev;
