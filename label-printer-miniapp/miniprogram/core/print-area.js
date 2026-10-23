/**
 * Where a label can print on a given printer. The print head sits centred on
 * the paper, so a label may be a little larger than the head on the head
 * axis (up to the widest paper the printer takes): the strips the head cannot
 * reach are then skipped, but only while they are blank. User content is
 * never cut; anything in those strips blocks printing instead.
 */
const { isBlackPixel } = require('./image-encoder');

const MM_PER_INCH = 25.4;
// An edge that reaches less than a quarter dot past the printable band cannot
// darken the skipped dot past the print threshold, so it still counts as inside.
const EDGE_TOLERANCE_DOTS = 0.25;
const PAPER_EPSILON_MM = 1e-6;

function dotsPerMm(dpi) {
  return Number(dpi) / MM_PER_INCH;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatMm(value) {
  return String(Math.round(Number(value) * 10) / 10);
}

function previewCanvasSize(document, dpi) {
  const widthMm = Number(document && document.widthMm);
  const heightMm = Number(document && document.heightMm);
  const perMm = dotsPerMm(dpi);
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
    throw new Error('标签宽高必须大于 0 mm');
  }
  if (!Number.isFinite(perMm) || perMm <= 0) {
    throw new Error('打印分辨率无效');
  }
  return {
    width: Math.max(1, Math.round(widthMm * perMm)),
    height: Math.max(1, Math.round(heightMm * perMm))
  };
}

// A printer that feeds the label sideways ('left') spans the label height;
// the ESC/POS printers all feed it top first.
function headAxisOf(profile) {
  return profile && profile.printDirection === 'left' ? 'y' : 'x';
}

function paperLimitMm(profile) {
  const limit = finite(profile.paperMaxMm);
  return limit && limit > 0 ? limit : profile.printheadPixels / dotsPerMm(profile.dpi);
}

function paperTooLargeError(document, profile, axis, limitMm) {
  // 'B1 只能装…' but '58mm 打印机只能装…': a space only after a Latin name.
  const printer = profile.name ? `${profile.name}${/[\x21-\x7e]$/.test(profile.name) ? ' ' : ''}` : '这台打印机';
  const side = axis === 'y' ? '高度' : '宽度';
  const error = new Error(`${printer}只能装${side}不超过 ${formatMm(limitMm)} mm 的标签纸，`
    + `当前标签 ${formatMm(document.widthMm)}×${formatMm(document.heightMm)} mm 放不进去。请换成适合这台打印机的尺寸或模板。`);
  error.code = 'PAPER_TOO_LARGE';
  return error;
}

/**
 * Raster the whole label at the printer's dpi. When the label is larger than
 * the head, `crop` is the head-sized band the printer receives: centred on the
 * label, because the paper guide centres the label under the head.
 */
function printRasterPlan(document, profile) {
  const size = previewCanvasSize(document, profile.dpi);
  const headAxis = headAxisOf(profile);
  const side = headAxis === 'y' ? 'height' : 'width';
  const head = Number(profile.printheadPixels);
  const canvas = { width: size.width, height: size.height };
  canvas[side] = Math.ceil(canvas[side] / 8) * 8;
  if (canvas[side] <= head) return { headAxis, canvas, crop: null };

  const labelMm = Number(headAxis === 'y' ? document.heightMm : document.widthMm);
  const limitMm = paperLimitMm(profile);
  if (labelMm > limitMm + PAPER_EPSILON_MM) throw paperTooLargeError(document, profile, headAxis, limitMm);
  // Centre on the label itself, not on the canvas padded to whole bytes.
  const centered = Math.round((labelMm * dotsPerMm(profile.dpi) - head) / 2);
  const offset = Math.min(canvas[side] - head, Math.max(0, centered));
  const crop = headAxis === 'y'
    ? { x: 0, y: offset, width: canvas.width, height: head }
    : { x: offset, y: 0, width: head, height: canvas.height };
  return { headAxis, canvas, crop };
}

