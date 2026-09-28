/**
 * Curated Shangyue template library: hand-designed layout recipes × common
 * paper sizes × fictional sample content. Documents are built on demand so
 * the package carries recipes, not hundreds of generated JSON documents.
 */
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

// [recipe, sizes, content indexes, blurb]; the mix follows how often each
// scene appears in the market catalogue (price tags first, then dates, ...).
const PLAN = [
  ['priceStandard', [[70, 38], [60, 40], [60, 30], [50, 30]], [0, 1, 2], '明码标价格式：品名、产地、规格、等级 + 零售价'],
  ['priceSimple', [[40, 30], [50, 30], [60, 40], [40, 20], [30, 20], [50, 25], [40, 15]], [0, 4, 5], '品名、规格产地与售价，40×30 起带商品条码'],
  ['pricePromo', [[40, 30], [50, 30], [60, 40], [70, 38]], [1, 2], '限时特价：划线原价 + 促销价 + 活动截止日'],
  ['priceMember', [[50, 30], [60, 40], [40, 30]], [0, 3], '零售价与会员价并列，会员价反白突出'],
  ['priceWeighed', [[40, 30], [50, 30], [60, 40]], [0, 1, 2], '散称或按个计价：单价、计价单位、产地与保质'],
  ['priceBarcode', [[40, 30], [50, 30], [60, 40], [50, 25]], [0, 3], '品名规格 + 售价 + EAN-13 商品条码'],
  ['pricePharmacy', [[70, 38], [60, 40], [50, 30]], [0, 1, 2], '药品标价签：规格、剂型、生产企业、医保类别'],
  ['priceTobacco', [[50, 30], [60, 40], [70, 38]], [0, 1], '卷烟价签：单盒价、整条价、类型与焦油量'],
  ['priceTea', [[50, 30], [60, 40]], [0, 1], '茶叶价签：品名、等级、产地与按斤计价'],
  ['priceJewelry', [[40, 20], [50, 30]], [0, 1], '珠宝标签：材质、克重、编号与售价'],
  ['dateShelf', [[40, 30], [50, 30], [60, 40], [40, 20], [30, 20]], [0, 1], '生产日期与保质期至，打印时按保质期自动计算'],
  ['dateOpened', [[40, 30], [50, 30], [40, 20]], [0, 1], '开封时间与用完期限，精确到分钟'],
  ['prepLabel', [[40, 30], [50, 30], [60, 40]], [0, 1], '后厨备料或解冻：制作、到期、储存与操作人'],
  ['sampleRetention', [[50, 30], [60, 40], [70, 50]], [0, 1], '食品留样：餐次、菜品、留样 48 小时后可销毁'],
  ['frozenLabel', [[40, 30], [50, 30]], [0], '冷冻入库：入库日期、保质期、存放位置与批号'],
  ['cupSticker', [[40, 30], [50, 30]], [0, 1, 2], '饮品杯贴：取餐号自动递增，规格甜度温度一行看清'],
  ['takeoutSeal', [[50, 30], [60, 40]], [0, 1], '外卖封签：店名、取餐号、备注与封口提示'],
  ['flavorSticker', [[30, 20], [40, 20], [30, 15]], [0, 1], '口味贴：口味大字 + 一行说明'],
  ['materialCard', [[70, 50], [80, 50], [60, 40], [50, 30]], [0, 1], '物料标识卡：编码、规格、数量、批次、供应商与状态'],
  ['binLocation', [[40, 30], [50, 30], [60, 40], [40, 20]], [0, 1], '库位标签：大号库位号 + 区排层 + 库位条码'],
  ['cartonLabel', [[70, 50], [80, 50], [60, 40]], [0, 1], '箱唛：装箱数、批次、目的仓，箱号自动递增'],
  ['parcelLabel', [[70, 50], [80, 50], [60, 40]], [0, 1], '收件信息：收件人、电话、地址与订单条码'],
  ['pickupCode', [[50, 30], [40, 30]], [0], '取件码：大号取件码 + 货架位置 + 到店日期'],
  ['assetTag', [[50, 30], [60, 40], [40, 20]], [0, 1, 2], '固定资产：编号自动递增，盘点二维码跟随编号'],
  ['deviceTag', [[60, 40], [70, 50], [50, 30]], [0, 1], '设备标识：型号、编号、保养周期与下次保养日期'],
  ['fileBox', [[60, 40], [70, 50], [50, 30]], [0, 1], '档案盒：案卷名称、编号、部门与保管期限'],
  ['folderTab', [[50, 15], [40, 15]], [0, 1], '文件夹标签条：名称 + 编号'],
  ['storageTag', [[30, 15], [40, 20], [30, 20]], [0, 1], '收纳分类：大字名称 + 一行说明'],
  ['staffBadge', [[70, 40], [60, 40], [70, 50], [50, 30]], [0, 1], '员工名牌：公司、姓名、部门职务与工号'],
  ['nameSticker', [[40, 20], [30, 15], [50, 25], [40, 30]], [0, 1], '学生姓名贴：姓名大字 + 班级学号'],
  ['visitorPass', [[60, 40], [70, 50]], [0], '访客证：编号自动递增，有效时间精确到分钟'],
  ['statusTag', [[40, 30], [50, 30]], [0, 1, 2, 3], '状态标识：合格、待检、不合格、暂停使用'],
  ['qcCertificate', [[40, 30], [50, 30], [40, 20]], [0, 1], '合格证：产品、型号、检验员、批号与检验日期'],
  ['machineStatus', [[60, 40], [70, 50]], [0, 1], '设备状态牌：运行 / 停机 / 维修勾选与责任人'],
  ['safetySign', [[50, 30], [60, 40]], [0, 1, 2], '温馨提示：大字提示 + 一行说明'],
  ['cableFlag', [[40, 12], [50, 15], [30, 15]], [0, 1], '线缆标识：编号 + 起止位置'],
  ['circuitLabel', [[40, 15], [50, 20]], [0, 1], '配电回路：回路编号、用途与额定电流'],
  ['networkTag', [[50, 30]], [0, 1], '网络设备：名称、IP、位置与管理员'],
  ['labSample', [[40, 30], [50, 30], [40, 20], [30, 20]], [0, 1], '样品标签：编号自动递增，条码或二维码跟随编号'],
  ['reagentLabel', [[40, 30]], [0, 1], '试剂标签：浓度、配制与有效期、配制人'],
  ['medicationGuide', [[60, 40], [50, 30], [40, 30]], [0, 1], '服药提醒：用法用量、早中晚勾选与饭前饭后'],
  ['sterilePack', [[50, 30], [40, 30]], [0, 1], '灭菌包：灭菌与失效日期、锅号批次与操作人'],
  ['bedCard', [[60, 40], [70, 50]], [0, 1], '床头卡：床号大字、护理级别、饮食与过敏提示'],
  ['garmentTag', [[40, 60], [50, 80], [40, 30], [50, 30]], [0, 1], '服装吊牌：货号、成分、执行标准、安全类别与条码'],
  ['greetingCard', [[40, 30], [70, 50]], [0, 1, 2, 3], '祝福卡：大字祝福 + 一句话 + 落款'],
  ['giftTag', [[40, 30]], [0, 1], '礼品标签：To / From 与一句祝福'],
  ['wifiCard', [[40, 30], [50, 30], [60, 40], [50, 50]], [0], 'Wi-Fi 卡：扫码连接，附网络名与密码'],
  ['pantryJar', [[40, 30], [30, 20]], [0, 1, 2], '收纳罐：名称大字、装罐日期与保存提示']
];

