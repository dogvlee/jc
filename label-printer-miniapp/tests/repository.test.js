const test = require('node:test');
const assert = require('node:assert/strict');

const { createDocument, createElement } = require('../miniprogram/core/document');
const { fitText } = require('../miniprogram/core/renderer');
const {
  DOCUMENT_LIMITS,
  KEYS,
  LEGACY_KEYS,
  Repository,
  STORAGE_VERSION,
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
  assert.equal(normalizeDocument({ widthMm: 151, heightMm: 30 }), null);
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
    stockWidthMm: 300, stockHeightMm: 0, onboardingDone: 1, unit: 'inch'
  }), {
    defaultProfileId: 'd110',
    density: 5,
    threshold: 80,
    labelType: 4,
    stockWidthMm: 150,
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
