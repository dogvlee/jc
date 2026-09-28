const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const {
  LIBRARY_INDEX,
  buildLibraryDocument,
  getLibraryEntry,
  libraryStats,
  listLibraryMeta,
  queryLibraryMeta
} = require('../miniprogram/app/shangyue-library/pack');
const { ownedLibraryShape } = require('../miniprogram/app/shangyue-library/classify');
const { DESIGN_FAMILIES, SCENE_CODES } = require('../miniprogram/app/shangyue-library/brand-system');
const { templates } = require('../miniprogram/app/catalog');
const { validateDocument } = require('../miniprogram/core/renderer');

const SHAPE = ownedLibraryShape();

test('Shangyue industry library is an owned scene-and-size matrix', () => {
  assert.equal(LIBRARY_INDEX.length, SHAPE.total);
  assert.equal(new Set(LIBRARY_INDEX.map((entry) => entry.id)).size, SHAPE.total);
  assert.ok(LIBRARY_INDEX.every((entry) => String(entry.id).startsWith('sy-lib-')));
  assert.ok(LIBRARY_INDEX.every((entry) => entry.name.startsWith('商跃')));
  assert.ok(LIBRARY_INDEX.every((entry) => /· \d+×\d+[甲乙丙]$/.test(entry.name)));
  assert.equal(templates.some((item) => String(item.id).startsWith('sy-lib-')), false);
});

test('library documents are clean-room vectors and stay off the public seed shelf', () => {
  const stats = libraryStats();
  assert.equal(stats.total, SHAPE.total);
  assert.equal(stats.scenes.price, SHAPE.perScene);
  const sample = LIBRARY_INDEX.filter((_, index) => index % 200 === 0);
  assert.ok(sample.length >= 40);
  for (const entry of sample) {
    const document = buildLibraryDocument(entry.id);
    assert.equal(document.name, entry.name);
    assert.equal(document.widthMm, entry.widthMm);
    assert.equal(document.heightMm, entry.heightMm);
    assert.equal(document.templateMeta.library, 'shangyue-library');
    assert.equal(document.templateMeta.thirdPartyAssets, false);
    assert.equal(document.templateMeta.releaseApproved, true);
    assert.ok(document.elements.every((element) => !['image', 'material'].includes(element.type)));
    assert.doesNotMatch(JSON.stringify(document), /NIIMBOT|精臣|JingChen|黄鹤楼|利群|95598|网上国网|点击后编辑/i);
    assert.doesNotThrow(() => validateDocument(document, 203));
  }
  const meta = listLibraryMeta();
  assert.equal(meta.length, SHAPE.total);
  assert.ok(meta.every((item) => (
    item.publicCatalog === true
    && item.releaseApproved === true
    && item.approvedOriginal === false
    && item.source === 'shangyue-library'
  )));
  assert.equal(getLibraryEntry('sy-lib-00001').id, 'sy-lib-00001');
});

test('library review folder exists beside the seed compare sheets', () => {
  const review = path.join(__dirname, '..', '..', 'output', 'shangyue-library');
  assert.ok(fs.existsSync(path.join(review, 'index.json')));
  assert.ok(fs.existsSync(path.join(review, 'README.md')));
  assert.ok(fs.existsSync(path.join(review, 'stats.json')));
});

test('library scene chips put price first after 全部 and can filter the pack', () => {
  const { librarySceneChips, librarySizeChips } = require('../miniprogram/app/shangyue-library/pack');
  const chips = librarySceneChips();
  assert.equal(chips[0], '全部');
  assert.ok(chips.includes('商跃价签'));
  assert.ok(chips.includes('商跃效期'));
  const priced = LIBRARY_INDEX.filter((entry) => entry.title === '商跃价签');
  assert.equal(priced.length, SHAPE.perScene);
  const sizes = librarySizeChips();
  assert.equal(sizes[0], '全部');
  assert.equal(sizes.length, SHAPE.papers + 1);
  assert.ok(sizes.includes('40×30'));
  assert.ok(sizes.includes('30×12'));
  assert.ok(sizes.includes('40×50'));
  assert.ok(sizes.includes('50×50'));
});

