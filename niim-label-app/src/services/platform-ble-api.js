const { COMMAND, encodePacket } = require('../core/protocol');
const { Capacitor } = require('@capacitor/core');
const { BleClient } = require('@capacitor-community/bluetooth-le');

const SERVICE_UUID = 'e7810a71-73ae-499d-8c15-faa9aef0c3f2';
const WRITE_UUID = 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f';
const NOTIFY_UUID = 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9e';

function succeed(options, value) {
  queueMicrotask(() => options.success && options.success(value || {}));
}

function fail(options, error) {
  queueMicrotask(() => options.fail && options.fail({
    errCode: error && error.code,
    errMsg: error && error.message ? error.message : String(error)
  }));
}

function bytesToBase64(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function base64ToBuffer(value) {
  const binary = atob(value || '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function callbackify(options, promise, transform) {
  Promise.resolve(promise).then(
    (value) => succeed(options, transform ? transform(value) : value),
    (error) => fail(options, error)
  );
}

function createNativeApi(client) {
  const foundListeners = new Set();
  const valueListeners = new Set();
  const connectionListeners = new Set();
  const servicesByDevice = new Map();

  const api = {
    platform: 'native',
    openBluetoothAdapter(options) {
      callbackify(options, client.initialize({ androidNeverForLocation: true }));
    },
    closeBluetoothAdapter(options) {
      succeed(options);
    },
    startBluetoothDevicesDiscovery(options) {
      const promise = client.requestLEScan({ allowDuplicates: false }, (result) => {
        const device = result.device || result;
        const normalized = {
          deviceId: device.deviceId || device.id,
          name: device.name || '',
          localName: device.localName || device.name || '',
          RSSI: result.rssi == null ? result.RSSI : result.rssi
        };
        foundListeners.forEach((listener) => listener({ devices: [normalized] }));
      });
      callbackify(options, promise);
    },
    stopBluetoothDevicesDiscovery(options) {
      callbackify(options, client.stopLEScan());
    },
    onBluetoothDeviceFound(listener) {
      foundListeners.add(listener);
    },
    offBluetoothDeviceFound(listener) {
      foundListeners.delete(listener);
    },
    createBLEConnection(options) {
      const promise = client.connect(options.deviceId, () => {
        connectionListeners.forEach((listener) => listener({ deviceId: options.deviceId, connected: false }));
      }, { timeout: options.timeout || 12000 });
      callbackify(options, promise);
    },
    closeBLEConnection(options) {
      callbackify(options, client.disconnect(options.deviceId));
    },
    onBLEConnectionStateChange(listener) {
      connectionListeners.add(listener);
    },
    offBLEConnectionStateChange(listener) {
      connectionListeners.delete(listener);
    },
    getBLEDeviceServices(options) {
      callbackify(options, client.getServices(options.deviceId), (result) => {
        const services = Array.isArray(result) ? result : result.services || [];
        servicesByDevice.set(options.deviceId, services);
        return { services: services.map((service) => ({ uuid: service.uuid })) };
      });
    },
    getBLEDeviceCharacteristics(options) {
      const services = servicesByDevice.get(options.deviceId) || [];
      const service = services.find((item) => String(item.uuid || item.service).toLowerCase() === String(options.serviceId).toLowerCase());
      const characteristics = service && service.characteristics ? service.characteristics : [];
      succeed(options, {
        characteristics: characteristics.map((item) => ({
          uuid: item.uuid,
          properties: {
            write: Boolean(item.properties && item.properties.write),
            writeNoResponse: Boolean(item.properties && item.properties.writeWithoutResponse),
            notify: Boolean(item.properties && item.properties.notify),
            indicate: Boolean(item.properties && item.properties.indicate)
          }
        }))
      });
    },
    notifyBLECharacteristicValueChange(options) {
      if (!options.state) {
        callbackify(options, client.stopNotifications(options.deviceId, options.serviceId, options.characteristicId));
        return;
      }
      const promise = client.startNotifications(options.deviceId, options.serviceId, options.characteristicId, (value) => {
        const buffer = value instanceof DataView
          ? value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
          : value instanceof Uint8Array
            ? value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
            : value;
        valueListeners.forEach((listener) => listener({
          deviceId: options.deviceId,
          serviceId: options.serviceId,
          characteristicId: options.characteristicId,
          value: buffer
        }));
      });
      callbackify(options, promise);
    },
    onBLECharacteristicValueChange(listener) {
      valueListeners.add(listener);
    },
    offBLECharacteristicValueChange(listener) {
      valueListeners.delete(listener);
    },
    getBLEMTU(options) {
      callbackify(options, client.getMtu(options.deviceId), (result) => ({ mtu: Number(result) || 23 }));
    },
    writeBLECharacteristicValue(options) {
      const buffer = options.value instanceof ArrayBuffer
        ? options.value
        : options.value.buffer.slice(options.value.byteOffset, options.value.byteOffset + options.value.byteLength);
      const value = new DataView(buffer);
      const write = options.writeType === 'writeNoResponse'
        ? client.writeWithoutResponse(options.deviceId, options.serviceId, options.characteristicId, value)
        : client.write(options.deviceId, options.serviceId, options.characteristicId, value);
      callbackify(options, write);
    }
  };
  return api;
}

function createPreviewApi() {
  const foundListeners = new Set();
  const valueListeners = new Set();
  const connectionListeners = new Set();
  let connectedDevice = '';
  let copies = 1;

  const devices = [
    { deviceId: 'PREVIEW-D110-01', name: '浏览器预览 D110', localName: 'D110', RSSI: -42 },
    { deviceId: 'PREVIEW-B21-01', name: '浏览器预览 B21', localName: 'B21', RSSI: -61 }
  ];

  function emitPacket(deviceId, command, data) {
    const packet = encodePacket(command, data || []);
    const buffer = packet.buffer.slice(packet.byteOffset, packet.byteOffset + packet.byteLength);
    setTimeout(() => valueListeners.forEach((listener) => listener({
      deviceId,
      characteristicId: NOTIFY_UUID,
      value: buffer
    })), 5);
  }

  function respondToWrite(options) {
    const source = new Uint8Array(options.value);
    const offset = source[0] === 0x03 ? 1 : 0;
    const command = source[offset + 2];
    const length = source[offset + 3];
    const data = source.slice(offset + 4, offset + 4 + length);
    const simple = {
      [COMMAND.PRINT_START]: 0x02,
      [COMMAND.PAGE_START]: 0x04,
      [COMMAND.SET_PAGE_SIZE]: 0x14,
      [COMMAND.SET_QUANTITY]: 0x16,
      [COMMAND.PRINT_CLEAR]: 0x30,
      [COMMAND.SET_DENSITY]: 0x31,
      [COMMAND.SET_LABEL_TYPE]: 0x33,
      [COMMAND.CANCEL_PRINT]: 0xd0,
      [COMMAND.HEARTBEAT]: 0xdd,
      [COMMAND.CHECK_LINE]: 0xd3,
      [COMMAND.PAGE_END]: 0xe4,
      [COMMAND.PRINT_END]: 0xf4
    };
    if (command === COMMAND.CONNECT) {
      emitPacket(options.deviceId, 0xc2, [1]);
    } else if (command === COMMAND.PRINTER_INFO) {
      const responseByType = { 8: 0x48, 11: 0x4b, 13: 0x4d, 10: 0x4a, 7: 0x47, 3: 0x43, 12: 0x4c, 9: 0x49 };
      const payloadByType = {
        8: [0x09, 0x00],
        11: [0x50, 0x52, 0x45, 0x56, 0x49, 0x45, 0x57],
        13: [0, 0, 0, 0, 0, 1],
        10: [88],
        7: [0],
        3: [1],
        12: [1, 0],
        9: [1, 0]
      };
      emitPacket(options.deviceId, responseByType[data[0]], payloadByType[data[0]] || [1]);
    } else if (command === COMMAND.SET_QUANTITY) {
      copies = data.length >= 2 ? data[0] * 256 + data[1] : 1;
      emitPacket(options.deviceId, simple[command], [1]);
    } else if (command === COMMAND.PRINT_STATUS) {
      emitPacket(options.deviceId, 0xb3, [(copies >> 8) & 0xff, copies & 0xff]);
    } else if (simple[command] != null) {
      emitPacket(options.deviceId, simple[command], [1]);
    }
  }

  return {
    platform: 'preview',
    openBluetoothAdapter(options) { succeed(options); },
    closeBluetoothAdapter(options) { succeed(options); },
    startBluetoothDevicesDiscovery(options) {
      succeed(options);
      setTimeout(() => foundListeners.forEach((listener) => listener({ devices })), 180);
    },
    stopBluetoothDevicesDiscovery(options) { succeed(options); },
    onBluetoothDeviceFound(listener) { foundListeners.add(listener); },
    offBluetoothDeviceFound(listener) { foundListeners.delete(listener); },
    createBLEConnection(options) { connectedDevice = options.deviceId; succeed(options); },
    closeBLEConnection(options) {
      const deviceId = connectedDevice;
      connectedDevice = '';
      succeed(options);
      if (deviceId) setTimeout(() => connectionListeners.forEach((listener) => listener({ deviceId, connected: false })), 1);
    },
    onBLEConnectionStateChange(listener) { connectionListeners.add(listener); },
    offBLEConnectionStateChange(listener) { connectionListeners.delete(listener); },
    getBLEDeviceServices(options) { succeed(options, { services: [{ uuid: SERVICE_UUID }] }); },
    getBLEDeviceCharacteristics(options) {
      succeed(options, { characteristics: [
        { uuid: WRITE_UUID, properties: { writeNoResponse: true } },
        { uuid: NOTIFY_UUID, properties: { notify: true } }
      ] });
    },
    notifyBLECharacteristicValueChange(options) { succeed(options); },
    onBLECharacteristicValueChange(listener) { valueListeners.add(listener); },
    offBLECharacteristicValueChange(listener) { valueListeners.delete(listener); },
    setBLEMTU(options) { succeed(options, { mtu: 247 }); },
    getBLEMTU(options) { succeed(options, { mtu: 247 }); },
    onBLEMTUChange() {},
    offBLEMTUChange() {},
    writeBLECharacteristicValue(options) {
      succeed(options);
      respondToWrite(options);
    }
  };
}

function createPlatformBleApi() {
  return Capacitor.isNativePlatform() ? createNativeApi(BleClient) : createPreviewApi();
}

module.exports = {
  base64ToBuffer,
  bytesToBase64,
  createNativeApi,
  createPlatformBleApi,
  createPreviewApi
};
