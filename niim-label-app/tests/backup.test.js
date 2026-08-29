const assert = require('node:assert/strict');
const test = require('node:test');

const {
  LIMITS,
  SCHEMA_VERSION,
  buildBackup,
  restoreBackup,
  validateBackup
} = require('../src/core/backup');

function documentFixture(name = '测试标签') {
  return {
    schemaVersion: 1,
    name,
    widthMm: 40,
    heightMm: 20,
    elements: [{ id: 'text-1', type: 'text', x: 1, y: 1, width: 16, height: 5, rotation: 0, text: '内容' }]
  };
}

function collectionsFixture() {
  return {
    projects: [{ id: 'project-a', updatedAt: 10, document: documentFixture('项目 A') }],
    templates: [{ id: 'template-a', name: '模板 A', createdAt: 5, document: documentFixture('模板 A') }],
    settings: { units: 'mm', autosave: true, copies: 2, defaultWidthMm: 40, defaultHeightMm: 20 },
    dataRows: [{ name: '商品 A', price: '12.00' }]
  };
}

test('buildBackup creates schema v1, statistics, and a detached snapshot', () => {
  const source = collectionsFixture();
  const result = buildBackup(source, { now: '2026-08-18T10:20:30.000Z' });

  assert.equal(result.ok, true);
  assert.equal(result.backup.schemaVersion, SCHEMA_VERSION);
  assert.equal(result.backup.exportedAt, '2026-08-18T10:20:30.000Z');
  assert.deepEqual(result.stats, { projects: 1, templates: 1, dataRows: 1, settings: 5, elements: 2 });
  source.projects[0].document.name = '事后修改';
  assert.equal(result.backup.projects[0].document.name, '项目 A');
});

test('validateBackup migrates an unversioned legacy envelope, aliases, and scalar values', () => {
  const legacy = {
    data: {
      projects: [{ document: {
        name: '旧项目', widthMm: '40', heightMm: '20', elements: [
          { type: 'qr', x: '1', y: '1', width: '8', height: '8', value: 'hello' },
          { id: 'qr-2', type: 'qr', x: 10, y: 1, width: 8, height: 8, value: 'world' }
        ]
      } }],
      userTemplates: [],
      settings: { autosave: 1, copies: '3', removedLegacyFlag: true },
      dataRows: [{ amount: 12, enabled: true, note: null }]
    }
  };
  const result = validateBackup(JSON.stringify(legacy));

  assert.equal(result.ok, true);
  assert.equal(result.sourceSchemaVersion, 0);
  assert.equal(result.backup.schemaVersion, 1);
  assert.equal(result.data.projects[0].id, 'project-imported-1');
  assert.deepEqual(result.data.projects[0].document.elements.map((item) => item.type), ['qrcode', 'qrcode']);
  assert.equal(result.data.projects[0].document.elements[0].id, 'qrcode-1');
  assert.deepEqual(result.data.settings, { autosave: true, copies: 3 });
  assert.deepEqual(result.data.dataRows, [{ amount: '12', enabled: 'true', note: '' }]);
  assert.ok(result.warnings.some((item) => item.code === 'migrate.schema'));
  assert.ok(result.warnings.some((item) => item.code === 'migrate.unknownSettingDropped'));
});

test('validateBackup rejects malformed JSON and future schemas', () => {
  const malformed = validateBackup('{oops');
  assert.equal(malformed.ok, false);
  assert.equal(malformed.backup, null);
  assert.equal(malformed.errors[0].code, 'invalid.json');

  const future = validateBackup({ schemaVersion: 99 });
  assert.equal(future.ok, false);
  assert.equal(future.errors[0].code, 'unsupported.schema');
});

test('dangerous prototype keys are rejected even inside metadata that migration would drop', () => {
  delete Object.prototype.polluted;
  const payload = JSON.parse('{"schemaVersion":1,"projects":[],"templates":[],"settings":{"ignored":{"__proto__":{"polluted":true}}},"dataRows":[]}');
  const result = validateBackup(payload);

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, 'security.prototypeKey');
  assert.equal(Object.prototype.polluted, undefined);
});

test('a shared JSON-compatible object is accepted while an actual cycle is rejected', () => {
  const sharedDocument = documentFixture('共享但无循环');
  const source = {
    projects: [{ id: 'one', document: sharedDocument }, { id: 'two', document: sharedDocument }],
    templates: [], settings: {}, dataRows: []
  };
  assert.equal(buildBackup(source).ok, true);

  const cyclic = collectionsFixture();
  cyclic.loop = cyclic;
  const result = buildBackup(cyclic);
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, 'invalid.cycle');
});

test('invalid document dimensions and invalid elements reject the whole backup', () => {
  const badDimension = collectionsFixture();
  badDimension.projects[0].document.widthMm = 0;
  const first = buildBackup(badDimension);
  assert.equal(first.ok, false);
  assert.equal(first.backup, null);
  assert.ok(first.errors.some((item) => item.path.endsWith('.widthMm')));

  const outside = collectionsFixture();
  outside.projects[0].document.elements[0].x = 39;
  outside.projects[0].document.elements[0].width = 10;
  const second = buildBackup(outside);
  assert.equal(second.ok, false);
  assert.ok(second.errors.some((item) => item.code === 'invalid.elementBounds'));

  const unsupported = collectionsFixture();
  unsupported.projects[0].document.elements[0].type = 'script';
  const third = buildBackup(unsupported);
  assert.equal(third.ok, false);
  assert.ok(third.errors.some((item) => item.code === 'invalid.elementType'));
});

