const test = require('node:test');
const assert = require('node:assert/strict');

const { getProfile } = require('../src/core/profiles');
const { BleSession } = require('../src/services/ble-session');
const { createPreviewApi } = require('../src/services/platform-ble-api');
const { PrinterClient } = require('../src/services/printer-client');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('browser preview adapter completes discovery, negotiation, and a print job', async () => {
  const api = createPreviewApi();
  const session = new BleSession(api);
  const printer = new PrinterClient(session);
  let devices = [];

  await session.scan((next) => { devices = next; });
  await wait(220);
  assert.equal(devices.length, 2);

  const connection = await printer.connect(devices[0]);
  assert.equal(connection.modelId, 2304);
  assert.equal(connection.mtu, 247);
  assert.equal(printer.ready, true);

  const imageData = {
    width: 16,
    height: 8,
    data: new Uint8ClampedArray(16 * 8 * 4).fill(255)
  };
  for (let pixel = 0; pixel < imageData.width * imageData.height; pixel += 3) {
    const offset = pixel * 4;
    imageData.data[offset] = 0;
    imageData.data[offset + 1] = 0;
    imageData.data[offset + 2] = 0;
    imageData.data[offset + 3] = 255;
  }

  const progress = [];
  const result = await printer.print(imageData, getProfile('d110'), {
    copies: 2,
    density: 2,
    threshold: 180,
    labelType: 1
  }, (value) => progress.push(value));

  assert.equal(result.rows, 16);
  assert.equal(result.columns, 8);
  assert.equal(progress.at(-1), 100);
  await session.close();
});
