const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BleSession,
  PRIMARY_NOTIFY_CHARACTERISTIC,
  PRIMARY_SERVICE,
  PRIMARY_WRITE_CHARACTERISTIC,
  withTimeout
} = require('../miniprogram/services/ble-session');

function readySession(onWrite) {
  const api = {
    writeBLECharacteristicValue(options) {
      onWrite(options);
    }
  };
  const session = new BleSession(api);
  session.deviceId = 'device';
  session.serviceId = 'service';
  session.writeCharacteristic = {
    uuid: 'write',
    properties: { writeNoResponse: true }
  };
  session.connected = true;
  session.maxWriteSize = 100;
  session.writeDelayMs = 0;
  return session;
}

test('withTimeout releases a Bluetooth call that never invokes a callback', async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 5, 'watchdog'), /watchdog/);
});

test('stopScan queued while discovery is starting still stops the eventual platform scan', async () => {
  let startSuccess;
  let foundListener = null;
  const calls = [];
  const api = {
    openBluetoothAdapter({ success }) { calls.push('open'); success({}); },
    stopBluetoothDevicesDiscovery({ success }) { calls.push('stop'); success({}); },
    startBluetoothDevicesDiscovery({ success }) {
      calls.push('start');
      startSuccess = success;
    },
    onBluetoothDeviceFound(listener) { foundListener = listener; calls.push('listen'); },
    offBluetoothDeviceFound(listener) {
      if (foundListener === listener) foundListener = null;
      calls.push('unlisten');
    }
  };
  const session = new BleSession(api);
  const scanning = session.scan(() => {});
  while (!startSuccess) await new Promise((resolve) => setImmediate(resolve));

  const stopping = session.stopScan();
  assert.equal(calls.filter((item) => item === 'stop').length, 1);
  startSuccess({});
  await Promise.all([scanning, stopping]);

  assert.equal(calls.filter((item) => item === 'stop').length, 2);
  assert.equal(foundListener, null);
  assert.deepEqual(calls, ['open', 'stop', 'listen', 'start', 'unlisten', 'stop']);
});

test('a queued write never crosses into a replacement transport', async () => {
  const writes = [];
  const session = readySession((options) => writes.push(options));
  session.writeDelayMs = 0;
  const first = session.writeRaw([1, 2, 3]);
  const queued = session.writeRaw([4, 5, 6]);
  const queuedFailure = assert.rejects(queued, { code: 'TRANSPORT_RESET' });
  while (!writes.length) await new Promise((resolve) => setImmediate(resolve));
  session.transportGeneration += 1;
  session.deviceId = 'replacement-device';
  writes[0].success({});
  await first;
  await queuedFailure;
  assert.equal(writes.length, 1, 'the second label never reaches the new printer');
});

