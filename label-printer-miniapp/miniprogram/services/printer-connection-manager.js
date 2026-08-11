const { sleep } = require('../core/bytes');
const {
  BleSession,
  PRIMARY_SERVICE,
  callWx
} = require('./ble-session');
const { PrinterClient } = require('./printer-client');

// UI integration surface:
//   ensureReady(device?, opts)  GATT + notify + NIIMBOT handshake, with single-flight reuse
//   reconnect(device?, opts)    validate/redetect an existing link; opts.forceFresh hard-resets it
//   disconnect({ forget? })     close the link, optionally remove the persisted binding
//   diagnose(device?)           non-printing transport/protocol report (it never sends print rows)
//   bindStateListeners()/subscribe() bridge adapter/link state to pages without owning page UI

const DEFAULT_DEVICE_STORAGE_KEY = 'label-printer:last-device';
const DEFAULT_KILL_SWITCH_KEY = 'ble_reconnect_off';
const DEFAULT_SESSION_TTL_MS = 120000;
const DEFAULT_FAST_REUSE_TTL_MS = 5000;
const DEFAULT_REOPEN_DELAY_MS = 250;

function codedError(code, message, cause) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

function deviceName(device) {
  return device && (device.displayName || device.name || device.localName) || '未知设备';
}

function copy(value) {
  return value && typeof value === 'object' ? Object.assign({}, value) : value;
}

class PrinterConnectionManager {
  constructor(options) {
    const config = options || {};
    this.session = config.session || new BleSession(config.api);
    this.api = config.api || this.session.api || (typeof wx !== 'undefined' ? wx : null);
    this.printer = config.printer || new PrinterClient(this.session);
    this.storage = config.storage || this.api;
    this.deviceStorageKey = config.deviceStorageKey || DEFAULT_DEVICE_STORAGE_KEY;
    this.killSwitchKey = config.killSwitchKey || DEFAULT_KILL_SWITCH_KEY;
    this.sessionTtlMs = Number(config.sessionTtlMs) >= 0
      ? Number(config.sessionTtlMs)
      : DEFAULT_SESSION_TTL_MS;
    this.fastReuseTtlMs = Number(config.fastReuseTtlMs) >= 0
      ? Number(config.fastReuseTtlMs)
      : DEFAULT_FAST_REUSE_TTL_MS;
    this.reopenDelayMs = Number(config.reopenDelayMs) >= 0
      ? Number(config.reopenDelayMs)
      : DEFAULT_REOPEN_DELAY_MS;
    this.autoReconnectDelayMs = Number(config.autoReconnectDelayMs) >= 0
      ? Number(config.autoReconnectDelayMs)
      : 800;
    this.autoReconnectMaxAttempts = Number(config.autoReconnectMaxAttempts) > 0
      ? Number(config.autoReconnectMaxAttempts)
      : 3;
    this.now = typeof config.now === 'function' ? config.now : () => Date.now();
    this.wait = typeof config.wait === 'function' ? config.wait : sleep;
    this.inflight = new Map();
    this.inflightOptions = new Map();
    this.cache = new Map();
    this.subscribers = [];
    this.adapterListener = null;
    this.adapterOptions = null;
    this.autoReconnectTimer = null;
    this.autoReconnectAttempt = 0;
    this.manualDisconnecting = false;
    this.connectionEpoch = 0;
    this.state = {
      status: 'disconnected',
      device: null,
      source: '',
      error: ''
    };
    this.savedDevice = this.loadSavedDevice();
    this.removeConnectionListener = this.session.onConnectionStateChange
      ? this.session.onConnectionStateChange((event) => this.handleConnectionState(event))
      : null;
  }

  loadSavedDevice() {
    try {
      if (!this.storage || typeof this.storage.getStorageSync !== 'function') return null;
      const stored = this.storage.getStorageSync(this.deviceStorageKey);
      return stored && stored.deviceId ? copy(stored) : null;
    } catch (error) {
      return null;
    }
  }

  getSavedDevice() {
    return copy(this.savedDevice);
  }

