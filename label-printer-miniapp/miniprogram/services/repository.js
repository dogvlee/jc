const { clampElement, cloneDocument, createDocument, createElement } = require('../core/document');
const { normalizeElementFont } = require('../core/font-family');
const { RecoverableStorage, storageError } = require('./recoverable-storage');

const STORAGE_VERSION = 2;
const MAX_PROJECTS = 120;
const MAX_USER_TEMPLATES = 80;
const MIN_LABEL_MM = 5;
// The editor may inspect unusually long industrial labels. Hardware support is
// decided separately by printability profiles; storage must not silently crop.
const MAX_LABEL_MM = 500;
const DOCUMENT_LIMITS = Object.freeze({
  maxElements: 128,
  maxTextLength: 512,
  maxShortTextLength: 128,
  maxTableCellLength: 256,
  minFontSizeMm: 0.5,
  maxFontSizeMm: 25,
  minLetterSpacingMm: -20,
  maxLetterSpacingMm: 20,
  minLineSpacing: -5,
  maxLineSpacing: 10,
  maxSerialDigits: 20
});
const TEMPLATE_META_LIMITS = Object.freeze({
  maxDepth: 6,
  maxKeys: 64,
  maxArrayLength: 64,
  maxStringLength: 1024,
  maxNodes: 256
});
const KEYS = Object.freeze({
  version: 'niim-label:storage-version',
  projects: 'niim-label:projects',
  templates: 'niim-label:templates',
  settings: 'niim-label:settings',
  dataRows: 'niim-label:data-rows',
  printHistory: 'niim-label:print-history',
  lastDevice: 'niim-label:last-device',
  editorDraft: 'niim-label:editor-draft',
  editorAutosave: 'niim-label:editor-autosave',
  recoveryJournal: 'niim-label:recovery-journal',
  pendingHomeRoute: 'niim-label:pending-home-route'
});

const LEGACY_KEYS = Object.freeze({
  document: 'label-printer:last-document',
  templates: 'label-printer:templates',
  profile: 'label-printer:profile'
});

const SUPPORTED_TYPES = new Set([
  'text', 'barcode', 'qrcode', 'image', 'rect', 'line',
  'date', 'serial', 'table', 'material'
]);

function defaultSettings() {
  return {
    defaultProfileId: 'd110',
    density: 2,
    threshold: 180,
    labelType: 1,
    stockWidthMm: 40,
    stockHeightMm: 12,
    onboardingDone: false,
    unit: 'mm'
  };
}

function defaultRows() {
  return [
    { id: 'row-a', name: '样品 A', code: '6901234567892', price: '19.90', date: '2026-08-02' },
    { id: 'row-b', name: '样品 B', code: '6901234567885', price: '29.90', date: '2026-08-02' },
    { id: 'row-c', name: '样品 C', code: '6901234567878', price: '39.90', date: '2026-08-02' }
  ];
}

function boundedNumber(value, minimum, maximum, fallback, integer) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  const bounded = Math.max(minimum, Math.min(maximum, number));
  return integer ? Math.round(bounded) : bounded;
}

function boundedPositiveNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.max(minimum, Math.min(maximum, number));
}

function boundedString(value, maximum, fallback) {
  const source = value === undefined || value === null ? fallback : value;
  return String(source === undefined || source === null ? '' : source).slice(0, maximum);
}

function cloneTemplateMetaValue(value, depth, state) {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, TEMPLATE_META_LIMITS.maxStringLength);
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (!value || typeof value !== 'object' || depth >= TEMPLATE_META_LIMITS.maxDepth) return undefined;
  state.nodes += 1;
  if (state.nodes > TEMPLATE_META_LIMITS.maxNodes) return undefined;
  if (Array.isArray(value)) {
    return value.slice(0, TEMPLATE_META_LIMITS.maxArrayLength)
      .map((item) => cloneTemplateMetaValue(item, depth + 1, state))
      .filter((item) => item !== undefined);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const result = {};
  Object.keys(value).slice(0, TEMPLATE_META_LIMITS.maxKeys).forEach((rawKey) => {
    if (rawKey === '__proto__' || rawKey === 'prototype' || rawKey === 'constructor') return;
    const key = String(rawKey).slice(0, 80);
    const cloned = cloneTemplateMetaValue(value[rawKey], depth + 1, state);
    if (cloned !== undefined) result[key] = cloned;
  });
  return result;
}

function normalizeTemplateMeta(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const cloned = cloneTemplateMetaValue(value, 0, { nodes: 0 });
    return cloned && Object.keys(cloned).length ? cloned : null;
  } catch (error) {
    return null;
  }
}

