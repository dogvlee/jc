const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const componentDir = path.join(__dirname, '..', 'miniprogram', 'components', 'printer-picker');
let definition = null;
global.Component = (value) => { definition = value; };
require('../miniprogram/components/printer-picker/index');
delete global.Component;

const DESKTOP_MESSAGE = '电脑版微信暂不支持连接蓝牙打印机，请在手机微信里打开商跃标签';
const tick = () => new Promise((resolve) => setImmediate(resolve));

function fakeSession() {
  return {
    scans: 0,
    stops: 0,
    onDevices: null,
    scanResult: null,
    scan(onDevices) {
      this.scans += 1;
      this.onDevices = onDevices;
      return this.scanResult || Promise.resolve();
    },
    stopScan() {
      this.stops += 1;
      return Promise.resolve();
    }
  };
}

function fakeManager() {
  return {
    state: { status: 'disconnected', device: null, source: '', error: '', background: false },
    listeners: [],
    calls: [],
    disconnects: 0,
    forgets: 0,
    saved: null,
    report: { error: '', errorCode: '' },
    connect: null,
    getState() { return Object.assign({}, this.state); },
    subscribe(listener) {
      this.listeners.push(listener);
      return () => { this.listeners = this.listeners.filter((item) => item !== listener); };
    },
    emit(state) {
      this.state = state;
      this.listeners.forEach((listener) => listener(state));
    },
    ensureReady(device, options) {
      this.calls.push({ device, options });
      if (this.connect) return this.connect(device, options);
      return Promise.resolve({ deviceId: device.deviceId, name: device.name, mtu: 247, protocol: 'escpos' });
    },
    disconnect() { this.disconnects += 1; return Promise.resolve(); },
    forget() { this.forgets += 1; return Promise.resolve(); },
    getSavedDevice() { return this.saved; },
    diagnose() { return Promise.resolve(this.report); }
  };
}

function createPicker(options) {
  const config = options || {};
  const session = fakeSession();
  const manager = fakeManager();
  const printer = { connects: [], connect(device) { this.connects.push(device); return Promise.resolve({ deviceId: device.deviceId, name: device.name, source: 'plain' }); } };
  const modals = [];
  const toasts = [];
  const events = [];
  const globalData = config.globalData || { connectionManager: manager, bleSession: session, printerClient: printer };
  global.getApp = config.noApp ? undefined : () => ({ globalData });
  global.wx = Object.assign({
    getDeviceInfo: () => ({ platform: config.platform || 'android' }),
    showModal: (modal) => modals.push(modal),
    showToast: (toast) => toasts.push(toast),
    showLoading() {},
    hideLoading() {},
    openSystemBluetoothSetting() {}
  }, config.wx || {});
  const instance = {
    data: Object.assign({ show: definition.properties.show.value }, JSON.parse(JSON.stringify(definition.data))),
    setData(patch) { Object.assign(this.data, patch); },
    triggerEvent(name, detail) { events.push({ name, detail }); }
  };
  Object.keys(definition.methods).forEach((key) => { instance[key] = definition.methods[key]; });
  definition.lifetimes.created.call(instance);
  definition.lifetimes.attached.call(instance);
  return {
    instance,
    session,
    manager,
    printer,
    modals,
    toasts,
    events,
    setShow(value) {
      instance.data.show = value;
      definition.observers.show.call(instance, value);
    },
    detach() { definition.lifetimes.detached.call(instance); },
    pageHide() { definition.pageLifetimes.hide.call(instance); },
    pageShow() { definition.pageLifetimes.show.call(instance); },
    tap(deviceId) { return instance.connectDevice({ currentTarget: { dataset: { id: deviceId } } }); }
  };
}

test.afterEach(() => {
  delete global.wx;
  delete global.getApp;
});

const NEARBY = [
  { deviceId: 'watch', name: 'Mi Band 7', RSSI: -40 },
  { deviceId: 'syd80', name: 'SYD-80', RSSI: -82 },
  { deviceId: 'phone', localName: 'iPhone', RSSI: -70 },
  { deviceId: 'syd58', name: 'SYD-58', RSSI: -52 },
  { deviceId: 'no-name', RSSI: -30 }
];

