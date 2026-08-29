const test = require("node:test");
const assert = require("node:assert/strict");
const {
  seedProjects,
  seedUserTemplates,
  ensureImportedLibrary,
  ensureTemplateLibrary,
  projectFromImported,
  userTemplateFromImported
} = require("../src/app/state");
const { IMPORTED_TEMPLATES } = require("../src/app/imported-templates");

if (typeof global.localStorage === "undefined") {
  const mem = new Map();
  global.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); },
    removeItem: (k) => { mem.delete(k); }
  };
}

test("seedProjects starts with no fake editing history", () => {
  assert.deepEqual(seedProjects(), []);
});

test("seedUserTemplates starts with no bundled catalog copies", () => {
  assert.deepEqual(seedUserTemplates(), []);
});

test("ensureTemplateLibrary preserves explicit user data without adding catalog records", () => {
  const state = {
    projects: [{ id: "project-old", updatedAt: 1, document: { name: "old", elements: [] } }],
    userTemplates: [{ id: "custom-template", name: "自建模板", document: { elements: [] } }]
  };
  const before = JSON.stringify(state);
  ensureTemplateLibrary(state);
  assert.equal(JSON.stringify(state), before);
});

test("ensureImportedLibrary compatibility alias does not seed content", () => {
  const state = {
    projects: [],
    userTemplates: []
  };
  ensureImportedLibrary(state);
  assert.deepEqual(state.projects, []);
  assert.deepEqual(state.userTemplates, []);
});

test("projectFromImported / userTemplateFromImported shape", () => {
  const item = IMPORTED_TEMPLATES[0];
  const p = projectFromImported(item, 0);
  assert.equal(p.id, `project-${item.id}`);
  assert.equal(p.pinned, true);
  assert.ok(p.document.elements.length >= 1);
  const u = userTemplateFromImported(item, 0);
  assert.equal(u.id, item.id);
  assert.equal(u.document.name, item.name);
});
