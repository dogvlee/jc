/** Built-in monochrome materials for thermal labels (vector, 0..1 unit box). */
const {
  SHANGYUE_MATERIAL_SYMBOL_IDS,
  drawShangyueMaterialSymbol
} = require('./material-symbols-v2');

const SHANGYUE_MATERIAL_SYMBOL_SET = new Set(SHANGYUE_MATERIAL_SYMBOL_IDS);

const DEFAULT_MATERIAL_CHIP = '最新';
const ORIGINAL_MATERIAL_MANIFEST = { items: [] };
const ORIGINAL_MATERIAL_CATALOG = [];

const MATERIAL_CHIPS = [
  '最新', '商跃', '零售', '仓储', '效期', '服饰', '设备', '办公',
  '热门', '餐饮', '物流', '警示', '标记', '联系', '箭头',
  '可爱', '饰品', '祝福', '园艺', '形状'
];

/**
 * Shangyue-owned scenario materials designed specifically for small thermal
 * labels. They deliberately use business concepts instead of decorative
 * filler, so shopkeepers can search by the language used in daily work.
 */
const SHANGYUE_SCENE_MATERIALS = Object.freeze([
  { id: 'retail_shelf', label: '商品货架', category: '零售', tags: ['零售', '门店', '陈列', '商跃', '最新'] },
  { id: 'cash_register', label: '收银机', category: '零售', tags: ['零售', '门店', '收银', '商跃'] },
  { id: 'shopping_basket', label: '购物篮', category: '零售', tags: ['零售', '购物', '门店', '商跃'] },
  { id: 'price_drop', label: '降价促销', category: '零售', tags: ['零售', '促销', '特价', '降价', '商跃', '热门'] },
  { id: 'membership_card', label: '会员卡', category: '零售', tags: ['零售', '会员', '积分', '商跃'] },

  { id: 'warehouse_rack', label: '仓储货架', category: '仓储', tags: ['仓储', '货位', '库位', '仓库', '商跃', '最新'] },
  { id: 'pallet', label: '托盘', category: '仓储', tags: ['仓储', '托盘', '物流', '商跃'] },
  { id: 'forklift', label: '叉车', category: '仓储', tags: ['仓储', '叉车', '搬运', '物流', '商跃'] },
  { id: 'inventory_box', label: '库存箱', category: '仓储', tags: ['仓储', '库存', '盘点', '箱码', '商跃'] },
  { id: 'outbound', label: '出库', category: '仓储', tags: ['仓储', '出库', '发货', '物流', '商跃'] },

  { id: 'expiry_calendar', label: '有效期', category: '效期', tags: ['效期', '有效期', '到期', '日期', '商跃', '热门'] },
  { id: 'hourglass', label: '保质期', category: '效期', tags: ['效期', '保质期', '期限', '商跃'] },
  { id: 'first_in_first_out', label: '先进先出', category: '效期', tags: ['效期', '先进先出', 'FIFO', '轮转', '商跃'] },
  { id: 'cold_chain', label: '冷链保存', category: '效期', tags: ['效期', '冷链', '冷藏', '保鲜', '商跃'] },
  { id: 'batch_stamp', label: '批次章', category: '效期', tags: ['效期', '批次', '批号', '生产', '商跃'] },

  { id: 'tshirt', label: 'T恤', category: '服饰', tags: ['服饰', '服装', '尺码', '吊牌', '商跃', '最新'] },
  { id: 'dress', label: '连衣裙', category: '服饰', tags: ['服饰', '女装', '裙装', '商跃'] },
  { id: 'shoe', label: '鞋履', category: '服饰', tags: ['服饰', '鞋码', '鞋子', '商跃'] },
  { id: 'ring_size', label: '戒圈尺码', category: '服饰', tags: ['服饰', '饰品', '珠宝', '戒指', '尺码', '商跃'] },
  { id: 'jewelry_box', label: '首饰盒', category: '服饰', tags: ['服饰', '饰品', '珠宝', '首饰', '商跃'] },

  { id: 'cable_coil', label: '线缆盘', category: '设备', tags: ['设备', '线缆', '电线', '长度', '商跃', '热门'] },
  { id: 'plug', label: '电源插头', category: '设备', tags: ['设备', '电源', '插头', '线缆', '商跃'] },
  { id: 'network_port', label: '网络端口', category: '设备', tags: ['设备', '网口', '网络', '端口', '商跃'] },
  { id: 'device_serial', label: '设备铭牌', category: '设备', tags: ['设备', '铭牌', '序列号', '资产', '商跃'] },
  { id: 'grounding', label: '接地', category: '设备', tags: ['设备', '接地', '电气', '安全', '警示', '商跃'] },

  { id: 'file_box', label: '档案盒', category: '办公', tags: ['办公', '档案', '文件', '归档', '商跃'] },
  { id: 'medicine', label: '药品', category: '办公', tags: ['办公', '生活', '药品', '医药', '效期', '商跃'] },
  { id: 'kitchen_jar', label: '储物罐', category: '办公', tags: ['办公', '生活', '厨房', '收纳', '商跃'] },
  { id: 'school_book', label: '课本', category: '办公', tags: ['办公', '学习', '课本', '姓名贴', '商跃'] },
  { id: 'plant_pot', label: '盆栽', category: '办公', tags: ['办公', '生活', '园艺', '植物', '商跃'] }
]);

const SHANGYUE_SCENE_MATERIAL_SYMBOL_IDS = Object.freeze(
  SHANGYUE_SCENE_MATERIALS.map((item) => item.id)
);
const SHANGYUE_SCENE_MATERIAL_SYMBOL_SET = new Set(SHANGYUE_SCENE_MATERIAL_SYMBOL_IDS);

