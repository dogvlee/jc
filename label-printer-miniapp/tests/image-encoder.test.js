const test = require('node:test');
const assert = require('node:assert/strict');

const { isBlackPixel } = require('../miniprogram/core/image-encoder');

// Whether a 1×1 image of one RGBA colour prints black at `threshold`.
function prints(rgba, threshold) {
  return isBlackPixel({ width: 1, height: 1, data: Uint8ClampedArray.from(rgba) }, 0, 0, threshold);
}

test('an opaque pixel prints black only when its luminance is below the threshold', () => {
  assert.equal(prints([0, 0, 0, 255], 180), true);
  assert.equal(prints([255, 255, 255, 255], 180), false);
  assert.equal(prints([150, 150, 150, 255], 180), true);
  assert.equal(prints([150, 150, 150, 255], 120), false, 'a lower threshold leaves mid grey white');
  assert.equal(prints([100, 100, 100, 255], 100), false, 'a luminance equal to the threshold stays white');
  assert.equal(prints([100, 100, 100, 255], 101), true);
});

test('colours are weighed by how dark they look, not by the sum of their channels', () => {
  // Rec. 709 luminance: pure green is light (182), pure red (54) and blue (18) are dark.
  assert.equal(prints([0, 255, 0, 255], 180), false);
  assert.equal(prints([0, 255, 0, 255], 190), true);
  assert.equal(prints([255, 0, 0, 255], 180), true);
  assert.equal(prints([0, 0, 255, 255], 180), true);
});

test('transparency is blended over white paper before the threshold', () => {
  assert.equal(prints([0, 0, 0, 0], 180), false, 'transparent black is blank paper');
  assert.equal(prints([0, 0, 0, 0], 240), false, 'even at the highest threshold the app offers');
  assert.equal(prints([255, 0, 0, 0], 240), false, 'whatever colour the transparent pixel carries');
  assert.equal(prints([0, 0, 0, 128], 180), true, 'half-transparent black (127) is dark enough to print');
  assert.equal(prints([0, 0, 0, 64], 180), false, 'faint black (191) stays white');
  assert.equal(prints([0, 0, 0, 64], 200), true);
});

test('pixels are addressed row by row across the image width', () => {
  const width = 3;
  const height = 2;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  data.set([0, 0, 0, 255], (1 * width + 2) * 4);
  const image = { width, height, data };

  const black = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isBlackPixel(image, x, y, 180)) black.push([x, y]);
    }
  }
  assert.deepEqual(black, [[2, 1]]);
});
