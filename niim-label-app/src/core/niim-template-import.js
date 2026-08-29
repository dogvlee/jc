/**
 * Convert NIIMBOT / 精臣 template JSON (local research extracts) into our
 * offline document model. Coordinates stay in mm.
 */
const { clampElement, createDocument, createElement } = require('./document');
const { normalizeElementFont } = require('./font-family');
const { encodeEan13 } = require('./ean13');

const ALIGN_H = { 0: 'left', 1: 'center', 2: 'right' };
const ALIGN_V = { 0: 'top', 1: 'middle', 2: 'bottom' };
const EDITABLE_SEMANTIC_TYPES = new Set([
  'text', 'date', 'serial', 'barcode', 'qrcode', 'table', 'material'
]);

/** NIIM codeType → our barcode/qr format (observed in APK samples). */
const CODE_TYPE_MAP = {
  20: 'code128',
  21: 'code128',
  22: 'code39',
  23: 'code128',
  24: 'ean13',
  25: 'ean13',
  26: 'code128',
  30: 'qr',
  31: 'qr',
  32: 'qr'
};

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampSize(value, min = 0.5, max = 500) {
  const n = num(value, min);
  return Math.max(min, Math.min(max, n));
}

function mapAlignH(value) {
  if (typeof value === 'string') {
    const s = value.toLowerCase();
    if (s === 'left' || s === 'center' || s === 'right') return s;
  }
  return ALIGN_H[num(value, 0)] || 'left';
}

function mapAlignV(value) {
  if (typeof value === 'string') {
    const s = value.toLowerCase();
    if (s === 'top' || s === 'middle' || s === 'bottom' || s === 'center') {
      return s === 'center' ? 'middle' : s;
    }
  }
  return ALIGN_V[num(value, 1)] || 'middle';
}

function parseFontStyle(fontStyle) {
  const list = Array.isArray(fontStyle) ? fontStyle : [];
  const lower = list.map((item) => String(item).toLowerCase());
  return {
    bold: lower.includes('bold') || lower.includes('boldfont'),
    italic: lower.includes('italic'),
    underline: lower.includes('underline')
  };
}

function isMissingImagePath(value) {
  const path = String(value == null ? '' : value).trim();
  if (!path) return true;
  return /(?:^|[\\/])(?:文件不存在|null|undefined|not[ _-]?found)(?:\.[^\\/]*)?$/i.test(path);
}

function resolveImagePath(raw = {}) {
  return [raw.imageUrl, raw.localImageUrl, raw.ninePatchUrl, raw.localUrl]
    .map((value) => String(value == null ? '' : value).trim())
    .find((value) => !isMissingImagePath(value)) || '';
}

function elementText(raw) {
  const candidates = [raw.value, raw.valueText, raw.content, raw.text, raw.contentTitle];
  for (const item of candidates) {
    if (item != null && String(item).length) return String(item);
  }
  return '';
}

function resolveBoundText(raw, modify) {
  let text = elementText(raw);
  const title = raw.contentTitle ? String(raw.contentTitle) : '';
  const id = raw.id != null ? String(raw.id) : '';
  const mod = (modify && (modify[id] || modify[raw.id])) || null;
  const useTitle = mod && (mod[0] ? mod[0].useTitle : mod.useTitle);
  const delimiter = (mod && (mod[0] ? mod[0].delimiter : mod.delimiter)) || '：';

  if (useTitle && title) {
    return title + delimiter + text;
  }
  if (!text && title) return title;
  return text;
}

function isExplicitFill(value) {
  return value === true || value === 1;
}

function isExplicitLock(value) {
  return value === true || value === 1;
}

function setImportedCodeValue(element, raw, modify) {
  const value = resolveBoundText(raw, modify);
  element.value = value;
  if (!String(value).trim()) {
    element.requiresInput = true;
    element.requiresInputReason = 'empty-code';
  } else if (hasDataBinding(raw)) {
    element.requiresInput = true;
    element.requiresInputReason = 'data-binding';
  } else if (isGenericCodeValue(value)) {
    element.requiresInput = true;
    element.requiresInputReason = 'sample-code';
  } else {
    element.requiresInput = false;
  }
  return element;
}

