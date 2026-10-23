const { platformName } = require('./platform');

// Turns Bluetooth failures into plain Chinese for shop owners, plus the one
// thing that fixes them. Raw errMsg text never reaches a modal.

const BRAND_RED = '#E02D26';
const NOT_A_PRINTER = '这台设备不能接收打印内容，可能不是打印机。请确认打印机已开机，再在列表里点一下你的打印机。';

const ACTION_METHODS = {
  'open-bluetooth-setting': 'openSystemBluetoothSetting',
  'open-app-authorize': 'openAppAuthorizeSetting',
  'open-setting': 'openSetting'
};

// showModal buttons hold at most four characters.
const ACTION_TEXT = {
  'open-bluetooth-setting': '去打开',
  'open-app-authorize': '去设置',
  'open-setting': '去设置',
  retry: '重试',
  none: '知道了'
};

// Kinds whose own title explains the fix better than the caller's context title.
const OWN_TITLE_KINDS = ['adapter-off', 'auth-deny', 'privacy', 'system-permission', 'location-permission', 'location-off'];

const MESSAGES = {
  'auth-deny': ['需要蓝牙权限', '你之前没有允许商跃标签使用蓝牙，所以找不到打印机。请点“去设置”，打开“蓝牙”后重试。', 'open-setting'],
  privacy: ['需要同意隐私保护指引', '需要先同意隐私保护指引才能使用蓝牙。请点“重试”，在弹出的说明里选择同意。', 'retry'],
  'system-permission': ['需要蓝牙权限', '微信还没有使用蓝牙的权限。请点“去设置”，允许微信使用蓝牙后重试。', 'open-app-authorize'],
  'location-permission': ['需要打开权限', '微信没有“位置信息”或“附近的设备”权限，手机找不到打印机。请点“去设置”打开这两项权限后重试。', 'open-app-authorize'],
  'location-off': ['需要打开定位服务', '安卓手机搜索蓝牙打印机需要打开定位服务。请从屏幕顶部下拉，打开“位置信息”或“定位”，然后重试。', 'retry'],
  timeout: ['打印机没有响应', '打印机没有响应。请确认打印机已开机、在手机旁边，而且没有被其他手机连接。', 'retry'],
  'connect-failed': ['没能连上打印机', '没能连上打印机。请把打印机关机再开机，然后重试；如果还不行，请把手机蓝牙关掉再打开。', 'retry'],
  'not-printer': ['不是打印机', NOT_A_PRINTER, 'none'],
  busy: ['正在连接其他打印机', '另一台打印机正在连接，请稍等几秒再试。', 'retry'],
  printing: ['正在打印', '正在打印，请等打印完成后再连接打印机。', 'none'],
  interrupted: ['连接中断', '连接中断了。请确认手机蓝牙已打开、打印机在手机旁边，然后重试。', 'retry'],
  'no-device': ['没有找到打印机', '没有找到这台打印机。请确认打印机已开机、在手机旁边，然后重新搜索。', 'retry'],
  'link-lost': ['打印机已断开', '打印机连接断开了。请确认打印机已开机、在手机旁边，然后重试。', 'retry'],
  'no-service': ['打印机没有回应', '这台设备没有回应。请确认选的是打印机，把打印机关机再开机后重试。', 'retry'],
  'not-ready': ['蓝牙还没准备好', '手机蓝牙还没准备好，请稍后重试。', 'retry'],
  unsupported: ['手机不支持', '这台手机的系统版本太低，不能连接蓝牙打印机。', 'none'],
  reselect: ['请重新选择打印机', '请重新搜索，然后在列表里点一下你的打印机。', 'retry'],
  'no-printer': ['还没有选择打印机', '还没有选择打印机。请先在列表里点一下你的打印机。', 'none']
};

