const test = require('node:test');
const assert = require('node:assert/strict');

const {
  encodeUpce,
  expandUpce,
  normalizeUpce,
  validateCompressedPayload
} = require('../src/core/upce');

test('UPC-E accepts 6, 7, and 8 digit forms and normalizes them to NS + payload + check', () => {
  const fromSix = encodeUpce('123455');
  const fromSeven = encodeUpce('0123455');
  const fromEight = encodeUpce('01234558');

  assert.equal(fromSix.text, '01234558');
  assert.equal(fromSeven.text, '01234558');
  assert.equal(fromEight.text, '01234558');
  assert.equal(fromSix.bits, fromSeven.bits);
  assert.equal(fromSeven.bits, fromEight.bits);
});

test('UPC-E expands every GS1 zero-suppression branch to its checked UPC-A value', () => {
  assert.equal(expandUpce('01234558'), '012345000058'); // final digit 5-9
  assert.equal(expandUpce('04567840'), '045670000080'); // final digit 4
  assert.equal(expandUpce('03456703'), '034000005673'); // final digit 0-2
  assert.equal(expandUpce('09847531'), '098400000751'); // final digit 3
});

test('UPC-E supports number systems 0 and 1, including NS 1 for six-digit input', () => {
  const explicitSeven = normalizeUpce('1123455');
  const optionSix = normalizeUpce('123455', { numberSystem: 1 });

  assert.deepEqual(explicitSeven, {
    numberSystem: 1,
    payload: '123455',
    checkDigit: '5',
    text: '11234555',
    upcaText: '112345000055'
  });
  assert.deepEqual(optionSix, explicitSeven);
  assert.equal(expandUpce('11234555'), '112345000055');
});

test('UPC-E emits the standard guards, parity, quiet zones, and renderer-compatible metrics', () => {
  const encoded = encodeUpce('01234558');
  const expectedCore = [
    '101',
    '0110011', // 1, even
    '0010011', // 2, odd
    '0100001', // 3, even
    '0100011', // 4, odd
    '0110001', // 5, odd
    '0111001', // 5, even
    '010101'
  ].join('');

  assert.equal(encoded.bits, `0000000000${expectedCore}0000000000`);
  assert.equal(encoded.bits.length, 71);
  assert.equal(encoded.moduleCount, 71);
  assert.match(encoded.bits, /^[01]+$/);
});

test('UPC-E validates check digits, length, characters, number system, and option conflicts', () => {
  assert.equal(encodeUpce(' 012 345 58 ').text, '01234558');
  assert.throws(() => encodeUpce(''), /6、7 或 8 位数字/);
  assert.throws(() => encodeUpce('12345'), /6、7 或 8 位数字/);
  assert.throws(() => encodeUpce('123456789'), /6、7 或 8 位数字/);
  assert.throws(() => encodeUpce('12A455'), /6、7 或 8 位数字/);
  assert.throws(() => encodeUpce('2123455'), /编号系统位只能是 0 或 1/);
  assert.throws(() => encodeUpce('123455', { numberSystem: 2 }), /编号系统位只能是 0 或 1/);
  assert.throws(() => encodeUpce('0123455', { numberSystem: 1 }), /编号系统位冲突/);
  assert.throws(() => encodeUpce('01234557'), /校验位应为 8/);
});

test('UPC-E rejects non-canonical compressed structures with actionable errors', () => {
  assert.throws(
    () => validateCompressedPayload('120453'),
    /末位为 3 时，第 3 位必须是 3–9/
  );
  assert.throws(
    () => encodeUpce('123054'),
    /末位为 4 时，第 4 位必须是 1–9/
  );
  assert.throws(
    () => expandUpce('01234058'),
    /末位为 5–9 时，第 5 位必须是 1–9/
  );
});
