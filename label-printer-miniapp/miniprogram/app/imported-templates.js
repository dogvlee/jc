/**
 * Pre-converted NIIM research templates (offline, no CDN).
 * Raw JSON is copied into the Mini Program package; converter is pure.
 */
const { importNiimTemplate } = require('../core/niim-template-import');
const productJson = require('../data/niim-templates/product.json');
const medicineJson = require('../data/niim-templates/medicine-price.json');
const stateGridJson = require('../data/niim-templates/state-grid.json');
const c1Json = require('../data/niim-templates/c1-default.json');

function pack(id, name, size, industry, category, kind, badge, blurb, accent, json, uses) {
  const { document, meta } = importNiimTemplate(json);
  document.widthMm = size[0];
  document.heightMm = size[1];
  document.name = name;
  const sx = size[0] / Math.max(1, meta.width);
  const sy = size[1] / Math.max(1, meta.height);
  if (Math.abs(sx - 1) > 0.01 || Math.abs(sy - 1) > 0.01) {
    for (const el of document.elements) {
      el.x *= sx;
      el.y *= sy;
      el.width *= sx;
      el.height *= sy;
      if (el.fontSize) el.fontSize = Math.max(1.6, el.fontSize * Math.min(sx, sy));
    }
  }
  for (const el of document.elements) {
    el.width = Math.max(0.5, Math.min(el.width, size[0]));
    el.height = Math.max(0.5, Math.min(el.height, size[1]));
    el.x = Math.max(0, Math.min(el.x, size[0] - el.width));
    el.y = Math.max(0, Math.min(el.y, size[1] - el.height));
  }
  return {
    id,
    name,
    category,
    industry,
    size,
    kind,
    uses: uses || 90,
    badge,
    blurb,
    accent,
    document,
    source: 'niim-import',
    sourceMeta: meta
  };
}

const IMPORTED_TEMPLATES = [
  pack(
    'niim-product-r40x94',
    '商品标签 94×40',
    [94, 40],
    '行业标识',
    '零售',
    'barcode',
    '官方',
    'NIIM 商品模板：品名/克重/零售价/条码/产地',
    '#E85D4C',
    productJson,
    412
  ),
  pack(
    'niim-medicine-price',
    '医药价签 50×30',
    [50, 30],
    '行业标识',
    '零售',
    'accent',
    '官方',
    'NIIM 医药价签：药名/单位/产地/规格/售价',
    '#C1121F',
    medicineJson,
    268
  ),
  pack(
    'niim-state-grid',
    '国网电力 85×50',
    [85, 50],
    '行业标识',
    '行业',
    'qr',
    '官方',
    'NIIM 国家电网：台区信息 + 表号条码 + 95598',
    '#0077B6',
    stateGridJson,
    134
  ),
  pack(
    'niim-c1-default',
    'C1 默认空白',
    [30, 6],
    '实用功能',
    '办公',
    'accent',
    null,
    'C1 机型默认壳模板（短标签）',
    '#6C757D',
    c1Json,
    55
  )
];

function getImportedTemplate(id) {
  return IMPORTED_TEMPLATES.find((item) => item.id === id) || null;
}

function buildImportedDocument(id) {
  const item = getImportedTemplate(id);
  if (!item) return null;
  return JSON.parse(JSON.stringify(item.document));
}

module.exports = {
  IMPORTED_TEMPLATES,
  getImportedTemplate,
  buildImportedDocument
};
