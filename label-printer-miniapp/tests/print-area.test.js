const test = require('node:test');
const assert = require('node:assert/strict');

const {
  alignedCanvasSize,
  cropImageData,
  elementInkBounds,
  evaluatePrintability,
  getProfile,
  marginInkMessage,
  marginInkReport,
  printRasterPlan,
  printableProfilesForDocument,
  printerFamilyCode,
  printerFamilyLabel
} = require('../miniprogram/core/profiles');
const { printAreaCheck } = require('../miniprogram/core/print-area');
const { isBlackPixel } = require('../miniprogram/core/image-encoder');

// 58 mm printer: a 384-dot (48 mm) head on paper up to 58 mm wide.
// 80 mm printer: a 576-dot (72 mm) head on paper up to 80 mm wide.
const PRINTER_58 = getProfile('escpos-58');
const PRINTER_80 = getProfile('escpos-80');
// No shipped profile feeds the label sideways, but print-area.js still handles
// a head that spans the label height: here 96 dots on paper up to 15 mm high.
const SIDE_FED = Object.freeze({ dpi: 203, printheadPixels: 96, paperMaxMm: 15, printDirection: 'left' });

function label(widthMm, heightMm, elements) {
  return { schemaVersion: 1, name: '测试', widthMm, heightMm, elements };
}

function text(id, box, extra) {
  return Object.assign({ id, type: 'text', text: '样品', rotation: 0, fontSize: 3 }, box, extra);
}

function block(id, box, extra) {
  return Object.assign({ id, type: 'rect', filled: true, rotation: 0 }, box, extra);
}

// A 50×30 label with every element at least 1 mm from the left and right edge.
function wideLabel(extra) {
  return label(50, 30, [
    text('title', { x: 1, y: 2, width: 48, height: 6 }),
    block('band', { x: 1.5, y: 10, width: 47, height: 5 })
  ].concat(extra || []));
}

test('a 50 mm label prints on the 58 mm printer by skipping the blank centred strips', () => {
  const plan = printRasterPlan(wideLabel(), PRINTER_58);
  assert.deepEqual(plan, {
    headAxis: 'x',
    canvas: { width: 400, height: 240 },
    crop: { x: 8, y: 0, width: 384, height: 240 }
  });
  // Centred: the same number of dots is skipped on each side.
  assert.equal(plan.crop.x, plan.canvas.width - plan.crop.x - plan.crop.width);

  const check = evaluatePrintability(wideLabel(), PRINTER_58);
  assert.deepEqual(check, {
    ok: true,
    message: '',
    suggestProfileId: '',
    cropped: true,
    reason: '',
    elementId: ''
  });
  // The 80 mm printer's 72 mm head covers the whole label.
  assert.equal(printRasterPlan(wideLabel(), PRINTER_80).crop, null);
});

test('the widest paper each printer takes is centred under its head', () => {
  // 58 mm is 463.5 dots: about 40 dots (5 mm) on each side miss the 384-dot head.
  assert.deepEqual(printRasterPlan(label(58, 30, []), PRINTER_58), {
    headAxis: 'x',
    canvas: { width: 464, height: 240 },
    crop: { x: 40, y: 0, width: 384, height: 240 }
  });
  // 80 mm is 639.4 dots: about 32 dots (4 mm) on each side miss the 576-dot head.
  assert.deepEqual(printRasterPlan(label(80, 30, []), PRINTER_80), {
    headAxis: 'x',
    canvas: { width: 640, height: 240 },
    crop: { x: 32, y: 0, width: 576, height: 240 }
  });
  const edge = [text('edge', { x: 0.5, y: 10, width: 10, height: 5 })];
  assert.equal(
    evaluatePrintability(label(58, 30, edge), PRINTER_58).message,
    '这台打印机左右两侧各约 5.0 mm 打不到，请把靠边的内容往中间移一点再打印。'
  );
  assert.equal(
    evaluatePrintability(label(80, 30, edge), PRINTER_80).message,
    '这台打印机左右两侧各约 4.0 mm 打不到，请把靠边的内容往中间移一点再打印。'
  );
});

