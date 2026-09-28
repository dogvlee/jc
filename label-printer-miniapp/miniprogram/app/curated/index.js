/**
 * Curated Shangyue template library: hand-designed layout recipes × common
 * paper sizes × fictional sample content. Documents are built on demand so
 * the package carries recipes, not hundreds of generated JSON documents.
 */
const { cloneDocument } = require('../../core/document');
const { newDocument } = require('./layout');

const DOMAINS = [
  require('./recipes/retail'),
  require('./recipes/food'),
  require('./recipes/warehouse'),
  require('./recipes/office'),
  require('./recipes/industry'),
  require('./recipes/care')
];

const RECIPES = {};
const CONTENT = {};
DOMAINS.forEach((domain) => {
  [[RECIPES, domain.RECIPES], [CONTENT, domain.CONTENT]].forEach(([target, source]) => {
    Object.keys(source).forEach((key) => {
      if (target[key]) throw new Error(`duplicate curated key ${key}`);
      target[key] = source[key];
    });
  });
});

// [recipe, paper sizes, samples]. Every size gets each of the recipe's styles
// (or only those listed third, e.g. [50, 30, [0, 1]]), so no two templates
// share a layout, and the samples rotate across styles and sizes. The mix
// follows how often each scene appears in the market catalogue.
const PLAN = [
  ['priceStandard', [[70, 38], [60, 40], [60, 30], [50, 30, [0, 1]]], [0, 1, 2]],
  ['priceSimple', [[40, 30], [50, 30], [60, 40], [50, 40], [50, 25, [0, 1]], [40, 20, [0, 1]], [30, 20, [0, 1]], [40, 15, [0, 1]]], [0, 4, 5]],
  ['pricePromo', [[40, 30], [50, 30], [60, 40], [70, 38]], [1, 2]],
  ['priceMember', [[50, 30], [60, 40], [40, 30]], [0, 3]],
  ['priceWeighed', [[40, 30], [50, 30], [60, 40], [50, 40]], [0, 1, 2]],
  ['priceBarcode', [[40, 30], [50, 30], [60, 40], [50, 25]], [0, 3]],
  ['pricePharmacy', [[70, 38], [60, 40], [50, 30], [60, 30]], [0, 1, 2]],
  ['priceTobacco', [[50, 30], [60, 40], [70, 38]], [0, 1]],
  ['priceTea', [[50, 30], [60, 40]], [0, 1]],
  ['priceJewelry', [[40, 20], [50, 30]], [0, 1]],
  ['dateShelf', [[40, 30], [50, 30], [60, 40], [40, 20], [30, 20]], [0, 1, 2, 3]],
  ['dateOpened', [[40, 30], [50, 30], [40, 20]], [0, 1, 2]],
  ['prepLabel', [[40, 30], [50, 30], [60, 40]], [0, 1]],
  ['sampleRetention', [[50, 30], [60, 40], [70, 50]], [0, 1]],
  ['frozenLabel', [[40, 30], [50, 30]], [0, 1]],
  ['cupSticker', [[40, 30], [50, 30]], [0, 1, 2]],
  ['takeoutSeal', [[50, 30], [60, 40]], [0, 1]],
  ['flavorSticker', [[30, 20], [40, 20], [30, 15]], [0, 1, 2]],
  ['materialCard', [[70, 50], [80, 50], [60, 40], [50, 30]], [0, 1, 2]],
  ['binLocation', [[40, 30], [50, 30], [60, 40], [40, 20]], [0, 1, 2]],
  ['cartonLabel', [[70, 50], [80, 50], [60, 40]], [0, 1]],
  ['parcelLabel', [[70, 50], [80, 50], [60, 40]], [0, 1]],
  ['pickupCode', [[50, 30], [40, 30]], [0, 1]],
  ['assetTag', [[50, 30], [60, 40], [40, 20], [40, 30]], [0, 1, 2]],
  ['deviceTag', [[60, 40], [70, 50], [50, 30]], [0, 1]],
  ['fileBox', [[60, 40], [70, 50], [50, 30]], [0, 1]],
  ['folderTab', [[50, 15], [40, 15]], [0, 1, 2]],
  ['storageTag', [[30, 15], [40, 20], [30, 20]], [0, 1, 2, 3]],
  ['staffBadge', [[70, 40], [60, 40], [70, 50], [50, 30]], [0, 1]],
  ['nameSticker', [[40, 20], [30, 15], [50, 25], [40, 30]], [0, 1]],
  ['visitorPass', [[60, 40], [70, 50]], [0, 1]],
  ['statusTag', [[40, 30], [50, 30], [60, 40], [70, 50]], [0, 1, 2, 3]],
  ['qcCertificate', [[40, 30], [50, 30], [40, 20]], [0, 1]],
  ['machineStatus', [[60, 40], [70, 50]], [0, 1]],
  ['safetySign', [[50, 30], [60, 40], [70, 50]], [0, 1, 2]],
  ['cableFlag', [[40, 12], [50, 15], [30, 15, [0]]], [0, 1]],
  ['circuitLabel', [[40, 15], [50, 20]], [0, 1]],
  ['networkTag', [[50, 30], [60, 40]], [0, 1]],
  ['labSample', [[40, 30], [50, 30], [40, 20], [30, 20, [0]]], [0, 1]],
  ['reagentLabel', [[40, 30], [50, 30]], [0, 1]],
  ['medicationGuide', [[60, 40], [50, 30], [40, 30]], [0, 1]],
  ['sterilePack', [[50, 30], [40, 30]], [0, 1]],
  ['bedCard', [[60, 40], [70, 50]], [0, 1]],
  ['garmentTag', [[40, 60], [50, 80], [40, 30], [50, 30]], [0, 1]],
  ['greetingCard', [[40, 30], [50, 30], [70, 50]], [0, 1, 2, 3]],
  ['giftTag', [[40, 30], [50, 30]], [0, 1]],
  ['wifiCard', [[40, 30], [50, 30], [60, 40], [50, 50]], [0]],
  ['pantryJar', [[40, 30], [30, 20, [0]], [50, 30]], [0, 1, 2]]
];

