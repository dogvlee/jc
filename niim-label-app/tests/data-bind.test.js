const assert = require("node:assert/strict");
const test = require("node:test");
const {
  applyRowToDocument,
  buildDocumentsFromRows,
  isBatchCompatibleTemplate,
  resolveBatchCompatibleTemplate
} = require("../src/app/data-bind");
const { buildTemplateDocument } = require("../src/app/template-layouts");
const { getTemplate, templates } = require("../src/app/catalog");
const { stockLabel } = require("../src/app/stock-presets");

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

test("batch binding rejects an incompatible template and safely resolves stale settings", () => {
  const product = getTemplate("product-simple");
  const wish = getTemplate("shangyue-wish-card");
  const wishDocument = buildTemplateDocument(wish);
  const before = JSON.stringify(wishDocument);

  assert.equal(isBatchCompatibleTemplate(wish), false);
  assert.equal(isBatchCompatibleTemplate(wishDocument), false);
  assert.equal(
    resolveBatchCompatibleTemplate([wish, product], wish.id, product.id).id,
    product.id
  );
  assert.throws(
    () => applyRowToDocument(wishDocument, { name: "不应写入", code: "123" }),
    /不支持批量数据绑定/
  );
  assert.equal(JSON.stringify(wishDocument), before);
  assert.throws(
    () => buildDocumentsFromRows(() => buildTemplateDocument(wish), [{ name: "不应生成" }]),
    /不支持批量数据绑定/
  );
});

test("stockLabel formats installed stock string", () => {
  assert.match(stockLabel(50, 30, 203), /T50×30/);
});
