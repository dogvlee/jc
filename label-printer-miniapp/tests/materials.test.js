const test = require('node:test');
const assert = require('node:assert/strict');
const mats = require('../miniprogram/core/materials');
const { createDocument, createElement } = require('../miniprogram/core/document');
const { renderDocument } = require('../miniprogram/core/renderer');
const MATERIAL_CATALOG = mats.MATERIAL_CATALOG;
const drawMaterialSymbol = mats.drawMaterialSymbol;
const materialById = mats.materialById;
const materialCategories = mats.materialCategories;

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