function unlockFullyLockedSemanticElements(document) {
  const elements = Array.isArray(document && document.elements) ? document.elements : [];
  const semantic = elements.filter((element) => EDITABLE_SEMANTIC_TYPES.has(element.type));
  if (!semantic.length || !semantic.every((element) => element.locked)) return 0;
  semantic.forEach((element) => {
    element.sourceLocked = true;
    element.locked = false;
  });
  return semantic.length;
}

function tableCellText(value, seen) {
  if (value == null) return '';
  if (typeof value !== 'object') return String(value);

  const visited = seen || [];
  if (visited.includes(value)) return '';
  visited.push(value);

  if (Array.isArray(value)) {
    return value
      .map((item) => tableCellText(item, visited))
      .filter((item) => item.length > 0)
      .join(' ');
  }

  const contentKeys = [
    'text', 'value', 'content', 'name', 'label',
    'valueText', 'contentTitle', 'title'
  ];
  for (const key of contentKeys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const text = tableCellText(value[key], visited);
    if (text.length > 0) return text;
  }

  // Some NIIM exports wrap a cell payload before exposing its text field.
  for (const key of ['data', 'cell', 'payload', 'properties']) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const text = tableCellText(value[key], visited);
    if (text.length > 0) return text;
  }
  return '';
}

function hasDataBinding(raw = {}) {
  return Array.isArray(raw.dataBind) && raw.dataBind.length > 0;
}

function isKnownTextPlaceholder(value) {
  const text = String(value == null ? '' : value).trim();
  return text === '双击编辑' || text === '双击文本框编辑' || text === '点击后编辑文字';
}

function isGenericCodeValue(value) {
  const text = String(value == null ? '' : value).trim();
  return text === '123456' || text === '123456789';
}

function mapBarcodeFormat(raw) {
  const codeType = raw.codeType;
  const hasCodeType = codeType != null && String(codeType).trim() !== '';
  if (hasCodeType && CODE_TYPE_MAP[codeType]) {
    const mapped = CODE_TYPE_MAP[codeType];
    if (mapped === 'qr') {
      return { kind: 'qrcode', declaredFormat: 'qr', sourceCodeType: codeType };
    }
    return {
      kind: 'barcode',
      format: mapped === 'code39' ? 'unsupported' : mapped,
      declaredFormat: mapped,
      sourceCodeType: codeType,
      unsupported: mapped === 'code39'
    };
  }
  const t = String(raw.type || '').toLowerCase();
  if (t === 'qrcode' || t === 'qr') return { kind: 'qrcode' };
  if (hasCodeType) {
    return {
      kind: 'barcode',
      format: 'unsupported',
      declaredFormat: `codeType-${String(codeType)}`,
      sourceCodeType: codeType,
      unsupported: true
    };
  }
  return { kind: 'barcode', format: 'code128' };
}

function applyCodeDeclaration(element, mapped) {
  if (mapped.sourceCodeType != null) element.sourceCodeType = mapped.sourceCodeType;
  if (mapped.declaredFormat) element.declaredFormat = mapped.declaredFormat;
  if (mapped.unsupported) {
    element.unsupportedCodeType = true;
    element.requiresFormatConfirmation = true;
    element.requiresInput = true;
    element.requiresInputReason = 'unsupported-code-type';
  }
  return element;
}

function markInvalidImportedEan(element) {
  if (element.format !== 'ean13' || !String(element.value || '').trim()) return element;
  try {
    encodeEan13(element.value);
  } catch (error) {
    element.invalidCode = true;
    element.codeValidationMessage = error.message;
    element.requiresInput = true;
    element.requiresInputReason = 'invalid-ean13';
  }
  return element;
}

