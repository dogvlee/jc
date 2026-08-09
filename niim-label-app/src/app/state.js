const {
  cloneDocument,
  createDocument
} = require('../core/document');
const { KEYS, read, write } = require('../services/store');
const { templates } = require('./catalog');
const { buildTemplateDocument } = require('./template-layouts');
const { IMPORTED_TEMPLATES } = require('./imported-templates');
const { ONLINE_TEMPLATES } = require('./online-templates-pack');
const ONLINE_SEED = ONLINE_TEMPLATES;

function templateDocument(template) {
  return buildTemplateDocument(template);
}

function projectFromImported(item, index) {
  return {
    id: `project-${item.id}`,
    updatedAt: Date.now() - index * 3600000,
    document: cloneDocument(item.document || templateDocument(item)),
    source: item.source || 'niim-import',
    thumbSrc: item.thumbSrc || '',
    pinned: true
  };
}

function userTemplateFromImported(item, index) {
  const doc = cloneDocument(item.document || templateDocument(item));
  doc.name = item.name;
  return {
    id: item.id,
    name: item.name,
    document: doc,
    createdAt: Date.now() - index * 3600000,
    source: item.source || 'niim-import',
    size: item.size,
    category: item.category,
    industry: item.industry,
    thumbSrc: item.thumbSrc || '',
    kind: item.kind,
    accent: item.accent
  };
}

function projectFromCatalog(template, index) {
  return {
    id: `project-${template.id}`,
    updatedAt: Date.now() - index * 86400000,
    document: templateDocument(template),
    source: template.source === 'niim-import' ? 'niim-import' : 'catalog-seed'
  };
}

function userTemplateFromCatalog(template, index) {
  const doc = cloneDocument(template.document || templateDocument(template));
  doc.name = template.name;
  return {
    id: template.id,
    name: template.name,
    document: doc,
    createdAt: Date.now() - index * 3600000,
    source: template.source || 'catalog',
    size: template.size,
    category: template.category,
    industry: template.industry
  };
}

function seedProjects() {
  // Imported + online pack first, then full catalog (no cap on catalog).
  const imported = IMPORTED_TEMPLATES.map((item, i) => projectFromImported(item, i));
  const online = ONLINE_SEED.map((item, i) => ({
    ...projectFromImported(item, IMPORTED_TEMPLATES.length + i),
    source: 'online-niim'
  }));
  const seededIds = new Set([
    ...IMPORTED_TEMPLATES.map((i) => i.id),
    ...ONLINE_SEED.map((i) => i.id)
  ]);
  const extras = templates
    .filter((t) => !seededIds.has(t.id))
    .map((template, index) => projectFromCatalog(template, imported.length + online.length + index));
  return [...imported, ...online, ...extras];
}

function seedUserTemplates() {
  // Full library: imported + online seed, then every catalog template; dedupe by id.
  const seen = new Set();
  const out = [];
  IMPORTED_TEMPLATES.forEach((item, i) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    out.push(userTemplateFromImported(item, i));
  });
  ONLINE_SEED.forEach((item, i) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    const ut = userTemplateFromImported(item, IMPORTED_TEMPLATES.length + i);
    ut.source = 'online-niim';
    out.push(ut);
  });
  templates.forEach((template) => {
    if (seen.has(template.id)) return;
    seen.add(template.id);
    out.push(userTemplateFromCatalog(template, out.length));
  });
  return out;
}

/**
 * Ensure every catalog/imported template exists as project + userTemplate (idempotent by id).
 * Imported first in order, then rest of catalog. Persists when changed.
 */
function ensureTemplateLibrary(state) {
  let changed = false;
  const existingIds = new Set((state.projects || []).map((p) => p.id));
  const toAdd = [];

  IMPORTED_TEMPLATES.forEach((item, index) => {
    const pid = `project-${item.id}`;
    if (!existingIds.has(pid)) {
      toAdd.push(projectFromImported(item, index));
      existingIds.add(pid);
      changed = true;
    }
  });

  ONLINE_SEED.forEach((item, index) => {
    const pid = `project-${item.id}`;
    if (!existingIds.has(pid)) {
      const p = projectFromImported(item, IMPORTED_TEMPLATES.length + index);
      p.source = 'online-niim';
      toAdd.push(p);
      existingIds.add(pid);
      changed = true;
    }
  });

  templates.forEach((template, index) => {
    const pid = `project-${template.id}`;
    if (!existingIds.has(pid)) {
      toAdd.push(projectFromCatalog(template, IMPORTED_TEMPLATES.length + ONLINE_SEED.length + index));
      existingIds.add(pid);
      changed = true;
    }
  });

  if (toAdd.length) {
    state.projects = [...toAdd, ...(state.projects || [])];
  }

  const uids = new Set((state.userTemplates || []).map((t) => t.id));
  const uAdd = [];
  IMPORTED_TEMPLATES.forEach((item, index) => {
    if (!uids.has(item.id)) {
      uAdd.push(userTemplateFromImported(item, index));
      uids.add(item.id);
      changed = true;
    }
  });
  ONLINE_SEED.forEach((item, index) => {
    if (!uids.has(item.id)) {
      const ut = userTemplateFromImported(item, IMPORTED_TEMPLATES.length + index);
      ut.source = 'online-niim';
      uAdd.push(ut);
      uids.add(item.id);
      changed = true;
    }
  });
  templates.forEach((template) => {
    if (uids.has(template.id)) return;
    uAdd.push(userTemplateFromCatalog(template, uAdd.length));
    uids.add(template.id);
    changed = true;
  });
  if (uAdd.length) {
    state.userTemplates = [...uAdd, ...(state.userTemplates || [])];
  }

  if (changed) {
    try {
      write(KEYS.projects, state.projects);
      write(KEYS.templates, state.userTemplates);
    } catch (_) { /* ignore quota */ }
  }
  return state;
}

