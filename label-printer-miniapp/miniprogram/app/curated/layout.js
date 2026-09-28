/**
 * Layout primitives for the curated Shangyue template library. Every size is
 * in millimetres. Text is sized so it fits its box at the declared size, so
 * the renderer never has to shrink it below the readable minimum.
 */
const { createDocument, createElement } = require('../../core/document');
const { textWidthMm } = require('./text-metrics');

const MIN_FONT = 2.2;
const LINE_SPACING = 1.15;
const FIT_SLACK = 1.03;
const SAMPLE_DATES = { 'YYYY-MM-DD': '2026-09-28', 'MM-DD HH:mm': '09-28 14:30', 'YYYY-MM-DD HH:mm': '2026-09-28 14:30', 'MM-DD': '09-28' };

function round(value) {
  return Math.round(value * 100) / 100;
}

function frame(x, y, w, h) {
  return { x, y, w, h };
}

function inset(box, dx, dy) {
  const vertical = dy == null ? dx : dy;
  return frame(box.x + dx, box.y + vertical, box.w - dx * 2, box.h - vertical * 2);
}

/** Margin that keeps content off the die-cut edge, scaled with the paper. */
function safeBox(widthMm, heightMm) {
  const margin = Math.max(1.6, Math.min(2.6, Math.min(widthMm, heightMm) * 0.06));
  return frame(margin, margin, widthMm - margin * 2, heightMm - margin * 2);
}

// Positive parts are weights, negative parts are fixed millimetres.
function sizes(total, parts, gap) {
  const fixed = parts.filter((part) => part < 0).reduce((sum, part) => sum - part, 0);
  const weights = parts.filter((part) => part > 0).reduce((sum, part) => sum + part, 0);
  const free = Math.max(0, total - fixed - gap * (parts.length - 1));
  return parts.map((part) => (part < 0 ? -part : (weights ? free * part / weights : 0)));
}

function rows(box, parts, gap) {
  let cursor = box.y;
  return sizes(box.h, parts, gap || 0).map((height) => {
    const row = frame(box.x, cursor, box.w, height);
    cursor += height + (gap || 0);
    return row;
  });
}

function cols(box, parts, gap) {
  let cursor = box.x;
  return sizes(box.w, parts, gap || 0).map((width) => {
    const column = frame(cursor, box.y, width, box.h);
    cursor += width + (gap || 0);
    return column;
  });
}

/** Largest font (0.1 mm steps, at most `max`) that keeps every line inside the box. */
function fitFont(value, width, height, max, bold) {
  const lines = String(value).split('\n').length;
  const perMm = textWidthMm(value, 1, bold) * FIT_SLACK;
  const byWidth = perMm > 0 ? width / perMm : max;
  const byHeight = height / (1 + (lines - 1) * LINE_SPACING);
  const size = Math.floor(Math.min(max, byWidth, byHeight) * 10 + 1e-6) / 10;
  if (size < MIN_FONT) {
    throw new Error(`“${value}”在 ${round(width)}×${round(height)} mm 内放不下`);
  }
  return size;
}

function push(doc, element, options) {
  // bindField marks the element that batch data (name / price / code / date) fills.
  if (options && options.bind) element.bindField = options.bind;
  doc.elements.push(element);
  return element;
}

function place(element, box) {
  return Object.assign(element, { x: round(box.x), y: round(box.y), width: round(box.w), height: round(box.h) });
}

function floorTenth(value) {
  return Math.floor(value * 10 + 1e-6) / 10;
}

function text(doc, box, value, options) {
  const opts = options || {};
  const wanted = opts.size ? floorTenth(opts.size) : 0;
  const size = fitFont(value, box.w, box.h, wanted || Math.max(MIN_FONT, opts.max || 4.2), opts.bold);
  if (wanted && size < wanted) {
    throw new Error(`“${value}”按 ${opts.size} mm 字号放不下`);
  }
  const element = place(createElement('text', doc), box);
  return push(doc, Object.assign(element, {
    text: String(value),
    fontSize: size,
    bold: Boolean(opts.bold),
    italic: false,
    underline: false,
    strike: Boolean(opts.strike),
    reverse: Boolean(opts.reverse),
    align: opts.align || 'left',
    verticalAlign: opts.valign || 'middle',
    autoFit: true,
    wordWrap: false,
    lineSpacing: 0,
    letterSpacing: 0,
    fontFamily: 'sans-serif'
  }), opts);
}

/** Reverse (white on black) tag hugging its text; `right` / `center` anchor it at x. */
function chip(doc, x, y, height, value, options) {
  const opts = options || {};
  const size = floorTenth(opts.size || Math.max(MIN_FONT, Math.min(opts.max || 2.8, height * 0.64)));
  const width = textWidthMm(value, size, true) * FIT_SLACK + height * 0.8 + 0.1;
  const left = opts.right ? x - width : opts.center ? x - width / 2 : x;
  return text(doc, frame(left, y, width, height), value, { size, bold: true, reverse: true, align: 'center' });
}

