const assert = require('node:assert/strict');
const test = require('node:test');

const { BleSession, withTimeout } = require('../src/services/ble-session');
const { COMMAND, RESPONSE, encodePacket } = require('../src/core/protocol');

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

