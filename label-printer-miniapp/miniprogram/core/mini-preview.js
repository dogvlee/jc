/**
 * Lightweight WXML preview of a label document: every element becomes an
 * absolutely positioned view (percent geometry, font sizes scaled to the
 * preview), and barcodes / QR codes are drawn from their real encodings as
 * inline SVG, so template lists show what will actually print without a
 * canvas per card.
 */
const qrcode = require('../vendor/qrcode');
const { encodeCode128 } = require('./code128');
const { encodeEan13 } = require('./ean13');
const { resolveLinkedCodes } = require('./linked-codes');
const { formatDateValue, serialValue } = require('./renderer');

const VERTICAL = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };

function percent(value, total) {
  return `${Math.round((Number(value) || 0) / total * 10000) / 100}%`;
}

function svgUri(viewBox, path, aspect) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${viewBox}' preserveAspectRatio='${aspect}' shape-rendering='crispEdges'><path d='${path}' fill='#000'/></svg>`;
  return `url("data:image/svg+xml,${svg.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/#/g, '%23')}")`;
}

function barcodeImage(element) {
  let modules = '';
  try {
    if (element.format === 'ean13') {
      modules = encodeEan13(element.value).bits;
    } else {
      const encoded = encodeCode128(element.value);
      modules = '0'.repeat(10) + encoded.patterns.map((pattern) => Array.from(pattern)
        .map((width, index) => (index % 2 ? '0' : '1').repeat(Number(width))).join('')).join('') + '0'.repeat(10);
    }
  } catch (error) {
    return '';
  }
  let path = '';
  for (let start = 0; start < modules.length;) {
    if (modules[start] !== '1') {
      start += 1;
      continue;
    }
    let end = start;
    while (modules[end] === '1') end += 1;
    path += `M${start} 0h${end - start}v1h-${end - start}z`;
    start = end;
  }
  return svgUri(`0 0 ${modules.length} 1`, path, 'none');
}

function qrImage(element) {
  let code;
  try {
    code = qrcode(0, element.errorCorrection || 'M');
    code.addData(String(element.value || ''), 'Byte');
    code.make();
  } catch (error) {
    return '';
  }
  const count = code.getModuleCount();
  const quiet = 4;
  let path = '';
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count;) {
      if (!code.isDark(row, column)) {
        column += 1;
        continue;
      }
      let end = column;
      while (end < count && code.isDark(row, end)) end += 1;
      path += `M${column + quiet} ${row + quiet}h${end - column}v1h-${end - column}z`;
      column = end;
    }
  }
  const size = count + quiet * 2;
  return svgUri(`0 0 ${size} ${size}`, path, 'xMidYMid meet');
}

function barcodeDigits(element) {
  try {
    return encodeEan13(element.value).text;
  } catch (error) {
    return String(element.value || '');
  }
}

function textValue(element) {
  if (element.type === 'date') return formatDateValue(element);
  if (element.type === 'serial') return serialValue(element);
  return String(element.text == null ? '' : element.text);
}

/**
 * Preview nodes for a document fitted into maxWidth × maxHeight pixels. Nodes
 * are laid out `density` times larger and the page scales them back with
 * `zoom`, so small label type stays above WebView minimum font sizes.
 * Returns { width, height, innerWidth, innerHeight, zoom, nodes }.
 */
