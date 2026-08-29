const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  DEFAULT_MATERIAL_CHIP,
  MATERIAL_CATALOG,
  ORIGINAL_MATERIAL_CATALOG,
  ORIGINAL_MATERIAL_MANIFEST,
  applyMaterialToElement,
  materialChipAfterSearchToggle,
  materialsForChip
} = require('../src/core/materials');
const { createDocument, createElement } = require('../src/core/document');
const { renderDocument } = require('../src/core/renderer');
const { initialState } = require('../src/app/state');
const { renderModal } = require('../src/app/views');

const ROOT = path.resolve(__dirname, '..');
const RESEARCH_MANIFEST = require('../src/data/original-materials.json');
const EXPECTED_IDS = [
  'niim-9202', 'niim-9200', 'niim-9198', 'niim-9199', 'niim-9092',
  'niim-9089', 'niim-9085', 'niim-9077', 'niim-9078', 'niim-9079',
  'niim-9080', 'niim-9081', 'niim-9082', 'niim-9075', 'niim-9076'
];

function localAsset(item) {
  return path.join(ROOT, 'public', item.asset);
}

function imageFormat(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  return 'unknown';
}

function mockContext() {
  const drawImageCalls = [];
  const noop = () => {};
  return {
    canvas: {},
    drawImageCalls,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '10px sans-serif',
    textAlign: 'left',
    textBaseline: 'top',
    beginPath: noop,
    clearRect: noop,
    clip: noop,
    closePath: noop,
    fill: noop,
    fillRect: noop,
    fillText: noop,
    lineTo: noop,
    moveTo: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    arc: noop,
    rect: noop,
    restore: noop,
    rotate: noop,
    save: noop,
    scale: noop,
    setLineDash: noop,
    setTransform: noop,
    stroke: noop,
    strokeRect: noop,
    translate: noop,
    drawImage(...args) { drawImageCalls.push(args); },
    measureText: () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 })
  };
}

test('product material catalog no longer prefixes the 15 third-party bitmaps', () => {
  assert.equal(ORIGINAL_MATERIAL_MANIFEST.items.length, 0);
  assert.deepEqual(ORIGINAL_MATERIAL_CATALOG, []);
  assert.equal(MATERIAL_CATALOG.some((item) => String(item.id).startsWith('niim-')), false);
  assert.equal(materialsForChip('最新').some((item) => String(item.id).startsWith('niim-')), false);
});

test('reference assets default to latest and closing search returns to latest', () => {
  assert.equal(DEFAULT_MATERIAL_CHIP, '最新');
  assert.equal(initialState().materialChip, '最新');
  assert.equal(materialChipAfterSearchToggle(DEFAULT_MATERIAL_CHIP, true), '搜索');
  assert.equal(materialChipAfterSearchToggle('搜索', false), '最新');

  const html = renderModal({
    modal: 'material',
    document: { elements: [] },
    selectedId: '',
    materialQuery: '',
    materialSearchOpen: false
  });
  assert.match(html, /data-chip="最新"[^>]*aria-selected="true"/);
  assert.equal((html.match(/<img src="assets\/materials\/original\//g) || []).length, 0);
});

test('switching a selected material replaces path and clears its loaded image', () => {
  const element = { id: 'material-1', type: 'material', symbol: 'check' };
  const images = { [element.id]: { naturalWidth: 56, naturalHeight: 56 } };
  const next = MATERIAL_CATALOG.find((item) => item.id === 'star');
  assert.equal(applyMaterialToElement(element, next, images), true);
  assert.equal(element.symbol, 'star');
  assert.equal(images[element.id], undefined);
});

test('research-only third-party material files stay out of the product catalog', () => {
  assert.equal(RESEARCH_MANIFEST.items.length, 15);
  assert.deepEqual(RESEARCH_MANIFEST.items.map((item) => item.id), EXPECTED_IDS);
  for (const item of RESEARCH_MANIFEST.items) {
    const filename = localAsset(item);
    const bytes = fs.readFileSync(filename);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), item.sha256, item.id);
    assert.equal(imageFormat(bytes), item.format, item.id);
    assert.equal(path.extname(filename).toLowerCase(), item.format === 'jpeg' ? '.jpg' : '.png', item.id);
  }
});

test('latest material panel does not render third-party original bitmaps', () => {
  const html = renderModal({
    modal: 'material',
    document: { elements: [] },
    selectedId: '',
    materialChip: '最新',
    materialQuery: '',
    materialSearchOpen: false
  });
  assert.doesNotMatch(html, /assets\/materials\/original\//);
  assert.doesNotMatch(html, /授权待核/);
});

test('material raster is drawn when loaded and vector fallback remains available', () => {
  const documentValue = createDocument(40, 30);
  const raster = createElement('material', documentValue);
  raster.symbol = 'check';
  raster.path = 'assets/materials/original/9202.png';
  documentValue.elements = [raster];
  const rasterContext = mockContext();
  const image = { naturalWidth: 1240, naturalHeight: 1634, width: 1240, height: 1634 };
  renderDocument(rasterContext, documentValue, { width: 320, height: 240 }, 203, { [raster.id]: image });
  assert.equal(rasterContext.drawImageCalls.length, 1);
  assert.equal(rasterContext.drawImageCalls[0][0], image);

  const fallbackContext = mockContext();
  assert.doesNotThrow(() => renderDocument(
    fallbackContext,
    documentValue,
    { width: 320, height: 240 },
    203,
    {}
  ));
  assert.equal(fallbackContext.drawImageCalls.length, 0);
});