  persistDevice(device, result) {
    const saved = {
      deviceId: result.deviceId || device.deviceId,
      name: result.name || deviceName(device),
      displayName: result.name || deviceName(device),
      serviceId: result.serviceId || device.serviceId || PRIMARY_SERVICE,
      writeCharacteristicId: result.writeCharacteristicId || device.writeCharacteristicId || '',
      notifyCharacteristicId: result.notifyCharacteristicId || device.notifyCharacteristicId || '',
      writeType: result.writeType || device.writeType || '',
      mtu: Number(result.mtu) || 23,
      maxWriteSize: Number(result.maxWriteSize) || 20,
      modelId: result.modelId == null ? device.modelId : result.modelId,
      protocolVersion: result.protocolVersion == null ? device.protocolVersion : result.protocolVersion,
      profileId: device.profileId || ''
    };
    this.savedDevice = saved;
    try {
      if (this.storage && typeof this.storage.setStorageSync === 'function') {
        this.storage.setStorageSync(this.deviceStorageKey, saved);
      }
    } catch (error) {
      // A valid live connection must not be discarded because persistence failed.
    }
    return copy(saved);
  }

  clearSavedDevice() {
    this.savedDevice = null;
    try {
      if (this.storage && typeof this.storage.removeStorageSync === 'function') {
        this.storage.removeStorageSync(this.deviceStorageKey);
      } else if (this.storage && typeof this.storage.setStorageSync === 'function') {
        this.storage.setStorageSync(this.deviceStorageKey, '');
      }
    } catch (error) {
      // The in-memory binding is still cleared even if storage is unavailable.
    }
  }

  isDisabled() {
    try {
      return Boolean(this.storage
        && typeof this.storage.getStorageSync === 'function'
        && this.storage.getStorageSync(this.killSwitchKey));
    } catch (error) {
      return false;
    }
  }

  setDisabled(disabled) {
    try {
      if (!this.storage) return;
      if (disabled && typeof this.storage.setStorageSync === 'function') {
        this.storage.setStorageSync(this.killSwitchKey, true);
      } else if (!disabled && typeof this.storage.removeStorageSync === 'function') {
        this.storage.removeStorageSync(this.killSwitchKey);
      } else if (!disabled && typeof this.storage.setStorageSync === 'function') {
        this.storage.setStorageSync(this.killSwitchKey, '');
      }
    } catch (error) {
      // The switch is best-effort on hosts without persistent storage.
    }
    if (disabled) {
      this.connectionEpoch += 1;
      this.cache.clear();
      this.clearAutoReconnect();
    }
  }

  enable() {
    this.setDisabled(false);
  }

  disable() {
    this.setDisabled(true);
  }

  getState() {
    return {
      status: this.state.status,
      device: copy(this.state.device),
      source: this.state.source,
      error: this.state.error
    };
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.subscribers.push(listener);
    return () => {
      this.subscribers = this.subscribers.filter((item) => item !== listener);
    };
  }

  emitState(next) {
    this.state = Object.assign({}, this.state, next || {});
    const snapshot = this.getState();
    this.subscribers.slice().forEach((listener) => {
      try {
        listener(snapshot);
      } catch (error) {
        // A page subscriber must not break the connection state machine.
      }
    });
  }

  handleConnectionState(event) {
    if (!event || event.connected !== false) return;
    this.connectionEpoch += 1;
    this.cache.delete(event.deviceId);
    if (this.printer.invalidateConnection) this.printer.invalidateConnection();
    this.emitState({
      status: 'disconnected',
      device: null,
      source: 'link-lost',
      error: '打印机连接已断开'
    });
    if (!this.manualDisconnecting) this.scheduleAutoReconnect();
  }

  clearAutoReconnect() {
    if (this.autoReconnectTimer) clearTimeout(this.autoReconnectTimer);
    this.autoReconnectTimer = null;
  }

