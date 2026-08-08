const test = require('node:test');
const assert = require('node:assert/strict');

const {
  alignedCanvasSize,
  evaluatePrintability,
  getProfile,
  guessProfile,
  previewCanvasSize,
  profileForModelId
} = require('../src/core/profiles');

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

test('alignedCanvasSize rejects invalid dimensions and accepts exact head limits', () => {
  assert.throws(() => alignedCanvasSize({ widthMm: 0, heightMm: 0 }, getProfile('d110')), /大于 0/);
  assert.throws(() => alignedCanvasSize({ widthMm: -1, heightMm: 12 }, getProfile('d110')), /大于 0/);
  assert.throws(() => alignedCanvasSize({ widthMm: Number.NaN, heightMm: 12 }, getProfile('d110')), /大于 0/);
  assert.deepEqual(
    alignedCanvasSize({ widthMm: 40, heightMm: 12 }, getProfile('d110')),
    { width: 320, height: 96 }
  );
  assert.deepEqual(
    alignedCanvasSize({ widthMm: 48, heightMm: 30 }, getProfile('b1')),
    { width: 384, height: 240 }
  );
});

test('previewCanvasSize allows editing labels that do not fit the selected printer', () => {
  assert.deepEqual(previewCanvasSize({ widthMm: 50, heightMm: 40 }, 203), { width: 400, height: 320 });
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

test('evaluatePrintability reports the blocker and a model that can print it', () => {
  const fits = evaluatePrintability({ widthMm: 40, heightMm: 12 }, getProfile('d110'));
  assert.equal(fits.ok, true);
  assert.equal(fits.suggestProfileId, '');

  // 40x30 is the shape most of the catalog uses; D110 cannot print it.
  const blocked = evaluatePrintability({ widthMm: 40, heightMm: 30 }, getProfile('d110'));
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /打印高度最多/);
  assert.equal(getProfile(blocked.suggestProfileId).printheadPixels, 384);

  // Nothing in the catalog of profiles can take a 60mm-wide label.
  const hopeless = evaluatePrintability({ widthMm: 60, heightMm: 60 }, getProfile('b1'));
  assert.equal(hopeless.ok, false);
  assert.equal(hopeless.suggestProfileId, '');
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
  assert.equal(profileForModelId(2320, 'D110_M').id, 'd110');
  assert.equal(profileForModelId(4098, 'B1 SE').id, 'b1');
  assert.equal(profileForModelId(4097, 'B1'), null); // B1 Pro 300dpi — blocked until hardware proof
  assert.equal(profileForModelId(528, 'D11'), null); // D11_H 300dpi
  assert.equal(profileForModelId(785, 'B21'), null); // B21_Pro 300dpi
  assert.equal(profileForModelId(null, 'D110').id, 'd110');
  assert.equal(profileForModelId(null, 'D11S', 1).id, 'd11-legacy');
  assert.equal(profileForModelId(null, 'D11', 1).id, 'd110');
  assert.equal(profileForModelId(null, 'D11', 3).id, 'd11-legacy');
});

