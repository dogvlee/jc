const qrcode = require('../vendor/qrcode');
const { encodeCode128B } = require('./code128');
const { encodeEan13 } = require('./ean13');

const QR_QUIET_ZONE_MODULES = 4;
const MIN_CODE_DOTS_PER_MODULE = 2;
const DOT_EPSILON = 1e-6;

if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
}

function encodeElement(element) {
  if (element.type === 'barcode') {
    const encoded = element.format === 'ean13'
      ? encodeEan13(element.value)
      : encodeCode128B(element.value);
    return {
      kind: 'barcode',
      moduleCount: encoded.moduleCount,
      axisMm: Number(element.width)
    };
  }
  if (element.type === 'qrcode') {
    const code = qrcode(0, element.errorCorrection || 'M');
    code.addData(String(element.value || ''), 'Byte');
    code.make();
    return {
      kind: 'qrcode',
      moduleCount: code.getModuleCount() + QR_QUIET_ZONE_MODULES * 2,
      axisMm: Math.min(Number(element.width), Number(element.height))
    };
  }
  return null;
}

function codePrintMetrics(element, dpi, minimumDotsPerModule) {
  const dotsPerInch = Number(dpi);
  const minimum = Math.max(1, Number(minimumDotsPerModule) || MIN_CODE_DOTS_PER_MODULE);
  if (!Number.isFinite(dotsPerInch) || dotsPerInch <= 0) {
    throw new Error('打印分辨率无效');
  }
  if (element && element.type === 'barcode'
    && (element.unsupportedCodeType === true || element.requiresFormatConfirmation === true
      || !['code128', 'ean13'].includes(String(element.format || '').toLowerCase()))) {
    const declared = String(element.declaredFormat || element.sourceCodeType || '未知码制');
    const error = new Error(`源条码声明为 ${declared}，当前不能安全确认码制；请明确选择 Code128 或 EAN-13`);
    error.code = 'UNSUPPORTED_CODE_TYPE';
    error.elementId = element.id || '';
    error.elementType = element.type;
    throw error;
  }
  if (element && element.type === 'barcode' && element.invalidCode === true) {
    const error = new Error(element.codeValidationMessage || '条码内容不符合当前码制，请修改内容或明确选择 Code128');
    error.code = 'INVALID_CODE_CONTENT';
    error.elementId = element.id || '';
    error.elementType = element.type;
    throw error;
  }
  if (element && (element.type === 'barcode' || element.type === 'qrcode')
    && (!String(element.value == null ? '' : element.value).trim() || element.requiresInput === true)) {
    const label = element.type === 'qrcode' ? '二维码' : '条码';
    const error = new Error(`请先填写${label}内容`);
    error.code = 'CODE_INPUT_REQUIRED';
    error.elementId = element.id || '';
    error.elementType = element.type;
    throw error;
  }
  let encoded;
  try {
    encoded = encodeElement(element);
  } catch (cause) {
    const error = new Error(cause.message);
    error.code = 'INVALID_CODE_CONTENT';
    error.elementId = element && element.id || '';
    error.elementType = element && element.type || '';
    error.cause = cause;
    throw error;
  }
  if (!encoded) return null;
  const availableDotsExact = encoded.axisMm * dotsPerInch / 25.4;
  if (!Number.isFinite(availableDotsExact) || availableDotsExact <= 0) {
    const error = new Error(encoded.kind === 'qrcode' ? '二维码尺寸必须大于 0' : '条码宽度必须大于 0');
    error.code = 'INVALID_CODE_SIZE';
    error.elementId = element && element.id || '';
    error.elementType = element && element.type || '';
    throw error;
  }
  const requiredDots = encoded.moduleCount * minimum;
  const minimumMm = requiredDots * 25.4 / dotsPerInch;
  return {
    kind: encoded.kind,
    moduleCount: encoded.moduleCount,
    availableDots: Math.floor(availableDotsExact + DOT_EPSILON),
    dotsPerModule: availableDotsExact / encoded.moduleCount,
    minimumDotsPerModule: minimum,
    requiredDots,
    minimumMm,
    minimumMmRounded: Math.ceil(minimumMm * 10 - DOT_EPSILON) / 10,
    ok: availableDotsExact + DOT_EPSILON >= requiredDots
  };
}

