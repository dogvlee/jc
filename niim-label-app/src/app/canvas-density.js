const MAX_PIXEL_RATIO = 4;

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function effectivePixelRatio(value) {
  return Math.max(1, Math.min(MAX_PIXEL_RATIO, positiveNumber(value, 1)));
}

function measuredCanvasSize(canvas, fallbackWidth, fallbackHeight) {
  let rect = null;
  if (canvas && typeof canvas.getBoundingClientRect === 'function') {
    try { rect = canvas.getBoundingClientRect(); } catch (_) { rect = null; }
  }
  return {
    width: positiveNumber(
      rect && rect.width,
      positiveNumber(canvas && canvas.clientWidth, positiveNumber(fallbackWidth, 1))
    ),
    height: positiveNumber(
      rect && rect.height,
      positiveNumber(canvas && canvas.clientHeight, positiveNumber(fallbackHeight, 1))
    )
  };
}

/**
 * Match a canvas backing store to its CSS box and reset its context so callers
 * can continue drawing in CSS pixels. This prevents a 56 px icon buffer from
 * being stretched across a 2x/3x mobile display.
 */
function prepareHighDensityCanvas(canvas, options) {
  if (!canvas || typeof canvas.getContext !== 'function') return null;
  const config = options || {};
  const context = config.context || canvas.getContext('2d');
  if (!context) return null;
  const size = measuredCanvasSize(canvas, config.fallbackWidth, config.fallbackHeight);
  const pixelRatio = effectivePixelRatio(
    config.pixelRatio == null
      ? (typeof window !== 'undefined' ? window.devicePixelRatio : 1)
      : config.pixelRatio
  );
  const bufferWidth = Math.max(1, Math.round(size.width * pixelRatio));
  const bufferHeight = Math.max(1, Math.round(size.height * pixelRatio));
  if (canvas.width !== bufferWidth) canvas.width = bufferWidth;
  if (canvas.height !== bufferHeight) canvas.height = bufferHeight;

  if (typeof context.setTransform === 'function') {
    context.setTransform(1, 0, 0, 1, 0, 0);
  }
  context.clearRect(0, 0, bufferWidth, bufferHeight);
  const scaleX = bufferWidth / size.width;
  const scaleY = bufferHeight / size.height;
  if (typeof context.setTransform === 'function') {
    context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  } else if (typeof context.scale === 'function') {
    context.scale(scaleX, scaleY);
  }

  return {
    context,
    width: size.width,
    height: size.height,
    pixelRatio,
    bufferWidth,
    bufferHeight,
    scaleX,
    scaleY
  };
}

function recommendedRasterSide(rect, pixelRatio, options) {
  const config = options || {};
  const minimum = Math.max(1, Math.round(positiveNumber(config.minimum, 400)));
  const maximum = Math.max(minimum, Math.round(positiveNumber(config.maximum, 800)));
  const width = positiveNumber(rect && rect.width, 0);
  const height = positiveNumber(rect && rect.height, 0);
  const measured = Math.ceil(Math.max(width, height) * effectivePixelRatio(pixelRatio));
  return Math.max(minimum, Math.min(maximum, measured || minimum));
}

module.exports = {
  MAX_PIXEL_RATIO,
  effectivePixelRatio,
  measuredCanvasSize,
  prepareHighDensityCanvas,
  recommendedRasterSide
};
