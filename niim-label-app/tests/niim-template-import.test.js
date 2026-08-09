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