  scheduleAutoReconnect(delayMs) {
    if (!this.adapterOptions || !this.adapterOptions.autoReconnect || this.manualDisconnecting) return;
    const device = this.getSavedDevice();
    if (!device || this.isDisabled() || this.autoReconnectAttempt >= this.autoReconnectMaxAttempts) return;
    this.clearAutoReconnect();
    const delay = Number(delayMs) >= 0 ? Number(delayMs) : this.autoReconnectDelayMs;
    this.autoReconnectTimer = setTimeout(async () => {
      this.autoReconnectTimer = null;
      if (this.manualDisconnecting) return;
      if (this.printer.printing) {
        this.scheduleAutoReconnect(1000);
        return;
      }
      this.autoReconnectAttempt += 1;
      try {
        await this.ensureReady(device, { forceValidate: true });
        this.autoReconnectAttempt = 0;
      } catch (error) {
        this.scheduleAutoReconnect(Math.min(4000, this.autoReconnectDelayMs * (this.autoReconnectAttempt + 1)));
      }
    }, delay);
  }

  bindStateListeners(options) {
    if (this.adapterListener || !this.api || !this.api.onBluetoothAdapterStateChange) return;
    this.adapterOptions = Object.assign({ autoReconnect: true }, options || {});
    this.adapterListener = (event) => {
      const available = Boolean(event && event.available);
      if (!available) {
        this.connectionEpoch += 1;
        this.clearAutoReconnect();
        this.cache.clear();
        if (this.printer.invalidateConnection) this.printer.invalidateConnection();
        this.emitState({ status: 'disconnected', device: null, source: 'adapter-off', error: '手机蓝牙已关闭' });
        return;
      }
      this.emitState({ source: 'adapter-on', error: '' });
      if (this.adapterOptions.autoReconnect) {
        const device = this.getSavedDevice();
        if (device) {
          this.autoReconnectAttempt = 0;
          this.ensureReady(device, { forceValidate: true }).catch(() => this.scheduleAutoReconnect());
        }
      }
    };
    this.api.onBluetoothAdapterStateChange(this.adapterListener);
  }

  unbindStateListeners() {
    if (!this.adapterListener) return;
    if (this.api && this.api.offBluetoothAdapterStateChange) {
      this.api.offBluetoothAdapterStateChange(this.adapterListener);
    }
    this.adapterListener = null;
    this.adapterOptions = null;
    this.clearAutoReconnect();
    this.autoReconnectAttempt = 0;
  }

  ensureReady(device, options) {
    const target = copy(device || this.savedDevice);
    const requested = options || {};
    if (!target || !target.deviceId) {
      return Promise.reject(codedError('DEVICE_INCOMPLETE', '没有可连接的打印机'));
    }
    if (this.isDisabled() && !requested.ignoreKillSwitch) {
      return Promise.reject(codedError('BLE_RECONNECT_OFF', '稳定连接已关闭，请重新扫描并使用原连接流程'));
    }
    if (this.printer.printing) {
      return Promise.reject(codedError('PRINT_IN_PROGRESS', '打印任务进行中，暂不能连接、重连或诊断'));
    }
    if (this.inflight.has(target.deviceId)) {
      const current = this.inflight.get(target.deviceId);
      const active = this.inflightOptions.get(target.deviceId) || {};
      const satisfiesForce = (!requested.forceFresh || active.forceFresh)
        && (!requested.forceValidate || active.forceValidate || active.forceFresh);
      if (satisfiesForce) return current;
      const retry = () => this.ensureReady(target, requested);
      return current.then(retry, retry);
    }
    if (this.inflight.size) {
      return Promise.reject(codedError('CONNECT_BUSY', '另一台打印机正在连接，请稍后重试'));
    }
    const epoch = this.connectionEpoch;
    const task = this.doEnsureReady(target, requested, epoch);
    this.inflight.set(target.deviceId, task);
    this.inflightOptions.set(target.deviceId, copy(requested));
    const clear = () => {
      if (this.inflight.get(target.deviceId) === task) {
        this.inflight.delete(target.deviceId);
        this.inflightOptions.delete(target.deviceId);
      }
    };
    task.then(clear, clear);
    return task;
  }

  async abortIfSuperseded(epoch, deviceId) {
    if (epoch === this.connectionEpoch) return;
    if (this.printer.invalidateConnection) this.printer.invalidateConnection();
    await this.session.disconnect(deviceId);
    throw codedError('CONNECT_SUPERSEDED', '连接操作已被断开或蓝牙状态变化取消');
  }