function transportApi(options) {
  const config = options || {};
  const calls = {
    close: [],
    create: 0,
    connectionListener: null,
    notify: [],
    services: 0,
    setMtu: 0,
    getMtu: 0
  };
  const genericService = '000018f0-0000-1000-8000-00805f9b34fb';
  const genericWrite = '0000ff02-0000-1000-8000-00805f9b34fb';
  const genericNotify = '0000ff03-0000-1000-8000-00805f9b34fb';
  const api = {
    openBluetoothAdapter({ success }) { success({}); },
    stopBluetoothDevicesDiscovery({ success }) { success({}); },
    createBLEConnection({ success, fail }) {
      calls.create += 1;
      if (config.alreadyConnected) {
        fail({ errCode: -1, errMsg: 'createBLEConnection:fail already connect' });
      } else {
        success({});
      }
    },
    closeBLEConnection({ deviceId, success }) {
      calls.close.push(deviceId);
      success({});
    },
    getBLEDeviceServices({ success }) {
      calls.services += 1;
      if (calls.services <= (config.emptyServicesFirst || 0)) {
        success({ services: [] });
        return;
      }
      if (config.layout) {
        success({ services: Object.keys(config.layout).map((uuid) => ({ uuid, isPrimary: true })) });
        return;
      }
      success({ services: [
        { uuid: genericService, isPrimary: true },
        { uuid: PRIMARY_SERVICE, isPrimary: false }
      ] });
    },
    getBLEDeviceCharacteristics({ serviceId, success }) {
      if (config.layout) {
        success({ characteristics: config.layout[serviceId] || [] });
        return;
      }
      if (serviceId === PRIMARY_SERVICE) {
        success({ characteristics: config.missingNiimCharacteristics ? [
          { uuid: 'generic-write', properties: { write: true } },
          { uuid: 'generic-notify', properties: { notify: true } }
        ] : [
          { uuid: 'generic-write', properties: { write: true } },
          { uuid: 'generic-notify', properties: { notify: true } },
          { uuid: PRIMARY_WRITE_CHARACTERISTIC, properties: { writeNoResponse: true } },
          { uuid: PRIMARY_NOTIFY_CHARACTERISTIC, properties: { notify: true } }
        ] });
      } else {
        success({ characteristics: [
          { uuid: genericWrite, properties: { writeNoResponse: true } },
          { uuid: genericNotify, properties: { notify: true } }
        ] });
      }
    },
    notifyBLECharacteristicValueChange(request) {
      calls.notify.push(request);
      request.success({});
    },
    onBLEConnectionStateChange(listener) { calls.connectionListener = listener; },
    offBLEConnectionStateChange(listener) {
      if (calls.connectionListener === listener) calls.connectionListener = null;
    },
    onBLECharacteristicValueChange() {},
    offBLECharacteristicValueChange() {},
    onBLEMTUChange() {},
    offBLEMTUChange() {}
  };
  if (config.setMtu !== false) {
    api.setBLEMTU = ({ success }) => {
      calls.setMtu += 1;
      success({ mtu: config.setMtuValue || 247 });
    };
  }
  api.getBLEMTU = ({ success, fail }) => {
    calls.getMtu += 1;
    if (config.getMtuFails) fail({ errMsg: 'getBLEMTU:fail' });
    else success({ mtu: config.getMtuValue || 247 });
  };
  return { api, calls };
}

test('already-connect is accepted and the E781 module service wins over other writable channels', async () => {
  const mock = transportApi({ alreadyConnected: true, getMtuFails: true });
  const session = new BleSession(mock.api);

  const result = await session.connect({ deviceId: 'printer-1', name: 'D110' });

  assert.equal(mock.calls.create, 1);
  assert.equal(result.serviceId, PRIMARY_SERVICE);
  assert.equal(result.writeCharacteristicId, PRIMARY_WRITE_CHARACTERISTIC);
  assert.equal(result.notifyCharacteristicId, PRIMARY_NOTIFY_CHARACTERISTIC);
  assert.equal(result.writeType, 'writeNoResponse');
  assert.equal(mock.calls.notify[0].characteristicId, PRIMARY_NOTIFY_CHARACTERISTIC);
  assert.equal(result.mtu, 247);
  assert.equal(result.maxWriteSize, 244, 'getBLEMTU failure must not erase a successful Android MTU');
  assert.equal(session.connected, true);
  await session.disconnect();
});

test('connectExisting rediscovers an OS connection without creating one and reads the iOS MTU', async () => {
  const mock = transportApi({ setMtu: false, getMtuValue: 185 });
  const session = new BleSession(mock.api);

  const result = await session.connectExisting({ deviceId: 'printer-ios', name: 'B1' });

  assert.equal(mock.calls.create, 0);
  assert.equal(mock.calls.setMtu, 0);
  assert.equal(mock.calls.getMtu, 1);
  assert.equal(result.mtu, 185);
  assert.equal(result.maxWriteSize, 182);
  assert.equal(result.notifyCharacteristicId, PRIMARY_NOTIFY_CHARACTERISTIC);
  await session.disconnect();
});

test('a printer on the E781 module service is written and notified on its 9f characteristic', async () => {
  const mock = transportApi({ layout: {
    '00001800-0000-1000-8000-00805f9b34fb': [{ uuid: '00002a00-0000-1000-8000-00805f9b34fb', properties: { read: true } }],
    [PRIMARY_SERVICE.toUpperCase()]: [
      { uuid: PRIMARY_WRITE_CHARACTERISTIC.toUpperCase(), properties: { read: true, writeNoResponse: true, notify: true } }
    ]
  } });
  const session = new BleSession(mock.api);

  const result = await session.connect({ deviceId: 'b1', name: 'B1-H123456' });
  assert.equal(result.serviceId, PRIMARY_SERVICE.toUpperCase());
  assert.equal(result.writeCharacteristicId, PRIMARY_WRITE_CHARACTERISTIC.toUpperCase());
  assert.equal(result.notifyCharacteristicId, PRIMARY_WRITE_CHARACTERISTIC.toUpperCase());
  assert.equal(mock.calls.notify[0].characteristicId, PRIMARY_WRITE_CHARACTERISTIC.toUpperCase());
  assert.equal(session.connected, true);
  await session.disconnect();
});

