const test = require('node:test');
const assert = require('node:assert/strict');

const { createDocument, createElement } = require('../miniprogram/core/document');
const { getTemplate } = require('../miniprogram/app/catalog');
const { buildTemplateDocument } = require('../miniprogram/app/template-layouts');
const { fitText } = require('../miniprogram/core/renderer');
const { evaluatePrintability, getProfile } = require('../miniprogram/core/profiles');
const {
  DOCUMENT_LIMITS,
  KEYS,
  LEGACY_KEYS,
  MAX_PROJECTS,
  MAX_USER_TEMPLATES,
  Repository,
  STORAGE_VERSION,
  defaultSettings,
  normalizeSettings,
  normalizeDocument
} = require('../miniprogram/services/repository');

function storage(initial) {
  const values = new Map(Object.entries(initial || {}));
  return {
    values,
    getStorageSync(key) { return values.has(key) ? values.get(key) : ''; },
    setStorageSync(key, value) { values.set(key, JSON.parse(JSON.stringify(value))); },
    removeStorageSync(key) { values.delete(key); }
  };
}

test('normalizeDocument fills new element defaults and rejects broken dimensions', () => {
  assert.equal(normalizeDocument({ widthMm: 0, heightMm: 30 }), null);
  assert.equal(normalizeDocument({ widthMm: 501, heightMm: 30 }), null);
  // Long industrial labels are storable; printability is checked per profile.
  assert.equal(normalizeDocument({ widthMm: 500, heightMm: 30, elements: [] }).widthMm, 500);
  const document = normalizeDocument({
    schemaVersion: 1,
    name: '旧标签',
    widthMm: 40,
    heightMm: 30,
    elements: [{ id: 't1', type: 'text', x: 2, y: 2, width: 20, height: 5, text: '内容' }]
  });
  assert.equal(document.schemaVersion, 2);
  assert.equal(document.elements[0].text, '内容');
  assert.equal(document.elements[0].verticalAlign, 'middle');
  assert.equal(document.elements[0].mirrorX, false);
});

test('template provenance survives normalize, user-template open, and project save chains', () => {
  const source = buildTemplateDocument(getTemplate('shangyue-wish-card'));
  const normalized = normalizeDocument(source);
  assert.notEqual(normalized.templateMeta, source.templateMeta);
  assert.equal(normalized.templateMeta.origin, 'shangyue-original');
  assert.equal(normalized.templateMeta.source, 'shangyue-original');
  assert.equal(normalized.templateMeta.approvedOriginal, true);
  assert.equal(normalized.templateMeta.batchCompatible, false);

  source.templateMeta.origin = 'mutated-after-normalize';
  assert.equal(normalized.templateMeta.origin, 'shangyue-original');

  const repository = new Repository(storage({ [KEYS.version]: STORAGE_VERSION }));
  const savedTemplate = repository.saveUserTemplate(normalized, '心意卡副本');
  const openedTemplate = repository.getUserTemplates().find((item) => item.id === savedTemplate.id);
  assert.equal(openedTemplate.document.templateMeta.origin, 'shangyue-original');
  assert.equal(openedTemplate.document.templateMeta.batchCompatible, false);

  const savedProject = repository.saveProject(openedTemplate.document);
  const openedProject = repository.getProjects().find((item) => item.id === savedProject.id);
  assert.equal(openedProject.document.templateMeta.authorship, 'shangyue-clean-room');
  assert.equal(openedProject.document.templateMeta.copyright, '© 2026 商跃');
  assert.equal(openedProject.document.templateMeta.batchCompatible, false);
});

