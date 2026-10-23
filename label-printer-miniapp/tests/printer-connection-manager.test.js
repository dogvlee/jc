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
    this.pendingConnects = [];
    this.writes = [];
  }

  async open() {
    this.opens += 1;
    this.events.push('open');
  }

  async writeRaw(bytes) {
    this.writes.push(Array.from(bytes));
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
    // Like BleSession, disconnecting cancels a connection still in progress.
    this.pendingConnects = this.pendingConnects.filter((pending) => {
      if (deviceId && pending.deviceId !== deviceId) return true;
      const error = new Error('连接已取消');
      error.code = 'CONNECT_CANCELLED';
      pending.reject(error);
      return false;
    });
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
    this.prints = 0;
  }

  invalidateConnection() {
    this.ready = false;
    this.deviceId = '';
  }

  async print() {
    this.prints += 1;
  }

  // What PrinterClient.connect returns: the Bluetooth link, tagged ESC/POS.
  result(device) {
    return {
      deviceId: device.deviceId,
      name: device.name || 'SYD-58',
      serviceId: PRIMARY_SERVICE,
      writeCharacteristicId: 'write-char',
      notifyCharacteristicId: 'notify-char',
      writeType: 'writeNoResponse',
      mtu: 247,
      maxWriteSize: 244,
      protocol: 'escpos'
    };
  }

  async connect(device) {
    this.connectCalls += 1;
    this.session.events.push('connect:fresh');
    const hanging = this.options.hangingDevices || [];
    if (hanging.indexOf(device.deviceId) >= 0) {
      // A switched-off printer: nothing happens until the attempt is cancelled.
      hanging.splice(hanging.indexOf(device.deviceId), 1);
      this.session.events.push(`hang:${device.deviceId}`);
      await new Promise((resolve, reject) => {
        this.session.pendingConnects.push({ deviceId: device.deviceId, reject });
      });
    }
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

const DEVICE = { deviceId: 'printer-1', name: 'SYD-58' };
const OTHER = { deviceId: 'printer-2', name: 'SYD-80' };

test('the whole print job blocks reconnect, even between its labels', async () => {
  const { manager, printer, session } = createHarness();
  printer.jobPhase = 'printing';
  await assert.rejects(manager.ensureReady(DEVICE), { code: 'PRINT_IN_PROGRESS' });
  const report = await manager.diagnose(DEVICE);
  assert.match(report.error, /打印任务进行中/);
  assert.equal(session.opens, 0);
  printer.jobPhase = 'preparing';
  await manager.ensureReady(DEVICE);
  assert.equal(printer.ready, true);
});

test('concurrent ensureReady calls are single-flight for one printer', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const harness = createHarness({ printerOptions: { connectGate: gate } });

  const first = harness.manager.ensureReady(DEVICE);
  const second = harness.manager.ensureReady(DEVICE);
  assert.equal(first, second);
  await assert.rejects(
    harness.manager.ensureReady(OTHER),
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
  assert.equal(harness.manager.getSavedDevice().deviceId, DEVICE.deviceId);
  assert.equal(harness.manager.getSavedDevice().mtu, 247, 'the saved printer is refreshed from the new link');
});

test('a physical disconnect clears cached and print-ready state', async () => {
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

test('the saved printer keeps its Bluetooth link details and nothing about a printer protocol', async () => {
  const harness = createHarness();
  await harness.manager.ensureReady(DEVICE);

  const expected = {
    deviceId: DEVICE.deviceId,
    name: 'SYD-58',
    displayName: 'SYD-58',
    serviceId: PRIMARY_SERVICE,
    writeCharacteristicId: 'write-char',
    notifyCharacteristicId: 'notify-char',
    writeType: 'writeNoResponse',
    mtu: 247,
    maxWriteSize: 244,
    profileId: ''
  };
  assert.deepEqual(harness.storage.getStorageSync(DEFAULT_DEVICE_STORAGE_KEY), expected);
  assert.deepEqual(harness.manager.getSavedDevice(), expected);
  assert.deepEqual(harness.manager.getState().device, expected);
});

test('diagnose reports the Bluetooth link and print channel without printing', async () => {
  const harness = createHarness();

  const report = await harness.manager.diagnose(DEVICE);

  assert.deepEqual(report, {
    adapterOk: true,
    systemConnected: false,
    transportReady: true,
    protocolReady: true,
    deviceId: DEVICE.deviceId,
    serviceId: PRIMARY_SERVICE,
    writeCharacteristicId: 'write-char',
    notifyCharacteristicId: 'notify-char',
    writeType: 'writeNoResponse',
    mtu: 247,
    maxWriteSize: 244,
    source: 'fresh',
    error: '',
    errorCode: ''
  });
  assert.equal(harness.printer.prints, 0, 'diagnosing never prints');
  assert.deepEqual(harness.session.writes, [], 'nor writes anything to the printer');
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

function recordStates(manager) {
  const states = [];
  manager.subscribe((state) => states.push(state));
  return states;
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('an automatic attempt is marked background while connecting and when it fails', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const harness = createHarness({ printerOptions: { connectGate: gate, freshError: new Error('createBLEConnection:fail:operate time out') } });
  const states = recordStates(harness.manager);

  const attempt = harness.manager.ensureReady(DEVICE, { forceFresh: true, background: true });
  assert.equal(harness.manager.getState().status, 'connecting');
  assert.equal(harness.manager.getState().background, true);
  release();
  await assert.rejects(attempt, /time out/);

  const failed = harness.manager.getState();
  assert.equal(failed.status, 'disconnected');
  assert.equal(failed.source, 'error');
  assert.equal(failed.background, true, 'pages can stay quiet about failures the user did not ask for');
  assert.equal(failed.error, '打印机没有响应。请确认打印机已开机、在手机旁边，而且没有被其他手机连接。');
  assert.deepEqual(states.map((state) => [state.status, state.background]), [
    ['connecting', true],
    ['disconnected', true]
  ]);

  harness.printer.options.freshError = null;
  await harness.manager.ensureReady(DEVICE);
  assert.equal(harness.manager.getState().status, 'connected');
  assert.equal(harness.manager.getState().background, false);
});

test('choosing another printer cancels the background reconnect instead of reporting busy', async () => {
  const harness = createHarness({ printerOptions: { hangingDevices: [DEVICE.deviceId] } });
  const states = recordStates(harness.manager);
  const background = harness.manager.ensureReady(DEVICE, { forceFresh: true, background: true });
  while (!harness.events.includes(`hang:${DEVICE.deviceId}`)) await tick();

  const chosen = harness.manager.ensureReady(OTHER, { forceFresh: true });
  assert.equal(harness.manager.getState().status, 'connecting');
  assert.equal(harness.manager.getState().device.deviceId, OTHER.deviceId);
  assert.equal(harness.manager.getState().background, false);

  await assert.rejects(background, (error) => error.code === 'CONNECT_CANCELLED' || error.code === 'CONNECT_SUPERSEDED');
  const result = await chosen;
  assert.equal(result.deviceId, OTHER.deviceId);
  assert.equal(result.source, 'force-fresh');
  assert.ok(harness.session.disconnects.includes(DEVICE.deviceId), 'the abandoned printer is disconnected');
  assert.equal(harness.manager.getSavedDevice().deviceId, OTHER.deviceId);
  assert.equal(harness.manager.getState().status, 'connected');
  assert.ok(!states.some((state) => state.source === 'error'), 'the cancelled attempt publishes no failure');
  assert.ok(!states.some((state) => state.status === 'connected' && state.device.deviceId === DEVICE.deviceId));
});

test('a background request still gets CONNECT_BUSY while the user is connecting another printer', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const harness = createHarness({ printerOptions: { connectGate: gate } });
  const user = harness.manager.ensureReady(DEVICE, { forceFresh: true });
  await assert.rejects(
    harness.manager.ensureReady({ deviceId: 'printer-2' }, { background: true }),
    { code: 'CONNECT_BUSY' }
  );
  assert.equal(harness.manager.ensureReady(DEVICE, { background: true }), user, 'same printer joins');
  release();
  await user;
  assert.equal(harness.manager.getState().background, false);
});

test('tapping the printer a background attempt is connecting joins it and makes it the user attempt', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const harness = createHarness({ printerOptions: { connectGate: gate, freshError: new Error('打印机缺纸') } });
  const background = harness.manager.ensureReady(DEVICE, { forceFresh: true, background: true });
  const joined = harness.manager.ensureReady(DEVICE, { forceFresh: true });

  assert.equal(joined, background, 'the same attempt is shared');
  assert.equal(harness.manager.getState().status, 'connecting');
  assert.equal(harness.manager.getState().background, false);
  release();
  await assert.rejects(joined, /缺纸/);
  assert.equal(harness.manager.getState().background, false, 'the failure is now the user\'s to see');
  assert.equal(harness.printer.connectCalls, 1);
});

test('a stronger user request restarts a weaker background attempt on the same printer at once', async () => {
  const harness = createHarness({ printerOptions: { hangingDevices: [DEVICE.deviceId] } });
  const background = harness.manager.ensureReady(DEVICE, { forceValidate: true, background: true });
  while (!harness.events.includes(`hang:${DEVICE.deviceId}`)) await tick();

  const forced = harness.manager.ensureReady(DEVICE, { forceFresh: true });
  await assert.rejects(background, (error) => error.code === 'CONNECT_CANCELLED' || error.code === 'CONNECT_SUPERSEDED');
  const result = await forced;
  assert.equal(result.source, 'force-fresh');
  assert.equal(harness.printer.connectCalls, 2);
  assert.equal(harness.manager.getState().status, 'connected');
});

test('link-loss reconnects run in the background and stop once the user picks another printer', async () => {
  const harness = createHarness({ autoReconnectDelayMs: 0 });
  harness.manager.bindStateListeners({ autoReconnect: true });
  await harness.manager.ensureReady(DEVICE);
  harness.printer.options.hangingDevices = [DEVICE.deviceId];

  harness.session.drop(DEVICE.deviceId);
  while (!harness.events.includes(`hang:${DEVICE.deviceId}`)) await tick();
  assert.equal(harness.manager.getState().status, 'connecting');
  assert.equal(harness.manager.getState().background, true);

  await harness.manager.ensureReady(OTHER, { forceFresh: true });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const reconnectsToOld = harness.events.filter((event) => event === `hang:${DEVICE.deviceId}`).length;
  assert.equal(reconnectsToOld, 1, 'the cancelled automatic attempt is not rescheduled');
  assert.equal(harness.manager.autoReconnectTimer, null);
  assert.equal(harness.manager.getState().device.deviceId, OTHER.deviceId);
  harness.manager.unbindStateListeners();
});

test('a user request clears a pending automatic retry, and a due retry skips a ready printer', async () => {
  const harness = createHarness({ autoReconnectDelayMs: 30 });
  harness.manager.bindStateListeners({ autoReconnect: true });
  await harness.manager.ensureReady(DEVICE);
  harness.session.drop(DEVICE.deviceId);
  assert.ok(harness.manager.autoReconnectTimer, 'a retry is scheduled after link loss');
  await harness.manager.ensureReady(DEVICE);
  assert.equal(harness.manager.autoReconnectTimer, null, 'the user request replaced it');

  harness.session.drop(DEVICE.deviceId);
  harness.api.adapterListener({ available: true });
  await tick();
  assert.equal(harness.manager.getState().status, 'connected');
  const calls = harness.printer.connectCalls;
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(harness.printer.connectCalls, calls, 'the due retry finds the printer ready and does nothing');
  harness.manager.unbindStateListeners();
});

test('a confirmed profile is stored with the saved printer and survives its reconnects', async () => {
  const storage = new MemoryStorage();
  const harness = createHarness({ storage });
  await harness.manager.ensureReady(DEVICE);

  assert.equal(harness.manager.confirmProfile('someone-else', 'escpos-80'), false);
  assert.equal(harness.manager.confirmProfile(DEVICE.deviceId, 'escpos-80'), true);
  assert.equal(harness.manager.getConfirmedProfileId(DEVICE.deviceId), 'escpos-80');
  assert.equal(harness.manager.getConfirmedProfileId(), 'escpos-80');
  assert.equal(harness.manager.getConfirmedProfileId('someone-else'), '');
  assert.equal(storage.getStorageSync(DEFAULT_DEVICE_STORAGE_KEY).confirmedProfileId, 'escpos-80');
  assert.equal(harness.manager.getState().device.confirmedProfileId, 'escpos-80');

  await harness.manager.ensureReady(DEVICE, { forceFresh: true });
  assert.equal(harness.manager.getConfirmedProfileId(DEVICE.deviceId), 'escpos-80', 'same printer keeps it');

  const relaunched = createHarness({ storage });
  assert.equal(relaunched.manager.getConfirmedProfileId(DEVICE.deviceId), 'escpos-80', 'it survives an app restart');
  await relaunched.manager.ensureReady(OTHER);
  assert.equal(relaunched.manager.getConfirmedProfileId(), '', 'another printer must be confirmed again');
  assert.equal(storage.getStorageSync(DEFAULT_DEVICE_STORAGE_KEY).confirmedProfileId, undefined);
});

test('a confirmation is dropped when cleared, forgotten, or another printer is connected', async () => {
  const harness = createHarness();
  await harness.manager.ensureReady(DEVICE);
  harness.manager.confirmProfile(DEVICE.deviceId, 'escpos-80');
  assert.equal(harness.manager.confirmProfile(DEVICE.deviceId, ''), true);
  assert.equal(harness.manager.getConfirmedProfileId(DEVICE.deviceId), '');

  harness.manager.confirmProfile(DEVICE.deviceId, 'escpos-80');
  await harness.manager.ensureReady(OTHER, { forceFresh: true });
  assert.equal(harness.manager.getConfirmedProfileId(), '', 'the other printer starts unconfirmed');
  await harness.manager.ensureReady(DEVICE, { forceFresh: true });
  assert.equal(harness.manager.getConfirmedProfileId(DEVICE.deviceId), '', 'switching back does not bring it back');

  harness.manager.confirmProfile(DEVICE.deviceId, 'escpos-80');
  await harness.manager.forget();
  assert.equal(harness.manager.getConfirmedProfileId(DEVICE.deviceId), '');
  assert.equal(harness.manager.confirmProfile(DEVICE.deviceId, 'escpos-80'), false, 'nothing is saved any more');
});

test('diagnose reports a code pages can explain', async () => {
  const harness = createHarness({ printerOptions: { freshError: Object.assign(new Error('x'), { code: 10003 }) } });
  const failed = await harness.manager.diagnose(DEVICE);
  assert.equal(failed.errorCode, '10003');
  const none = await createHarness().manager.diagnose();
  assert.equal(none.errorCode, 'DEVICE_INCOMPLETE');
  const busy = createHarness();
  busy.printer.printing = true;
  assert.equal((await busy.manager.diagnose(DEVICE)).errorCode, 'PRINT_IN_PROGRESS');
  const ok = await createHarness().manager.diagnose(DEVICE);
  assert.equal(ok.errorCode, '');
});

function loadApp(wxApi) {
  let definition = null;
  global.App = (value) => { definition = value; };
  global.wx = wxApi;
  const appPath = require.resolve('../miniprogram/app.js');
  delete require.cache[appPath];
  try {
    require(appPath);
  } finally {
    delete global.App;
  }
  return definition;
}

function appWx(storage, extra) {
  return Object.assign({
    getStorageSync: (key) => storage.getStorageSync(key),
    setStorageSync: (key, value) => storage.setStorageSync(key, value),
    removeStorageSync: (key) => storage.removeStorageSync(key),
    getStorageInfoSync: () => ({ keys: Object.keys(storage.values) }),
    onBluetoothAdapterStateChange() {},
    showModal() {}
  }, extra || {});
}

test('app launch reconnects the remembered printer as a background attempt', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = new MemoryStorage({ 'niim-label:last-device': DEVICE });
  const app = loadApp(appWx(storage));
  try {
    app.onLaunch();
    const calls = [];
    app.globalData.connectionManager.ensureReady = (device, options) => {
      calls.push({ device, options });
      return Promise.resolve();
    };
    t.mock.timers.tick(800);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].device.deviceId, DEVICE.deviceId);
    assert.deepEqual(calls[0].options, { forceFresh: true, background: true });
  } finally {
    delete global.wx;
  }
});

