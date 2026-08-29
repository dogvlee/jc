const test = require('node:test');
const assert = require('node:assert/strict');
const mats = require('../src/core/materials');
const { createDocument, createElement } = require('../src/core/document');
const { renderDocument } = require('../src/core/renderer');
const MATERIAL_CATALOG = mats.MATERIAL_CATALOG;
const drawMaterialSymbol = mats.drawMaterialSymbol;
const drawShangyueSceneMaterialSymbol = mats.drawShangyueSceneMaterialSymbol;
const materialById = mats.materialById;
const materialCategories = mats.materialCategories;
const SHANGYUE_SCENE_MATERIALS = mats.SHANGYUE_SCENE_MATERIALS;
const SHANGYUE_SCENE_MATERIAL_SYMBOL_IDS = mats.SHANGYUE_SCENE_MATERIAL_SYMBOL_IDS;
const {
  SHANGYUE_MATERIAL_SYMBOL_IDS,
  drawShangyueMaterialSymbol
} = require('../src/core/material-symbols-v2');

function mockContext() {
  const noop = () => {};
  return {
    lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
    strokeStyle: '#000', fillStyle: '#000', font: '10px sans-serif',
    textAlign: 'left', textBaseline: 'top', canvas: {},
    beginPath: noop, moveTo: noop, lineTo: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, arc: noop,
    closePath: noop, stroke: noop, fill: noop,
    save: noop, restore: noop, translate: noop, rotate: noop,
    rect: noop, fillRect: noop, clearRect: noop,
    setTransform: noop, setLineDash: noop, scale: noop, clip: noop,
    fillText: noop, drawImage: noop, putImageData: noop, strokeRect: noop,
    measureText: () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 })
  };
}

function recordingContext() {
  const trace = [];
  const record = (command) => (...values) => {
    trace.push(`${command}:${values.map((value) => Number.isFinite(value) ? Number(value.toFixed(3)) : value).join(',')}`);
  };
  return {
    trace,
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    strokeStyle: '#000',
    fillStyle: '#000',
    save: record('save'),
    restore: record('restore'),
    beginPath: record('begin'),
    moveTo: record('move'),
    lineTo: record('line'),
    bezierCurveTo: record('curve'),
    quadraticCurveTo: record('quad'),
    arc: record('arc'),
    closePath: record('close'),
    stroke: record('stroke'),
    fill: record('fill')
  };
}

test('catalog size and lookup', () => {
  assert.ok(MATERIAL_CATALOG.length >= 100);
  assert.ok(materialCategories().length >= 5);
  assert.equal(materialById('star').id, 'star');
  assert.equal(materialById('nope').id, MATERIAL_CATALOG[0].id);
});

test('all catalog symbols draw', () => {
  const ctx = mockContext();
  for (const item of MATERIAL_CATALOG) {
    assert.doesNotThrow(() => drawMaterialSymbol(ctx, item.id, 0, 0, 40, 40, 2));
  }
});

test('material elements render in document', () => {
  const doc = createDocument(40, 30);
  doc.elements = [];
  for (const item of MATERIAL_CATALOG.slice(0, 5)) {
    const el = createElement('material', doc);
    el.symbol = item.id;
    el.x = 2; el.y = 2;
    doc.elements.push(el);
  }
  assert.doesNotThrow(() => renderDocument(mockContext(), doc, { width: 200, height: 150 }, 203, {}));
});

const MATERIAL_CHIPS = mats.MATERIAL_CHIPS;
const materialsForChip = mats.materialsForChip;

test('chips and filter helper', () => {
  assert.ok(Array.isArray(MATERIAL_CHIPS));
  assert.ok(MATERIAL_CHIPS.length >= 10);
  assert.ok(MATERIAL_CHIPS.includes('\u70ed\u95e8'));
  const hot = materialsForChip('\u70ed\u95e8');
  assert.ok(hot.length > 0);
  assert.ok(hot.every((item) => (item.tags && item.tags.includes('\u70ed\u95e8')) || item.category === '\u70ed\u95e8'));
  const q = materialsForChip('\u641c\u7d22', 'panda');
  assert.ok(q.some((item) => item.id === 'panda'));
  const cute = materialsForChip('\u53ef\u7231');
  assert.ok(cute.length > 0);
  const shangyue = materialsForChip('商跃');
  assert.equal(shangyue.length, SHANGYUE_MATERIAL_SYMBOL_IDS.length + SHANGYUE_SCENE_MATERIAL_SYMBOL_IDS.length);
  assert.ok(shangyue.every((item) => item.tags.includes('商跃')));
  assert.ok(shangyue.every((item) => item.source.startsWith('shangyue-vector-') && item.vector === true && item.raster === false));
});

