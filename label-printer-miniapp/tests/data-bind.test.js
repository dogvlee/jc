const assert = require("node:assert/strict");
const test = require("node:test");
const { applyRowToDocument, buildBatchDocuments, buildDocumentsFromRows } = require("../miniprogram/app/data-bind");
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

test("stockLabel names the paper the way shop owners read it", () => {
  assert.equal(stockLabel(50, 30, 203), "50×30 mm 标签纸");
});

test("explicit bind fields fill only the tagged elements", () => {
  const document = {
    name: "模板",
    widthMm: 40,
    heightMm: 30,
    templateMeta: { batchCompatible: true },
    elements: [
      { id: "header", type: "text", text: "商品标价签" },
      { id: "name", type: "text", text: "云南青提", bindField: "name" },
      { id: "price", type: "text", text: "¥16.80", bindField: "price" },
      { id: "code", type: "barcode", value: "6901234567892", format: "ean13", bindField: "code" },
      { id: "made", type: "date", autoUpdate: true, bindField: "date" }
    ]
  };
  applyRowToDocument(document, { name: "赣南脐橙", code: "ABC-1001", price: "39.9", date: "2026-10-01" });
  const byId = Object.fromEntries(document.elements.map((item) => [item.id, item]));
  assert.equal(byId.header.text, "商品标价签");
  assert.equal(byId.name.text, "赣南脐橙");
  assert.equal(byId.price.text, "¥39.9");
  assert.equal(byId.code.value, "ABC-1001");
  assert.equal(byId.code.format, "code128");
  assert.equal(byId.made.autoUpdate, false);
  assert.equal(byId.made.fixedValue, "2026-10-01");
  assert.equal(document.name, "赣南脐橙");
});

test("tagged and untagged templates agree on when a code prints as EAN-13", () => {
  const tagged = () => ({
    widthMm: 40,
    heightMm: 30,
    elements: [{ id: "code", type: "barcode", value: "0", format: "code128", bindField: "code" }]
  });
  const untagged = () => buildTemplateDocument(getTemplate("product-simple"));
  const formats = (code) => [tagged(), untagged()].map((document) => {
    applyRowToDocument(document, { name: "样品", code });
    return document.elements.find((item) => item.type === "barcode").format;
  });
  assert.deepEqual(formats("6901234567892"), ["ean13", "ean13"]);
  assert.deepEqual(formats("6901234567890"), ["code128", "code128"]);
  assert.deepEqual(formats("123456789012"), ["code128", "code128"]);
});

test("curated batch templates bind every row and still pass print validation", () => {
  const { curatedBatchTemplates, buildCuratedBatchDocument } = require("../miniprogram/app/curated/index");
  const { validateDocument } = require("../miniprogram/core/renderer");
  const picks = curatedBatchTemplates();
  assert.ok(picks.length >= 10);
  for (const pick of picks) {
    const document = buildCuratedBatchDocument(pick.id);
    assert.equal(document.templateMeta.batchCompatible, true, pick.id);
    applyRowToDocument(document, { name: "批量测试品", code: "6901234567892", price: "12.50" });
    const bound = document.elements.filter((item) => item.bindField);
    assert.ok(bound.length >= 1, pick.id);
    const values = document.elements.map((item) => [item.text, item.value].join(" ")).join(" ");
    if (bound.some((item) => item.bindField === "name")) assert.match(values, /批量测试品/, pick.id);
    if (bound.some((item) => item.bindField === "price")) assert.match(values, /¥12.50/, pick.id);
    if (bound.some((item) => item.bindField === "code")) assert.match(values, /6901234567892/, pick.id);
    assert.doesNotThrow(() => validateDocument(document, 203), pick.id);
  }
});

function taggedLabel() {
  return {
    name: "模板",
    widthMm: 40,
    heightMm: 30,
    templateMeta: { batchCompatible: true },
    elements: [
      { id: "header", type: "text", x: 1, y: 1, width: 38, height: 4, text: "商品标价签" },
      { id: "name", type: "text", x: 1, y: 5, width: 38, height: 5, text: "云南青提", bindField: "name" },
      { id: "price", type: "text", x: 1, y: 10, width: 38, height: 5, text: "¥16.80", bindField: "price" },
      { id: "code", type: "barcode", x: 2, y: 16, width: 36, height: 8, value: "6901234567892", format: "ean13", bindField: "code" },
      { id: "made", type: "date", x: 1, y: 25, width: 38, height: 4, autoUpdate: true, fixedValue: "", bindField: "date" }
    ]
  };
}

function byId(document) {
  return Object.fromEntries(document.elements.map((item) => [item.id, item]));
}

