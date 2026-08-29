const test = require("node:test");
const assert = require("node:assert/strict");
const { importNiimTemplate, mapAlignH, mapAlignV, parseFontStyle, isMissingImagePath } = require("../src/core/niim-template-import");
const product = require("../research/niim-templates/product.json");
const medicine = require("../research/niim-templates/medicine-price.json");
const stateGrid = require("../research/niim-templates/state-grid.json");
const c1 = require("../research/niim-templates/c1-default.json");

test("align and fontStyle helpers", () => {
  assert.equal(mapAlignH(0), "left");
  assert.equal(mapAlignH(1), "center");
  assert.equal(mapAlignH(2), "right");
  assert.equal(mapAlignV(1), "middle");
  assert.deepEqual(parseFontStyle(["bold"]), { bold: true, italic: false, underline: false });
});

test("import product template", () => {
  const { document, meta } = importNiimTemplate(product);
  assert.equal(document.widthMm, 94);
  assert.equal(document.heightMm, 40);
  assert.ok(document.elements.length >= 5);
  assert.ok(document.elements.some((e) => e.type === "barcode"));
  assert.ok(document.elements.some((e) => e.type === "text" && String(e.text).includes("卫龙")));
  assert.ok(meta.imported);
});

test("import medicine and state-grid", () => {
  const med = importNiimTemplate(medicine);
  assert.equal(med.document.widthMm, 50);
  assert.ok(med.document.elements.length >= 4);
  const sg = importNiimTemplate(stateGrid);
  assert.equal(sg.document.widthMm, 85);
  assert.ok(sg.document.elements.some((e) => e.type === "qrcode"));
  assert.ok(sg.document.elements.some((e) => e.type === "barcode"));
});

test("c1 empty shell still produces editable text", () => {
  const { document } = importNiimTemplate(c1);
  assert.equal(document.widthMm, 30);
  assert.equal(document.heightMm, 6);
  assert.ok(document.elements.length >= 1);
});

test("typesettingMode maps vertical and arc text with its 0-180 angle", () => {
  const vertical = importNiimTemplate({
    width: 30,
    height: 20,
    elements: [{ type: "text", value: "竖排", x: 1, y: 1, width: 6, height: 16, typesettingMode: 2 }]
  }).document.elements[0];
  assert.equal(vertical.textMode, "vertical");
  assert.equal(vertical.direction, "vertical");

  const verticalWords = importNiimTemplate({
    width: 30,
    height: 20,
    elements: [{ type: "text", value: "竖A", x: 1, y: 1, width: 6, height: 16, typesettingMode: 2, wordsRotate: 1 }]
  }).document.elements[0];
  assert.equal(verticalWords.textMode, "vertical-words-rotate");

  const horizontal90 = importNiimTemplate({
    width: 30,
    height: 20,
    elements: [{ type: "text", value: "横A", x: 1, y: 1, width: 16, height: 6, typesettingMode: 1, textDirection: 1 }]
  }).document.elements[0];
  assert.equal(horizontal90.textMode, "horizontal-90");
  assert.equal(horizontal90.direction, "horizontal");

  const horizontal90Words = importNiimTemplate({
    width: 30,
    height: 20,
    elements: [{ type: "text", value: "横A", x: 1, y: 1, width: 16, height: 6, typesettingMode: 1, textDirection: 1, wordsRotate: 1 }]
  }).document.elements[0];
  assert.equal(horizontal90Words.textMode, "horizontal-90-words-rotate");

  const arc = importNiimTemplate({
    width: 30,
    height: 20,
    elements: [{ type: "text", value: "弧形", x: 1, y: 1, width: 24, height: 12, typesettingMode: 3, typesettingParam: [0, 59] }]
  }).document.elements[0];
  assert.equal(arc.textMode, "arc");
  assert.equal(arc.textArcAngle, 59);
  assert.equal(arc.direction, "horizontal");
});

test("missing image markers are rejected while valid sibling assets survive", () => {
  assert.equal(isMissingImagePath("文件不存在"), true);
  assert.equal(isMissingImagePath("/tmp/文件不存在"), true);
  assert.equal(isMissingImagePath("assets/online-images/real.png"), false);
  const { document } = importNiimTemplate({
    name: "asset fixture",
    width: 30,
    height: 15,
    elements: [
      { type: "image", imageUrl: "文件不存在", x: 0, y: 0, width: 10, height: 10 },
      { type: "image", imageUrl: "assets/online-images/real.png", x: 10, y: 0, width: 10, height: 10 }
    ]
  });
  assert.deepEqual(document.elements.map((element) => element.path), ["assets/online-images/real.png"]);
});