  async doEnsureReady(device, options, epoch) {
    this.emitState({ status: 'connecting', device: copy(device), source: '', error: '' });
    try {
      await this.session.open();
      await this.abortIfSuperseded(epoch, device.deviceId);
      if (options.forceFresh) {
        await this.closeForRecovery(device.deviceId);
        await this.abortIfSuperseded(epoch, device.deviceId);
        const result = await this.connectFresh(device);
        await this.abortIfSuperseded(epoch, device.deviceId);
        return this.finishConnection(device, result, 'force-fresh');
      }

      const cached = this.cache.get(device.deviceId);
      const age = cached ? this.now() - cached.at : Infinity;
      if (!options.forceValidate && this.isReadyFor(device.deviceId)
        && cached && age <= this.fastReuseTtlMs) {
        return this.reuseConnection(cached, 'fast-reuse');
      }

      const systemConnected = await this.querySystemConnection(device);
      await this.abortIfSuperseded(epoch, device.deviceId);
      if (!options.forceValidate && this.isReadyFor(device.deviceId)
        && cached && age <= this.sessionTtlMs
        && systemConnected !== false) {
        return this.reuseConnection(cached, systemConnected ? 'system-reuse' : 'memory-reuse');
      }

      if (systemConnected || (systemConnected == null && this.session.connected
        && this.session.deviceId === device.deviceId)) {
        try {
          const result = await this.connectExisting(device);
          await this.abortIfSuperseded(epoch, device.deviceId);
          return this.finishConnection(device, result, 'rediscovered');
        } catch (error) {
          if (error && error.code === 'CONNECT_SUPERSEDED') throw error;
          await this.closeForRecovery(device.deviceId);
          await this.abortIfSuperseded(epoch, device.deviceId);
          const result = await this.connectFresh(device);
          await this.abortIfSuperseded(epoch, device.deviceId);
          return this.finishConnection(device, result, 'zombie-recovered');
        }
      }

      try {
        const result = await this.connectFresh(device);
        await this.abortIfSuperseded(epoch, device.deviceId);
        return this.finishConnection(device, result, 'fresh');
      } catch (error) {
        if (error && error.code === 'CONNECT_SUPERSEDED') throw error;
        if (!error || !error.retryFresh) throw error;
        await this.closeForRecovery(device.deviceId);
        await this.abortIfSuperseded(epoch, device.deviceId);
        const result = await this.connectFresh(device);
        await this.abortIfSuperseded(epoch, device.deviceId);
        return this.finishConnection(device, result, 'already-recovered');
      }
    } catch (error) {
      if (epoch === this.connectionEpoch) {
        this.emitState({
          status: 'disconnected',
          device: null,
          source: 'error',
          error: error && error.message ? error.message : '连接失败'
        });
      }
      throw error;
    }
  }

  isReadyFor(deviceId) {
    return Boolean(this.session.connected
      && this.printer.ready
      && this.session.deviceId === deviceId
      && (!this.printer.deviceId || this.printer.deviceId === deviceId));
  }

  async querySystemConnection(device) {
    if (!this.api || typeof this.api.getConnectedBluetoothDevices !== 'function') return null;
    try {
      const result = await callWx(this.api, 'getConnectedBluetoothDevices', {
        services: [device.serviceId || PRIMARY_SERVICE]
      });
      return (result.devices || []).some((item) => item.deviceId === device.deviceId);
    } catch (error) {
      return null;
    }
  }

  async connectFresh(device) {
    return this.printer.connect(device);
  }

  async connectExisting(device) {
    if (this.printer.connectExisting) return this.printer.connectExisting(device);
    return this.printer.connect(device, { existing: true });
  }

  async closeForRecovery(deviceId) {
    this.cache.delete(deviceId);
    if (this.printer.invalidateConnection) this.printer.invalidateConnection();
    await this.session.disconnect(deviceId);
    if (this.reopenDelayMs > 0) await this.wait(this.reopenDelayMs);
  }

  finishConnection(device, result, source) {
    const complete = Object.assign({}, result, { source, reused: false });
    this.cache.set(device.deviceId, { result: complete, at: this.now() });
    const saved = this.persistDevice(device, complete);
    this.autoReconnectAttempt = 0;
    this.emitState({ status: 'connected', device: saved, source, error: '' });
    return complete;
  }