test('the component shares app styles and declares itself a component', () => {
  assert.deepEqual(definition.options, { addGlobalClass: true });
  const json = JSON.parse(fs.readFileSync(path.join(componentDir, 'index.json'), 'utf8'));
  assert.equal(json.component, true);
  const markup = fs.readFileSync(path.join(componentDir, 'index.wxml'), 'utf8');
  assert.doesNotMatch(markup, /\{\{[^}]*\b(?:RSSI|deviceId)\s*\}\}\s*</, 'no raw RSSI or device ID is rendered as text');
  assert.doesNotMatch(markup, /MTU|GATT|协议|候选|真机/);
  const styles = fs.readFileSync(path.join(componentDir, 'index.wxss'), 'utf8');
  assert.doesNotMatch(styles.replace(/\/\*[\s\S]*?\*\//g, ''), /(^|[\s,}])(?:button|view|text|#)[\s.{:[]/m, 'component styles use class selectors only');
});

test('opening scans and lists every nearby device, known printers first', () => {
  const picker = createPicker();
  picker.setShow(true);
  assert.equal(picker.session.scans, 1);
  assert.equal(picker.instance.data.scanning, true);

  picker.session.onDevices(NEARBY);
  const { devices } = picker.instance.data;
  assert.deepEqual(devices.map((item) => [item.deviceId, item.name, item.label, item.printer, item.signal]), [
    ['syd58', 'SYD-58', '58mm 打印机', true, '信号强'],
    ['syd80', 'SYD-80', '80mm 打印机', true, '信号弱'],
    ['watch', 'Mi Band 7', '', false, '信号强'],
    ['phone', 'iPhone', '', false, '信号中']
  ]);
  for (const item of devices) {
    assert.deepEqual(Object.keys(item).sort(), ['deviceId', 'label', 'name', 'printer', 'signal'], 'raw RSSI never reaches the view');
  }
  assert.equal('others' in picker.instance.data, false, 'every device is in the one list');
  const markup = fs.readFileSync(path.join(componentDir, 'index.wxml'), 'utf8');
  assert.doesNotMatch(markup, /其他蓝牙设备|toggleOthers|未识别型号|没有找到打印机/, 'no device is set apart or hidden');
});

test('the scan stops by itself after 15 seconds and offers a new search', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const picker = createPicker();
  picker.setShow(true);
  t.mock.timers.tick(14999);
  assert.equal(picker.instance.data.scanning, true);
  assert.equal(picker.session.stops, 0);
  t.mock.timers.tick(1);
  assert.equal(picker.instance.data.scanning, false);
  assert.equal(picker.instance.data.scanEnded, true);
  assert.equal(picker.session.stops, 1);

  picker.session.onDevices(NEARBY);
  assert.equal(picker.instance.data.devices.length, 0, 'late results after the window are ignored');
  picker.instance.rescan();
  assert.equal(picker.session.scans, 2);
  assert.equal(picker.instance.data.scanning, true);
});

test('desktop WeChat explains that printing needs the phone and never scans', () => {
  for (const platform of ['windows', 'mac']) {
    const picker = createPicker({ platform });
    picker.setShow(true);
    assert.equal(picker.instance.data.notice, DESKTOP_MESSAGE);
    assert.equal(picker.session.scans, 0);
    picker.instance.rescan();
    assert.equal(picker.session.scans, 0);
  }
});

test('tapping a printer connects through the manager and reports the result', async () => {
  let finish;
  const picker = createPicker();
  picker.manager.connect = (device) => new Promise((resolve) => {
    finish = () => resolve({ deviceId: device.deviceId, name: device.name, mtu: 185, protocol: 'escpos' });
  });
  picker.setShow(true);
  picker.session.onDevices(NEARBY);

  const connecting = picker.tap('syd58');
  assert.equal(picker.instance.data.connectingId, 'syd58');
  assert.equal(picker.instance.data.scanning, false, 'the search stops while connecting');
  picker.tap('syd80');
  assert.equal(picker.manager.calls.length, 1, 'other taps are ignored while connecting');
  assert.deepEqual(picker.manager.calls[0].options, { forceFresh: true });

  finish();
  await connecting;
  assert.equal(picker.instance.data.connectingId, '');
  assert.deepEqual(picker.events, [{
    name: 'connected',
    detail: {
      result: { deviceId: 'syd58', name: 'SYD-58', mtu: 185, protocol: 'escpos' },
      device: { deviceId: 'syd58', name: 'SYD-58', RSSI: -52 }
    }
  }]);
  assert.equal(picker.modals.length, 0);
});

test('a failed connection shows a plain explanation with a retry that reconnects', async () => {
  const picker = createPicker();
  picker.manager.connect = () => Promise.reject(Object.assign(new Error('createBLEConnection:fail:connection fail status:133'), { code: 10003 }));
  picker.setShow(true);
  picker.session.onDevices(NEARBY);

  await picker.tap('syd58');
  assert.equal(picker.events.length, 0);
  assert.equal(picker.modals.length, 1);
  assert.equal(picker.modals[0].title, '连接失败');
  assert.doesNotMatch(picker.modals[0].content, /createBLEConnection|fail|133/);
  assert.match(picker.modals[0].content, /关机再开机/);
  assert.equal(picker.modals[0].confirmText, '重试');

  picker.manager.connect = null;
  picker.modals[0].success({ confirm: true });
  await tick();
  assert.equal(picker.manager.calls.length, 2);
  assert.equal(picker.manager.calls[1].device.deviceId, 'syd58');
  assert.equal(picker.events[0].name, 'connected');
});