function pad(value, length) {
  return String(value).padStart(length, '0');
}

function itemName(item) {
  return item.name || item.dish || item.flavor || item.shop || item.title || item.product || item.drug || item.pack
    || (item.bed ? `${item.bed} 床` : '') || item.code || item.status || item.to || item.ssid || item.label || '';
}

const CURATED_INDEX = [];
PLAN.forEach(([recipeKey, paperSizes, samples]) => {
  const recipe = RECIPES[recipeKey];
  if (!recipe) throw new Error(`unknown recipe ${recipeKey}`);
  if (recipe.styles.length !== recipe.blurbs.length) throw new Error(`${recipeKey}: one blurb per style`);
  paperSizes.forEach(([widthMm, heightMm, only], sizeIndex) => {
    (only || recipe.styles.map((build, style) => style)).forEach((style) => {
      const index = samples[(style + sizeIndex) % samples.length];
      const item = CONTENT[recipe.content][index];
      if (!item) throw new Error(`missing ${recipe.content}[${index}]`);
      if (!recipe.styles[style]) throw new Error(`${recipeKey} has no style ${style}`);
      CURATED_INDEX.push({
        id: `sy-tpl-${recipeKey}-${widthMm}x${heightMm}-${pad(style, 2)}`,
        recipe: recipeKey,
        style,
        widthMm,
        heightMm,
        index,
        scene: recipe.scene,
        category: recipe.category,
        name: `${recipe.scene} · ${itemName(item)}`,
        blurb: recipe.blurbs[style]
      });
    });
  });
});

// Browse order: one template from each recipe in turn, so the first page
// already spans price tags, dates, storage, office and so on.
(function interleaveByRecipe() {
  const queues = new Map();
  CURATED_INDEX.forEach((entry) => {
    if (!queues.has(entry.recipe)) queues.set(entry.recipe, []);
    queues.get(entry.recipe).push(entry);
  });
  const ordered = [];
  while (ordered.length < CURATED_INDEX.length) {
    queues.forEach((queue) => {
      if (queue.length) ordered.push(queue.shift());
    });
  }
  CURATED_INDEX.splice(0, CURATED_INDEX.length, ...ordered);
}());

const byId = new Map(CURATED_INDEX.map((entry) => [entry.id, entry]));

function getCuratedEntry(id) {
  return byId.get(id) || null;
}

function buildEntryDocument(entry) {
  const recipe = RECIPES[entry.recipe];
  const doc = newDocument(entry.widthMm, entry.heightMm);
  recipe.styles[entry.style](doc, entry.widthMm, entry.heightMm, CONTENT[recipe.content][entry.index]);
  doc.name = entry.name;
  doc.templateMeta = {
    origin: 'shangyue-original',
    authorship: 'shangyue-curated',
    library: 'shangyue-curated',
    libraryId: entry.id,
    recipe: entry.recipe,
    style: entry.style,
    scene: entry.scene,
    copyright: '© 2026 商跃',
    thirdPartyAssets: false,
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false,
    designSystem: 'sy-curated-v1',
    designVersion: '1.1.0',
    createdAt: '2026-09-28'
  };
  return doc;
}

// Recipes are deterministic, so each template is laid out once per session;
// callers get their own copy to edit, fill with batch rows or preview.
const builtDocuments = new Map();

function builtDocument(entry) {
  if (!builtDocuments.has(entry.id)) builtDocuments.set(entry.id, buildEntryDocument(entry));
  return builtDocuments.get(entry.id);
}

function buildCuratedDocument(id) {
  const entry = getCuratedEntry(id);
  return entry ? cloneDocument(builtDocument(entry)) : null;
}