test('a printer on another service is used through its own write and notify characteristics', async () => {
  const service = '0000ff00-0000-1000-8000-00805f9b34fb';
  const mock = transportApi({ layout: {
    '0000180a-0000-1000-8000-00805f9b34fb': [{ uuid: '00002a29-0000-1000-8000-00805f9b34fb', properties: { read: true, write: true, notify: true } }],
    [service]: [
      { uuid: '0000ff01-0000-1000-8000-00805f9b34fb', properties: { read: true } },
      { uuid: '0000ff02-0000-1000-8000-00805f9b34fb', properties: { writeNoResponse: true } },
      { uuid: '0000ff03-0000-1000-8000-00805f9b34fb', properties: { notify: true } }
    ]
  } });
  const session = new BleSession(mock.api);

  const result = await session.connect({ deviceId: 'other-1', name: 'Q1-123' });
  assert.equal(result.serviceId, service, 'device information is never a print channel');
  assert.equal(result.writeCharacteristicId, '0000ff02-0000-1000-8000-00805f9b34fb');
  assert.equal(result.notifyCharacteristicId, '0000ff03-0000-1000-8000-00805f9b34fb');
  await session.disconnect();
});

test('a single characteristic that both writes and notifies is preferred outside the E781 service too', async () => {
  const service = '49535343-fe7d-4ae5-8fa9-9fafd205e455';
  const mock = transportApi({ layout: {
    [service]: [
      { uuid: 'aaaa0001', properties: { notify: true } },
      { uuid: 'aaaa0002', properties: { write: true } },
      { uuid: 'aaaa0003', properties: { write: true, notify: true } }
    ]
  } });
  const session = new BleSession(mock.api);
  const result = await session.connect({ deviceId: 'uart-1', name: 'Printer' });
  assert.equal(result.writeCharacteristicId, 'aaaa0003');
  assert.equal(result.notifyCharacteristicId, 'aaaa0003');
  await session.disconnect();
});

test('a device with nothing to send print data on stays connected and says so when written to', async () => {
  const mock = transportApi({ layout: {
    '00001800-0000-1000-8000-00805f9b34fb': [{ uuid: '00002a00-0000-1000-8000-00805f9b34fb', properties: { read: true, write: true, notify: true } }],
    '0000fe95-0000-1000-8000-00805f9b34fb': [{ uuid: '00000001-0000-1000-8000-00805f9b34fb', properties: { read: true } }]
  } });
  const session = new BleSession(mock.api);
  session.discoveryRetryDelaysMs = [0, 0];

  const result = await session.connect({ deviceId: 'speaker-1', name: 'Generic BLE' });
  assert.equal(session.connected, true, 'the link stays up');
  assert.equal(result.writeCharacteristicId, '');
  assert.equal(mock.calls.notify.length, 0);
  assert.deepEqual(mock.calls.close, [], 'nothing disconnects it');
  assert.equal(mock.calls.services, 3, 'looked twice more for a channel');
  await assert.rejects(
    session.writeRaw([0x1B, 0x40]),
    (error) => error.code === 'NO_PRINT_CHANNEL'
      && error.message === '这台设备不能接收打印内容，可能不是打印机。请确认打印机已开机，再在列表里点一下你的打印机。'
  );
  await session.disconnect();
});

test('a device that can only be written to connects without answers', async () => {
  const service = '0000ffe0-0000-1000-8000-00805f9b34fb';
  const mock = transportApi({ layout: {
    [service]: [{ uuid: '0000ffe1-0000-1000-8000-00805f9b34fb', properties: { write: true } }]
  } });
  const session = new BleSession(mock.api);
  session.discoveryRetryDelaysMs = [0, 0];

  const result = await session.connect({ deviceId: 'writer-1', name: 'Writer' });
  assert.equal(mock.calls.services, 1, 'a printer that can take print data is not asked again');
  assert.equal(session.connected, true);
  assert.equal(result.serviceId, service);
  assert.equal(result.writeCharacteristicId, '0000ffe1-0000-1000-8000-00805f9b34fb');
  assert.equal(result.notifyCharacteristicId, '');
  assert.equal(mock.calls.notify.length, 0);
  await session.disconnect();
});