test('any device in the list connects, printer or not, without a popup', async () => {
  const picker = createPicker();
  picker.setShow(true);
  picker.session.onDevices(NEARBY);
  await picker.tap('watch');
  assert.equal(picker.manager.calls[0].device.deviceId, 'watch');
  assert.equal(picker.events[0].name, 'connected');
  assert.equal(picker.events[0].detail.device.deviceId, 'watch');
  assert.equal(picker.modals.length, 0);
});

test('with stable reconnect switched off the picker falls back to the plain printer client', async () => {
  const picker = createPicker();
  picker.manager.connect = () => Promise.reject(Object.assign(new Error('off'), { code: 'BLE_RECONNECT_OFF' }));
  picker.setShow(true);
  picker.session.onDevices(NEARBY);
  await picker.tap('syd80');
  assert.equal(picker.printer.connects.length, 1);
  assert.equal(picker.printer.connects[0].deviceId, 'syd80');
  assert.equal(picker.events[0].name, 'connected');
  assert.equal(picker.events[0].detail.result.source, 'plain');
  assert.equal(picker.modals.length, 0);
});

test('hiding or detaching the picker stops scanning and unsubscribes', () => {
  const picker = createPicker();
  assert.equal(picker.manager.listeners.length, 1, 'the connected card follows the manager');
  picker.setShow(true);
  picker.setShow(false);
  assert.equal(picker.session.stops, 1);
  picker.session.onDevices(NEARBY);
  assert.equal(picker.instance.data.devices.length, 0);

  picker.setShow(true);
  assert.equal(picker.session.scans, 2);
  picker.detach();
  assert.equal(picker.session.stops, 2);
  assert.equal(picker.manager.listeners.length, 0);
});

test('closing asks the page to close and stops the search', () => {
  const picker = createPicker();
  picker.setShow(true);
  picker.instance.onClose();
  assert.deepEqual(picker.events, [{ name: 'close', detail: undefined }]);
  assert.equal(picker.session.stops, 1);
});

test('a scan failure explains the fix and keeps the hint in the empty list', () => {
  const opened = [];
  const picker = createPicker({ wx: { openSystemBluetoothSetting: () => opened.push('bluetooth') } });
  picker.session.scanResult = Promise.reject(Object.assign(new Error('请打开手机蓝牙后重试'), { code: 'BLUETOOTH_UNAVAILABLE' }));
  picker.setShow(true);
  return tick().then(() => {
    assert.equal(picker.instance.data.scanning, false);
    assert.equal(picker.modals[0].title, '蓝牙没有打开');
    assert.equal(picker.modals[0].confirmText, '去打开');
    assert.match(picker.instance.data.scanHint, /蓝牙没有打开/);
    picker.modals[0].success({ confirm: true });
    assert.deepEqual(opened, ['bluetooth']);

    // Coming back from the settings page searches again on its own.
    picker.session.scanResult = null;
    picker.pageHide();
    picker.pageShow();
    assert.equal(picker.session.scans, 2);
    assert.equal(picker.instance.data.scanHint, '');
  });
});

test('the connected card follows the manager and can disconnect or forget', async () => {
  const picker = createPicker();
  picker.setShow(true);
  picker.manager.emit({ status: 'connected', device: { deviceId: 'syd58', name: 'SYD-58' }, source: 'fresh', error: '', background: false });
  assert.equal(picker.instance.data.linkStatus, 'connected');
  assert.equal(picker.instance.data.linkName, 'SYD-58');

  await picker.instance.disconnectPrinter();
  assert.equal(picker.manager.disconnects, 1);
  const forgetting = picker.instance.forgetPrinter();
  assert.equal(picker.modals.length, 1, 'forgetting asks first');
  picker.modals[0].success({ confirm: true });
  await forgetting;
  assert.equal(picker.manager.forgets, 1);
  assert.equal(picker.toasts[0].title, '已忘记打印机');

  picker.manager.emit({ status: 'connecting', device: { deviceId: 'syd58', name: 'SYD-58' }, source: '', error: '', background: true });
  assert.equal(picker.instance.data.linkStatus, 'connecting');
  assert.equal(picker.instance.data.linkBackground, true);
});