// Chinese text from our own code is shown as-is unless it carries jargon.
const JARGON = /MTU|GATT|UUID|NIIMBOT|BLE|RSSI|deviceId|errCode|errMsg|kill\s*switch|协议|特征|候选|真机|0x[0-9a-f]+|[a-z]{4,}/i;
const HAS_CHINESE = /[\u4e00-\u9fff]/;

function collect(error) {
  const found = { codes: [], states: [], text: '' };
  const texts = [];
  let current = error;
  for (let depth = 0; current && depth < 4; depth += 1) {
    if (typeof current !== 'object') {
      texts.push(String(current));
      break;
    }
    ['code', 'errCode', 'errno'].forEach((key) => {
      const value = current[key];
      if (value !== undefined && value !== null && value !== '') found.codes.push(String(value));
    });
    if (current.state !== undefined && current.state !== null) found.states.push(Number(current.state));
    ['message', 'errMsg'].forEach((key) => {
      if (current[key]) texts.push(String(current[key]));
    });
    current = current.cause;
  }
  found.text = texts.join(' | ');
  return found;
}

function readSetting(api, method) {
  if (!api || typeof api[method] !== 'function') return {};
  try {
    return api[method]() || {};
  } catch (error) {
    return {};
  }
}

function classify(found, context) {
  const text = found.text;
  const has = (value) => found.codes.indexOf(String(value)) >= 0;
  const android = context.platform === 'android';

  if (has('NO_PRINT_CHANNEL')) return 'not-printer';
  if (has('CONNECT_BUSY') || /正在连接/.test(text)) return 'busy';
  if (has('PRINT_IN_PROGRESS') || /打印任务进行中/.test(text)) return 'printing';
  if (has('CONNECT_SUPERSEDED') || has('CONNECT_CANCELLED') || has('TRANSPORT_RESET')
    || /连接已关闭|连接已取消/.test(text)) return 'interrupted';
  if (has('BLE_RECONNECT_OFF')) return 'reselect';
  if (has('DEVICE_INCOMPLETE')) return 'no-printer';
  // "privacy … not authorized" must win over the generic authorization check.
  if (has(104) || /privacy/i.test(text)) return 'privacy';
  if (/auth\s*den(?:y|ied)|scope\.bluetooth|authorize:fail|authorize\s*no\s*response/i.test(text)) return 'auth-deny';
  if (found.states.indexOf(3) >= 0 || context.authorize.bluetoothAuthorized === 'denied'
    || (context.platform === 'ios' && /unauthori[sz]ed|permission\s*denied/i.test(text))) return 'system-permission';
  if (has(10001) || has('BLUETOOTH_UNAVAILABLE') || found.states.indexOf(4) >= 0
    || context.system.bluetoothEnabled === false
    || /not\s*available|adapter\s*(?:is\s*)?(?:unavailable|off|not)|bluetooth\s*(?:is\s*)?(?:off|disabled|not\s*enabled)|蓝牙.{0,4}(?:没有打开|未开启|已关闭|不可用)/i.test(text)) {
    return 'adapter-off';
  }
  if (/location|定位|位置信息|nearby|附近的设备|BLUETOOTH_SCAN|BLUETOOTH_CONNECT/i.test(text)
    || (android && /permission/i.test(text))) {
    return android && context.system.locationEnabled === false ? 'location-off' : 'location-permission';
  }
  if (has(10012) || /time\s*out|timed\s*out|超时/i.test(text)) return 'timeout';
  if (has(10003) || /connect(?:ion)?\s*fail|status\D{0,3}133\b|\b133\b|gatt\s*error/i.test(text)) return 'connect-failed';
  if (has(10002) || /no\s*device|device\s*not\s*found/i.test(text)) return 'no-device';
  if (has(10006) || /no\s*connection|not\s*connected|已断开|请先连接打印机/i.test(text)) return 'link-lost';
  if (has(10004) || has(10005) || /no\s*service|no\s*characteristic/i.test(text)) return 'no-service';
  if (has(10000) || /not\s*init/i.test(text)) return 'not-ready';
  if (has(10009)) return 'unsupported';
  return 'unknown';
}

