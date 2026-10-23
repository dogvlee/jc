const { isBlackPixel } = require('./image-encoder');

// ESC/POS label printing, the only printer language the app speaks (深云达
// SYD and other thermal printers). Commands and pacing follow the receipt
// app in D:\vibecode\print (utils/print.js, print-table-simple.js
// sendBitmapBanded, the print tools' INIT_BYTES) and the vendor's 打印指令
// v1.06 (§3 黑标指令: GS FF 走纸到下一张).

// ESC @ reset, ESC a 0 left alignment, ESC 3 24 line spacing.
const INIT = Object.freeze([0x1B, 0x40, 0x1B, 0x61, 0x00, 0x1B, 0x33, 0x18]);
// GS FF: feed to the start of the next label (gap, black-mark and hole paper).
const NEXT_LABEL = Object.freeze([0x1D, 0x0C]);
// Continuous paper: GS P 203 203 then ESC J 160, about 20 mm past the tear
// bar, the receipt app's tail feed (src/domain/services/printing/paper-feed.js).
const TEAR_FEED = Object.freeze([0x1D, 0x50, 203, 203, 0x1B, 0x4A, 160]);
// Paper types as the print sheet numbers them: 1 gap, 2 black mark,
// 3 continuous, 4 holes.
const CONTINUOUS_PAPER = 3;
// Stable sending: at most 32 dot rows, 1400 bytes and 8 BLE packets per
// GS v 0 band, and 80 ms between bands so the head finishes one before the
// next arrives.
const BAND_ROWS = 32;
const BAND_BYTES = 1400;
const BAND_PACKETS = 8;
const BAND_DELAY_MS = 80;
// Time for the paper to reach the next label after GS FF, or to move 20 mm.
const FEED_DELAY_MS = 400;

/** Copies of one print: a whole number from 1 to 99. */
function normalizeCopies(value) {
  const copies = Number(value);
  return Number.isFinite(copies) ? Math.max(1, Math.min(99, Math.trunc(copies))) : 1;
}

/** What follows each label: GS FF to the next one, or a tear feed on continuous paper. */
function labelEnd(labelType) {
  return Number(labelType) === CONTINUOUS_PAPER ? TEAR_FEED : NEXT_LABEL;
}

/**
 * 1-bit raster of the label, rows top to bottom, most significant bit left,
 * centred on a line of `widthDots` (the print head) when that is wider.
 * Returns { width, bytesPerRow, height, bytes }.
 */
function rasterize(imageData, options) {
  const config = options || {};
  const threshold = Number(config.threshold) || 180;
  const imageWidth = imageData.width;
  const width = Math.ceil(Math.max(imageWidth, Number(config.widthDots) || 0) / 8) * 8;
  const offset = Math.floor((width - imageWidth) / 2);
  const bytesPerRow = width / 8;
  const height = imageData.height;
  const bytes = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < imageWidth; x += 1) {
      if (!isBlackPixel(imageData, x, y, threshold)) continue;
      const column = offset + x;
      bytes[y * bytesPerRow + (column >> 3)] |= 0x80 >> (column & 7);
    }
  }
  return { width, bytesPerRow, height, bytes };
}

/**
 * The raster as complete GS v 0 commands, one per band, each small enough
 * for BAND_PACKETS packets of `packetBytes` and at most BAND_BYTES of
 * pixels. Every band stands on its own, so a print can stop between bands
 * without leaving the printer waiting for pixels.
 */
function rasterBands(raster, packetBytes) {
  const packet = Math.max(20, Number(packetBytes) || 20);
  const bandBytes = Math.min(BAND_BYTES, packet * BAND_PACKETS - 8);
  const bandRows = Math.max(1, Math.min(BAND_ROWS, Math.floor(bandBytes / raster.bytesPerRow)));
  const bands = [];
  for (let y = 0; y < raster.height; y += bandRows) {
    const rows = Math.min(bandRows, raster.height - y);
    const band = new Uint8Array(8 + rows * raster.bytesPerRow);
    band[0] = 0x1D;
    band[1] = 0x76;
    band[2] = 0x30;
    band[3] = 0x00;
    band[4] = raster.bytesPerRow & 0xFF;
    band[5] = (raster.bytesPerRow >> 8) & 0xFF;
    band[6] = rows & 0xFF;
    band[7] = (rows >> 8) & 0xFF;
    band.set(raster.bytes.subarray(y * raster.bytesPerRow, (y + rows) * raster.bytesPerRow), 8);
    bands.push(band);
  }
  return bands;
}

module.exports = {
  BAND_BYTES,
  BAND_DELAY_MS,
  BAND_PACKETS,
  BAND_ROWS,
  FEED_DELAY_MS,
  INIT,
  NEXT_LABEL,
  TEAR_FEED,
  labelEnd,
  normalizeCopies,
  rasterBands,
  rasterize
};
