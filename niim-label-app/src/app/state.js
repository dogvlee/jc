const {
  cloneDocument,
  createDocument
} = require('../core/document');
const { KEYS, read, write } = require('../services/store');
const { buildTemplateDocument } = require('./template-layouts');
const { DEFAULT_MATERIAL_CHIP } = require('../core/materials');
const { normalizeElementFont } = require('../core/font-family');

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
  // Projects are user work, not a second copy of the bundled template catalog.
  return [];
}

function seedUserTemplates() {
  // "My templates" starts empty and only contains explicit user saves/imports.
  return [];
}

/** Normalize the two user-owned collections without copying the catalog into them. */
function ensureTemplateLibrary(state) {
  // Kept as a compatibility hook for older callers. Bundled templates live in
  // catalog.js and must never be materialized as fake projects/user templates.
  state.projects = Array.isArray(state.projects) ? state.projects : [];
  state.userTemplates = Array.isArray(state.userTemplates) ? state.userTemplates : [];
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
    // 40×12 is the largest starter stock that fits every currently verified
    // D11/D110/B1/B21 profile without asking a new user to fix a blocker first.
    defaultWidthMm: 40,
    defaultHeightMm: 12,
    installedStock: 'T40×12 203 空白标签',
    stockDefaultsVersion: 2,
    batchTemplateId: 'product-simple',
    importedLibraryV1: false,
    importedLibraryV2: false,
    importedLibraryV4: false,
    onboardingDone: false,
    lastDeviceId: '',
    lastDeviceName: ''
  };
}

function readPrintHistory() {
  try {
    return JSON.parse(localStorage.getItem('niim-label:print-history') || '[]');
  } catch (error) {
    return [];
  }
}

/**
 * Home "最近打印" strip: successful prints only, newest first, one per
 * project (or per history entry when the label was never saved), max 8.
 * Each entry carries the fields views.js renders for reprint cards.
 */
function buildRecentPrints(history) {
  const entries = Array.isArray(history) ? history : [];
  const byKey = new Map();
  entries.forEach((item) => {
    if (!item || item.result !== 'success') return;
    const key = item.projectId || item.id || 'print-unknown';
    if (byKey.has(key)) return;
    byKey.set(key, item);
  });
  return Array.from(byKey.values()).slice(0, 8).map((item) => {
    const documentValue = item.document || {};
    const elements = documentValue.elements || [];
    let kind = 'accent';
    if (elements.some((element) => element && element.type === 'qrcode')) kind = 'qr';
    else if (elements.some((element) => element && element.type === 'barcode')) kind = 'barcode';
    const widthMm = Number(item.widthMm) || Number(documentValue.widthMm) || 40;
    const heightMm = Number(item.heightMm) || Number(documentValue.heightMm) || 30;
    return {
      name: item.name || documentValue.name || '未命名标签',
      projectId: item.projectId || '',
      id: item.id || '',
      kind,
      widthMm,
      heightMm,
      sizeText: `${widthMm}×${heightMm} mm`
    };
  });
}