function normalizeElementFields(element, defaults) {
  const hasOwn = (field) => Object.prototype.hasOwnProperty.call(element, field)
    || Object.prototype.hasOwnProperty.call(defaults, field);
  if (hasOwn('fontSize')) {
    element.fontSize = boundedPositiveNumber(
      element.fontSize,
      DOCUMENT_LIMITS.minFontSizeMm,
      DOCUMENT_LIMITS.maxFontSizeMm,
      Number(defaults.fontSize) || 4
    );
  }
  if (hasOwn('letterSpacing')) {
    element.letterSpacing = boundedNumber(
      element.letterSpacing,
      DOCUMENT_LIMITS.minLetterSpacingMm,
      DOCUMENT_LIMITS.maxLetterSpacingMm,
      Number(defaults.letterSpacing) || 0,
      false
    );
  }
  if (hasOwn('lineSpacing')) {
    element.lineSpacing = boundedNumber(
      element.lineSpacing,
      DOCUMENT_LIMITS.minLineSpacing,
      DOCUMENT_LIMITS.maxLineSpacing,
      Number(defaults.lineSpacing) || 0,
      false
    );
  }
  if (hasOwn('digits')) {
    element.digits = boundedNumber(
      element.digits,
      1,
      DOCUMENT_LIMITS.maxSerialDigits,
      Number(defaults.digits) || 1,
      true
    );
  }

  ['text', 'value'].forEach((field) => {
    if (hasOwn(field)) {
      element[field] = boundedString(element[field], DOCUMENT_LIMITS.maxTextLength, defaults[field]);
    }
  });
  ['prefix', 'suffix', 'label', 'fixedValue', 'format', 'fontFamily', 'sourceFontFamily', 'fieldName',
    'baseTime', 'linkedFrom', 'symbol', 'materialId', 'borderStyle'].forEach((field) => {
    if (hasOwn(field)) {
      element[field] = boundedString(element[field], DOCUMENT_LIMITS.maxShortTextLength, defaults[field]);
    }
  });
  if (hasOwn('path')) {
    element.path = boundedString(element.path, 1024, defaults.path);
  }
  return element;
}

function normalizeSettings(value) {
  const defaults = defaultSettings();
  const source = value && typeof value === 'object' ? value : {};
  return {
    defaultProfileId: String(source.defaultProfileId || defaults.defaultProfileId).slice(0, 40),
    density: boundedNumber(source.density, 1, 5, defaults.density, true),
    threshold: boundedNumber(source.threshold, 80, 240, defaults.threshold, true),
    labelType: boundedNumber(source.labelType, 1, 4, defaults.labelType, true),
    stockWidthMm: boundedNumber(source.stockWidthMm, MIN_LABEL_MM, MAX_LABEL_MM, defaults.stockWidthMm, false),
    stockHeightMm: boundedNumber(source.stockHeightMm, MIN_LABEL_MM, MAX_LABEL_MM, defaults.stockHeightMm, false),
    onboardingDone: Boolean(source.onboardingDone),
    unit: 'mm'
  };
}

function normalizeDocument(value) {
  if (!value || typeof value !== 'object') return null;
  const widthMm = Number(value.widthMm);
  const heightMm = Number(value.heightMm);
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)
    || widthMm < MIN_LABEL_MM || heightMm < MIN_LABEL_MM
    || widthMm > MAX_LABEL_MM || heightMm > MAX_LABEL_MM) {
    return null;
  }
  const document = createDocument(widthMm, heightMm);
  document.schemaVersion = 2;
  document.name = String(value.name || '未命名标签').slice(0, 80);
  const templateMeta = normalizeTemplateMeta(value.templateMeta);
  if (templateMeta) document.templateMeta = templateMeta;
  document.elements = [];
  (Array.isArray(value.elements) ? value.elements.slice(0, DOCUMENT_LIMITS.maxElements) : []).forEach((source) => {
    if (!source || !SUPPORTED_TYPES.has(source.type)) return;
    const defaults = createElement(source.type, document);
    const element = normalizeElementFields({ ...defaults, ...cloneDocument(source) }, defaults);
    normalizeElementFont(element);
    element.id = String(source.id || `${source.type}-${Date.now().toString(36)}-${document.elements.length}`);
    if (element.type === 'table') {
      element.rows = Math.max(1, Math.min(20, Number(element.rows) || 1));
      element.columns = Math.max(1, Math.min(12, Number(element.columns) || 1));
      const count = element.rows * element.columns;
      const cells = Array.isArray(element.cells) ? element.cells.slice(0, count) : [];
      while (cells.length < count) cells.push('');
      element.cells = cells.map((item) => boundedString(item, DOCUMENT_LIMITS.maxTableCellLength, ''));
    }
    clampElement(element, document);
    document.elements.push(element);
  });
  return document;
}

