const assert = require('node:assert/strict');
const test = require('node:test');

const {
  BleSession,
  PRIMARY_NOTIFY_CHARACTERISTIC,
  PRIMARY_SERVICE,
  PRIMARY_WRITE_CHARACTERISTIC,
  withTimeout
} = require('../miniprogram/services/ble-session');
const { COMMAND, RESPONSE, encodePacket } = require('../miniprogram/core/protocol');

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

test('a printer error rejects the active request instead of becoming a timeout', async () => {
  let session;
  session = readySession((options) => {
    setTimeout(() => session.handleValueChange({
      deviceId: 'device',
      value: encodePacket(RESPONSE.PRINT_ERROR, [2]).buffer
    }), 0);
    options.success({});
  });

  await assert.rejects(
    session.request(COMMAND.PAGE_START, [1], RESPONSE.PAGE_START, 100),
    /缺纸/
  );
});

test('an asynchronous error during one-way rows is latched for the next command', async () => {
  let writes = 0;
  let session;
  session = readySession((options) => {
    writes += 1;
    if (writes === 1) {
      setTimeout(() => session.handleValueChange({
        deviceId: 'device',
        value: encodePacket(RESPONSE.PRINT_ERROR, [3]).buffer
      }), 0);
    }
    options.success({});
  });

  await session.request(COMMAND.PRINT_EMPTY_ROW, [0, 0, 1], null, 100);
  await assert.rejects(
    session.request(COMMAND.PAGE_END, [1], RESPONSE.PAGE_END, 100),
    /电量过低/
  );
  assert.equal(writes, 1);
});

test('writeBytes preserves a full protocol frame and rejects an insufficient MTU', async () => {
  let writes = 0;
  const session = readySession((options) => {
    writes += 1;
    options.success({});
  });
  session.maxWriteSize = 20;

  await assert.rejects(
    session.request(COMMAND.PRINT_BITMAP_ROW, new Uint8Array(20), null, 100),
    /完整打印帧需要 27 字节/
  );
  assert.equal(writes, 0);
});

function transportApi(options) {
  const config = options || {};
  const calls = {
    close: [],
    create: 0,
    connectionListener: null,
    notify: [],
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
      success({ services: [
        { uuid: genericService, isPrimary: true },
        { uuid: PRIMARY_SERVICE, isPrimary: false }
      ] });
    },
    getBLEDeviceCharacteristics({ serviceId, success }) {
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

test('already-connect is accepted and NIIMBOT UUIDs win over generic writable channels', async () => {
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

test('a generic writable BLE device is rejected before any protocol bytes are sent', async () => {
  const mock = transportApi({ missingNiimCharacteristics: true });
  const session = new BleSession(mock.api);

  await assert.rejects(
    session.connect({ deviceId: 'speaker-1', name: 'Generic BLE' }),
    /可信的 NIIMBOT BLE 服务/
  );
  assert.equal(mock.calls.notify.length, 0);
  assert.equal(session.connected, false);
});

test('a disconnect during discovery cannot publish a stale transport as connected', async () => {
  const mock = transportApi({ setMtu: false, getMtuValue: 185 });
  const session = new BleSession(mock.api);

  const connection = session.connectExisting({ deviceId: 'printer-race', name: 'D110' });
  setTimeout(() => mock.calls.connectionListener({ deviceId: 'printer-race', connected: false }), 10);

  await assert.rejects(connection, /初始化期间已失效/);
  assert.equal(session.connected, false);
});

test('service discovery has a watchdog when the platform never calls back', async () => {
  const mock = transportApi();
  mock.api.getBLEDeviceServices = () => {};
  const session = new BleSession(mock.api);
  session.operationTimeoutMs = 5;
  await assert.rejects(
    session.connect({ deviceId: 'printer-hung', name: 'D110' }),
    /getBLEDeviceServices 超时/
  );
  assert.equal(session.connected, false);
});