test('content in a skipped strip blocks printing and names the element', () => {
  const tooClose = wideLabel([text('price', { x: 0.4, y: 20, width: 12, height: 5 })]);
  const check = evaluatePrintability(tooClose, PRINTER_58);
  assert.equal(check.ok, false);
  assert.equal(check.reason, 'MARGIN_INK');
  assert.equal(check.elementId, 'price');
  assert.equal(check.cropped, true);
  assert.equal(check.message, '这台打印机左右两侧各约 1.0 mm 打不到，请把靠边的内容往中间移一点再打印。');
  // Nothing is skipped on the 80 mm printer, so it prints the label as designed.
  assert.equal(check.suggestProfileId, 'escpos-80');
  assert.deepEqual(evaluatePrintability(tooClose, PRINTER_80), {
    ok: true,
    message: '',
    suggestProfileId: '',
    cropped: false,
    reason: '',
    elementId: ''
  });

  const rightEdge = wideLabel([block('tag', { x: 40, y: 20, width: 9.5, height: 5 })]);
  assert.equal(evaluatePrintability(rightEdge, PRINTER_58).elementId, 'tag');

  // On 80 mm paper there is no wider printer to offer.
  const crowded = evaluatePrintability(label(80, 30, [text('title', { x: 20, y: 2, width: 58, height: 6 })]), PRINTER_80);
  assert.equal(crowded.reason, 'MARGIN_INK');
  assert.equal(crowded.elementId, 'title');
  assert.equal(crowded.suggestProfileId, '');
});

test('rotation is taken into account when an element nears a strip', () => {
  const upright = text('code', { x: 4, y: 11, width: 2, height: 10 });
  assert.equal(evaluatePrintability(wideLabel([upright]), PRINTER_58).ok, true);

  const turned = Object.assign({}, upright, { rotation: 90 });
  const bounds = elementInkBounds(turned, 203);
  assert.ok(Math.abs(bounds.left) < 1e-9 && Math.abs(bounds.right - 10) < 1e-9);
  const check = evaluatePrintability(wideLabel([turned]), PRINTER_58);
  assert.equal(check.reason, 'MARGIN_INK');
  assert.equal(check.elementId, 'code');
});

test('labels wider than the paper the printer takes are refused in plain words', () => {
  const wide = label(60, 40, [text('title', { x: 5, y: 5, width: 20, height: 6 })]);
  assert.throws(() => printRasterPlan(wide, PRINTER_58), (error) => error.code === 'PAPER_TOO_LARGE');
  const check = evaluatePrintability(wide, PRINTER_58);
  assert.equal(check.ok, false);
  assert.equal(check.reason, 'PAPER_TOO_LARGE');
  assert.equal(check.cropped, false);
  assert.equal(
    check.message,
    '58mm 打印机只能装宽度不超过 58 mm 的标签纸，当前标签 60×40 mm 放不进去。请换成适合这台打印机的尺寸或模板。'
  );
  // 60 mm fits the 80 mm printer's 72 mm head as it is.
  assert.equal(check.suggestProfileId, 'escpos-80');

  const huge = evaluatePrintability(label(90, 40, []), PRINTER_80);
  assert.equal(huge.ok, false);
  assert.equal(huge.reason, 'PAPER_TOO_LARGE');
  assert.equal(huge.suggestProfileId, '');
  assert.equal(
    huge.message,
    '80mm 打印机只能装宽度不超过 80 mm 的标签纸，当前标签 90×40 mm 放不进去。请换成适合这台打印机的尺寸或模板。'
  );

  // Exactly the paper width still prints; a tenth of a millimetre more does not.
  assert.equal(evaluatePrintability(label(58, 30, []), PRINTER_58).ok, true);
  assert.equal(evaluatePrintability(label(58.1, 30, []), PRINTER_58).reason, 'PAPER_TOO_LARGE');
  assert.equal(evaluatePrintability(label(80, 30, []), PRINTER_80).ok, true);
  assert.equal(evaluatePrintability(label(80.1, 30, []), PRINTER_80).reason, 'PAPER_TOO_LARGE');
});

test('the paper size message puts a space only after a Latin model name', () => {
  const wide = label(60, 40, []);
  const named = (name) => Object.assign({}, PRINTER_58, { name });
  assert.match(printAreaCheck(wide, PRINTER_58).message, /^58mm 打印机只能装宽度不超过 58 mm 的标签纸，/);
  assert.match(printAreaCheck(wide, named('SYD-58')).message, /^SYD-58 只能装宽度不超过 58 mm 的标签纸，/);
  assert.match(printAreaCheck(wide, named('')).message, /^这台打印机只能装宽度不超过 58 mm 的标签纸，/);
});

