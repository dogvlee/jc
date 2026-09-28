const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CURATED_INDEX,
  buildCuratedBatchDocument,
  buildCuratedDocument,
  catalogMeta,
  curatedBatchTemplates,
  curatedCategoryChips,
  curatedSizeChips,
  curatedStats,
  getCuratedEntry,
  queryCuratedMeta
} = require('../miniprogram/app/curated/index');
const { auditLibraryDocument, exactFingerprint, layoutSkeleton } = require('../miniprogram/app/curated/quality');
const { validateDocument } = require('../miniprogram/core/renderer');

const documents = CURATED_INDEX.map((entry) => [entry, buildCuratedDocument(entry.id)]);

function texts(document) {
  return document.elements.map((element) => [element.text, element.label, element.prefix, element.suffix, element.value]
    .filter((value) => value != null).join(' '));
}

test('the curated library ships exactly 300 stable, unique templates', () => {
  assert.equal(CURATED_INDEX.length, 300);
  assert.equal(new Set(CURATED_INDEX.map((entry) => entry.id)).size, 300);
  assert.ok(CURATED_INDEX.every((entry) => /^sy-tpl-[A-Za-z]+-\d+x\d+-\d{2}$/.test(entry.id)));
  assert.equal(curatedStats().total, 300);
  assert.ok(curatedStats().recipes >= 45);
  assert.equal(getCuratedEntry(CURATED_INDEX[0].id), CURATED_INDEX[0]);
  assert.equal(getCuratedEntry('sy-lib-00001'), null);
});

test('every curated template passes the print gates with no hard errors', () => {
  const failures = [];
  for (const [entry, document] of documents) {
    const errors = auditLibraryDocument(document).issues.filter((item) => item.severity === 'error');
    if (errors.length) failures.push(`${entry.id}: ${errors[0].message}`);
    try {
      validateDocument(document, 203);
    } catch (error) {
      failures.push(`${entry.id}: ${error.message}`);
    }
  }
  assert.deepEqual(failures.slice(0, 5), []);
});

test('curated templates are Shangyue originals built only from native vector elements', () => {
  for (const [entry, document] of documents) {
    assert.equal(document.name, entry.name);
    assert.equal(document.templateMeta.origin, 'shangyue-original', entry.id);
    assert.equal(document.templateMeta.copyright, '© 2026 商跃');
    assert.equal(document.templateMeta.thirdPartyAssets, false);
    assert.ok(document.elements.length >= 2, entry.id);
    assert.ok(document.elements.every((element) => !['image', 'material'].includes(element.type)), entry.id);
    for (const value of texts(document)) {
      assert.doesNotMatch(value, /undefined|NaN|SY\/[A-Z]{2}-|NIIMBOT|精臣/i, `${entry.id}: ${value}`);
    }
  }
});

test('each template is laid out once and every caller gets an independent copy', () => {
  const id = CURATED_INDEX[0].id;
  const first = buildCuratedDocument(id);
  const second = buildCuratedDocument(id);
  assert.notEqual(first, second);
  assert.deepEqual(first, second);
  first.elements[0].text = '改过的文字';
  first.elements.pop();
  assert.deepEqual(buildCuratedDocument(id), second);

  const batchId = curatedBatchTemplates()[0].id;
  assert.equal(buildCuratedBatchDocument(batchId).templateMeta.batchCompatible, true);
  assert.equal(buildCuratedDocument(batchId).templateMeta.batchCompatible, false);
});

test('every template on the same paper has its own layout, not just new words', () => {
  const owners = new Map();
  for (const [entry, document] of documents) {
    const look = `${entry.widthMm}x${entry.heightMm}|${layoutSkeleton(document)}`;
    assert.ok(!owners.has(look), `${entry.id} looks the same as ${owners.get(look)}`);
    owners.set(look, entry.id);
  }
  // New words alone do not make a new layout; a new reverse block does.
  const [entry, document] = documents[0];
  const words = JSON.parse(JSON.stringify(document));
  words.elements.forEach((element) => { if (element.type === 'text') element.text = '换了文字'; });
  assert.equal(layoutSkeleton(words), layoutSkeleton(document), entry.id);
  const block = JSON.parse(JSON.stringify(document));
  block.elements.push({ type: 'rect', filled: true, x: 2, y: 2, width: 8, height: 8 });
  assert.notEqual(layoutSkeleton(block), layoutSkeleton(document), entry.id);
});

