const test = require('node:test');
const assert = require('node:assert/strict');

const {
  COMMAND,
  RESPONSE,
  PacketParser,
  checksum,
  encodePacket
} = require('../src/core/protocol');

function bytes(value) {
  return Array.from(value);
}

test('encodePacket writes header, length, XOR checksum, and footer', () => {
  assert.equal(checksum(COMMAND.SET_DENSITY, [2]), 0x22);
  assert.deepEqual(bytes(encodePacket(COMMAND.SET_DENSITY, [2])), [
    0x55, 0x55, 0x21, 0x01, 0x02, 0x22, 0xaa, 0xaa
  ]);
});

test('encodePacket adds the connect preamble only to CONNECT packets', () => {
  assert.deepEqual(bytes(encodePacket(COMMAND.CONNECT, [1, 2])), [
    0x03, 0x55, 0x55, 0xc1, 0x02, 0x01, 0x02, 0xc0, 0xaa, 0xaa
  ]);
  assert.equal(encodePacket(COMMAND.PRINT_START, [1])[0], 0x55);
  assert.throws(() => encodePacket(COMMAND.PRINT_START, new Uint8Array(256)));
});

test('PacketParser keeps partial headers and parses a frame split at every byte', () => {
  const parser = new PacketParser();
  const frame = encodePacket(RESPONSE.SET_PAGE_SIZE, [0x01, 0x02, 0x03]);
  const packets = [];

  assert.deepEqual(parser.push([0xfe, 0xed, 0x55]), []);
  for (const byte of frame.slice(1)) {
    packets.push(...parser.push([byte]));
  }

  assert.equal(packets.length, 1);
  assert.equal(packets[0].command, RESPONSE.SET_PAGE_SIZE);
  assert.deepEqual(bytes(packets[0].data), [0x01, 0x02, 0x03]);
  assert.deepEqual(bytes(packets[0].raw), bytes(frame));
  assert.equal(parser.buffer.length, 0);
  assert.equal(parser.errors.length, 0);
});

test('PacketParser emits coalesced frames and recovers after a bad checksum', () => {
  const parser = new PacketParser();
  const corrupt = encodePacket(RESPONSE.PAGE_START, [1]).slice();
  corrupt[5] ^= 0xff;
  const first = encodePacket(RESPONSE.PRINT_START, [7]);
  const second = encodePacket(RESPONSE.PAGE_END, [8, 9]);

  const packets = parser.push(Uint8Array.from([
    ...corrupt,
    ...first,
    ...second
  ]));

  assert.equal(parser.errors.length, 1);
  assert.deepEqual(packets.map((packet) => packet.command), [
    RESPONSE.PRINT_START,
    RESPONSE.PAGE_END
  ]);
  assert.deepEqual(packets.map((packet) => bytes(packet.data)), [[7], [8, 9]]);

  parser.reset();
  assert.equal(parser.errors.length, 0);
  assert.equal(parser.buffer.length, 0);
});

