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
const { templates } = require("../src/app/catalog");

if (typeof global.localStorage === "undefined") {
  const mem = new Map();
  global.localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); },
    removeItem: (k) => { mem.delete(k); }
  };
}

test("seedProjects length >= 30, full catalog, starts with imported", () => {
  const projects = seedProjects();
  assert.ok(projects.length >= 30, `expected >= 30 projects, got ${projects.length}`);
  assert.ok(projects.length >= templates.length, `expected >= catalog (${templates.length}), got ${projects.length}`);
  for (let i = 0; i < IMPORTED_TEMPLATES.length; i++) {
    assert.equal(projects[i].id, `project-${IMPORTED_TEMPLATES[i].id}`);
    assert.equal(projects[i].source, "niim-import");
    assert.ok(projects[i].document);
    assert.ok(Array.isArray(projects[i].document.elements));
    assert.ok(projects[i].document.elements.length >= 1, projects[i].id + " should have elements");
  }
  const ids = projects.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, "no duplicate project ids");
  for (const p of projects) {
    assert.ok(p.document && Array.isArray(p.document.elements), p.id);
    assert.ok(p.document.elements.length >= 1, p.id + " needs elements");
  }
});

test("seedUserTemplates includes all catalog + imported, deduped", () => {
  const ut = seedUserTemplates();
  assert.ok(ut.length >= 30, `expected >= 30 userTemplates, got ${ut.length}`);
  assert.ok(ut.length >= templates.length);
  assert.equal(new Set(ut.map((t) => t.id)).size, ut.length, "no duplicate userTemplate ids");
  for (let i = 0; i < IMPORTED_TEMPLATES.length; i++) {
    assert.equal(ut[i].id, IMPORTED_TEMPLATES[i].id);
    assert.equal(ut[i].name, IMPORTED_TEMPLATES[i].name);
    assert.equal(ut[i].source, "niim-import");
    assert.ok(ut[i].document.elements.length >= 1);
  }
  for (const t of ut) {
    assert.ok(t.document && t.document.elements && t.document.elements.length >= 1, t.id);
  }
  for (const cat of templates) {
    assert.ok(ut.some((t) => t.id === cat.id), "missing catalog template " + cat.id);
  }
});

test("ensureTemplateLibrary adds missing without duplicating", () => {
  const state = {
    projects: [{ id: "project-old", updatedAt: 1, document: { name: "old", elements: [] } }],
    userTemplates: []
  };
  ensureTemplateLibrary(state);
  assert.ok(state.projects.length >= 1 + templates.length);
  const ids = state.projects.map((p) => p.id);
  assert.equal(ids.filter((id) => id === "project-niim-product-r40x94").length, 1);
  assert.ok(ids.includes("project-niim-product-r40x94"));
  assert.ok(state.userTemplates.length >= templates.length);
  assert.equal(new Set(state.userTemplates.map((t) => t.id)).size, state.userTemplates.length);

  const beforeP = state.projects.length;
  const beforeU = state.userTemplates.length;
  ensureTemplateLibrary(state);
  assert.equal(state.projects.length, beforeP);
  assert.equal(state.userTemplates.length, beforeU);
});

test("ensureImportedLibrary alias works", () => {
  const state = {
    projects: [],
    userTemplates: []
  };
  ensureImportedLibrary(state);
  assert.ok(state.projects.length >= 30);
  assert.ok(state.userTemplates.length >= 30);
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