function strokeMm(element, fallbackMm, dpi) {
  // Same default and one-dot minimum the renderer uses for strokes.
  return Math.max(1 / dotsPerMm(dpi), Number(element.lineWidth) || fallbackMm);
}

function shapeHalfExtents(element, width, height, dpi) {
  const stroke = strokeMm(element, element.type === 'table' ? 0.4 : 0.35, dpi);
  const kind = element.shapeKind || (element.type === 'line' ? 'line' : 'rect');
  if (element.type !== 'table' && !element.borderStyle && (element.type === 'line' || kind === 'line')) {
    // One stroke along the middle of the box, with square ends.
    return width > 0 ? { x: width / 2, y: stroke / 2 } : null;
  }
  if (element.type === 'rect' && element.filled && !element.borderStyle) {
    return width > 0 && height > 0 ? { x: width / 2, y: height / 2 } : null;
  }
  // Outlines, borders and table grids are stroked on the box edge.
  return width > 0 || height > 0 ? { x: (width + stroke) / 2, y: (height + stroke) / 2 } : null;
}

// Half extents, before rotation, of where the renderer can put ink; null
// when the element prints nothing.
function inkHalfExtents(element, dpi) {
  const width = Math.abs(finite(element.width) || 0);
  const height = Math.abs(finite(element.height) || 0);
  const type = element.type;
  if (type === 'rect' || type === 'line' || type === 'table') return shapeHalfExtents(element, width, height, dpi);
  if (!['text', 'date', 'serial', 'barcode', 'qrcode', 'image', 'material'].includes(type)) return null;
  if (type === 'text' && !String(element.text == null ? '' : element.text).trim()) return null;
  if (type === 'image' && !element.path) return null;
  return width > 0 && height > 0 ? { x: width / 2, y: height / 2 } : null;
}

/**
 * Axis-aligned bounds (mm) of an element's ink on the label, rotated about
 * the element centre like the renderer does. Null when it prints nothing.
 */
function elementInkBounds(element, dpi) {
  if (!element) return null;
  const x = finite(element.x);
  const y = finite(element.y);
  const half = inkHalfExtents(element, finite(dpi) || 203);
  if (!half || x == null || y == null) return null;
  const angle = (finite(element.rotation) || 0) * Math.PI / 180;
  const cosine = Math.abs(Math.cos(angle));
  const sine = Math.abs(Math.sin(angle));
  const centerX = x + (finite(element.width) || 0) / 2;
  const centerY = y + (finite(element.height) || 0) / 2;
  const extentX = cosine * half.x + sine * half.y;
  const extentY = sine * half.x + cosine * half.y;
  return { left: centerX - extentX, right: centerX + extentX, top: centerY - extentY, bottom: centerY + extentY };
}

function bandMm(plan, dpi) {
  const perMm = dotsPerMm(dpi);
  const vertical = plan.headAxis === 'y';
  const start = vertical ? plan.crop.y : plan.crop.x;
  return {
    start: start / perMm,
    end: (start + (vertical ? plan.crop.height : plan.crop.width)) / perMm,
    canvasHead: (vertical ? plan.canvas.height : plan.canvas.width) / perMm,
    canvasOther: (vertical ? plan.canvas.width : plan.canvas.height) / perMm
  };
}

function intrudingElement(document, profile, plan) {
  const band = bandMm(plan, profile.dpi);
  const tolerance = EDGE_TOLERANCE_DOTS / dotsPerMm(profile.dpi);
  const vertical = plan.headAxis === 'y';
  const elements = Array.isArray(document.elements) ? document.elements : [];
  return elements.find((element) => {
    const bounds = elementInkBounds(element, profile.dpi);
    if (!bounds) return false;
    const low = vertical ? bounds.top : bounds.left;
    const high = vertical ? bounds.bottom : bounds.right;
    const acrossLow = vertical ? bounds.left : bounds.top;
    const acrossHigh = vertical ? bounds.right : bounds.bottom;
    // Ink that falls off the canvas never reaches the printer at all.
    if (high <= 0 || low >= band.canvasHead || acrossHigh <= 0 || acrossLow >= band.canvasOther) return false;
    return Math.max(low, 0) < band.start - tolerance || Math.min(high, band.canvasHead) > band.end + tolerance;
  }) || null;
}