test('a downloaded update asks before restarting and applies only on confirm', () => {
  const modals = [];
  let readyListener = null;
  let applied = 0;
  const app = loadApp(appWx(new MemoryStorage(), {
    showModal: (options) => modals.push(options),
    getUpdateManager: () => ({
      onUpdateReady: (listener) => { readyListener = listener; },
      onUpdateFailed() {},
      applyUpdate: () => { applied += 1; }
    })
  }));
  try {
    app.onLaunch();
    assert.equal(typeof readyListener, 'function');
    readyListener();
    assert.equal(modals.length, 1);
    assert.equal(modals[0].content, '新版本已准备好，重启后生效。现在重启吗？');
    assert.equal(modals[0].confirmColor, '#E02D26');
    modals[0].success({ confirm: false });
    assert.equal(applied, 0);
    modals[0].success({ confirm: true });
    assert.equal(applied, 1);
  } finally {
    delete global.wx;
  }
});

test('the update prompt waits for a running print job', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const modals = [];
  let readyListener = null;
  const app = loadApp(appWx(new MemoryStorage(), {
    showModal: (options) => modals.push(options),
    getUpdateManager: () => ({ onUpdateReady: (listener) => { readyListener = listener; }, applyUpdate() {} })
  }));
  try {
    app.onLaunch();
    app.globalData.printerClient.printing = true;
    readyListener();
    assert.equal(modals.length, 0, 'no restart prompt in the middle of a print');
    app.globalData.printerClient.printing = false;
    t.mock.timers.tick(5000);
    assert.equal(modals.length, 1);
  } finally {
    delete global.wx;
  }
});

test('app launch survives a host without an update manager', () => {
  const app = loadApp(appWx(new MemoryStorage()));
  try {
    assert.doesNotThrow(() => app.onLaunch());
    assert.ok(app.globalData.connectionManager);
  } finally {
    delete global.wx;
  }
});