function initialState() {
  const projects = read(KEYS.projects, seedProjects());
  const userTemplates = read(KEYS.templates, seedUserTemplates());
  const storedSettings = read(KEYS.settings, {});
  const settings = Object.assign(defaultSettings(), storedSettings);
  // v1 accidentally made 50×30 the starter stock although it fits none of
  // the verified D11/D110/B1/B21 printheads. Migrate only that exact legacy
  // default; all genuine custom sizes remain untouched.
  const legacyStarterStock = storedSettings.stockDefaultsVersion == null
    && Number(storedSettings.defaultWidthMm) === 50
    && Number(storedSettings.defaultHeightMm) === 30
    && (!storedSettings.installedStock || /^T50×30\s+(?:203|230)\b/.test(storedSettings.installedStock));
  if (legacyStarterStock) {
    settings.defaultWidthMm = 40;
    settings.defaultHeightMm = 12;
    settings.installedStock = 'T40×12 203 空白标签';
    settings.stockDefaultsVersion = 2;
    write(KEYS.settings, settings);
  }
  const dataRows = read(KEYS.dataRows, [
    { name: '样品 A', code: '6901234567892', price: '19.90', date: '2026-08-02' },
    { name: '样品 B', code: '6901234567885', price: '29.90', date: '2026-08-02' },
    { name: '样品 C', code: '6901234567878', price: '39.90', date: '2026-08-02' }
  ]);
  const state = {
    route: 'home',
    projects,
    userTemplates,
    settings,
    dataRows,
    templateCategory: '全部',
    templateFolder: '全部',
    templateIndustry: '全部',
    templateScene: '全部',
    templateTask: '全部',
    templateSize: '全部尺寸',
    libraryScene: '全部',
    librarySize: '全部',
    templateQuery: '',
    templateVisibleCount: 24,
    // Authorized public catalog pages are session-only. The bundled starter
    // library remains the offline fallback and these records are never copied
    // into projects/userTemplates automatically.
    remoteTemplates: [],
    remoteTemplatePage: 0,
    remoteTemplateTotal: 0,
    remoteTemplateHasMore: false,
    remoteTemplateLoading: false,
    remoteTemplateError: '',
    remoteMaterials: [],
    remoteMaterialPage: 0,
    remoteMaterialTotal: 0,
    remoteMaterialHasMore: false,
    remoteMaterialLoading: false,
    remoteMaterialError: '',
    remoteBorders: [],
    remoteBorderPage: 0,
    remoteBorderTotal: 0,
    remoteBorderHasMore: false,
    remoteBorderLoading: false,
    remoteBorderError: '',
    projectQuery: '',
    projectVisibleCount: 24,
    templatePreviewId: '',
    printHistory: readPrintHistory(),
    recentPrints: buildRecentPrints(readPrintHistory()),
    onboardingStep: 1,
    document: null,
    projectId: '',
    editorReturnRoute: 'home',
    editorReturnScrollY: 0,
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
    textDirectionOpen: false,
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
    blankDraftBaseline: '',
    // UI drafts for sheets
    stockWidthMm: 40,
    stockHeightMm: 12,
    stockApplyCurrent: true,
    stockLabelType: null,
    stockRotationTurns: 0,
    batchSelectedRows: null,
    batchMode: 'open-first',
    pendingBatchDocuments: [],
    pendingBatchIndex: 0,
    manageTemplateId: '',
    saveTemplateName: '',
    saveTemplateFolder: '未分类',
    saveTemplateExitAfterSave: false,
    scanTargetId: '',
    scanCreateType: 'barcode',
    scanStatus: 'idle',
    scanError: '',
    scanManualValue: '',
    scanDetectedFormat: '',
    advancedQrType: 'wifi',
    advancedQrDraft: {},
    advancedQrErrors: {},
    advancedQrEditId: '',
    editorBaselineDocument: null,
    editorBaselineProject: null,
    editorBaselineProjectId: '',
    documentNameDraft: '',
    documentNameExitAfterSave: false,
    backupStrategy: 'merge',
    backupStatus: '',
    editorTplSize: '全部尺寸',
    editorTplIndustry: '全部',
    editorTplQuery: '',
    editorDataRowIndex: -1,
    dataReturnToEditor: false,
    materialChip: DEFAULT_MATERIAL_CHIP,
    materialQuery: '',
    materialSearchOpen: false,
    borderChip: '最新',
    borderQuery: '',
    borderSearchOpen: false,
    pendingBorderAdd: false
  };

  // Legacy migration flag is retained, but the catalog is no longer copied into
  // projects or "My templates". Existing user data is preserved as-is.
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
  (state.document.elements || []).forEach(normalizeElementFont);
  state.projectId = projectId || '';
  const sourceProject = state.projectId
    ? state.projects.find((item) => item.id === state.projectId)
    : null;
  // A fresh label is not saved merely because the previous document was.
  state.draftSavedAt = sourceProject ? Number(sourceProject.updatedAt) || 0 : 0;
  state.blankDraftBaseline = '';
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

function shouldPersistDraft(document, projectId, blankDraftBaseline) {
  if (!document) return false;
  if (projectId || !blankDraftBaseline) return true;
  return JSON.stringify(document) !== blankDraftBaseline;
}

module.exports = {
  buildRecentPrints,
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
  shouldPersistDraft,
  templateDocument,
  userTemplateFromCatalog,
  userTemplateFromImported,
  upsertProject
};