function hasExplicitMissingImage(raw = {}) {
  const values = [raw.imageUrl, raw.localImageUrl, raw.ninePatchUrl, raw.localUrl]
    .map((value) => String(value == null ? '' : value).trim())
    .filter(Boolean);
  return values.some((value) => isMissingImagePath(value));
}

function applyGeometry(el, raw, docW, docH) {
  // A rotated box may legitimately cross the unrotated document axes while
  // its rendered AABB is fully inside the paper. Preserve source geometry here
  // and let clampElement perform the single rotation-aware fit below.
  el.x = Math.max(-5000, Math.min(5000, num(raw.x, 0)));
  el.y = Math.max(-5000, Math.min(5000, num(raw.y, 0)));
  el.width = clampSize(raw.width, 0.5, 500);
  el.height = clampSize(raw.height, 0.5, 500);
  el.rotation = num(raw.rotate != null ? raw.rotate : raw.rotation, 0);
  el.locked = isExplicitLock(raw.isLock) || isExplicitLock(raw.locked);
  return el;
}

function convertElement(raw, document, modify) {
  if (!raw || typeof raw !== 'object') return null;
  const type = String(raw.type || '').toLowerCase();
  const docW = document.widthMm;
  const docH = document.heightMm;
  const style = parseFontStyle(raw.fontStyle);

  if (type === 'text' || type === 'date' || type === 'time' || type === 'serial') {
    const isDate = type === 'date' || type === 'time';
    const isSerial = type === 'serial';
    let el;
    if (isDate) {
      el = createElement('date', document);
      el.label = '';
      el.showTime = type === 'time' || Boolean(raw.showTime);
      el.format = raw.format || (el.showTime ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD');
      el.fontSize = clampSize(raw.fontSize, 1.5, 24);
    } else if (isSerial) {
      el = createElement('serial', document);
      el.prefix = raw.prefix || '';
      el.suffix = raw.suffix || '';
      el.start = num(raw.start, 1);
      el.step = num(raw.step, 1);
      el.digits = num(raw.digits, 4);
      el.fontSize = clampSize(raw.fontSize, 1.5, 24);
    } else {
      el = createElement('text', document);
      el.text = resolveBoundText(raw, modify);
      el.fontSize = clampSize(raw.fontSize, 1.5, 24);
      if (hasDataBinding(raw)) {
        el.requiresInput = true;
        el.requiresInputReason = 'data-binding';
      } else if (isKnownTextPlaceholder(el.text)) {
        el.requiresInput = true;
        el.requiresInputReason = 'placeholder-text';
      }
    }
    el.bold = style.bold;
    el.italic = style.italic;
    el.underline = style.underline;
    el.align = mapAlignH(raw.textAlignHorizonral);
    el.verticalAlign = mapAlignV(raw.textAlignVertical);
    el.letterSpacing = num(raw.letterSpacing, 0);
    el.lineSpacing = num(raw.lineSpacing, 0);
    const typesettingMode = num(raw.typesettingMode, 1);
    const wordsRotate = num(raw.wordsRotate, 0) === 1;
    const textDirection = num(raw.textDirection, 0);
    if (typesettingMode === 1 && textDirection === 1) {
      el.textMode = wordsRotate ? 'horizontal-90-words-rotate' : 'horizontal-90';
      el.direction = 'horizontal';
    } else if (typesettingMode === 2) {
      el.textMode = wordsRotate ? 'vertical-words-rotate' : 'vertical';
      el.direction = 'vertical';
    } else if (typesettingMode === 3) {
      el.textMode = 'arc';
      el.direction = 'horizontal';
      el.textArcAngle = Math.max(0, Math.min(180, num(raw.typesettingParam?.[1], 180)));
    }
    el.autoFit = true;
    if (raw.fieldName) el.fieldName = String(raw.fieldName);
    if (raw.fontFamily) el.fontFamily = String(raw.fontFamily);
    return applyGeometry(el, raw, docW, docH);
  }

  if (type === 'barcode') {
    const mapped = mapBarcodeFormat(raw);
    if (mapped.kind === 'qrcode') {
      const el = createElement('qrcode', document);
      setImportedCodeValue(el, raw, modify);
      applyCodeDeclaration(el, mapped);
      return applyGeometry(el, raw, docW, docH);
    }
    const el = createElement('barcode', document);
    setImportedCodeValue(el, raw, modify);
    el.format = mapped.format || 'code128';
    applyCodeDeclaration(el, mapped);
    markInvalidImportedEan(el);
    el.showText = num(raw.textPosition, 0) !== 2;
    el.textPosition = num(raw.textPosition, 0) === 1 ? 'top' : 'bottom';
    el.fontSize = clampSize(raw.fontSize || raw.textHeight, 1.5, 8);
    if (raw.fontFamily) el.fontFamily = String(raw.fontFamily);
    if (raw.fieldName) el.fieldName = String(raw.fieldName);
    return applyGeometry(el, raw, docW, docH);
  }

  if (type === 'qrcode' || type === 'qr') {
    const el = createElement('qrcode', document);
    setImportedCodeValue(el, raw, modify);
    el.errorCorrection = 'M';
    return applyGeometry(el, raw, docW, docH);
  }

  if (type === 'rect' || type === 'rectangle' || type === 'box') {
    const el = createElement('rect', document);
    el.lineWidth = clampSize(raw.lineWidth || raw.borderWidth || 0.35, 0.1, 4);
    el.filled = isExplicitFill(raw.filled) || isExplicitFill(raw.fill);
    return applyGeometry(el, raw, docW, docH);
  }

  if (type === 'line') {
    const el = createElement('line', document);
    el.lineWidth = clampSize(raw.lineWidth || 0.3, 0.1, 4);
    return applyGeometry(el, raw, docW, docH);
  }

  if (type === 'table') {
    const el = createElement('table', document);
    el.rows = Math.max(1, num(raw.rows, 2));
    el.columns = Math.max(1, num(raw.columns, 2));
    if (Array.isArray(raw.cells)) el.cells = raw.cells.map((cell) => tableCellText(cell));
    el.fontSize = clampSize(raw.fontSize, 1.5, 12);
    if (raw.fontFamily) el.fontFamily = String(raw.fontFamily);
    return applyGeometry(el, raw, docW, docH);
  }

  if (type === 'image' || type === 'picture' || type === 'logo') {
    const path = resolveImagePath(raw);
    // A broken source marker is not an image. Dropping it prevents an empty
    // selection box while preserving any valid sibling/background asset.
    if (!path) return null;
    const el = createElement('image', document);
    el.path = path;
    return applyGeometry(el, raw, docW, docH);
  }

  if (type === 'graph') {
    const gt = num(raw.graphType, 0);
    if (gt === 1) {
      const el = createElement('line', document);
      el.lineWidth = clampSize(raw.lineWidth || 0.3, 0.1, 4);
      el.dashed = num(raw.lineType, 0) >= 2;
      return applyGeometry(el, raw, docW, docH);
    }
    const el = createElement('rect', document);
    el.lineWidth = clampSize(raw.lineWidth || 0.3, 0.1, 4);
    el.filled = isExplicitFill(raw.filled) || isExplicitFill(raw.fill);
    el.dashed = num(raw.lineType, 0) >= 2;
    if (gt === 3) el.shapeKind = 'ellipse';
    else if (gt === 4 || num(raw.cornerRadius, 0) > 0) el.shapeKind = 'rounded';
    else el.shapeKind = 'rect';
    return applyGeometry(el, raw, docW, docH);
  }

    if (type === 'material' || type === 'icon' || type === 'sticker') {
    const el = createElement('material', document);
    el.symbol = raw.symbol || raw.materialId || raw.icon || 'star';
    return applyGeometry(el, raw, docW, docH);
  }

  return null;
}

function importNiimTemplate(json) {
  if (!json || typeof json !== 'object') {
    throw new Error('importNiimTemplate: expected template object');
  }

  const width = clampSize(json.width, 10, 500);
  const height = clampSize(json.height, 4, 500);
  const sourceWidthMm = Number.isFinite(Number(json.width)) ? Number(json.width) : null;
  const sourceHeightMm = Number.isFinite(Number(json.height)) ? Number(json.height) : null;
  const sizeClamped = (sourceWidthMm != null && Math.abs(sourceWidthMm - width) > 1e-6)
    || (sourceHeightMm != null && Math.abs(sourceHeightMm - height) > 1e-6);
  const document = createDocument(width, height);
  document.elements = [];
  document.name = String(json.name || '导入模板');
  document.widthMm = width;
  document.heightMm = height;

  const modify = json.modify || json.dataSourceModifies || null;
  const rawElements = Array.isArray(json.elements) ? json.elements.slice() : [];
  rawElements.sort((a, b) => num(a.zIndex, 0) - num(b.zIndex, 0));

  let fontFallbackCount = 0;
  let geometryRepairCount = 0;
  let missingImageCount = 0;
  for (const raw of rawElements) {
    try {
      const rawType = String(raw && raw.type || '').toLowerCase();
      if ((rawType === 'image' || rawType === 'picture' || rawType === 'logo')
        && hasExplicitMissingImage(raw) && !resolveImagePath(raw)) {
        missingImageCount += 1;
      }
      const el = convertElement(raw, document, modify);
      if (el) {
        normalizeElementFont(el);
        if (el.sourceFontFamily) fontFallbackCount += 1;
        const beforeGeometry = [
          num(raw.x, 0),
          num(raw.y, 0),
          Math.max(0.1, num(raw.width, 1)),
          Math.max(0.1, num(raw.height, 1))
        ];
        clampElement(el, document);
        const afterGeometry = [el.x, el.y, el.width, el.height];
        if (beforeGeometry.some((value, index) => Math.abs(value - afterGeometry[index]) > 1e-6)) {
          geometryRepairCount += 1;
        }
        document.elements.push(el);
      }
    } catch (_) {
      // Skip malformed element.
    }
  }

  if (document.elements.length === 0) {
    const el = createElement('text', document);
    el.text = document.name || '双击编辑';
    el.x = 1;
    el.y = 1;
    el.width = Math.max(8, width - 2);
    el.height = Math.max(3, Math.min(height - 2, 6));
    el.fontSize = Math.min(4, height * 0.4);
    el.align = 'center';
    document.elements.push(el);
  }

  const semanticUnlockCount = unlockFullyLockedSemanticElements(document);
  const requiresInputCount = document.elements.filter((element) => element.requiresInput === true).length;
  const unsupportedCodeCount = document.elements.filter((element) => element.unsupportedCodeType === true).length;
  const invalidCodeCount = document.elements.filter((element) => element.invalidCode === true).length;

  const meta = {
    sourceId: json.id != null ? String(json.id) : null,
    name: document.name,
    width,
    height,
    sourceWidthMm,
    sourceHeightMm,
    sizeClamped,
    paperType: json.paperType,
    vip: Boolean(json.vip || json.hasVipRes),
    unit: json.unit || 'mm',
    version: json.version || json.templateVersion || null,
    elementCount: document.elements.length,
    fontFallbackCount,
    fontFallbackApplied: fontFallbackCount > 0,
    geometryRepairCount,
    missingImageCount,
    requiresInputCount,
    unsupportedCodeCount,
    invalidCodeCount,
    semanticUnlockCount,
    semanticUnlockApplied: semanticUnlockCount > 0,
    needsAttention: missingImageCount > 0 || sizeClamped || requiresInputCount > 0,
    imported: true
  };
  document.templateMeta = meta;
  return { document, meta };
}

module.exports = {
  importNiimTemplate,
  convertElement,
  mapAlignH,
  mapAlignV,
  parseFontStyle,
  isExplicitFill,
  isExplicitLock,
  hasDataBinding,
  isKnownTextPlaceholder,
  isGenericCodeValue,
  unlockFullyLockedSemanticElements,
  tableCellText,
  isMissingImagePath,
  resolveImagePath,
  CODE_TYPE_MAP
};