/** Plain message for content in a skipped strip ('' when nothing is skipped). */
function marginInkMessage(document, profile, plan) {
  if (!plan || !plan.crop) return '';
  const band = bandMm(plan, profile.dpi);
  const labelMm = Number(plan.headAxis === 'y' ? document.heightMm : document.widthMm);
  const strip = Math.max(0.1, band.start, labelMm - band.end);
  const sides = plan.headAxis === 'y' ? '上下' : '左右';
  return `这台打印机${sides}两侧各约 ${strip.toFixed(1)} mm 打不到，请把靠边的内容往中间移一点再打印。`;
}

/**
 * Printability of a document on one profile, from element bounds alone.
 * reason: '' | 'MARGIN_INK' | 'PAPER_TOO_LARGE'.
 */
function printAreaCheck(document, profile) {
  let plan;
  try {
    plan = printRasterPlan(document, profile);
  } catch (error) {
    const reason = error.code === 'PAPER_TOO_LARGE' ? 'PAPER_TOO_LARGE' : '';
    return { ok: false, cropped: false, reason, elementId: '', message: error.message, plan: null };
  }
  if (!plan.crop) return { ok: true, cropped: false, reason: '', elementId: '', message: '', plan };
  const element = intrudingElement(document, profile, plan);
  if (!element) return { ok: true, cropped: true, reason: '', elementId: '', message: '', plan };
  return {
    ok: false,
    cropped: true,
    reason: 'MARGIN_INK',
    elementId: String(element.id || ''),
    message: marginInkMessage(document, profile, plan),
    plan
  };
}

function stripHasInk(imageData, left, right, top, bottom, threshold) {
  for (let y = Math.max(0, top); y < bottom; y += 1) {
    for (let x = Math.max(0, left); x < right; x += 1) {
      if (isBlackPixel(imageData, x, y, threshold)) return true;
    }
  }
  return false;
}

/**
 * Re-check the rendered raster: would any dot the printer skips have printed
 * black? Uses the encoder's own pixel test and threshold fallback, so the
 * answer matches what the printer would have received.
 */
function marginInkReport(imageData, plan, threshold) {
  const crop = plan && plan.crop;
  if (!imageData || !crop) return { ink: false };
  const limit = Number(threshold) || 180;
  const width = imageData.width;
  const height = imageData.height;
  const right = Math.min(width, crop.x + crop.width);
  const bottom = Math.min(height, crop.y + crop.height);
  const ink = stripHasInk(imageData, 0, width, 0, Math.min(height, crop.y), limit)
    || stripHasInk(imageData, 0, width, bottom, height, limit)
    || stripHasInk(imageData, 0, Math.min(width, crop.x), crop.y, bottom, limit)
    || stripHasInk(imageData, right, width, crop.y, bottom, limit);
  return { ink };
}

/** Copy the printed band out of a full-label raster (null crop: unchanged). */
function cropImageData(imageData, crop) {
  if (!crop) return imageData;
  const rowBytes = crop.width * 4;
  const data = new Uint8ClampedArray(rowBytes * crop.height);
  for (let row = 0; row < crop.height; row += 1) {
    const start = ((crop.y + row) * imageData.width + crop.x) * 4;
    data.set(imageData.data.slice(start, start + rowBytes), row * rowBytes);
  }
  return { width: crop.width, height: crop.height, data };
}

module.exports = {
  cropImageData,
  elementInkBounds,
  marginInkMessage,
  marginInkReport,
  previewCanvasSize,
  printAreaCheck,
  printRasterPlan
};
