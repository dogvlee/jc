const { createDocument, createElement } = require('./document');

const MAX_SCAN_VALUE_LENGTH = 500;
const MAX_BARCODE_VALUE_LENGTH = 80;

function normalizedScanType(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isOneDimensionalType(scanType) {
  const type = normalizedScanType(scanType);
  return ['BARCODE', 'EAN13', 'EAN8', 'CODE128', 'CODE39', 'CODE93', 'CODABAR', 'UPC', 'UPCA', 'UPCE', 'ITF']
    .some((name) => type.includes(name));
}

function normalizeScanResult(payload) {
  const value = String(payload && payload.result != null ? payload.result : '');
  if (!value.trim()) {
    const error = new Error('没有识别到可用内容，请重新扫描');
    error.code = 'SCAN_EMPTY';
    throw error;
  }
  if (value.length > MAX_SCAN_VALUE_LENGTH) {
    const error = new Error(`扫码内容超过 ${MAX_SCAN_VALUE_LENGTH} 个字符，无法放入标签`);
    error.code = 'SCAN_TOO_LONG';
    throw error;
  }
  const scanType = String(payload.scanType || '');
  return {
    value,
    scanType,
    kind: isOneDimensionalType(scanType) ? 'barcode' : 'qrcode'
  };
}

function inferBarcodeFormat(value, scanType) {
  const type = normalizedScanType(scanType);
  if (type.includes('EAN13')) return 'ean13';
  if (type && type !== 'BARCODE') return 'code128';
  return /^\d{12,13}$/.test(String(value || '')) ? 'ean13' : 'code128';
}

function assertBarcodeValue(value) {
  if (value.length > MAX_BARCODE_VALUE_LENGTH) {
    const error = new Error(`一维码内容不能超过 ${MAX_BARCODE_VALUE_LENGTH} 个字符`);
    error.code = 'BARCODE_TOO_LONG';
    throw error;
  }
  if (!/^[\x20-\x7E]+$/.test(value)) {
    const error = new Error('当前 Code 128 仅支持 ASCII 字符；请改用二维码');
    error.code = 'BARCODE_UNSUPPORTED_TEXT';
    throw error;
  }
}

function applyScanToElement(element, payload) {
  if (!element || (element.type !== 'barcode' && element.type !== 'qrcode')) {
    const error = new Error('请先选择条码或二维码元素');
    error.code = 'SCAN_TARGET_UNSUPPORTED';
    throw error;
  }
  const scan = normalizeScanResult(payload);
  if (element.type === 'barcode') {
    if (scan.kind !== 'barcode') {
      const error = new Error('当前选中的是一维码，请扫描商品条码；二维码内容请放入二维码元素');
      error.code = 'SCAN_KIND_MISMATCH';
      throw error;
    }
    assertBarcodeValue(scan.value);
    element.value = scan.value;
    element.format = inferBarcodeFormat(scan.value, scan.scanType);
  } else {
    element.value = scan.value;
  }
  return element;
}

function buildScanDocument(payload, options) {
  const scan = normalizeScanResult(payload);
  const config = options || {};
  const widthMm = Math.max(5, Math.min(150, Number(config.widthMm) || 50));
  const heightMm = Math.max(5, Math.min(150, Number(config.heightMm) || 30));
  const document = createDocument(widthMm, heightMm);
  document.name = scan.kind === 'barcode' ? '扫码条码标签' : '扫码二维码标签';
  document.elements = [];

  const element = createElement(scan.kind, document);
  applyScanToElement(element, payload);
  if (scan.kind === 'barcode') {
    element.width = Math.max(1, widthMm - 4);
    element.height = Math.max(1, Math.min(14, heightMm * 0.52, heightMm - 2));
  } else {
    const size = Math.max(1, Math.min(24, widthMm - 2, heightMm - 2));
    element.width = size;
    element.height = size;
  }
  element.x = (widthMm - element.width) / 2;
  element.y = (heightMm - element.height) / 2;
  document.elements.push(element);
  return document;
}

module.exports = {
  MAX_BARCODE_VALUE_LENGTH,
  MAX_SCAN_VALUE_LENGTH,
  applyScanToElement,
  buildScanDocument,
  inferBarcodeFormat,
  isOneDimensionalType,
  normalizeScanResult
};
