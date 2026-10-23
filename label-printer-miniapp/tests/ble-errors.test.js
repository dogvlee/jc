const assert = require('node:assert/strict');
const test = require('node:test');

const {
  NOT_A_PRINTER,
  describeBleError,
  performBleErrorAction,
  showBleError
} = require('../miniprogram/services/ble-errors');

const JARGON = /MTU|GATT|协议|kill switch|RSSI|deviceId|候选适配|真机验证|errMsg|errCode|[a-z]{4,}/i;

function wxError(errCode, errMsg, extra) {
  const error = new Error(errMsg);
  error.code = errCode;
  error.cause = Object.assign({ errCode, errMsg }, extra || {});
  return error;
}

function assertFriendly(described) {
  assert.doesNotMatch(described.title, JARGON, described.title);
  assert.doesNotMatch(described.message, JARGON, described.message);
  assert.ok(described.actionText.length <= 4, `按钮文字过长：${described.actionText}`);
}

test('Bluetooth switched off opens the Bluetooth settings on Android and explains Control Center on iOS', () => {
  const off = wxError(10001, 'openBluetoothAdapter:fail:not available');
  const android = describeBleError(off, { platform: 'android' });
  assert.equal(android.kind, 'adapter-off');
  assert.equal(android.action, 'open-bluetooth-setting');
  assert.match(android.message, /定位服务/);
  assertFriendly(android);

  const ios = describeBleError(off, { platform: 'ios', authorizeSetting: { bluetoothAuthorized: 'authorized' } });
  assert.equal(ios.action, 'none');
  assert.match(ios.message, /控制中心打开蓝牙/);
  assertFriendly(ios);

  const coded = Object.assign(new Error('请打开手机蓝牙后重试'), { code: 'BLUETOOTH_UNAVAILABLE' });
  assert.equal(describeBleError(coded, { platform: 'android' }).kind, 'adapter-off');
});

test('refused mini program Bluetooth authorization opens the mini program settings', () => {
  const described = describeBleError(wxError(undefined, 'openBluetoothAdapter:fail auth deny'), { platform: 'ios' });
  assert.equal(described.kind, 'auth-deny');
  assert.equal(described.action, 'open-setting');
  assert.equal(described.actionText, '去设置');
  assertFriendly(described);
  assert.equal(describeBleError(new Error('authorize:fail scope.bluetooth'), {}).action, 'open-setting');
});

test('a refused privacy agreement asks the user to agree and retry', () => {
  const byErrno = Object.assign(new Error('openBluetoothAdapter:fail privacy permission is not authorized'), { errno: 104 });
  const described = describeBleError(byErrno, { platform: 'android' });
  assert.equal(described.kind, 'privacy');
  assert.equal(described.action, 'retry');
  assert.match(described.message, /需要先同意隐私保护指引才能使用蓝牙/);
  assertFriendly(described);
  const nested = wxError(undefined, 'fail', { errno: 104 });
  assert.equal(describeBleError(nested, {}).kind, 'privacy');
});

test('iOS WeChat without system Bluetooth permission opens the app authorization page', () => {
  const off = wxError(10001, 'openBluetoothAdapter:fail:not available');
  const denied = describeBleError(off, { platform: 'ios', authorizeSetting: { bluetoothAuthorized: 'denied' } });
  assert.equal(denied.kind, 'system-permission');
  assert.equal(denied.action, 'open-app-authorize');
  assertFriendly(denied);
  const byState = describeBleError(wxError(10001, 'openBluetoothAdapter:fail', { state: 3 }), { platform: 'ios' });
  assert.equal(byState.action, 'open-app-authorize');
  const api = { getAppAuthorizeSetting: () => ({ bluetoothAuthorized: 'denied' }), getDeviceInfo: () => ({ platform: 'ios' }) };
  assert.equal(describeBleError(off, { api }).kind, 'system-permission', 'settings are read through the api');
});

test('Android location and nearby-device permissions open the app authorization page', () => {
  for (const message of [
    'startBluetoothDevicesDiscovery:fail:location permission is denied',
    'openBluetoothAdapter:fail:no permission BLUETOOTH_CONNECT',
    'startBluetoothDevicesDiscovery:fail BLUETOOTH_SCAN',
    '需要附近的设备权限'
  ]) {
    const described = describeBleError(wxError(10008, message), { platform: 'android' });
    assert.equal(described.kind, 'location-permission', message);
    assert.equal(described.action, 'open-app-authorize', message);
    assertFriendly(described);
  }
  const serviceOff = describeBleError(wxError(10008, 'startBluetoothDevicesDiscovery:fail:location service unavailable'), {
    platform: 'android',
    systemSetting: { locationEnabled: false, bluetoothEnabled: true }
  });
  assert.equal(serviceOff.kind, 'location-off');
  assert.equal(serviceOff.action, 'retry');
  assert.match(serviceOff.message, /定位/);
});

test('timeouts and failed links suggest checking or restarting the printer', () => {
  for (const error of [
    wxError(10012, 'createBLEConnection:fail:operate time out'),
    new Error('createBLEConnection 超时'),
    new Error('等待打印机响应超时（0x40）')
  ]) {
    const described = describeBleError(error, { platform: 'android' });
    assert.equal(described.kind, 'timeout', error.message);
    assert.equal(described.action, 'retry');
    assert.equal(described.message, '打印机没有响应。请确认打印机已开机、在手机旁边，而且没有被其他手机连接。');
  }
  for (const error of [
    wxError(10003, 'createBLEConnection:fail:connection fail'),
    wxError(-1, 'createBLEConnection:fail:connection fail status:133')
  ]) {
    const described = describeBleError(error, { platform: 'android' });
    assert.equal(described.kind, 'connect-failed', error.message);
    assert.equal(described.action, 'retry');
    assert.match(described.message, /关机再开机/);
    assertFriendly(described);
  }
});

