/**
 * Template catalog metadata for the offline industry template experience.
 * Icons/colors mirror the original app center IA (行业 / 内容 / 实用),
 * without remote VIP assets or login gates.
 */
const { IMPORTED_TEMPLATES } = require('./imported-templates');
const { ONLINE_TEMPLATES } = require('./online-templates-pack');

const baseTemplates = [
  {
    id: 'product-simple',
    name: '商品价格标签',
    category: '零售',
    industry: '行业标识',
    size: [40, 30],
    kind: 'barcode',
    uses: 328,
    badge: null,
    blurb: '品名 + 产地规格 + 售价/会员价 + EAN-13',
    accent: '#E85D4C'
  },
  {
    id: 'promo-price',
    name: '促销价签',
    category: '零售',
    industry: '内容设计',
    size: [50, 30],
    kind: 'barcode',
    uses: 256,
    badge: '热门',
    blurb: '特价角标 + 原价划线 + 配料说明 + 条码',
    accent: '#F04A3E'
  },
  {
    id: 'jewelry-price',
    name: '珠宝价格标签',
    category: '零售',
    industry: '内容设计',
    size: [40, 30],
    kind: 'barcode',
    uses: 118,
    badge: null,
    blurb: '品牌标题 + 材质重量编号 + 价格 + Code128',
    accent: '#8B6B4A'
  },
  {
    id: 'clothing-tag',
    name: '服装款式吊牌',
    category: '零售',
    industry: '内容设计',
    size: [40, 30],
    kind: 'barcode',
    uses: 142,
    badge: '新品',
    blurb: '款式名 + 规格 + 图案 + 效期 + 条码',
    accent: '#6B5B95'
  },
  {
    id: 'storage-code',
    name: '仓储货架标签',
    category: '仓储',
    industry: '行业标识',
    size: [50, 30],
    kind: 'qr',
    uses: 241,
    badge: null,
    blurb: '库位码 + SKU 批次 + 扫码入库二维码',
    accent: '#2F6FED'
  },
  {
    id: 'shipping-bin',
    name: '物流周转箱标签',
    category: '仓储',
    industry: '行业标识',
    size: [50, 40],
    kind: 'qr',
    uses: 97,
    badge: null,
    blurb: '收件信息 + 运单条码 + 签收二维码',
    accent: '#1B8A5A'
  },
  {
    id: 'cable-name',
    name: '线缆分类标签',
    category: '办公',
    industry: '行业标识',
    size: [40, 12],
    kind: 'barcode',
    uses: 196,
    badge: null,
    blurb: '线缆型号 + 机柜位置 + 竖向条码',
    accent: '#0E7C86'
  },
  {
    id: 'serial-cable',
    name: '线号序列标签',
    category: '办公',
    industry: '行业标识',
    size: [30, 12],
    kind: 'barcode',
    uses: 88,
    badge: null,
    blurb: '自动递增序列号 + 位置说明',
    accent: '#0A6E78'
  },
  {
    id: 'asset-card',
    name: '固定资产标签',
    category: '办公',
    industry: '行业标识',
    size: [50, 30],
    kind: 'qr',
    uses: 174,
    badge: null,
    blurb: '资产信息 + 序列号 + 盘点二维码',
    accent: '#3D5A80'
  },
  {
    id: 'business-card',
    name: '商务名片',
    category: '办公',
    industry: '内容设计',
    size: [50, 30],
    kind: 'qr',
    uses: 210,
    badge: '常用',
    blurb: '姓名职位 + 联系方式 + 电子名片码',
    accent: '#1D3557'
  },
  {
    id: 'wifi-code',
    name: 'Wi-Fi 码标签',
    category: '办公',
    industry: '内容设计',
    size: [40, 30],
    kind: 'qr',
    uses: 165,
    badge: null,
    blurb: 'SSID/密码 + 标准 WIFI: 扫码连网',
    accent: '#457B9D'
  },
  {
    id: 'home-date',
    name: '食品日期标签',
    category: '生活',
    industry: '实用功能',
    size: [40, 30],
    kind: 'accent',
    uses: 188,
    badge: null,
    blurb: '制作/保质日期 + 存放提示（打印时自动更新）',
    accent: '#E09F3E'
  },
  {
    id: 'catering-date',
    name: '餐饮效期标签',
    category: '生活',
    industry: '行业标识',
    size: [40, 30],
    kind: 'accent',
    uses: 156,
    badge: '热门',
    blurb: '厨房效期 + 制作时间 + 责任人',
    accent: '#E76F51'
  },
  {
    id: 'medicine-box',
    name: '药品收纳标签',
    category: '生活',
    industry: '实用功能',
    size: [40, 20],
    kind: 'accent',
    uses: 129,
    badge: null,
    blurb: '药名规格用法 + 警示图标',
    accent: '#C1121F'
  },
  {
    id: 'state-grid',
    name: '国网电力标识',
    category: '行业',
    industry: '行业标识',
    size: [50, 30],
    kind: 'qr',
    uses: 76,
    badge: null,
    blurb: '计量箱信息 + 表号条码 + 95598 扫码',
    accent: '#0077B6'
  },
  {
    id: 'wedding-invite',
    name: '订婚婚礼席卡',
    category: '生活',
    industry: '内容设计',
    size: [50, 30],
    kind: 'accent',
    uses: 204,
    badge: '热门',
    blurb: '新人姓名 + 桌号 + 祝福语',
    accent: '#D4A5A5'
  },
  {
    id: 'bakery-tag',
    name: '烘焙店价签',
    category: '零售',
    industry: '内容设计',
    size: [40, 30],
    kind: 'barcode',
    uses: 167,
    badge: '新品',
    blurb: '蛋糕名 + 口味规格 + 价格条码',
    accent: '#C97B63'
  },
  {
    id: 'fresh-cut',
    name: '省心净菜标签',
    category: '生活',
    industry: '实用功能',
    size: [40, 30],
    kind: 'accent',
    uses: 143,
    badge: null,
    blurb: '净菜品名 + 分量 + 保质效期',
    accent: '#2A9D8F'
  },
  {
    id: 'name-tag',
    name: '姓名贴',
    category: '生活',
    industry: '实用功能',
    size: [40, 20],
    kind: 'accent',
    uses: 289,
    badge: '常用',
    blurb: '姓名 + 班级/部门 + 联系电话',
    accent: '#4A6FA5'
  },
  {
    id: 'retail-shelf',
    name: '商品价签精简',
    category: '零售',
    industry: '行业标识',
    size: [50, 30],
    kind: 'barcode',
    uses: 301,
    badge: null,
    blurb: '货架价签：品名规格原价现价条码',
    accent: '#E63946'
  },
  {
    id: 'pharma-shelf',
    name: '医药价签精简',
    category: '零售',
    industry: '行业标识',
    size: [50, 30],
    kind: 'accent',
    uses: 188,
    badge: null,
    blurb: '药名规格厂家 + 零售价',
    accent: '#9B2226'
  },
  {
    id: 'warehouse-bin',
    name: '仓储料箱标签',
    category: '仓储',
    industry: '行业标识',
    size: [50, 30],
    kind: 'qr',
    uses: 112,
    badge: null,
    blurb: '料箱号 + 物料编码 + 库存二维码',
    accent: '#264653'
  },
  {
    id: 'express-waybill',
    name: '快递面单简签',
    category: '仓储',
    industry: '行业标识',
    size: [50, 40],
    kind: 'barcode',
    uses: 95,
    badge: null,
    blurb: '收寄件 + 运单号条码',
    accent: '#E9C46A'
  },
  {
    id: 'cable-pair',
    name: '线缆对线标签',
    category: '办公',
    industry: '行业标识',
    size: [40, 12],
    kind: 'barcode',
    uses: 77,
    badge: null,
    blurb: 'A/B 端线号 + 回路说明',
    accent: '#118AB2'
  },
  {
    id: 'expiry-batch',
    name: '效期批次标签',
    category: '生活',
    industry: '实用功能',
    size: [40, 30],
    kind: 'accent',
    uses: 151,
    badge: null,
    blurb: '批次号 + 生产/失效日期',
    accent: '#F4A261'
  },
  {
    id: 'promo-burst',
    name: '促销爆炸贴',
    category: '零售',
    industry: '内容设计',
    size: [40, 40],
    kind: 'accent',
    uses: 220,
    badge: '热门',
    blurb: '大字特价 + 折扣角标',
    accent: '#FF6B6B'
  },
  {
    id: 'jewelry-mini',
    name: '珠宝小吊牌',
    category: '零售',
    industry: '内容设计',
    size: [30, 20],
    kind: 'barcode',
    uses: 84,
    badge: null,
    blurb: '材质克重编号迷你签',
    accent: '#B08968'
  },
  {
    id: 'garment-care',
    name: '服装洗涤说明',
    category: '零售',
    industry: '内容设计',
    size: [40, 30],
    kind: 'accent',
    uses: 99,
    badge: null,
    blurb: '面料成分 + 洗涤图标文字',
    accent: '#6D6875'
  },
  {
    id: 'med-storage',
    name: '药品柜位标签',
    category: '生活',
    industry: '实用功能',
    size: [40, 20],
    kind: 'accent',
    uses: 71,
    badge: null,
    blurb: '柜位 + 药名 + 数量',
    accent: '#AE2012'
  },
  {
    id: 'office-desk',
    name: '工位姓名牌',
    category: '办公',
    industry: '内容设计',
    size: [50, 30],
    kind: 'qr',
    uses: 133,
    badge: null,
    blurb: '姓名部门 + 分机号 + 企业码',
    accent: '#1B4332'
  },
  {
    id: 'lab-sample',
    name: '实验室样品签',
    category: '行业',
    industry: '行业标识',
    size: [40, 20],
    kind: 'barcode',
    uses: 62,
    badge: null,
    blurb: '样品编号 + 日期 + 条码',
    accent: '#3A86FF'
  },
  {
    id: 'plant-care',
    name: '园艺植物标签',
    category: '生活',
    industry: '内容设计',
    size: [40, 30],
    kind: 'accent',
    uses: 108,
    badge: '新品',
    blurb: '植物名 + 浇水日照提示',
    accent: '#40916C'
  }
];

