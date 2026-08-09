const assert = require('node:assert/strict');
const test = require('node:test');

const {
  TEXT_MODE_OPTIONS,
  clampTextArcAngle,
  legacyDirectionForMode,
  normalizeTextMode
} = require('../src/core/text-direction');

test('text direction catalog has six unique Simplified Chinese native assets', () => {
  assert.equal(TEXT_MODE_OPTIONS.length, 6);
  assert.equal(new Set(TEXT_MODE_OPTIONS.map((option) => option.id)).size, 6);
  TEXT_MODE_OPTIONS.forEach((option) => assert.match(option.asset, /_cn\.svg$/));
});

test('legacy direction fallback and mode-to-direction compatibility are deterministic', () => {
  assert.equal(normalizeTextMode({ direction: 'vertical' }), 'vertical');
  assert.equal(normalizeTextMode({ direction: 'horizontal' }), 'horizontal');
  assert.equal(normalizeTextMode({ direction: 'vertical', textMode: 'arc' }), 'arc');
  assert.equal(normalizeTextMode('unknown'), 'horizontal');
  assert.equal(legacyDirectionForMode('vertical'), 'vertical');
  assert.equal(legacyDirectionForMode('vertical-words-rotate'), 'vertical');
  ['horizontal', 'horizontal-90', 'horizontal-90-words-rotate', 'arc'].forEach((mode) => {
    assert.equal(legacyDirectionForMode(mode), 'horizontal');
  });
});

test('arc angle is clamped to the supported 0-180 range', () => {
  assert.equal(clampTextArcAngle(-1), 0);
  assert.equal(clampTextArcAngle(81), 81);
  assert.equal(clampTextArcAngle(181), 180);
  assert.equal(clampTextArcAngle(Number.NaN), 180);
});