function cloneList(value) {
  return cloneDocument(Array.isArray(value) ? value : []);
}

function normalizeStoredList(value, key) {
  if (!Array.isArray(value)) {
    throw storageError('STORAGE_DATA_INVALID', '本地标签列表损坏，已停止操作以保护原数据', null, key);
  }
  const ids = new Set();
  return value.map((item) => {
    const document = normalizeDocument(item && item.document);
    const id = item && item.id !== undefined && item.id !== null ? String(item.id) : '';
    if (!document || !id || ids.has(id)) {
      throw storageError('STORAGE_DATA_INVALID', '本地标签数据损坏，已停止操作以保护原数据', null, key);
    }
    ids.add(id);
    return Object.assign({}, item, { id, document });
  });
}

function uniqueId(prefix, existing) {
  const occupied = new Set(existing.map((item) => String(item.id)));
  const base = `${prefix}-${Date.now().toString(36)}`;
  let id = base;
  let suffix = 0;
  while (occupied.has(id)) id = `${base}-${++suffix}`;
  return id;
}

function requireCapacity(count, maximum, label) {
  if (count > maximum) {
    throw storageError('STORAGE_CAPACITY_REACHED', `${label}最多保存 ${maximum} 个，请先备份并删除不再使用的内容，已有数据未被覆盖`);
  }
}

function normalizeDraft(value, defaultDirty) {
  if (value === null) return null;
  const document = normalizeDocument(value && (value.document || value));
  if (!document) throw storageError('STORAGE_DATA_INVALID', '本地编辑草稿损坏，已停止操作以保护原数据');
  return {
    document,
    projectId: String(value.projectId || ''),
    dirtySinceSave: typeof value.dirtySinceSave === 'boolean' ? value.dirtySinceSave : defaultDirty,
    updatedAt: Number(value.updatedAt) || Date.now()
  };
}

class Repository {
  constructor(api) {
    this.api = api || wx;
    this.storage = new RecoverableStorage(this.api, KEYS.recoveryJournal,
      Object.values(KEYS).filter((key) => key !== KEYS.recoveryJournal));
  }

  read(key, fallback) {
    return cloneDocument(this.storage.read(key, fallback));
  }

  write(key, value) {
    return this.storage.write(key, value);
  }

  remove(key) {
    this.storage.remove(key);
  }

  migrate() {
    const currentVersion = Number(this.read(KEYS.version, 0)) || 0;
    if (currentVersion >= STORAGE_VERSION) return false;

    const existingProjects = normalizeStoredList(this.read(KEYS.projects, []), KEYS.projects);
    const existingTemplates = normalizeStoredList(this.read(KEYS.templates, []), KEYS.templates);
    const settings = normalizeSettings(this.read(KEYS.settings, {}));
    const legacyDocument = normalizeDocument(this.read(LEGACY_KEYS.document, null));
    const legacyTemplates = this.read(LEGACY_KEYS.templates, []);
    const legacyProfile = String(this.read(LEGACY_KEYS.profile, '') || '');

    if (!existingProjects.length && legacyDocument) {
      existingProjects.push({
        id: `migrated-${Date.now().toString(36)}`,
        name: legacyDocument.name,
        document: legacyDocument,
        updatedAt: Date.now()
      });
    }
    if (!existingTemplates.length && Array.isArray(legacyTemplates)) {
      legacyTemplates.forEach((item, index) => {
        const document = normalizeDocument(item && (item.document || item));
        if (!document) return;
        existingTemplates.push({
          id: String(item.id || `migrated-template-${index}`),
          name: String(item.name || document.name || '我的模板'),
          document,
          updatedAt: Date.now() - index
        });
      });
    }
    if (legacyProfile) settings.defaultProfileId = legacyProfile;

    this.storage.transact([
      [KEYS.projects, existingProjects],
      [KEYS.templates, existingTemplates],
      [KEYS.settings, settings],
      [KEYS.version, STORAGE_VERSION]
    ]);
    Object.values(LEGACY_KEYS).forEach((key) => {
      try { this.remove(key); } catch (error) { /* migration is committed; legacy cleanup may retry later */ }
    });
    return true;
  }

  getProjects() {
    return normalizeStoredList(this.read(KEYS.projects, []), KEYS.projects)
      .sort((left, right) => Number(right.updatedAt) - Number(left.updatedAt));
  }

