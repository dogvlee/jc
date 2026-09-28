const BRAND_RED = '#E02D26';
const CONTENT_ERRORS = ['SCAN_EMPTY', 'SCAN_TOO_LONG', 'SCAN_KIND_MISMATCH', 'BARCODE_TOO_LONG', 'BARCODE_UNSUPPORTED_TEXT'];

function cameraDenied(client) {
  try {
    const setting = typeof client.getAppAuthorizeSetting === 'function' ? client.getAppAuthorizeSetting() : null;
    return Boolean(setting && setting.cameraAuthorized === 'denied');
  } catch (error) {
    return false;
  }
}

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
        const denied = !cancelled && cameraDenied(client);
        const error = new Error(cancelled
          ? '已取消扫码'
          : denied
            ? '微信没有相机权限，无法扫码。请在系统设置中允许微信使用相机后重试。'
            : '扫码失败，请检查相机权限后重试');
        error.code = cancelled ? 'SCAN_CANCELLED' : denied ? 'SCAN_PERMISSION_DENIED' : 'SCAN_FAILED';
        error.cause = failure;
        reject(error);
      }
    });
  });
}

/** Modal copy and follow-up action for a failed scan (cancellation is never shown). */
function scanFailurePrompt(error, api, title) {
  const code = error && error.code;
  const content = error && error.message ? error.message : '扫码失败，请稍后重试';
  if (code === 'SCAN_PERMISSION_DENIED' && api && typeof api.openAppAuthorizeSetting === 'function') {
    return { title: '需要相机权限', content, action: 'settings', showCancel: true, confirmText: '去设置', cancelText: '取消' };
  }
  if (code === 'SCAN_FAILED' || code === 'SCAN_PERMISSION_DENIED') {
    return { title, content, action: 'retry', showCancel: true, confirmText: '重新扫码', cancelText: '返回' };
  }
  if (CONTENT_ERRORS.includes(code)) {
    return { title, content, action: 'retry', showCancel: true, confirmText: '重新扫码', cancelText: '取消' };
  }
  return { title, content, action: 'none', showCancel: false, confirmText: '知道了', cancelText: '取消' };
}

function showScanFailure(api, error, options) {
  const config = options || {};
  const prompt = scanFailurePrompt(error, api, config.title || '无法扫码');
  api.showModal({
    title: prompt.title,
    content: prompt.content,
    showCancel: prompt.showCancel,
    confirmText: prompt.confirmText,
    cancelText: prompt.cancelText,
    confirmColor: BRAND_RED,
    success: (result) => {
      if (!result || !result.confirm) return;
      if (prompt.action === 'retry' && typeof config.retry === 'function') config.retry();
      if (prompt.action === 'settings') api.openAppAuthorizeSetting({});
    }
  });
}

module.exports = { scanCode, scanFailurePrompt, showScanFailure };