test('a device that refuses notifications stays connected', async () => {
  const mock = transportApi({ layout: {
    [PRIMARY_SERVICE]: [{ uuid: PRIMARY_WRITE_CHARACTERISTIC, properties: { writeNoResponse: true, notify: true } }]
  } });
  let attempts = 0;
  mock.api.notifyBLECharacteristicValueChange = (request) => {
    attempts += 1;
    request.fail({ errCode: 10007, errMsg: 'notifyBLECharacteristicValueChange:fail property not support' });
  };
  const session = new BleSession(mock.api);

  const result = await session.connect({ deviceId: 'b1', name: 'B1-H123456' });
  assert.equal(session.connected, true);
  assert.equal(attempts, 2, 'asked twice');
  assert.equal(result.notifyCharacteristicId, '');
  await session.disconnect();
});

test('a link that is gone while looking for services still fails the connection', async () => {
  const mock = transportApi();
  mock.api.getBLEDeviceServices = ({ fail }) => fail({ errCode: 10006, errMsg: 'getBLEDeviceServices:fail no connection' });
  const session = new BleSession(mock.api);
  await assert.rejects(session.connect({ deviceId: 'gone', name: 'D110' }), (error) => error.code === 10006);
  assert.equal(session.connected, false);
});

test('services a phone lists only a moment after the link opens are still found', async () => {
  const mock = transportApi({ emptyServicesFirst: 2, layout: {
    [PRIMARY_SERVICE]: [{ uuid: PRIMARY_WRITE_CHARACTERISTIC, properties: { writeNoResponse: true, notify: true } }]
  } });
  const session = new BleSession(mock.api);
  session.discoveryRetryDelaysMs = [0, 0];

  const result = await session.connect({ deviceId: 'd110', name: 'D110-G123' });
  assert.equal(mock.calls.services, 3);
  assert.equal(result.writeCharacteristicId, PRIMARY_WRITE_CHARACTERISTIC);
  assert.equal(session.connected, true);
  await session.disconnect();
});

test('a disconnect while waiting to look for services again ends the attempt', async () => {
  const mock = transportApi({ emptyServicesFirst: 5 });
  const session = new BleSession(mock.api);
  session.discoveryRetryDelaysMs = [20, 20];
  const connecting = session.connect({ deviceId: 'd110', name: 'D110-G123' });
  setTimeout(() => { session.disconnect(); }, 5);
  await assert.rejects(connecting, (error) => error.code === 'CONNECT_CANCELLED' || error.code === 'TRANSPORT_RESET');
  assert.equal(session.connected, false);
  assert.ok(mock.calls.services <= 2, 'no further lookups after the disconnect');
});

test('Bluetooth switched off at open() carries a code the error mapper recognises', async () => {
  const session = new BleSession({
    openBluetoothAdapter({ fail }) { fail({ errCode: 10001, errMsg: 'openBluetoothAdapter:fail:not available', state: 4 }); }
  });
  await assert.rejects(session.open(), (error) => error.code === 'BLUETOOTH_UNAVAILABLE'
    && error.errCode === 10001
    && error.cause.cause.state === 4
    && /打开手机蓝牙/.test(error.message));
  const denied = new BleSession({
    openBluetoothAdapter({ fail }) { fail({ errMsg: 'openBluetoothAdapter:fail auth deny' }); }
  });
  await assert.rejects(denied.open(), /auth deny/, 'other failures keep their details for the mapper');
  const already = new BleSession({
    openBluetoothAdapter({ fail }) { fail({ errCode: -1, errMsg: 'openBluetoothAdapter:fail already opened' }); }
  });
  await already.open();
});

function hangingConnectApi() {
  const mock = transportApi();
  const pending = [];
  mock.api.createBLEConnection = (options) => {
    mock.calls.create += 1;
    pending.push(options);
  };
  return { mock, pending };
}

test('disconnect cancels a connection that is still waiting for a switched-off printer', async () => {
  const { mock, pending } = hangingConnectApi();
  const session = new BleSession(mock.api);
  const connecting = session.connect({ deviceId: 'printer-off', name: 'D110' });
  while (!pending.length) await new Promise((resolve) => setImmediate(resolve));

  const started = Date.now();
  await session.disconnect('printer-off');
  await assert.rejects(connecting, (error) => error.code === 'CONNECT_CANCELLED');
  assert.ok(Date.now() - started < 1000, 'the cancelled attempt must not wait for the platform timeout');
  assert.equal(session.deviceId, '');
  assert.equal(session.connectAttempt, null);
  assert.deepEqual(mock.calls.close, ['printer-off']);

  // A link the platform opens after the cancel is closed again.
  pending[0].success({});
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(mock.calls.close, ['printer-off', 'printer-off']);

  // The session is free for the next printer straight away.
  mock.api.createBLEConnection = ({ success }) => success({});
  const result = await session.connect({ deviceId: 'printer-2', name: 'B1' });
  assert.equal(result.deviceId, 'printer-2');
  await session.disconnect();
});

