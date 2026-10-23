const assert = require('node:assert/strict');
const test = require('node:test');

const { BAND_PACKETS, BAND_ROWS, INIT, NEXT_LABEL, normalizeCopies, rasterBands, rasterize } = require('../miniprogram/core/escpos');

// White RGBA image with the listed [x, y] pixels black.
function image(width, height, black) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  (black || []).forEach(([x, y]) => {
    const index = (y * width + x) * 4;
    data[index] = 0;
    data[index + 1] = 0;
    data[index + 2] = 0;
  });
  return { width, height, data };
}

test('commands are the receipt app\'s ESC/POS start and the vendor manual\'s next-label feed', () => {
  assert.deepEqual(Array.from(INIT), [0x1B, 0x40, 0x1B, 0x61, 0x00, 0x1B, 0x33, 0x18]);
  assert.deepEqual(Array.from(NEXT_LABEL), [0x1D, 0x0C]);
});

test('the label is rastered top to bottom, left pixel in the high bit, centred on the head', () => {
  const raster = rasterize(image(16, 2, [[0, 0], [15, 1]]), { widthDots: 32 });
  assert.deepEqual([raster.width, raster.bytesPerRow, raster.height], [32, 4, 2]);
  // Centred: the 16-dot label starts 8 dots in.
  assert.deepEqual(Array.from(raster.bytes), [0, 0x80, 0, 0, 0, 0, 0x01, 0]);

  const own = rasterize(image(10, 1, [[9, 0]]), {});
  assert.equal(own.width, 16, 'rounded up to whole bytes');
  // 16 dots wide, the 10-dot label starts 3 dots in: its last dot is column 12.
  assert.deepEqual(Array.from(own.bytes), [0, 0x08], 'without a head width the label is only padded to a byte, centred');
});

test('the same black and white threshold as the print preview decides each dot', () => {
  const grey = { width: 8, height: 1, data: new Uint8ClampedArray(8 * 4).fill(200) };
  assert.deepEqual(Array.from(rasterize(grey, { threshold: 180 }).bytes), [0]);
  assert.deepEqual(Array.from(rasterize(grey, { threshold: 220 }).bytes), [0xFF]);
});

test('bands are whole GS v 0 commands that fit eight packets', () => {
  const raster = { width: 384, bytesPerRow: 48, height: 100, bytes: new Uint8Array(48 * 100).fill(0xFF) };
  const bands = rasterBands(raster, 20);
  assert.deepEqual(Array.from(bands[0].slice(0, 8)), [0x1D, 0x76, 0x30, 0x00, 48, 0, 3, 0]);
  assert.ok(bands.every((band) => band.length <= 20 * BAND_PACKETS));
  assert.equal(bands.reduce((rows, band) => rows + band[6], 0), 100, 'every row is sent once');

  const roomy = rasterBands(raster, 244);
  assert.equal(roomy[0][6], 29, 'a 58 mm row is 48 bytes: 1400 bytes hold 29 rows');
  const narrow = rasterBands({ width: 320, bytesPerRow: 40, height: 100, bytes: new Uint8Array(4000) }, 244);
  assert.equal(narrow[0][6], BAND_ROWS, 'never more than 32 rows a band');
});

test('copy quantities normalize to a whole number from 1 to 99 for the job and the printer alike', () => {
  assert.deepEqual([120, 2.7, -8, 0, '3', Infinity, NaN, undefined].map(normalizeCopies), [99, 2, 1, 1, 3, 1, 1, 1]);
});
