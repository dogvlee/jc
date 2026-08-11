const assert = require('node:assert/strict');
const test = require('node:test');

const { createDocument, createElement } = require('../miniprogram/core/document');
const {
  applyScanToElement,
  buildScanDocument,
  inferBarcodeFormat,
  normalizeScanResult
} = require('../miniprogram/core/scan-label');

test('scan results distinguish one-dimensional codes from QR content', () => {
  assert.equal(normalizeScanResult({ result: '6901234567892', scanType: 'EAN_13' }).kind, 'barcode');
  assert.equal(normalizeScanResult({ result: 'https://example.com', scanType: 'QR_CODE' }).kind, 'qrcode');
});

test('a scanned EAN-13 builds a centered editable barcode label', () => {
  const document = buildScanDocument({ result: '6901234567892', scanType: 'EAN_13' }, { widthMm: 40, heightMm: 30 });
  assert.equal(document.name, '扫码条码标签');
  assert.equal(document.elements.length, 1);
  assert.equal(document.elements[0].type, 'barcode');
  assert.equal(document.elements[0].format, 'ean13');
  assert.equal(document.elements[0].value, '6901234567892');
  assert.equal(document.elements[0].x, (40 - document.elements[0].width) / 2);
});

test('a scanned QR code builds a square editable QR label', () => {
  const document = buildScanDocument({ result: '仓库-A-01', scanType: 'QR_CODE' }, { widthMm: 50, heightMm: 30 });
  const element = document.elements[0];
  assert.equal(document.name, '扫码二维码标签');
  assert.equal(element.type, 'qrcode');
  assert.equal(element.value, '仓库-A-01');
  assert.equal(element.width, element.height);
});

test('scanning into an existing barcode updates value and format', () => {
  const document = createDocument(40, 30);
  const barcode = createElement('barcode', document);
  applyScanToElement(barcode, { result: 'ABC-100', scanType: 'CODE_128' });
  assert.equal(barcode.value, 'ABC-100');
  assert.equal(barcode.format, 'code128');
  assert.equal(inferBarcodeFormat('123456789012', 'CODE_128'), 'code128');
  assert.equal(inferBarcodeFormat('123456789012', 'barCode'), 'ean13');
});

test('a QR result cannot silently replace a one-dimensional barcode', () => {
  const document = createDocument(40, 30);
  const barcode = createElement('barcode', document);
  assert.throws(
    () => applyScanToElement(barcode, { result: 'https://example.com', scanType: 'QR_CODE' }),
    (error) => error.code === 'SCAN_KIND_MISMATCH'
  );
  assert.equal(barcode.value, '0');
});

test('empty and oversized scan payloads are rejected', () => {
  assert.throws(() => normalizeScanResult({ result: '  ', scanType: 'QR_CODE' }), /没有识别/);
  assert.throws(() => normalizeScanResult({ result: 'x'.repeat(501), scanType: 'QR_CODE' }), /超过 500/);
});

test('QR payload whitespace is preserved and tiny stock never overflows', () => {
  const document = buildScanDocument({ result: '  payload  ', scanType: 'QR_CODE' }, { widthMm: 5, heightMm: 5 });
  const element = document.elements[0];
  assert.equal(element.value, '  payload  ');
  assert.ok(element.x >= 0 && element.y >= 0);
  assert.ok(element.x + element.width <= document.widthMm);
  assert.ok(element.y + element.height <= document.heightMm);
});
