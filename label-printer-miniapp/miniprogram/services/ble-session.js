const { sleep } = require('../core/bytes');
const { PacketParser, RESPONSE, encodePacket } = require('../core/protocol');

const PRIMARY_SERVICE = 'e7810a71-73ae-499d-8c15-faa9aef0c3f2';
const PRINTER_ERRORS = {
  0x01: '打印机上盖未关闭',
  0x02: '打印机缺纸',
  0x03: '打印机电量过低',
  0x04: '打印机电池异常',
  0x05: '打印任务已取消',
  0x06: '打印数据错误',
  0x07: '打印头过热',
  0x08: '走纸异常',
  0x09: '打印机正忙',
  0x0a: '未检测到打印头',
  0x0b: '打印头温度过低',
  0x0c: '打印头松动',
  0x0d: '未安装碳带',
  0x10: '纸张类型不匹配',
  0x16: '打印机通信异常',
  0x17: '打印机已断开',
  0x18: '标签画布参数错误',
  0x32: '标签页参数不合法',
  0x34: '打印机接收数据超时'
};

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

class BleSession {
  constructor(api) {
    this.api = api || wx;
    this.deviceId = '';
    this.deviceName = '';
    this.serviceId = '';
    this.writeCharacteristic = null;
    this.notifyCharacteristic = null;
    this.parser = new PacketParser();
    this.pending = null;
    this.latchedError = null;
    this.queue = Promise.resolve();
    this.scanListener = null;
    this.packetListeners = [];
    this.connectionStateListeners = [];
    this.connected = false;
    this.mtu = 23;
    this.maxWriteSize = 20;
    this.writeDelayMs = 10;
    this.valueListener = this.handleValueChange.bind(this);
    this.connectionListener = this.handleConnectionChange.bind(this);
    this.mtuListener = this.handleMtuChange.bind(this);
  }

  async open() {
    try {
      await callWx(this.api, 'openBluetoothAdapter', { mode: 'central' });
    } catch (error) {
      if (error.code !== 10001) {
        throw error;
      }
      throw new Error('请开启手机蓝牙；Android 扫描还需要开启系统定位服务');
    }
  }

  async scan(onDevices) {
    await this.open();
    await this.stopScan();
    const devices = new Map();
    this.scanListener = (event) => {
      (event.devices || []).forEach((device) => {
        const name = device.name || device.localName || '';
        if (name) {
          devices.set(device.deviceId, Object.assign({}, device, { displayName: name }));
        }
      });
      onDevices(Array.from(devices.values()).sort((left, right) => (right.RSSI || -100) - (left.RSSI || -100)));
    };
    this.api.onBluetoothDeviceFound(this.scanListener);
    await callWx(this.api, 'startBluetoothDevicesDiscovery', {
      allowDuplicatesKey: false,
      interval: 300
    });
  }

  async stopScan() {
    if (this.scanListener && this.api.offBluetoothDeviceFound) {
      this.api.offBluetoothDeviceFound(this.scanListener);
      this.scanListener = null;
    }
    try {
      await callWx(this.api, 'stopBluetoothDevicesDiscovery', {});
    } catch (error) {
      // Stopping an inactive scan is harmless on both platforms.
    }
  }