const MATERIAL_CATALOG = ORIGINAL_MATERIAL_CATALOG.concat([
  { id: 'check', label: '对勾', category: '标记', tags: ["标记", "热门", "最新"] },
  { id: 'cross', label: '叉号', category: '标记', tags: ["标记"] },
  { id: 'star', label: '星星', category: '标记', tags: ["标记", "可爱", "最新", "热门"] },
  { id: 'heart', label: '爱心', category: '标记', tags: ["可爱", "祝福", "最新", "热门"] },
  { id: 'warning', label: '警告', category: '警示', tags: ["警示", "热门"] },
  { id: 'info', label: '信息', category: '警示', tags: ["警示"] },
  { id: 'ban', label: '禁止', category: '警示', tags: ["警示"] },
  { id: 'fragile', label: '易碎', category: '物流', tags: ["物流"] },
  { id: 'keepdry', label: '防潮', category: '物流', tags: ["物流"] },
  { id: 'recycle', label: '回收', category: '物流', tags: ["物流", "园艺"] },
  { id: 'box', label: '纸箱', category: '物流', tags: ["物流", "热门"] },
  { id: 'scissors', label: '裁切', category: '物流', tags: ["物流"] },
  { id: 'arrow_up', label: '向上', category: '箭头', tags: ["箭头"] },
  { id: 'arrow_down', label: '向下', category: '箭头', tags: ["箭头"] },
  { id: 'arrow_left', label: '向左', category: '箭头', tags: ["箭头"] },
  { id: 'arrow_right', label: '向右', category: '箭头', tags: ["箭头", "热门"] },
  { id: 'phone', label: '电话', category: '联系', tags: ["联系", "热门"] },
  { id: 'location', label: '定位', category: '联系', tags: ["联系"] },
  { id: 'mail', label: '邮件', category: '联系', tags: ["联系"] },
  { id: 'wifi', label: '无线', category: '联系', tags: ["联系", "最新"] },
  { id: 'clock', label: '时钟', category: '通用', tags: ["最新", "热门"] },
  { id: 'fire', label: '热', category: '通用', tags: ["警示", "热门"] },
  { id: 'snow', label: '冷', category: '通用', tags: ["警示"] },
  { id: 'leaf', label: '叶子', category: '通用', tags: ["园艺", "最新"] },
  { id: 'chili', label: '辣', category: '餐饮', tags: ["餐饮", "热门"] },
  { id: 'cup', label: '杯子', category: '餐饮', tags: ["餐饮", "最新"] },
  { id: 'price', label: '价格', category: '零售', tags: ["零售", "热门"] },
  { id: 'percent', label: '折扣', category: '零售', tags: ["零售"] },
  { id: 'badge', label: '徽章', category: '零售', tags: ["零售", "最新"] },
  { id: 'smile', label: '笑脸', category: '表情', tags: ["可爱", "最新", "热门"] },
  { id: 'thumb', label: '点赞', category: '表情', tags: ["可爱", "热门"] },
  { id: 'circle', label: '圆', category: '形状', tags: ["形状"] },
  { id: 'circle_fill', label: '实心圆', category: '形状', tags: ["形状"] },
  { id: 'diamond', label: '菱形', category: '形状', tags: ["形状", "饰品"] },
  { id: 'hexagon', label: '六边', category: '形状', tags: ["形状"] },
  { id: 'square_round', label: '圆角方', category: '形状', tags: ["形状"] },
  { id: 'panda', label: '熊猫', category: '表情', tags: ["可爱", "最新", "热门"] },
  { id: 'cake', label: '蛋糕', category: '通用', tags: ["祝福", "可爱", "最新"] },
  { id: 'bracelet', label: '手链', category: '通用', tags: ["饰品", "最新"] },
  { id: 'pendant', label: '吊坠', category: '通用', tags: ["饰品", "祝福"] },
  { id: 'lotus', label: '莲花', category: '通用', tags: ["园艺", "祝福"] },
  { id: 'plum', label: '梅花', category: '通用', tags: ["园艺", "祝福", "最新"] },
  { id: 'bamboo', label: '竹子', category: '通用', tags: ["园艺"] },
  { id: 'orchid', label: '兰花', category: '通用', tags: ["园艺"] },
  { id: 'chrysanthemum', label: '菊花', category: '通用', tags: ["园艺", "祝福"] },
  { id: 'diamond_ring', label: '钻戒', category: '通用', tags: ["饰品", "祝福"] },
  { id: 'tulip', label: '郁金香', category: '通用', tags: ["园艺", "最新", "可爱"] },
  { id: 'rings', label: '对戒', category: '通用', tags: ["饰品", "祝福", "热门"] },
  { id: 'wave', label: '波浪', category: '形状', tags: ["形状", "最新"] },
  { id: 'sparkle', label: '闪光', category: '通用', tags: ["可爱", "最新", "热门", "饰品"] },
  { id: 'gift', label: '礼物', category: '通用', tags: ["祝福", "热门", "可爱"] },
  { id: 'cat', label: '猫咪', category: '表情', tags: ['可爱','最新','热门'] },
  { id: 'dog', label: '狗狗', category: '表情', tags: ['可爱','热门'] },
  { id: 'rabbit', label: '兔子', category: '表情', tags: ['可爱','最新'] },
  { id: 'bird', label: '小鸟', category: '表情', tags: ['可爱','园艺'] },
  { id: 'fish', label: '小鱼', category: '表情', tags: ['可爱'] },
  { id: 'butterfly', label: '蝴蝶', category: '表情', tags: ['可爱','园艺','最新'] },
  { id: 'bear', label: '小熊', category: '表情', tags: ['可爱','热门'] },
  { id: 'chick', label: '小鸡', category: '表情', tags: ['可爱','最新'] },
  { id: 'fox', label: '狐狸', category: '表情', tags: ['可爱'] },
  { id: 'apple', label: '苹果', category: '餐饮', tags: ['餐饮','最新'] },
  { id: 'bread', label: '面包', category: '餐饮', tags: ['餐饮'] },
  { id: 'coffee', label: '咖啡', category: '餐饮', tags: ['餐饮','热门'] },
  { id: 'ice_cream', label: '冰淇淋', category: '餐饮', tags: ['餐饮','可爱'] },
  { id: 'pizza', label: '披萨', category: '餐饮', tags: ['餐饮'] },
  { id: 'egg', label: '鸡蛋', category: '餐饮', tags: ['餐饮'] },
  { id: 'bowl', label: '碗', category: '餐饮', tags: ['餐饮'] },
  { id: 'chopsticks', label: '筷子', category: '餐饮', tags: ['餐饮'] },
  { id: 'strawberry', label: '草莓', category: '餐饮', tags: ['餐饮','可爱','最新'] },
  { id: 'balloon', label: '气球', category: '通用', tags: ['祝福','可爱','热门'] },
  { id: 'bells', label: '铃铛', category: '通用', tags: ['祝福','最新'] },
  { id: 'champagne', label: '香槟', category: '通用', tags: ['祝福'] },
  { id: 'bow_tie', label: '领结', category: '通用', tags: ['饰品','祝福'] },
  { id: 'earring', label: '耳环', category: '通用', tags: ['饰品'] },
  { id: 'necklace', label: '项链', category: '通用', tags: ['饰品','最新'] },
  { id: 'gem', label: '宝石', category: '通用', tags: ['饰品','热门'] },
  { id: 'crown', label: '皇冠', category: '通用', tags: ['饰品','热门'] },
  { id: 'sun', label: '太阳', category: '通用', tags: ['最新','园艺'] },
  { id: 'cloud', label: '云朵', category: '通用', tags: ['可爱','最新'] },
  { id: 'rain', label: '下雨', category: '通用', tags: ['警示'] },
  { id: 'moon', label: '月亮', category: '通用', tags: ['可爱','最新'] },
  { id: 'lightning', label: '闪电', category: '警示', tags: ['警示','热门'] },
  { id: 'wrench', label: '扳手', category: '通用', tags: ['标记'] },
  { id: 'hammer', label: '锤子', category: '通用', tags: ['标记'] },
  { id: 'gear', label: '齿轮', category: '通用', tags: ['标记','最新'] },
  { id: 'key', label: '钥匙', category: '通用', tags: ['标记','热门'] },
  { id: 'lock', label: '锁', category: '通用', tags: ['标记','警示'] },
  { id: 'pen', label: '钢笔', category: '通用', tags: ['最新'] },
  { id: 'folder', label: '文件夹', category: '通用', tags: ['标记'] },
  { id: 'calendar', label: '日历', category: '通用', tags: ['最新','热门'] },
  { id: 'clipboard', label: '剪贴板', category: '通用', tags: ['标记'] },
  { id: 'printer', label: '打印机', category: '通用', tags: ['最新','热门'] },
  { id: 'trophy', label: '奖杯', category: '通用', tags: ['祝福','热门'] },
  { id: 'flag', label: '旗帜', category: '标记', tags: ['标记','热门'] },
  { id: 'target', label: '靶心', category: '标记', tags: ['标记'] },
  { id: 'wink', label: '眨眼', category: '表情', tags: ['可爱','最新'] },
  { id: 'sad', label: '难过', category: '表情', tags: ['可爱'] },
  { id: 'cool', label: '酷', category: '表情', tags: ['可爱','热门'] },
  { id: 'love_face', label: '花痴', category: '表情', tags: ['可爱','祝福'] },
  { id: 'cart', label: '购物车', category: '零售', tags: ['零售','热门'] },
  { id: 'bag', label: '购物袋', category: '零售', tags: ['零售','最新'] },
  { id: 'tag', label: '吊牌', category: '零售', tags: ['零售'] },
  { id: 'store', label: '店铺', category: '零售', tags: ['零售'] },
  { id: 'chat', label: '对话', category: '联系', tags: ['联系','最新'] },
  { id: 'user', label: '用户', category: '联系', tags: ['联系'] },
  { id: 'home', label: '家', category: '联系', tags: ['联系','热门'] },
  { id: 'link', label: '链接', category: '联系', tags: ['联系'] },
  { id: 'truck', label: '货车', category: '物流', tags: ['物流','热门'] },
  { id: 'plane', label: '飞机', category: '物流', tags: ['物流','最新'] },
  { id: 'package', label: '包裹', category: '物流', tags: ['物流'] },
  { id: 'triangle', label: '三角', category: '形状', tags: ['形状'] },
  { id: 'plus', label: '加号', category: '形状', tags: ['形状','标记'] },
  { id: 'minus', label: '减号', category: '形状', tags: ['形状','标记'] },
  { id: 'star_fill', label: '实心星', category: '形状', tags: ['形状','可爱'] },
  { id: 'heart_fill', label: '实心爱心', category: '形状', tags: ['形状','可爱','祝福'] },
  { id: 'lantern', label: '灯笼', category: '通用', tags: ['祝福','最新','热门'] },
  { id: 'red_packet', label: '红包', category: '通用', tags: ['祝福','热门'] },
  { id: 'tree', label: '树', category: '通用', tags: ['园艺'] },
  { id: 'rose', label: '玫瑰', category: '通用', tags: ['园艺','祝福','热门'] },
  { id: 'cactus', label: '仙人掌', category: '通用', tags: ['园艺','可爱'] },
  { id: 'sunflower', label: '向日葵', category: '通用', tags: ['园艺','最新'] },
  { id: 'electricity', label: '带电', category: '警示', tags: ['警示','热门'] },
  { id: 'high_temp', label: '高温', category: '警示', tags: ['警示'] },
  { id: 'medal', label: '奖牌', category: '通用', tags: ['祝福'] },
  { id: 'ribbon', label: '丝带', category: '通用', tags: ['祝福','饰品'] },
  { id: 'arrow_double', label: '双向', category: '箭头', tags: ['箭头'] },
  { id: 'refresh', label: '刷新', category: '箭头', tags: ['箭头','最新'] },
  { id: 'download', label: '下载', category: '箭头', tags: ['箭头'] },
  { id: 'upload', label: '上传', category: '箭头', tags: ['箭头'] }
], SHANGYUE_SCENE_MATERIALS).map((item) => {
  const isV2Symbol = SHANGYUE_MATERIAL_SYMBOL_SET.has(item.id);
  const isSceneSymbol = SHANGYUE_SCENE_MATERIAL_SYMBOL_SET.has(item.id);
  if (!isV2Symbol && !isSceneSymbol) return item;
  return {
    ...item,
    tags: Array.from(new Set([...(item.tags || []), '商跃'])),
    source: isSceneSymbol ? 'shangyue-vector-scene-v1' : 'shangyue-vector-v2',
    vector: true,
    raster: false
  };
});

function materialById(id) {
  return MATERIAL_CATALOG.find((item) => item.id === id) || MATERIAL_CATALOG[0];
}

function materialChipAfterSearchToggle(currentChip, searchOpen) {
  if (searchOpen) return '搜索';
  return !currentChip || currentChip === '搜索' ? DEFAULT_MATERIAL_CHIP : currentChip;
}

function applyMaterialToElement(element, material, images) {
  if (!element || element.type !== 'material' || !material) return false;
  element.symbol = material.id;
  if (material.asset) element.path = material.asset;
  else delete element.path;
  if (images && element.id) delete images[element.id];
  return true;
}


/**
 * Filter catalog by chip/category and optional text query.
 * chip "搜索" or empty returns full catalog (query still applies).
 */
