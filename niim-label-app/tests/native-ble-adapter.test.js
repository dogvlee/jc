const test = require('node:test');
const assert = require('node:assert/strict');

const { callWx } = require('../src/services/ble-session');
const { createNativeApi } = require('../src/services/platform-ble-api');

test('native BLE adapter maps the official BleClient signatures to the session API', async () => {
  const calls = [];
  let notificationCallback;
  const client = {
    async initialize(options) { calls.push(['initialize', options]); },
    async requestLEScan(options, callback) {
      calls.push(['scan', options]);
      callback({ device: { deviceId: 'native-1', name: 'D110' }, rssi: -44 });
    },
    async stopLEScan() { calls.push(['stop']); },
    async connect(deviceId, onDisconnect, options) { calls.push(['connect', deviceId, options]); },
    async disconnect(deviceId) { calls.push(['disconnect', deviceId]); },
    async getServices(deviceId) {
      calls.push(['services', deviceId]);
      return [{
        uuid: 'service-1',
        characteristics: [{
          uuid: 'characteristic-1',
          properties: { write: false, writeWithoutResponse: true, notify: true, indicate: false }
        }]
      }];
    },
    async startNotifications(deviceId, service, characteristic, callback) {
      calls.push(['notify', deviceId, service, characteristic]);
      notificationCallback = callback;
    },
    async stopNotifications() {},
    async getMtu(deviceId) { calls.push(['mtu', deviceId]); return 247; },
    async writeWithoutResponse(deviceId, service, characteristic, value) {
      calls.push(['write', deviceId, service, characteristic, Array.from(new Uint8Array(value.buffer))]);
    },
    async write() {}
  };
  const api = createNativeApi(client);
  const found = [];
  const values = [];
  api.onBluetoothDeviceFound((event) => found.push(...event.devices));
  api.onBLECharacteristicValueChange((event) => values.push(Array.from(new Uint8Array(event.value))));

  await callWx(api, 'openBluetoothAdapter', {});
  assert.deepEqual(calls.find((entry) => entry[0] === 'initialize'), [
    'initialize',
    { androidNeverForLocation: true }
  ]);
  await callWx(api, 'startBluetoothDevicesDiscovery', {});
  assert.deepEqual(found, [{ deviceId: 'native-1', name: 'D110', localName: 'D110', RSSI: -44 }]);

  await callWx(api, 'createBLEConnection', { deviceId: 'native-1', timeout: 9000 });
  const services = await callWx(api, 'getBLEDeviceServices', { deviceId: 'native-1' });
  const characteristics = await callWx(api, 'getBLEDeviceCharacteristics', { deviceId: 'native-1', serviceId: 'service-1' });
  assert.equal(services.services[0].uuid, 'service-1');
  assert.equal(characteristics.characteristics[0].properties.writeNoResponse, true);

  await callWx(api, 'notifyBLECharacteristicValueChange', {
    state: true,
    deviceId: 'native-1',
    serviceId: 'service-1',
    characteristicId: 'characteristic-1'
  });
  notificationCallback(new DataView(Uint8Array.from([1, 2, 3]).buffer));
  assert.deepEqual(values, [[1, 2, 3]]);

  const mtu = await callWx(api, 'getBLEMTU', { deviceId: 'native-1' });
  assert.equal(mtu.mtu, 247);
  await callWx(api, 'writeBLECharacteristicValue', {
    deviceId: 'native-1',
    serviceId: 'service-1',
    characteristicId: 'characteristic-1',
    value: Uint8Array.from([0x55, 0xaa]).buffer,
    writeType: 'writeNoResponse'
  });
  assert.deepEqual(calls.find((entry) => entry[0] === 'write').at(-1), [0x55, 0xaa]);
});