  async connect(device) {
    try {
      return await this.connectTransport(device);
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  async connectTransport(device) {
    await this.stopScan();
    if (this.connected || this.deviceId) {
      await this.disconnect();
    }
    this.deviceId = device.deviceId;
    this.deviceName = device.displayName || device.name || device.localName || '未知设备';
    await callWx(this.api, 'createBLEConnection', {
      deviceId: this.deviceId,
      timeout: 12000
    });

    if (this.api.onBLEConnectionStateChange) {
      this.api.onBLEConnectionStateChange(this.connectionListener);
    }
    if (this.api.onBLECharacteristicValueChange) {
      this.api.onBLECharacteristicValueChange(this.valueListener);
    }
    if (this.api.onBLEMTUChange) {
      this.api.onBLEMTUChange(this.mtuListener);
    }

    const serviceResult = await callWx(this.api, 'getBLEDeviceServices', { deviceId: this.deviceId });
    const services = (serviceResult.services || []).slice().sort((left, right) => {
      const leftKnown = String(left.uuid).toLowerCase() === PRIMARY_SERVICE;
      const rightKnown = String(right.uuid).toLowerCase() === PRIMARY_SERVICE;
      return Number(rightKnown) - Number(leftKnown);
    });

    let channel = null;
    for (let index = 0; index < services.length; index += 1) {
      const service = services[index];
      let result;
      try {
        result = await callWx(this.api, 'getBLEDeviceCharacteristics', {
          deviceId: this.deviceId,
          serviceId: service.uuid
        });
      } catch (error) {
        continue;
      }
      const characteristics = result.characteristics || [];
      const sameChannel = characteristics.find((item) => supportsWrite(item) && supportsNotify(item));
      const write = sameChannel || characteristics.find(supportsWrite);
      const notify = sameChannel || characteristics.find(supportsNotify);
      if (write && notify) {
        channel = { serviceId: service.uuid, write, notify };
        break;
      }
    }

    if (!channel) {
      await this.disconnect();
      throw new Error('设备没有可用的 BLE 写入/通知特征，可能不是支持的 BLE 打印机');
    }
    this.serviceId = channel.serviceId;
    this.writeCharacteristic = channel.write;
    this.notifyCharacteristic = channel.notify;
    await this.negotiateMtu();
    await callWx(this.api, 'notifyBLECharacteristicValueChange', {
      state: true,
      deviceId: this.deviceId,
      serviceId: this.serviceId,
      characteristicId: this.notifyCharacteristic.uuid,
      type: (this.notifyCharacteristic.properties || {}).indicate ? 'indication' : 'notification'
    });
    await sleep(150);
    this.connected = true;
    return {
      deviceId: this.deviceId,
      name: this.deviceName,
      serviceId: this.serviceId,
      writeCharacteristicId: this.writeCharacteristic.uuid,
      notifyCharacteristicId: this.notifyCharacteristic.uuid,
      mtu: this.mtu,
      maxWriteSize: this.maxWriteSize
    };
  }

  async negotiateMtu() {
    if (this.api.setBLEMTU) {
      try {
        const result = await callWx(this.api, 'setBLEMTU', { deviceId: this.deviceId, mtu: 247 });
        if (Number(result.mtu) >= 23) {
          this.mtu = Number(result.mtu);
          this.maxWriteSize = this.mtu - 3;
        }
        await sleep(100);
      } catch (error) {
        // iOS does not expose MTU negotiation; getBLEMTU still reports its value.
      }
    }
    if (this.api.getBLEMTU) {
      try {
        const result = await callWx(this.api, 'getBLEMTU', {
          deviceId: this.deviceId,
          writeType: (this.writeCharacteristic.properties || {}).writeNoResponse
            ? 'writeNoResponse'
            : 'write'
        });
        if (Number(result.mtu) >= 23) {
          this.mtu = Number(result.mtu);
          this.maxWriteSize = this.mtu - 3;
        }
      } catch (error) {
        this.mtu = 23;
        this.maxWriteSize = 20;
      }
    }
  }

  handleValueChange(event) {
    if (event.deviceId !== this.deviceId) {
      return;
    }
    if (event.characteristicId && this.notifyCharacteristic
      && String(event.characteristicId).toLowerCase() !== String(this.notifyCharacteristic.uuid).toLowerCase()) {
      return;
    }
    const packets = this.parser.push(event.value);
    packets.forEach((packet) => {
      if (packet.command === RESPONSE.PRINT_ERROR || packet.command === RESPONSE.NOT_SUPPORTED) {
        const code = packet.data.length ? packet.data[0] : null;
        const error = new Error(packet.command === RESPONSE.NOT_SUPPORTED
          ? '打印机不支持当前命令'
          : PRINTER_ERRORS[code] || `打印机报告错误${code == null ? '' : `（0x${code.toString(16)}）`}`);
        error.code = code;
        if (this.pending) {
          const pending = this.pending;
          this.pending = null;
          clearTimeout(pending.timer);
          pending.reject(error);
        } else {
          this.latchedError = error;
        }
      }
      if (this.pending && this.pending.expected.indexOf(packet.command) >= 0) {
        const pending = this.pending;
        this.pending = null;
        clearTimeout(pending.timer);
        pending.resolve(packet);
      }
      this.packetListeners.forEach((listener) => listener(packet));
    });
  }

  handleConnectionChange(event) {
    if (event.deviceId === this.deviceId && !event.connected) {
      this.connected = false;
      this.rejectPending(new Error('打印机连接已断开'));
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

  onPacket(listener) {
    this.packetListeners.push(listener);
    return () => {
      this.packetListeners = this.packetListeners.filter((item) => item !== listener);
    };
  }

  onConnectionStateChange(listener) {
    this.connectionStateListeners.push(listener);
    return () => {
      this.connectionStateListeners = this.connectionStateListeners.filter((item) => item !== listener);
    };
  }

  request(command, data, expected, timeoutMs) {
    const run = () => this.sendRequest(command, data, expected, timeoutMs);
    const task = this.queue.then(run, run);
    this.queue = task.catch(() => undefined);
    return task;
  }

  async sendRequest(command, data, expected, timeoutMs) {
    if (!this.connected) {
      throw new Error('请先连接打印机');
    }
    if (this.latchedError) {
      const error = this.latchedError;
      this.latchedError = null;
      throw error;
    }
    const responsePromise = expected == null ? null : new Promise((resolve, reject) => {
      const expectedList = Array.isArray(expected) ? expected : [expected];
      const timer = setTimeout(() => {
        if (this.pending && this.pending.timer === timer) {
          this.pending = null;
        }
        reject(new Error(`等待打印机响应超时（0x${expectedList[0].toString(16)}）`));
      }, timeoutMs || 1500);
      this.pending = { expected: expectedList, resolve, reject, timer };
    });
    if (responsePromise) {
      responsePromise.catch(() => undefined);
    }

    try {
      await this.writeBytes(encodePacket(command, data));
      return responsePromise ? await responsePromise : null;
    } catch (error) {
      if (responsePromise) {
        this.rejectPending(error);
        responsePromise.catch(() => undefined);
      }
      throw error;
    }
  }

  async writeBytes(bytes) {
    const writeType = (this.writeCharacteristic.properties || {}).writeNoResponse
      ? 'writeNoResponse'
      : 'write';
    if (bytes.length > this.maxWriteSize) {
      throw new Error(
        `当前蓝牙载荷仅 ${this.maxWriteSize} 字节，完整打印帧需要 ${bytes.length} 字节；请在 Android/iOS 真机确认 MTU`
      );
    }
    await withTimeout(
      callWx(this.api, 'writeBLECharacteristicValue', {
        deviceId: this.deviceId,
        serviceId: this.serviceId,
        characteristicId: this.writeCharacteristic.uuid,
        value: bytes.buffer,
        writeType
      }),
      3000,
      '蓝牙写入超时'
    );
    await sleep(this.writeDelayMs);
  }

  rejectPending(error) {
    if (!this.pending) {
      return;
    }
    const pending = this.pending;
    this.pending = null;
    clearTimeout(pending.timer);
    pending.reject(error);
  }

  async disconnect() {
    this.rejectPending(new Error('连接已关闭'));
    if (this.api.offBLECharacteristicValueChange) {
      this.api.offBLECharacteristicValueChange(this.valueListener);
    }
    if (this.api.offBLEConnectionStateChange) {
      this.api.offBLEConnectionStateChange(this.connectionListener);
    }
    if (this.api.offBLEMTUChange) {
      this.api.offBLEMTUChange(this.mtuListener);
    }
    const deviceId = this.deviceId;
    this.connected = false;
    this.deviceId = '';
    this.serviceId = '';
    this.writeCharacteristic = null;
    this.notifyCharacteristic = null;
    this.mtu = 23;
    this.maxWriteSize = 20;
    this.parser.reset();
    this.latchedError = null;
    if (deviceId) {
      try {
        await callWx(this.api, 'closeBLEConnection', { deviceId });
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
        await callWx(this.api, 'closeBluetoothAdapter', {});
      } catch (error) {
        // The adapter can already be closed by the operating system.
      }
    }
  }
}

module.exports = { BleSession, PRIMARY_SERVICE, callWx, withTimeout };
