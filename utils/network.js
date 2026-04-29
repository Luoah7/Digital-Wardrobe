let isOnline = true;
let listeners = [];

function initNetworkMonitor() {
  wx.getNetworkType({
    success(res) {
      isOnline = res.networkType !== 'none';
    },
  });

  wx.onNetworkStatusChange((res) => {
    const wasOnline = isOnline;
    isOnline = res.isConnected;

    if (!wasOnline && isOnline) {
      wx.showToast({ title: '网络已恢复', icon: 'success' });
    } else if (wasOnline && !isOnline) {
      wx.showToast({ title: '网络已断开', icon: 'none' });
    }

    listeners.forEach((fn) => fn(isOnline));
  });
}

function onNetworkChange(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

function getIsOnline() {
  return isOnline;
}

module.exports = {
  initNetworkMonitor,
  onNetworkChange,
  getIsOnline,
};
