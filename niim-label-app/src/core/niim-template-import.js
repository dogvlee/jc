/**
 * Convert NIIMBOT / 精臣 template JSON (local research extracts) into our
 * offline document model. Coordinates stay in mm.
 */
const { createDocument, createElement } = require('./document');

const ALIGN_H = { 0: 'left', 1: 'center', 2: 'right' };
const ALIGN_V = { 0: 'top', 1: 'middle', 2: 'bottom' };

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

  const looksBound = /^[A-Z]\d+$/.test(text) || (Array.isArray(raw.dataBind) && raw.dataBind.length);
  if (looksBound && title) {
    const samples = {
      '台区名称': '滨江12号台区',
      '台区经理': '王经理',
      '经理电话': '13900006621',
      '表号': 'SG20260801001',
      '户号': '330108******'
    };
    text = samples[title] || (title + '示例');
  }
  if (useTitle && title) {
    return title + delimiter + text;
  }
  if (!text && title) return title;
  return text;
}

function mapBarcodeFormat(raw) {
  const codeType = raw.codeType;
  if (codeType != null && CODE_TYPE_MAP[codeType]) {
    const mapped = CODE_TYPE_MAP[codeType];
    if (mapped === 'qr') return { kind: 'qrcode' };
    return { kind: 'barcode', format: mapped === 'code39' ? 'code128' : mapped };
  }
  const t = String(raw.type || '').toLowerCase();
  if (t === 'qrcode' || t === 'qr') return { kind: 'qrcode' };
  return { kind: 'barcode', format: 'code128' };
}

function applyGeometry(el, raw, docW, docH) {
  el.x = clampSize(raw.x, 0, docW);
  el.y = clampSize(raw.y, 0, docH);
  el.width = clampSize(raw.width, 0.5, docW);
  el.height = clampSize(raw.height, 0.5, docH);
  el.rotation = num(raw.rotate != null ? raw.rotate : raw.rotation, 0);
  el.locked = Boolean(raw.isLock);
  if (el.x + el.width > docW) el.x = Math.max(0, docW - el.width);
  if (el.y + el.height > docH) el.y = Math.max(0, docH - el.height);
  if (el.x < 0) el.x = 0;
  if (el.y < 0) el.y = 0;
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
    }
    el.bold = style.bold;
    el.italic = style.italic;
    el.underline = style.underline;
    el.align = mapAlignH(raw.textAlignHorizonral);
    el.verticalAlign = mapAlignV(raw.textAlignVertical);
    el.letterSpacing = num(raw.letterSpacing, 0);
    el.lineSpacing = num(raw.lineSpacing, 0);
    el.autoFit = true;
    if (raw.fieldName) el.fieldName = String(raw.fieldName);
    if (raw.fontFamily) el.fontFamily = String(raw.fontFamily);
    return applyGeometry(el, raw, docW, docH);
  }

  if (type === 'barcode') {
    const mapped = mapBarcodeFormat(raw);
    if (mapped.kind === 'qrcode') {
      const el = createElement('qrcode', document);
      el.value = resolveBoundText(raw, modify) || 'https://example.com';
      return applyGeometry(el, raw, docW, docH);
    }
    const el = createElement('barcode', document);
    el.value = resolveBoundText(raw, modify) || '0';
    el.format = mapped.format || 'code128';
    if (el.format === 'ean13' && !/^\d{12,13}$/.test(String(el.value).replace(/\D/g, ''))) {
      el.format = 'code128';
    }
    el.showText = num(raw.textPosition, 0) !== 2;
    el.textPosition = num(raw.textPosition, 0) === 1 ? 'top' : 'bottom';
    el.fontSize = clampSize(raw.fontSize || raw.textHeight, 1.5, 8);
    if (raw.fieldName) el.fieldName = String(raw.fieldName);
    return applyGeometry(el, raw, docW, docH);
  }

  if (type === 'qrcode' || type === 'qr') {
    const el = createElement('qrcode', document);
    el.value = resolveBoundText(raw, modify) || 'https://example.com';
    el.errorCorrection = 'M';
    return applyGeometry(el, raw, docW, docH);
  }

  if (type === 'rect' || type === 'rectangle' || type === 'box') {
    const el = createElement('rect', document);
    el.lineWidth = clampSize(raw.lineWidth || raw.borderWidth || 0.35, 0.1, 4);
    el.filled = Boolean(raw.filled || raw.fill);
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
    if (Array.isArray(raw.cells)) el.cells = raw.cells.map(String);
    el.fontSize = clampSize(raw.fontSize, 1.5, 12);
    return applyGeometry(el, raw, docW, docH);
  }

  if (type === 'image' || type === 'picture' || type === 'logo') {
    const el = createElement('image', document);
    el.path = String(raw.imageUrl || raw.localImageUrl || raw.ninePatchUrl || '');
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
    el.filled = raw.outline === 0 || raw.filled === true || raw.filled === 1;
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

  const width = clampSize(json.width, 10, 300);
  const height = clampSize(json.height, 4, 300);
  const document = createDocument(width, height);
  document.elements = [];
  document.name = String(json.name || '导入模板');
  document.widthMm = width;
  document.heightMm = height;

  const modify = json.modify || json.dataSourceModifies || null;
  const rawElements = Array.isArray(json.elements) ? json.elements.slice() : [];
  rawElements.sort((a, b) => num(a.zIndex, 0) - num(b.zIndex, 0));

  for (const raw of rawElements) {
    try {
      const el = convertElement(raw, document, modify);
      if (el) document.elements.push(el);
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

  const meta = {
    sourceId: json.id != null ? String(json.id) : null,
    name: document.name,
    width,
    height,
    paperType: json.paperType,
    vip: Boolean(json.vip || json.hasVipRes),
    unit: json.unit || 'mm',
    version: json.version || json.templateVersion || null,
    elementCount: document.elements.length,
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
  CODE_TYPE_MAP
};