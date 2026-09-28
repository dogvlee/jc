const { createDocument, createElement } = require('./document');
const { codePrintMetrics } = require('./code-quality');
const { checksum: ean13Checksum, isValidEan13 } = require('./ean13');

const MAX_SCAN_VALUE_LENGTH = 500;
const MAX_BARCODE_VALUE_LENGTH = 80;
// Every built-in printer profile is 203 dpi; callers may pass the active one.
const DEFAULT_DPI = 203;
const NAME_PREVIEW_LENGTH = 18;
const ONE_DIMENSIONAL_TYPES = [
  'BARCODE', 'EAN13', 'EAN8', 'CODE128', 'CODE39', 'CODE93', 'CODE25', 'CODABAR', 'UPC', 'ITF', 'RSS14', 'RSSEXPANDED'
];

function normalizedScanType(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isOneDimensionalType(scanType) {
  const type = normalizedScanType(scanType);
  return ONE_DIMENSIONAL_TYPES.some((name) => type.includes(name));
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
  return isValidEan13(value) ? 'ean13' : 'code128';
}

/**
 * UPC-A is EAN-13 with a leading 0: same bars, so the label scans exactly like
 * the original. Other one-dimensional types keep their content in Code 128.
 */
function barcodeContent(value, scanType) {
  const text = String(value || '');
  if (normalizedScanType(scanType).includes('UPCA') && /^\d{12}$/.test(text)
    && ean13Checksum(`0${text.slice(0, 11)}`) === Number(text[11])) {
    return { value: `0${text}`, format: 'ean13' };
  }
  return { value: text, format: inferBarcodeFormat(text, scanType) };
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
    const content = barcodeContent(scan.value, scan.scanType);
    element.value = content.value;
    element.format = content.format;
  } else {
    element.value = scan.value;
  }
  return element;
}

function scanLabelName(scan) {
  let preview = scan.value.replace(/\s+/g, ' ').trim();
  if (scan.kind === 'qrcode') preview = preview.replace(/^https?:\/\/(www\.)?/i, '');
  const characters = Array.from(preview);
  if (characters.length > NAME_PREVIEW_LENGTH) preview = `${characters.slice(0, NAME_PREVIEW_LENGTH).join('')}…`;
  return `${scan.kind === 'barcode' ? '条码' : '二维码'} ${preview}`.trim();
}

// Width a barcode needs for 2 print dots per module; 0 when it cannot be encoded.
function minimumBarcodeWidthMm(element, dpi) {
  try {
    const metrics = codePrintMetrics(element, dpi);
    return metrics ? metrics.minimumMmRounded : 0;
  } catch (error) {
    return 0;
  }
}

function buildScanDocument(payload, options) {
  const scan = normalizeScanResult(payload);
  const config = options || {};
  const widthMm = Math.max(5, Math.min(150, Number(config.widthMm) || 50));
  const heightMm = Math.max(5, Math.min(150, Number(config.heightMm) || 30));
  const document = createDocument(widthMm, heightMm);
  document.name = scanLabelName(scan);
  document.elements = [];

  const element = createElement(scan.kind, document);
  applyScanToElement(element, payload);
  if (scan.kind === 'barcode') {
    // Keep 2 mm side margins when they fit; long codes may widen to 0.5 mm
    // margins because the symbol already carries its own quiet zones.
    const required = minimumBarcodeWidthMm(element, Number(config.dpi) || DEFAULT_DPI);
    element.width = Math.max(1, Math.min(widthMm - 1, Math.max(widthMm - 4, required)));
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
  barcodeContent,
  buildScanDocument,
  inferBarcodeFormat,
  isOneDimensionalType,
  normalizeScanResult
};
