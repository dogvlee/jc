const assert = require('node:assert/strict');
const test = require('node:test');

const { createImageCacheRegistry } = require('../src/core/image-cache');

test('image cache only reuses pixels for the element current path', () => {
  const registry = createImageCacheRegistry();
  const images = {};
  const element = { id: 'same-id', type: 'material', path: 'A.png' };
  const imageA = {};
  const requestA = registry.begin(element);
  assert.equal(registry.accept(images, element, requestA, imageA), true);
  assert.equal(registry.cachedFor(images, element), imageA);

  element.path = 'B.png';
  assert.equal(registry.cachedFor(images, element), null);
  const imageB = {};
  const requestB = registry.begin(element);
  assert.equal(registry.accept(images, element, requestB, imageB), true);

  // Undo restores A on the same id: B must not be returned for A.
  element.path = 'A.png';
  assert.equal(registry.cachedFor(images, element), null);
});

test('a stale async request cannot overwrite a newer material path', () => {
  const registry = createImageCacheRegistry();
  const images = {};
  const element = { id: 'material-1', type: 'material', path: 'A.png' };
  const requestA = registry.begin(element);
  element.path = 'B.png';
  registry.invalidate(images, element.id);
  const requestB = registry.begin(element);

  assert.equal(registry.accept(images, element, requestA, { name: 'old A' }), false);
  const imageB = { name: 'new B' };
  assert.equal(registry.accept(images, element, requestB, imageB), true);
  assert.equal(registry.cachedFor(images, element), imageB);
});
