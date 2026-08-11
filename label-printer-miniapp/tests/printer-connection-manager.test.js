const assert = require('node:assert/strict');
const test = require('node:test');

const { PRIMARY_SERVICE } = require('../miniprogram/services/ble-session');
const {
  DEFAULT_DEVICE_STORAGE_KEY,
  DEFAULT_KILL_SWITCH_KEY,
  PrinterConnectionManager
} = require('../miniprogram/services/printer-connection-manager');

class MemoryStorage {
  constructor(initial) {
    this.values = Object.assign({}, initial || {});
  }

  getStorageSync(key) {
    return this.values[key];
  }

  setStorageSync(key, value) {
    this.values[key] = value;
  }

  removeStorageSync(key) {
    delete this.values[key];
  }
}

class FakeApi {
  constructor() {
    this.connectedDevices = new Set();
    this.connectionQueries = 0;
    this.adapterListener = null;
  }

  getConnectedBluetoothDevices({ success }) {
    this.connectionQueries += 1;
    success({ devices: Array.from(this.connectedDevices).map((deviceId) => ({ deviceId })) });
  }

  onBluetoothAdapterStateChange(listener) {
    this.adapterListener = listener;
  }

  offBluetoothAdapterStateChange(listener) {
    if (this.adapterListener === listener) this.adapterListener = null;
  }
}

class FakeSession {
  constructor(api, events) {
    this.api = api;
    this.events = events || [];
    this.connected = false;
    this.deviceId = '';
    this.opens = 0;
    this.disconnects = [];
    this.connectionListeners = [];
  }

  async open() {
    this.opens += 1;
    this.events.push('open');
  }

  onConnectionStateChange(listener) {
    this.connectionListeners.push(listener);
    return () => {
      this.connectionListeners = this.connectionListeners.filter((item) => item !== listener);
    };
  }

  async disconnect(deviceId) {
    const target = deviceId || this.deviceId;
    this.events.push(`disconnect:${target}`);
    this.disconnects.push(target);
    if (target) this.api.connectedDevices.delete(target);
    if (!deviceId || !this.deviceId || target === this.deviceId) {
      this.connected = false;
      this.deviceId = '';
    }
  }

  drop(deviceId) {
    const target = deviceId || this.deviceId;
    this.api.connectedDevices.delete(target);
    this.connected = false;
    this.connectionListeners.forEach((listener) => listener({ connected: false, deviceId: target }));
  }

  async close() {
    await this.disconnect();
  }
}

class FakePrinter {
  constructor(session, options) {
    this.session = session;
    this.options = options || {};
    this.ready = false;
    this.deviceId = '';
    this.printing = false;
    this.connectCalls = 0;
    this.existingCalls = 0;
  }

  invalidateConnection() {
    this.ready = false;
    this.deviceId = '';
  }

  result(device) {
    return {
      deviceId: device.deviceId,
      name: device.name || 'D110',
      serviceId: PRIMARY_SERVICE,
      writeCharacteristicId: 'write-niim',
      notifyCharacteristicId: 'notify-niim',
      writeType: 'writeNoResponse',
      mtu: 247,
      maxWriteSize: 244,
      modelId: 2304,
      protocolVersion: 1,
      info: {}
    };
  }

  async connect(device) {
    this.connectCalls += 1;
    this.session.events.push('connect:fresh');
    if (this.options.connectGate) await this.options.connectGate;
    if (this.options.freshFailures > 0) {
      this.options.freshFailures -= 1;
      const error = new Error('already-connect 后特征已失效');
      error.retryFresh = true;
      throw error;
    }
    if (this.options.freshError) throw this.options.freshError;
    this.session.connected = true;
    this.session.deviceId = device.deviceId;
    this.session.api.connectedDevices.add(device.deviceId);
    this.ready = true;
    this.deviceId = device.deviceId;
    return this.result(device);
  }

  async connectExisting(device) {
    this.existingCalls += 1;
    this.session.events.push('connect:existing');
    if (this.options.existingFailures > 0) {
      this.options.existingFailures -= 1;
      throw new Error('特征重发现失败');
    }
    this.session.connected = true;
    this.session.deviceId = device.deviceId;
    this.ready = true;
    this.deviceId = device.deviceId;
    return this.result(device);
  }
}

function createHarness(options) {
  const config = options || {};
  const events = [];
  const api = new FakeApi();
  (config.connectedDevices || []).forEach((deviceId) => api.connectedDevices.add(deviceId));
  const session = new FakeSession(api, events);
  const printer = new FakePrinter(session, config.printerOptions);
  const storage = config.storage || new MemoryStorage();
  const manager = new PrinterConnectionManager({
    api,
    session,
    printer,
    storage,
    now: config.now,
    wait: config.wait || (async () => events.push('wait')),
    fastReuseTtlMs: config.fastReuseTtlMs,
    sessionTtlMs: config.sessionTtlMs,
    autoReconnectDelayMs: config.autoReconnectDelayMs,
    autoReconnectMaxAttempts: config.autoReconnectMaxAttempts,
    reopenDelayMs: config.reopenDelayMs == null ? 1 : config.reopenDelayMs
  });
  return { api, events, manager, printer, session, storage };
}

