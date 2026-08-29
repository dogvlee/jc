const assert = require("node:assert/strict");
const test = require("node:test");
const { applyRowToDocument, buildDocumentsFromRows } = require("../miniprogram/app/data-bind");
const { buildTemplateDocument } = require("../miniprogram/app/template-layouts");
const { BATCH_TEMPLATES, getTemplate, templates } = require("../miniprogram/app/catalog");
const { stockLabel } = require("../miniprogram/app/stock-presets");

test("applyRowToDocument fills title, price, barcode", () => {
  const document = buildTemplateDocument(getTemplate("product-simple"));
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
    () => buildTemplateDocument(getTemplate("product-simple")),
    rows
  );
  assert.equal(docs.length, 2);
  assert.equal(docs[0].name, "A");
  assert.equal(docs[1].name, "B");
});

test("batch binding rejects an explicitly incompatible template before mutation", () => {
  const document = buildTemplateDocument(getTemplate("shangyue-wish-card"));
  const before = JSON.stringify(document);
  assert.equal(document.templateMeta.batchCompatible, false);
  assert.throws(
    () => applyRowToDocument(document, { name: "不应写入", code: "A1" }),
    /不支持批量数据/
  );
  assert.equal(JSON.stringify(document), before);
});

test("the explicit batch allowlist contains the 32 base layouts but not the wish card", () => {
  assert.equal(BATCH_TEMPLATES.length, 32);
  assert.equal(BATCH_TEMPLATES.some((item) => item.id === "shangyue-wish-card"), false);
  assert.ok(BATCH_TEMPLATES.every((item) => item.batchCompatible === true));
});

test("stockLabel formats installed stock string", () => {
  assert.match(stockLabel(50, 30, 203), /T50×30/);
});