test('a head that spans the label height crops the height and words its limit as a height', () => {
  const strip = label(40, 15, [
    text('name', { x: 2, y: 1.5, width: 20, height: 12 }),
    block('mark', { x: 30, y: 3, width: 6, height: 9 })
  ]);
  assert.deepEqual(printRasterPlan(strip, SIDE_FED), {
    headAxis: 'y',
    canvas: { width: 320, height: 120 },
    crop: { x: 0, y: 12, width: 320, height: 96 }
  });
  const check = printAreaCheck(strip, SIDE_FED);
  assert.equal(check.ok, true);
  assert.equal(check.cropped, true);

  const crowded = printAreaCheck(label(40, 15, [text('name', { x: 2, y: 1, width: 20, height: 12 })]), SIDE_FED);
  assert.equal(crowded.ok, false);
  assert.equal(crowded.reason, 'MARGIN_INK');
  assert.equal(crowded.elementId, 'name');
  assert.match(crowded.message, /^这台打印机上下两侧各约 1\.5 mm 打不到/);

  const tall = printAreaCheck(label(40, 30, [text('name', { x: 2, y: 2, width: 20, height: 6 })]), SIDE_FED);
  assert.equal(tall.ok, false);
  assert.equal(tall.reason, 'PAPER_TOO_LARGE');
  assert.equal(
    tall.message,
    '这台打印机只能装高度不超过 15 mm 的标签纸，当前标签 40×30 mm 放不进去。请换成适合这台打印机的尺寸或模板。'
  );

  // A label within the head height keeps its canvas and is never cropped.
  const fits = label(40, 12, [text('name', { x: 0, y: 0, width: 40, height: 12 })]);
  const plan = printRasterPlan(fits, SIDE_FED);
  assert.equal(plan.headAxis, 'y');
  assert.equal(plan.crop, null);
  assert.deepEqual(plan.canvas, alignedCanvasSize(fits, SIDE_FED));
  assert.equal(printAreaCheck(fits, SIDE_FED).ok, true);
});

test('labels that fit the head keep today\'s canvas and are never cropped', () => {
  // Content may run to the very edge of a label no wider than the head.
  const fits = label(48, 30, [text('name', { x: 0, y: 0, width: 48, height: 30 })]);
  const plan = printRasterPlan(fits, PRINTER_58);
  assert.equal(plan.crop, null);
  assert.equal(plan.headAxis, 'x');
  assert.deepEqual(plan.canvas, alignedCanvasSize(fits, PRINTER_58));
  assert.deepEqual(evaluatePrintability(fits, PRINTER_58), {
    ok: true,
    message: '',
    suggestProfileId: '',
    cropped: false,
    reason: '',
    elementId: ''
  });
  const full = label(72, 30, [text('name', { x: 0, y: 0, width: 72, height: 30 })]);
  assert.deepEqual(printRasterPlan(full, PRINTER_80), {
    headAxis: 'x',
    canvas: { width: 576, height: 240 },
    crop: null
  });
  assert.equal(evaluatePrintability(full, PRINTER_80).ok, true);
  assert.deepEqual(printRasterPlan(label(10.5, 10.5, []), PRINTER_58), {
    headAxis: 'x',
    canvas: { width: 88, height: 84 },
    crop: null
  });
});

test('the printable band follows the label centre, not the byte padding', () => {
  // 48.15 mm is 384.8 dots: padded to 392 dots, but the head only misses 0.8 dot.
  const plan = printRasterPlan(label(48.15, 30, []), PRINTER_58);
  assert.equal(plan.canvas.width, 392);
  assert.deepEqual(plan.crop, { x: 0, y: 0, width: 384, height: 240 });
  // The same along the label height: 12.1 mm is 96.7 dots, padded to 104.
  const tall = printRasterPlan(label(40, 12.1, []), SIDE_FED);
  assert.equal(tall.canvas.height, 104);
  assert.deepEqual(tall.crop, { x: 0, y: 0, width: 320, height: 96 });
});

test('invalid sizes still report the existing message', () => {
  const check = evaluatePrintability({ widthMm: 0, heightMm: 12, elements: [] }, PRINTER_58);
  assert.equal(check.ok, false);
  assert.equal(check.reason, '');
  assert.equal(check.suggestProfileId, '');
  assert.match(check.message, /大于 0/);
});

