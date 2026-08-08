const test = require("node:test");
const assert = require("node:assert/strict");
const { importNiimTemplate, mapAlignH, mapAlignV, parseFontStyle } = require("../src/core/niim-template-import");
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