test('material catalog has no VIP gate or searchable VIP tag', () => {
  assert.ok(MATERIAL_CATALOG.every((item) => item.vip == null));
  assert.ok(MATERIAL_CATALOG.every((item) => !(item.tags || []).includes('VIP')));
});

test('new decorative symbols draw', () => {
  const ctx = mockContext();
  for (const id of ['panda', 'cake', 'bracelet', 'lotus', 'gift', 'sparkle', 'diamond_ring']) {
    assert.doesNotThrow(() => drawMaterialSymbol(ctx, id, 0, 0, 40, 40, 2));
  }
});

test('Shangyue v2 material pack contains distinct resolution-independent vector drawings', () => {
  assert.equal(SHANGYUE_MATERIAL_SYMBOL_IDS.length, 76);
  const signatures = new Set();
  for (const id of SHANGYUE_MATERIAL_SYMBOL_IDS) {
    const context = recordingContext();
    assert.equal(drawShangyueMaterialSymbol(context, id, 0, 0, 48, 48, 2), true);
    signatures.add(context.trace.join('|'));
  }
  assert.equal(signatures.size, SHANGYUE_MATERIAL_SYMBOL_IDS.length);
  assert.equal(drawShangyueMaterialSymbol(recordingContext(), 'not-a-symbol', 0, 0, 48, 48, 2), false);
});

test('Shangyue scenario pack covers searchable daily label-printing scenes', () => {
  assert.equal(SHANGYUE_SCENE_MATERIAL_SYMBOL_IDS.length, 30);
  assert.equal(new Set(SHANGYUE_SCENE_MATERIAL_SYMBOL_IDS).size, 30);
  assert.deepEqual(
    new Set(SHANGYUE_SCENE_MATERIALS.map((item) => item.category)),
    new Set(['零售', '仓储', '效期', '服饰', '设备', '办公'])
  );
  assert.ok(SHANGYUE_SCENE_MATERIALS.every((item) => /[\u3400-\u9fff]/u.test(item.label)));
  assert.ok(SHANGYUE_SCENE_MATERIALS.every((item) => item.tags.includes(item.category) && item.tags.includes('商跃')));

  const searches = new Map([
    ['促销', 'price_drop'],
    ['库位', 'warehouse_rack'],
    ['保质期', 'hourglass'],
    ['珠宝', 'ring_size'],
    ['线缆', 'cable_coil'],
    ['姓名贴', 'school_book']
  ]);
  for (const [query, expectedId] of searches) {
    assert.ok(materialsForChip('搜索', query).some((item) => item.id === expectedId), `${query} should find ${expectedId}`);
  }
  for (const category of ['零售', '仓储', '效期', '服饰', '设备', '办公']) {
    assert.ok(MATERIAL_CHIPS.includes(category));
    assert.ok(materialsForChip(category).length >= 5);
  }
});

test('Shangyue scenario materials are thirty distinct scalable vector drawings', () => {
  const signatures = new Set();
  for (const id of SHANGYUE_SCENE_MATERIAL_SYMBOL_IDS) {
    const context = recordingContext();
    assert.equal(drawShangyueSceneMaterialSymbol(context, id, 0, 0, 48, 48, 2), true);
    assert.ok(context.trace.length >= 6, `${id} should draw meaningful geometry`);
    signatures.add(context.trace.join('|'));
  }
  assert.equal(signatures.size, SHANGYUE_SCENE_MATERIAL_SYMBOL_IDS.length);
  assert.equal(drawShangyueSceneMaterialSymbol(recordingContext(), 'not-a-scene-symbol', 0, 0, 48, 48, 2), false);
});
