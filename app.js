const { initializeState } = require('./utils/store');
const env = require('./config/env');

App({
  globalData: {
    appName: '电子衣橱',
    apiMode: env.useMockApi ? 'mock' : 'real',
  },

  onLaunch() {
    initializeState();
  },
});
