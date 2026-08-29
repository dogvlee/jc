const test = require('node:test');
const assert = require('node:assert/strict');

const {
  auditLibrary,
  auditLibraryDocument,
  layoutFingerprint
} = require('../miniprogram/app/shangyue-library/quality');
const {
  LIBRARY_INDEX,
  buildLibraryDocument
} = require('../miniprogram/app/shangyue-library/pack');

function text(id, x, y, width, height, fontSize, value) {
  return { id, type: 'text', x, y, width, height, fontSize, text: value || id };
}

test('single-document gate reports print geometry, font, code and content defects', () => {
  const report = auditLibraryDocument({
    id: 'broken',
    name: '故意损坏的测试模板',
    widthMm: 40,
    heightMm: 30,
    elements: [
      text('tiny-outside', -1, 1, 10, 3, 1.8),
      text('overlap-a', 5, 8, 12, 4, 2.2),
      text('overlap-b', 6, 9, 12, 4, 2.2),
      { id: 'bad-size', type: 'text', x: 2, y: 16, width: 0, height: 3, fontSize: 2.2, text: '无宽度' },
      { id: 'small-qr', type: 'qrcode', x: 30, y: 1, width: 7, height: 6, value: 'SY://small', errorCorrection: 'M' },
      { id: 'small-bar', type: 'barcode', x: 2, y: 22, width: 12, height: 3, value: 'SY01', format: 'code128' }
    ]
  });
  const rules = new Set(report.issues.map((item) => item.rule));
  assert.equal(report.ok, false);
  for (const expected of [
    'ELEMENT_OUT_OF_BOUNDS',
    'TEXT_TOO_SMALL',
    'ELEMENT_SIZE_INVALID',
    'QRCODE_NOT_SQUARE',
    'QRCODE_TOO_SMALL',
    'BARCODE_TOO_SMALL',
    'CODE_MODULE_DENSITY_LOW',
    'CONTENT_OVERLAP'
  ]) {
    assert.ok(rules.has(expected), `quality gate reports ${expected}`);
  }
});

test('excessive whitespace is visible as a review warning without hiding hard failures', () => {
  const report = auditLibraryDocument({
    id: 'sparse',
    widthMm: 50,
    heightMm: 50,
    elements: [text('lonely', 2, 2, 8, 3, 2.2)]
  });
  assert.equal(report.ok, true);
  assert.equal(report.errors, 0);
  assert.ok(report.metrics.whitespaceRatio > 0.9);
  assert.ok(report.issues.some((item) => item.rule === 'EXCESSIVE_WHITESPACE' && item.severity === 'warning'));
});

test('batch gate separates exact duplicates, variant collisions and global structure reuse', () => {
  const entries = [
    { id: 'a', scene: 'price', item: '青提', widthMm: 40, heightMm: 30 },
    { id: 'b', scene: 'price', item: '青提', widthMm: 40, heightMm: 30 }
  ];
  const make = (entry) => ({
    id: entry.id,
    widthMm: 40,
    heightMm: 30,
    elements: [text(`${entry.id}-text`, 2, 2, 30, 4, 3, '相同内容')]
  });
  const audit = auditLibrary(entries, make);
  assert.equal(audit.ok, false);
  assert.equal(audit.diversity.exactDuplicateGroups, 1);
  assert.equal(audit.diversity.variantCollisionGroups, 1);
  assert.ok(audit.batchIssues.some((item) => item.rule === 'EXACT_DOCUMENT_DUPLICATE'));
  assert.ok(audit.batchIssues.some((item) => item.rule === 'VARIANT_STRUCTURE_DUPLICATE'));

  const moved = make(entries[1]);
  moved.elements[0].x = 4;
  assert.notEqual(layoutFingerprint(make(entries[0])), layoutFingerprint(moved));
});

test('all 8,100 Shangyue presets pass hard quality gates and retain variant diversity', () => {
  const audit = auditLibrary(LIBRARY_INDEX, (entry) => buildLibraryDocument(entry.id));
  const failing = audit.reports.filter((report) => !report.ok);
  assert.deepEqual(
    failing.slice(0, 5).map((report) => ({ name: report.name, issues: report.issues })),
    [],
    `${failing.length} generated documents have hard quality defects`
  );
  assert.equal(audit.totals.documents, 8100);
  assert.equal(audit.totals.documentErrors, 0);
  assert.equal(audit.totals.batchErrors, 0);
  assert.equal(audit.totals.documentWarnings, 0);
  assert.equal(audit.diversity.exactDuplicateGroups, 0);
  assert.equal(audit.diversity.variantCollisionGroups, 0);
  assert.ok(audit.diversity.uniqueStructures >= 680);
  assert.ok(audit.diversity.maxStructureReuse <= 110);
  assert.ok(audit.batchIssues.some((item) => item.rule === 'GLOBAL_STRUCTURE_REUSE_HIGH'));
});