test('library metadata can be filtered and paged without materializing 8,100 cards', () => {
  const first = queryLibraryMeta({ limit: 24 });
  assert.equal(first.total, SHAPE.total);
  assert.equal(first.items.length, 24);
  const page = queryLibraryMeta({ sceneLabel: '商跃价签', size: '50×50', query: '青提', limit: 10 });
  assert.equal(page.total, 3);
  assert.equal(page.items.length, 3);
  assert.ok(page.items.every((item) => item.scene === 'price' && item.size[0] === 50 && item.size[1] === 50));
});

test('price and date library scenes use distinct field layouts', () => {
  const price = LIBRARY_INDEX.find((entry) => entry.scene === 'price' && entry.widthMm === 40 && entry.heightMm === 30);
  const date = LIBRARY_INDEX.find((entry) => entry.scene === 'date' && entry.widthMm === 40 && entry.heightMm === 30);
  const name = LIBRARY_INDEX.find((entry) => entry.scene === 'name' && entry.heightMm >= 20);
  const priceDoc = buildLibraryDocument(price.id);
  const dateDoc = buildLibraryDocument(date.id);
  const nameDoc = buildLibraryDocument(name.id);
  assert.ok(priceDoc.elements.some((element) => String(element.text || '').includes('¥')));
  assert.ok(priceDoc.elements.some((element) => element.type === 'barcode'));
  assert.ok(dateDoc.elements.filter((element) => element.type === 'date').length >= 2);
  assert.ok(nameDoc.elements.some((element) => ['林晓舟', '周衡', '赵敏', '陈思远', '王厨', '张工'].includes(element.text)));
  assert.equal(nameDoc.elements.some((element) => element.type === 'barcode'), false);
});

test('codes appear only in scenes where scanning has a real use', () => {
  const codeTypes = new Set(['barcode', 'qrcode']);
  for (const scene of ['plant', 'office', 'info', 'seat', 'note', 'cert', 'seal']) {
    const entries = LIBRARY_INDEX.filter((entry) => (
      entry.scene === scene && entry.widthMm === 40 && entry.heightMm === 30
    ));
    assert.equal(entries.length, 18, `${scene} has the full 40×30 copy/variant set`);
    assert.ok(entries.every((entry) => (
      buildLibraryDocument(entry.id).elements.every((element) => !codeTypes.has(element.type))
    )), `${scene} does not invent a scan code`);
  }
});

test('v2 library carries Shangyue provenance and three named design families', () => {
  assert.deepEqual(DESIGN_FAMILIES.map((family) => family.id), ['signal', 'orbit', 'ledger']);
  assert.equal(new Set(Object.values(SCENE_CODES)).size, SHAPE.scenes);
  const familyIds = new Set();
  for (const entry of LIBRARY_INDEX.filter((item) => (
    item.scene === 'price' && item.item === '青提' && item.widthMm === 40 && item.heightMm === 30
  ))) {
    const document = buildLibraryDocument(entry.id);
    familyIds.add(document.templateMeta.designFamily);
    assert.equal(document.templateMeta.designVersion, '2.1.0');
    assert.equal(document.templateMeta.designSystem, 'sy-semantic-grid-v2');
    assert.equal(document.templateMeta.aiAssisted, true);
    assert.equal(document.templateMeta.sourceTemplateId, null);
    assert.equal(document.templateMeta.authorshipBasis, 'deterministic-clean-room-generator');
  }
  assert.deepEqual([...familyIds].sort(), ['ledger', 'orbit', 'signal']);
});