function band(doc, box, options) {
  const opts = options || {};
  const element = place(createElement('rect', doc), box);
  return push(doc, Object.assign(element, {
    filled: true,
    shapeKind: opts.square ? 'rect' : 'rounded',
    lineWidth: 0.2,
    dashed: false,
    locked: true
  }));
}

function outline(doc, box, options) {
  const opts = options || {};
  const element = place(createElement('rect', doc), box);
  return push(doc, Object.assign(element, {
    filled: false,
    shapeKind: opts.rounded ? 'rounded' : 'rect',
    lineWidth: opts.weight || 0.3,
    dashed: Boolean(opts.dashed),
    locked: true
  }));
}

function hline(doc, x, y, width, options) {
  const opts = options || {};
  const weight = opts.weight || 0.3;
  const element = place(createElement('line', doc), frame(x, y - 0.2, width, 0.4));
  return push(doc, Object.assign(element, { lineWidth: weight, dashed: Boolean(opts.dashed), locked: true }));
}

/** Rule centred in the gap between two stacked rows, spanning the wider one. */
function divider(doc, above, below, options) {
  const y = (above.y + above.h + below.y) / 2;
  const x = Math.min(above.x, below.x);
  const width = Math.max(above.x + above.w, below.x + below.w) - x;
  return hline(doc, x, y, width, Object.assign({ weight: 0.25 }, options));
}

function vline(doc, x, y, height, options) {
  const weight = (options && options.weight) || 0.3;
  return band(doc, frame(x - weight / 2, y, weight, height), { square: true });
}

function barcode(doc, box, value, options) {
  const opts = options || {};
  const element = place(createElement('barcode', doc), box);
  return push(doc, Object.assign(element, {
    value: String(value),
    format: opts.format || 'code128',
    showText: opts.showText !== false,
    textPosition: 'bottom',
    fontSize: opts.fontSize || 2.2,
    color: '#000000',
    serialLinked: Boolean(opts.serialLinked)
  }), opts);
}

function qrcode(doc, box, value, options) {
  const opts = options || {};
  const side = Math.min(box.w, box.h);
  const square = frame(box.x + (box.w - side) / 2, box.y + (box.h - side) / 2, side, side);
  const element = place(createElement('qrcode', doc), square);
  return push(doc, Object.assign(element, {
    value: String(value),
    errorCorrection: opts.level || 'M',
    color: '#000000',
    serialLinked: Boolean(opts.serialLinked)
  }), opts);
}

/**
 * Auto-updating date. `role` is made (print date), expire (print date plus
 * `hours`) or generic; the sample string sizes the box for the real output.
 */
function date(doc, box, options) {
  const opts = options || {};
  const format = opts.format || 'YYYY-MM-DD';
  const label = opts.label || '';
  const sample = `${label ? `${label}：` : ''}${SAMPLE_DATES[format] || SAMPLE_DATES['YYYY-MM-DD']}`;
  const size = fitFont(sample, box.w, box.h, opts.max || 3.2, opts.bold);
  const element = place(createElement('date', doc), box);
  const role = opts.role || 'made';
  return push(doc, Object.assign(element, {
    format,
    label,
    autoUpdate: true,
    showTime: /HH/.test(format),
    showSeconds: false,
    offsetDays: 0,
    offsetHours: 0,
    dateRole: role,
    expireMode: role === 'expire' ? 'preset' : element.expireMode,
    expirePresetHours: role === 'expire' ? (opts.hours || 24) : element.expirePresetHours,
    fontSize: size,
    bold: Boolean(opts.bold),
    reverse: Boolean(opts.reverse),
    align: opts.align || 'left',
    verticalAlign: 'middle',
    autoFit: true,
    fontFamily: 'sans-serif'
  }), opts);
}

function serial(doc, box, options) {
  const opts = options || {};
  const digits = opts.digits || 4;
  const sample = `${opts.prefix || ''}${'8'.repeat(digits)}${opts.suffix || ''}`;
  const size = fitFont(sample, box.w, box.h, opts.max || 3.6, opts.bold);
  const element = place(createElement('serial', doc), box);
  return push(doc, Object.assign(element, {
    prefix: opts.prefix || '',
    suffix: opts.suffix || '',
    start: opts.start == null ? 1 : opts.start,
    step: opts.step || 1,
    digits,
    fontSize: size,
    bold: Boolean(opts.bold),
    reverse: Boolean(opts.reverse),
    align: opts.align || 'left',
    verticalAlign: 'middle',
    autoFit: true,
    fontFamily: 'sans-serif'
  }), opts);
}

/** Font scale for a paper size, 1 at 40×30 mm; larger labels get larger type. */
function scaleFor(widthMm, heightMm) {
  return Math.max(0.85, Math.min(1.7, Math.min(widthMm / 40, heightMm / 30)));
}

/**
 * Filled rounded panel. Returns the area its reverse texts may use: inset past
 * the corner radius so a text's own square fill never pokes out of a corner.
 */
