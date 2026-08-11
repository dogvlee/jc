const assert = require("node:assert/strict");
const test = require("node:test");
const { applyRowToDocument, buildDocumentsFromRows } = require("../miniprogram/app/data-bind");
const { buildTemplateDocument } = require("../miniprogram/app/template-layouts");
const { templates } = require("../miniprogram/app/catalog");
const { stockLabel } = require("../miniprogram/app/stock-presets");

test("applyRowToDocument fills title, price, barcode", () => {
  const document = buildTemplateDocument(templates.find((item) => item.id === "product-simple"));
  applyRowToDocument(document, {
    name: "青苹果",
    code: "6901234567892",
    price: "9.9",
    date: "2026-08-05"
  });
  assert.equal(document.name, "青苹果");
  const title = document.elements.find((item) => item.type === "text");
  assert.equal(title.text, "青苹果");
  const barcode = document.elements.find((item) => item.type === "barcode");
  assert.equal(barcode.value, "6901234567892");
  assert.equal(barcode.format, "ean13");
  const price = document.elements.find((item) => item.type === "text" && String(item.text).includes("¥"));
  assert.ok(price);
});

test("buildDocumentsFromRows creates one document per row", () => {
  const rows = [
    { name: "A", code: "A1", price: "1", date: "2026-01-01" },
    { name: "B", code: "B2", price: "2", date: "2026-01-02" }
  ];
  const docs = buildDocumentsFromRows(
    () => buildTemplateDocument(templates.find((item) => item.id === "product-simple")),
    rows
  );
  assert.equal(docs.length, 2);
  assert.equal(docs[0].name, "A");
  assert.equal(docs[1].name, "B");
});

test("stockLabel formats installed stock string", () => {
  assert.match(stockLabel(50, 30, 203), /T50×30/);
});