function materialsForChip(chip, query) {
  let list = MATERIAL_CATALOG.slice();
  const c = chip || '';
  if (c && c !== '搜索' && c !== '全部') {
    list = list.filter((item) => c === '商跃'
      ? SHANGYUE_MATERIAL_SYMBOL_SET.has(item.id) || SHANGYUE_SCENE_MATERIAL_SYMBOL_SET.has(item.id)
      : (item.tags && item.tags.includes(c)) || item.category === c);
  }
  const q = String(query || '').trim().toLowerCase();
  if (q) {
    list = list.filter((item) => {
      const hay = [
        item.id,
        item.label,
        item.category,
        ...(item.tags || [])
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  return list;
}

function materialCategories() {
  const seen = [];
  MATERIAL_CATALOG.forEach((item) => {
    if (!seen.includes(item.category)) seen.push(item.category);
  });
  return seen;
}

/** Draw the original Shangyue scenario pack in a 24 x 24 unit box. */
function drawShangyueSceneMaterialSymbol(context, symbol, x, y, w, h, lineWidthPx) {
  if (!SHANGYUE_SCENE_MATERIAL_SYMBOL_SET.has(symbol)) return false;

  const sx = (u) => x + (u / 24) * w;
  const sy = (v) => y + (v / 24) * h;
  const unit = Math.min(w, h) / 24;
  const stroke = () => {
    context.lineWidth = Math.max(1, lineWidthPx || 2);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.stroke();
  };
  const path = (points, close = false, filled = false) => {
    context.beginPath();
    points.forEach(([px, py], index) => {
      if (index === 0) context.moveTo(sx(px), sy(py));
      else context.lineTo(sx(px), sy(py));
    });
    if (close) context.closePath();
    if (filled) context.fill();
    else stroke();
  };
  const segments = (lines) => {
    context.beginPath();
    lines.forEach(([x1, y1, x2, y2]) => {
      context.moveTo(sx(x1), sy(y1));
      context.lineTo(sx(x2), sy(y2));
    });
    stroke();
  };
  const rect = (left, top, right, bottom, filled = false) => {
    path([[left, top], [right, top], [right, bottom], [left, bottom]], true, filled);
  };
  const circle = (cx, cy, radius, filled = false) => {
    context.beginPath();
    context.arc(sx(cx), sy(cy), radius * unit, 0, Math.PI * 2);
    if (filled) context.fill();
    else stroke();
  };

  switch (symbol) {
    case 'retail_shelf':
      rect(4, 3, 20, 21);
      segments([[4, 9, 20, 9], [4, 15, 20, 15]]);
      rect(6, 5, 10, 9); rect(13, 4, 18, 9);
      rect(5, 11, 12, 15); rect(15, 10, 19, 15);
      rect(7, 17, 11, 21); rect(13, 16, 18, 21);
      break;
    case 'cash_register':
      path([[5, 10], [18, 10], [21, 20], [3, 20]], true);
      rect(7, 3, 17, 10); rect(9, 5, 15, 8);
      [7, 11, 15].forEach((px) => circle(px, 14, 0.7, true));
      [8.5, 12.5, 16.5].forEach((px) => circle(px, 17, 0.7, true));
      break;
    case 'shopping_basket':
      path([[4, 9], [20, 9], [18, 20], [6, 20]], true);
      context.beginPath(); context.moveTo(sx(7), sy(10));
      context.quadraticCurveTo(sx(8), sy(2), sx(12), sy(3));
      context.quadraticCurveTo(sx(16), sy(2), sx(17), sy(10)); stroke();
      segments([[9, 12, 9, 18], [12, 12, 12, 18], [15, 12, 15, 18]]);
      break;
    case 'price_drop':
      path([[4, 5], [14, 4], [21, 11], [12, 20], [4, 13]], true);
      circle(8, 8, 1.3);
      path([[11, 8], [16, 13], [16, 10], [16, 13], [13, 13]]);
      break;
    case 'membership_card':
      rect(3, 5, 21, 19);
      circle(8, 11, 2.2);
      context.beginPath(); context.moveTo(sx(5), sy(17));
      context.quadraticCurveTo(sx(8), sy(13), sx(11), sy(17)); stroke();
      segments([[13, 9, 19, 9], [13, 12, 18, 12], [13, 15, 16, 15]]);
      break;

    case 'warehouse_rack':
      segments([[3, 3, 3, 22], [21, 3, 21, 22], [3, 8, 21, 8], [3, 14, 21, 14], [3, 20, 21, 20]]);
      rect(5, 4, 11, 8); rect(14, 3, 19, 8);
      rect(6, 10, 13, 14); rect(15, 9, 20, 14);
      rect(4, 16, 10, 20); rect(12, 16, 19, 20);
      break;
    case 'pallet':
      rect(4, 4, 11, 12); rect(12, 4, 20, 12);
      path([[4, 4], [7.5, 7], [11, 4], [12, 4], [16, 8], [20, 4]]);
      rect(3, 14, 21, 17); rect(5, 17, 8, 21); rect(16, 17, 19, 21);
      path([[3, 21], [21, 21]]);
      break;
    case 'forklift':
      path([[4, 16], [4, 8], [11, 8], [14, 16], [18, 16], [18, 20], [4, 20]], true);
      path([[11, 8], [11, 4], [16, 4], [16, 16]]);
      segments([[16, 16, 21, 16], [21, 6, 21, 20]]);
      path([[16, 12], [20, 12]]);
      circle(7, 20, 2); circle(15, 20, 2);
      break;
    case 'inventory_box':
      path([[4, 7], [12, 3], [20, 7], [20, 18], [12, 22], [4, 18]], true);
      path([[4, 7], [12, 12], [20, 7], [12, 12], [12, 22], [8, 5], [16, 9]]);
      path([[14, 16], [16, 18], [20, 13]]);
      break;
    case 'outbound':
      rect(3, 6, 14, 18);
      path([[3, 6], [8.5, 10], [14, 6], [8.5, 10], [8.5, 18]]);
      path([[12, 13], [21, 13], [17, 9], [21, 13], [17, 17]]);
      break;

    case 'expiry_calendar':
      rect(4, 5, 20, 21);
      segments([[4, 10, 20, 10], [8, 3, 8, 7], [16, 3, 16, 7]]);
      circle(12, 15, 3.2);
      path([[12, 15], [12, 12.5], [14, 16]]);
      break;
    case 'hourglass':
      path([[6, 3], [18, 3], [17, 8], [13, 12], [17, 16], [18, 21], [6, 21], [7, 16], [11, 12], [7, 8]], true);
      path([[8, 6], [16, 6], [12, 10]], true, true);
      path([[8, 19], [16, 19], [12, 14]], true, true);
      break;
    case 'first_in_first_out':
      rect(3, 5, 8, 11); rect(9.5, 5, 14.5, 11); rect(16, 5, 21, 11);
      path([[3, 16], [19, 16], [15, 12], [19, 16], [15, 20]]);
      circle(6, 8, 0.7, true); circle(12, 8, 0.7, true); circle(18.5, 8, 0.7, true);
      break;
    case 'cold_chain':
      rect(4, 4, 20, 21);
      segments([[12, 7, 12, 18], [8, 9, 16, 16], [8, 16, 16, 9]]);
      segments([[9.5, 7.5, 12, 10], [12, 10, 14.5, 7.5], [9.5, 17.5, 12, 15], [12, 15, 14.5, 17.5]]);
      break;
    case 'batch_stamp':
      path([[8, 4], [16, 4], [15, 11], [19, 14], [19, 17], [5, 17], [5, 14], [9, 11]], true);
      segments([[4, 20, 20, 20], [9, 13, 9, 18], [15, 13, 15, 18], [7, 15, 17, 15]]);
      break;

    case 'tshirt':
      path([[8, 4], [4, 7], [2, 12], [6, 14], [8, 11], [8, 21], [16, 21], [16, 11], [18, 14], [22, 12], [20, 7], [16, 4]], true);
      context.beginPath(); context.moveTo(sx(8), sy(4)); context.quadraticCurveTo(sx(12), sy(9), sx(16), sy(4)); stroke();
      break;
    case 'dress':
      context.beginPath(); context.moveTo(sx(9), sy(3)); context.quadraticCurveTo(sx(12), sy(7), sx(15), sy(3)); stroke();
      path([[9, 3], [7, 10], [9, 12], [4, 21], [20, 21], [15, 12], [17, 10], [15, 3]], true);
      path([[8, 11], [16, 11]]);
      break;
    case 'shoe':
      context.beginPath(); context.moveTo(sx(4), sy(15));
      context.quadraticCurveTo(sx(8), sy(15), sx(10), sy(7));
      context.quadraticCurveTo(sx(13), sy(13), sx(20), sy(14));
      context.quadraticCurveTo(sx(23), sy(15), sx(21), sy(19));
      context.lineTo(sx(5), sy(19)); context.quadraticCurveTo(sx(2), sy(18), sx(4), sy(15)); stroke();
      path([[10, 11], [13, 11], [8, 19], [8, 17], [20, 17]]);
      break;
    case 'ring_size':
      circle(11, 12, 6); circle(11, 12, 3.2);
      path([[18, 5], [21, 5], [21, 20], [18, 20]]);
      segments([[18, 8, 20, 8], [18, 11, 20, 11], [18, 14, 20, 14], [18, 17, 20, 17]]);
      break;
    case 'jewelry_box':
      rect(4, 11, 20, 21);
      path([[4, 11], [7, 4], [17, 4], [20, 11], [7, 4], [12, 10], [17, 4]]);
      path([[9, 15], [12, 12], [15, 15], [12, 19]], true);
      break;

    case 'cable_coil':
      circle(11, 11, 7); circle(11, 11, 3.5); circle(11, 11, 1, true);
      context.beginPath(); context.moveTo(sx(16), sy(16));
      context.quadraticCurveTo(sx(21), sy(17), sx(19), sy(22)); stroke();
      path([[18, 22], [21, 22]]);
      break;
    case 'plug':
      rect(7, 6, 17, 14);
      segments([[10, 6, 10, 2], [14, 6, 14, 2], [9, 14, 9, 18], [9, 18, 15, 18], [15, 18, 15, 14]]);
      context.beginPath(); context.moveTo(sx(15), sy(18)); context.quadraticCurveTo(sx(19), sy(18), sx(20), sy(22)); stroke();
      break;
    case 'network_port':
      rect(4, 5, 20, 20);
      path([[7, 8], [17, 8], [17, 14], [15, 14], [15, 17], [9, 17], [9, 14], [7, 14]], true);
      [9, 11, 13, 15].forEach((px) => path([[px, 8], [px, 11]]));
      break;
    case 'device_serial':
      rect(3, 5, 21, 19);
      circle(6, 8, 0.8, true); circle(18, 8, 0.8, true);
      segments([[8, 8, 16, 8], [6, 12, 18, 12], [6, 15, 14, 15], [16, 15, 18, 15], [6, 17, 9, 17], [11, 17, 13, 17]]);
      break;
    case 'grounding':
      segments([[12, 3, 12, 14], [6, 14, 18, 14], [8, 18, 16, 18], [10, 21, 14, 21]]);
      path([[8, 5], [12, 9], [16, 5]]);
      break;

    case 'file_box':
      path([[5, 3], [17, 3], [20, 6], [20, 21], [5, 21]], true);
      path([[17, 3], [17, 6], [20, 6]]);
      rect(8, 8, 17, 14); circle(12.5, 18, 1.2);
      break;
    case 'medicine':
      rect(6, 7, 18, 21);
      rect(8, 3, 16, 7);
      segments([[12, 10, 12, 18], [8, 14, 16, 14]]);
      break;
    case 'kitchen_jar':
      rect(7, 3, 17, 6);
      context.beginPath(); context.moveTo(sx(6), sy(7));
      context.quadraticCurveTo(sx(4), sy(14), sx(7), sy(21));
      context.lineTo(sx(17), sy(21)); context.quadraticCurveTo(sx(20), sy(14), sx(18), sy(7)); context.closePath(); stroke();
      path([[7, 11], [17, 11], [9, 15], [15, 15]]);
      break;
    case 'school_book':
      context.beginPath(); context.moveTo(sx(3), sy(5));
      context.quadraticCurveTo(sx(8), sy(3), sx(12), sy(7));
      context.quadraticCurveTo(sx(16), sy(3), sx(21), sy(5));
      context.lineTo(sx(21), sy(20)); context.quadraticCurveTo(sx(16), sy(18), sx(12), sy(22));
      context.quadraticCurveTo(sx(8), sy(18), sx(3), sy(20)); context.closePath(); stroke();
      segments([[12, 7, 12, 22], [6, 9, 10, 10], [14, 10, 19, 9], [6, 14, 10, 15], [14, 15, 19, 14]]);
      break;
    case 'plant_pot':
      path([[7, 13], [17, 13], [15, 22], [9, 22]], true);
      path([[12, 13], [12, 5]]);
      context.beginPath(); context.moveTo(sx(12), sy(8)); context.quadraticCurveTo(sx(5), sy(7), sx(5), sy(3)); context.quadraticCurveTo(sx(11), sy(2), sx(12), sy(8)); stroke();
      context.beginPath(); context.moveTo(sx(12), sy(10)); context.quadraticCurveTo(sx(19), sy(9), sx(20), sy(5)); context.quadraticCurveTo(sx(14), sy(4), sx(12), sy(10)); stroke();
      path([[6, 16], [18, 16]]);
      break;
    default:
      return false;
  }

  return true;
}

/**
 * Draw symbol in unit box [0,1]x[0,1] mapped into (x,y,w,h).
 * All strokes black; filled where intentional for thermal contrast.
 */
function drawMaterialSymbol(context, symbol, x, y, w, h, lineWidthPx) {
  const lw = Math.max(1, lineWidthPx || 2);
  const sx = (u) => x + u * w;
  const sy = (v) => y + v * h;
  const stroke = () => {
    context.lineWidth = lw;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.stroke();
  };
  const fill = () => {
    context.fill();
  };

  context.save();
  context.strokeStyle = '#000000';
  context.fillStyle = '#000000';

  const id = symbol || 'check';

  // V2 glyphs replace the early catalog's repeated placeholder geometry with
  // distinct Shangyue-owned vector drawings. Legacy primitives remain below as
  // a compatibility fallback for existing documents and the basic symbol set.
  if (drawShangyueMaterialSymbol(context, id, x, y, w, h, lw)) {
    context.restore();
    return;
  }

  if (drawShangyueSceneMaterialSymbol(context, id, x, y, w, h, lw)) {
    context.restore();
    return;
  }

  if (id === 'check') {
    context.beginPath();
    context.moveTo(sx(0.12), sy(0.52));
    context.lineTo(sx(0.38), sy(0.78));
    context.lineTo(sx(0.9), sy(0.2));
    stroke();
  } else if (id === 'cross') {
    context.beginPath();
    context.moveTo(sx(0.2), sy(0.2));
    context.lineTo(sx(0.8), sy(0.8));
    context.moveTo(sx(0.8), sy(0.2));
    context.lineTo(sx(0.2), sy(0.8));
    stroke();
  } else if (id === 'star') {
    context.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      const r = i % 2 === 0 ? 0.45 : 0.2;
      const px = sx(0.5 + Math.cos(angle) * r);
      const py = sy(0.5 + Math.sin(angle) * r);
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    stroke();
  } else if (id === 'heart') {
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.82));
    context.bezierCurveTo(sx(0.15), sy(0.58), sx(0.08), sy(0.32), sx(0.28), sy(0.22));
    context.bezierCurveTo(sx(0.4), sy(0.16), sx(0.5), sy(0.26), sx(0.5), sy(0.36));
    context.bezierCurveTo(sx(0.5), sy(0.26), sx(0.6), sy(0.16), sx(0.72), sy(0.22));
    context.bezierCurveTo(sx(0.92), sy(0.32), sx(0.85), sy(0.58), sx(0.5), sy(0.82));
    context.closePath();
    stroke();
  } else if (id === 'warning') {
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.08));
    context.lineTo(sx(0.92), sy(0.88));
    context.lineTo(sx(0.08), sy(0.88));
    context.closePath();
    stroke();
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.34));
    context.lineTo(sx(0.5), sy(0.6));
    stroke();
    context.beginPath();
    context.arc(sx(0.5), sy(0.74), Math.min(w, h) * 0.035, 0, Math.PI * 2);
    fill();
  } else if (id === 'info') {
    context.beginPath();
    context.arc(sx(0.5), sy(0.5), Math.min(w, h) * 0.42, 0, Math.PI * 2);
    stroke();
    context.beginPath();
    context.arc(sx(0.5), sy(0.3), Math.min(w, h) * 0.04, 0, Math.PI * 2);
    fill();
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.42));
    context.lineTo(sx(0.5), sy(0.72));
    stroke();
  } else if (id === 'ban') {
    context.beginPath();
    context.arc(sx(0.5), sy(0.5), Math.min(w, h) * 0.4, 0, Math.PI * 2);
    stroke();
    context.beginPath();
    context.moveTo(sx(0.22), sy(0.22));
    context.lineTo(sx(0.78), sy(0.78));
    stroke();
  } else if (id === 'fragile') {
    // wine glass
    context.beginPath();
    context.moveTo(sx(0.28), sy(0.15));
    context.lineTo(sx(0.72), sy(0.15));
    context.lineTo(sx(0.62), sy(0.48));
    context.quadraticCurveTo(sx(0.5), sy(0.58), sx(0.38), sy(0.48));
    context.closePath();
    stroke();
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.55));
    context.lineTo(sx(0.5), sy(0.78));
    context.moveTo(sx(0.32), sy(0.82));
    context.lineTo(sx(0.68), sy(0.82));
    stroke();
    // crack
    context.beginPath();
    context.moveTo(sx(0.55), sy(0.22));
    context.lineTo(sx(0.48), sy(0.32));
    context.lineTo(sx(0.58), sy(0.4));
    stroke();
  } else if (id === 'keepdry') {
    // umbrella
    context.beginPath();
    context.arc(sx(0.5), sy(0.42), Math.min(w, h) * 0.32, Math.PI, 0);
    context.lineTo(sx(0.82), sy(0.42));
    context.lineTo(sx(0.18), sy(0.42));
    context.closePath();
    stroke();
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.42));
    context.lineTo(sx(0.5), sy(0.82));
    context.quadraticCurveTo(sx(0.62), sy(0.88), sx(0.7), sy(0.8));
    stroke();
  } else if (id === 'recycle') {
    const cx = 0.5;
    const cy = 0.52;
    for (let i = 0; i < 3; i += 1) {
      const a0 = -Math.PI / 2 + i * (Math.PI * 2 / 3);
      const a1 = a0 + Math.PI * 0.9;
      context.beginPath();
      context.arc(sx(cx), sy(cy), Math.min(w, h) * 0.28, a0, a1);
      stroke();
      const tipX = cx + Math.cos(a1) * 0.28;
      const tipY = cy + Math.sin(a1) * 0.28;
      const tx = Math.cos(a1 + 0.5) * 0.1;
      const ty = Math.sin(a1 + 0.5) * 0.1;
      context.beginPath();
      context.moveTo(sx(tipX), sy(tipY));
      context.lineTo(sx(tipX - tx + Math.cos(a1) * 0.08), sy(tipY - ty + Math.sin(a1) * 0.08));
      context.lineTo(sx(tipX + Math.cos(a1 + 1.2) * 0.1), sy(tipY + Math.sin(a1 + 1.2) * 0.1));
      context.closePath();
      fill();
    }
  } else if (id === 'box') {
    context.beginPath();
    context.rect(sx(0.18), sy(0.32), w * 0.64, h * 0.5);
    stroke();
    context.beginPath();
    context.moveTo(sx(0.18), sy(0.32));
    context.lineTo(sx(0.5), sy(0.12));
    context.lineTo(sx(0.82), sy(0.32));
    context.moveTo(sx(0.5), sy(0.12));
    context.lineTo(sx(0.5), sy(0.82));
    stroke();
  } else if (id === 'scissors') {
    context.beginPath();
    context.arc(sx(0.28), sy(0.32), Math.min(w, h) * 0.1, 0, Math.PI * 2);
    stroke();
    context.beginPath();
    context.arc(sx(0.28), sy(0.68), Math.min(w, h) * 0.1, 0, Math.PI * 2);
    stroke();
    context.beginPath();
    context.moveTo(sx(0.36), sy(0.36));
    context.lineTo(sx(0.85), sy(0.78));
    context.moveTo(sx(0.36), sy(0.64));
    context.lineTo(sx(0.85), sy(0.22));
    stroke();
  } else if (id === 'arrow_up' || id === 'arrow_down' || id === 'arrow_left' || id === 'arrow_right') {
    context.save();
    context.translate(sx(0.5), sy(0.5));
    if (id === 'arrow_down') context.rotate(Math.PI);
    if (id === 'arrow_left') context.rotate(-Math.PI / 2);
    if (id === 'arrow_right') context.rotate(Math.PI / 2);
    context.beginPath();
    context.moveTo(0, -h * 0.38);
    context.lineTo(w * 0.28, -h * 0.05);
    context.lineTo(w * 0.1, -h * 0.05);
    context.lineTo(w * 0.1, h * 0.38);
    context.lineTo(-w * 0.1, h * 0.38);
    context.lineTo(-w * 0.1, -h * 0.05);
    context.lineTo(-w * 0.28, -h * 0.05);
    context.closePath();
    stroke();
    context.restore();
  } else if (id === 'phone') {
    context.beginPath();
    // rounded handset
    const r = Math.min(w, h) * 0.08;
    context.moveTo(sx(0.32), sy(0.18));
    context.lineTo(sx(0.68), sy(0.18));
    context.quadraticCurveTo(sx(0.78), sy(0.18), sx(0.78), sy(0.28));
    context.lineTo(sx(0.78), sy(0.72));
    context.quadraticCurveTo(sx(0.78), sy(0.82), sx(0.68), sy(0.82));
    context.lineTo(sx(0.32), sy(0.82));
    context.quadraticCurveTo(sx(0.22), sy(0.82), sx(0.22), sy(0.72));
    context.lineTo(sx(0.22), sy(0.28));
    context.quadraticCurveTo(sx(0.22), sy(0.18), sx(0.32), sy(0.18));
    stroke();
    context.beginPath();
    context.moveTo(sx(0.38), sy(0.28));
    context.lineTo(sx(0.62), sy(0.28));
    stroke();
  } else if (id === 'location') {
    context.beginPath();
    context.arc(sx(0.5), sy(0.38), Math.min(w, h) * 0.22, Math.PI * 0.15, Math.PI - Math.PI * 0.15);
    context.lineTo(sx(0.5), sy(0.88));
    context.closePath();
    stroke();
    context.beginPath();
    context.arc(sx(0.5), sy(0.38), Math.min(w, h) * 0.08, 0, Math.PI * 2);
    stroke();
  } else if (id === 'mail') {
    context.beginPath();
    context.rect(sx(0.12), sy(0.28), w * 0.76, h * 0.48);
    stroke();
    context.beginPath();
    context.moveTo(sx(0.12), sy(0.28));
    context.lineTo(sx(0.5), sy(0.55));
    context.lineTo(sx(0.88), sy(0.28));
    stroke();
  } else if (id === 'wifi') {
    for (let i = 0; i < 3; i += 1) {
      const r = 0.15 + i * 0.14;
      context.beginPath();
      context.arc(sx(0.5), sy(0.72), Math.min(w, h) * r, Math.PI * 1.15, Math.PI * 1.85);
      stroke();
    }
    context.beginPath();
    context.arc(sx(0.5), sy(0.72), Math.min(w, h) * 0.04, 0, Math.PI * 2);
    fill();
  } else if (id === 'clock') {
    context.beginPath();
    context.arc(sx(0.5), sy(0.5), Math.min(w, h) * 0.4, 0, Math.PI * 2);
    stroke();
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.5));
    context.lineTo(sx(0.5), sy(0.28));
    context.moveTo(sx(0.5), sy(0.5));
    context.lineTo(sx(0.72), sy(0.5));
    stroke();
  } else if (id === 'fire') {
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.12));
    context.bezierCurveTo(sx(0.72), sy(0.35), sx(0.85), sy(0.55), sx(0.7), sy(0.78));
    context.quadraticCurveTo(sx(0.5), sy(0.95), sx(0.3), sy(0.78));
    context.bezierCurveTo(sx(0.15), sy(0.55), sx(0.28), sy(0.35), sx(0.5), sy(0.12));
    context.closePath();
    stroke();
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.45));
    context.quadraticCurveTo(sx(0.62), sy(0.6), sx(0.5), sy(0.78));
    context.quadraticCurveTo(sx(0.38), sy(0.6), sx(0.5), sy(0.45));
    stroke();
  } else if (id === 'snow') {
    const arms = 6;
    for (let i = 0; i < arms; i += 1) {
      const a = (i * Math.PI) / 3;
      context.beginPath();
      context.moveTo(sx(0.5), sy(0.5));
      context.lineTo(sx(0.5 + Math.cos(a) * 0.4), sy(0.5 + Math.sin(a) * 0.4));
      stroke();
      const mx = 0.5 + Math.cos(a) * 0.22;
      const my = 0.5 + Math.sin(a) * 0.22;
      context.beginPath();
      context.moveTo(sx(mx), sy(my));
      context.lineTo(sx(mx + Math.cos(a + 0.8) * 0.12), sy(my + Math.sin(a + 0.8) * 0.12));
      context.moveTo(sx(mx), sy(my));
      context.lineTo(sx(mx + Math.cos(a - 0.8) * 0.12), sy(my + Math.sin(a - 0.8) * 0.12));
      stroke();
    }
  } else if (id === 'leaf') {
    context.beginPath();
    context.moveTo(sx(0.22), sy(0.78));
    context.bezierCurveTo(sx(0.15), sy(0.4), sx(0.4), sy(0.12), sx(0.78), sy(0.22));
    context.bezierCurveTo(sx(0.9), sy(0.55), sx(0.55), sy(0.9), sx(0.22), sy(0.78));
    context.closePath();
    stroke();
    context.beginPath();
    context.moveTo(sx(0.28), sy(0.72));
    context.quadraticCurveTo(sx(0.5), sy(0.5), sx(0.72), sy(0.28));
    stroke();
  } else if (id === 'chili') {
    context.beginPath();
    context.moveTo(sx(0.35), sy(0.2));
    context.quadraticCurveTo(sx(0.55), sy(0.15), sx(0.72), sy(0.35));
    context.quadraticCurveTo(sx(0.85), sy(0.55), sx(0.7), sy(0.8));
    context.quadraticCurveTo(sx(0.45), sy(0.92), sx(0.3), sy(0.7));
    context.quadraticCurveTo(sx(0.2), sy(0.45), sx(0.35), sy(0.2));
    context.closePath();
    stroke();
    context.beginPath();
    context.moveTo(sx(0.4), sy(0.22));
    context.quadraticCurveTo(sx(0.42), sy(0.08), sx(0.55), sy(0.1));
    stroke();
  } else if (id === 'cup') {
    context.beginPath();
    context.moveTo(sx(0.25), sy(0.28));
    context.lineTo(sx(0.32), sy(0.78));
    context.lineTo(sx(0.68), sy(0.78));
    context.lineTo(sx(0.75), sy(0.28));
    context.closePath();
    stroke();
    context.beginPath();
    context.arc(sx(0.78), sy(0.48), Math.min(w, h) * 0.1, -Math.PI / 2, Math.PI / 2);
    stroke();
    context.beginPath();
    context.moveTo(sx(0.28), sy(0.22));
    context.lineTo(sx(0.72), sy(0.22));
    stroke();
  } else if (id === 'price') {
    context.beginPath();
    context.moveTo(sx(0.18), sy(0.35));
    context.lineTo(sx(0.55), sy(0.12));
    context.lineTo(sx(0.88), sy(0.35));
    context.lineTo(sx(0.88), sy(0.7));
    context.lineTo(sx(0.55), sy(0.88));
    context.lineTo(sx(0.18), sy(0.7));
    context.closePath();
    stroke();
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.38));
    context.lineTo(sx(0.5), sy(0.68));
    context.moveTo(sx(0.4), sy(0.45));
    context.lineTo(sx(0.6), sy(0.45));
    context.moveTo(sx(0.4), sy(0.58));
    context.lineTo(sx(0.6), sy(0.58));
    stroke();
  } else if (id === 'percent') {
    context.beginPath();
    context.arc(sx(0.32), sy(0.32), Math.min(w, h) * 0.1, 0, Math.PI * 2);
    stroke();
    context.beginPath();
    context.arc(sx(0.68), sy(0.68), Math.min(w, h) * 0.1, 0, Math.PI * 2);
    stroke();
    context.beginPath();
    context.moveTo(sx(0.72), sy(0.22));
    context.lineTo(sx(0.28), sy(0.78));
    stroke();
  } else if (id === 'badge') {
    context.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const a = -Math.PI / 2 + i * Math.PI / 4;
      const r = i % 2 === 0 ? 0.42 : 0.3;
      const px = sx(0.5 + Math.cos(a) * r);
      const py = sy(0.5 + Math.sin(a) * r);
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    stroke();
  } else if (id === 'smile') {
    context.beginPath();
    context.arc(sx(0.5), sy(0.5), Math.min(w, h) * 0.4, 0, Math.PI * 2);
    stroke();
    context.beginPath();
    context.arc(sx(0.35), sy(0.42), Math.min(w, h) * 0.04, 0, Math.PI * 2);
    fill();
    context.beginPath();
    context.arc(sx(0.65), sy(0.42), Math.min(w, h) * 0.04, 0, Math.PI * 2);
    fill();
    context.beginPath();
    context.arc(sx(0.5), sy(0.5), Math.min(w, h) * 0.2, 0.15 * Math.PI, 0.85 * Math.PI);
    stroke();
  } else if (id === 'thumb') {
    context.beginPath();
    context.moveTo(sx(0.35), sy(0.45));
    context.lineTo(sx(0.35), sy(0.82));
    context.lineTo(sx(0.72), sy(0.82));
    context.lineTo(sx(0.78), sy(0.55));
    context.lineTo(sx(0.55), sy(0.55));
    context.lineTo(sx(0.58), sy(0.28));
    context.quadraticCurveTo(sx(0.55), sy(0.15), sx(0.45), sy(0.22));
    context.lineTo(sx(0.42), sy(0.45));
    context.closePath();
    stroke();
  } else if (id === 'circle') {
    context.beginPath();
    context.arc(sx(0.5), sy(0.5), Math.min(w, h) * 0.4, 0, Math.PI * 2);
    stroke();
  } else if (id === 'circle_fill') {
    context.beginPath();
    context.arc(sx(0.5), sy(0.5), Math.min(w, h) * 0.4, 0, Math.PI * 2);
    fill();
  } else if (id === 'diamond') {
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.1));
    context.lineTo(sx(0.9), sy(0.5));
    context.lineTo(sx(0.5), sy(0.9));
    context.lineTo(sx(0.1), sy(0.5));
    context.closePath();
    stroke();
  } else if (id === 'hexagon') {
    context.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = -Math.PI / 2 + i * Math.PI / 3;
      const px = sx(0.5 + Math.cos(a) * 0.42);
      const py = sy(0.5 + Math.sin(a) * 0.42);
      if (i === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.closePath();
    stroke();
  } else if (id === 'square_round') {
    const rr = Math.min(w, h) * 0.12;
    const left = sx(0.15);
    const top = sy(0.15);
    const rw = w * 0.7;
    const rh = h * 0.7;
    context.beginPath();
    context.moveTo(left + rr, top);
    context.lineTo(left + rw - rr, top);
    context.quadraticCurveTo(left + rw, top, left + rw, top + rr);
    context.lineTo(left + rw, top + rh - rr);
    context.quadraticCurveTo(left + rw, top + rh, left + rw - rr, top + rh);
    context.lineTo(left + rr, top + rh);
    context.quadraticCurveTo(left, top + rh, left, top + rh - rr);
    context.lineTo(left, top + rr);
    context.quadraticCurveTo(left, top, left + rr, top);
    context.closePath();
    stroke();

  } else if (id === 'panda') {
    context.beginPath();
    context.arc(sx(0.28), sy(0.28), Math.min(w, h) * 0.12, 0, Math.PI * 2);
    stroke();
    context.beginPath();
    context.arc(sx(0.72), sy(0.28), Math.min(w, h) * 0.12, 0, Math.PI * 2);
    stroke();
    context.beginPath();
    context.arc(sx(0.5), sy(0.52), Math.min(w, h) * 0.34, 0, Math.PI * 2);
    stroke();
    context.beginPath();
    context.arc(sx(0.36), sy(0.5), Math.min(w, h) * 0.09, 0, Math.PI * 2);
    stroke();
    context.beginPath();
    context.arc(sx(0.64), sy(0.5), Math.min(w, h) * 0.09, 0, Math.PI * 2);
    stroke();
    context.beginPath();
    context.arc(sx(0.36), sy(0.5), Math.min(w, h) * 0.03, 0, Math.PI * 2);
    fill();
    context.beginPath();
    context.arc(sx(0.64), sy(0.5), Math.min(w, h) * 0.03, 0, Math.PI * 2);
    fill();
    context.beginPath();
    context.arc(sx(0.5), sy(0.6), Math.min(w, h) * 0.035, 0, Math.PI * 2);
    fill();
    context.beginPath();
    context.arc(sx(0.5), sy(0.66), Math.min(w, h) * 0.08, 0.15 * Math.PI, 0.85 * Math.PI);
    stroke();
  } else if (id === 'cake') {
    context.beginPath();
    context.moveTo(sx(0.15), sy(0.82));
    context.lineTo(sx(0.85), sy(0.82));
    stroke();
    context.beginPath();
    context.moveTo(sx(0.22), sy(0.78));
    context.lineTo(sx(0.22), sy(0.48));
    context.quadraticCurveTo(sx(0.5), sy(0.38), sx(0.78), sy(0.48));
    context.lineTo(sx(0.78), sy(0.78));
    context.closePath();
    stroke();
    context.beginPath();
    context.moveTo(sx(0.22), sy(0.5));
    context.quadraticCurveTo(sx(0.32), sy(0.42), sx(0.42), sy(0.5));
    context.quadraticCurveTo(sx(0.52), sy(0.58), sx(0.62), sy(0.5));
    context.quadraticCurveTo(sx(0.72), sy(0.42), sx(0.78), sy(0.5));
    stroke();
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.42));
    context.lineTo(sx(0.5), sy(0.22));
    stroke();
    context.beginPath();
    context.arc(sx(0.5), sy(0.16), Math.min(w, h) * 0.04, 0, Math.PI * 2);
    stroke();
  } else if (id === 'bracelet') {
    context.beginPath();
    context.arc(sx(0.5), sy(0.5), Math.min(w, h) * 0.34, 0, Math.PI * 2);
    stroke();
    context.beginPath();
    context.arc(sx(0.5), sy(0.5), Math.min(w, h) * 0.22, 0, Math.PI * 2);
    stroke();
    for (let i = 0; i < 6; i += 1) {
      const a = -Math.PI / 2 + i * (Math.PI / 3);
      context.beginPath();
      context.arc(sx(0.5 + Math.cos(a) * 0.34), sy(0.5 + Math.sin(a) * 0.34), Math.min(w, h) * 0.05, 0, Math.PI * 2);
      stroke();
    }
  } else if (id === 'pendant') {
    context.beginPath();
    context.arc(sx(0.5), sy(0.18), Math.min(w, h) * 0.08, 0, Math.PI * 2);
    stroke();
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.26));
    context.lineTo(sx(0.5), sy(0.38));
    stroke();
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.38));
    context.lineTo(sx(0.72), sy(0.52));
    context.lineTo(sx(0.5), sy(0.88));
    context.lineTo(sx(0.28), sy(0.52));
    context.closePath();
    stroke();
    context.beginPath();
    context.moveTo(sx(0.28), sy(0.52));
    context.lineTo(sx(0.72), sy(0.52));
    stroke();
  } else if (id === 'lotus') {
    context.beginPath();
    context.arc(sx(0.5), sy(0.58), Math.min(w, h) * 0.1, 0, Math.PI * 2);
    stroke();
    for (let i = 0; i < 6; i += 1) {
      const a = -Math.PI / 2 + i * (Math.PI / 3);
      context.beginPath();
      context.arc(sx(0.5 + Math.cos(a) * 0.22), sy(0.55 + Math.sin(a) * 0.18), Math.min(w, h) * 0.12, 0, Math.PI * 2);
      stroke();
    }
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.72));
    context.quadraticCurveTo(sx(0.55), sy(0.85), sx(0.48), sy(0.92));
    stroke();
  } else if (id === 'plum') {
    for (let i = 0; i < 5; i += 1) {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
      context.beginPath();
      context.arc(sx(0.5 + Math.cos(a) * 0.22), sy(0.48 + Math.sin(a) * 0.22), Math.min(w, h) * 0.14, 0, Math.PI * 2);
      stroke();
    }
    context.beginPath();
    context.arc(sx(0.5), sy(0.48), Math.min(w, h) * 0.08, 0, Math.PI * 2);
    fill();
    context.beginPath();
    context.moveTo(sx(0.2), sy(0.78));
    context.quadraticCurveTo(sx(0.4), sy(0.7), sx(0.55), sy(0.78));
    stroke();
  } else if (id === 'bamboo') {
    context.beginPath();
    context.moveTo(sx(0.42), sy(0.12));
    context.lineTo(sx(0.42), sy(0.88));
    context.moveTo(sx(0.58), sy(0.12));
    context.lineTo(sx(0.58), sy(0.88));
    stroke();
    [0.28, 0.48, 0.68].forEach((yy) => {
      context.beginPath();
      context.moveTo(sx(0.42), sy(yy));
      context.lineTo(sx(0.58), sy(yy));
      stroke();
    });
    context.beginPath();
    context.moveTo(sx(0.58), sy(0.32));
    context.quadraticCurveTo(sx(0.82), sy(0.22), sx(0.88), sy(0.38));
    context.quadraticCurveTo(sx(0.72), sy(0.4), sx(0.58), sy(0.36));
    stroke();
  } else if (id === 'orchid') {
    context.beginPath();
    context.moveTo(sx(0.48), sy(0.9));
    context.quadraticCurveTo(sx(0.42), sy(0.55), sx(0.52), sy(0.22));
    stroke();
    [[0.52, 0.28, 0.1], [0.62, 0.42, 0.09], [0.42, 0.48, 0.08]].forEach(([cx, cy, s]) => {
      for (let i = 0; i < 5; i += 1) {
        const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
        context.beginPath();
        context.arc(sx(cx + Math.cos(a) * s * 0.7), sy(cy + Math.sin(a) * s * 0.7), Math.min(w, h) * s * 0.45, 0, Math.PI * 2);
        stroke();
      }
    });
  } else if (id === 'chrysanthemum') {
    for (let i = 0; i < 12; i += 1) {
      const a = i * (Math.PI / 6);
      context.beginPath();
      context.moveTo(sx(0.5), sy(0.5));
      context.quadraticCurveTo(sx(0.5 + Math.cos(a) * 0.2), sy(0.5 + Math.sin(a) * 0.2), sx(0.5 + Math.cos(a) * 0.4), sy(0.5 + Math.sin(a) * 0.4));
      stroke();
    }
    context.beginPath();
    context.arc(sx(0.5), sy(0.5), Math.min(w, h) * 0.08, 0, Math.PI * 2);
    stroke();
  } else if (id === 'diamond_ring') {
    context.beginPath();
    context.arc(sx(0.5), sy(0.62), Math.min(w, h) * 0.28, 0.15 * Math.PI, 0.85 * Math.PI);
    stroke();
    context.beginPath();
    context.arc(sx(0.5), sy(0.62), Math.min(w, h) * 0.2, 0.15 * Math.PI, 0.85 * Math.PI);
    stroke();
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.12));
    context.lineTo(sx(0.68), sy(0.32));
    context.lineTo(sx(0.5), sy(0.48));
    context.lineTo(sx(0.32), sy(0.32));
    context.closePath();
    stroke();
    context.beginPath();
    context.moveTo(sx(0.38), sy(0.28));
    context.lineTo(sx(0.62), sy(0.28));
    stroke();
  } else if (id === 'tulip') {
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.18));
    context.bezierCurveTo(sx(0.22), sy(0.28), sx(0.22), sy(0.55), sx(0.5), sy(0.58));
    context.bezierCurveTo(sx(0.78), sy(0.55), sx(0.78), sy(0.28), sx(0.5), sy(0.18));
    context.closePath();
    stroke();
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.18));
    context.lineTo(sx(0.5), sy(0.4));
    stroke();
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.58));
    context.lineTo(sx(0.5), sy(0.88));
    stroke();
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.72));
    context.quadraticCurveTo(sx(0.72), sy(0.65), sx(0.78), sy(0.78));
    context.quadraticCurveTo(sx(0.6), sy(0.82), sx(0.5), sy(0.76));
    stroke();
  } else if (id === 'rings') {
    context.beginPath();
    context.arc(sx(0.38), sy(0.52), Math.min(w, h) * 0.22, 0, Math.PI * 2);
    stroke();
    context.beginPath();
    context.arc(sx(0.62), sy(0.52), Math.min(w, h) * 0.22, 0, Math.PI * 2);
    stroke();
  } else if (id === 'wave') {
    context.beginPath();
    context.moveTo(sx(0.08), sy(0.55));
    context.quadraticCurveTo(sx(0.22), sy(0.3), sx(0.38), sy(0.55));
    context.quadraticCurveTo(sx(0.54), sy(0.8), sx(0.7), sy(0.55));
    context.quadraticCurveTo(sx(0.86), sy(0.3), sx(0.95), sy(0.45));
    stroke();
    context.beginPath();
    context.moveTo(sx(0.08), sy(0.7));
    context.quadraticCurveTo(sx(0.22), sy(0.45), sx(0.38), sy(0.7));
    context.quadraticCurveTo(sx(0.54), sy(0.95), sx(0.7), sy(0.7));
    context.quadraticCurveTo(sx(0.86), sy(0.45), sx(0.95), sy(0.6));
    stroke();
  } else if (id === 'sparkle') {
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.1));
    context.lineTo(sx(0.58), sy(0.42));
    context.lineTo(sx(0.9), sy(0.5));
    context.lineTo(sx(0.58), sy(0.58));
    context.lineTo(sx(0.5), sy(0.9));
    context.lineTo(sx(0.42), sy(0.58));
    context.lineTo(sx(0.1), sy(0.5));
    context.lineTo(sx(0.42), sy(0.42));
    context.closePath();
    stroke();
    context.beginPath();
    context.moveTo(sx(0.78), sy(0.18));
    context.lineTo(sx(0.78), sy(0.32));
    context.moveTo(sx(0.71), sy(0.25));
    context.lineTo(sx(0.85), sy(0.25));
    stroke();
  } else if (id === 'gift') {
    context.beginPath();
    context.rect(sx(0.18), sy(0.42), w * 0.64, h * 0.42);
    stroke();
    context.beginPath();
    context.rect(sx(0.14), sy(0.32), w * 0.72, h * 0.12);
    stroke();
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.32));
    context.lineTo(sx(0.5), sy(0.84));
    context.moveTo(sx(0.18), sy(0.58));
    context.lineTo(sx(0.82), sy(0.58));
    stroke();
    context.beginPath();
    context.moveTo(sx(0.5), sy(0.32));
    context.quadraticCurveTo(sx(0.28), sy(0.1), sx(0.35), sy(0.32));
    context.moveTo(sx(0.5), sy(0.32));
    context.quadraticCurveTo(sx(0.72), sy(0.1), sx(0.65), sy(0.32));
    stroke();
  } else if (id === 'cat') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.38,0,Math.PI*2);stroke();context.beginPath();context.arc(sx(0.36),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.64),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.16,0.15*Math.PI,0.85*Math.PI);stroke();
  } else if (id === 'dog') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.38,0,Math.PI*2);stroke();context.beginPath();context.arc(sx(0.36),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.64),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.16,0.15*Math.PI,0.85*Math.PI);stroke();
  } else if (id === 'rabbit') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.38,0,Math.PI*2);stroke();context.beginPath();context.arc(sx(0.36),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.64),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.16,0.15*Math.PI,0.85*Math.PI);stroke();
  } else if (id === 'bird') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.38,0,Math.PI*2);stroke();context.beginPath();context.arc(sx(0.36),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.64),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.16,0.15*Math.PI,0.85*Math.PI);stroke();
  } else if (id === 'fish') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.35,0,Math.PI*2);stroke();
  } else if (id === 'butterfly') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.35,0,Math.PI*2);stroke();
  } else if (id === 'bear') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.38,0,Math.PI*2);stroke();context.beginPath();context.arc(sx(0.36),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.64),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.16,0.15*Math.PI,0.85*Math.PI);stroke();
  } else if (id === 'chick') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.38,0,Math.PI*2);stroke();context.beginPath();context.arc(sx(0.36),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.64),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.16,0.15*Math.PI,0.85*Math.PI);stroke();
  } else if (id === 'fox') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.38,0,Math.PI*2);stroke();context.beginPath();context.arc(sx(0.36),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.64),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.16,0.15*Math.PI,0.85*Math.PI);stroke();
  } else if (id === 'apple') {
    context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.3,0,Math.PI*2);stroke();context.beginPath();context.moveTo(sx(0.35),sy(0.35));context.quadraticCurveTo(sx(0.5),sy(0.2),sx(0.65),sy(0.35));stroke();
  } else if (id === 'bread') {
    context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.3,0,Math.PI*2);stroke();context.beginPath();context.moveTo(sx(0.35),sy(0.35));context.quadraticCurveTo(sx(0.5),sy(0.2),sx(0.65),sy(0.35));stroke();
  } else if (id === 'coffee') {
    context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.3,0,Math.PI*2);stroke();context.beginPath();context.moveTo(sx(0.35),sy(0.35));context.quadraticCurveTo(sx(0.5),sy(0.2),sx(0.65),sy(0.35));stroke();
  } else if (id === 'ice_cream') {
    context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.3,0,Math.PI*2);stroke();context.beginPath();context.moveTo(sx(0.35),sy(0.35));context.quadraticCurveTo(sx(0.5),sy(0.2),sx(0.65),sy(0.35));stroke();
  } else if (id === 'pizza') {
    context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.3,0,Math.PI*2);stroke();context.beginPath();context.moveTo(sx(0.35),sy(0.35));context.quadraticCurveTo(sx(0.5),sy(0.2),sx(0.65),sy(0.35));stroke();
  } else if (id === 'egg') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.35,0,Math.PI*2);stroke();
  } else if (id === 'bowl') {
    context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.3,0,Math.PI*2);stroke();context.beginPath();context.moveTo(sx(0.35),sy(0.35));context.quadraticCurveTo(sx(0.5),sy(0.2),sx(0.65),sy(0.35));stroke();
  } else if (id === 'chopsticks') {
    context.beginPath();context.moveTo(sx(0.25),sy(0.75));context.lineTo(sx(0.75),sy(0.25));context.moveTo(sx(0.3),sy(0.3));context.lineTo(sx(0.45),sy(0.2));context.lineTo(sx(0.55),sy(0.3));context.lineTo(sx(0.4),sy(0.4));stroke();
  } else if (id === 'strawberry') {
    context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.3,0,Math.PI*2);stroke();context.beginPath();context.moveTo(sx(0.35),sy(0.35));context.quadraticCurveTo(sx(0.5),sy(0.2),sx(0.65),sy(0.35));stroke();
  } else if (id === 'balloon') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.35,0,Math.PI*2);stroke();
  } else if (id === 'bells') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.35,0,Math.PI*2);stroke();
  } else if (id === 'champagne') {
    context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.3,0,Math.PI*2);stroke();context.beginPath();context.moveTo(sx(0.35),sy(0.35));context.quadraticCurveTo(sx(0.5),sy(0.2),sx(0.65),sy(0.35));stroke();
  } else if (id === 'bow_tie') {
    context.beginPath();context.rect(sx(0.2),sy(0.35),w*0.6,h*0.45);stroke();context.beginPath();context.moveTo(sx(0.2),sy(0.35));context.lineTo(sx(0.5),sy(0.15));context.lineTo(sx(0.8),sy(0.35));stroke();
  } else if (id === 'earring') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.35,0,Math.PI*2);stroke();
  } else if (id === 'necklace') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.35,0,Math.PI*2);stroke();
  } else if (id === 'gem') {
    context.beginPath();context.rect(sx(0.2),sy(0.35),w*0.6,h*0.45);stroke();context.beginPath();context.moveTo(sx(0.2),sy(0.35));context.lineTo(sx(0.5),sy(0.15));context.lineTo(sx(0.8),sy(0.35));stroke();
  } else if (id === 'crown') {
    context.beginPath();context.rect(sx(0.2),sy(0.35),w*0.6,h*0.45);stroke();context.beginPath();context.moveTo(sx(0.2),sy(0.35));context.lineTo(sx(0.5),sy(0.15));context.lineTo(sx(0.8),sy(0.35));stroke();
  } else if (id === 'sun') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.35,0,Math.PI*2);stroke();
  } else if (id === 'cloud') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.35,0,Math.PI*2);stroke();
  } else if (id === 'rain') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.35,0,Math.PI*2);stroke();
  } else if (id === 'moon') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.35,0,Math.PI*2);stroke();
  } else if (id === 'lightning') {
    context.beginPath();context.moveTo(sx(0.5),sy(0.12));context.lineTo(sx(0.88),sy(0.82));context.lineTo(sx(0.12),sy(0.82));context.closePath();stroke();
  } else if (id === 'wrench') {
    context.beginPath();context.moveTo(sx(0.25),sy(0.75));context.lineTo(sx(0.75),sy(0.25));context.moveTo(sx(0.3),sy(0.3));context.lineTo(sx(0.45),sy(0.2));context.lineTo(sx(0.55),sy(0.3));context.lineTo(sx(0.4),sy(0.4));stroke();
  } else if (id === 'hammer') {
    context.beginPath();context.moveTo(sx(0.25),sy(0.75));context.lineTo(sx(0.75),sy(0.25));context.moveTo(sx(0.3),sy(0.3));context.lineTo(sx(0.45),sy(0.2));context.lineTo(sx(0.55),sy(0.3));context.lineTo(sx(0.4),sy(0.4));stroke();
  } else if (id === 'gear') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.35,0,Math.PI*2);stroke();
  } else if (id === 'key') {
    context.beginPath();context.moveTo(sx(0.25),sy(0.75));context.lineTo(sx(0.75),sy(0.25));context.moveTo(sx(0.3),sy(0.3));context.lineTo(sx(0.45),sy(0.2));context.lineTo(sx(0.55),sy(0.3));context.lineTo(sx(0.4),sy(0.4));stroke();
  } else if (id === 'lock') {
    context.beginPath();context.rect(sx(0.2),sy(0.35),w*0.6,h*0.45);stroke();context.beginPath();context.moveTo(sx(0.2),sy(0.35));context.lineTo(sx(0.5),sy(0.15));context.lineTo(sx(0.8),sy(0.35));stroke();
  } else if (id === 'pen') {
    context.beginPath();context.moveTo(sx(0.25),sy(0.75));context.lineTo(sx(0.75),sy(0.25));context.moveTo(sx(0.3),sy(0.3));context.lineTo(sx(0.45),sy(0.2));context.lineTo(sx(0.55),sy(0.3));context.lineTo(sx(0.4),sy(0.4));stroke();
  } else if (id === 'folder') {
    context.beginPath();context.rect(sx(0.2),sy(0.35),w*0.6,h*0.45);stroke();context.beginPath();context.moveTo(sx(0.2),sy(0.35));context.lineTo(sx(0.5),sy(0.15));context.lineTo(sx(0.8),sy(0.35));stroke();
  } else if (id === 'calendar') {
    context.beginPath();context.rect(sx(0.2),sy(0.35),w*0.6,h*0.45);stroke();context.beginPath();context.moveTo(sx(0.2),sy(0.35));context.lineTo(sx(0.5),sy(0.15));context.lineTo(sx(0.8),sy(0.35));stroke();
  } else if (id === 'clipboard') {
    context.beginPath();context.rect(sx(0.2),sy(0.35),w*0.6,h*0.45);stroke();context.beginPath();context.moveTo(sx(0.2),sy(0.35));context.lineTo(sx(0.5),sy(0.15));context.lineTo(sx(0.8),sy(0.35));stroke();
  } else if (id === 'printer') {
    context.beginPath();context.rect(sx(0.2),sy(0.35),w*0.6,h*0.45);stroke();context.beginPath();context.moveTo(sx(0.2),sy(0.35));context.lineTo(sx(0.5),sy(0.15));context.lineTo(sx(0.8),sy(0.35));stroke();
  } else if (id === 'trophy') {
    context.beginPath();context.rect(sx(0.2),sy(0.35),w*0.6,h*0.45);stroke();context.beginPath();context.moveTo(sx(0.2),sy(0.35));context.lineTo(sx(0.5),sy(0.15));context.lineTo(sx(0.8),sy(0.35));stroke();
  } else if (id === 'flag') {
    context.beginPath();context.moveTo(sx(0.25),sy(0.75));context.lineTo(sx(0.75),sy(0.25));context.moveTo(sx(0.3),sy(0.3));context.lineTo(sx(0.45),sy(0.2));context.lineTo(sx(0.55),sy(0.3));context.lineTo(sx(0.4),sy(0.4));stroke();
  } else if (id === 'target') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.35,0,Math.PI*2);stroke();
  } else if (id === 'wink') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.38,0,Math.PI*2);stroke();context.beginPath();context.arc(sx(0.36),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.64),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.16,0.15*Math.PI,0.85*Math.PI);stroke();
  } else if (id === 'sad') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.38,0,Math.PI*2);stroke();context.beginPath();context.arc(sx(0.36),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.64),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.16,0.15*Math.PI,0.85*Math.PI);stroke();
  } else if (id === 'cool') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.38,0,Math.PI*2);stroke();context.beginPath();context.arc(sx(0.36),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.64),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.16,0.15*Math.PI,0.85*Math.PI);stroke();
  } else if (id === 'love_face') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.38,0,Math.PI*2);stroke();context.beginPath();context.arc(sx(0.36),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.64),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.16,0.15*Math.PI,0.85*Math.PI);stroke();
  } else if (id === 'cart') {
    context.beginPath();context.rect(sx(0.2),sy(0.35),w*0.6,h*0.45);stroke();context.beginPath();context.moveTo(sx(0.2),sy(0.35));context.lineTo(sx(0.5),sy(0.15));context.lineTo(sx(0.8),sy(0.35));stroke();
  } else if (id === 'bag') {
    context.beginPath();context.rect(sx(0.2),sy(0.35),w*0.6,h*0.45);stroke();context.beginPath();context.moveTo(sx(0.2),sy(0.35));context.lineTo(sx(0.5),sy(0.15));context.lineTo(sx(0.8),sy(0.35));stroke();
  } else if (id === 'tag') {
    context.beginPath();context.rect(sx(0.2),sy(0.35),w*0.6,h*0.45);stroke();context.beginPath();context.moveTo(sx(0.2),sy(0.35));context.lineTo(sx(0.5),sy(0.15));context.lineTo(sx(0.8),sy(0.35));stroke();
  } else if (id === 'store') {
    context.beginPath();context.rect(sx(0.2),sy(0.35),w*0.6,h*0.45);stroke();context.beginPath();context.moveTo(sx(0.2),sy(0.35));context.lineTo(sx(0.5),sy(0.15));context.lineTo(sx(0.8),sy(0.35));stroke();
  } else if (id === 'chat') {
    context.beginPath();context.rect(sx(0.2),sy(0.35),w*0.6,h*0.45);stroke();context.beginPath();context.moveTo(sx(0.2),sy(0.35));context.lineTo(sx(0.5),sy(0.15));context.lineTo(sx(0.8),sy(0.35));stroke();
  } else if (id === 'user') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.38,0,Math.PI*2);stroke();context.beginPath();context.arc(sx(0.36),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.64),sy(0.42),Math.min(w,h)*0.03,0,Math.PI*2);fill();context.beginPath();context.arc(sx(0.5),sy(0.52),Math.min(w,h)*0.16,0.15*Math.PI,0.85*Math.PI);stroke();
  } else if (id === 'home') {
    context.beginPath();context.rect(sx(0.2),sy(0.35),w*0.6,h*0.45);stroke();context.beginPath();context.moveTo(sx(0.2),sy(0.35));context.lineTo(sx(0.5),sy(0.15));context.lineTo(sx(0.8),sy(0.35));stroke();
  } else if (id === 'link') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.35,0,Math.PI*2);stroke();
  } else if (id === 'truck') {
    context.beginPath();context.rect(sx(0.2),sy(0.35),w*0.6,h*0.45);stroke();context.beginPath();context.moveTo(sx(0.2),sy(0.35));context.lineTo(sx(0.5),sy(0.15));context.lineTo(sx(0.8),sy(0.35));stroke();
  } else if (id === 'plane') {
    context.beginPath();context.moveTo(sx(0.25),sy(0.75));context.lineTo(sx(0.75),sy(0.25));context.moveTo(sx(0.3),sy(0.3));context.lineTo(sx(0.45),sy(0.2));context.lineTo(sx(0.55),sy(0.3));context.lineTo(sx(0.4),sy(0.4));stroke();
  } else if (id === 'package') {
    context.beginPath();context.rect(sx(0.2),sy(0.35),w*0.6,h*0.45);stroke();context.beginPath();context.moveTo(sx(0.2),sy(0.35));context.lineTo(sx(0.5),sy(0.15));context.lineTo(sx(0.8),sy(0.35));stroke();
  } else if (id === 'triangle') {
    context.beginPath();context.moveTo(sx(0.5),sy(0.12));context.lineTo(sx(0.88),sy(0.82));context.lineTo(sx(0.12),sy(0.82));context.closePath();stroke();
  } else if (id === 'plus') {
    context.beginPath();context.moveTo(sx(0.25),sy(0.75));context.lineTo(sx(0.75),sy(0.25));context.moveTo(sx(0.3),sy(0.3));context.lineTo(sx(0.45),sy(0.2));context.lineTo(sx(0.55),sy(0.3));context.lineTo(sx(0.4),sy(0.4));stroke();
  } else if (id === 'minus') {
    context.beginPath();context.moveTo(sx(0.25),sy(0.75));context.lineTo(sx(0.75),sy(0.25));context.moveTo(sx(0.3),sy(0.3));context.lineTo(sx(0.45),sy(0.2));context.lineTo(sx(0.55),sy(0.3));context.lineTo(sx(0.4),sy(0.4));stroke();
  } else if (id === 'star_fill') {
    context.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5;const r=i%2===0?0.42:0.18;const px=sx(0.5+Math.cos(a)*r);const py=sy(0.5+Math.sin(a)*r);if(i===0)context.moveTo(px,py);else context.lineTo(px,py);}context.closePath();fill();
  } else if (id === 'heart_fill') {
    context.beginPath();context.moveTo(sx(0.5),sy(0.82));context.bezierCurveTo(sx(0.15),sy(0.58),sx(0.08),sy(0.32),sx(0.28),sy(0.22));context.bezierCurveTo(sx(0.4),sy(0.16),sx(0.5),sy(0.26),sx(0.5),sy(0.36));context.bezierCurveTo(sx(0.5),sy(0.26),sx(0.6),sy(0.16),sx(0.72),sy(0.22));context.bezierCurveTo(sx(0.92),sy(0.32),sx(0.85),sy(0.58),sx(0.5),sy(0.82));context.closePath();fill();
  } else if (id === 'lantern') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.35,0,Math.PI*2);stroke();
  } else if (id === 'red_packet') {
    context.beginPath();context.rect(sx(0.2),sy(0.35),w*0.6,h*0.45);stroke();context.beginPath();context.moveTo(sx(0.2),sy(0.35));context.lineTo(sx(0.5),sy(0.15));context.lineTo(sx(0.8),sy(0.35));stroke();
  } else if (id === 'tree') {
    context.beginPath();context.moveTo(sx(0.5),sy(0.85));context.lineTo(sx(0.5),sy(0.4));stroke();context.beginPath();context.arc(sx(0.5),sy(0.35),Math.min(w,h)*0.2,0,Math.PI*2);stroke();
  } else if (id === 'rose') {
    context.beginPath();context.moveTo(sx(0.5),sy(0.85));context.lineTo(sx(0.5),sy(0.4));stroke();context.beginPath();context.arc(sx(0.5),sy(0.35),Math.min(w,h)*0.2,0,Math.PI*2);stroke();
  } else if (id === 'cactus') {
    context.beginPath();context.moveTo(sx(0.5),sy(0.85));context.lineTo(sx(0.5),sy(0.4));stroke();context.beginPath();context.arc(sx(0.5),sy(0.35),Math.min(w,h)*0.2,0,Math.PI*2);stroke();
  } else if (id === 'sunflower') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.35,0,Math.PI*2);stroke();
  } else if (id === 'electricity') {
    context.beginPath();context.moveTo(sx(0.5),sy(0.12));context.lineTo(sx(0.88),sy(0.82));context.lineTo(sx(0.12),sy(0.82));context.closePath();stroke();
  } else if (id === 'high_temp') {
    context.beginPath();context.moveTo(sx(0.5),sy(0.12));context.lineTo(sx(0.88),sy(0.82));context.lineTo(sx(0.12),sy(0.82));context.closePath();stroke();
  } else if (id === 'medal') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.35,0,Math.PI*2);stroke();
  } else if (id === 'ribbon') {
    context.beginPath();context.rect(sx(0.2),sy(0.35),w*0.6,h*0.45);stroke();context.beginPath();context.moveTo(sx(0.2),sy(0.35));context.lineTo(sx(0.5),sy(0.15));context.lineTo(sx(0.8),sy(0.35));stroke();
  } else if (id === 'arrow_double') {
    context.beginPath();context.moveTo(sx(0.2),sy(0.5));context.lineTo(sx(0.8),sy(0.5));context.moveTo(sx(0.65),sy(0.35));context.lineTo(sx(0.8),sy(0.5));context.lineTo(sx(0.65),sy(0.65));stroke();
  } else if (id === 'refresh') {
    context.beginPath();context.arc(sx(0.5),sy(0.5),Math.min(w,h)*0.35,0,Math.PI*2);stroke();
  } else if (id === 'download') {
    context.beginPath();context.moveTo(sx(0.2),sy(0.5));context.lineTo(sx(0.8),sy(0.5));context.moveTo(sx(0.65),sy(0.35));context.lineTo(sx(0.8),sy(0.5));context.lineTo(sx(0.65),sy(0.65));stroke();
  } else if (id === 'upload') {
    context.beginPath();context.moveTo(sx(0.2),sy(0.5));context.lineTo(sx(0.8),sy(0.5));context.moveTo(sx(0.65),sy(0.35));context.lineTo(sx(0.8),sy(0.5));context.lineTo(sx(0.65),sy(0.65));stroke();
  } else {
    // fallback check
    context.beginPath();
    context.moveTo(sx(0.12), sy(0.52));
    context.lineTo(sx(0.38), sy(0.78));
    context.lineTo(sx(0.9), sy(0.2));
    stroke();
  }

  context.restore();
}

module.exports = {
  DEFAULT_MATERIAL_CHIP,
  MATERIAL_CATALOG,
  MATERIAL_CHIPS,
  ORIGINAL_MATERIAL_CATALOG,
  ORIGINAL_MATERIAL_MANIFEST,
  SHANGYUE_SCENE_MATERIAL_SYMBOL_IDS,
  SHANGYUE_SCENE_MATERIALS,
  applyMaterialToElement,
  drawMaterialSymbol,
  drawShangyueSceneMaterialSymbol,
  materialChipAfterSearchToggle,
  materialById,
  materialCategories,
  materialsForChip
};
