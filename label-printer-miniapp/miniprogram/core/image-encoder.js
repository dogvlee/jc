// Whether a pixel prints black: luminance over white, below `threshold`.
// Shared by the ESC/POS raster and the print-area checks, so the preview,
// the checks and the printer agree on every dot.
function isBlackPixel(imageData, x, y, threshold) {
  const index = (y * imageData.width + x) * 4;
  const alpha = imageData.data[index + 3] / 255;
  const red = imageData.data[index] * alpha + 255 * (1 - alpha);
  const green = imageData.data[index + 1] * alpha + 255 * (1 - alpha);
  const blue = imageData.data[index + 2] * alpha + 255 * (1 - alpha);
  const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
  return luminance < threshold;
}

module.exports = { isBlackPixel };
