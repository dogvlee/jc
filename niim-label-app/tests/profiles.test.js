const test = require('node:test');
const assert = require('node:assert/strict');

const {
  alignedCanvasSize,
  elementsCutByCrop,
  evaluatePrintability,
  getProfile,
  guessProfile,
  previewCanvasSize,
  printableWindowMm,
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

test('stock slightly wider than the head is center-cropped instead of refused', () => {
  // B21-class: 50mm paper on a 48.05mm (384-dot) head prints the centered strip.
  const b1 = alignedCanvasSize({ widthMm: 50, heightMm: 30 }, getProfile('b1'));
  assert.deepEqual(b1, { width: 384, height: 240, cropOffsetX: 8, cropOffsetY: 0, cropped: true });
  // D110-class: 13mm tape on a 12.01mm (96-dot) head.
  const d110 = alignedCanvasSize({ widthMm: 40, heightMm: 13 }, getProfile('d110'));
  assert.deepEqual(d110, { width: 320, height: 96, cropOffsetX: 0, cropOffsetY: 4, cropped: true });
  // The uncropped path keeps its exact historical shape.
  assert.deepEqual(alignedCanvasSize({ widthMm: 48, heightMm: 30 }, getProfile('b1')), { width: 384, height: 240 });
});

test('alignedCanvasSize still rejects labels far beyond the crop tolerance', () => {
  assert.throws(() => alignedCanvasSize(
    { widthMm: 40, heightMm: 16 },
    getProfile('d110')
  ), /打印高度最多/);
  assert.throws(() => alignedCanvasSize(
    { widthMm: 60, heightMm: 30 },
    getProfile('b1')
  ), /打印宽度最多/);
});

test('printableWindowMm exposes the centered window only when cropping', () => {
  assert.equal(printableWindowMm({ widthMm: 40, heightMm: 30 }, getProfile('b1')), null);
  const window = printableWindowMm({ widthMm: 50, heightMm: 30 }, getProfile('b1'));
  assert.equal(window.axis, 'width');
  assert.ok(Math.abs(window.x - 1.0) < 0.05);
  assert.ok(Math.abs(window.printableMm - 48.05) < 0.05);
  assert.ok(Math.abs(window.marginMm - 0.98) < 0.05);
  assert.equal(window.height, 30);
});

test('evaluatePrintability reports the crop as an advisory notice, not a block', () => {
  const cropped = evaluatePrintability({ widthMm: 50, heightMm: 30 }, getProfile('b1'));
  assert.equal(cropped.ok, true);
  assert.match(cropped.notice, /居中打印/);
  assert.match(cropped.notice, /左右各约 1\.0 mm/);
  const fits = evaluatePrintability({ widthMm: 40, heightMm: 30 }, getProfile('b1'));
  assert.equal(fits.ok, true);
  assert.equal(fits.notice, '');
});

test('codes reaching into the cropped margin are detected, rotation included', () => {
  const document = {
    widthMm: 50,
    heightMm: 30,
    elements: [
      { id: 'safe', type: 'barcode', x: 5, y: 5, width: 20, height: 8, rotation: 0 },
      { id: 'cut-left', type: 'barcode', x: 0.2, y: 5, width: 20, height: 8, rotation: 0 },
      { id: 'text-cut', type: 'text', x: 0.2, y: 16, width: 10, height: 4, rotation: 0 },
      { id: 'rotated-cut', type: 'qrcode', x: 38, y: 10, width: 10, height: 10, rotation: 45 }
    ]
  };
  const codes = elementsCutByCrop(document, getProfile('b1'), ['barcode', 'qrcode']);
  assert.deepEqual(codes.map((item) => item.id), ['cut-left', 'rotated-cut']);
  const everything = elementsCutByCrop(document, getProfile('b1'));
  assert.ok(everything.some((item) => item.id === 'text-cut'));
  assert.deepEqual(elementsCutByCrop({ widthMm: 40, heightMm: 30, elements: document.elements }, getProfile('b1')), []);
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
  assert.match(hopeless.message, /最大已验证打印头约 48\.0 mm/);
  assert.match(hopeless.message, /真机样张验证/);
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

