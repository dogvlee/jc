const assert = require('node:assert/strict');
const test = require('node:test');

const { validateDocument } = require('../miniprogram/core/renderer');

test('QR validation supports UTF-8 content and rejects undersized elements', () => {
  const document = {
    elements: [{
      id: 'qr',
      type: 'qrcode',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      value: '中文标签'
    }]
  };
  assert.doesNotThrow(() => validateDocument(document, 203));
  document.elements[0].width = 1;
  document.elements[0].height = 1;
  assert.throws(() => validateDocument(document, 203), /二维码元素过小/);
});

test('barcode validation requires at least one printer dot per module', () => {
  const document = {
    elements: [{
      id: 'barcode',
      type: 'barcode',
      format: 'code128',
      width: 2,
      height: 8,
      value: '1234567890'
    }]
  };
  assert.throws(() => validateDocument(document, 203), /条码元素过窄/);
  document.elements[0].width = 30;
  assert.doesNotThrow(() => validateDocument(document, 203));
});
