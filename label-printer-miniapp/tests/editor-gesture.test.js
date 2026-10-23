const assert = require('node:assert/strict');
const test = require('node:test');

const {
  ROTATE_HANDLE_GAP,
  handleHitRegion,
  longPressSelection,
  nextSelectionId,
  rotateHandleLocal,
  selectionHitDecision,
  selectionTargetSizeMm
} = require('../miniprogram/core/editor-gesture');

test('holding the sole selected element keeps ordinary single selection', () => {
  assert.deepEqual(longPressSelection(['a'], 'a'), { enterMulti: false, ids: ['a'] });
  assert.deepEqual(longPressSelection([], 'a'), { enterMulti: false, ids: [] });
});

test('holding a distinct second element extends selection and deduplicates the base', () => {
  assert.deepEqual(longPressSelection(['a', 'a'], 'b'), { enterMulti: true, ids: ['a', 'b'] });
});

test('large touch handles stay outside the content instead of stealing its center', () => {
  assert.equal(handleHitRegion('s', 0, -16.5, 'touch'), false);
  assert.equal(handleHitRegion('s', 0, 0, 'touch'), true);
  assert.equal(handleHitRegion('s', 0, 35, 'touch'), true);
  assert.equal(handleHitRegion('s', 0, 37, 'touch'), false);
  assert.equal(handleHitRegion('e', -16.5, 0, 'touch'), false);
  assert.equal(handleHitRegion('e', 0, 0, 'touch'), true);
  assert.equal(handleHitRegion('rotate', -16.5, -16.5, 'touch'), false);
  assert.equal(handleHitRegion('rotate', 0, 0, 'touch'), true);
  assert.equal(handleHitRegion('rotate', 0, 21, 'touch'), true);
  assert.equal(handleHitRegion('rotate', 0, 23, 'touch'), false);
});

test('the corner scale handle reaches outward from the box corner', () => {
  assert.equal(handleHitRegion('se', -16.5, -16.5, 'touch'), false, 'the content keeps its centre');
  assert.equal(handleHitRegion('se', -8, -8, 'touch'), true);
  assert.equal(handleHitRegion('se', 0, 0, 'touch'), true);
  assert.equal(handleHitRegion('se', 36, 36, 'touch'), true);
  assert.equal(handleHitRegion('se', 37, 0, 'touch'), false);
  assert.equal(handleHitRegion('se', 20, 20, 'mouse'), true);
  assert.equal(handleHitRegion('se', 23, 0, 'mouse'), false);
});

test('the rotate handle floats above the box, below it at the label top, else on the corner', () => {
  const box = { left: -5, top: -2, width: 10, height: 4 };
  const gap = ROTATE_HANDLE_GAP / 10;
  const middle = { x: 10, y: 8, width: 10, height: 4, rotation: 0 };
  assert.deepEqual(rotateHandleLocal(middle, box, gap, 40, 30), { x: 0, y: -2 - gap });
  const top = { x: 10, y: 0.5, width: 10, height: 4, rotation: 0 };
  assert.deepEqual(rotateHandleLocal(top, box, gap, 40, 30), { x: 0, y: 2 + gap });
  const full = { x: 10, y: 0, width: 10, height: 30, rotation: 0 };
  const fullBox = { left: -5, top: -15, width: 10, height: 30 };
  assert.deepEqual(rotateHandleLocal(full, fullBox, gap, 40, 30), { x: 5, y: -15 });
  // A half-turned element at the label top has its own "above" at the bottom.
  const turned = { x: 10, y: 0.5, width: 10, height: 4, rotation: 180 };
  assert.deepEqual(rotateHandleLocal(turned, box, gap, 40, 30), { x: 0, y: -2 - gap });
});

test('selection target converts the 44px touch area to label millimetres', () => {
  const document = { widthMm: 40, heightMm: 20 };
  const canvas = { width: 400, height: 200 };
  assert.deepEqual(selectionTargetSizeMm(document, canvas, 'touch'), {
    minWidthMm: 4.4,
    minHeightMm: 4.4
  });
  assert.deepEqual(selectionTargetSizeMm(document, canvas, 'mouse'), {
    minWidthMm: 2,
    minHeightMm: 2
  });
});

test('repeat taps preserve drag first, then cycle through overlap candidates', () => {
  const candidates = [{ id: 'top' }, { id: 'middle' }, { id: 'bottom' }];
  assert.deepEqual(selectionHitDecision(candidates, ''), {
    element: candidates[0],
    candidateIds: ['top', 'middle', 'bottom'],
    cycleOnTap: false
  });
  assert.deepEqual(selectionHitDecision(candidates, 'middle'), {
    element: candidates[1],
    candidateIds: ['top', 'middle', 'bottom'],
    cycleOnTap: true
  });
  assert.equal(nextSelectionId(['top', 'middle', 'bottom'], 'middle'), 'bottom');
  assert.equal(nextSelectionId(['top', 'middle', 'bottom'], 'bottom'), 'top');
});
