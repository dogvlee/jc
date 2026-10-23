const assert = require('node:assert/strict');
const test = require('node:test');

const {
  classifyPrinter,
  printerDisplayName,
  signalLabel,
  sortDevices
} = require('../miniprogram/core/printer-names');

const THERMAL = { supported: true, label: '热敏打印机' };
const OTHER = { supported: false, label: '' };

test('深云达 (SYD) printers are listed as thermal printers', () => {
  for (const name of ['SYD-58', 'SYD-80', 'SYD58-A1', 'SYD80', 'syd_80', 'SYD 58', 'SYD', ' SYD-58 ']) {
    assert.deepEqual(classifyPrinter({ name }), THERMAL, name);
  }
  // SYD has to stand on its own at the start of the name.
  for (const name of ['SYDNEY Speaker', 'SYDX-58', 'MySYD-58', 'Printer SYD-58']) {
    assert.deepEqual(classifyPrinter({ name }), OTHER, name);
  }
});

test('other devices, NIIMBOT label printers included, are listed without a label and connect all the same', () => {
  const names = [
    'AirPods Pro', 'Mi Band 7', 'Bose QC45', 'Desk Lamp', '',
    // The app no longer prints to NIIMBOT printers, so their names mean nothing special.
    'D110-G123456789', 'D11_H-C21304', 'B1-H123456', 'B21-C2B123', 'B21S-7788'
  ];
  for (const name of names) {
    assert.deepEqual(classifyPrinter({ name }), OTHER, name);
  }
  assert.deepEqual(classifyPrinter(null), OTHER);
  assert.deepEqual(classifyPrinter(undefined), OTHER);
  assert.deepEqual(classifyPrinter({}), OTHER);
});

test('localName and displayName count when the platform leaves name empty', () => {
  assert.deepEqual(classifyPrinter({ name: '', localName: 'SYD-58' }), THERMAL);
  assert.deepEqual(classifyPrinter({ displayName: 'SYD-80' }), THERMAL);
  // Any name the printer advertises is enough.
  assert.deepEqual(classifyPrinter({ name: 'Printer', localName: 'SYD-58' }), THERMAL);
  assert.equal(printerDisplayName({ name: '', localName: 'SYD-58' }), 'SYD-58');
  assert.equal(printerDisplayName({ displayName: 'SYD-80', name: 'x' }), 'SYD-80');
  assert.equal(printerDisplayName({ name: '  ', localName: ' SYD-58 ' }), 'SYD-58');
  assert.equal(printerDisplayName({}), '未命名设备');
  assert.equal(printerDisplayName(null), '未命名设备');
});

test('sortDevices lists SYD printers first, each group by signal, and drops unnamed devices', () => {
  const devices = [
    { deviceId: 'watch', name: 'Watch', RSSI: -40 },
    { deviceId: 'syd-far', name: 'SYD-58', RSSI: -85 },
    { deviceId: 'unnamed', RSSI: -30 },
    { deviceId: 'phone', name: 'Phone', RSSI: -70 },
    { deviceId: 'syd-near', name: 'SYD-80', RSSI: -50 },
    { deviceId: 'unknown-signal', localName: 'SYD-58' },
    // iOS reports 127 when it does not know the strength.
    { deviceId: 'ios-unknown', name: 'SYD-80', RSSI: 127 },
    { deviceId: 'niimbot', name: 'D110-NEAR', RSSI: -45 },
    { name: 'no id', RSSI: -20 }
  ];
  assert.deepEqual(sortDevices(devices).map((item) => item.deviceId), [
    'syd-near',
    'syd-far',
    'unknown-signal',
    'ios-unknown',
    'watch',
    'niimbot',
    'phone'
  ]);
  assert.deepEqual(sortDevices(null), []);
  assert.equal(devices[0].deviceId, 'watch', 'the input list is not reordered');
});

test('signalLabel turns RSSI into plain words and hides unknown strength', () => {
  assert.equal(signalLabel(-45), '信号强');
  assert.equal(signalLabel(-60), '信号强');
  assert.equal(signalLabel(-61), '信号中');
  assert.equal(signalLabel(-75), '信号中');
  assert.equal(signalLabel(-76), '信号弱');
  assert.equal(signalLabel(-100), '信号弱');
  for (const unknown of [undefined, null, '', 0, 127, NaN, 'abc']) {
    assert.equal(signalLabel(unknown), '', String(unknown));
  }
});