const DEVICE = { deviceId: 'printer-1', name: 'D110' };

test('concurrent ensureReady calls are single-flight for one printer', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const harness = createHarness({ printerOptions: { connectGate: gate } });

  const first = harness.manager.ensureReady(DEVICE);
  const second = harness.manager.ensureReady(DEVICE);
  assert.equal(first, second);
  await assert.rejects(
    harness.manager.ensureReady({ deviceId: 'printer-2', name: 'B1' }),
    (error) => error.code === 'CONNECT_BUSY'
  );
  release();
  const [left, right] = await Promise.all([first, second]);

  assert.equal(harness.printer.connectCalls, 1);
  assert.equal(left.deviceId, DEVICE.deviceId);
  assert.deepEqual(left, right);
});

test('a stronger force request waits for the active connection and then preserves its semantics', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const harness = createHarness({ printerOptions: { connectGate: gate } });

  const ordinary = harness.manager.ensureReady(DEVICE);
  const forced = harness.manager.ensureReady(DEVICE, { forceFresh: true });
  assert.notEqual(ordinary, forced);
  release();

  const [first, second] = await Promise.all([ordinary, forced]);
  assert.equal(first.source, 'fresh');
  assert.equal(second.source, 'force-fresh');
  assert.equal(harness.printer.connectCalls, 2);
  assert.deepEqual(harness.session.disconnects, [DEVICE.deviceId]);
});

test('connection validation and diagnostics cannot interleave commands with an active print', async () => {
  const harness = createHarness();
  harness.printer.printing = true;

  await assert.rejects(
    harness.manager.ensureReady(DEVICE, { forceValidate: true }),
    (error) => error.code === 'PRINT_IN_PROGRESS'
  );
  const report = await harness.manager.diagnose(DEVICE);
  assert.match(report.error, /打印任务进行中/);
  assert.equal(harness.session.opens, 0);
  assert.equal(harness.printer.connectCalls, 0);
});

test('manual disconnect supersedes an in-flight connection without publishing stale ready state', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const harness = createHarness({ printerOptions: { connectGate: gate } });
  const connecting = harness.manager.ensureReady(DEVICE);
  await new Promise((resolve) => setImmediate(resolve));

  await harness.manager.disconnect();
  release();
  await assert.rejects(connecting, (error) => error.code === 'CONNECT_SUPERSEDED');
  assert.equal(harness.manager.getState().source, 'manual');
  assert.equal(harness.session.connected, false);
  assert.equal(harness.printer.ready, false);
  assert.equal(harness.manager.cache.has(DEVICE.deviceId), false);
});

test('fast reuse, system reuse, and TTL expiry avoid or trigger rediscovery as intended', async () => {
  let now = 0;
  const harness = createHarness({
    now: () => now,
    fastReuseTtlMs: 100,
    sessionTtlMs: 1000
  });

  const fresh = await harness.manager.ensureReady(DEVICE);
  assert.equal(fresh.source, 'fresh');
  assert.equal(harness.printer.connectCalls, 1);
  assert.equal(harness.api.connectionQueries, 1);

  now = 50;
  const fast = await harness.manager.ensureReady(DEVICE);
  assert.equal(fast.source, 'fast-reuse');
  assert.equal(harness.api.connectionQueries, 1, 'fast reuse must not query the operating system');

  now = 500;
  const system = await harness.manager.ensureReady(DEVICE);
  assert.equal(system.source, 'system-reuse');
  assert.equal(harness.api.connectionQueries, 2);
  assert.equal(harness.printer.existingCalls, 0);

  now = 2000;
  const rediscovered = await harness.manager.ensureReady(DEVICE);
  assert.equal(rediscovered.source, 'rediscovered');
  assert.equal(harness.printer.existingCalls, 1);
});

test('an OS-connected device with lost characteristics is closed and freshly rebuilt', async () => {
  const harness = createHarness({
    connectedDevices: [DEVICE.deviceId],
    printerOptions: { existingFailures: 1 }
  });

  const result = await harness.manager.ensureReady(DEVICE);

  assert.equal(harness.printer.existingCalls, 1);
  assert.equal(harness.printer.connectCalls, 1);
  assert.equal(result.source, 'zombie-recovered');
  assert.deepEqual(harness.session.disconnects, [DEVICE.deviceId]);
  assert.deepEqual(harness.events.slice(0, 5), [
    'open',
    'connect:existing',
    `disconnect:${DEVICE.deviceId}`,
    'wait',
    'connect:fresh'
  ]);
});