test('rotated local geometry may extend outside an axis when its rendered box still fits', () => {
  const source = collectionsFixture();
  source.projects[0].document = {
    schemaVersion: 1,
    name: '旋转标签',
    widthMm: 12,
    heightMm: 40,
    elements: [{ id: 'rotated', type: 'text', x: -13, y: 15, width: 38, height: 10, rotation: 90, text: '旋转' }]
  };
  const result = buildBackup(source);
  assert.equal(result.ok, true);
  assert.equal(result.backup.projects[0].document.elements[0].x, -13);
});

test('collection and per-document element limits are enforced without truncation', () => {
  const tooManyRows = collectionsFixture();
  tooManyRows.dataRows = Array.from({ length: LIMITS.dataRows + 1 }, () => ({}));
  const rowResult = buildBackup(tooManyRows);
  assert.equal(rowResult.ok, false);
  assert.equal(rowResult.data, null);
  assert.ok(rowResult.errors.some((item) => item.code === 'limit.dataRows'));

  const tooManyElements = collectionsFixture();
  tooManyElements.projects[0].document.elements = Array.from({ length: LIMITS.elementsPerDocument + 1 }, (_, index) => ({
    id: `text-${index}`, type: 'text', x: 0, y: 0, width: 1, height: 1
  }));
  const elementResult = buildBackup(tooManyElements);
  assert.equal(elementResult.ok, false);
  assert.ok(elementResult.errors.some((item) => item.code === 'limit.elements'));
});

test('replace returns a complete detached restoration and never mutates inputs', () => {
  const incoming = buildBackup(collectionsFixture(), { now: 0 }).backup;
  const current = {
    projects: [{ id: 'old', document: documentFixture('旧项目') }],
    userTemplates: [],
    settings: { units: 'in' },
    dataRows: []
  };
  const snapshot = JSON.stringify(current);
  const result = restoreBackup(incoming, current, { strategy: 'replace' });

  assert.equal(result.ok, true);
  assert.equal(result.stats.strategy, 'replace');
  assert.deepEqual(result.data, {
    projects: incoming.projects,
    templates: incoming.templates,
    settings: incoming.settings,
    dataRows: incoming.dataRows
  });
  assert.equal(JSON.stringify(current), snapshot);
  result.data.projects[0].document.name = '恢复后修改';
  assert.equal(incoming.projects[0].document.name, '项目 A');
});

test('merge keeps existing records, deterministically renames conflicts, and preserves current settings', () => {
  const incoming = collectionsFixture();
  incoming.projects.push({ id: 'project-a-imported', document: documentFixture('第二个导入项目') });
  const backup = buildBackup(incoming, { now: 0 }).backup;
  const current = {
    projects: [
      { id: 'project-a', document: documentFixture('现有 A') },
      { id: 'project-a-imported', document: documentFixture('现有 imported') }
    ],
    templates: [{ id: 'template-a', name: '现有模板', document: documentFixture('现有模板') }],
    settings: { units: 'in', copies: 9 },
    dataRows: [{ name: '现有数据' }]
  };
  const result = restoreBackup(backup, current, { strategy: 'merge' });

  assert.equal(result.ok, true);
  assert.deepEqual(result.data.projects.map((item) => item.id), [
    'project-a', 'project-a-imported', 'project-a-imported-2', 'project-a-imported-imported'
  ]);
  assert.deepEqual(result.data.templates.map((item) => item.id), ['template-a', 'template-a-imported']);
  assert.equal(result.stats.projects.renamed, 2);
  assert.equal(result.stats.templates.renamed, 1);
  assert.equal(result.data.settings.units, 'in');
  assert.equal(result.data.settings.copies, 9);
  assert.equal(result.data.settings.autosave, true);
  assert.deepEqual(result.data.dataRows.map((row) => row.name), ['现有数据', '商品 A']);
});

test('merge overflow fails atomically and returns no partial result', () => {
  const current = collectionsFixture();
  current.projects = Array.from({ length: LIMITS.projects }, (_, index) => ({
    id: `existing-${index}`,
    document: documentFixture(`现有 ${index}`)
  }));
  const incoming = buildBackup(collectionsFixture(), { now: 0 }).backup;
  const currentSnapshot = JSON.stringify(current);
  const result = restoreBackup(incoming, current, { strategy: 'merge' });

  assert.equal(result.ok, false);
  assert.equal(result.data, null);
  assert.ok(result.errors.some((item) => item.code === 'limit.projects'));
  assert.equal(JSON.stringify(current), currentSnapshot);
});

test('invalid restore strategy fails before producing restoration data', () => {
  const result = restoreBackup(collectionsFixture(), {}, { strategy: 'append' });
  assert.equal(result.ok, false);
  assert.equal(result.data, null);
  assert.equal(result.errors[0].code, 'invalid.strategy');
});