test('generated sample codes stay semantic and never invent retail EAN values', () => {
  const samples = LIBRARY_INDEX.filter((_, index) => index % 97 === 0);
  for (const entry of samples) {
    const document = buildLibraryDocument(entry.id);
    const barcodes = document.elements.filter((element) => element.type === 'barcode');
    assert.ok(barcodes.every((element) => element.format === 'code128'));
    if (entry.scene === 'wish') {
      assert.equal(document.elements.some((element) => element.type === 'qrcode'), false);
    }
  }
});

test('narrow presets retain each scene core field without forcing unusable codes', () => {
  const narrow = LIBRARY_INDEX.filter((entry) => entry.heightMm <= 15);
  for (const entry of narrow) {
    const document = buildLibraryDocument(entry.id);
    if (['price', 'bakery', 'cup'].includes(entry.scene)) {
      assert.ok(document.elements.some((element) => element.type === 'text' && /^¥\d/.test(element.text)), entry.name);
    }
    if (['date', 'medicine'].includes(entry.scene)) {
      assert.ok(document.elements.some((element) => element.type === 'date'), entry.name);
    }
    if (entry.scene === 'queue') {
      assert.ok(document.elements.some((element) => element.type === 'serial'), entry.name);
    }
    if (entry.scene === 'wifi' && entry.widthMm >= 40 && entry.heightMm >= 15) {
      assert.ok(document.elements.some((element) => element.type === 'qrcode'), entry.name);
    }
  }
});

test('layout variants preserve business data and never duplicate a scan code', () => {
  const groups = new Map();
  for (const entry of LIBRARY_INDEX) {
    const document = buildLibraryDocument(entry.id);
    const codes = document.elements.filter((element) => ['barcode', 'qrcode'].includes(element.type));
    assert.ok(codes.length <= 1, `${entry.name} has at most one scan code`);
    const values = {
      price: document.elements.filter((element) => /^¥\d/.test(element.text || '')).map((element) => element.text),
      code: codes.map((element) => `${element.type}:${element.value}`),
      serial: document.elements.filter((element) => element.type === 'serial').map((element) => `${element.prefix}:${element.start}:${element.digits}`)
    };
    const key = [entry.scene, entry.item, entry.widthMm, entry.heightMm].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(values);
  }
  for (const [key, variants] of groups) {
    for (const field of ['price', 'code', 'serial']) {
      const populated = variants.map((item) => item[field]).filter((items) => items.length);
      if (populated.length > 1) {
        assert.equal(new Set(populated.map(JSON.stringify)).size, 1, `${key} keeps ${field} data across variants`);
      }
    }
  }
});

test('each Jia Yi Bing group has three genuinely different layout skeletons', () => {
  const groups = new Map();
  LIBRARY_INDEX.forEach((entry) => {
    const key = [entry.scene, entry.item, entry.widthMm, entry.heightMm].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });

  const skeleton = (document) => JSON.stringify(document.elements.map((element) => ({
    type: element.type,
    x: Number(element.x.toFixed(3)),
    y: Number(element.y.toFixed(3)),
    width: Number(element.width.toFixed(3)),
    height: Number(element.height.toFixed(3)),
    filled: element.filled === true,
    align: element.align || 'left',
    reverse: element.reverse === true
  })));

  for (const [key, entries] of groups) {
    assert.equal(entries.length, 3, `${key} keeps exactly three variants`);
    const variants = new Set(entries.map((entry) => skeleton(buildLibraryDocument(entry.id))));
    assert.equal(variants.size, 3, `${key} has three distinct layout skeletons`);
  }
});

test('every library document stays inside its paper', () => {
  let overflow = 0;
  for (const entry of LIBRARY_INDEX) {
    const document = buildLibraryDocument(entry.id);
    const over = document.elements.some((element) => (
      element.x < -0.05
      || element.y < -0.05
      || element.x + element.width > document.widthMm + 0.08
      || element.y + element.height > document.heightMm + 0.08
    ));
    if (over) overflow += 1;
  }
  assert.equal(overflow, 0);
});