function adapterOffDescription(platform) {
  if (platform === 'ios') {
    return { title: '蓝牙没有打开', message: '手机蓝牙没有打开。请在控制中心打开蓝牙，然后重试。', action: 'none' };
  }
  if (platform === 'android') {
    return { title: '蓝牙没有打开', message: '手机蓝牙没有打开。请打开蓝牙和定位服务，然后重试。', action: 'open-bluetooth-setting' };
  }
  return { title: '蓝牙没有打开', message: '手机蓝牙没有打开。请打开蓝牙后重试。', action: 'none' };
}

function unknownDescription(found, error) {
  const own = error && typeof error === 'object' ? String(error.message || '') : String(error || '');
  const numeric = found.codes.find((code) => /^\d{3,}$/.test(code));
  const message = own && HAS_CHINESE.test(own) && !JARGON.test(own)
    ? own
    : `连接打印机时出了点问题。请把打印机关机再开机，然后重试。${numeric ? `（代码 ${numeric}）` : ''}`;
  return { title: '连接失败', message, action: 'retry' };
}

/**
 * Plain-language description of a Bluetooth failure.
 * options: { platform, api, authorizeSetting, systemSetting } — api (wx) lets
 * it read the platform and permission state when those are not passed.
 * Returns { kind, title, message, action, actionText } where action is one of
 * 'open-bluetooth-setting' | 'open-app-authorize' | 'open-setting' | 'retry' | 'none'.
 */
function describeBleError(error, options) {
  const config = options || {};
  const api = config.api || null;
  const context = {
    platform: String(config.platform || (api ? platformName(api) : '')).toLowerCase(),
    authorize: config.authorizeSetting || readSetting(api, 'getAppAuthorizeSetting'),
    system: config.systemSetting || readSetting(api, 'getSystemSetting')
  };
  const found = collect(error);
  const kind = classify(found, context);
  let described;
  if (kind === 'adapter-off') described = adapterOffDescription(context.platform);
  else if (kind === 'unknown') described = unknownDescription(found, error);
  else {
    const entry = MESSAGES[kind];
    described = { title: entry[0], message: entry[1], action: entry[2] };
  }
  return Object.assign({ kind }, described, { actionText: ACTION_TEXT[described.action] });
}

function canPerform(action, api) {
  const method = ACTION_METHODS[action];
  return Boolean(api && method && typeof api[method] === 'function');
}

/** Opens the settings page an action points to. Returns false when it cannot. */
function performBleErrorAction(action, api) {
  const client = api || (typeof wx !== 'undefined' ? wx : null);
  if (!canPerform(action, client)) return false;
  try {
    client[ACTION_METHODS[action]]({});
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Shows the failure in a modal whose confirm button fixes it: opens settings,
 * or calls options.retry. options: { title, retry, platform }.
 */
function showBleError(api, error, options) {
  const config = options || {};
  const described = describeBleError(error, { api, platform: config.platform });
  const canOpen = canPerform(described.action, api);
  const canRetry = typeof config.retry === 'function'
    && (described.action === 'retry' || (Boolean(ACTION_METHODS[described.action]) && !canOpen));
  const confirmText = canOpen ? described.actionText : canRetry ? ACTION_TEXT.retry : ACTION_TEXT.none;
  const title = OWN_TITLE_KINDS.indexOf(described.kind) >= 0
    ? described.title
    : config.title || described.title;
  if (!api || typeof api.showModal !== 'function') return described;
  api.showModal({
    title,
    content: described.message,
    showCancel: canOpen || canRetry,
    confirmText,
    cancelText: '取消',
    confirmColor: BRAND_RED,
    success: (result) => {
      if (!result || !result.confirm) return;
      if (canOpen) performBleErrorAction(described.action, api);
      else if (canRetry) config.retry();
    }
  });
  return described;
}

module.exports = {
  NOT_A_PRINTER,
  describeBleError,
  performBleErrorAction,
  showBleError
};
