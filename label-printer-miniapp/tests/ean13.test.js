const assert = require('node:assert/strict');
const test = require('node:test');

const { checksum, encodeEan13 } = require('../miniprogram/core/ean13');

test('EAN-13 calculates and validates the check digit', () => {
  assert.equal(checksum('690123456789'), 2);
  const fromTwelve = encodeEan13('690123456789');
  const fromThirteen = encodeEan13('6901234567892');
  assert.equal(fromTwelve.text, '6901234567892');
  assert.equal(fromTwelve.bits, fromThirteen.bits);
  assert.equal(fromTwelve.bits.length, 115);
  assert.equal(fromTwelve.bits.slice(10, 13), '101');
});

test('EAN-13 rejects non-digits and an invalid check digit', () => {
  assert.throws(() => encodeEan13('ABC'), /12 或 13 位数字/);
  assert.throws(() => encodeEan13('6901234567893'), /校验位应为 2/);
});