test("buildBatchDocuments fills an edited curated template once per filled row", () => {
  const { buildCuratedBatchDocument } = require("../miniprogram/app/curated/index");
  const { validateDocument } = require("../miniprogram/core/renderer");
  const base = buildCuratedBatchDocument("sy-tpl-priceSimple-40x30-00");
  const bound = (document, field) => document.elements.find((item) => item.bindField === field);
  bound(base, "name").x += 1.5;
  const before = JSON.stringify(base);
  const validated = [];
  const documents = buildBatchDocuments(base, [
    { id: "r1", name: "青苹果", code: "6901234567892", price: "9.9", date: "" },
    { id: "r2", name: " ", code: "", price: "", date: "" },
    { id: "r3", name: "香蕉", code: "6901234567885", price: "¥4.50", date: "" }
  ], {
    validate(document, rowNumber) {
      validated.push(rowNumber);
      validateDocument(document, 203);
    }
  });
  assert.equal(JSON.stringify(base), before, "the base document is never changed");
  assert.deepEqual(validated, [1, 3]);
  assert.deepEqual(documents.map((document) => document.name), ["青苹果", "香蕉"]);
  assert.equal(bound(documents[0], "name").text, "青苹果");
  assert.equal(bound(documents[0], "price").text, "¥9.9");
  assert.equal(bound(documents[0], "code").value, "6901234567892");
  assert.equal(bound(documents[1], "price").text, "¥4.50");
  assert.equal(bound(documents[1], "code").value, "6901234567885");
  assert.equal(bound(documents[1], "name").x, bound(base, "name").x, "layout edits carry over to every row");
  bound(documents[0], "name").text = "改动";
  assert.equal(bound(documents[1], "name").text, "香蕉", "every row gets its own copy");
});

test("batch documents are named by name, then code, then row number", () => {
  const documents = buildBatchDocuments(taggedLabel(), [
    { name: "  苹果 ", code: "A1" },
    { code: "B2", price: "3" },
    {},
    { price: "5" }
  ]);
  assert.deepEqual(documents.map((document) => document.name), ["苹果", "B2", "第 4 行"]);
  assert.deepEqual(buildBatchDocuments(taggedLabel(), [{ name: "", code: " " }, null]), []);
  assert.deepEqual(buildBatchDocuments(taggedLabel(), undefined), []);
});

test("a value other rows fill never leaks onto a row that leaves it blank", () => {
  const rows = [
    { name: "甲", code: "A-1", price: "1", date: "2026-10-01" },
    { name: "乙", code: "", price: "", date: "" }
  ];
  // The editor typically shows the first row, so the edited base carries its values.
  const base = applyRowToDocument(taggedLabel(), rows[0]);
  const [first, second] = buildBatchDocuments(base, rows).map(byId);
  assert.equal(first.price.text, "¥1");
  assert.equal(first.made.fixedValue, "2026-10-01");
  assert.equal(second.name.text, "乙");
  assert.equal(second.price.text, "");
  assert.equal(second.code.value, "");
  assert.equal(second.made.autoUpdate, true);
  assert.equal(second.made.fixedValue, "");
  assert.equal(second.header.text, "商品标价签");
});

test("a field that no row fills keeps what the base document shows", () => {
  const [document] = buildBatchDocuments(taggedLabel(), [{ name: "只有品名" }]).map(byId);
  assert.equal(document.name.text, "只有品名");
  assert.equal(document.price.text, "¥16.80");
  assert.equal(document.code.value, "6901234567892");
  assert.equal(document.made.autoUpdate, true);
});

test("a row that cannot become a label is reported by its row number", () => {
  const { validateDocument } = require("../miniprogram/core/renderer");
  const validate = (document) => validateDocument(document, 203);
  const rows = [{ name: "甲", code: "6901234567892" }, {}, { name: "乙", code: "" }];
  assert.throws(() => buildBatchDocuments(taggedLabel(), rows, { validate }), (error) => {
    assert.equal(error.code, "BATCH_ROW_INVALID");
    assert.equal(error.rowNumber, 3);
    assert.equal(error.message, "第 3 行无法生成：请先填写条码内容");
    return true;
  });
  assert.throws(
    () => buildBatchDocuments(taggedLabel(), [{ name: "甲" }, { name: Object.create(null) }]),
    (error) => error.rowNumber === 2 && /^第 2 行无法生成：/.test(error.message)
  );
});

test("an incompatible base is refused once, before any row", () => {
  const base = buildTemplateDocument(getTemplate("shangyue-wish-card"));
  assert.throws(() => buildBatchDocuments(base, [{ name: "甲" }]), (error) => {
    assert.match(error.message, /不支持批量数据/);
    assert.equal(error.rowNumber, undefined);
    return true;
  });
});
