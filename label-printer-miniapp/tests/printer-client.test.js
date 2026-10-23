const assert = require('node:assert/strict');
const test = require('node:test');

const { PrinterClient } = require('../miniprogram/services/printer-client');
const { INIT, NEXT_LABEL, TEAR_FEED } = require('../miniprogram/core/escpos');
const { getProfile } = require('../miniprogram/core/profiles');

// A BleSession stand-in for a thermal printer on FF00: it records every raw
// ESC/POS write.
class FakeSession {
  constructor() {
    this.writes = [];
    this.connected = true;
    this.maxWriteSize = 20;
    this.disconnections = 0;
    this.existingConnections = 0;
    this.transportResetListeners = [];
  }

  onConnectionStateChange() {
    return () => {};
  }

  onTransportReset(listener) {
    this.transportResetListeners.push(listener);
    return () => {};
  }

  resetTransport() {
    this.transportResetListeners.forEach((listener) => listener({ reason: 'test' }));
  }

  async connect(device) {
    this.connected = true;
    return { deviceId: device.deviceId, name: device.name, serviceId: '0000ff00-0000-1000-8000-00805f9b34fb', maxWriteSize: 20 };
  }

  async connectExisting(device) {
    this.existingConnections += 1;
    return this.connect(device);
  }

  async disconnect() {
    this.disconnections += 1;
    this.connected = false;
  }

  async writeRaw(bytes) {
    this.writes.push(Array.from(bytes));
  }
}

async function connectedClient() {
  const session = new FakeSession();
  const client = new PrinterClient(session);
  client.wait = async () => {};
  await client.connect({ deviceId: 'syd', name: 'SYD-58' });
  return { session, client };
}

function blackImage(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 3; index < data.length; index += 4) data[index] = 255;
  return { width, height, data };
}

const isBand = (bytes) => bytes[0] === 0x1D && bytes[1] === 0x76 && bytes[2] === 0x30;
const same = (left, right) => left.length === right.length && left.every((byte, index) => byte === right[index]);

test('connecting opens the link, sends nothing and reports ESC/POS', async () => {
  const session = new FakeSession();
  const client = new PrinterClient(session);
  const result = await client.connect({ deviceId: 'syd', name: 'SYD-58' });
  assert.equal(result.protocol, 'escpos');
  assert.equal(client.ready, true);
  assert.equal(client.deviceId, 'syd');
  assert.deepEqual(session.writes, [], 'nothing is written until a label prints');

  await client.connectExisting({ deviceId: 'syd', name: 'SYD-58' });
  assert.equal(session.existingConnections, 1, 'an OS-held link is reused');
  assert.equal(client.ready, true);
});

test('a link that fails to open is closed and the client stays not ready', async () => {
  const session = new FakeSession();
  session.connect = async () => { throw new Error('createBLEConnection:fail'); };
  const client = new PrinterClient(session);
  await assert.rejects(client.connect({ deviceId: 'syd' }), /createBLEConnection/);
  assert.equal(client.ready, false);
  assert.equal(session.disconnections, 1);
});

test('printing needs a connected printer, and connecting waits for a running print', async () => {
  const idle = new PrinterClient(new FakeSession());
  await assert.rejects(idle.print(blackImage(8, 1), getProfile('escpos-58'), {}), /还没有连接好/);

  const { client } = await connectedClient();
  client.printing = true;
  await assert.rejects(client.connect({ deviceId: 'syd' }), /打印任务进行中/);
});

test('a label goes out as ESC @, GS v 0 bands and GS FF for every copy', async () => {
  const { session, client } = await connectedClient();
  const progress = [];
  const done = await client.print(blackImage(16, 10), getProfile('escpos-58'), { copies: 2 }, (value) => progress.push(value));

  assert.ok(same(session.writes[0], INIT), 'ESC @ first');
  assert.equal(session.writes.filter((bytes) => same(bytes, INIT)).length, 1, 'reset once per print');
  const bands = session.writes.filter(isBand);
  assert.equal(bands[0][4], 48, 'centred on the 58 mm head: 384 dots, 48 bytes a row');
  assert.equal(bands.reduce((rows, band) => rows + band[6], 0), 20, 'ten rows, twice');
  assert.ok(bands.every((band) => band.length <= 20 * 8), 'each band fits eight packets of the link');
  assert.equal(session.writes.filter((bytes) => same(bytes, NEXT_LABEL)).length, 2, 'one next-label feed per copy');
  assert.ok(same(session.writes[session.writes.length - 1], NEXT_LABEL));
  assert.ok(session.writes.every((bytes) => same(bytes, INIT) || isBand(bytes) || same(bytes, NEXT_LABEL)),
    'nothing but ESC/POS reaches the printer');
  assert.deepEqual([done.completedCopies, done.columns, done.rows], [2, 384, 10]);
  assert.equal(progress[progress.length - 1], 100);
});