  prepareProjectSave(documentValue, projectId) {
    const document = normalizeDocument(documentValue);
    if (!document) throw new Error('标签数据损坏，无法保存');
    const projects = this.getProjects();
    const id = projectId ? String(projectId) : uniqueId('project', projects);
    const retained = projects.filter((item) => item.id !== id);
    requireCapacity(retained.length + 1, MAX_PROJECTS, '标签');
    const project = {
      id,
      name: document.name,
      document,
      updatedAt: Date.now()
    };
    return { project, projects: [project, ...retained] };
  }

  saveProject(documentValue, projectId) {
    const { project, projects } = this.prepareProjectSave(documentValue, projectId);
    this.write(KEYS.projects, projects);
    return cloneDocument(project);
  }

  saveEditorProject(documentValue, projectId) {
    const { project, projects } = this.prepareProjectSave(documentValue, projectId);
    const autosave = {
      document: project.document,
      projectId: project.id,
      dirtySinceSave: false,
      updatedAt: project.updatedAt
    };
    // A saved project and its session identity must commit together. Otherwise
    // retrying an unnamed draft creates duplicates, or an old dirty autosave
    // can later replace the project that was just saved successfully.
    this.storage.transact([
      [KEYS.projects, projects],
      [KEYS.editorAutosave, autosave],
      [KEYS.editorDraft, null]
    ]);
    return cloneDocument(project);
  }

  saveProjects(documentValues) {
    const values = Array.isArray(documentValues) ? documentValues : [];
    const normalized = values.map((value, index) => {
      const document = normalizeDocument(value);
      if (!document) throw new Error(`第 ${index + 1} 个标签数据损坏，批量保存已取消`);
      return document;
    });
    if (!normalized.length) return [];
    const existing = this.getProjects();
    requireCapacity(existing.length + normalized.length, MAX_PROJECTS, '标签');
    const now = Date.now();
    const projects = [];
    normalized.forEach((document, index) => projects.push({
      id: uniqueId('project', existing.concat(projects)),
      name: document.name,
      document,
      updatedAt: now + normalized.length - index
    }));
    this.write(KEYS.projects, projects.concat(existing));
    return cloneDocument(projects);
  }

  deleteProject(projectId) {
    const projects = this.getProjects().filter((item) => item.id !== projectId);
    this.write(KEYS.projects, projects);
  }

  getUserTemplates() {
    return normalizeStoredList(this.read(KEYS.templates, []), KEYS.templates)
      .sort((left, right) => Number(right.updatedAt) - Number(left.updatedAt));
  }

  saveUserTemplate(documentValue, name, templateId) {
    const document = normalizeDocument(documentValue);
    if (!document) throw new Error('模板数据损坏，无法保存');
    document.name = String(name || document.name || '我的模板').trim().slice(0, 80) || '我的模板';
    const templates = this.getUserTemplates();
    const id = templateId ? String(templateId) : uniqueId('user-template', templates);
    const retained = templates.filter((entry) => entry.id !== id);
    requireCapacity(retained.length + 1, MAX_USER_TEMPLATES, '模板');
    const item = { id, name: document.name, document, updatedAt: Date.now(), source: 'user' };
    this.write(KEYS.templates, [item, ...retained]);
    return cloneDocument(item);
  }

  /**
   * Bulk import for template packs. Never evicts existing templates: imports
   * stop at the capacity limit and the overflow is reported to the caller.
   */
  importUserTemplates(items) {
    const source = Array.isArray(items) ? items : [];
    const existing = this.getUserTemplates();
    const capacity = Math.max(0, MAX_USER_TEMPLATES - existing.length);
    let invalid = 0;
    const valid = [];
    source.forEach((item) => {
      const document = normalizeDocument(item && (item.document || item));
      if (!document) {
        invalid += 1;
        return;
      }
      document.name = String((item && item.name) || document.name || '我的模板').trim().slice(0, 80) || '我的模板';
      valid.push(document);
    });
    const accepted = valid.slice(0, capacity);
    const now = Date.now();
    const created = [];
    accepted.forEach((document, index) => created.push({
      id: uniqueId('user-template', existing.concat(created)),
      name: document.name,
      document,
      updatedAt: now + accepted.length - index,
      source: 'user'
    }));
    if (created.length) {
      this.write(KEYS.templates, created.concat(existing));
    }
    return {
      imported: created.length,
      invalid,
      overflow: valid.length - accepted.length,
      capacity
    };
  }

  deleteUserTemplate(templateId) {
    this.write(KEYS.templates, this.getUserTemplates().filter((item) => item.id !== templateId));
  }