function panel(doc, box) {
  band(doc, box);
  const radius = Math.min(box.w, box.h) * 0.15;
  return inset(box, radius + 0.3, Math.max(0.35, radius * 0.5));
}

/**
 * Square-cornered filled block. Unlike a rounded panel it loses no width to
 * the corners, so a narrow column still holds large reverse text.
 */
function slab(doc, box) {
  band(doc, box, { square: true });
  const pad = Math.max(0.5, Math.min(1, Math.min(box.w, box.h) * 0.08));
  return inset(box, pad, pad * 0.7);
}

/** Filled circle centred in the box; returns the square its reverse text may use. */
function disc(doc, box) {
  const side = Math.min(box.w, box.h);
  const square = frame(box.x + (box.w - side) / 2, box.y + (box.h - side) / 2, side, side);
  const element = place(createElement('rect', doc), square);
  push(doc, Object.assign(element, { filled: true, shapeKind: 'circle', lineWidth: 0.2, dashed: false, locked: true }));
  return inset(square, side * 0.17);
}

/**
 * Big bold price with its unit set right after it ("¥16.80 元/盒"). The price
 * box hugs the text so the two never overlap; `right` pushes both to the right.
 */
function priceUnit(doc, box, price, unit, options) {
  const opts = options || {};
  const unitSize = floorTenth(Math.max(MIN_FONT, Math.min(opts.unitMax || 3, box.h * 0.42)));
  const unitW = unit ? textWidthMm(unit, unitSize, false) * FIT_SLACK + 0.2 : 0;
  const gap = unit ? 0.5 : 0;
  const size = fitFont(price, box.w - unitW - gap, box.h, opts.max || 8, true);
  const priceW = Math.min(box.w - unitW - gap, textWidthMm(price, size, true) * FIT_SLACK);
  const used = priceW + gap + unitW;
  const left = opts.right ? box.x + box.w - used : opts.center ? box.x + (box.w - used) / 2 : box.x;
  const priceElement = text(doc, frame(left, box.y, priceW, box.h), price, {
    size, bold: true, reverse: opts.reverse, align: 'left', bind: opts.bind
  });
  if (unit) {
    const unitH = Math.min(box.h, unitSize * 1.4);
    text(doc, frame(left + priceW + gap, box.y + box.h - unitH - box.h * 0.08, unitW, unitH), unit, {
      size: unitSize, reverse: opts.reverse, valign: 'bottom'
    });
  }
  return priceElement;
}

/**
 * Evenly spaced information lines sharing one font size. Each line is a
 * string or a [caption, value] pair rendered as "caption：value".
 */
function infoRows(doc, box, lines, options) {
  const opts = options || {};
  const values = lines.map((line) => (Array.isArray(line) ? `${line[0]}：${line[1]}` : String(line)));
  const slots = rows(box, values.map(() => 1), opts.gap == null ? 0.3 : opts.gap);
  const size = values.reduce((min, value, index) => (
    Math.min(min, fitFont(value, slots[index].w, slots[index].h, opts.max || 3.2, opts.bold))
  ), opts.max || 3.2);
  return values.map((value, index) => text(doc, slots[index], value, { size, bold: opts.bold, align: opts.align }));
}

/** Bold title on the left with a reverse tag hugging the right edge. */
function titleWithTag(doc, box, title, tag, options) {
  const opts = options || {};
  const tagH = Math.min(box.h, opts.tagHeight || box.h * 0.82);
  const tagElement = chip(doc, box.x + box.w, box.y + (box.h - tagH) / 2, tagH, tag, { right: true, max: opts.tagMax || 3.2 });
  const titleW = Math.max(1, tagElement.x - box.x - 1);
  return text(doc, frame(box.x, box.y, titleW, box.h), title, { bold: true, max: opts.max || 5, bind: opts.bind });
}

/** A small caption and its value stacked in one box. */
function stacked(doc, box, caption, value, options) {
  const opts = options || {};
  const [top, bottom] = rows(box, [-Math.min(3, box.h * 0.4), 1], 0.2);
  text(doc, top, caption, { max: 2.4, align: opts.align });
  return text(doc, bottom, value, { max: opts.max || 3.6, bold: opts.bold !== false, align: opts.align });
}

/** "Caption  value" on one line, as one text element. */
function pair(doc, box, caption, value, options) {
  const opts = options || {};
  return text(doc, box, `${caption}  ${value}`, Object.assign({ max: 3 }, opts));
}

function newDocument(widthMm, heightMm) {
  const doc = createDocument(widthMm, heightMm);
  doc.elements = [];
  return doc;
}

module.exports = {
  MIN_FONT,
  band,
  barcode,
  chip,
  cols,
  date,
  disc,
  divider,
  fitFont,
  frame,
  hline,
  infoRows,
  inset,
  newDocument,
  outline,
  pair,
  panel,
  priceUnit,
  qrcode,
  rows,
  safeBox,
  scaleFor,
  serial,
  slab,
  stacked,
  text,
  titleWithTag,
  vline
};