function buildMiniPreview(documentValue, maxWidth, maxHeight, density) {
  const widthMm = Number(documentValue && documentValue.widthMm) || 40;
  const heightMm = Number(documentValue && documentValue.heightMm) || 30;
  const factor = Number(density) > 0 ? Number(density) : 3;
  const fit = Math.min(maxWidth / widthMm, maxHeight / heightMm);
  const scale = fit * factor;
  const nodes = [];
  const resolved = resolveLinkedCodes(documentValue || { elements: [] });
  (resolved.elements || []).forEach((element, index) => {
    const geometry = `left:${percent(element.x, widthMm)};top:${percent(element.y, heightMm)};`
      + `width:${percent(element.width, widthMm)};height:${percent(element.height, heightMm)};`
      + (element.rotation ? `transform:rotate(${Number(element.rotation)}deg);` : '');
    const key = element.id || `node-${index}`;
    if (['text', 'date', 'serial'].includes(element.type)) {
      const fontPx = Math.max(3, Math.round((Number(element.fontSize) || 3) * scale * 10) / 10);
      nodes.push({
        key,
        kind: element.reverse ? 'text reverse' : 'text',
        text: textValue(element),
        style: `${geometry}font-size:${fontPx}px;text-align:${element.align || 'left'};`
          + `justify-content:${VERTICAL[element.verticalAlign] || 'center'};`
          + `font-weight:${element.bold ? 700 : 400};${element.strike ? 'text-decoration:line-through;' : ''}`
      });
    } else if (element.type === 'rect') {
      const radius = element.shapeKind === 'rounded' ? Math.min(element.width, element.height) * 0.15 * scale
        : ['circle', 'ellipse'].includes(element.shapeKind) ? 9999 : 0;
      const stroke = Math.max(1, Math.round((Number(element.lineWidth) || 0.3) * scale));
      nodes.push({
        key,
        kind: element.filled ? 'fill' : 'stroke',
        text: '',
        style: `${geometry}border-radius:${Math.round(radius * 10) / 10}px;${element.filled ? '' : `border-width:${stroke}px;`}`
          + (element.dashed ? 'border-style:dashed;' : '')
      });
    } else if (element.type === 'line') {
      const stroke = Math.max(1, Math.round((Number(element.lineWidth) || 0.3) * scale));
      const middle = (Number(element.y) || 0) + (Number(element.height) || 0) / 2;
      nodes.push({
        key,
        kind: element.dashed ? 'line dashed' : 'line',
        text: '',
        style: `left:${percent(element.x, widthMm)};top:${percent(middle, heightMm)};width:${percent(element.width, widthMm)};`
          + `height:${stroke}px;margin-top:-${stroke / 2}px;`
      });
    } else if (element.type === 'qrcode') {
      nodes.push({ key, kind: 'code', text: '', style: `${geometry}background-image:${qrImage(element) || 'none'};` });
    } else if (element.type === 'barcode') {
      const showText = element.showText !== false;
      const height = Number(element.height) || 0;
      const fontMm = Number(element.fontSize) > 0 ? Number(element.fontSize) : 2.4;
      const labelMm = showText ? Math.min(fontMm * 1.15, height * 0.35) : 0;
      const top = element.textPosition === 'top';
      const barsY = (Number(element.y) || 0) + (top ? labelMm : 0);
      nodes.push({
        key,
        kind: 'code',
        text: '',
        style: `left:${percent(element.x, widthMm)};top:${percent(barsY, heightMm)};width:${percent(element.width, widthMm)};`
          + `height:${percent(height - labelMm, heightMm)};background-image:${barcodeImage(element) || 'none'};`
      });
      if (showText) {
        const labelY = top ? Number(element.y) || 0 : barsY + height - labelMm;
        nodes.push({
          key: `${key}-text`,
          kind: 'text',
          text: element.format === 'ean13' ? barcodeDigits(element) : String(element.value || ''),
          style: `left:${percent(element.x, widthMm)};top:${percent(labelY, heightMm)};width:${percent(element.width, widthMm)};`
            + `height:${percent(labelMm, heightMm)};font-size:${Math.max(3, Math.round(labelMm * 0.78 * scale * 10) / 10)}px;`
            + 'text-align:center;justify-content:center;'
        });
      }
    } else if (element.type === 'table') {
      nodes.push({ key, kind: 'stroke', text: '', style: `${geometry}border-width:1px;` });
    } else if (element.type === 'image' || element.type === 'material') {
      // Pictures are not loaded for a thumbnail; a light grey box shows that
      // one sits there (and a missing picture still shows its place).
      nodes.push({ key, kind: 'picture', text: '', style: geometry });
    }
  });
  return {
    width: Math.round(widthMm * fit),
    height: Math.round(heightMm * fit),
    innerWidth: Math.round(widthMm * scale),
    innerHeight: Math.round(heightMm * scale),
    zoom: Math.round(1 / factor * 10000) / 10000,
    nodes
  };
}

module.exports = { buildMiniPreview };
