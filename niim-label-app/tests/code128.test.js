const test = require('node:test');
const assert = require('node:assert/strict');

const {
  encodeCode128,
  encodeCode128A,
  encodeCode128B,
  encodeCode128C
} = require('../src/core/code128');
const { codePrintMetrics, validateCodeElement } = require('../src/core/code-quality');
const { renderDocument, validateDocument } = require('../src/core/renderer');

function barcodeContext() {
  return {
    fillRects: [],
    textCalls: [],
    fillStyle: '#000000',
    font: '10px sans-serif',
    textAlign: 'left',
    textBaseline: 'top',
    clearRect() {},
    fillRect(x, y, width, height) { this.fillRects.push({ x, y, width, height, color: this.fillStyle }); },
    fillText(value) { this.textCalls.push(String(value)); },
    restore() {},
    rotate() {},
    save() {},
    scale() {},
    setTransform() {},
    translate() {}
  };
}

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
  assert.throws(() => encodeCode128B(''), /内容不能为空/);
  assert.throws(() => encodeCode128B('line\nfeed'), /ASCII 32-126/);
  assert.throws(() => encodeCode128B('\u4e2d'), /ASCII 32-126/);
  assert.throws(() => encodeCode128B('\x7f'), /ASCII 32-126/);
});

test('Code 128A maps control characters and uses the weighted modulo-103 checksum', () => {
  const encoded = encodeCode128A('\x00A');

  // Start A=103, NUL=64, A=33; (103 + 64*1 + 33*2) % 103 = 27.
  assert.deepEqual(encoded.symbols, [103, 64, 33, 27, 106]);
  assert.deepEqual(encoded.patterns, [
    '211412',
    '111422',
    '111323',
    '312212',
    '2331112'
  ]);
  assert.equal(encoded.moduleCount, 77);
  assert.equal(encoded.text, '\x00A');
});

test('Code 128A rejects subset-B-only and non-ASCII characters', () => {
  assert.throws(() => encodeCode128A(''), /内容不能为空/);
  assert.throws(() => encodeCode128A('`'), /ASCII 0-95/);
  assert.throws(() => encodeCode128A('\u4e2d'), /ASCII 0-95/);
});

test('Code 128C pairs digits and calculates its checksum from pair values', () => {
  const encoded = encodeCode128C('001234');

  // Start C=105, pairs 00/12/34; (105 + 0*1 + 12*2 + 34*3) % 103 = 25.
  assert.deepEqual(encoded.symbols, [105, 0, 12, 34, 25, 106]);
  assert.deepEqual(encoded.patterns, [
    '211232',
    '212222',
    '112232',
    '131123',
    '321122',
    '2331112'
  ]);
  assert.equal(encoded.moduleCount, 88);
});

test('Code 128C rejects empty, odd-length, and non-numeric content', () => {
  assert.throws(() => encodeCode128C(''), /内容不能为空/);
  assert.throws(() => encodeCode128C('123'), /偶数位数字/);
  assert.throws(() => encodeCode128C('12A4'), /偶数位数字/);
  assert.throws(() => encodeCode128C('12 34'), /偶数位数字/);
});

test('Code 128 auto compacts even numeric runs and otherwise retains subset B compatibility', () => {
  assert.deepEqual(encodeCode128('001234').symbols, encodeCode128C('001234').symbols);
  assert.deepEqual(encodeCode128('AB12').symbols, encodeCode128B('AB12').symbols);
  assert.deepEqual(encodeCode128('12').symbols, encodeCode128B('12').symbols);
  assert.deepEqual(encodeCode128('AB', 'A').symbols, encodeCode128A('AB').symbols);
  assert.deepEqual(encodeCode128('AB', 'b').symbols, encodeCode128B('AB').symbols);
  assert.deepEqual(encodeCode128('0012', 'C').symbols, encodeCode128C('0012').symbols);
  assert.throws(() => encodeCode128('line\nfeed'), /ASCII 32-126/);
});

test('code-quality recognizes Code128 auto, A, B, and C without falling back to another format', () => {
  const cases = [
    ['code128', '001234', encodeCode128('001234').moduleCount],
    ['code128a', '\x00A', encodeCode128A('\x00A').moduleCount],
    ['code128b', 'AB12', encodeCode128B('AB12').moduleCount],
    ['code128c', '001234', encodeCode128C('001234').moduleCount]
  ];
  cases.forEach(([format, value, moduleCount]) => {
    const element = { id: format, type: 'barcode', format, value, width: 60, height: 12 };
    const metrics = codePrintMetrics(element, 203);
    assert.equal(metrics.moduleCount, moduleCount, `${format} must use its own encoder`);
    assert.equal(metrics.ok, true);
    assert.doesNotThrow(() => validateCodeElement(element, 203));
  });

  assert.throws(() => validateCodeElement({
    id: 'bad-c', type: 'barcode', format: 'code128c', value: '123', width: 60, height: 12
  }, 203), (error) => {
    assert.equal(error.code, 'INVALID_CODE_CONTENT');
    assert.equal(error.elementId, 'bad-c');
    assert.match(error.message, /偶数位数字/);
    return true;
  });
});

test('renderer validates and paints every Code128 format', () => {
  const cases = [
    ['code128', '001234'],
    ['code128a', '\x00A'],
    ['code128b', 'AB12'],
    ['code128c', '001234']
  ];
  cases.forEach(([format, value]) => {
    const document = {
      elements: [{
        id: `render-${format}`,
        type: 'barcode',
        format,
        value,
        x: 0,
        y: 0,
        width: 60,
        height: 12,
        showText: false
      }]
    };
    assert.doesNotThrow(() => validateDocument(document, 203));
    const context = barcodeContext();
    renderDocument(context, document, { width: 60, height: 12 }, 25.4, {});
    assert.ok(context.fillRects.length > 2, `${format} should paint bars plus the paper background`);
  });
});