test('checking the connection answers in plain words', async () => {
  const picker = createPicker();
  picker.setShow(true);
  await picker.instance.checkConnection();
  assert.match(picker.modals[0].content, /还没有连接过打印机/);

  picker.manager.saved = { deviceId: 'syd58', name: 'SYD-58' };
  await picker.instance.checkConnection();
  assert.equal(picker.modals[1].title, '检查连接');
  assert.equal(picker.modals[1].content, '连接正常，可以打印');

  picker.manager.report = { error: 'createBLEConnection:fail:operate time out', errorCode: '10012' };
  await picker.instance.checkConnection();
  assert.equal(picker.modals[2].content, '打印机没有响应。请确认打印机已开机、在手机旁边，而且没有被其他手机连接。');

  picker.manager.report = { error: '稳定连接已被 kill switch 关闭', errorCode: 'BLE_RECONNECT_OFF' };
  await picker.instance.checkConnection();
  assert.doesNotMatch(picker.modals[3].content, /kill switch/);
  for (const modal of picker.modals) assert.doesNotMatch(`${modal.title}${modal.content}`, /GATT|MTU|型号 ID|协议/);
});

test('missing app services never throw and explain themselves', async () => {
  const bare = createPicker({ globalData: {} });
  assert.doesNotThrow(() => bare.setShow(true));
  assert.match(bare.instance.data.notice, /蓝牙功能暂时不能使用/);
  await bare.instance.connectTo({ deviceId: 'x', name: 'SYD-58' });
  assert.match(bare.modals[0].content, /蓝牙功能暂时不能使用/);
  await bare.instance.checkConnection();
  assert.match(bare.modals[1].content, /蓝牙功能暂时不能使用/);
  assert.doesNotThrow(() => bare.detach());

  const orphan = createPicker({ noApp: true });
  assert.doesNotThrow(() => orphan.setShow(true));
  assert.match(orphan.instance.data.notice, /蓝牙功能暂时不能使用/);
});

test('no scan starts while a label is printing', () => {
  const picker = createPicker();
  picker.printer.printing = true;
  picker.setShow(true);
  assert.equal(picker.session.scans, 0);
  assert.equal(picker.instance.data.scanning, false);
  assert.match(picker.instance.data.scanHint, /正在打印/);
  picker.printer.printing = false;
  picker.instance.rescan();
  assert.equal(picker.session.scans, 1);
  assert.equal(picker.instance.data.scanHint, '');
});

test('reopening while a connection is still running keeps its loading state', async () => {
  let finish;
  const picker = createPicker();
  picker.manager.connect = (device) => new Promise((resolve) => { finish = () => resolve({ deviceId: device.deviceId }); });
  picker.setShow(true);
  picker.session.onDevices(NEARBY);
  const connecting = picker.tap('syd58');
  picker.setShow(false);
  picker.setShow(true);
  assert.equal(picker.instance.data.connectingId, 'syd58');
  assert.equal(picker.session.scans, 1, 'no competing scan during the connection');
  finish();
  await connecting;
  assert.equal(picker.events[0].name, 'connected');
});

test('forgetting the printer asks first and does nothing when cancelled', async () => {
  const picker = createPicker();
  picker.setShow(true);
  picker.manager.emit({ status: 'connected', device: { deviceId: 'syd58', name: 'SYD-58' }, source: 'fresh', error: '', background: false });

  const forgetting = picker.instance.forgetPrinter();
  const modal = picker.modals[0];
  assert.equal(modal.content, '忘记后要重新搜索才能连接，确定吗？');
  assert.equal(modal.confirmText, '忘记');
  assert.equal(modal.confirmColor, '#E02D26');
  modal.success({ confirm: false, cancel: true });
  await forgetting;
  assert.equal(picker.manager.forgets, 0);
  assert.equal(picker.toasts.length, 0);
  assert.equal(picker.instance.data.busy, false);
});

test('the connected card says which paper width labels print for', () => {
  const picker = createPicker();
  picker.setShow(true);
  const connect = (device) => picker.manager.emit({ status: 'connected', device, source: 'fresh', error: '', background: false });

  connect({ deviceId: 'a', name: 'SYD-80' });
  assert.equal(picker.instance.data.linkPaper, '80mm');
  // A name that does not say prints 58mm, like the print sheet.
  connect({ deviceId: 'b', name: 'EY-260' });
  assert.equal(picker.instance.data.linkPaper, '58mm');
  // The width the user picked for this printer wins over its name.
  connect({ deviceId: 'c', name: 'SYD-58', confirmedProfileId: 'escpos-80' });
  assert.equal(picker.instance.data.linkPaper, '80mm');

  const markup = fs.readFileSync(path.join(componentDir, 'index.wxml'), 'utf8');
  assert.match(markup, /'已连接 · 按 ' \+ linkPaper \+ ' 纸宽打印'/);
  assert.doesNotMatch(markup, /热敏打印机|标签机/);
});
