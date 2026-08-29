const test = require("node:test");
const assert = require("node:assert/strict");
const { ONLINE_TEMPLATES, getOnlineTemplate, buildOnlineDocument } = require("../src/app/online-templates-pack");
const { templates, getTemplate } = require("../src/app/catalog");
const { buildTemplateDocument, LAYOUT_BUILDERS } = require("../src/app/template-layouts");
const { seedUserTemplates } = require("../src/app/state");
const { templateLibraryPool } = require("../src/app/views");
const { CLEANROOM_TEMPLATE_PACK } = require("../src/app/cleanroom-template-pack");
const fs = require("node:fs");
const path = require("node:path");

if (typeof global.localStorage === "undefined") {
  const mem = new Map();
  global.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); },
    removeItem: (k) => { mem.delete(k); }
  };
}

test("online pack length >= 80", () => {
  assert.ok(ONLINE_TEMPLATES.length >= 80, "got " + ONLINE_TEMPLATES.length);
});

test("import one online template has elements", () => {
  const item = ONLINE_TEMPLATES[0];
  assert.ok(item);
  assert.ok(item.document.elements.length >= 1, item.id);
  const again = buildOnlineDocument(item.id);
  assert.ok(again.elements.length >= 1);
  assert.equal(getOnlineTemplate(item.id).name, item.name);
});

test("buildTemplateDocument does not register crawled online ids", () => {
  const item = ONLINE_TEMPLATES[0];
  assert.equal(LAYOUT_BUILDERS[item.id], undefined);
  const doc = buildTemplateDocument(item);
  assert.equal(doc.widthMm, item.size[0]);
  assert.equal(doc.heightMm, item.size[1]);
});

test("public catalog excludes crawled JingChen packs", () => {
  const originalCount = templates.filter((item) => item.source === "shangyue-original").length;
  const authorizedCount = templates.filter((item) => item.source === "shangyue-authorized-redesign").length;
  assert.equal(originalCount, 35 + CLEANROOM_TEMPLATE_PACK.length);
  assert.equal(templates.length, originalCount + authorizedCount);
  assert.ok(templates.every((item) => item.publicCatalog === true && item.releaseApproved === true));
  assert.equal(templates.filter((t) => t.source === "online-niim").length, 0);
  assert.equal(getTemplate(ONLINE_TEMPLATES[0].id), null);
});

test("seedUserTemplates does not copy online catalog into My templates", () => {
  assert.deepEqual(seedUserTemplates(), []);
});

test("all online image paths resolve to bundled assets", () => {
  const imageElements = ONLINE_TEMPLATES.flatMap((item) => item.document.elements || [])
    .filter((element) => element.type === "image");
  assert.ok(imageElements.length > 0);
  for (const element of imageElements) {
    assert.doesNotMatch(String(element.path || ""), /文件不存在|null|undefined|not[ _-]?found/i);
    if (String(element.path).startsWith("assets/")) {
      assert.ok(fs.existsSync(path.join(__dirname, "..", "public", element.path)), element.path);
    }
  }
  const repaired = getOnlineTemplate("online-482306420");
  assert.ok(repaired);
  const repairedImages = repaired.document.elements.filter((element) => element.type === "image");
  assert.equal(repairedImages.length, 1);
  assert.equal(repairedImages[0].id, "image-mskgxb8p-352");
  assert.equal(repairedImages[0].path, "assets/online-images/4726bf3eee2d3124.png");
});

test("template library hides seeded catalog copies from My and preserves genuine custom templates", () => {
  const seeded = seedUserTemplates();
  const all = templateLibraryPool({ templateCategory: "全部", userTemplates: seeded });
  assert.equal(all.length, templates.length);
  assert.equal(new Set(all.map((item) => item.id)).size, templates.length);
  assert.equal(templateLibraryPool({ templateCategory: "我的", userTemplates: seeded }).length, 0);

  const custom = { id: "custom-r01", name: "自定义", document: { widthMm: 40, heightMm: 12, elements: [] } };
  const withCustom = templateLibraryPool({ templateCategory: "全部", userTemplates: [...seeded, custom] });
  assert.equal(withCustom.length, templates.length + 1);
  assert.ok(withCustom.some((item) => item.id === custom.id));
  assert.equal(templateLibraryPool({ templateCategory: "我的", userTemplates: [...seeded, custom] }).length, 1);
});
