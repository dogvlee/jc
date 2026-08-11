const { clampElement, cloneDocument, createDocument, createElement } = require('../core/document');

const STORAGE_VERSION = 2;
const MIN_LABEL_MM = 5;
const MAX_LABEL_MM = 150;
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
const KEYS = Object.freeze({
  version: 'niim-label:storage-version',
  projects: 'niim-label:projects',
  templates: 'niim-label:templates',
  settings: 'niim-label:settings',
  dataRows: 'niim-label:data-rows',
  printHistory: 'niim-label:print-history',
  lastDevice: 'niim-label:last-device',
  editorDraft: 'niim-label:editor-draft',
  editorAutosave: 'niim-label:editor-autosave'
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
    stockWidthMm: 50,
    stockHeightMm: 30,
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
  ['prefix', 'suffix', 'label', 'fixedValue', 'format', 'fontFamily', 'fieldName',
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
  document.elements = [];
  (Array.isArray(value.elements) ? value.elements.slice(0, DOCUMENT_LIMITS.maxElements) : []).forEach((source) => {
    if (!source || !SUPPORTED_TYPES.has(source.type)) return;
    const defaults = createElement(source.type, document);
    const element = normalizeElementFields({ ...defaults, ...cloneDocument(source) }, defaults);
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

class Repository {
  constructor(api) {
    this.api = api || wx;
  }

  read(key, fallback) {
    try {
      const value = this.api.getStorageSync(key);
      return value === '' || value === undefined || value === null ? cloneDocument(fallback) : value;
    } catch (error) {
      const wrapped = new Error('本地数据读取失败，为避免覆盖原数据，本次操作已停止');
      wrapped.code = 'STORAGE_READ_FAILED';
      wrapped.key = key;
      wrapped.cause = error;
      throw wrapped;
    }
  }

  write(key, value) {
    try {
      this.api.setStorageSync(key, value);
      return value;
    } catch (error) {
      const wrapped = new Error('本地存储空间不足，请先备份并删除不再使用的标签');
      wrapped.code = 'STORAGE_WRITE_FAILED';
      wrapped.cause = error;
      throw wrapped;
    }
  }

  remove(key) {
    try {
      this.api.removeStorageSync(key);
    } catch (error) {
      // Removing a missing legacy key is harmless.
    }
  }

  migrate() {
    const currentVersion = Number(this.read(KEYS.version, 0)) || 0;
    if (currentVersion >= STORAGE_VERSION) return false;

    const existingProjects = this.read(KEYS.projects, []);
    const existingTemplates = this.read(KEYS.templates, []);
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

    this.write(KEYS.projects, existingProjects.slice(0, 120));
    this.write(KEYS.templates, existingTemplates.slice(0, 80));
    this.write(KEYS.settings, settings);
    this.write(KEYS.version, STORAGE_VERSION);
    Object.values(LEGACY_KEYS).forEach((key) => this.remove(key));
    return true;
  }

  getProjects() {
    return this.read(KEYS.projects, []).map((item) => {
      const document = normalizeDocument(item && item.document);
      return document ? Object.assign({}, item, { document }) : null;
    }).filter(Boolean).sort((left, right) => Number(right.updatedAt) - Number(left.updatedAt));
  }

  saveProject(documentValue, projectId) {
    const document = normalizeDocument(documentValue);
    if (!document) throw new Error('标签数据损坏，无法保存');
    const projects = this.getProjects();
    const id = projectId || `project-${Date.now().toString(36)}`;
    const project = {
      id,
      name: document.name,
      document,
      updatedAt: Date.now()
    };
    this.write(KEYS.projects, [project, ...projects.filter((item) => item.id !== id)].slice(0, 120));
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
    const now = Date.now();
    const projects = normalized.map((document, index) => ({
      id: `project-${now.toString(36)}-${index}`,
      name: document.name,
      document,
      updatedAt: now + normalized.length - index
    }));
    this.write(KEYS.projects, projects.concat(this.getProjects()).slice(0, 120));
    return cloneDocument(projects);
  }

  deleteProject(projectId) {
    const projects = this.getProjects().filter((item) => item.id !== projectId);
    this.write(KEYS.projects, projects);
  }

  getUserTemplates() {
    return this.read(KEYS.templates, []).map((item) => {
      const document = normalizeDocument(item && item.document);
      return document ? Object.assign({}, item, { document }) : null;
    }).filter(Boolean).sort((left, right) => Number(right.updatedAt) - Number(left.updatedAt));
  }

  saveUserTemplate(documentValue, name, templateId) {
    const document = normalizeDocument(documentValue);
    if (!document) throw new Error('模板数据损坏，无法保存');
    document.name = String(name || document.name || '我的模板').trim().slice(0, 80) || '我的模板';
    const templates = this.getUserTemplates();
    const id = templateId || `user-template-${Date.now().toString(36)}`;
    const item = { id, name: document.name, document, updatedAt: Date.now(), source: 'user' };
    this.write(KEYS.templates, [item, ...templates.filter((entry) => entry.id !== id)].slice(0, 80));
    return cloneDocument(item);
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
    const projects = (Array.isArray(payload.projects) ? payload.projects : []).map((item) => {
      const document = normalizeDocument(item && item.document);
      return document ? Object.assign({}, item, { document }) : null;
    }).filter(Boolean).slice(0, 120);
    const templates = (Array.isArray(payload.templates) ? payload.templates : []).map((item) => {
      const document = normalizeDocument(item && item.document);
      return document ? Object.assign({}, item, { document }) : null;
    }).filter(Boolean).slice(0, 80);
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
    const snapshot = changes.map(([key]) => {
      let value;
      try {
        value = this.api.getStorageSync(key);
      } catch (error) {
        const wrapped = new Error('无法读取现有本地数据，恢复操作已取消');
        wrapped.code = 'STORAGE_READ_FAILED';
        wrapped.key = key;
        wrapped.cause = error;
        throw wrapped;
      }
      return { key, existed: value !== '' && value !== undefined && value !== null, value };
    });
    try {
      changes.forEach(([key, value]) => this.write(key, value));
    } catch (error) {
      let rollbackFailed = false;
      snapshot.forEach((item) => {
        try {
          if (item.existed) this.api.setStorageSync(item.key, item.value);
          else this.api.removeStorageSync(item.key);
        } catch (rollbackError) {
          rollbackFailed = true;
        }
      });
      if (rollbackFailed) {
        const critical = new Error('恢复中断且本地回滚失败，请不要继续编辑，并联系支持人员处理备份');
        critical.code = 'RESTORE_ROLLBACK_FAILED';
        critical.cause = error;
        throw critical;
      }
      const restored = new Error('恢复未完成，原有本地数据已保留');
      restored.code = 'RESTORE_FAILED';
      restored.cause = error;
      throw restored;
    }
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
  Repository,
  STORAGE_VERSION,
  defaultRows,
  defaultSettings,
  normalizeSettings,
  normalizeDocument
};
