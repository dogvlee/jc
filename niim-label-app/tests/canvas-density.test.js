const test = require('node:test');
const assert = require('node:assert/strict');

const {
  effectivePixelRatio,
  prepareHighDensityCanvas,
  recommendedRasterSide
} = require('../src/app/canvas-density');

function fakeCanvas(width, height) {
  const calls = [];
  const context = {
    clearRect(...args) { calls.push(['clearRect', ...args]); },
    setTransform(...args) { calls.push(['setTransform', ...args]); }
  };
  return {
    width: 56,
    height: 56,
    calls,
    getBoundingClientRect() { return { width, height }; },
    getContext(kind) { return kind === '2d' ? context : null; }
  };
}

test('high-density canvas uses the CSS box times DPR as its backing store', () => {
  const canvas = fakeCanvas(52, 48);
  const result = prepareHighDensityCanvas(canvas, { pixelRatio: 3 });
  assert.equal(canvas.width, 156);
  assert.equal(canvas.height, 144);
  assert.equal(result.width, 52);
  assert.equal(result.height, 48);
  assert.equal(result.pixelRatio, 3);
  assert.deepEqual(canvas.calls.at(-1), ['setTransform', 3, 0, 0, 3, 0, 0]);
});

test('high-density helpers bound memory while retaining retina detail', () => {
  assert.equal(effectivePixelRatio(0), 1);
  assert.equal(effectivePixelRatio(8), 4);
  assert.equal(recommendedRasterSide({ width: 180, height: 120 }, 3), 540);
  assert.equal(recommendedRasterSide({ width: 500, height: 300 }, 4), 800);
  assert.equal(recommendedRasterSide({ width: 40, height: 30 }, 2), 400);
});