function assertBounds(actual, expected) {
  for (const side of ['left', 'right', 'top', 'bottom']) {
    assert.ok(Math.abs(actual[side] - expected[side]) < 1e-9, `${side}: ${actual[side]} ≠ ${expected[side]}`);
  }
}

test('ink bounds follow what the renderer actually draws', () => {
  assert.equal(elementInkBounds(text('empty', { x: 0, y: 0, width: 5, height: 5 }, { text: '  ' }), 203), null);
  assert.equal(elementInkBounds(block('flat', { x: 0, y: 0, width: 0, height: 5 }), 203), null);
  assert.equal(elementInkBounds({ id: 'photo', type: 'image', x: 0, y: 0, width: 5, height: 5 }, 203), null);
  assertBounds(elementInkBounds(text('name', { x: 2, y: 3, width: 10, height: 4 }), 203), {
    left: 2, right: 12, top: 3, bottom: 7
  });
  // Outlines are stroked on the box edge, so half the stroke lands outside it.
  assertBounds(elementInkBounds(block('frame', { x: 2, y: 2, width: 10, height: 6 }, { filled: false, lineWidth: 0.4 }), 203), {
    left: 1.8, right: 12.2, top: 1.8, bottom: 8.2
  });
  // A rule is one stroke along the middle of its box, with square ends.
  assertBounds(elementInkBounds({ id: 'rule', type: 'line', x: 2, y: 5, width: 20, height: 2, lineWidth: 0.3 }, 203), {
    left: 2, right: 22, top: 5.85, bottom: 6.15
  });
});

function image(width, height) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4).fill(255) };
}

function paint(imageData, x, y, rgba) {
  imageData.data.set(rgba, (y * imageData.width + x) * 4);
}

const WIDE_PLAN = { headAxis: 'x', canvas: { width: 16, height: 2 }, crop: { x: 4, y: 0, width: 8, height: 2 } };
const TALL_PLAN = { headAxis: 'y', canvas: { width: 3, height: 16 }, crop: { x: 0, y: 4, width: 3, height: 8 } };

test('marginInkReport finds ink the printer would skip, pixel for pixel', () => {
  const blank = image(16, 2);
  assert.deepEqual(marginInkReport(blank, WIDE_PLAN, 180), { ink: false });

  const inside = image(16, 2);
  paint(inside, 4, 0, [0, 0, 0, 255]);
  paint(inside, 11, 1, [0, 0, 0, 255]);
  assert.deepEqual(marginInkReport(inside, WIDE_PLAN, 180), { ink: false });

  const left = image(16, 2);
  paint(left, 3, 1, [0, 0, 0, 255]);
  assert.deepEqual(marginInkReport(left, WIDE_PLAN, 180), { ink: true });
  const right = image(16, 2);
  paint(right, 12, 0, [0, 0, 0, 255]);
  assert.deepEqual(marginInkReport(right, WIDE_PLAN, 180), { ink: true });

  const bottom = image(3, 16);
  paint(bottom, 1, 15, [0, 0, 0, 255]);
  assert.deepEqual(marginInkReport(bottom, TALL_PLAN, 180), { ink: true });
  assert.deepEqual(marginInkReport(bottom, Object.assign({}, TALL_PLAN, { crop: null }), 180), { ink: false });
});

test('marginInkReport makes the same black/white call as the encoder', () => {
  const cases = [
    [[0, 0, 0, 0], 180],       // transparent black composites to white paper
    [[0, 0, 0, 128], 180],     // half-transparent black is dark enough to print
    [[150, 150, 150, 255], 180],
    [[150, 150, 150, 255], 120],
    [[150, 150, 150, 255], undefined]
  ];
  for (const [rgba, threshold] of cases) {
    const sample = image(16, 2);
    paint(sample, 0, 0, rgba);
    const printed = isBlackPixel(sample, 0, 0, Number(threshold) || 180);
    assert.equal(marginInkReport(sample, WIDE_PLAN, threshold).ink, printed, `${rgba} @ ${threshold}`);
  }
  const transparent = image(16, 2);
  paint(transparent, 0, 0, [0, 0, 0, 0]);
  assert.equal(marginInkReport(transparent, WIDE_PLAN, 180).ink, false);
});