test('a late link for a printer the session reconnected to is kept open', async () => {
  const { mock, pending } = hangingConnectApi();
  const session = new BleSession(mock.api);
  const first = session.connect({ deviceId: 'printer-1', name: 'D110' });
  while (!pending.length) await new Promise((resolve) => setImmediate(resolve));
  await session.disconnect();
  await assert.rejects(first, { code: 'CONNECT_CANCELLED' });

  const second = session.connect({ deviceId: 'printer-1', name: 'D110' });
  while (pending.length < 2) await new Promise((resolve) => setImmediate(resolve));
  const closesBefore = mock.calls.close.length;
  pending[0].success({});
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(mock.calls.close.length, closesBefore, 'the new attempt owns printer-1 now');
  pending[1].success({});
  const result = await second;
  assert.equal(result.deviceId, 'printer-1');
  await session.disconnect();
});

test('disconnecting another device leaves an in-flight connection alone', async () => {
  const { mock, pending } = hangingConnectApi();
  const session = new BleSession(mock.api);
  const connecting = session.connect({ deviceId: 'printer-1', name: 'D110' });
  while (!pending.length) await new Promise((resolve) => setImmediate(resolve));
  await session.disconnect('someone-else');
  assert.equal(session.connectAttempt && session.connectAttempt.deviceId, 'printer-1');
  pending[0].success({});
  const result = await connecting;
  assert.equal(result.deviceId, 'printer-1');
  await session.disconnect();
});

test('a disconnect during discovery cannot publish a stale transport as connected', async () => {
  const mock = transportApi({ setMtu: false, getMtuValue: 185 });
  const session = new BleSession(mock.api);

  const connection = session.connectExisting({ deviceId: 'printer-race', name: 'D110' });
  setTimeout(() => mock.calls.connectionListener({ deviceId: 'printer-race', connected: false }), 10);

  await assert.rejects(connection, /初始化期间已失效/);
  assert.equal(session.connected, false);
});

test('a device whose services never come back stays connected, without asking again', async () => {
  const mock = transportApi();
  let lookups = 0;
  mock.api.getBLEDeviceServices = () => { lookups += 1; };
  const session = new BleSession(mock.api);
  session.operationTimeoutMs = 5;
  session.discoveryRetryDelaysMs = [0, 0];

  const result = await session.connect({ deviceId: 'printer-hung', name: 'D110' });
  assert.equal(session.connected, true);
  assert.equal(result.writeCharacteristicId, '');
  assert.equal(lookups, 1, 'a lookup that hangs is not stacked again');
  await session.disconnect();
});

test('raw ESC/POS bytes go out in packets the link takes, acknowledged one by one', async () => {
  const writes = [];
  const api = { writeBLECharacteristicValue(options) { writes.push(options); options.success({}); } };
  const session = new BleSession(api);
  session.deviceId = 'syd';
  session.serviceId = 'ff00';
  session.connected = true;
  session.maxWriteSize = 20;
  session.writeCharacteristic = { uuid: 'ff02', properties: { write: true, writeNoResponse: true } };

  await session.writeRaw(Uint8Array.from({ length: 45 }, (_, index) => index));
  assert.deepEqual(writes.map((item) => new Uint8Array(item.value).length), [20, 20, 5]);
  assert.ok(writes.every((item) => item.writeType === 'write'), 'write requests when the printer offers them');
  assert.equal(new Uint8Array(writes[2].value)[0], 40);

  writes.length = 0;
  session.writeDelayMs = 0;
  session.writeCharacteristic = { uuid: 'ff02', properties: { writeNoResponse: true } };
  await session.writeRaw([1, 2, 3]);
  assert.equal(writes[0].writeType, 'writeNoResponse');

  session.writeCharacteristic = null;
  await assert.rejects(session.writeRaw([1]), (error) => error.code === 'NO_PRINT_CHANNEL');
});
