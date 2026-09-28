const test = require('node:test');
const assert = require('node:assert/strict');

const { encodeCode128, encodeCode128B } = require('../miniprogram/core/code128');

// Reads symbol values back with the ISO/IEC 15417 rules for sets B and C, so
// the auto encoder is checked against the standard rather than against itself.
const SPECIAL_PATTERNS = { 99: '113141', 100: '114131', 104: '211214', 105: '211232', 106: '2331112' };

function decodeSymbols(encoded) {
  const { symbols, patterns } = encoded;
  assert.equal(patterns.length, symbols.length);
  symbols.forEach((value, index) => {
    const width = patterns[index].split('').reduce((sum, digit) => sum + Number(digit), 0);
    assert.equal(width, value === 106 ? 13 : 11, `符号 ${value} 的模块宽度`);
    if (SPECIAL_PATTERNS[value]) assert.equal(patterns[index], SPECIAL_PATTERNS[value]);
  });
  assert.equal(symbols[symbols.length - 1], 106);
  const body = symbols.slice(0, -2);
  const checksum = body.reduce((sum, value, index) => sum + value * Math.max(1, index), 0) % 103;
  assert.equal(symbols[symbols.length - 2], checksum, '校验符');
  assert.ok(body[0] === 104 || body[0] === 105, '起始符只能是 B 或 C');
  let set = body[0] === 105 ? 'C' : 'B';
  let text = '';
  for (const value of body.slice(1)) {
    if (set === 'B' && value === 99) set = 'C';
    else if (set === 'C' && value === 100) set = 'B';
    else if (set === 'B') {
      assert.ok(value <= 94, `B 集数据符 ${value}`);
      text += String.fromCharCode(value + 32);
    } else {
      assert.ok(value <= 99, `C 集数据符 ${value}`);
      text += String(value).padStart(2, '0');
    }
  }
  return text;
}

test('Code 128 packs digit pairs into set C: 123456 is start C, 12, 34, 56', () => {
  const encoded = encodeCode128('123456');
  assert.deepEqual(encoded.symbols, [105, 12, 34, 56, 44, 106]);
  assert.equal(encoded.moduleCount, 88);
  assert.ok(encoded.moduleCount < encodeCode128B('123456').moduleCount);
});

test('Code 128 keeps text without long digit runs identical to set B', () => {
  for (const value of ['AB', 'ABC-100', 'PJJ123C', '123', 'A1B2C3', 'x']) {
    assert.deepEqual(encodeCode128(value), encodeCode128B(value));
  }
});

test('Code 128 round-trips mixed content and never needs more symbols than set B', () => {
  const samples = [
    '0', '00', '12', '1234', '12345', '0012', '6901234567892', '773012345678901',
    'SF1234567890123', 'JD0012345678901', 'ABC12345', '12345ABC', 'AB1234CD5678',
    'SN-2026-000123', 'A 1234 B 56789', '99999999999999999999'
  ];
  let seed = 7;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let index = 0; index < 300; index += 1) {
    let value = '';
    const length = 1 + Math.floor(random() * 24);
    while (value.length < length) {
      value += random() < 0.6 ? String(Math.floor(random() * 10)) : String.fromCharCode(32 + Math.floor(random() * 95));
    }
    samples.push(value);
  }
  for (const value of samples) {
    const encoded = encodeCode128(value);
    assert.equal(decodeSymbols(encoded), value);
    assert.ok(encoded.symbols.length <= encodeCode128B(value).symbols.length, value);
    const width = encoded.patterns.join('').split('').reduce((sum, digit) => sum + Number(digit), 0);
    assert.equal(encoded.moduleCount, width + 20);
  }
});

test('long numeric codes shrink enough to print on common label widths', () => {
  // 15-digit express number: 11 data/start/check symbols + stop + quiet zones.
  assert.equal(encodeCode128('773012345678901').moduleCount, 154);
  assert.equal(encodeCode128B('773012345678901').moduleCount, 220);
  assert.equal(encodeCode128('SF1234567890123').moduleCount, 165);
});

test('Code 128 explains unsupported characters in plain words', () => {
  assert.throws(() => encodeCode128(''), /不能为空/);
  assert.throws(() => encodeCode128('中文'), /二维码/);
  assert.throws(() => encodeCode128('line\nfeed'), /二维码/);
  assert.equal(decodeSymbols(encodeCode128(0)), '0');
});

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
