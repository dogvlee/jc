const test = require("node:test");
const assert = require("node:assert/strict");
const { ONLINE_TEMPLATES, getOnlineTemplate, buildOnlineDocument } = require("../src/app/online-templates-pack");
const { templates, getTemplate } = require("../src/app/catalog");
const { buildTemplateDocument, LAYOUT_BUILDERS } = require("../src/app/template-layouts");
const { seedUserTemplates } = require("../src/app/state");

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

test("buildTemplateDocument works for online id", () => {
  const item = ONLINE_TEMPLATES[0];
  assert.equal(typeof LAYOUT_BUILDERS[item.id], "function");
  const doc = buildTemplateDocument(getTemplate(item.id) || item);
  assert.ok(doc.elements.length >= 1);
  assert.equal(doc.widthMm, item.size[0]);
  assert.equal(doc.heightMm, item.size[1]);
});

test("catalog includes online meta", () => {
  const onlineInCatalog = templates.filter((t) => t.source === "online-niim");
  assert.ok(onlineInCatalog.length >= 80, "catalog online " + onlineInCatalog.length);
});

test("seedUserTemplates includes online templates", () => {
  const ut = seedUserTemplates();
  const online = ut.filter((t) => String(t.id).startsWith("online-"));
  assert.ok(online.length >= 80, "seed online " + online.length);
  assert.ok(online[0].document.elements.length >= 1);
});