/** @deprecated use ensureTemplateLibrary — kept as alias for tests/callers */
const ensureImportedLibrary = ensureTemplateLibrary;

function defaultSettings() {
  return {
    language: '简体中文',
    units: 'mm',
    autosave: true,
    cloudSync: false,
    defaultProfileId: 'd110',
    density: 2,
    threshold: 180,
    copies: 1,
    labelType: 1,
    defaultWidthMm: 50,
    defaultHeightMm: 30,
    installedStock: 'T50×30 203 空白标签',
    batchTemplateId: 'product-simple',
    importedLibraryV1: false,
    importedLibraryV2: false,
    importedLibraryV4: false
  };
}

function readPrintHistory() {
  try {
    return JSON.parse(localStorage.getItem('niim-label:print-history') || '[]');
  } catch (error) {
    return [];
  }
}

function initialState() {
  const projects = read(KEYS.projects, seedProjects());
  const userTemplates = read(KEYS.templates, seedUserTemplates());
  const dataRows = read(KEYS.dataRows, [
    { name: '样品 A', code: '6901234567892', price: '19.90', date: '2026-08-02' },
    { name: '样品 B', code: '6901234567885', price: '29.90', date: '2026-08-02' },
    { name: '样品 C', code: '6901234567878', price: '39.90', date: '2026-08-02' }
  ]);
  const state = {
    route: 'home',
    projects,
    userTemplates,
    settings: Object.assign(defaultSettings(), read(KEYS.settings, {})),
    dataRows,
    templateCategory: '全部',
    templateIndustry: '全部',
    templateQuery: '',
    templatePreviewId: '',
    printHistory: readPrintHistory(),
    document: null,
    projectId: '',
    selectedId: '',
    selectedIds: [],
    multiSelect: false,
    panelCollapsed: false,
    canvasExpanded: false,
    alignmentMenu: false,
    // Editor interaction mode: add | selected | content
    editorMode: 'add',
    editorPanelTab: 'elements',
    editorMenu: false,
    undo: [],
    redo: [],
    images: {},
    zoom: 100,
    device: null,
    devices: [],
    scanning: false,
    connecting: false,
    printing: false,
    printProgress: 0,
    printMessage: '',
    // Why the current label cannot print, and how the last attempt failed.
    printBlock: null,
    printError: null,
    printIntent: false,
    modal: '',
    draftSavedAt: 0,
    // UI drafts for sheets
    stockWidthMm: 50,
    stockHeightMm: 30,
    stockApplyCurrent: true,
    batchSelectedRows: null,
    batchMode: 'open-first',
    manageTemplateId: '',
    editorTplSize: '全部尺寸',
    editorTplIndustry: '全部',
    editorTplQuery: '',
    materialChip: '热门',
    materialQuery: '',
    materialSearchOpen: false,
    borderChip: '最新',
    borderQuery: '',
    borderSearchOpen: false,
    pendingBorderAdd: false
  };

  // Merge full catalog + imported + online library (idempotent). v3 re-merges online pack.
  if (!state.settings.importedLibraryV4) {
    ensureTemplateLibrary(state);
    state.settings.importedLibraryV1 = true;
    state.settings.importedLibraryV2 = true;
    state.settings.importedLibraryV4 = true;
    try {
      persistSettings(state);
    } catch (_) { /* ignore */ }
  } else {
    ensureTemplateLibrary(state);
  }
  return state;
}

function persistProjects(state) {
  write(KEYS.projects, state.projects);
}

function persistSettings(state) {
  write(KEYS.settings, state.settings);
}

function persistRows(state) {
  write(KEYS.dataRows, state.dataRows);
}

function upsertProject(state) {
  if (!state.document) {
    return null;
  }
  const existing = state.projects.find((item) => item.id === state.projectId);
  const project = existing
    ? {
      ...existing,
      document: cloneDocument(state.document),
      updatedAt: Date.now()
    }
    : {
      id: `project-${Date.now().toString(36)}`,
      document: cloneDocument(state.document),
      updatedAt: Date.now()
    };
  const nextProjects = [project, ...state.projects.filter((item) => item.id !== project.id)];
  write(KEYS.projects, nextProjects);
  state.projectId = project.id;
  state.projects = nextProjects;
  state.draftSavedAt = project.updatedAt;
  return project;
}

function openDocument(state, document, projectId) {
  state.document = cloneDocument(document);
  state.projectId = projectId || '';
  const first = state.document.elements[0];
  if (first) {
    state.selectedId = first.id;
    state.selectedIds = [first.id];
    state.editorMode = 'selected';
    // style tab keeps 保存/打印 visible; second-tap opens content
    state.editorPanelTab = (first.type === 'date' || first.type === 'serial') ? 'content' : 'style';
  } else {
    state.selectedId = '';
    state.selectedIds = [];
    state.editorMode = 'add';
    state.editorPanelTab = 'elements';
  }
  state.multiSelect = false;
  state.panelCollapsed = false;
  state.canvasExpanded = false;
  state.alignmentMenu = false;
  state.editorMenu = false;
  state.undo = [];
  state.redo = [];
  state.images = {};
  state.route = 'editor';
}

module.exports = {
  defaultSettings,
  ensureImportedLibrary,
  ensureTemplateLibrary,
  initialState,
  openDocument,
  persistProjects,
  persistRows,
  persistSettings,
  projectFromCatalog,
  projectFromImported,
  readPrintHistory,
  seedProjects,
  seedUserTemplates,
  templateDocument,
  userTemplateFromCatalog,
  userTemplateFromImported,
  upsertProject
};
