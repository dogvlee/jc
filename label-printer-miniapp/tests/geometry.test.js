const assert = require('node:assert/strict');
const test = require('node:test');

const {
  changeTextDirection,
  changeTextMode,
  fitElementToSelectionBounds,
  normalizeAngleDelta,
  pointerAngle,
  resizeRotatedElement,
  scaleRotatedElement,
} = require('../miniprogram/core/geometry');

function rotateLocalPoint(element, localX, localY) {
  const angle = element.rotation * Math.PI / 180;
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  return {
    x: centerX + localX * Math.cos(angle) - localY * Math.sin(angle),
    y: centerY + localX * Math.sin(angle) + localY * Math.cos(angle)
  };
}

test('rotation gestures use a relative angle without a bottom-handle jump', () => {
  const center = { x: 10, y: 10 };
  const start = pointerAngle({ x: 10, y: 14 }, center);
  const current = pointerAngle({ x: 9, y: 14 }, center);
  assert.ok(Math.abs(normalizeAngleDelta(current - start)) < 20);
  assert.equal(normalizeAngleDelta(181), -179);
});

test('rotated resize follows local axes and preserves the opposite corner', () => {
  for (const rotation of [0, 90, 270]) {
    const original = { x: 8, y: 7, width: 8, height: 4, rotation };
    const anchor = rotateLocalPoint(original, -original.width / 2, -original.height / 2);
    const next = { ...original, ...resizeRotatedElement(original, 'se', { x: 2, y: 1 }, 1) };
    const nextAnchor = rotateLocalPoint(next, -next.width / 2, -next.height / 2);
    assert.ok(Math.abs(nextAnchor.x - anchor.x) < 1e-9, `x anchor changed at ${rotation}`);
    assert.ok(Math.abs(nextAnchor.y - anchor.y) < 1e-9, `y anchor changed at ${rotation}`);
  }
});

test('content-fitted handle becomes the real resize box and follows the pointer', () => {
  const element = {
    id: 'tight-text',
    type: 'text',
    x: 2,
    y: 3,
    width: 30,
    height: 6,
    rotation: 0,
    _fit: { left: 0, top: 0, w: 1 / 6, h: 1 }
  };
  const visibleRightBefore = element.x + element.width * element._fit.w;
  assert.equal(fitElementToSelectionBounds(element), true);
  assert.equal(element.selectionFit, false);
  assert.equal(element.width, 5);
  assert.equal(element.x + element.width, visibleRightBefore);
  assert.doesNotMatch(JSON.stringify(element), /_fit/);

  const next = resizeRotatedElement({ ...element }, 'e', { x: 3, y: 0 }, 1);
  assert.equal(next.x + next.width - visibleRightBefore, 3);
});

test('promoting a rotated fit box preserves its visible handle coordinates', () => {
  for (const rotation of [37, 90, 143]) {
    const element = {
      id: `rotated-${rotation}`,
      type: 'text',
      x: 8,
      y: 6,
      width: 24,
      height: 10,
      rotation,
      _fit: { left: 0.2, top: 0.15, w: 0.35, h: 0.55 }
    };
    const localX = -element.width / 2 + (element._fit.left + element._fit.w) * element.width;
    const localY = -element.height / 2 + (element._fit.top + element._fit.h) * element.height;
    const visibleSe = rotateLocalPoint(element, localX, localY);
    fitElementToSelectionBounds(element);
    const promotedSe = rotateLocalPoint(element, element.width / 2, element.height / 2);
    assert.ok(Math.abs(promotedSe.x - visibleSe.x) < 1e-9, `${rotation}° x`);
    assert.ok(Math.abs(promotedSe.y - visibleSe.y) < 1e-9, `${rotation}° y`);
  }
});

test('vertical text direction reshapes a wide text box and restores its horizontal size', () => {
  const document = { widthMm: 40, heightMm: 12 };
  const element = { x: 2, y: 1.5, width: 36, height: 4.32, direction: 'horizontal' };

  changeTextDirection(element, 'vertical', document);
  assert.equal(element.direction, 'vertical');
  assert.equal(element.width, 4.32);
  assert.equal(element.height, 12);
  assert.ok(element.x >= 0 && element.x + element.width <= document.widthMm);
  assert.ok(element.y >= 0 && element.y + element.height <= document.heightMm);

  changeTextDirection(element, 'horizontal', document);
  assert.equal(element.direction, 'horizontal');
  assert.equal(element.width, 36);
  assert.equal(element.height, 4.32);
  assert.equal(element.directionLayout, undefined);
});

test('text modes keep legacy direction compatible and only vertical modes reshape geometry', () => {
  const document = { widthMm: 40, heightMm: 20 };
  const element = { x: 2, y: 4, width: 30, height: 5, direction: 'horizontal', textMode: 'horizontal' };

  changeTextMode(element, 'horizontal-90', document);
  assert.equal(element.direction, 'horizontal');
  assert.deepEqual([element.width, element.height], [30, 5]);

  changeTextMode(element, 'arc', document);
  assert.equal(element.direction, 'horizontal');
  assert.deepEqual([element.width, element.height], [30, 5]);

  changeTextMode(element, 'vertical-words-rotate', document);
  assert.equal(element.direction, 'vertical');
  assert.deepEqual([element.width, element.height], [5, 20]);

  changeTextMode(element, 'vertical', document);
  assert.deepEqual([element.width, element.height], [5, 20]);

  changeTextMode(element, 'horizontal', document);
  assert.equal(element.direction, 'horizontal');
  assert.deepEqual([element.width, element.height], [30, 5]);
});

