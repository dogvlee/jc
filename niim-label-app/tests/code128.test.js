const test = require('node:test');
const assert = require('node:assert/strict');

const { encodeCode128B } = require('../src/core/code128');

test('Code 128B emits start B, weighted checksum, stop, and quiet zones', () => {
  const encoded = encodeCode128B('AB');

  assert.deepEqual(encoded.symbols, [104, 33, 34, 102, 106]);
  assert.deepEqual(encoded.patterns, [
    '211214',
    '111323',
    '131123',
    '411131',
    '2331112'
  ]);
  assert.equal(encoded.moduleCount, 77);
});

test('Code 128B coerces values to text and calculates a stable checksum', () => {
  const encoded = encodeCode128B(123);

  assert.deepEqual(encoded.symbols, [104, 17, 18, 19, 8, 106]);
  assert.equal(encoded.moduleCount, 88);
});

test('Code 128B rejects empty and non-printable or non-ASCII input', () => {
  assert.throws(() => encodeCode128B(''));
  assert.throws(() => encodeCode128B('line\nfeed'));
  assert.throws(() => encodeCode128B('\u4e2d'));
});

