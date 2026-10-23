// Host platform helpers. wx.getDeviceInfo replaces the deprecated
// getSystemInfoSync on newer base libraries; both are read defensively because
// a failing info call must never break the page that asked.

function clientOf(api) {
  if (api) return api;
  return typeof wx !== 'undefined' ? wx : null;
}

function deviceInfo(api) {
  const client = clientOf(api);
  if (!client) return {};
  try {
    if (typeof client.getDeviceInfo === 'function') {
      const info = client.getDeviceInfo();
      if (info && info.platform) return info;
    }
  } catch (error) {
    // Fall back to the older API below.
  }
  try {
    if (typeof client.getSystemInfoSync === 'function') return client.getSystemInfoSync() || {};
  } catch (error) {
    // Unknown platform.
  }
  return {};
}

/** Lower-case platform name: 'ios', 'android', 'windows', 'mac', 'devtools', … or ''. */
function platformName(api) {
  return String(deviceInfo(api).platform || '').toLowerCase();
}

/** Desktop WeChat (Windows / Mac) cannot use Bluetooth printers. */
function isDesktopWeChat(api) {
  const name = platformName(api);
  return name === 'windows' || name === 'mac';
}

module.exports = { isDesktopWeChat, platformName };
