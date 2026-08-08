const assert = require('node:assert/strict');
const test = require('node:test');

const {
  changeTextDirection,
  normalizeAngleDelta,
  pointerAngle,
  resizeRotatedElement
} = require('../src/core/geometry');

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