test('a device without the printer service is refused in plain words', () => {
  const error = Object.assign(new Error(NOT_A_PRINTER), { code: 'NO_PRINT_CHANNEL' });
  const described = describeBleError(error, { platform: 'android' });
  assert.equal(described.kind, 'not-printer');
  assert.equal(described.action, 'none');
  assert.equal(described.actionText, '知道了');
  assert.match(described.message, /这台设备不能接收打印内容，可能不是打印机/);
  assert.doesNotMatch(described.message, /D11|B21|开头/, 'no model list: any printer may connect');
  assertFriendly(described);
});

test('manager codes for busy, printing and interrupted connections are explained', () => {
  const busy = describeBleError(Object.assign(new Error('另一台打印机正在连接，请稍后重试'), { code: 'CONNECT_BUSY' }), {});
  assert.equal(busy.kind, 'busy');
  assert.equal(busy.action, 'retry');
  const printing = describeBleError(Object.assign(new Error('x'), { code: 'PRINT_IN_PROGRESS' }), {});
  assert.equal(printing.kind, 'printing');
  assert.equal(printing.action, 'none');
  for (const code of ['CONNECT_SUPERSEDED', 'CONNECT_CANCELLED', 'TRANSPORT_RESET']) {
    assert.equal(describeBleError(Object.assign(new Error('x'), { code }), {}).kind, 'interrupted', code);
  }
  const killSwitch = describeBleError({ message: '稳定连接已被 kill switch 关闭', code: 'BLE_RECONNECT_OFF' }, {});
  assert.equal(killSwitch.kind, 'reselect');
  assertFriendly(killSwitch);
});

test('unknown failures never show raw English and keep a short numeric code', () => {
  const described = describeBleError(wxError(10008, 'writeBLECharacteristicValue:fail:system error, status: 5'), { platform: 'android' });
  assert.equal(described.kind, 'unknown');
  assert.equal(described.action, 'retry');
  assert.match(described.message, /（代码 10008）$/);
  assertFriendly(described);
  assert.equal(describeBleError(new Error('打印机缺纸'), {}).message, '打印机缺纸', 'friendly Chinese passes through');
  assert.doesNotMatch(describeBleError(new Error('打印机写入特征尚未就绪'), {}).message, /特征/);
  assert.doesNotMatch(describeBleError(new Error('something odd'), {}).message, /something/);
  assertFriendly(describeBleError(null, {}));
  assertFriendly(describeBleError('plain string failure', {}));
});

test('performBleErrorAction opens the right settings page and guards missing APIs', () => {
  const calls = [];
  const api = {
    openSystemBluetoothSetting: () => calls.push('bluetooth'),
    openAppAuthorizeSetting: () => calls.push('authorize'),
    openSetting: () => calls.push('setting')
  };
  assert.equal(performBleErrorAction('open-bluetooth-setting', api), true);
  assert.equal(performBleErrorAction('open-app-authorize', api), true);
  assert.equal(performBleErrorAction('open-setting', api), true);
  assert.deepEqual(calls, ['bluetooth', 'authorize', 'setting']);
  assert.equal(performBleErrorAction('retry', api), false);
  assert.equal(performBleErrorAction('none', api), false);
  assert.equal(performBleErrorAction('open-bluetooth-setting', {}), false, 'iOS has no Bluetooth settings API');
  assert.equal(performBleErrorAction('open-setting', { openSetting() { throw new Error('boom'); } }), false);
});

test('showBleError offers the fix as the confirm button', () => {
  const modals = [];
  const opened = [];
  const api = {
    getDeviceInfo: () => ({ platform: 'android' }),
    showModal: (options) => modals.push(options),
    openSystemBluetoothSetting: () => opened.push('bluetooth')
  };
  const described = showBleError(api, wxError(10001, 'openBluetoothAdapter:fail:not available'), { title: '无法搜索打印机' });
  assert.equal(described.action, 'open-bluetooth-setting');
  assert.equal(modals[0].title, '蓝牙没有打开');
  assert.equal(modals[0].confirmText, '去打开');
  assert.equal(modals[0].showCancel, true);
  assert.equal(modals[0].confirmColor, '#E02D26');
  modals[0].success({ confirm: true });
  assert.deepEqual(opened, ['bluetooth']);

  let retried = 0;
  showBleError(api, wxError(10012, 'createBLEConnection:fail:operate time out'), { title: '连接失败', retry: () => { retried += 1; } });
  assert.equal(modals[1].title, '连接失败');
  assert.equal(modals[1].confirmText, '重试');
  modals[1].success({ confirm: false });
  assert.equal(retried, 0);
  modals[1].success({ confirm: true });
  assert.equal(retried, 1);

  showBleError(api, Object.assign(new Error(NOT_A_PRINTER), { code: 'NO_PRINT_CHANNEL' }), { title: '连接失败', retry: () => { retried += 1; } });
  assert.equal(modals[2].showCancel, false);
  assert.equal(modals[2].confirmText, '知道了');
  modals[2].success({ confirm: true });
  assert.equal(retried, 1, 'a non-printer is not retried');
});

test('showBleError falls back to retry when the settings API is missing', () => {
  const modals = [];
  let retried = 0;
  const api = { getDeviceInfo: () => ({ platform: 'android' }), showModal: (options) => modals.push(options) };
  showBleError(api, wxError(10001, 'openBluetoothAdapter:fail:not available'), { retry: () => { retried += 1; } });
  assert.equal(modals[0].confirmText, '重试');
  modals[0].success({ confirm: true });
  assert.equal(retried, 1);
  assert.doesNotThrow(() => showBleError({}, new Error('x')));
});
