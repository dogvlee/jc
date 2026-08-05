const test = require('node:test');
const assert = require('node:assert/strict');

const {
  alignedCanvasSize,
  getProfile,
  guessProfile,
  profileForModelId
} = require('../miniprogram/core/profiles');

test('alignedCanvasSize aligns only the axis presented to the printhead', () => {
  assert.deepEqual(
    alignedCanvasSize({ widthMm: 10.5, heightMm: 10.5 }, getProfile('d110')),
    { width: 84, height: 88 }
  );
  assert.deepEqual(
    alignedCanvasSize({ widthMm: 10.5, heightMm: 10.5 }, getProfile('b1')),
    { width: 88, height: 84 }
  );
});

test('alignedCanvasSize applies minimum dimensions and accepts exact head limits', () => {
  assert.deepEqual(
    alignedCanvasSize({ widthMm: 0, heightMm: 0 }, getProfile('d110')),
    { width: 8, height: 8 }
  );
  assert.deepEqual(
    alignedCanvasSize({ widthMm: 40, heightMm: 12 }, getProfile('d110')),
    { width: 320, height: 96 }
  );
  assert.deepEqual(
    alignedCanvasSize({ widthMm: 48, heightMm: 30 }, getProfile('b1')),
    { width: 384, height: 240 }
  );
});

test('alignedCanvasSize rejects labels wider than the active printhead axis', () => {
  assert.throws(() => alignedCanvasSize(
    { widthMm: 40, heightMm: 13 },
    getProfile('d110')
  ));
  assert.throws(() => alignedCanvasSize(
    { widthMm: 49, heightMm: 30 },
    getProfile('b1')
  ));
});

test('profile selection distinguishes overlapping B-series names and model IDs', () => {
  assert.equal(guessProfile('B21S_C2B').id, 'b21s');
  assert.equal(guessProfile('B21_C2B').id, 'b21-c2b');
  assert.equal(guessProfile('B21_L2B').id, 'b21');
  assert.equal(guessProfile('B1_A').id, 'b1');
  assert.equal(guessProfile('B21_PRO'), null);
  assert.equal(guessProfile('unknown'), null);

  assert.equal(profileForModelId(771, 'ignored').id, 'b21-c2b');
  assert.equal(profileForModelId(777, 'ignored').id, 'b21s');
  assert.equal(profileForModelId(512, 'D11', 1).id, 'd110');
  assert.equal(profileForModelId(512, 'D11', 3).id, 'd11-legacy');
  assert.equal(profileForModelId(514, 'D11S', 1).id, 'd11-legacy');
  assert.equal(profileForModelId(0, 'D110'), null);
  assert.equal(profileForModelId(4097, 'B1'), null);
  assert.equal(profileForModelId(528, 'D11'), null);
  assert.equal(profileForModelId(785, 'B21'), null);
  assert.equal(profileForModelId(null, 'D110').id, 'd110');
  assert.equal(profileForModelId(null, 'D11S', 1).id, 'd11-legacy');
  assert.equal(profileForModelId(null, 'D11', 1).id, 'd110');
  assert.equal(profileForModelId(null, 'D11', 3).id, 'd11-legacy');
});
