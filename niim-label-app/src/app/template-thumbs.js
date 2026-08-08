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
      item.text || '',
      item.value || '',
      item.prefix || '',
      item.symbol || '',
      item.format || ''
    ])
  });
}

function thumbCacheKey(id, documentValue, dpi) {
  return `${id}|${dpi || 203}|${contentFingerprint(documentValue)}`;
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

/**
 * Render a white-background label preview to a PNG data URL.
 * @returns {string} data URL or empty string on failure
 */
function renderThumbDataUrl(documentValue, options) {
  const config = Object.assign({ dpi: 203, maxSide: 400, images: {}, pad: 14 }, options || {});
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

  const pad = Math.max(8, Number(config.pad) || 14);
  const innerMax = Math.max(40, config.maxSide - pad * 2);
  const scale = Math.min(1, innerMax / Math.max(size.width, size.height));
  const paperW = Math.max(1, Math.round(size.width * scale));
  const paperH = Math.max(1, Math.round(size.height * scale));
  const outWidth = paperW + pad * 2;
  const outHeight = paperH + pad * 2;
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
  const key = thumbCacheKey(id, documentValue, dpi);
  const cached = getCachedThumb(key);
  if (cached) return { key, dataUrl: cached, fromCache: true };
  const dataUrl = renderThumbDataUrl(documentValue, Object.assign({}, options, { dpi }));
  if (dataUrl) setCachedThumb(key, dataUrl);
  return { key, dataUrl, fromCache: false };
}

module.exports = {
  contentFingerprint,
  getCachedThumb,
  invalidateThumbsByPrefix,
  renderThumbDataUrl,
  resolveThumb,
  setCachedThumb,
  thumbCacheKey
};