test('cropImageData keeps only the band the head prints', () => {
  const source = image(16, 2);
  paint(source, 4, 0, [0, 0, 0, 255]);
  paint(source, 11, 1, [10, 20, 30, 255]);
  const band = cropImageData(source, WIDE_PLAN.crop);
  assert.equal(band.width, 8);
  assert.equal(band.height, 2);
  assert.deepEqual([...band.data.slice(0, 4)], [0, 0, 0, 255]);
  assert.deepEqual([...band.data.slice((1 * 8 + 7) * 4, (1 * 8 + 7) * 4 + 4)], [10, 20, 30, 255]);
  assert.equal(cropImageData(source, null), source);
});

test('the print path rasters the whole label, re-checks the strips, then sends the band', () => {
  const plan = printRasterPlan(wideLabel(), PRINTER_58);
  const raster = image(plan.canvas.width, plan.canvas.height);
  paint(raster, 200, 100, [0, 0, 0, 255]);
  assert.equal(marginInkReport(raster, plan, 180).ink, false);
  const band = cropImageData(raster, plan.crop);
  assert.deepEqual([band.width, band.height], [384, 240]);
  assert.equal(isBlackPixel(band, 200 - plan.crop.x, 100, 180), true);

  // Ink the bounds check could not foresee (e.g. a glyph) still blocks, in the same words.
  paint(raster, 3, 100, [0, 0, 0, 255]);
  assert.equal(marginInkReport(raster, plan, 180).ink, true);
  assert.equal(marginInkMessage(wideLabel(), PRINTER_58, plan), '这台打印机左右两侧各约 1.0 mm 打不到，请把靠边的内容往中间移一点再打印。');
  assert.equal(marginInkMessage(wideLabel(), PRINTER_58, printRasterPlan(label(40, 30, []), PRINTER_58)), '');

  // An 80 mm label on the 80 mm printer: dots 32 to 607 reach the head.
  const widePlan = printRasterPlan(label(80, 30, []), PRINTER_80);
  const wideRaster = image(widePlan.canvas.width, widePlan.canvas.height);
  paint(wideRaster, 32, 0, [0, 0, 0, 255]);
  paint(wideRaster, 607, 239, [0, 0, 0, 255]);
  assert.equal(marginInkReport(wideRaster, widePlan, 180).ink, false);
  const wideBand = cropImageData(wideRaster, widePlan.crop);
  assert.deepEqual([wideBand.width, wideBand.height], [576, 240]);
  assert.equal(isBlackPixel(wideBand, 0, 0, 180), true);
  assert.equal(isBlackPixel(wideBand, 575, 239, 180), true);
  paint(wideRaster, 608, 120, [0, 0, 0, 255]);
  assert.equal(marginInkReport(wideRaster, widePlan, 180).ink, true);
});

test('printable profiles and family labels group the two paper widths', () => {
  const both = ['escpos-58', 'escpos-80'];
  assert.deepEqual(printableProfilesForDocument(wideLabel()), both);
  assert.deepEqual(printableProfilesForDocument(label(40, 30, [text('name', { x: 2, y: 2, width: 20, height: 8 })])), both);
  // Wider than 58 mm paper, or ink in the 58 mm printer's skipped strips: 80 mm only.
  assert.deepEqual(printableProfilesForDocument(label(60, 40, [])), ['escpos-80']);
  assert.deepEqual(
    printableProfilesForDocument(wideLabel([text('price', { x: 0.4, y: 20, width: 12, height: 5 })])),
    ['escpos-80']
  );
  assert.deepEqual(printableProfilesForDocument(label(90, 40, [])), []);

  assert.equal(printerFamilyLabel(['escpos-58']), '58mm');
  assert.equal(printerFamilyLabel(['escpos-80']), '80mm');
  assert.equal(printerFamilyLabel(['escpos-80', 'escpos-58']), '58mm · 80mm');
  assert.equal(printerFamilyLabel([]), '');
  assert.equal(printerFamilyLabel(undefined), '');
  assert.equal(printerFamilyLabel(['unknown']), '');
  assert.equal(printerFamilyLabel(['d110', 'b1']), '', 'retired NIIMBOT models name no family');
  assert.equal(printerFamilyCode(['escpos-80', 'escpos-58']), '58');
  assert.equal(printerFamilyCode(['escpos-58']), '5');
  assert.equal(printerFamilyCode(['escpos-80']), '8');
  assert.equal(printerFamilyCode([]), '');
  assert.equal(printerFamilyCode(['b21-c2b', 'd110']), '');
});
