const test = require('node:test');
const assert = require('node:assert/strict');

const { templates } = require('../src/app/catalog');
const { buildTemplateDocument } = require('../src/app/template-layouts');
const {
  contentFingerprint,
  getCachedThumb,
  invalidateThumbsByPrefix,
  normalizedMaxSide,
  setCachedThumb,
  thumbRasterLayout,
  thumbCacheKey
} = require('../src/app/template-thumbs');

test('catalog featured set is non-empty for home grid', () => {
  const featured = templates.filter((item) => item.badge || item.uses > 180);
  assert.ok(featured.length >= 4);
});

test('every catalog id has a unique thumb cache key that changes with content', () => {
  const seen = new Set();
  for (const template of templates) {
    const document = buildTemplateDocument(template);
    const key = thumbCacheKey(template.id, document, 203);
    assert.ok(key.startsWith(`${template.id}|203|`));
    assert.equal(seen.has(key), false, `duplicate key for ${template.id}`);
    seen.add(key);

    const mutated = buildTemplateDocument(template);
    mutated.elements[0].text = `${mutated.elements[0].text || ''}-mut`;
    const key2 = thumbCacheKey(template.id, mutated, 203);
    assert.notEqual(key, key2);
  }
});

test('thumb cache key keeps different raster resolutions separate', () => {
  const document = buildTemplateDocument(templates[0]);
  const compact = thumbCacheKey(templates[0].id, document, 203, 400);
  const retina = thumbCacheKey(templates[0].id, document, 203, 800);
  assert.notEqual(compact, retina);
  assert.match(compact, /\|203\|400\|/);
  assert.match(retina, /\|203\|800\|/);
  assert.equal(normalizedMaxSide(9999), 1200);
});

test('small printer-DPI documents are rasterized at the requested screen resolution', () => {
  const layout = thumbRasterLayout({ width: 240, height: 96 }, 800, 14);
  assert.equal(layout.width, 800);
  assert.equal(layout.height, 337);
  assert.ok(layout.scale > 3);
});

test('thumb cache set/get/invalidate works', () => {
  invalidateThumbsByPrefix('');
  const document = buildTemplateDocument(templates[0]);
  const key = thumbCacheKey(templates[0].id, document, 203);
  assert.equal(getCachedThumb(key), '');
  setCachedThumb(key, 'data:image/png;base64,abc');
  assert.equal(getCachedThumb(key), 'data:image/png;base64,abc');
  invalidateThumbsByPrefix(templates[0].id);
  assert.equal(getCachedThumb(key), '');
});

test('contentFingerprint is stable for identical documents', () => {
  const left = buildTemplateDocument(templates[0]);
  const right = buildTemplateDocument(templates[0]);
  assert.equal(contentFingerprint(left), contentFingerprint(right));
});

test('contentFingerprint changes for raster paths and visual styling', () => {
  const base = buildTemplateDocument(templates[0]);
  const imageChanged = JSON.parse(JSON.stringify(base));
  imageChanged.elements[0].path = 'assets/user/new-image.png';
  assert.notEqual(contentFingerprint(base), contentFingerprint(imageChanged));

  const styleChanged = JSON.parse(JSON.stringify(base));
  styleChanged.elements[0].rotation = 15;
  assert.notEqual(contentFingerprint(base), contentFingerprint(styleChanged));
});

test('print history payload shape includes reopen fields', () => {
  const document = buildTemplateDocument(templates[0]);
  const entry = {
    id: 'print-test',
    name: document.name,
    projectId: 'project-1',
    widthMm: document.widthMm,
    heightMm: document.heightMm,
    document,
    device: 'B1',
    copies: 1,
    result: 'success',
    error: '',
    createdAt: Date.now()
  };
  assert.ok(entry.document);
  assert.equal(entry.widthMm, templates[0].size[0]);
  assert.equal(entry.heightMm, templates[0].size[1]);
  assert.ok(entry.projectId);
});
