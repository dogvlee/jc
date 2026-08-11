function scanCode(api, options) {
  const client = api || (typeof wx !== 'undefined' ? wx : null);
  if (!client || typeof client.scanCode !== 'function') {
    const error = new Error('当前微信环境不支持扫码，请升级微信后重试');
    error.code = 'SCAN_UNAVAILABLE';
    return Promise.reject(error);
  }
  const config = options || {};
  return new Promise((resolve, reject) => {
    client.scanCode({
      onlyFromCamera: Boolean(config.onlyFromCamera),
      scanType: Array.isArray(config.scanType) && config.scanType.length
        ? config.scanType
        : ['barCode', 'qrCode'],
      success: resolve,
      fail: (failure) => {
        const cancelled = /cancel/i.test(String(failure && failure.errMsg || ''));
        const error = new Error(cancelled ? '已取消扫码' : '扫码失败，请检查相机权限后重试');
        error.code = cancelled ? 'SCAN_CANCELLED' : 'SCAN_FAILED';
        error.cause = failure;
        reject(error);
      }
    });
  });
}

module.exports = { scanCode };
