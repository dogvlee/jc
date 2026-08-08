/** Built-in monochrome materials for thermal labels (vector, 0..1 unit box). */
const MATERIAL_CHIPS = [
  '最新', '热门', '可爱', 'VIP', '饰品', '祝福', '园艺',
  '标记', '警示', '物流', '箭头', '联系', '餐饮', '零售', '形状'
];

const MATERIAL_CATALOG = [
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
  { id: 'diamond', label: '菱形', category: '形状', tags: ["形状", "饰品", "VIP"], vip: true },
  { id: 'hexagon', label: '六边', category: '形状', tags: ["形状"] },
  { id: 'square_round', label: '圆角方', category: '形状', tags: ["形状"] },
  { id: 'panda', label: '熊猫', category: '表情', tags: ["可爱", "最新", "热门"] },
  { id: 'cake', label: '蛋糕', category: '通用', tags: ["祝福", "可爱", "最新"] },
  { id: 'bracelet', label: '手链', category: '通用', tags: ["饰品", "VIP", "最新"], vip: true },
  { id: 'pendant', label: '吊坠', category: '通用', tags: ["饰品", "祝福"] },
  { id: 'lotus', label: '莲花', category: '通用', tags: ["园艺", "祝福"] },
  { id: 'plum', label: '梅花', category: '通用', tags: ["园艺", "祝福", "最新"] },
  { id: 'bamboo', label: '竹子', category: '通用', tags: ["园艺"] },
  { id: 'orchid', label: '兰花', category: '通用', tags: ["园艺", "VIP"], vip: true },
  { id: 'chrysanthemum', label: '菊花', category: '通用', tags: ["园艺", "祝福"] },
  { id: 'diamond_ring', label: '钻戒', category: '通用', tags: ["饰品", "VIP", "祝福"], vip: true },
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
  { id: 'fox', label: '狐狸', category: '表情', tags: ['可爱','VIP'], vip: true },
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
  { id: 'champagne', label: '香槟', category: '通用', tags: ['祝福','VIP'], vip: true },
  { id: 'bow_tie', label: '领结', category: '通用', tags: ['饰品','祝福'] },
  { id: 'earring', label: '耳环', category: '通用', tags: ['饰品','VIP'], vip: true },
  { id: 'necklace', label: '项链', category: '通用', tags: ['饰品','最新'] },
  { id: 'gem', label: '宝石', category: '通用', tags: ['饰品','VIP','热门'], vip: true },
  { id: 'crown', label: '皇冠', category: '通用', tags: ['VIP','饰品','热门'], vip: true },
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
  { id: 'trophy', label: '奖杯', category: '通用', tags: ['祝福','VIP','热门'], vip: true },
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
  { id: 'star_fill', label: '实心星', category: '形状', tags: ['形状','可爱','VIP'], vip: true },
  { id: 'heart_fill', label: '实心爱心', category: '形状', tags: ['形状','可爱','祝福'] },
  { id: 'lantern', label: '灯笼', category: '通用', tags: ['祝福','最新','热门'] },
  { id: 'red_packet', label: '红包', category: '通用', tags: ['祝福','热门'] },
  { id: 'tree', label: '树', category: '通用', tags: ['园艺'] },
  { id: 'rose', label: '玫瑰', category: '通用', tags: ['园艺','祝福','热门'] },
  { id: 'cactus', label: '仙人掌', category: '通用', tags: ['园艺','可爱'] },
  { id: 'sunflower', label: '向日葵', category: '通用', tags: ['园艺','最新'] },
  { id: 'electricity', label: '带电', category: '警示', tags: ['警示','热门'] },
  { id: 'high_temp', label: '高温', category: '警示', tags: ['警示'] },
  { id: 'medal', label: '奖牌', category: '通用', tags: ['VIP','祝福'], vip: true },
  { id: 'ribbon', label: '丝带', category: '通用', tags: ['祝福','饰品','VIP'], vip: true },
  { id: 'arrow_double', label: '双向', category: '箭头', tags: ['箭头'] },
  { id: 'refresh', label: '刷新', category: '箭头', tags: ['箭头','最新'] },
  { id: 'download', label: '下载', category: '箭头', tags: ['箭头'] },
  { id: 'upload', label: '上传', category: '箭头', tags: ['箭头'] }
];

function materialById(id) {
  return MATERIAL_CATALOG.find((item) => item.id === id) || MATERIAL_CATALOG[0];
}


/**
 * Filter catalog by chip (tag / category / VIP) and optional text query.
 * chip "搜索" or empty returns full catalog (query still applies).
 */
function materialsForChip(chip, query) {
  let list = MATERIAL_CATALOG.slice();
  const c = chip || '';
  if (c && c !== '搜索' && c !== '全部') {
    if (c === 'VIP') {
      list = list.filter((item) => item.vip);
    } else {
      list = list.filter((item) =>
        (item.tags && item.tags.includes(c)) || item.category === c
      );
    }
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
  MATERIAL_CATALOG,
  MATERIAL_CHIPS,
  drawMaterialSymbol,
  materialById,
  materialCategories,
  materialsForChip
};