  reuseConnection(cached, source) {
    cached.at = this.now();
    cached.result = Object.assign({}, cached.result, { source, reused: true });
    this.emitState({
      status: 'connected',
      device: this.getSavedDevice() || { deviceId: cached.result.deviceId, name: cached.result.name },
      source,
      error: ''
    });
    return cached.result;
  }

  touch(device) {
    const deviceId = device && device.deviceId || device;
    const cached = this.cache.get(deviceId);
    if (cached) cached.at = this.now();
  }

  reconnect(device, options) {
    const target = device || this.savedDevice;
    if (target && target.deviceId) this.cache.delete(target.deviceId);
    return this.ensureReady(target, Object.assign({ forceValidate: true }, options || {}));
  }

  async disconnect(options) {
    const config = options || {};
    const deviceId = config.deviceId
      || this.session.deviceId
      || this.savedDevice && this.savedDevice.deviceId;
    this.manualDisconnecting = true;
    this.connectionEpoch += 1;
    this.clearAutoReconnect();
    try {
      if (deviceId) this.cache.delete(deviceId);
      if (this.printer.invalidateConnection) this.printer.invalidateConnection();
      await this.session.disconnect(deviceId);
      if (config.forget) this.clearSavedDevice();
      this.emitState({ status: 'disconnected', device: null, source: 'manual', error: '' });
    } finally {
      this.manualDisconnecting = false;
      this.autoReconnectAttempt = 0;
    }
  }

  async forget(deviceId) {
    await this.disconnect({ deviceId, forget: true });
  }

  async diagnose(device) {
    const target = copy(device || this.savedDevice);
    const report = {
      adapterOk: false,
      systemConnected: false,
      transportReady: false,
      protocolReady: false,
      deviceId: target && target.deviceId || '',
      serviceId: '',
      writeCharacteristicId: '',
      notifyCharacteristicId: '',
      writeType: '',
      mtu: 0,
      maxWriteSize: 0,
      modelId: null,
      protocolVersion: 0,
      source: '',
      error: ''
    };
    if (!target || !target.deviceId) {
      report.error = '没有可诊断的打印机';
      return report;
    }
    if (this.isDisabled()) {
      report.error = '稳定连接已被 kill switch 关闭';
      return report;
    }
    if (this.printer.printing) {
      report.error = '打印任务进行中，暂不能连接、重连或诊断';
      return report;
    }
    try {
      await this.session.open();
      report.adapterOk = true;
      report.systemConnected = (await this.querySystemConnection(target)) === true;
      const result = await this.ensureReady(target, { forceValidate: true });
      report.transportReady = Boolean(this.session.connected);
      report.protocolReady = Boolean(this.printer.ready);
      report.serviceId = result.serviceId || '';
      report.writeCharacteristicId = result.writeCharacteristicId || '';
      report.notifyCharacteristicId = result.notifyCharacteristicId || '';
      report.writeType = result.writeType || '';
      report.mtu = Number(result.mtu) || 0;
      report.maxWriteSize = Number(result.maxWriteSize) || 0;
      report.modelId = result.modelId == null ? null : result.modelId;
      report.protocolVersion = Number(result.protocolVersion) || 0;
      report.source = result.source || '';
    } catch (error) {
      report.error = error && error.message ? error.message : String(error);
    }
    return report;
  }

  async close() {
    this.manualDisconnecting = true;
    this.connectionEpoch += 1;
    this.clearAutoReconnect();
    this.unbindStateListeners();
    if (this.removeConnectionListener) {
      this.removeConnectionListener();
      this.removeConnectionListener = null;
    }
    this.cache.clear();
    this.inflight.clear();
    this.inflightOptions.clear();
    if (this.printer.invalidateConnection) this.printer.invalidateConnection();
    await this.session.close();
  }
}

module.exports = {
  DEFAULT_DEVICE_STORAGE_KEY,
  DEFAULT_FAST_REUSE_TTL_MS,
  DEFAULT_KILL_SWITCH_KEY,
  DEFAULT_REOPEN_DELAY_MS,
  DEFAULT_SESSION_TTL_MS,
  PrinterConnectionManager,
  codedError
};