test('template metadata cloning bounds strings and drops unsafe or non-JSON values', () => {
  const metadata = JSON.parse('{"origin":"user-import","__proto__":{"polluted":true},"constructor":"blocked"}');
  metadata.note = 'x'.repeat(1500);
  metadata.nonFinite = Infinity;
  metadata.callback = () => 'no';
  const document = normalizeDocument({
    widthMm: 40,
    heightMm: 30,
    elements: [],
    templateMeta: metadata
  });
  assert.equal(document.templateMeta.origin, 'user-import');
  assert.equal(document.templateMeta.note.length, 1024);
  assert.equal(Object.prototype.hasOwnProperty.call(document.templateMeta, '__proto__'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(document.templateMeta, 'constructor'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(document.templateMeta, 'nonFinite'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(document.templateMeta, 'callback'), false);
  assert.equal({}.polluted, undefined);
});

test('normalizeDocument bounds hostile renderer values and text payloads', () => {
  const oversized = '文'.repeat(DOCUMENT_LIMITS.maxTextLength + 50);
  const oversizedCell = '格'.repeat(DOCUMENT_LIMITS.maxTableCellLength + 50);
  const document = normalizeDocument({
    widthMm: 40,
    heightMm: 30,
    elements: [
      {
        id: 'huge-text',
        type: 'text',
        x: 1,
        y: 1,
        width: 20,
        height: 8,
        text: oversized,
        fontSize: 1e308,
        letterSpacing: 1e308,
        lineSpacing: -1e308,
        autoFit: true
      },
      {
        id: 'non-finite-text',
        type: 'text',
        x: 1,
        y: 10,
        width: 20,
        height: 8,
        text: 'fallback',
        fontSize: Infinity,
        letterSpacing: NaN,
        lineSpacing: Infinity
      },
      {
        id: 'huge-serial',
        type: 'serial',
        x: 22,
        y: 1,
        width: 15,
        height: 6,
        digits: 1e308,
        prefix: oversized
      },
      {
        id: 'huge-table',
        type: 'table',
        x: 1,
        y: 19,
        width: 30,
        height: 10,
        rows: 1,
        columns: 1,
        cells: [oversizedCell]
      }
    ]
  });

  const [hugeText, nonFiniteText, serial, table] = document.elements;
  assert.equal(hugeText.fontSize, DOCUMENT_LIMITS.maxFontSizeMm);
  assert.equal(hugeText.letterSpacing, DOCUMENT_LIMITS.maxLetterSpacingMm);
  assert.equal(hugeText.lineSpacing, DOCUMENT_LIMITS.minLineSpacing);
  assert.equal(hugeText.text.length, DOCUMENT_LIMITS.maxTextLength);
  assert.equal(nonFiniteText.fontSize, 4);
  assert.equal(nonFiniteText.letterSpacing, 0);
  assert.equal(nonFiniteText.lineSpacing, 0);
  assert.equal(serial.digits, DOCUMENT_LIMITS.maxSerialDigits);
  assert.equal(serial.prefix.length, DOCUMENT_LIMITS.maxShortTextLength);
  assert.equal(table.cells[0].length, DOCUMENT_LIMITS.maxTableCellLength);

  const context = {
    font: '10px sans-serif',
    measureText(value) {
      const match = /([\d.]+)px/.exec(this.font);
      const pixels = match ? Number(match[1]) : 10;
      return { width: String(value).length * pixels * 0.6 };
    }
  };
  const layout = fitText(context, hugeText, 160, 64, 203);
  assert.ok(Number.isFinite(layout.fontPixels));
  assert.ok(layout.fontPixels >= 1);
});

test('normalizeDocument caps the number of elements retained from a backup', () => {
  const elements = Array.from({ length: DOCUMENT_LIMITS.maxElements + 20 }, (item, index) => ({
    id: `text-${index}`,
    type: 'text',
    x: index % 10,
    y: index % 10,
    width: 5,
    height: 3,
    text: String(index)
  }));
  const document = normalizeDocument({ widthMm: 40, heightMm: 30, elements });
  assert.equal(document.elements.length, DOCUMENT_LIMITS.maxElements);
  assert.equal(document.elements.at(-1).id, `text-${DOCUMENT_LIMITS.maxElements - 1}`);
});

test('settings normalization bounds imported and legacy values', () => {
  assert.deepEqual(normalizeSettings({
    defaultProfileId: '', density: 99, threshold: -1, labelType: 8,
    stockWidthMm: 600, stockHeightMm: 0, onboardingDone: 1, unit: 'inch'
  }), {
    defaultProfileId: 'd110',
    density: 5,
    threshold: 80,
    labelType: 4,
    stockWidthMm: 500,
    stockHeightMm: 5,
    onboardingDone: true,
    unit: 'mm'
  });
});

test('legacy editor storage migrates once without seeding the full system catalog', () => {
  const legacy = createDocument(40, 30);
  legacy.name = '迁移标签';
  const api = storage({
    [LEGACY_KEYS.document]: legacy,
    [LEGACY_KEYS.templates]: [{ id: 1, name: '旧模板', document: legacy }],
    [LEGACY_KEYS.profile]: 'b1'
  });
  const repository = new Repository(api);
  assert.equal(repository.migrate(), true);
  assert.equal(repository.migrate(), false);
  assert.equal(api.values.get(KEYS.version), STORAGE_VERSION);
  assert.equal(repository.getProjects().length, 1);
  assert.equal(repository.getUserTemplates().length, 1);
  assert.equal(repository.getSettings().defaultProfileId, 'b1');
  assert.equal(api.values.has(LEGACY_KEYS.document), false);
});

test('projects, templates and print history are bounded and cloned', () => {
  const repository = new Repository(storage({ [KEYS.version]: STORAGE_VERSION }));
  const document = createDocument(50, 30);
  document.name = '库存标签';
  document.elements.push(createElement('serial', document));
  const project = repository.saveProject(document);
  const template = repository.saveUserTemplate(document, '库存模板');
  document.name = '外部修改';
  assert.equal(repository.getProjects()[0].name, '库存标签');
  assert.equal(repository.getUserTemplates()[0].id, template.id);
  for (let index = 0; index < 85; index += 1) {
    repository.recordPrint({ result: 'success', projectId: project.id, document: project.document });
  }
  const history = repository.getPrintHistory();
  assert.equal(history.length, 80);
  assert.ok(history[9].document);
  assert.equal(history[10].document, undefined);
});

test('template pack import respects capacity, skips invalid items and keeps provenance', () => {
  const repository = new Repository(storage({ [KEYS.version]: STORAGE_VERSION }));
  for (let index = 0; index < 78; index += 1) {
    repository.saveUserTemplate(createDocument(40, 30), `既有模板 ${index}`, `seed-${index}`);
  }
  const redesign = createDocument(53, 27.5);
  redesign.templateMeta = {
    origin: 'shangyue-authorized-redesign-review',
    sourceProvider: 'operator-collection',
    approvalStatus: 'internal-review'
  };
  const result = repository.importUserTemplates([
    { name: '重设计 A', document: redesign },
    { name: '重设计 B', document: createDocument(40, 30) },
    { name: '溢出模板', document: createDocument(40, 30) },
    { name: '坏数据', document: { widthMm: 0, heightMm: 30 } }
  ]);
  assert.equal(result.imported, 2);
  assert.equal(result.overflow, 1);
  assert.equal(result.invalid, 1);
  const templates = repository.getUserTemplates();
  assert.equal(templates.length, 80);
  assert.ok(templates.some((item) => item.name === '既有模板 0'), '批量导入不得挤掉既有模板');
  const imported = templates.find((item) => item.name === '重设计 A');
  assert.equal(imported.document.templateMeta.origin, 'shangyue-authorized-redesign-review');
  assert.equal(imported.document.templateMeta.approvalStatus, 'internal-review');
});

test('batch project save validates everything and commits with one storage write', () => {
  const api = storage({ [KEYS.version]: STORAGE_VERSION });
  let projectWrites = 0;
  const originalSet = api.setStorageSync.bind(api);
  api.setStorageSync = (key, value) => {
    if (key === KEYS.projects) projectWrites += 1;
    originalSet(key, value);
  };
  const repository = new Repository(api);
  const first = createDocument(40, 20);
  first.name = '批量一';
  const second = createDocument(40, 20);
  second.name = '批量二';
  const created = repository.saveProjects([first, second]);
  assert.equal(created.length, 2);
  assert.equal(projectWrites, 1);
  assert.deepEqual(repository.getProjects().map((item) => item.name), ['批量一', '批量二']);
  assert.throws(() => repository.saveProjects([first, { widthMm: 0, heightMm: 20 }]), /第 2 个/);
  assert.equal(projectWrites, 1, 'an invalid batch must not perform a partial write');
});

test('backup and restore preserve editable documents', () => {
  const first = new Repository(storage({ [KEYS.version]: STORAGE_VERSION }));
  const document = createDocument(40, 20);
  document.name = '备份标签';
  first.saveProject(document);
  first.saveSettings({ density: 3 });
  const payload = first.backup();

  const second = new Repository(storage());
  second.restore(payload);
  assert.equal(second.getProjects()[0].document.name, '备份标签');
  assert.equal(second.getSettings().density, 3);
  assert.throws(() => second.restore({ schemaVersion: 99 }), /版本过新/);
  assert.throws(() => second.restore({ projects: [] }), /版本信息/);
});

test('restore rolls back all keys when a storage write fails midway', () => {
  const originalApi = storage({ [KEYS.version]: STORAGE_VERSION });
  const original = new Repository(originalApi);
  const originalDocument = createDocument(30, 20);
  originalDocument.name = '原有标签';
  original.saveProject(originalDocument);

  const source = new Repository(storage({ [KEYS.version]: STORAGE_VERSION }));
  const incomingDocument = createDocument(50, 30);
  incomingDocument.name = '备份标签';
  source.saveProject(incomingDocument);
  const payload = source.backup();

  const originalSet = originalApi.setStorageSync.bind(originalApi);
  let failed = false;
  originalApi.setStorageSync = (key, value) => {
    if (!failed && key === KEYS.templates) {
      failed = true;
      throw new Error('quota');
    }
    originalSet(key, value);
  };

  assert.throws(() => original.restore(payload), /原有本地数据已保留/);
  assert.equal(original.getProjects()[0].name, '原有标签');
});

test('a storage read failure aborts save instead of overwriting existing projects', () => {
  const existing = createDocument(30, 20);
  existing.name = '不可丢的旧项目';
  const api = storage({
    [KEYS.version]: STORAGE_VERSION,
    [KEYS.projects]: [{ id: 'old', name: existing.name, document: existing, updatedAt: 1 }]
  });
  const originalGet = api.getStorageSync.bind(api);
  let failOnce = true;
  api.getStorageSync = (key) => {
    if (key === KEYS.projects && failOnce) {
      failOnce = false;
      throw new Error('temporary read failure');
    }
    return originalGet(key);
  };
  const repository = new Repository(api);
  const incoming = createDocument(40, 20);
  incoming.name = '新项目';

  assert.throws(() => repository.saveProject(incoming), (error) => error.code === 'STORAGE_READ_FAILED');
  assert.equal(api.values.get(KEYS.projects)[0].name, '不可丢的旧项目');
});

test('restore aborts before its first write when the rollback snapshot cannot be read', () => {
  const api = storage({ [KEYS.version]: STORAGE_VERSION, [KEYS.projects]: [] });
  const originalGet = api.getStorageSync.bind(api);
  api.getStorageSync = (key) => {
    if (key === KEYS.templates) throw new Error('read failed');
    return originalGet(key);
  };
  let writes = 0;
  const originalSet = api.setStorageSync.bind(api);
  api.setStorageSync = (key, value) => { writes += 1; originalSet(key, value); };
  const repository = new Repository(api);
  assert.throws(
    () => repository.restore({ schemaVersion: STORAGE_VERSION, projects: [], templates: [] }),
    (error) => error.code === 'STORAGE_READ_FAILED'
  );
  assert.equal(writes, 0);
});

test('first launch creates stock dimensions supported by the default printer', () => {
  const settings = defaultSettings();
  const profile = getProfile(settings.defaultProfileId);
  assert.deepEqual([settings.stockWidthMm, settings.stockHeightMm], profile.defaultSize);
  assert.equal(evaluatePrintability(createDocument(settings.stockWidthMm, settings.stockHeightMm), profile).ok, true);
  const repository = new Repository(storage({
    [KEYS.settings]: { stockWidthMm: 50, stockHeightMm: 30 }
  }));
  assert.equal(repository.getSettings().stockWidthMm, 50, 'an existing user choice is preserved');
});

function storedDocuments(count, prefix) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index}`,
    name: `原有标签 ${index}`,
    document: { ...createDocument(40, 12), name: `原有标签 ${index}` },
    updatedAt: index
  }));
}

test('capacity limits never evict saved projects or templates, and existing records remain editable', () => {
  const api = storage({
    [KEYS.projects]: storedDocuments(MAX_PROJECTS, 'project'),
    [KEYS.templates]: storedDocuments(MAX_USER_TEMPLATES, 'template')
  });
  const repository = new Repository(api);
  const beforeProjects = JSON.stringify(api.values.get(KEYS.projects));
  const beforeTemplates = JSON.stringify(api.values.get(KEYS.templates));
  const document = createDocument(40, 12);
  assert.throws(() => repository.saveProject(document), { code: 'STORAGE_CAPACITY_REACHED' });
  assert.throws(() => repository.saveProjects([document]), { code: 'STORAGE_CAPACITY_REACHED' });
  assert.throws(() => repository.saveUserTemplate(document, '新模板'), { code: 'STORAGE_CAPACITY_REACHED' });
  assert.equal(JSON.stringify(api.values.get(KEYS.projects)), beforeProjects);
  assert.equal(JSON.stringify(api.values.get(KEYS.templates)), beforeTemplates);
  document.name = '原位更新';
  repository.saveProject(document, 'project-0');
  repository.saveUserTemplate(document, '原位更新', 'template-0');
  assert.equal(repository.getProjects().length, MAX_PROJECTS);
  assert.equal(repository.getUserTemplates().length, MAX_USER_TEMPLATES);
  assert.equal(repository.getProjects().find((item) => item.id === 'project-0').name, '原位更新');
});

test('single and batch creations within one millisecond retain distinct IDs', (context) => {
  context.mock.method(Date, 'now', () => 123456789);
  const repository = new Repository(storage());
  const document = createDocument(40, 12);
  repository.saveProject(document);
  repository.saveProject(document);
  repository.saveProjects([document, document]);
  repository.saveProjects([document, document]);
  const projects = repository.getProjects();
  assert.equal(projects.length, 6);
  assert.equal(new Set(projects.map((item) => item.id)).size, 6);
  repository.saveUserTemplate(document, '模板一');
  repository.saveUserTemplate(document, '模板二');
  repository.importUserTemplates([document, document]);
  repository.importUserTemplates([document, document]);
  const templates = repository.getUserTemplates();
  assert.equal(templates.length, 6);
  assert.equal(new Set(templates.map((item) => item.id)).size, 6);
});

test('corrupt collections cannot be silently pruned by a later save', () => {
  const original = storedDocuments(1, 'project');
  original.push({ id: 'broken', document: { widthMm: 0, heightMm: 12 } });
  const api = storage({ [KEYS.projects]: original });
  const before = JSON.stringify(original);
  const repository = new Repository(api);
  assert.throws(() => repository.saveProject(createDocument(40, 12)), { code: 'STORAGE_DATA_INVALID' });
  assert.equal(JSON.stringify(api.values.get(KEYS.projects)), before);
  api.values.set(KEYS.templates, { invalid: 'collection' });
  assert.throws(() => repository.saveUserTemplate(createDocument(40, 12)), { code: 'STORAGE_DATA_INVALID' });
});

test('incomplete, corrupt and overflowing backups leave all local data intact', () => {
  const api = storage({ [KEYS.projects]: storedDocuments(1, 'local') });
  const repository = new Repository(api);
  const before = JSON.stringify(Array.from(api.values));
  const invalidBackups = [
    { schemaVersion: 2 },
    { schemaVersion: 2, projects: [{ id: 'bad', document: {} }], templates: [] },
    { schemaVersion: 2, projects: storedDocuments(MAX_PROJECTS + 1, 'large'), templates: [] }
  ];
  invalidBackups.forEach((payload) => {
    assert.throws(() => repository.restore(payload));
    assert.equal(JSON.stringify(Array.from(api.values)), before);
  });
});

test('a pending transaction from a killed process rolls back before reads or writes', () => {
  const originals = storedDocuments(1, 'original');
  const api = storage({
    [KEYS.projects]: storedDocuments(2, 'partially-restored'),
    [KEYS.templates]: storedDocuments(1, 'new-template'),
    [KEYS.recoveryJournal]: {
      version: 1,
      status: 'pending',
      entries: [
        { key: KEYS.projects, existed: true, value: originals },
        { key: KEYS.templates, existed: false }
      ]
    }
  });
  const repository = new Repository(api);
  assert.equal(repository.getProjects()[0].id, 'original-0');
  assert.equal(repository.getProjects().length, 1);
  assert.equal(api.values.has(KEYS.templates), false);
  assert.equal(api.values.has(KEYS.recoveryJournal), false);
  repository.saveProject(createDocument(40, 12));
  assert.equal(repository.getProjects().length, 2);
});

test('a committed transaction surviving cleanup never reverts successfully restored data', () => {
  const api = storage({
    [KEYS.projects]: storedDocuments(1, 'committed'),
    [KEYS.recoveryJournal]: {
      version: 1,
      status: 'committed',
      entries: [{ key: KEYS.projects, existed: true, value: storedDocuments(1, 'old') }]
    }
  });
  const repository = new Repository(api);
  assert.equal(repository.getProjects()[0].id, 'committed-0');
  assert.equal(api.values.has(KEYS.recoveryJournal), false);
});

test('a rollback write failure retains its journal and a fresh repository recovers on retry', () => {
  const api = storage({
    [KEYS.projects]: storedDocuments(1, 'original'),
    [KEYS.templates]: []
  });
  const originalSet = api.setStorageSync.bind(api);
  let projectWrites = 0;
  api.setStorageSync = (key, value) => {
    if (key === KEYS.projects) {
      projectWrites += 1;
      if (projectWrites >= 2) throw new Error('rollback quota');
    }
    if (key === KEYS.templates) throw new Error('restore quota');
    originalSet(key, value);
  };
  const repository = new Repository(api);
  assert.throws(() => repository.restore({
    schemaVersion: 2, projects: storedDocuments(1, 'incoming'), templates: []
  }), { code: 'RESTORE_ROLLBACK_FAILED' });
  assert.ok(api.values.has(KEYS.recoveryJournal));
  assert.throws(() => repository.getProjects(), { code: 'STORAGE_RECOVERY_FAILED' });
  assert.throws(() => repository.saveSettings({ density: 5 }), { code: 'STORAGE_RECOVERY_FAILED' });
  api.setStorageSync = originalSet;
  const restarted = new Repository(api);
  assert.equal(restarted.getProjects()[0].id, 'original-0');
  assert.equal(api.values.has(KEYS.recoveryJournal), false);
});

test('failure to persist the recovery journal changes no original keys', () => {
  const api = storage({ [KEYS.projects]: storedDocuments(1, 'original') });
  const before = JSON.stringify(Array.from(api.values));
  const originalSet = api.setStorageSync.bind(api);
  api.setStorageSync = (key, value) => {
    if (key === KEYS.recoveryJournal) throw new Error('journal quota');
    originalSet(key, value);
  };
  const repository = new Repository(api);
  assert.throws(() => repository.restore({ schemaVersion: 2, projects: [], templates: [] }),
    { code: 'STORAGE_WRITE_FAILED' });
  assert.equal(JSON.stringify(Array.from(api.values)), before);
});

test('migration failure retains legacy data and can be retried without duplicates', () => {
  const legacyDocument = createDocument(40, 12);
  legacyDocument.name = '旧版工作';
  const api = storage({ [LEGACY_KEYS.document]: legacyDocument });
  const originalSet = api.setStorageSync.bind(api);
  let failOnce = true;
  api.setStorageSync = (key, value) => {
    if (failOnce && key === KEYS.settings) {
      failOnce = false;
      throw new Error('migration failure');
    }
    originalSet(key, value);
  };
  const repository = new Repository(api);
  assert.throws(() => repository.migrate(), { code: 'RESTORE_FAILED' });
  assert.equal(api.values.has(KEYS.version), false);
  assert.equal(api.values.has(KEYS.projects), false);
  assert.equal(api.values.get(LEGACY_KEYS.document).name, '旧版工作');
  assert.equal(repository.migrate(), true);
  assert.equal(repository.getProjects().length, 1);
  assert.equal(repository.getProjects()[0].name, '旧版工作');
});

test('failed commit marker rolls all changed keys back instead of claiming success', () => {
  const api = storage({ [KEYS.projects]: storedDocuments(1, 'original') });
  const before = JSON.stringify(Array.from(api.values));
  const originalSet = api.setStorageSync.bind(api);
  api.setStorageSync = (key, value) => {
    if (key === KEYS.recoveryJournal && value.status === 'committed') throw new Error('commit quota');
    originalSet(key, value);
  };
  const repository = new Repository(api);
  assert.throws(() => repository.restore({ schemaVersion: 2, projects: [], templates: [] }),
    { code: 'RESTORE_FAILED' });
  assert.equal(JSON.stringify(Array.from(api.values)), before);
});

test('recovery rejects corrupt journals and keys outside the repository', () => {
  const api = storage({
    'another-app:secret': 'preserved',
    [KEYS.recoveryJournal]: {
      version: 1, status: 'pending',
      entries: [{ key: 'another-app:secret', existed: false }]
    }
  });
  assert.throws(() => new Repository(api).getSettings(), { code: 'STORAGE_RECOVERY_INVALID' });
  assert.equal(api.values.get('another-app:secret'), 'preserved');
});

test('draft APIs preserve project identity, dirty state and non-destructive reads', () => {
  const api = storage();
  const repository = new Repository(api);
  const document = createDocument(40, 12);
  document.name = '尚未保存的工作';
  repository.saveEditorDraft({ document, projectId: 'project-1', dirtySinceSave: false, updatedAt: 10 });
  assert.equal(repository.getEditorDraft().projectId, 'project-1');
  assert.equal(repository.getEditorDraft().dirtySinceSave, false);
  assert.equal(repository.getEditorDraft().updatedAt, 10);
  repository.saveEditorAutosave({ document, projectId: 'project-1', dirtySinceSave: true });
  document.name = '外部修改';
  assert.equal(repository.getEditorAutosave().document.name, '尚未保存的工作');
  assert.equal(repository.getEditorAutosave().dirtySinceSave, true);
  repository.clearEditorDraft();
  assert.equal(repository.getEditorDraft(), null);
  assert.ok(repository.getEditorAutosave());
  repository.clearEditorAutosave();
  assert.equal(repository.getEditorAutosave(), null);
});

test('legacy autosaves are recovered as unsaved work and failed draft reads never return empty', () => {
  const api = storage({ [KEYS.editorAutosave]: createDocument(40, 12) });
  const repository = new Repository(api);
  assert.equal(repository.getEditorAutosave().dirtySinceSave, true);
  api.values.set(KEYS.editorAutosave, { document: createDocument(40, 12), projectId: 'existing' });
  assert.equal(repository.getEditorAutosave().projectId, 'existing');
  assert.equal(repository.getEditorAutosave().dirtySinceSave, true);
  const originalGet = api.getStorageSync.bind(api);
  api.getStorageSync = (key) => {
    if (key === KEYS.editorAutosave) throw new Error('read failure');
    return originalGet(key);
  };
  assert.throws(() => repository.getEditorAutosave(), { code: 'STORAGE_READ_FAILED' });
  api.removeStorageSync = () => { throw new Error('remove failure'); };
  assert.throws(() => repository.clearEditorAutosave(), { code: 'STORAGE_REMOVE_FAILED' });
});

test('editor project save commits project identity and clean autosave together', () => {
  const api = storage();
  const repository = new Repository(api);
  const document = createDocument(40, 12);
  document.name = '保存后的工作';
  repository.saveEditorDraft({ document, dirtySinceSave: true });
  repository.saveEditorAutosave({ document, dirtySinceSave: true });
  const project = repository.saveEditorProject(document, '');
  const autosave = repository.getEditorAutosave();
  assert.equal(repository.getProjects().length, 1);
  assert.equal(autosave.projectId, project.id);
  assert.equal(autosave.dirtySinceSave, false);
  assert.deepEqual(autosave.document, project.document);
  assert.equal(repository.getEditorDraft(), null, 'the stale navigation handoff cannot resurrect');
  project.document.name = '外部修改';
  assert.equal(repository.getProjects()[0].name, '保存后的工作');
});

test('retrying a failed new draft save does not create duplicate projects', () => {
  const api = storage();
  const repository = new Repository(api);
  const document = createDocument(40, 12);
  repository.saveEditorAutosave({ document, dirtySinceSave: true });
  const originalSet = api.setStorageSync.bind(api);
  let failCleanAutosave = true;
  api.setStorageSync = (key, value) => {
    if (failCleanAutosave && key === KEYS.editorAutosave && value.dirtySinceSave === false) {
      throw new Error('clean autosave write failed');
    }
    originalSet(key, value);
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const draft = repository.getEditorAutosave();
    assert.throws(() => repository.saveEditorProject(draft.document, draft.projectId), { code: 'RESTORE_FAILED' });
    assert.equal(repository.getProjects().length, 0);
    assert.equal(repository.getEditorAutosave().dirtySinceSave, true);
    assert.equal(repository.getEditorAutosave().projectId, '');
  }
  failCleanAutosave = false;
  const saved = repository.saveEditorProject(document, '');
  assert.equal(repository.getProjects().length, 1);
  assert.equal(repository.getEditorAutosave().projectId, saved.id);
});

test('failed existing-project saves retain both the old saved version and latest dirty work', () => {
  const api = storage();
  const repository = new Repository(api);
  const original = createDocument(40, 12);
  original.name = '已保存版本';
  const project = repository.saveProject(original);
  const edited = { ...original, name: '最新编辑版本' };
  repository.saveEditorAutosave({ document: edited, projectId: project.id, dirtySinceSave: true });
  repository.saveEditorDraft({ document: edited, projectId: project.id, dirtySinceSave: true });
  const originalSet = api.setStorageSync.bind(api);
  let failHandoffClear = true;
  api.setStorageSync = (key, value) => {
    if (failHandoffClear && key === KEYS.editorDraft && value === null) throw new Error('handoff write failed');
    originalSet(key, value);
  };
  assert.throws(() => repository.saveEditorProject(edited, project.id), { code: 'RESTORE_FAILED' });
  assert.equal(repository.getProjects()[0].name, '已保存版本');
  assert.equal(repository.getEditorAutosave().document.name, '最新编辑版本');
  assert.equal(repository.getEditorAutosave().dirtySinceSave, true);
  assert.ok(repository.getEditorDraft());
  failHandoffClear = false;
  repository.saveEditorProject(edited, project.id);
  assert.equal(repository.getProjects()[0].name, '最新编辑版本');
  assert.equal(repository.getEditorAutosave().document.name, '最新编辑版本');
  assert.equal(repository.getEditorAutosave().dirtySinceSave, false);
  assert.equal(repository.getEditorDraft(), null);
});

test('editor project save at capacity leaves the unsaved draft intact', () => {
  const api = storage({ [KEYS.projects]: storedDocuments(MAX_PROJECTS, 'existing') });
  const repository = new Repository(api);
  const document = createDocument(40, 12);
  repository.saveEditorAutosave({ document, dirtySinceSave: true });
  const before = JSON.stringify(Array.from(api.values));
  assert.throws(() => repository.saveEditorProject(document, ''), { code: 'STORAGE_CAPACITY_REACHED' });
  assert.equal(JSON.stringify(Array.from(api.values)), before);
  const saved = repository.saveEditorProject(document, 'existing-0');
  assert.equal(saved.id, 'existing-0');
  assert.equal(repository.getProjects().length, MAX_PROJECTS);
  assert.equal(repository.getEditorAutosave().dirtySinceSave, false);
});
