const { initializeState } = require('./utils/store');
const { initNetworkMonitor } = require('./utils/network');
const env = require('./config/env');

App({
  globalData: {
    appName: '电子衣橱',
    apiMode: env.useMockApi ? 'mock' : 'real',
  },

  onLaunch() {
    initNetworkMonitor();
    initializeState();
  },
});