test('imported unavailable fonts use an explicit generic fallback and retain their source id', () => {
  const { document, meta } = importNiimTemplate({
    width: 30,
    height: 15,
    elements: [{ type: 'text', value: '稳定字体', fontFamily: 'ZT201', x: 1, y: 1, width: 20, height: 5 }]
  });
  assert.equal(document.elements[0].fontFamily, 'sy-heiti');
  assert.equal(document.elements[0].sourceFontFamily, 'ZT201');
  assert.equal(meta.fontFallbackApplied, true);
  assert.equal(meta.fontFallbackCount, 1);
});

test('import clamps a rotated element by its rendered AABB instead of clipping it', () => {
  const { document, meta } = importNiimTemplate({
    width: 30,
    height: 20,
    elements: [{ type: 'text', value: '旋转', x: 27, y: 17, width: 10, height: 6, rotation: 45 }]
  });
  const element = document.elements[0];
  const angle = element.rotation * Math.PI / 180;
  const halfWidth = (Math.abs(Math.cos(angle)) * element.width + Math.abs(Math.sin(angle)) * element.height) / 2;
  const halfHeight = (Math.abs(Math.sin(angle)) * element.width + Math.abs(Math.cos(angle)) * element.height) / 2;
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  assert.ok(centerX - halfWidth >= -1e-6);
  assert.ok(centerY - halfHeight >= -1e-6);
  assert.ok(centerX + halfWidth <= document.widthMm + 1e-6);
  assert.ok(centerY + halfHeight <= document.heightMm + 1e-6);
  assert.equal(meta.geometryRepairCount, 1);
});

test('graph outline=0 remains hollow unless fill is explicitly enabled', () => {
  const { document } = importNiimTemplate({
    width: 30,
    height: 20,
    elements: [
      { type: 'graph', graphType: 0, outline: 0, x: 1, y: 1, width: 8, height: 8 },
      { type: 'graph', graphType: 0, outline: 0, fill: 1, x: 10, y: 1, width: 8, height: 8 }
    ]
  });
  assert.equal(document.elements[0].filled, false);
  assert.equal(document.elements[1].filled, true);
});

test('empty imported barcode and QR values stay empty and require user input', () => {
  const { document } = importNiimTemplate({
    width: 40,
    height: 20,
    elements: [
      { type: 'barcode', x: 1, y: 1, width: 12, height: 5 },
      { type: 'barcode', codeType: 30, x: 14, y: 1, width: 8, height: 8 },
      { type: 'qrcode', x: 24, y: 1, width: 8, height: 8 }
    ]
  });
  assert.deepEqual(document.elements.map((element) => element.value), ['', '', '']);
  assert.ok(document.elements.every((element) => element.requiresInput === true));
});

test('a fully locked import unlocks semantic working-copy layers and preserves source locks', () => {
  const { document, meta } = importNiimTemplate({
    width: 40,
    height: 20,
    elements: [
      { type: 'image', imageUrl: 'assets/background.png', isLock: 1, x: 0, y: 0, width: 40, height: 20 },
      { type: 'text', value: '可修改', isLock: 1, x: 2, y: 2, width: 12, height: 5 },
      { type: 'barcode', value: 'ABC123', locked: true, x: 2, y: 9, width: 20, height: 6 }
    ]
  });
  const [image, text, barcode] = document.elements;
  assert.equal(image.locked, true);
  assert.equal(image.sourceLocked, undefined);
  assert.deepEqual([text.locked, barcode.locked], [false, false]);
  assert.deepEqual([text.sourceLocked, barcode.sourceLocked], [true, true]);
  assert.equal(meta.semanticUnlockApplied, true);
  assert.equal(meta.semanticUnlockCount, 2);
});

test('partial source locks are preserved without automatic unlock', () => {
  const { document, meta } = importNiimTemplate({
    width: 30,
    height: 15,
    elements: [
      { type: 'text', value: '固定', isLock: 1, x: 1, y: 1, width: 10, height: 4 },
      { type: 'text', value: '可改', isLock: 0, x: 1, y: 6, width: 10, height: 4 }
    ]
  });
  assert.deepEqual(document.elements.map((element) => element.locked), [true, false]);
  assert.ok(document.elements.every((element) => element.sourceLocked === undefined));
  assert.equal(meta.semanticUnlockApplied, false);
});

test('bound fields and known editor placeholders require confirmation without invented business data', () => {
  const { document, meta } = importNiimTemplate({
    width: 40,
    height: 20,
    elements: [
      { type: 'text', value: 'A1', contentTitle: '台区名称', dataBind: [{}], x: 1, y: 1, width: 16, height: 4 },
      { type: 'text', value: '双击文本框编辑', x: 1, y: 6, width: 16, height: 4 },
      { type: 'barcode', value: '123456789', x: 1, y: 11, width: 20, height: 5 }
    ]
  });
  assert.equal(document.elements[0].text, 'A1');
  assert.doesNotMatch(document.elements[0].text, /滨江|王经理|示例/);
  assert.deepEqual(document.elements.map((element) => element.requiresInput), [true, true, true]);
  assert.equal(meta.requiresInputCount, 3);
  assert.equal(meta.needsAttention, true);
});

