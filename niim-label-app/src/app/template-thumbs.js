/**
 * Offline canvas thumbnails for template / project cards.
 * Browser-only rendering; Node tests exercise hash/key helpers.
 */
const { previewCanvasSize } = require('../core/profiles');

const cache = new Map();
const MAX_CACHE = 80;

function contentFingerprint(documentValue) {
  const elements = (documentValue && documentValue.elements) || [];
  return JSON.stringify({
    n: documentValue && documentValue.name,
    w: documentValue && documentValue.widthMm,
    h: documentValue && documentValue.heightMm,
    e: elements.map((item) => [
      item.type,
      Number(item.x) || 0,
      Number(item.y) || 0,
      Number(item.width) || 0,
      Number(item.height) || 0,
      Number(item.rotation) || 0,
      item.text || '',
      item.value || '',
      item.prefix || '',
      item.symbol || '',
      item.format || '',
      item.path || '',
      item.materialId || '',
      item.fontFamily || '',
      Number(item.fontSize) || 0,
      item.bold === true,
      item.align || '',
      Number(item.lineWidth) || 0,
      item.filled === true
    ])
  });
}

function normalizedMaxSide(value) {
  const side = Math.round(Number(value) || 400);
  return Math.max(40, Math.min(1200, side));
}

function thumbCacheKey(id, documentValue, dpi, maxSide) {
  return `${id}|${dpi || 203}|${normalizedMaxSide(maxSide)}|${contentFingerprint(documentValue)}`;
}

function getCachedThumb(key) {
  return cache.get(key) || '';
}

function setCachedThumb(key, dataUrl) {
  if (!key || !dataUrl) return dataUrl;
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
  cache.set(key, dataUrl);
  return dataUrl;
}

function invalidateThumbsByPrefix(prefix) {
  const needle = String(prefix || '');
  if (!needle) {
    cache.clear();
    return;
  }
  Array.from(cache.keys()).forEach((key) => {
    if (key.startsWith(needle)) cache.delete(key);
  });
}

function createCanvas(width, height) {
  if (typeof document !== 'undefined' && document.createElement) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  return null;
}

function thumbRasterLayout(size, maxSide, pad) {
  const safePad = Math.max(8, Number(pad) || 14);
  const safeMaxSide = normalizedMaxSide(maxSide);
  const innerMax = Math.max(40, safeMaxSide - safePad * 2);
  const sourceWidth = Math.max(1, Number(size && size.width) || 1);
  const sourceHeight = Math.max(1, Number(size && size.height) || 1);
  // Template elements are vector/canvas primitives, so enlarging their screen
  // thumbnail is preferable to letting the browser upscale a printer-DPI PNG.
  const scale = innerMax / Math.max(sourceWidth, sourceHeight);
  const paperWidth = Math.max(1, Math.round(sourceWidth * scale));
  const paperHeight = Math.max(1, Math.round(sourceHeight * scale));
  return {
    pad: safePad,
    scale,
    paperWidth,
    paperHeight,
    width: paperWidth + safePad * 2,
    height: paperHeight + safePad * 2
  };
}

/**
 * Render a white-background label preview to a PNG data URL.
 * @returns {string} data URL or empty string on failure
 */
function renderThumbDataUrl(documentValue, options) {
  const config = Object.assign({ dpi: 203, maxSide: 400, images: {}, pad: 14 }, options || {});
  config.maxSide = normalizedMaxSide(config.maxSide);
  if (!documentValue) return '';
  const renderDocument = config.renderDocument;
  if (typeof renderDocument !== 'function') return '';

  let size;
  try {
    size = previewCanvasSize(documentValue, config.dpi);
  } catch (error) {
    return '';
  }
  if (!size.width || !size.height) return '';

  const layout = thumbRasterLayout(size, config.maxSide, config.pad);
  const pad = layout.pad;
  const scale = layout.scale;
  const paperW = layout.paperWidth;
  const paperH = layout.paperHeight;
  const outWidth = layout.width;
  const outHeight = layout.height;
  const canvas = createCanvas(outWidth, outHeight);
  if (!canvas || !canvas.getContext) return '';

  const context = canvas.getContext('2d');
  // soft stage background (NIIM-like)
  context.fillStyle = '#f0f1f3';
  context.fillRect(0, 0, outWidth, outHeight);
  // paper shadow
  context.fillStyle = 'rgba(0,0,0,0.08)';
  context.fillRect(pad + 2, pad + 3, paperW, paperH);
  // white label paper
  context.fillStyle = '#ffffff';
  context.fillRect(pad, pad, paperW, paperH);
  context.strokeStyle = 'rgba(0,0,0,0.06)';
  context.lineWidth = 1;
  context.strokeRect(pad + 0.5, pad + 0.5, paperW - 1, paperH - 1);

  context.save();
  context.translate(pad, pad);
  context.scale(scale, scale);
  try {
    renderDocument(context, documentValue, size, config.dpi, config.images || {});
  } catch (error) {
    context.restore();
    return '';
  }
  context.restore();

  if (typeof canvas.toDataURL === 'function') {
    return canvas.toDataURL('image/png');
  }
  return '';
}

function resolveThumb(id, documentValue, options) {
  const dpi = (options && options.dpi) || 203;
  const maxSide = normalizedMaxSide(options && options.maxSide);
  const key = thumbCacheKey(id, documentValue, dpi, maxSide);
  const cached = getCachedThumb(key);
  if (cached) return { key, dataUrl: cached, fromCache: true };
  const dataUrl = renderThumbDataUrl(documentValue, Object.assign({}, options, { dpi, maxSide }));
  if (dataUrl) setCachedThumb(key, dataUrl);
  return { key, dataUrl, fromCache: false };
}

module.exports = {
  contentFingerprint,
  getCachedThumb,
  invalidateThumbsByPrefix,
  normalizedMaxSide,
  renderThumbDataUrl,
  resolveThumb,
  setCachedThumb,
  thumbRasterLayout,
  thumbCacheKey
};
