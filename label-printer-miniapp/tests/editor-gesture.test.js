const assert = require('node:assert/strict');
const test = require('node:test');

const {
  handleHitRegion,
  longPressSelection
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
});