const importedMeta = IMPORTED_TEMPLATES.map((item) => ({
  id: item.id,
  name: item.name,
  category: item.category,
  industry: item.industry,
  size: item.size,
  kind: item.kind,
  uses: item.uses,
  badge: item.badge,
  blurb: item.blurb,
  accent: item.accent,
  source: item.source
}));

const onlineMeta = ONLINE_TEMPLATES.map((item) => ({
  id: item.id,
  name: item.name,
  category: item.category,
  industry: item.industry,
  size: item.size,
  kind: item.kind,
  uses: item.uses,
  badge: item.badge,
  blurb: item.blurb,
  accent: item.accent,
  source: item.source,
  thumbSrc: item.thumbSrc || ''
}));

const templates = baseTemplates.concat(importedMeta, onlineMeta);

const categories = ['全部', '零售', '仓储', '办公', '生活', '行业', '线上'];

const industries = ['全部', '行业标识', '内容设计', '实用功能', '行业模板'];

const homeQuickActions = [
  { id: 'industry', label: '行业模板', action: 'open-industry', icon: 'template', tone: 'red' },
  { id: 'card', label: '名片', action: 'preview-template', templateId: 'business-card', icon: 'user', tone: 'blue' },
  { id: 'clothing', label: '服装款式', action: 'preview-template', templateId: 'clothing-tag', icon: 'stamp', tone: 'orange' },
  { id: 'date', label: '效期标签', action: 'preview-template', templateId: 'home-date', icon: 'calendar', tone: 'yellow' }
];

function getTemplate(id) {
  return templates.find((item) => item.id === id) || null;
}

function templatesByCategory(category) {
  if (!category || category === '全部') return templates.slice();
  return templates.filter((item) => item.category === category);
}

function templatesByIndustry(industry) {
  if (!industry || industry === '全部') return templates.slice();
  return templates.filter((item) => item.industry === industry);
}

module.exports = {
  categories,
  industries,
  templates,
  homeQuickActions,
  getTemplate,
  templatesByCategory,
  templatesByIndustry
};