// Templates offered for CSV / batch data. Their name, price and code fields
// carry bindField tags, so each row fills exactly those elements.
const BATCH_PICKS = [
  ['sy-tpl-priceSimple-40x30-00', '商品价签 40×30 · 品名 / 价格 / 条码'],
  ['sy-tpl-priceSimple-50x30-00', '商品价签 50×30 · 品名 / 价格 / 条码'],
  ['sy-tpl-priceBarcode-50x25-00', '条码价签 50×25 · 品名 / 价格 / 条码'],
  ['sy-tpl-priceStandard-70x38-00', '明码标价签 70×38 · 品名 / 价格'],
  ['sy-tpl-priceStandard-60x40-00', '明码标价签 60×40 · 品名 / 价格'],
  ['sy-tpl-pricePromo-50x30-00', '促销价签 50×30 · 品名 / 价格'],
  ['sy-tpl-priceWeighed-50x30-00', '散称价签 50×30 · 品名 / 价格'],
  ['sy-tpl-dateShelf-40x30-00', '效期标签 40×30 · 品名（日期自动）'],
  ['sy-tpl-binLocation-40x30-00', '库位标签 40×30 · 编码 / 条码'],
  ['sy-tpl-nameSticker-40x20-00', '姓名贴 40×20 · 姓名'],
  ['sy-tpl-storageTag-40x20-00', '收纳分类 40×20 · 名称'],
  ['sy-tpl-cableFlag-40x12-00', '线缆标识 40×12 · 编号']
];

function curatedBatchTemplates() {
  return BATCH_PICKS.filter(([id]) => byId.has(id)).map(([id, name]) => ({ id, name }));
}

function buildCuratedBatchDocument(id) {
  if (!BATCH_PICKS.some((pick) => pick[0] === id)) return null;
  const document = buildCuratedDocument(id);
  if (document) document.templateMeta.batchCompatible = true;
  return document;
}

function kindOf(entry) {
  const elements = builtDocument(entry).elements;
  if (elements.some((element) => element.type === 'qrcode')) return 'qr';
  if (elements.some((element) => element.type === 'barcode')) return 'barcode';
  return 'accent';
}

function catalogMeta(entry) {
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    industry: '行业模板',
    size: [entry.widthMm, entry.heightMm],
    kind: kindOf(entry),
    uses: 0,
    scene: entry.scene,
    sceneLabel: entry.scene,
    badge: '原创',
    blurb: entry.blurb,
    origin: 'shangyue-original',
    source: 'shangyue-curated',
    copyright: '© 2026 商跃',
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false,
    designSystem: 'sy-curated-v1',
    libraryId: entry.id
  };
}

function matches(entry, options) {
  const category = String(options.category || '').trim();
  const scene = String(options.sceneLabel || options.scene || '').trim();
  const size = String(options.size || '').trim();
  const query = String(options.query || '').trim().toLowerCase();
  if (category && category !== '全部' && entry.category !== category) return false;
  if (scene && scene !== '全部' && entry.scene !== scene) return false;
  if (size && size !== '全部' && `${entry.widthMm}×${entry.heightMm}` !== size) return false;
  if (!query) return true;
  return [entry.name, entry.scene, entry.category, entry.blurb, `${entry.widthMm}×${entry.heightMm}`]
    .some((value) => String(value || '').toLowerCase().includes(query));
}

function queryCuratedMeta(options) {
  const opts = options || {};
  const offset = Math.max(0, Number(opts.offset) || 0);
  const limit = Math.max(1, Number(opts.limit) || 24);
  const matched = CURATED_INDEX.filter((entry) => matches(entry, opts));
  return { total: matched.length, offset, limit, items: matched.slice(offset, offset + limit).map(catalogMeta) };
}

function chipsBy(keyOf) {
  const counts = new Map();
  CURATED_INDEX.forEach((entry) => counts.set(keyOf(entry), (counts.get(keyOf(entry)) || 0) + 1));
  return ['全部'].concat([...counts.entries()].sort((left, right) => right[1] - left[1]).map((item) => item[0]));
}

function curatedCategoryChips() {
  return chipsBy((entry) => entry.category);
}

function curatedSceneChips() {
  return chipsBy((entry) => entry.scene);
}

function curatedSizeChips() {
  return chipsBy((entry) => `${entry.widthMm}×${entry.heightMm}`);
}

function curatedStats() {
  const scenes = {};
  const sizes = new Set();
  CURATED_INDEX.forEach((entry) => {
    scenes[entry.scene] = (scenes[entry.scene] || 0) + 1;
    sizes.add(`${entry.widthMm}x${entry.heightMm}`);
  });
  return { total: CURATED_INDEX.length, scenes, sizeCount: sizes.size, recipes: Object.keys(RECIPES).length };
}

module.exports = {
  CURATED_INDEX,
  buildCuratedBatchDocument,
  buildCuratedDocument,
  catalogMeta,
  curatedBatchTemplates,
  curatedCategoryChips,
  curatedSceneChips,
  curatedSizeChips,
  curatedStats,
  getCuratedEntry,
  queryCuratedMeta
};
