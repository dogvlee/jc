const { sleep } = require('../core/bytes');
const { NOT_A_PRINTER } = require('./ble-errors');

const PRIMARY_SERVICE = 'e7810a71-73ae-499d-8c15-faa9aef0c3f2';
const PRIMARY_WRITE_CHARACTERISTIC = 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f';
const PRIMARY_NOTIFY_CHARACTERISTIC = 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9e';
function callWx(api, method, options) {
  return new Promise((resolve, reject) => {
    api[method](Object.assign({}, options, {
      success: resolve,
      fail: (error) => {
        const message = error && (error.errMsg || error.message) ? (error.errMsg || error.message) : `${method} 调用失败`;
        const wrapped = new Error(message);
        wrapped.code = error && error.errCode;
        wrapped.cause = error;
        reject(wrapped);
      }
    }));
  });
}

function withTimeout(promise, timeoutMs, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    }, (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function supportsWrite(characteristic) {
  const properties = characteristic.properties || {};
  return properties.write || properties.writeNoResponse;
}

function supportsNotify(characteristic) {
  const properties = characteristic.properties || {};
  return properties.notify || properties.indicate;
}

function sameUuid(left, right) {
  return String(left || '').toLowerCase() === String(right || '').toLowerCase();
}

// Services every BLE device has (generic access/attribute, device info,
// battery); no printer takes print data through them.
const INFRASTRUCTURE_SERVICES = ['1800', '1801', '180a', '180f'];

function isInfrastructureService(uuid) {
  const value = String(uuid || '').toLowerCase();
  return INFRASTRUCTURE_SERVICES.some((short) => value === short
    || value === `0000${short}-0000-1000-8000-00805f9b34fb`);
}

// The E781 printer-module service first (NIIMBOT and many generic thermal
// printers use it), then the channel that worked for this printer before,
// then any other service, primary ones first.
function serviceRank(service, device) {
  if (sameUuid(service.uuid, PRIMARY_SERVICE)) return 3;
  if (device && device.serviceId && sameUuid(service.uuid, device.serviceId)) return 2;
  return service.isPrimary ? 1 : 0;
}

/**
 * The characteristics a printer takes print data on and answers on in one
 * service: { write, notify }, notify null when nothing in the service can
 * answer, or null when nothing can be written. E781 printer modules answer
 * on the same 9f characteristic they are written to; any other printer gets
 * the characteristic that both writes and notifies, else a writable one
 * plus a notifying one. A channel remembered for this printer comes first.
 */
function channelIn(serviceId, characteristics, device) {
  const find = (uuid, test) => uuid && characteristics.find((item) => sameUuid(item.uuid, uuid) && test(item));
  const remembered = device && device.serviceId && sameUuid(serviceId, device.serviceId);
  if (remembered) {
    const write = find(device.writeCharacteristicId, supportsWrite);
    const notify = find(device.notifyCharacteristicId, supportsNotify);
    if (write && notify) return { write, notify };
  }
  const niimbot = sameUuid(serviceId, PRIMARY_SERVICE);
  const both = characteristics.find((item) => supportsWrite(item) && supportsNotify(item));
  const write = (niimbot && find(PRIMARY_WRITE_CHARACTERISTIC, supportsWrite))
    || both
    || characteristics.find(supportsWrite);
  if (!write) return null;
  const notify = (supportsNotify(write) && write)
    || (niimbot && find(PRIMARY_NOTIFY_CHARACTERISTIC, supportsNotify))
    || characteristics.find(supportsNotify);
  return { write, notify: notify || null };
}

function isAlreadyConnectedError(error) {
  const message = error && (error.message || (error.cause && error.cause.errMsg));
  return /already\s*connect(?:ed)?/i.test(String(message || ''));
}

function cancelledError() {
  const error = new Error('连接已取消');
  error.code = 'CONNECT_CANCELLED';
  return error;
}

function staleTransportError() {
  const error = new Error('蓝牙连接在初始化期间已失效');
  error.code = 'TRANSPORT_RESET';
  return error;
}

// WeChat's "no connection" (10006) and "no device" (10002): the link itself
// is gone, unlike a service or characteristic the device does not offer.
function isLinkGone(error) {
  const code = error && (error.code != null ? error.code : error.errCode);
  return code === 10006 || code === 10002 || code === 'TRANSPORT_RESET' || code === 'CONNECT_CANCELLED';
}

function noChannelError() {
  const error = new Error(NOT_A_PRINTER);
  error.code = 'NO_PRINT_CHANNEL';
  return error;
}

class BleSession {
  constructor(api) {
    this.api = api || wx;
    this.deviceId = '';
    this.deviceName = '';
    this.serviceId = '';
    this.writeCharacteristic = null;
    this.notifyCharacteristic = null;
    this.queue = Promise.resolve();
    this.scanListener = null;
    this.scanGeneration = 0;
    this.scanQueue = Promise.resolve();
    this.connectionStateListeners = [];
    this.transportResetListeners = [];
    this.connected = false;
    this.mtu = 23;
    this.maxWriteSize = 20;
    this.writeDelayMs = 10;
    this.connectionListener = this.handleConnectionChange.bind(this);
    this.mtuListener = this.handleMtuChange.bind(this);
    this.transportListenersBound = false;
    this.transportGeneration = 0;
    this.operationTimeoutMs = 8000;
    this.discoveryRetryDelaysMs = [500, 1000];
    this.connectAttempt = null;
  }

  call(method, options, timeoutMs) {
    return withTimeout(
      callWx(this.api, method, options),
      Number(timeoutMs) || this.operationTimeoutMs,
      `${method} 超时`
    );
  }

  async open() {
    try {
      await this.call('openBluetoothAdapter', { mode: 'central' }, 6000);
    } catch (error) {
      if (/already/i.test(String(error && error.message || ''))) {
        return;
      }
      if (error.code !== 10001) {
        throw error;
      }
      const unavailable = new Error('请打开手机蓝牙后重试；安卓手机还需要打开定位服务');
      unavailable.code = 'BLUETOOTH_UNAVAILABLE';
      unavailable.errCode = 10001;
      // iOS reports why: 3 = WeChat lacks Bluetooth permission, 4 = switched off.
      if (error.cause && error.cause.state != null) unavailable.state = error.cause.state;
      unavailable.cause = error;
      throw unavailable;
    }
  }

  scan(onDevices) {
    const generation = ++this.scanGeneration;
    const run = () => this.startScan(generation, onDevices);
    const task = this.scanQueue.then(run, run);
    this.scanQueue = task.catch(() => undefined);
    return task;
  }

  async startScan(generation, onDevices) {
    await this.open();
    if (generation !== this.scanGeneration) return;
    await this.stopScanTransport();
    if (generation !== this.scanGeneration) return;
    const devices = new Map();
    const listener = (event) => {
      if (generation !== this.scanGeneration || this.scanListener !== listener) return;
      (event.devices || []).forEach((device) => {
        const name = device.name || device.localName || '';
        if (name) {
          devices.set(device.deviceId, Object.assign({}, device, { displayName: name }));
        }
      });
      onDevices(Array.from(devices.values()).sort((left, right) => (right.RSSI || -100) - (left.RSSI || -100)));
    };
    this.scanListener = listener;
    this.api.onBluetoothDeviceFound(listener);
    try {
      await this.call('startBluetoothDevicesDiscovery', {
        allowDuplicatesKey: false,
        interval: 300
      }, this.operationTimeoutMs);
    } catch (error) {
      if (this.scanListener === listener) {
        if (this.api.offBluetoothDeviceFound) this.api.offBluetoothDeviceFound(listener);
        this.scanListener = null;
      }
      throw error;
    }
  }

  stopScan() {
    this.scanGeneration += 1;
    const task = this.scanQueue.then(
      () => this.stopScanTransport(),
      () => this.stopScanTransport()
    );
    this.scanQueue = task.catch(() => undefined);
    return task;
  }

  async stopScanTransport() {
    if (this.scanListener && this.api.offBluetoothDeviceFound) {
      this.api.offBluetoothDeviceFound(this.scanListener);
      this.scanListener = null;
    }
    try {
      await this.call('stopBluetoothDevicesDiscovery', {}, 4000);
    } catch (error) {
      // Stopping an inactive scan is harmless on both platforms.
    }
  }

  async connect(device) {
    const attempt = this.beginConnectAttempt(device);
    try {
      return await this.connectTransport(device, attempt);
    } catch (error) {
      // Whoever cancelled the attempt already closed its link, and the
      // session may belong to the next printer by now.
      if (attempt.cancelled) throw cancelledError();
      await this.closeTransport();
      throw error;
    } finally {
      this.endConnectAttempt(attempt);
    }
  }

  async connectTransport(device, attempt) {
    await this.stopScan();
    this.assertAttemptActive(attempt);
    if (this.connected || this.deviceId) {
      await this.closeTransport();
    }
    this.assertAttemptActive(attempt);
    this.setDevice(device);
    let alreadyConnected = false;
    try {
      await this.createConnection(attempt);
    } catch (error) {
      if (!isAlreadyConnectedError(error)) {
        throw error;
      }
      alreadyConnected = true;
    }
    this.assertAttemptActive(attempt);
    this.bindTransportListeners();
    try {
      return await this.setupConnectedTransport(device);
    } catch (error) {
      if (alreadyConnected) {
        error.retryFresh = true;
      }
      throw error;
    }
  }

  async connectExisting(device) {
    const attempt = this.beginConnectAttempt(device);
    try {
      await this.stopScan();
      this.assertAttemptActive(attempt);
      if (this.deviceId && this.deviceId !== device.deviceId) {
        await this.closeTransport();
      }
      this.assertAttemptActive(attempt);
      this.setDevice(device);
      this.bindTransportListeners();
      return await this.setupConnectedTransport(device);
    } catch (error) {
      if (attempt.cancelled) throw cancelledError();
      error.retryFresh = true;
      await this.closeTransport(device && device.deviceId);
      throw error;
    } finally {
      this.endConnectAttempt(attempt);
    }
  }

  // One connect at a time owns the transport, and disconnect() cancels it: a
  // printer that is switched off must not hold the session for the whole
  // createBLEConnection timeout when the user picks another one.
  beginConnectAttempt(device) {
    this.cancelConnectAttempt();
    const attempt = { deviceId: device && device.deviceId || '', cancelled: false, onCancel: null };
    this.connectAttempt = attempt;
    return attempt;
  }

  cancelConnectAttempt() {
    const attempt = this.connectAttempt;
    if (!attempt) return;
    this.connectAttempt = null;
    attempt.cancelled = true;
    if (attempt.onCancel) attempt.onCancel();
  }

  endConnectAttempt(attempt) {
    if (this.connectAttempt === attempt) this.connectAttempt = null;
  }

  assertAttemptActive(attempt) {
    if (attempt && attempt.cancelled) throw cancelledError();
  }

  createConnection(attempt) {
    const deviceId = this.deviceId;
    return new Promise((resolve, reject) => {
      let settled = false;
      const cancel = () => {
        if (settled) return;
        settled = true;
        reject(cancelledError());
      };
      if (attempt) attempt.onCancel = cancel;
      const release = () => {
        if (attempt && attempt.onCancel === cancel) attempt.onCancel = null;
      };
      this.call('createBLEConnection', { deviceId, timeout: 12000 }, 15000).then((value) => {
        release();
        if (!settled) {
          settled = true;
          resolve(value);
        } else if (this.deviceId !== deviceId) {
          // The platform opened a link after we gave up on it; close it unless
          // the session has started using the same printer again.
          this.call('closeBLEConnection', { deviceId }, 4000).catch(() => undefined);
        }
      }, (error) => {
        release();
        if (settled) return;
        settled = true;
        reject(error);
      });
    });
  }

  setDevice(device) {
    if (!device || !device.deviceId) {
      const error = new Error('缺少蓝牙设备 ID');
      error.code = 'DEVICE_INCOMPLETE';
      throw error;
    }
    this.deviceId = device.deviceId;
    this.deviceName = device.displayName || device.name || device.localName || '未知设备';
  }

  bindTransportListeners() {
    if (this.transportListenersBound) {
      return;
    }
    if (this.api.onBLEConnectionStateChange) {
      this.api.onBLEConnectionStateChange(this.connectionListener);
    }
    if (this.api.onBLEMTUChange) {
      this.api.onBLEMTUChange(this.mtuListener);
    }
    this.transportListenersBound = true;
  }

  unbindTransportListeners() {
    if (!this.transportListenersBound) {
      return;
    }
    if (this.api.offBLEConnectionStateChange) {
      this.api.offBLEConnectionStateChange(this.connectionListener);
    }
    if (this.api.offBLEMTUChange) {
      this.api.offBLEMTUChange(this.mtuListener);
    }
    this.transportListenersBound = false;
  }

  async setupConnectedTransport(device) {
    const generation = ++this.transportGeneration;
    this.connected = false;
    this.serviceId = '';
    this.writeCharacteristic = null;
    this.notifyCharacteristic = null;
    this.mtu = 23;
    this.maxWriteSize = 20;

    // Every device whose link opens stays connected. One without a channel
    // to take print data says so when something is printed (writeRaw).
    let channel = null;
    try {
      channel = await this.discoverChannel(device);
      // Some phones list a printer's services, or their characteristics,
      // only a moment after the link opens.
      for (let round = 0; !channel && round < this.discoveryRetryDelaysMs.length; round += 1) {
        await sleep(this.discoveryRetryDelaysMs[round]);
        if (generation !== this.transportGeneration || !this.deviceId) throw staleTransportError();
        channel = (await this.discoverChannel(device)) || channel;
      }
    } catch (error) {
      if (generation !== this.transportGeneration || !this.deviceId || isLinkGone(error)) throw error;
    }

    if (channel) {
      this.serviceId = channel.serviceId;
      this.writeCharacteristic = channel.write;
      this.notifyCharacteristic = channel.notify;
      await this.negotiateMtu();
      if (this.notifyCharacteristic) await this.enableNotifications();
    }
    await sleep(150);
    if (generation !== this.transportGeneration || !this.deviceId) throw staleTransportError();
    this.connected = true;
    return {
      deviceId: this.deviceId,
      name: this.deviceName,
      serviceId: this.serviceId,
      writeCharacteristicId: this.writeCharacteristic ? this.writeCharacteristic.uuid : '',
      notifyCharacteristicId: this.notifyCharacteristic ? this.notifyCharacteristic.uuid : '',
      mtu: this.mtu,
      maxWriteSize: this.maxWriteSize,
      writeType: this.writeCharacteristic && (this.writeCharacteristic.properties || {}).writeNoResponse
        ? 'writeNoResponse'
        : this.writeCharacteristic ? 'write' : ''
    };
  }

  /**
   * The print channel among the device's services: the first that can take
   * print data and answer, else one that can only take it ({ notify: null });
   * null when nothing on the device can be written to.
   */
  async discoverChannel(device) {
    const serviceResult = await this.call('getBLEDeviceServices', { deviceId: this.deviceId });
    const services = (serviceResult.services || [])
      .filter((service) => !isInfrastructureService(service.uuid))
      .sort((left, right) => serviceRank(right, device) - serviceRank(left, device));
    let writeOnly = null;
    for (let index = 0; index < services.length; index += 1) {
      const service = services[index];
      let result;
      try {
        result = await this.call('getBLEDeviceCharacteristics', {
          deviceId: this.deviceId,
          serviceId: service.uuid
        });
      } catch (error) {
        continue;
      }
      const pair = channelIn(service.uuid, result.characteristics || [], device);
      if (pair && pair.notify) return { serviceId: service.uuid, write: pair.write, notify: pair.notify };
      if (pair && !writeOnly) writeOnly = { serviceId: service.uuid, write: pair.write, notify: null };
    }
    return writeOnly;
  }

  // Notifications on, as the receipt app does at connect; printing does not
  // wait for them, so a device that refuses them stays connected.
  async enableNotifications() {
    const characteristic = this.notifyCharacteristic;
    const request = {
      state: true,
      deviceId: this.deviceId,
      serviceId: this.serviceId,
      characteristicId: characteristic.uuid,
      type: (characteristic.properties || {}).indicate ? 'indication' : 'notification'
    };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.call('notifyBLECharacteristicValueChange', request, 5000);
        return;
      } catch (error) {
        if (isLinkGone(error)) throw error;
        if (attempt === 0) await sleep(300);
      }
    }
    this.notifyCharacteristic = null;
  }

  async negotiateMtu() {
    let negotiated = this.mtu >= 23 && this.maxWriteSize > 20;
    if (this.api.setBLEMTU) {
      try {
        const result = await this.call('setBLEMTU', { deviceId: this.deviceId, mtu: 247 }, 5000);
        if (Number(result.mtu) >= 23) {
          this.mtu = Number(result.mtu);
          this.maxWriteSize = this.mtu - 3;
          negotiated = true;
        }
        await sleep(100);
      } catch (error) {
        // iOS does not expose MTU negotiation; getBLEMTU still reports its value.
      }
    }
    if (this.api.getBLEMTU) {
      try {
        const result = await this.call('getBLEMTU', {
          deviceId: this.deviceId,
          writeType: (this.writeCharacteristic.properties || {}).writeNoResponse
            ? 'writeNoResponse'
            : 'write'
        }, 5000);
        if (Number(result.mtu) >= 23) {
          this.mtu = Number(result.mtu);
          this.maxWriteSize = this.mtu - 3;
          negotiated = true;
        }
      } catch (error) {
        if (!negotiated) {
          this.mtu = 23;
          this.maxWriteSize = 20;
        }
      }
    }
  }

  handleConnectionChange(event) {
    if (event.deviceId === this.deviceId && !event.connected) {
      this.transportGeneration += 1;
      this.connected = false;
      this.serviceId = '';
      this.writeCharacteristic = null;
      this.notifyCharacteristic = null;
      this.mtu = 23;
      this.maxWriteSize = 20;
      this.emitTransportReset({ reason: 'link-lost', deviceId: event.deviceId });
      this.connectionStateListeners.forEach((listener) => listener({
        connected: false,
        deviceId: event.deviceId,
        name: this.deviceName
      }));
    }
  }

  handleMtuChange(event) {
    if (event.deviceId && event.deviceId !== this.deviceId) {
      return;
    }
    if (Number(event.mtu) >= 23) {
      this.mtu = Number(event.mtu);
      this.maxWriteSize = this.mtu - 3;
    }
  }

  onConnectionStateChange(listener) {
    this.connectionStateListeners.push(listener);
    return () => {
      this.connectionStateListeners = this.connectionStateListeners.filter((item) => item !== listener);
    };
  }

  onTransportReset(listener) {
    this.transportResetListeners.push(listener);
    return () => {
      this.transportResetListeners = this.transportResetListeners.filter((item) => item !== listener);
    };
  }

  emitTransportReset(event) {
    this.transportResetListeners.slice().forEach((listener) => listener(event));
  }

  /**
   * Writes `bytes` as they are, split into packets the link takes, one after
   * another, behind any write still queued for this link.
   * Write requests are used when the characteristic offers them, so each
   * packet is acknowledged before the next (the receipt app's stable mode).
   */
  writeRaw(bytes) {
    const generation = this.transportGeneration;
    const run = () => this.sendRaw(bytes, generation);
    const task = this.queue.then(run, run);
    this.queue = task.catch(() => undefined);
    return task;
  }

  async sendRaw(bytes, generation) {
    this.assertTransportGeneration(generation);
    if (!this.connected) throw new Error('请先连接打印机');
    if (!this.writeCharacteristic || !this.serviceId) throw noChannelError();
    const data = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes || []);
    const packet = Math.max(20, Number(this.maxWriteSize) || 20);
    const withResponse = Boolean((this.writeCharacteristic.properties || {}).write);
    for (let offset = 0; offset < data.length; offset += packet) {
      this.assertTransportGeneration(generation);
      await withTimeout(
        callWx(this.api, 'writeBLECharacteristicValue', {
          deviceId: this.deviceId,
          serviceId: this.serviceId,
          characteristicId: this.writeCharacteristic.uuid,
          value: data.slice(offset, offset + packet).buffer,
          writeType: withResponse ? 'write' : 'writeNoResponse'
        }),
        3000,
        '蓝牙写入超时'
      );
      if (!withResponse) await sleep(this.writeDelayMs);
    }
  }

  assertTransportGeneration(generation) {
    if (generation !== this.transportGeneration) {
      const error = new Error('蓝牙连接已变化，已停止旧任务');
      error.code = 'TRANSPORT_RESET';
      throw error;
    }
  }

  async disconnect(deviceIdOverride) {
    const attempt = this.connectAttempt;
    if (attempt && (!deviceIdOverride || attempt.deviceId === deviceIdOverride)) {
      this.cancelConnectAttempt();
    }
    await this.closeTransport(deviceIdOverride);
  }

  async closeTransport(deviceIdOverride) {
    const deviceId = deviceIdOverride || this.deviceId;
    const resetsCurrent = !deviceIdOverride || !this.deviceId || deviceIdOverride === this.deviceId;
    if (resetsCurrent) {
      const resetDeviceId = this.deviceId || deviceId;
      this.transportGeneration += 1;
      this.unbindTransportListeners();
      this.connected = false;
      this.deviceId = '';
      this.deviceName = '';
      this.serviceId = '';
      this.writeCharacteristic = null;
      this.notifyCharacteristic = null;
      this.mtu = 23;
      this.maxWriteSize = 20;
      if (resetDeviceId) {
        this.emitTransportReset({ reason: 'disconnect', deviceId: resetDeviceId });
      }
    }
    if (deviceId) {
      try {
        await this.call('closeBLEConnection', { deviceId }, 4000);
      } catch (error) {
        // The OS may already have closed a failed connection.
      }
    }
  }

  async close() {
    await this.stopScan();
    await this.disconnect();
    if (this.api.closeBluetoothAdapter) {
      try {
        await this.call('closeBluetoothAdapter', {}, 4000);
      } catch (error) {
        // The adapter can already be closed by the operating system.
      }
    }
  }
}

module.exports = {
  BleSession,
  PRIMARY_NOTIFY_CHARACTERISTIC,
  PRIMARY_SERVICE,
  PRIMARY_WRITE_CHARACTERISTIC,
  callWx,
  isAlreadyConnectedError,
  withTimeout
};
