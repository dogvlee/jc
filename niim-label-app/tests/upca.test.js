const test = require('node:test');
const assert = require('node:assert/strict');

const { checksum, encodeUpca } = require('../src/core/upca');
const { encodeEan13 } = require('../src/core/ean13');
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

test('UPC-A calculates the standard modulo-10 check digit', () => {
  assert.equal(checksum('03600029145'), 2);
  assert.equal(checksum('04210000526'), 4);
});

test('UPC-A appends or validates its check digit and encodes as zero-prefixed EAN-13', () => {
  const fromEleven = encodeUpca('03600029145');
  const fromTwelve = encodeUpca('036000291452');
  const equivalentEan = encodeEan13('0036000291452');

  assert.equal(fromEleven.text, '036000291452');
  assert.equal(fromTwelve.text, '036000291452');
  assert.equal(fromEleven.bits, fromTwelve.bits);
  assert.equal(fromEleven.bits, equivalentEan.bits);
  assert.equal(fromEleven.bits.length, 115);
  assert.equal(fromEleven.moduleCount, 115);
  assert.equal(fromEleven.bits.slice(10, 13), '101');
  assert.equal(fromEleven.bits.slice(-13, -10), '101');
});

test('UPC-A accepts display whitespace but rejects bad length, characters, and checksum', () => {
  assert.equal(encodeUpca('036 000 29145').text, '036000291452');
  assert.throws(() => checksum('123'), /11 或 12 位数字/);
  assert.throws(() => encodeUpca(''), /11 或 12 位数字/);
  assert.throws(() => encodeUpca('0360002914'), /11 或 12 位数字/);
  assert.throws(() => encodeUpca('0360002914523'), /11 或 12 位数字/);
  assert.throws(() => encodeUpca('03600029A45'), /11 或 12 位数字/);
  assert.throws(() => encodeUpca('036000291453'), /校验位应为 2/);
});

test('code-quality recognizes UPC-A and preserves actionable invalid-content metadata', () => {
  const element = {
    id: 'upca-good', type: 'barcode', format: 'upca', value: '036000291452', width: 60, height: 12
  };
  const metrics = codePrintMetrics(element, 203);
  assert.equal(metrics.moduleCount, encodeUpca(element.value).moduleCount);
  assert.equal(metrics.ok, true);
  assert.doesNotThrow(() => validateCodeElement(element, 203));

  assert.throws(() => validateCodeElement({
    ...element, id: 'upca-bad', value: '036000291453'
  }, 203), (error) => {
    assert.equal(error.code, 'INVALID_CODE_CONTENT');
    assert.equal(error.elementId, 'upca-bad');
    assert.equal(error.elementType, 'barcode');
    assert.match(error.message, /UPC-A 校验位应为 2/);
    return true;
  });
});

test('renderer validates, paints, and labels UPC-A as 12 digits', () => {
  const document = {
    elements: [{
      id: 'render-upca',
      type: 'barcode',
      format: 'upca',
      value: '03600029145',
      x: 0,
      y: 0,
      width: 60,
      height: 12,
      showText: true,
      textPosition: 'bottom',
      fontSize: 2.5
    }]
  };
  assert.doesNotThrow(() => validateDocument(document, 203));
  const context = barcodeContext();
  renderDocument(context, document, { width: 60, height: 12 }, 25.4, {});
  assert.ok(context.fillRects.length > 2, 'UPC-A should paint bars plus the paper background');
  assert.deepEqual(context.textCalls, ['036000291452']);
});
