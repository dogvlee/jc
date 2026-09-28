const test = require('node:test');
const assert = require('node:assert/strict');

const {
  auditLibrary,
  auditLibraryDocument,
  layoutFingerprint
} = require('../miniprogram/app/curated/quality');
const { CURATED_INDEX, buildCuratedDocument } = require('../miniprogram/app/curated/index');

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

test('text-fit gate rejects text the renderer would have to shrink', () => {
  const report = auditLibraryDocument({
    id: 'fit',
    widthMm: 40,
    heightMm: 30,
    elements: [
      text('fits', 2, 2, 20, 4, 3, '云南青提'),
      text('too-long', 2, 8, 12, 3.2, 3, '内蒙古呼和浩特市特产'),
      { id: 'date-long', type: 'date', x: 2, y: 14, width: 10, height: 3, fontSize: 2.4, format: 'YYYY-MM-DD', label: '保质期至', autoUpdate: true },
      text('two-lines', 2, 20, 20, 7.5, 3, '第一行\n第二行')
    ]
  });
  const flagged = report.issues.filter((item) => item.rule === 'TEXT_OVERFLOW').map((item) => item.elementIds[0]).sort();
  assert.deepEqual(flagged, ['date-long', 'too-long']);
});

test('edge gate rejects frames and solid ink that print as black edges after paper drift', () => {
  const report = auditLibraryDocument({
    id: 'edges',
    widthMm: 40,
    heightMm: 30,
    elements: [
      { id: 'frame', type: 'rect', x: 0.8, y: 0.8, width: 38.4, height: 28.4, lineWidth: 0.35, filled: false },
      { id: 'inset-frame', type: 'rect', x: 2, y: 2, width: 36, height: 26, lineWidth: 0.3, filled: false },
      { id: 'rail', type: 'rect', x: 1.2, y: 6, width: 1, height: 18, filled: true },
      { id: 'band', type: 'text', x: 5, y: 1.2, width: 20, height: 3, fontSize: 2.2, text: '反白标题', reverse: true },
      { id: 'rule', type: 'line', x: 2, y: 28.9, width: 20, height: 0.3, lineWidth: 0.3 },
      { id: 'tight', type: 'text', x: 0.6, y: 10, width: 10, height: 3, fontSize: 2.2, text: '贴边文字' },
      { id: 'fine', type: 'text', x: 2, y: 15, width: 20, height: 3, fontSize: 2.2, text: '正常文字' }
    ]
  });
  const flagged = (rule) => report.issues
    .filter((item) => item.rule === rule)
    .map((item) => item.elementIds[0])
    .sort();
  assert.deepEqual(flagged('EDGE_FRAME'), ['frame', 'inset-frame']);
  assert.deepEqual(flagged('EDGE_INK'), ['band', 'rail', 'rule']);
  assert.deepEqual(flagged('EDGE_TOO_CLOSE'), ['tight']);
  assert.equal(report.ok, false);
});

test('every shelf, batch and curated template keeps ink off the label edge', () => {
  const { BATCH_TEMPLATES, PUBLIC_TEMPLATES } = require('../miniprogram/app/catalog');
  const { buildTemplateDocument } = require('../miniprogram/app/template-layouts');
  const documents = PUBLIC_TEMPLATES.concat(BATCH_TEMPLATES)
    .map((template) => buildTemplateDocument(template))
    .concat(CURATED_INDEX.map((entry) => buildCuratedDocument(entry.id)));
  const failures = [];
  for (const document of documents) {
    const edge = auditLibraryDocument(document).issues.filter((item) => item.rule.startsWith('EDGE_'));
    if (edge.length) failures.push(`${document.name}（${document.widthMm}×${document.heightMm}）：${edge[0].message}`);
  }
  assert.ok(!failures.length, `${failures.length} 个模板有黑边风险，例如：\n${failures.slice(0, 6).join('\n')}`);
});

test('every shelf template fits its text at the declared size', () => {
  const { PUBLIC_TEMPLATES } = require('../miniprogram/app/catalog');
  const { buildTemplateDocument } = require('../miniprogram/app/template-layouts');
  const failures = [];
  for (const template of PUBLIC_TEMPLATES) {
    const errors = auditLibraryDocument(buildTemplateDocument(template)).issues.filter((item) => item.severity === 'error');
    if (errors.length) failures.push(`${template.id}：${errors[0].message}`);
  }
  assert.deepEqual(failures, []);
});