test('the corner handle scales an element as a whole, text size and spacing too', () => {
  const label = { widthMm: 60, heightMm: 40 };
  const text = { x: 5, y: 5, width: 10, height: 5, rotation: 0, fontSize: 4, letterSpacing: 0.5, lineSpacing: 1 };
  const scaled = scaleRotatedElement(text, { x: 10, y: 5 }, label, 0.8);
  assert.deepEqual(scaled, { x: 5, y: 5, width: 20, height: 10, fontSize: 8, letterSpacing: 1, lineSpacing: 2 });

  // Dragging along the box edge still keeps the proportions: the drag is
  // projected onto the diagonal.
  const sideways = scaleRotatedElement(text, { x: 10, y: 0 }, label, 0.8);
  assert.ok(Math.abs(sideways.width / sideways.height - 2) < 1e-9);
  assert.equal(sideways.x, 5);
  assert.equal(sideways.y, 5);
});

test('scaling stops at the label edge, the smallest size and the text size range', () => {
  const label = { widthMm: 40, heightMm: 30 };
  const box = { x: 5, y: 5, width: 10, height: 5, rotation: 0, fontSize: 4 };
  const capped = scaleRotatedElement(box, { x: 100, y: 100 }, label, 0.8);
  assert.ok(Math.abs(capped.x + capped.width - 40) < 0.01, 'stops at the right edge');
  assert.ok(Math.abs(capped.width / capped.height - 2) < 0.01);
  assert.ok(capped.fontSize > 4 && capped.fontSize <= 14.01);

  const shrunk = scaleRotatedElement(box, { x: -100, y: -100 }, label, 0.8);
  assert.ok(Math.abs(shrunk.height - 0.8) < 1e-9, 'the shorter side keeps the minimum size');
  assert.ok(shrunk.fontSize >= 0.5);

  const shape = { x: 5, y: 5, width: 10, height: 5, rotation: 0 };
  const tiny = scaleRotatedElement(shape, { x: -100, y: -100 }, label, 0.8);
  assert.ok(Math.abs(tiny.height - 0.8) < 1e-9, 'the shorter side keeps the minimum size');
  assert.equal(tiny.fontSize, undefined, 'elements without text get no font size');

  // Text never grows past the 25 mm a saved label keeps.
  const large = { x: 1, y: 1, width: 10, height: 10, rotation: 0, fontSize: 20 };
  assert.equal(scaleRotatedElement(large, { x: 30, y: 30 }, { widthMm: 100, heightMm: 100 }, 0.8).fontSize, 25);
  const big = { x: 1, y: 1, width: 10, height: 10, rotation: 0, fontSize: 50 };
  assert.equal(scaleRotatedElement(big, { x: 10, y: 10 }, { widthMm: 100, heightMm: 100 }, 0.8).fontSize, 50);
});

test('scaling keeps the same text limits as a saved label', () => {
  const { SCALED_SIZE_RANGES } = require('../miniprogram/core/geometry');
  const { DOCUMENT_LIMITS } = require('../miniprogram/services/repository');
  assert.deepEqual(SCALED_SIZE_RANGES.fontSize, [DOCUMENT_LIMITS.minFontSizeMm, DOCUMENT_LIMITS.maxFontSizeMm]);
  assert.deepEqual(SCALED_SIZE_RANGES.letterSpacing, [DOCUMENT_LIMITS.minLetterSpacingMm, DOCUMENT_LIMITS.maxLetterSpacingMm]);
  assert.deepEqual(SCALED_SIZE_RANGES.lineSpacing, [DOCUMENT_LIMITS.minLineSpacing, DOCUMENT_LIMITS.maxLineSpacing]);
});

test('scaling a rotated element keeps its visual top-left corner in place', () => {
  const label = { widthMm: 60, heightMm: 60 };
  const element = { x: 20, y: 20, width: 10, height: 4, rotation: 90 };
  const corner = rotateLocalPoint(element, -5, -2);
  // At 90° the box's own right-down diagonal points left-down on the label.
  const scaled = scaleRotatedElement(element, { x: -4, y: 10 }, label, 0.8);
  const moved = rotateLocalPoint(Object.assign({ rotation: 90 }, scaled), -scaled.width / 2, -scaled.height / 2);
  assert.ok(Math.abs(moved.x - corner.x) < 0.01);
  assert.ok(Math.abs(moved.y - corner.y) < 0.01);
  assert.ok(Math.abs(scaled.width / scaled.height - 2.5) < 0.01);
  assert.ok(scaled.width > 10);
});

test('touching the corner of an element already past a limit does not make it jump', () => {
  const label = { widthMm: 60, heightMm: 40 };
  const thinLine = { x: 5, y: 5, width: 30, height: 0.3, rotation: 0 };
  assert.deepEqual(scaleRotatedElement(thinLine, { x: 0, y: 0 }, label, 0.8), { x: 5, y: 5, width: 30, height: 0.3 });
  const fine = { x: 5, y: 5, width: 10, height: 2, rotation: 0, fontSize: 0.8 };
  assert.equal(scaleRotatedElement(fine, { x: 0, y: 0 }, label, 0.8).fontSize, 0.8);
  // It can still grow.
  assert.ok(scaleRotatedElement(fine, { x: 10, y: 2 }, label, 0.8).fontSize > 0.8);
});