test('an 80 mm printer gets the label centred on its 576-dot head', async () => {
  const { session, client } = await connectedClient();
  await client.print(blackImage(320, 8), getProfile('escpos-80'), { copies: 1 });
  const band = session.writes.find(isBand);
  assert.equal(band[4], 72, '576 dots, 72 bytes a row');
  // 320 black dots centred: 128 white dots (16 bytes) on each side.
  assert.deepEqual(band.slice(8, 8 + 18), [...new Array(16).fill(0), 0xFF, 0xFF]);
});

test('continuous paper gets a tear feed instead of GS FF', async () => {
  const { session, client } = await connectedClient();
  await client.print(blackImage(8, 1), getProfile('escpos-58'), { copies: 1, labelType: 3 });
  assert.ok(same(session.writes[session.writes.length - 1], TEAR_FEED));
  assert.equal(session.writes.filter((bytes) => same(bytes, NEXT_LABEL)).length, 0);
});

test('copies are a whole number from 1 to 99', async () => {
  const { client } = await connectedClient();
  assert.equal((await client.print(blackImage(8, 1), getProfile('escpos-58'), { copies: 0 })).completedCopies, 1);
  assert.equal((await client.print(blackImage(8, 1), getProfile('escpos-58'), { copies: 120 })).completedCopies, 99);
  assert.equal((await client.print(blackImage(8, 1), getProfile('escpos-58'), { copies: 2.7 })).completedCopies, 2);
});

test('cancelling stops between bands, never inside one', async () => {
  const { session, client } = await connectedClient();
  let bands = 0;
  session.writeRaw = async (bytes) => {
    session.writes.push(Array.from(bytes));
    if (isBand(bytes) && ++bands === 2) client.cancel();
  };
  await assert.rejects(client.print(blackImage(16, 20), getProfile('escpos-58'), { copies: 1 }),
    (error) => error.code === 'PRINT_CANCELLED' && error.possiblyPrinted === true);
  assert.equal(bands, 2, 'no band after the cancel');
  assert.equal(client.printing, false);
});

test('a label cut short by a cancel is still fed out, so the next print starts at a label top', async () => {
  const { session, client } = await connectedClient();
  let bands = 0;
  session.writeRaw = async (bytes) => {
    session.writes.push(Array.from(bytes));
    if (isBand(bytes) && ++bands === 2) client.cancel();
  };
  await assert.rejects(client.print(blackImage(16, 20), getProfile('escpos-58'), { copies: 2, labelType: 1 }),
    (error) => error.code === 'PRINT_CANCELLED');
  assert.deepEqual(session.writes[session.writes.length - 1], Array.from(NEXT_LABEL));

  // A cancel between copies, after the feed, sends nothing more.
  const second = await connectedClient();
  second.session.writeRaw = async (bytes) => {
    second.session.writes.push(Array.from(bytes));
    if (Array.from(bytes).join() === Array.from(NEXT_LABEL).join()) second.client.cancel();
  };
  await assert.rejects(second.client.print(blackImage(16, 1), getProfile('escpos-58'), { copies: 3, labelType: 1 }),
    (error) => error.code === 'PRINT_CANCELLED');
  const feeds = second.session.writes.filter((bytes) => bytes.join() === Array.from(NEXT_LABEL).join());
  assert.equal(feeds.length, 1);
});

test('a link that drops mid-print stops before the next band and says paper may have moved', async () => {
  const { session, client } = await connectedClient();
  let bands = 0;
  session.writeRaw = async (bytes) => {
    session.writes.push(Array.from(bytes));
    if (isBand(bytes) && ++bands === 1) {
      session.connected = false;
      session.resetTransport();
    }
  };
  await assert.rejects(client.print(blackImage(16, 20), getProfile('escpos-58'), { copies: 1 }),
    (error) => error.code === 'TRANSPORT_RESET' && error.possiblyPrinted === true);
  assert.equal(bands, 1);
  assert.equal(client.ready, false, 'the dropped link must be reconnected before the next print');
});

test('nothing is printed twice at once, and a job token keeps other callers out', async () => {
  const { session, client } = await connectedClient();
  let release;
  session.writeRaw = (bytes) => {
    session.writes.push(Array.from(bytes));
    return isBand(bytes) && !release ? new Promise((resolve) => { release = resolve; }) : Promise.resolve();
  };
  const first = client.print(blackImage(8, 1), getProfile('escpos-58'), { copies: 1 });
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(client.print(blackImage(8, 1), getProfile('escpos-58'), { copies: 1 }), /已有打印任务正在进行/);
  release();
  await first;

  client.jobToken = { owner: 'print-job-service' };
  await assert.rejects(client.print(blackImage(8, 1), getProfile('escpos-58'), { copies: 1 }), /已有打印任务正在进行/);
  const done = await client.print(blackImage(8, 1), getProfile('escpos-58'), { copies: 1, jobToken: client.jobToken });
  assert.equal(done.completedCopies, 1);
});

test('a progress listener that throws cannot fail a printed label', async () => {
  const { client } = await connectedClient();
  const done = await client.print(blackImage(8, 2), getProfile('escpos-58'), { copies: 1 }, () => { throw new Error('ui'); });
  assert.equal(done.completedCopies, 1);
});
