const assert = require('node:assert/strict');
const test = require('node:test');

const { createDocument, createElement } = require('../miniprogram/core/document');
const {
  applyScanToElement,
  buildScanDocument,
  inferBarcodeFormat,
  normalizeScanResult
} = require('../miniprogram/core/scan-label');
const { validateCodeElement } = require('../miniprogram/core/code-quality');

test('scan results distinguish one-dimensional codes from QR content', () => {
  assert.equal(normalizeScanResult({ result: '6901234567892', scanType: 'EAN_13' }).kind, 'barcode');
  assert.equal(normalizeScanResult({ result: 'https://example.com', scanType: 'QR_CODE' }).kind, 'qrcode');
});

test('a scanned EAN-13 builds a centered editable barcode label', () => {
  const document = buildScanDocument({ result: '6901234567892', scanType: 'EAN_13' }, { widthMm: 40, heightMm: 30 });
  assert.equal(document.name, '条码 6901234567892');
  assert.equal(document.elements.length, 1);
  assert.equal(document.elements[0].type, 'barcode');
  assert.equal(document.elements[0].format, 'ean13');
  assert.equal(document.elements[0].value, '6901234567892');
  assert.equal(document.elements[0].x, (40 - document.elements[0].width) / 2);
});

test('a scanned QR code builds a square editable QR label', () => {
  const document = buildScanDocument({ result: '仓库-A-01', scanType: 'QR_CODE' }, { widthMm: 50, heightMm: 30 });
  const element = document.elements[0];
  assert.equal(document.name, '二维码 仓库-A-01');
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

test('a scanned 15-digit express number prints clearly on the default 40x12 label', () => {
  const document = buildScanDocument({ result: '773012345678901', scanType: 'CODE_128' }, { widthMm: 40, heightMm: 12 });
  const barcode = document.elements[0];
  assert.equal(barcode.format, 'code128');
  assert.doesNotThrow(() => validateCodeElement(barcode, 203));
  assert.ok(barcode.x >= 0 && barcode.x + barcode.width <= document.widthMm);
});

test('short codes keep comfortable side margins; overlong ones stay inside the label', () => {
  const ean = buildScanDocument({ result: '6901234567892', scanType: 'EAN_13' }, { widthMm: 40, heightMm: 12 }).elements[0];
  assert.equal(ean.width, 36);
  const long = buildScanDocument({ result: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123', scanType: 'CODE_128' }, { widthMm: 40, heightMm: 12 }).elements[0];
  assert.equal(long.width, 39);
  assert.equal(long.x, 0.5);
});

test('UPC-A keeps its exact bars by printing as the equivalent EAN-13', () => {
  const document = buildScanDocument({ result: '012345678905', scanType: 'UPC_A' }, { widthMm: 40, heightMm: 30 });
  assert.equal(document.elements[0].format, 'ean13');
  assert.equal(document.elements[0].value, '0012345678905');
  const existing = createElement('barcode', createDocument(40, 30));
  applyScanToElement(existing, { result: '012345678905', scanType: 'UPC_A' });
  assert.equal(existing.value, '0012345678905');
  assert.equal(existing.format, 'ean13');
});

test('every native one-dimensional scan type becomes a barcode', () => {
  for (const scanType of ['CODE_25', 'RSS_14', 'RSS_EXPANDED', 'EAN_8', 'UPC_E', 'ITF', 'CODABAR', 'CODE_39', 'CODE_93']) {
    assert.equal(normalizeScanResult({ result: '12345670', scanType }).kind, 'barcode', scanType);
  }
  for (const scanType of ['QR_CODE', 'DATA_MATRIX', 'PDF_417', 'AZTEC']) {
    assert.equal(normalizeScanResult({ result: 'x', scanType }).kind, 'qrcode', scanType);
  }
});

test('scanned labels are named after a short, single-line preview of the content', () => {
  const url = buildScanDocument({ result: 'https://www.example.com/products/2026/autumn?id=1', scanType: 'QR_CODE' }, {});
  assert.equal(url.name, '二维码 example.com/produc…');
  const lines = buildScanDocument({ result: '货架 A\n第 3 层', scanType: 'QR_CODE' }, {});
  assert.equal(lines.name, '二维码 货架 A 第 3 层');
  const emoji = buildScanDocument({ result: '😀'.repeat(30), scanType: 'QR_CODE' }, {});
  assert.equal(emoji.name, `二维码 ${'😀'.repeat(18)}…`);
});
