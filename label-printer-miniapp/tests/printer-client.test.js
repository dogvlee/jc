const assert = require('node:assert/strict');
const test = require('node:test');

const { PrinterClient } = require('../miniprogram/services/printer-client');
const { COMMAND, RESPONSE } = require('../miniprogram/core/protocol');

class FakeSession {
  constructor(connectResult) {
    this.connectResult = connectResult;
    this.calls = [];
    this.disconnections = 0;
    this.existingConnections = 0;
    this.connected = true;
    this.transportResetListeners = [];
  }

  onPacket() {
    return () => {};
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

  async connect() {
    return { name: 'B1', mtu: 247, maxWriteSize: 244 };
  }

  async connectExisting() {
    this.existingConnections += 1;
    return { deviceId: 'device', name: 'B1', mtu: 247, maxWriteSize: 244 };
  }

  async disconnect() {
    this.disconnections += 1;
    this.connected = false;
  }

  async request(command, data, expected) {
    this.calls.push({ command, data: Array.from(data || []), expected });
    if (command === COMMAND.CONNECT) {
      return { data: Uint8Array.from([this.connectResult]) };
    }
    if (command === COMMAND.PRINTER_STATUS_DATA) {
      const status = new Uint8Array(13);
      status[11] = 3;
      status[12] = 2;
      return { data: status };
    }
    if (command === COMMAND.PRINTER_INFO && data[0] === 8) {
      return { data: Uint8Array.from([0x10, 0x00]) };
    }
    return { data: Uint8Array.from([1]) };
  }
}

test('protocol v3 connection performs status, ordered info, then advanced heartbeat', async () => {
  const session = new FakeSession(3);
  const client = new PrinterClient(session);
  const result = await client.connect({ deviceId: 'device', name: 'B1' });

  assert.equal(result.modelId, 4096);
  assert.equal(result.protocolVersion, 5);
  assert.equal(client.ready, true);
  assert.deepEqual(session.calls.map((item) => item.command), [
    COMMAND.CONNECT,
    COMMAND.PRINTER_STATUS_DATA,
    ...new Array(8).fill(COMMAND.PRINTER_INFO),
    COMMAND.HEARTBEAT
  ]);
  assert.deepEqual(
    session.calls.filter((item) => item.command === COMMAND.PRINTER_INFO).map((item) => item.data[0]),
    [8, 11, 13, 10, 7, 3, 12, 9]
  );
  assert.deepEqual(session.calls[session.calls.length - 1].data, [4]);
  assert.deepEqual(session.calls[session.calls.length - 1].expected, RESPONSE.HEARTBEAT);
});

test('invalid connect results tear down the transport and never become ready', async () => {
  const session = new FakeSession(90);
  const client = new PrinterClient(session);

  await assert.rejects(client.connect({ deviceId: 'device' }), /状态 90/);
  assert.equal(client.ready, false);
  assert.equal(session.disconnections, 1);
});

test('print is rejected until protocol negotiation is complete', async () => {
  const session = new FakeSession(1);
  const client = new PrinterClient(session);
  await assert.rejects(client.print({}, {}, {}), /尚未完成协议协商/);
});

test('a transport reset clears protocol readiness and the negotiated device', async () => {
  const session = new FakeSession(1);
  const client = new PrinterClient(session);
  await client.connect({ deviceId: 'device', name: 'D110' });
  assert.equal(client.ready, true);
  assert.equal(client.deviceId, 'device');

  session.resetTransport();

  assert.equal(client.ready, false);
  assert.equal(client.deviceId, '');
  assert.equal(client.protocolVersion, 0);
});

test('connectExisting reuses GATT only after repeating the NIIMBOT protocol handshake', async () => {
  const session = new FakeSession(1);
  const client = new PrinterClient(session);

  const result = await client.connectExisting({ deviceId: 'device', name: 'D110' });

  assert.equal(session.existingConnections, 1);
  assert.equal(session.calls[0].command, COMMAND.CONNECT);
  assert.equal(result.deviceId, 'device');
  assert.equal(client.ready, true);
});

test('print completion wait fails immediately after a transport disconnect', async () => {
  const session = new FakeSession(1);
  const client = new PrinterClient(session);
  session.connected = false;
  await assert.rejects(
    client.waitUntilFinished({ task: 'b1' }, 1, () => {}),
    /连接已断开/
  );
  assert.equal(session.calls.length, 0);
});

test('fatal printer status errors are not swallowed as retryable timeouts', async () => {
  const session = new FakeSession(1);
  session.request = async () => {
    const error = new Error('打印机缺纸');
    error.code = 2;
    throw error;
  };
  const client = new PrinterClient(session);
  client.wait = async () => {};
  await assert.rejects(
    client.waitUntilFinished({ task: 'b1' }, 1, () => {}),
    /缺纸/
  );
});