test('each scene comes in more than one style, and a style never repeats on one paper', () => {
  const styles = new Map();
  for (const entry of CURATED_INDEX) {
    const key = `${entry.recipe}|${entry.widthMm}x${entry.heightMm}`;
    const seen = styles.get(key) || new Set();
    assert.ok(!seen.has(entry.style), entry.id);
    seen.add(entry.style);
    styles.set(key, seen);
  }
  const multiStyle = new Set(CURATED_INDEX.filter((entry) => entry.style > 0).map((entry) => entry.recipe));
  assert.ok(multiStyle.size >= 45, `${multiStyle.size} scenes have a second style`);
});

test('no two printed items overlap on any curated template', () => {
  const printed = new Set(['text', 'date', 'serial', 'barcode', 'qrcode']);
  const overlaps = [];
  for (const [entry, document] of documents) {
    const boxes = document.elements.filter((element) => printed.has(element.type));
    boxes.forEach((a, index) => boxes.slice(index + 1).forEach((b) => {
      const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (width > 0 && height > 0 && width * height > 0.3) overlaps.push(`${entry.id}: ${a.id} × ${b.id}`);
    }));
  }
  assert.deepEqual(overlaps, []);
});

test('no two curated templates are the same document', () => {
  const seen = new Map();
  for (const [entry, document] of documents) {
    const key = exactFingerprint(document);
    assert.ok(!seen.has(key), `${entry.id} duplicates ${seen.get(key)}`);
    seen.set(key, entry.id);
  }
});

test('dates update at print time and expiry dates carry a shelf life', () => {
  let expiries = 0;
  for (const [entry, document] of documents) {
    for (const element of document.elements.filter((item) => item.type === 'date')) {
      assert.equal(element.autoUpdate, true, entry.id);
      if (element.dateRole === 'expire') {
        expiries += 1;
        assert.equal(element.expireMode, 'preset', entry.id);
        assert.ok(element.expirePresetHours > 0, entry.id);
      }
    }
  }
  assert.ok(expiries >= 40);
});

test('codes that follow a serial always have a serial to follow', () => {
  let linked = 0;
  for (const [entry, document] of documents) {
    const codes = document.elements.filter((element) => element.serialLinked === true);
    if (!codes.length) continue;
    linked += codes.length;
    assert.ok(document.elements.some((element) => element.type === 'serial'), entry.id);
  }
  assert.ok(linked >= 10);
});

test('the scene mix follows real demand: price tags lead, every industry is covered', () => {
  const categories = curatedCategoryChips();
  assert.equal(categories[0], '全部');
  assert.equal(categories[1], '零售');
  for (const category of ['食品', '餐饮', '仓储', '物流', '办公', '工业', '通信', '实验', '医药', '生活']) {
    assert.ok(categories.includes(category), category);
  }
  const sizes = curatedSizeChips();
  assert.ok(sizes.includes('40×30') && sizes.includes('50×30') && sizes.includes('40×20'));
});

test('curated metadata filters by category, size and keyword and pages without building everything', () => {
  const retail = queryCuratedMeta({ category: '零售', limit: 12 });
  assert.equal(retail.items.length, 12);
  assert.ok(retail.total > 80);
  assert.ok(retail.items.every((item) => item.category === '零售' && item.source === 'shangyue-curated' && item.badge === '原创'));
  const small = queryCuratedMeta({ size: '40×30', limit: 300 });
  assert.ok(small.items.every((item) => item.size[0] === 40 && item.size[1] === 30));
  const search = queryCuratedMeta({ query: '留样' });
  assert.ok(search.total >= 1 && search.items.every((item) => /留样/.test(`${item.name}${item.blurb}`)));
  const page = queryCuratedMeta({ offset: 290, limit: 24 });
  assert.equal(page.items.length, 10);
  assert.equal(catalogMeta(CURATED_INDEX[0]).libraryId, CURATED_INDEX[0].id);
});