function pad(value, length) {
  return String(value).padStart(length, '0');
}

function itemName(item) {
  return item.name || item.dish || item.flavor || item.shop || item.title || item.product || item.drug || item.pack
    || (item.bed ? `${item.bed} 床` : '') || item.code || item.status || item.to || item.ssid || item.label || '';
}

const CURATED_INDEX = [];
PLAN.forEach(([recipeKey, paperSizes, indexes, blurb]) => {
  const recipe = RECIPES[recipeKey];
  if (!recipe) throw new Error(`unknown recipe ${recipeKey}`);
  paperSizes.forEach(([widthMm, heightMm]) => {
    indexes.forEach((index) => {
      const item = CONTENT[recipe.content][index];
      if (!item) throw new Error(`missing ${recipe.content}[${index}]`);
      CURATED_INDEX.push({
        id: `sy-tpl-${recipeKey}-${widthMm}x${heightMm}-${pad(index, 2)}`,
        recipe: recipeKey,
        widthMm,
        heightMm,
        index,
        scene: recipe.scene,
        category: recipe.category,
        name: `${recipe.scene} · ${itemName(item)}`,
        blurb
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
  recipe.build(doc, entry.widthMm, entry.heightMm, CONTENT[recipe.content][entry.index]);
  doc.name = entry.name;
  doc.templateMeta = {
    origin: 'shangyue-original',
    authorship: 'shangyue-curated',
    library: 'shangyue-curated',
    libraryId: entry.id,
    recipe: entry.recipe,
    scene: entry.scene,
    copyright: '© 2026 商跃',
    thirdPartyAssets: false,
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    releaseApproved: true,
    batchCompatible: false,
    designSystem: 'sy-curated-v1',
    designVersion: '1.0.0',
    createdAt: '2026-09-28'
  };
  return doc;
}

function buildCuratedDocument(id) {
  const entry = getCuratedEntry(id);
  return entry ? buildEntryDocument(entry) : null;
}

// Templates offered for CSV / batch data. Their name, price and code fields
// carry bindField tags, so each row fills exactly those elements.
const BATCH_PICKS = [
  ['sy-tpl-priceSimple-40x30-00', '商品价签 40×30 · 品名 / 价格 / 条码'],
  ['sy-tpl-priceSimple-50x30-00', '商品价签 50×30 · 品名 / 价格 / 条码'],
  ['sy-tpl-priceBarcode-50x25-00', '条码价签 50×25 · 品名 / 价格 / 条码'],
  ['sy-tpl-priceStandard-70x38-00', '明码标价签 70×38 · 品名 / 价格'],
  ['sy-tpl-priceStandard-60x40-00', '明码标价签 60×40 · 品名 / 价格'],
  ['sy-tpl-pricePromo-50x30-01', '促销价签 50×30 · 品名 / 价格'],
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
  const elements = buildEntryDocument(entry).elements;
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