  getSettings() {
    return normalizeSettings(this.read(KEYS.settings, {}));
  }

  saveSettings(patch) {
    const settings = normalizeSettings(Object.assign(this.getSettings(), patch || {}));
    this.write(KEYS.settings, settings);
    return settings;
  }

  getDataRows() {
    return cloneList(this.read(KEYS.dataRows, defaultRows()));
  }

  saveDataRows(rows) {
    return this.write(KEYS.dataRows, cloneList(rows).slice(0, 1000));
  }

  getPrintHistory() {
    return cloneList(this.read(KEYS.printHistory, []));
  }

  recordPrint(entry) {
    const history = [Object.assign({ id: `print-${Date.now().toString(36)}`, at: Date.now() }, entry)];
    history.push(...this.getPrintHistory());
    history.splice(80);
    history.forEach((item, index) => {
      if (index >= 10) delete item.document;
    });
    this.write(KEYS.printHistory, history);
    return cloneDocument(history[0]);
  }

  getLastDevice() {
    const device = this.read(KEYS.lastDevice, null);
    return device && device.deviceId ? device : null;
  }

  saveLastDevice(device) {
    if (!device || !device.deviceId) {
      this.remove(KEYS.lastDevice);
      return null;
    }
    const safe = {
      deviceId: String(device.deviceId),
      name: String(device.name || device.displayName || device.localName || '打印机')
    };
    this.write(KEYS.lastDevice, safe);
    return safe;
  }

  getEditorDraft() {
    const draft = this.read(KEYS.editorDraft, null);
    return normalizeDraft(draft, Boolean(draft && !draft.projectId));
  }

  saveEditorDraft(draft) {
    const normalized = normalizeDraft(draft || {}, !(draft && draft.projectId));
    this.write(KEYS.editorDraft, normalized);
    return normalized;
  }

  clearEditorDraft() {
    this.remove(KEYS.editorDraft);
  }

  getEditorAutosave() {
    return normalizeDraft(this.read(KEYS.editorAutosave, null), true);
  }

  saveEditorAutosave(draft) {
    const normalized = normalizeDraft(draft || {}, true);
    this.write(KEYS.editorAutosave, normalized);
    return normalized;
  }

  clearEditorAutosave() {
    this.remove(KEYS.editorAutosave);
  }

  backup() {
    return {
      schemaVersion: STORAGE_VERSION,
      exportedAt: new Date().toISOString(),
      projects: this.getProjects(),
      templates: this.getUserTemplates(),
      settings: this.getSettings(),
      dataRows: this.getDataRows(),
      printHistory: this.getPrintHistory()
    };
  }

  restore(payload) {
    const incomingVersion = Number(payload && payload.schemaVersion);
    if (!payload || !Number.isFinite(incomingVersion) || incomingVersion < 1) {
      throw new Error('备份文件缺少有效的版本信息');
    }
    if (incomingVersion > STORAGE_VERSION) {
      throw new Error('备份版本过新，请升级小程序后再恢复');
    }
    // Reject incomplete/corrupt backups rather than silently discarding their
    // invalid records and replacing good local collections with the remainder.
    const projects = normalizeStoredList(payload.projects, KEYS.projects);
    const templates = normalizeStoredList(payload.templates, KEYS.templates);
    requireCapacity(projects.length, MAX_PROJECTS, '标签');
    requireCapacity(templates.length, MAX_USER_TEMPLATES, '模板');
    const settings = normalizeSettings(payload.settings || {});
    const dataRows = cloneList(Array.isArray(payload.dataRows) ? payload.dataRows : defaultRows()).slice(0, 1000);
    const printHistory = cloneList(Array.isArray(payload.printHistory) ? payload.printHistory : []).slice(0, 80);
    const changes = [
      [KEYS.projects, projects],
      [KEYS.templates, templates],
      [KEYS.settings, settings],
      [KEYS.dataRows, dataRows],
      [KEYS.printHistory, printHistory],
      [KEYS.version, STORAGE_VERSION]
    ];
    this.storage.transact(changes);
    return {
      projects: projects.length,
      templates: templates.length,
      dataRows: dataRows.length,
      printHistory: printHistory.length
    };
  }
}

module.exports = {
  DOCUMENT_LIMITS,
  KEYS,
  LEGACY_KEYS,
  MAX_PROJECTS,
  MAX_USER_TEMPLATES,
  Repository,
  STORAGE_VERSION,
  defaultRows,
  defaultSettings,
  normalizeSettings,
  normalizeDocument
};