test('forceFresh closes the named OS connection before creating a new transport', async () => {
  const harness = createHarness({ connectedDevices: [DEVICE.deviceId] });

  const result = await harness.manager.ensureReady(DEVICE, { forceFresh: true });

  assert.equal(result.source, 'force-fresh');
  assert.equal(harness.printer.existingCalls, 0);
  assert.equal(harness.printer.connectCalls, 1);
  assert.deepEqual(harness.events, [
    'open',
    `disconnect:${DEVICE.deviceId}`,
    'wait',
    'connect:fresh'
  ]);
});

test('already-connect followed by failed discovery retries once after a hard close', async () => {
  const harness = createHarness({ printerOptions: { freshFailures: 1 } });

  const result = await harness.manager.ensureReady(DEVICE);

  assert.equal(result.source, 'already-recovered');
  assert.equal(harness.printer.connectCalls, 2);
  assert.deepEqual(harness.session.disconnects, [DEVICE.deviceId]);
});

test('the kill switch prevents BLE work and can be cleared without losing the saved device', async () => {
  const storage = new MemoryStorage({
    [DEFAULT_KILL_SWITCH_KEY]: true,
    [DEFAULT_DEVICE_STORAGE_KEY]: DEVICE
  });
  const harness = createHarness({ storage });

  await assert.rejects(
    harness.manager.ensureReady(),
    (error) => error.code === 'BLE_RECONNECT_OFF'
  );
  const disabledReport = await harness.manager.diagnose();
  assert.match(disabledReport.error, /kill switch/);
  assert.equal(harness.session.opens, 0);

  harness.manager.enable();
  const result = await harness.manager.ensureReady();
  assert.equal(result.deviceId, DEVICE.deviceId);
  assert.equal(harness.manager.getSavedDevice().modelId, 2304);
});

test('a physical disconnect clears cached and protocol-ready state', async () => {
  const harness = createHarness();
  await harness.manager.ensureReady(DEVICE);
  assert.equal(harness.printer.ready, true);

  harness.session.drop(DEVICE.deviceId);

  assert.equal(harness.printer.ready, false);
  assert.equal(harness.manager.getState().status, 'disconnected');
  assert.equal(harness.manager.cache.has(DEVICE.deviceId), false);
});

test('a physical link loss automatically rebuilds the saved session when enabled', async () => {
  const harness = createHarness({ autoReconnectDelayMs: 0 });
  harness.manager.bindStateListeners({ autoReconnect: true });
  await harness.manager.ensureReady(DEVICE);

  harness.session.drop(DEVICE.deviceId);
  await new Promise((resolve) => setTimeout(resolve, 5));

  assert.equal(harness.printer.connectCalls, 2);
  assert.equal(harness.manager.getState().status, 'connected');
  assert.equal(harness.manager.getState().source, 'fresh');
  harness.manager.unbindStateListeners();
});

test('manual disconnect can forget the persisted binding without page-level cleanup', async () => {
  const harness = createHarness();
  await harness.manager.ensureReady(DEVICE);
  assert.equal(harness.storage.getStorageSync(DEFAULT_DEVICE_STORAGE_KEY).deviceId, DEVICE.deviceId);

  await harness.manager.disconnect({ forget: true });

  assert.equal(harness.printer.ready, false);
  assert.equal(harness.manager.getSavedDevice(), null);
  assert.equal(harness.storage.getStorageSync(DEFAULT_DEVICE_STORAGE_KEY), undefined);
  assert.equal(harness.manager.getState().source, 'manual');
});

test('diagnose reports transport and NIIMBOT protocol readiness without printing', async () => {
  const harness = createHarness();

  const report = await harness.manager.diagnose(DEVICE);

  assert.equal(report.adapterOk, true);
  assert.equal(report.transportReady, true);
  assert.equal(report.protocolReady, true);
  assert.equal(report.serviceId, PRIMARY_SERVICE);
  assert.equal(report.mtu, 247);
  assert.equal(report.modelId, 2304);
  assert.equal(report.error, '');
});

test('the single adapter listener can auto-reconnect the persisted printer when Bluetooth returns', async () => {
  const storage = new MemoryStorage({ [DEFAULT_DEVICE_STORAGE_KEY]: DEVICE });
  const harness = createHarness({ storage });
  harness.manager.bindStateListeners({ autoReconnect: true });

  harness.api.adapterListener({ available: true });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(harness.printer.connectCalls, 1);
  assert.equal(harness.manager.getState().status, 'connected');
  harness.api.adapterListener({ available: false });
  assert.equal(harness.printer.ready, false);
  assert.equal(harness.manager.getState().source, 'adapter-off');
  harness.manager.unbindStateListeners();
  assert.equal(harness.api.adapterListener, null);
});