function validateCodeElement(element, dpi, minimumDotsPerModule) {
  const metrics = codePrintMetrics(element, dpi, minimumDotsPerModule);
  if (!metrics || metrics.ok) return metrics;
  const label = metrics.kind === 'qrcode' ? '二维码' : '条码';
  const dimension = metrics.kind === 'qrcode'
    ? `宽高至少 ${metrics.minimumMmRounded.toFixed(1)} mm`
    : `宽度至少 ${metrics.minimumMmRounded.toFixed(1)} mm`;
  const hint = metrics.kind === 'qrcode'
    ? '请放大二维码，或缩短内容后重试'
    : '请加宽条码，或缩短内容后重试';
  const error = new Error(
    `${label}清晰度不足：当前约 ${metrics.dotsPerModule.toFixed(2)} 打印点/模块，` +
    `${dimension}（${metrics.minimumDotsPerModule} 打印点/模块）；${hint}`
  );
  error.code = 'CODE_MODULE_DENSITY_LOW';
  error.elementId = element && element.id || '';
  error.elementType = element && element.type || '';
  error.metrics = metrics;
  throw error;
}

/**
 * User-triggered repair: enlarge only the code box, never rewrite its value or
 * symbology. The caller must redraw the editor so any layout interaction stays
 * visible and undoable.
 */
function resizeCodeElementToMinimum(element, document, dpi) {
  const metrics = codePrintMetrics(element, dpi);
  if (!metrics || metrics.ok) return { ok: true, changed: false, metrics };
  const docWidth = Number(document && document.widthMm);
  const docHeight = Number(document && document.heightMm);
  const desiredWidth = metrics.kind === 'qrcode' ? metrics.minimumMmRounded : metrics.minimumMmRounded;
  const desiredHeight = metrics.kind === 'qrcode' ? metrics.minimumMmRounded : Number(element.height);
  const radians = Number(element.rotation || 0) * Math.PI / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  const projectedWidth = cosine * desiredWidth + sine * desiredHeight;
  const projectedHeight = sine * desiredWidth + cosine * desiredHeight;
  if (!Number.isFinite(docWidth) || !Number.isFinite(docHeight)
    || projectedWidth > docWidth + DOT_EPSILON || projectedHeight > docHeight + DOT_EPSILON) {
    const label = metrics.kind === 'qrcode' ? '二维码' : '条码';
    return {
      ok: false,
      changed: false,
      metrics,
      message: `${label}达到 2 打印点/模块需要更大空间，当前标签放不下；请缩短编码内容或改用更大的标签纸。`
    };
  }
  const centerX = (Number(element.x) || 0) + (Number(element.width) || 0) / 2;
  const centerY = (Number(element.y) || 0) + (Number(element.height) || 0) / 2;
  const halfExtentX = projectedWidth / 2;
  const halfExtentY = projectedHeight / 2;
  const nextCenterX = Math.max(halfExtentX, Math.min(centerX, docWidth - halfExtentX));
  const nextCenterY = Math.max(halfExtentY, Math.min(centerY, docHeight - halfExtentY));
  element.width = desiredWidth;
  element.height = desiredHeight;
  element.x = nextCenterX - desiredWidth / 2;
  element.y = nextCenterY - desiredHeight / 2;
  return { ok: true, changed: true, metrics };
}

module.exports = {
  MIN_CODE_DOTS_PER_MODULE,
  QR_QUIET_ZONE_MODULES,
  codePrintMetrics,
  resizeCodeElementToMinimum,
  validateCodeElement
};