test('invalid EAN and unknown source code types retain their declarations instead of becoming Code128', () => {
  const { document, meta } = importNiimTemplate({
    width: 50,
    height: 20,
    elements: [
      { type: 'barcode', codeType: 24, value: '4006381333932', x: 1, y: 1, width: 22, height: 6 },
      { type: 'barcode', codeType: 16, value: 'ABC-16', x: 25, y: 1, width: 22, height: 6 }
    ]
  });
  const [ean, unknown] = document.elements;
  assert.equal(ean.format, 'ean13');
  assert.equal(ean.declaredFormat, 'ean13');
  assert.equal(ean.sourceCodeType, 24);
  assert.equal(ean.invalidCode, true);
  assert.match(ean.codeValidationMessage, /校验位/);
  assert.equal(unknown.format, 'unsupported');
  assert.equal(unknown.sourceCodeType, 16);
  assert.equal(unknown.declaredFormat, 'codeType-16');
  assert.equal(unknown.unsupportedCodeType, true);
  assert.equal(unknown.requiresFormatConfirmation, true);
  assert.equal(meta.invalidCodeCount, 1);
  assert.equal(meta.unsupportedCodeCount, 1);
});

test('missing images are omitted with attention metadata and 310 mm source width is preserved', () => {
  const missing = importNiimTemplate({
    name: '缺图模板',
    width: 40,
    height: 20,
    elements: [
      { type: 'image', imageUrl: '文件不存在', x: 0, y: 0, width: 10, height: 10 },
      { type: 'text', value: '仍可编辑', x: 1, y: 1, width: 15, height: 4 }
    ]
  });
  assert.equal(missing.document.elements.some((element) => element.type === 'image'), false);
  assert.equal(missing.meta.missingImageCount, 1);
  assert.equal(missing.meta.needsAttention, true);

  const long = importNiimTemplate({ width: 310, height: 50, elements: [] });
  assert.deepEqual([long.document.widthMm, long.document.heightMm], [310, 50]);
  assert.deepEqual([long.meta.sourceWidthMm, long.meta.sourceHeightMm], [310, 50]);
  assert.equal(long.meta.sizeClamped, false);
});

test('90-degree source boxes keep valid negative and over-axis coordinates when rotated ink fits', () => {
  const { document, meta } = importNiimTemplate({
    width: 75,
    height: 40,
    elements: [
      { type: 'text', value: '产自武夷山', x: 53.45395, y: 17.845394, width: 26.809212, height: 5.345395, rotate: 270 },
      { type: 'text', value: '青山茶业', x: -4.851974, y: 12.911184, width: 24.506578, height: 5.756579, rotate: 270 }
    ]
  });
  assert.ok(Math.abs(document.elements[0].x - 53.45395) < 1e-6);
  assert.ok(Math.abs(document.elements[1].x - (-4.851974)) < 1e-6);
  assert.deepEqual(document.elements.map((element) => element.width), [26.809212, 24.506578]);
  assert.equal(meta.geometryRepairCount, 0);
});

test('all locked semantic layers unlock even when an unlocked background exists', () => {
  const { document, meta } = importNiimTemplate({
    width: 30,
    height: 20,
    elements: [
      { type: 'image', imageUrl: 'assets/bg.png', isLock: 0, x: 0, y: 0, width: 30, height: 20 },
      { type: 'text', value: '可编辑', isLock: 1, x: 2, y: 2, width: 12, height: 4 }
    ]
  });
  assert.equal(document.elements[0].locked, false);
  assert.equal(document.elements[1].locked, false);
  assert.equal(document.elements[1].sourceLocked, true);
  assert.equal(meta.semanticUnlockCount, 1);
});

test('barcode and table font sources receive the same stable fallback metadata as text', () => {
  const { document, meta } = importNiimTemplate({
    width: 40,
    height: 20,
    elements: [
      { type: 'barcode', value: 'ABC100', fontFamily: 'ZT256', x: 1, y: 1, width: 20, height: 6 },
      { type: 'table', cells: ['A'], fontFamily: 'ZT032', x: 1, y: 8, width: 20, height: 8 }
    ]
  });
  assert.deepEqual(document.elements.map((element) => element.fontFamily), ['sy-heiti', 'sy-heiti']);
  assert.deepEqual(document.elements.map((element) => element.sourceFontFamily), ['ZT256', 'ZT032']);
  assert.equal(meta.fontFallbackCount, 2);
});
