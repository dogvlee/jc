/**
 * Offline industry label layouts for the template experience.
 * Coordinates are millimeters. Layouts are clean-room designs matching
 * common label-printer product flows (retail / warehouse / office / lifestyle),
 * not copies of proprietary template JSON or remote assets.
 */
const { createDocument, createElement } = require('../core/document');

function text(doc, opts) {
  const el = createElement('text', doc);
  Object.assign(el, {
    text: '文本',
    fontSize: 3,
    bold: false,
    align: 'left',
    verticalAlign: 'middle',
    autoFit: true
  }, opts);
  return el;
}

function barcode(doc, opts) {
  const el = createElement('barcode', doc);
  Object.assign(el, {
    value: '6901234567892',
    format: 'ean13',
    showText: true,
    textPosition: 'bottom'
  }, opts);
  return el;
}

function qrcode(doc, opts) {
  const el = createElement('qrcode', doc);
  Object.assign(el, {
    value: 'https://example.com',
    errorCorrection: 'M'
  }, opts);
  return el;
}

function rect(doc, opts) {
  const el = createElement('rect', doc);
  Object.assign(el, {
    lineWidth: 0.35,
    filled: false
  }, opts);
  return el;
}

function line(doc, opts) {
  const el = createElement('line', doc);
  Object.assign(el, { lineWidth: 0.3 }, opts);
  return el;
}

function dateEl(doc, opts) {
  const el = createElement('date', doc);
  Object.assign(el, {
    format: 'YYYY-MM-DD',
    autoUpdate: true,
    fontSize: 2.8,
    autoFit: true
  }, opts);
  return el;
}

function serial(doc, opts) {
  const el = createElement('serial', doc);
  Object.assign(el, {
    prefix: 'SN-',
    suffix: '',
    start: 1,
    step: 1,
    digits: 4,
    fontSize: 3,
    autoFit: true
  }, opts);
  return el;
}

function material(doc, opts) {
  const el = createElement('material', doc);
  Object.assign(el, { symbol: 'star' }, opts);
  return el;
}

function finish(doc, name, meta) {
  doc.name = name;
  if (meta) {
    doc.templateMeta = meta;
  }
  return doc;
}

function shangyueOriginalMeta(industry, stock, extra) {
  return Object.assign({
    industry,
    stock,
    origin: 'shangyue-original',
    authorship: 'shangyue-clean-room',
    designVersion: '1.1.0',
    createdAt: '2026-08-17',
    copyright: '© 2026 商跃',
    thirdPartyAssets: false,
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    batchCompatible: false
  }, extra || {});
}

/** 商品价格 · 40×30 · 条码价签 */
function layoutProductPrice() {
  const doc = createDocument(40, 30);
  doc.elements = [
    text(doc, {
      x: 1.5, y: 1.2, width: 37, height: 5.5,
      text: '精选苹果', fontSize: 4.2, bold: true, align: 'center'
    }),
    text(doc, {
      x: 1.5, y: 7, width: 22, height: 3,
      text: '产地：烟台', fontSize: 2.4
    }),
    text(doc, {
      x: 23, y: 7, width: 15.5, height: 3,
      text: '规格：箱', fontSize: 2.4, align: 'right'
    }),
    text(doc, {
      x: 1.5, y: 10.5, width: 18, height: 5,
      text: '¥12.80', fontSize: 4.5, bold: true
    }),
    text(doc, {
      x: 20, y: 11, width: 18.5, height: 3.5,
      text: '会员 ¥11.50', fontSize: 2.6, align: 'right'
    }),
    barcode(doc, {
      x: 2, y: 16.5, width: 36, height: 11.5,
      value: '6901234567892', format: 'ean13'
    })
  ];
  return finish(doc, '商品价格标签', { industry: '零售', stock: '40×30' });
}

/** 珠宝吊牌 · 40×30 */
function layoutJewelry() {
  const doc = createDocument(40, 30);
  doc.elements = [
    text(doc, {
      x: 2, y: 1.5, width: 36, height: 4.5,
      text: 'SHANGYUE JEWELRY', fontSize: 3.2, bold: true, align: 'center',
      fontFamily: 'serif'
    }),
    line(doc, { x: 6, y: 6.5, width: 28, height: 0.8, lineWidth: 0.25 }),
    text(doc, { x: 2.5, y: 8, width: 35, height: 2.8, text: '类型：红宝石手链', fontSize: 2.3 }),
    text(doc, { x: 2.5, y: 11, width: 35, height: 2.8, text: '编号：SY-8842', fontSize: 2.3 }),
    text(doc, { x: 2.5, y: 14, width: 35, height: 2.8, text: '重量：5.2g', fontSize: 2.3 }),
    text(doc, {
      x: 2.5, y: 17.5, width: 35, height: 4,
      text: '¥2,580', fontSize: 4, bold: true, align: 'center'
    }),
    barcode(doc, {
      x: 4, y: 22, width: 32, height: 6.5,
      value: '123456789012', format: 'code128', showText: false
    })
  ];
  return finish(doc, '珠宝价格标签', { industry: '零售', stock: '40×30' });
}

/** 仓储货架 · 50×30 · 二维码 */
function layoutWarehouse() {
  const doc = createDocument(50, 30);
  doc.elements = [
    text(doc, {
      x: 2, y: 1.5, width: 30, height: 5,
      text: 'A-03-12', fontSize: 5, bold: true
    }),
    text(doc, {
      x: 2, y: 7.5, width: 30, height: 3,
      text: '货架区位 · 冷链区', fontSize: 2.5
    }),
    text(doc, {
      x: 2, y: 11.5, width: 30, height: 3,
      text: 'SKU：WH-2026-0812', fontSize: 2.4
    }),
    text(doc, {
      x: 2, y: 15.5, width: 30, height: 3,
      text: '品名：冷冻三文鱼', fontSize: 2.5, bold: true
    }),
    text(doc, {
      x: 2, y: 19.5, width: 30, height: 3,
      text: '批次：20260801', fontSize: 2.3
    }),
    text(doc, {
      x: 2, y: 23.5, width: 30, height: 3,
      text: '数量：24 箱', fontSize: 2.4
    }),
    qrcode(doc, {
      x: 34, y: 4, width: 14, height: 14,
      value: 'WH://A-03-12/WH-2026-0812'
    }),
    text(doc, {
      x: 34, y: 19, width: 14, height: 3,
      text: '扫码入库', fontSize: 2, align: 'center'
    })
  ];
  return finish(doc, '仓储货架标签', { industry: '仓储', stock: '50×30' });
}

/** 线缆标识 · 40×12 横向小标 */
function layoutCable() {
  const doc = createDocument(40, 12);
  doc.elements = [
    text(doc, {
      x: 1.2, y: 1, width: 21, height: 4.5,
      text: 'CAT6-A 蓝', fontSize: 3.6, bold: true
    }),
    text(doc, {
      x: 1.2, y: 6, width: 21, height: 4,
      text: '机房 B · 机柜 12', fontSize: 2.4
    }),
    // Code128 needs ~15.1mm for a 6-character id at 203dpi; anything narrower
    // makes the whole template unprintable.
    barcode(doc, {
      x: 22.5, y: 1.5, width: 16, height: 9,
      value: 'CB1206', format: 'code128', showText: false
    })
  ];
  return finish(doc, '线缆分类标签', { industry: '办公', stock: '40×12' });
}

/** 食品日期 · 40×30 */
function layoutFoodDate() {
  const doc = createDocument(40, 30);
  doc.elements = [
    text(doc, {
      x: 2, y: 1.5, width: 36, height: 5,
      text: '自制酸奶', fontSize: 4.2, bold: true, align: 'center'
    }),
    rect(doc, { x: 2, y: 7.5, width: 36, height: 0.4, filled: true, lineWidth: 0.2 }),
    text(doc, { x: 2.5, y: 9, width: 14, height: 3, text: '制作日期', fontSize: 2.3 }),
    dateEl(doc, {
      x: 16, y: 8.8, width: 21.5, height: 3.5,
      label: '', showTime: false,
      format: 'YYYY-MM-DD', fontSize: 2.8, bold: true, align: 'right'
    }),
    text(doc, { x: 2.5, y: 13.5, width: 14, height: 3, text: '保质期至', fontSize: 2.3 }),
    dateEl(doc, {
      x: 16, y: 13.3, width: 21.5, height: 3.5,
      label: '', showTime: false,
      dateRole: 'expire', expireMode: 'preset', expirePresetHours: 24 * 7,
      format: 'YYYY-MM-DD', fontSize: 2.8, bold: true, align: 'right'
    }),
    text(doc, {
      x: 2.5, y: 18.5, width: 35, height: 3,
      text: '存放：冷藏 0–4℃', fontSize: 2.4
    }),
    text(doc, {
      x: 2.5, y: 22.5, width: 35, height: 5,
      text: '开封后 3 日内食用完', fontSize: 2.5
    })
  ];
  return finish(doc, '食品日期标签', { industry: '生活', stock: '40×30' });
}

/** 商跃原创心意卡 · 40×30 · 无第三方图片或字体 */
function layoutShangyueWishCard() {
  const doc = createDocument(40, 30);
  doc.elements = [
    text(doc, {
      x: 2.0, y: 2.0, width: 12.5, height: 3.4,
      text: '商跃原创', fontSize: 2.2, bold: true,
      reverse: true, align: 'center'
    }),
    text(doc, {
      x: 2.0, y: 6.2, width: 22.6, height: 5.2,
      text: '生日快乐', fontSize: 4.6, bold: true
    }),
    text(doc, {
      x: 2.0, y: 11.6, width: 22.6, height: 3.4,
      text: '新一岁 · 常欢喜', fontSize: 2.7, bold: true
    }),
    line(doc, {
      x: 2.0, y: 15.6, width: 20, height: 0.6,
      lineWidth: 0.35, locked: true
    }),
    text(doc, {
      x: 2.0, y: 17.2, width: 22.6, height: 8.8,
      text: '愿每一次出发\n都有好风景', fontSize: 2.6,
      lineSpacing: 1.35, verticalAlign: 'top'
    }),
    qrcode(doc, {
      x: 27.2, y: 6.8, width: 10.8, height: 10.8,
      value: '生日快乐，愿你常欢喜。', errorCorrection: 'M'
    }),
    text(doc, {
      x: 26.0, y: 18.4, width: 12.0, height: 3.2,
      text: '扫码见心意', fontSize: 2.2, align: 'center'
    }),
    serial(doc, {
      x: 26.4, y: 22.2, width: 11.6, height: 3.4,
      prefix: 'NO.', start: 1, digits: 4,
      fontSize: 2.2, align: 'center'
    })
  ];
  return finish(doc, '商跃心意祝福卡', {
    industry: '生活',
    stock: '40×30',
    origin: 'shangyue-original',
    authorship: 'shangyue-clean-room',
    designVersion: '1.1.0',
    createdAt: '2026-08-16',
    copyright: '© 2026 商跃',
    thirdPartyAssets: false,
    approvedOriginal: true,
    approvalStatus: 'approved',
    publicCatalog: true,
    batchCompatible: false
  });
}

/** 商跃原创零售价签 · 40×30 · 圆角标题栏 + 双价 + EAN */
function layoutShangyuePriceTag() {
  const doc = createDocument(40, 30);
  doc.elements = [
    rect(doc, {
      x: 2.0, y: 1.8, width: 36.0, height: 4.2,
      filled: true, shapeKind: 'rounded', lineWidth: 0.2, locked: true
    }),
    text(doc, {
      x: 2.8, y: 2.1, width: 13.2, height: 3.6,
      text: '商跃价签', fontSize: 2.4, bold: true,
      reverse: true, align: 'left'
    }),
    text(doc, {
      x: 24.2, y: 2.1, width: 13.0, height: 3.6,
      text: '零售', fontSize: 2.2, bold: true,
      reverse: true, align: 'right'
    }),
    text(doc, {
      x: 2.0, y: 6.6, width: 36.0, height: 4.6,
      text: '云南青提', fontSize: 4.2, bold: true
    }),
    text(doc, {
      x: 2.0, y: 11.4, width: 36.0, height: 3.0,
      text: '产地 宾川 · 500g / 盒', fontSize: 2.3
    }),
    text(doc, {
      x: 2.0, y: 14.6, width: 20, height: 5.2,
      text: '¥16.80', fontSize: 4.8, bold: true
    }),
    text(doc, {
      x: 22.0, y: 15.4, width: 16.0, height: 3.2,
      text: '会员 15.20', fontSize: 2.3, align: 'right'
    }),
    barcode(doc, {
      x: 2.4, y: 20.2, width: 35.2, height: 7.6,
      value: '6901234567892', format: 'ean13'
    })
  ];
  return finish(doc, '商跃零售价签', shangyueOriginalMeta('零售', '40×30'));
}

/** 商跃原创仓储货位 · 40×30 · 大号货位 + 右侧码井 */
function layoutShangyueBinLabel() {
  const doc = createDocument(40, 30);
  doc.elements = [
    text(doc, {
      x: 2.0, y: 2.0, width: 12.8, height: 3.2,
      text: '商跃仓储', fontSize: 2.2, bold: true,
      reverse: true, align: 'center'
    }),
    text(doc, {
      x: 2.0, y: 6.0, width: 23.2, height: 5.0,
      text: 'A-12-08', fontSize: 4.2, bold: true
    }),
    text(doc, {
      x: 2.0, y: 11.4, width: 23.2, height: 2.8,
      text: 'SKU SY-WH-0817', fontSize: 2.2
    }),
    text(doc, {
      x: 2.0, y: 14.4, width: 23.2, height: 2.8,
      text: '冷冻蓝莓 5kg', fontSize: 2.4, bold: true
    }),
    text(doc, {
      x: 2.0, y: 17.4, width: 23.2, height: 2.6,
      text: '批次 20260817', fontSize: 2.2
    }),
    serial(doc, {
      x: 2.0, y: 21.6, width: 23.2, height: 3.2,
      prefix: 'BIN-', start: 1208, digits: 4,
      fontSize: 2.2
    }),
    qrcode(doc, {
      x: 26.4, y: 6.0, width: 11.2, height: 11.2,
      value: 'BIN://A-12-08/SY-WH-0817', errorCorrection: 'M'
    }),
    text(doc, {
      x: 26.0, y: 18.0, width: 12.0, height: 2.8,
      text: '扫码入库', fontSize: 2.2, align: 'center'
    })
  ];
  return finish(doc, '商跃仓储货位', shangyueOriginalMeta('仓储', '40×30'));
}

/** 商跃原创姓名贴 · 40×20 · 大字姓名 + 班级电话 */
function layoutShangyueNameSticker() {
  const doc = createDocument(40, 20);
  doc.elements = [
    text(doc, {
      x: 1.8, y: 1.8, width: 7.2, height: 3.0,
      text: '商跃', fontSize: 2.2, bold: true,
      reverse: true, align: 'center'
    }),
    text(doc, {
      x: 1.8, y: 5.2, width: 36.4, height: 6.2,
      text: '林晓舟', fontSize: 5.0, bold: true
    }),
    text(doc, {
      x: 1.8, y: 11.8, width: 36.4, height: 3.2,
      text: '三年二班 · 12 号', fontSize: 2.4
    }),
    text(doc, {
      x: 1.8, y: 15.2, width: 36.4, height: 2.8,
      text: '家属 138-0000-2288', fontSize: 2.2
    })
  ];
  return finish(doc, '商跃姓名贴', shangyueOriginalMeta('生活', '40×20'));
}

/** 商跃原创效期签 · 40×30 · 圆角标题栏 + 制作/食用日期表 */
function layoutShangyueFreshDate() {
  const doc = createDocument(40, 30);
  doc.elements = [
    rect(doc, {
      x: 2.0, y: 1.8, width: 36.0, height: 4.2,
      filled: true, shapeKind: 'rounded', lineWidth: 0.2, locked: true
    }),
    text(doc, {
      x: 2.8, y: 2.1, width: 13.0, height: 3.6,
      text: '商跃效期', fontSize: 2.4, bold: true,
      reverse: true, align: 'left'
    }),
    text(doc, {
      x: 25.2, y: 2.1, width: 12.0, height: 3.6,
      text: '冷藏', fontSize: 2.2, bold: true,
      reverse: true, align: 'right'
    }),
    text(doc, {
      x: 2.0, y: 6.6, width: 36.0, height: 4.6,
      text: '桂花酿', fontSize: 4.0, bold: true
    }),
    text(doc, {
      x: 2.0, y: 11.6, width: 8.2, height: 3.0,
      text: '制作', fontSize: 2.3
    }),
    dateEl(doc, {
      x: 10.6, y: 11.4, width: 27.4, height: 3.4,
      label: '', showTime: false,
      format: 'YYYY-MM-DD', fontSize: 2.6, bold: true, align: 'right'
    }),
    text(doc, {
      x: 2.0, y: 15.6, width: 8.2, height: 3.0,
      text: '食用至', fontSize: 2.3
    }),
    dateEl(doc, {
      x: 10.6, y: 15.4, width: 27.4, height: 3.4,
      label: '', showTime: false,
      dateRole: 'expire', expireMode: 'preset', expirePresetHours: 48,
      format: 'YYYY-MM-DD', fontSize: 2.6, bold: true, align: 'right'
    }),
    line(doc, {
      x: 2.0, y: 19.6, width: 36.0, height: 0.6,
      lineWidth: 0.3, locked: true
    }),
    text(doc, {
      x: 2.0, y: 21.0, width: 36.0, height: 6.4,
      text: '开封后请冷藏，当日用完', fontSize: 2.4,
      verticalAlign: 'top'
    })
  ];
  return finish(doc, '商跃效期签', shangyueOriginalMeta('生活', '40×30'));
}

/** 商跃原创连网码 · 40×30 · 左码右凭据的信息卡 */
function layoutShangyueWifiCard() {
  const doc = createDocument(40, 30);
  doc.elements = [
    text(doc, {
      x: 2.0, y: 2.0, width: 13.0, height: 3.0,
      text: '扫码加入', fontSize: 2.2, bold: true, align: 'center'
    }),
    qrcode(doc, {
      x: 2.0, y: 5.6, width: 13.0, height: 13.0,
      value: 'WIFI:T:WPA;S:SY-Guest;P:sy202609;;', errorCorrection: 'M'
    }),
    text(doc, {
      x: 2.0, y: 19.4, width: 13.0, height: 2.8,
      text: '访客网络', fontSize: 2.2, align: 'center'
    }),
    rect(doc, { x: 16.45, y: 2.0, width: 0.3, height: 25.8, filled: true, lineWidth: 0.2, locked: true }),
    text(doc, {
      x: 18.2, y: 2.0, width: 10.0, height: 3.0,
      text: '访客专用', fontSize: 2.2, bold: true,
      reverse: true, align: 'center'
    }),
    text(doc, {
      x: 18.2, y: 6.0, width: 19.4, height: 4.8,
      text: '访客通行证', fontSize: 3.6, bold: true
    }),
    text(doc, {
      x: 18.2, y: 11.0, width: 19.4, height: 2.8,
      text: 'SSID  SY-Guest', fontSize: 2.2
    }),
    rect(doc, {
      x: 18.2, y: 14.4, width: 19.4, height: 5.4,
      shapeKind: 'rect', lineWidth: 0.3, locked: true
    }),
    text(doc, {
      x: 19.0, y: 15.2, width: 17.8, height: 3.8,
      text: '密码 sy202609', fontSize: 2.2, bold: true, align: 'center'
    }),
    text(doc, {
      x: 18.2, y: 21.0, width: 19.4, height: 3.0,
      text: '打印后请改密码', fontSize: 2.2,
      bold: true
    }),
    text(doc, {
      x: 18.2, y: 24.4, width: 19.4, height: 2.6,
      text: '商跃 · 临时凭据', fontSize: 2.2
    })
  ];
  return finish(doc, '商跃连网码', shangyueOriginalMeta('办公', '40×30', {
    designVersion: '2.1.0', createdAt: '2026-08-18'
  }));
}

/** 商跃原创促销价签 · 40×30 · 上置条码 + 右侧反白价格舱 */
function layoutShangyuePromoTag() {
  const doc = createDocument(40, 30);
  doc.elements = [
    barcode(doc, { x: 2.0, y: 1.8, width: 36.0, height: 7.2, value: '6909876543212', format: 'ean13', showText: false }),
    line(doc, { x: 2.0, y: 9.6, width: 36.0, height: 0.4, lineWidth: 0.3, locked: true }),
    text(doc, { x: 2.0, y: 10.6, width: 19.8, height: 2.8, text: '周末闪促  /  02', fontSize: 2.2, bold: true }),
    text(doc, { x: 2.0, y: 13.6, width: 20.2, height: 5.0, text: '炭烤鸡腿堡', fontSize: 3.6, bold: true }),
    text(doc, { x: 2.0, y: 19.0, width: 20.2, height: 2.8, text: '两件起 · 门店自提', fontSize: 2.2 }),
    text(doc, { x: 2.0, y: 22.2, width: 20.2, height: 2.8, text: '日常 ¥12.00', fontSize: 2.2, strike: true }),
    text(doc, { x: 2.0, y: 25.4, width: 20.2, height: 2.4, text: '商跃门店优惠', fontSize: 2.2 }),
    rect(doc, { x: 23.6, y: 10.4, width: 14.4, height: 17.4, filled: true, shapeKind: 'rounded', lineWidth: 0.25, locked: true }),
    text(doc, { x: 24.4, y: 11.2, width: 12.8, height: 2.8, text: '到手价', fontSize: 2.2, bold: true, reverse: true, align: 'center' }),
    text(doc, { x: 24.2, y: 14.4, width: 13.2, height: 6.2, text: '¥6.90', fontSize: 4.6, bold: true, reverse: true, align: 'center' }),
    text(doc, { x: 24.4, y: 21.0, width: 12.8, height: 3.0, text: '立省 5.10', fontSize: 2.2, reverse: true, align: 'center' }),
    text(doc, { x: 24.4, y: 24.2, width: 12.8, height: 2.8, text: '售完为止', fontSize: 2.2, reverse: true, align: 'center' })
  ];
  return finish(doc, '商跃促销价签', shangyueOriginalMeta('零售', '40×30', {
    designVersion: '2.1.0', createdAt: '2026-08-18'
  }));
}

/** 商跃原创珠宝吊牌 · 40×30 */
function layoutShangyueJewelryTag() {
  const doc = createDocument(40, 30);
  doc.elements = [
    text(doc, { x: 2.0, y: 2.0, width: 13.2, height: 3.2, text: '商跃金饰', fontSize: 2.2, bold: true, reverse: true, align: 'center' }),
    text(doc, { x: 2.0, y: 6.0, width: 36.0, height: 4.6, text: '18K 红宝石手链', fontSize: 3.4, bold: true }),
    text(doc, { x: 2.0, y: 11.0, width: 36.0, height: 2.8, text: '编号 SY-J8842', fontSize: 2.3 }),
    text(doc, { x: 2.0, y: 14.2, width: 36.0, height: 2.8, text: '重量 5.2g · 手围 16cm', fontSize: 2.3 }),
    text(doc, { x: 2.0, y: 17.4, width: 36.0, height: 4.0, text: '¥2,580', fontSize: 3.8, bold: true }),
    barcode(doc, { x: 2.0, y: 21.8, width: 36.0, height: 6.0, value: 'SYJ8842', format: 'code128', showText: false })
  ];
  return finish(doc, '商跃珠宝吊牌', shangyueOriginalMeta('零售', '40×30'));
}

/** 商跃原创服装吊牌 · 40×30 */
function layoutShangyueGarmentTag() {
  const doc = createDocument(40, 30);
  doc.elements = [
    rect(doc, { x: 2.0, y: 1.8, width: 36.0, height: 4.2, filled: true, shapeKind: 'rounded', lineWidth: 0.2, locked: true }),
    text(doc, { x: 2.8, y: 2.1, width: 14.4, height: 3.6, text: '商跃成衣', fontSize: 2.4, bold: true, reverse: true }),
    text(doc, { x: 25.2, y: 2.1, width: 12.0, height: 3.6, text: '春夏', fontSize: 2.2, bold: true, reverse: true, align: 'right' }),
    text(doc, { x: 2.0, y: 6.6, width: 36.0, height: 4.4, text: '直筒牛仔裤', fontSize: 3.6, bold: true }),
    text(doc, { x: 2.0, y: 11.2, width: 36.0, height: 2.8, text: '款号 SY-2601 · 靛蓝', fontSize: 2.3 }),
    text(doc, { x: 2.0, y: 14.2, width: 36.0, height: 2.8, text: '尺码 M / 170 · 98% 棉', fontSize: 2.3 }),
    text(doc, { x: 2.0, y: 17.4, width: 36.0, height: 4.0, text: '¥299', fontSize: 3.8, bold: true }),
    barcode(doc, { x: 5.0, y: 21.8, width: 30.0, height: 6.2, value: '6901234567892', format: 'ean13', showText: false })
  ];
  return finish(doc, '商跃服装吊牌', shangyueOriginalMeta('零售', '40×30'));
}

/** 商跃原创物流简签 · 40×30 */
function layoutShangyueShipLabel() {
  const doc = createDocument(40, 30);
  doc.elements = [
    text(doc, { x: 2.0, y: 2.0, width: 13.2, height: 3.2, text: '商跃物流', fontSize: 2.2, bold: true, reverse: true, align: 'center' }),
    text(doc, { x: 2.0, y: 6.0, width: 23.2, height: 4.4, text: '华东仓', fontSize: 3.8, bold: true }),
    text(doc, { x: 2.0, y: 10.6, width: 23.2, height: 2.8, text: '杭州滨江 · 3 号库', fontSize: 2.2 }),
    text(doc, { x: 2.0, y: 13.8, width: 23.2, height: 2.8, text: '1/4 · 易碎轻放', fontSize: 2.2 }),
    qrcode(doc, { x: 26.4, y: 6.2, width: 11.2, height: 11.2, value: 'SHIP://SYF1024', errorCorrection: 'M' }),
    text(doc, { x: 26.0, y: 18.0, width: 12.0, height: 2.6, text: '扫码签收', fontSize: 2.2, align: 'center' }),
    barcode(doc, { x: 2.0, y: 21.4, width: 36.0, height: 6.4, value: 'SYF1024', format: 'code128', showText: false })
  ];
  return finish(doc, '商跃物流简签', shangyueOriginalMeta('仓储', '40×30'));
}

/** 商跃原创线缆标识 · 40×12 */
function layoutShangyueCableTag() {
  const doc = createDocument(40, 12);
  doc.elements = [
    text(doc, { x: 1.6, y: 1.5, width: 11.2, height: 4.8, text: 'CAT6', fontSize: 3.2, bold: true }),
    text(doc, { x: 1.6, y: 6.4, width: 11.2, height: 4.1, text: '柜 12', fontSize: 2.2 }),
    rect(doc, { x: 13.1, y: 2.4, width: 0.3, height: 7.2, filled: true, lineWidth: 0.2, locked: true }),
    barcode(doc, { x: 13.7, y: 1.5, width: 24.8, height: 9.0, value: 'C206', format: 'code128', showText: false })
  ];
  return finish(doc, '商跃线缆标识', shangyueOriginalMeta('办公', '40×12'));
}

/** 商跃原创固定资产 · 40×30 */
function layoutShangyueAssetTag() {
  const doc = createDocument(40, 30);
  doc.elements = [
    text(doc, { x: 2.0, y: 2.0, width: 13.2, height: 3.2, text: '商跃资产', fontSize: 2.2, bold: true, reverse: true, align: 'center' }),
    text(doc, { x: 2.0, y: 6.0, width: 23.2, height: 4.4, text: 'ThinkPad', fontSize: 3.6, bold: true }),
    text(doc, { x: 2.0, y: 10.8, width: 23.2, height: 2.8, text: '研发中心 · 张工', fontSize: 2.2 }),
    serial(doc, { x: 2.0, y: 14.0, width: 23.2, height: 3.2, prefix: 'FA-', start: 1024, digits: 4, fontSize: 2.4, bold: true }),
    text(doc, { x: 2.0, y: 17.8, width: 23.2, height: 2.6, text: '购置 2025-11', fontSize: 2.2 }),
    qrcode(doc, { x: 26.4, y: 6.2, width: 11.2, height: 11.2, value: 'FA-1024', serialLinked: true, errorCorrection: 'M' }),
    text(doc, { x: 26.0, y: 18.2, width: 12.0, height: 2.8, text: '扫码盘点', fontSize: 2.2, align: 'center' }),
    line(doc, { x: 2.0, y: 23.4, width: 36.0, height: 0.3, lineWidth: 0.3, locked: true }),
    text(doc, { x: 2.0, y: 24.4, width: 36.0, height: 3.0, text: '资产编号唯一 · 请勿撕毁', fontSize: 2.2 })
  ];
  return finish(doc, '商跃固定资产', shangyueOriginalMeta('办公', '40×30'));
}

/** 商跃原创商务名片 · 40×30 */
function layoutShangyueBizCard() {
  const doc = createDocument(40, 30);
  doc.elements = [
    text(doc, { x: 2.0, y: 2.0, width: 8.4, height: 3.2, text: '商跃', fontSize: 2.2, bold: true, reverse: true, align: 'center' }),
    text(doc, { x: 2.0, y: 6.0, width: 23.2, height: 5.0, text: '周衡', fontSize: 4.4, bold: true }),
    text(doc, { x: 2.0, y: 11.4, width: 23.2, height: 2.8, text: '产品设计', fontSize: 2.4 }),
    text(doc, { x: 2.0, y: 14.8, width: 23.2, height: 2.8, text: '000-0000-0000', fontSize: 2.2 }),
    text(doc, { x: 2.0, y: 18.0, width: 23.2, height: 2.8, text: 'demo@example.com', fontSize: 2.2 }),
    qrcode(doc, { x: 26.4, y: 7.0, width: 11.2, height: 11.2, value: 'MECARD:N:周衡;TEL:000-0000-0000;', errorCorrection: 'M' }),
    line(doc, { x: 2.0, y: 23.4, width: 36.0, height: 0.3, lineWidth: 0.3, locked: true }),
    text(doc, { x: 2.0, y: 24.4, width: 36.0, height: 3.0, text: '商跃科技有限公司', fontSize: 2.2, bold: true })
  ];
  return finish(doc, '商跃商务名片', shangyueOriginalMeta('办公', '40×30'));
}

/** 商跃原创餐饮效期 · 40×30 · 双时间窗格 */
function layoutShangyueKitchenDate() {
  const doc = createDocument(40, 30);
  doc.elements = [
    text(doc, { x: 2.0, y: 1.8, width: 21.0, height: 4.2, text: '香草鸡汤', fontSize: 3.6, bold: true }),
    text(doc, { x: 26.0, y: 2.0, width: 12.0, height: 3.2, text: '0–4℃', fontSize: 2.2, bold: true, reverse: true, align: 'center' }),
    line(doc, { x: 2.0, y: 6.4, width: 36.0, height: 0.4, lineWidth: 0.3, locked: true }),
    rect(doc, { x: 2.0, y: 8.0, width: 17.0, height: 10.2, shapeKind: 'rect', lineWidth: 0.3, locked: true }),
    rect(doc, { x: 21.0, y: 8.0, width: 17.0, height: 10.2, shapeKind: 'rect', lineWidth: 0.3, locked: true }),
    text(doc, { x: 2.8, y: 8.8, width: 15.4, height: 2.6, text: '起算', fontSize: 2.2, bold: true, align: 'center' }),
    dateEl(doc, { x: 2.8, y: 12.0, width: 15.4, height: 4.8, label: '', showTime: false, format: 'MM-DD HH:mm', fontSize: 2.4, bold: true, align: 'center' }),
    text(doc, { x: 21.8, y: 8.8, width: 15.4, height: 2.6, text: '截止', fontSize: 2.2, bold: true, align: 'center' }),
    dateEl(doc, { x: 21.8, y: 12.0, width: 15.4, height: 4.8, label: '', showTime: false, dateRole: 'expire', expireMode: 'preset', expirePresetHours: 4, format: 'MM-DD HH:mm', fontSize: 2.4, bold: true, align: 'center' }),
    text(doc, { x: 2.0, y: 19.4, width: 36.0, height: 3.0, text: '批次 K-0818  ·  值班 A', fontSize: 2.2, bold: true }),
    text(doc, { x: 2.0, y: 22.8, width: 36.0, height: 2.8, text: '□ 已密封   □ 已复核   □ 已贴签', fontSize: 2.2 }),
    text(doc, { x: 2.0, y: 25.6, width: 36.0, height: 2.4, text: '商跃后厨 · 超时即弃', fontSize: 2.2, align: 'right' })
  ];
  return finish(doc, '商跃餐饮效期', shangyueOriginalMeta('生活', '40×30', {
    designVersion: '2.1.0', createdAt: '2026-08-18'
  }));
}

/** 商跃原创药品签 · 40×20 */
function layoutShangyueMedLabel() {
  const doc = createDocument(40, 20);
  doc.elements = [
    rect(doc, { x: 1.6, y: 1.5, width: 36.8, height: 3.6, filled: true, shapeKind: 'rounded', lineWidth: 0.2, locked: true }),
    text(doc, { x: 2.3, y: 1.7, width: 14.0, height: 3.2, text: '商跃用药', fontSize: 2.2, bold: true, reverse: true }),
    text(doc, { x: 1.6, y: 5.5, width: 36.8, height: 3.8, text: '布洛芬缓释胶囊', fontSize: 3.0, bold: true }),
    text(doc, { x: 1.6, y: 9.4, width: 36.8, height: 2.8, text: '0.3g × 20 粒 · 1 粒 / 12h', fontSize: 2.2 }),
    dateEl(doc, { x: 1.6, y: 12.4, width: 36.8, height: 2.8, label: '有效至', showTime: false, dateRole: 'expire', expireMode: 'preset', expirePresetHours: 24 * 365, format: 'YYYY-MM-DD', fontSize: 2.2 }),
    text(doc, { x: 1.6, y: 15.4, width: 36.8, height: 2.8, text: '儿童请在成人监护下使用', fontSize: 2.2 })
  ];
  return finish(doc, '商跃药品签', shangyueOriginalMeta('生活', '40×20'));
}

/** 商跃原创席卡 · 40×30 */
function layoutShangyueSeatCard() {
  const doc = createDocument(40, 30);
  doc.elements = [
    text(doc, { x: 13.4, y: 2.4, width: 13.2, height: 3.2, text: '商跃喜宴', fontSize: 2.2, bold: true, reverse: true, align: 'center' }),
    text(doc, { x: 2.4, y: 7.2, width: 35.2, height: 5.4, text: '张伟  &  李娜', fontSize: 3.8, bold: true, align: 'center' }),
    line(doc, { x: 10.0, y: 13.4, width: 20.0, height: 0.6, lineWidth: 0.3, locked: true }),
    text(doc, { x: 2.4, y: 15.2, width: 35.2, height: 5.2, text: '桌号  08', fontSize: 4.2, bold: true, align: 'center' }),
    text(doc, { x: 2.4, y: 21.6, width: 35.2, height: 5.0, text: '2026.10.01  宴会厅', fontSize: 2.3, align: 'center' })
  ];
  return finish(doc, '商跃席卡', shangyueOriginalMeta('生活', '40×30'));
}

/** 商跃原创烘焙价签 · 40×30 */
function layoutShangyueBakeryTag() {
  const doc = createDocument(40, 30);
  doc.elements = [
    rect(doc, { x: 2.0, y: 1.8, width: 36.0, height: 4.2, filled: true, shapeKind: 'rounded', lineWidth: 0.2, locked: true }),
    text(doc, { x: 2.8, y: 2.1, width: 14.4, height: 3.6, text: '商跃烘焙', fontSize: 2.4, bold: true, reverse: true }),
    text(doc, { x: 25.2, y: 2.1, width: 12.0, height: 3.6, text: '当日', fontSize: 2.2, bold: true, reverse: true, align: 'right' }),
    text(doc, { x: 2.0, y: 6.6, width: 36.0, height: 4.4, text: '芒果奶油蛋糕', fontSize: 3.4, bold: true }),
    text(doc, { x: 2.0, y: 11.2, width: 36.0, height: 2.8, text: '芒果 · 动物奶油', fontSize: 2.3 }),
    text(doc, { x: 2.0, y: 14.2, width: 36.0, height: 2.8, text: '6 寸 / 约 680g', fontSize: 2.3 }),
    text(doc, { x: 2.0, y: 17.4, width: 36.0, height: 4.0, text: '¥128', fontSize: 3.8, bold: true }),
    barcode(doc, { x: 5.0, y: 21.8, width: 30.0, height: 6.2, value: '6901111222333', format: 'ean13', showText: false })
  ];
  return finish(doc, '商跃烘焙价签', shangyueOriginalMeta('零售', '40×30'));
}

/** 商跃原创植物签 · 40×30 · 三栏照护仪表 */
function layoutShangyuePlantTag() {
  const doc = createDocument(40, 30);
  doc.elements = [
    text(doc, { x: 2.0, y: 2.0, width: 12.0, height: 2.8, text: '植物养护', fontSize: 2.2, bold: true, reverse: true, align: 'center' }),
    text(doc, { x: 2.0, y: 5.2, width: 36.0, height: 4.8, text: '薄荷 · 留兰香', fontSize: 3.8, bold: true }),
    line(doc, { x: 2.0, y: 10.6, width: 36.0, height: 0.4, lineWidth: 0.3, locked: true }),
    rect(doc, { x: 13.85, y: 11.8, width: 0.3, height: 10.8, filled: true, lineWidth: 0.2, locked: true }),
    rect(doc, { x: 25.85, y: 11.8, width: 0.3, height: 10.8, filled: true, lineWidth: 0.2, locked: true }),
    text(doc, { x: 2.0, y: 12.0, width: 11.2, height: 4.0, text: '光', fontSize: 3.4, bold: true, align: 'center' }),
    text(doc, { x: 14.7, y: 12.0, width: 10.6, height: 4.0, text: '水', fontSize: 3.4, bold: true, align: 'center' }),
    text(doc, { x: 26.8, y: 12.0, width: 11.2, height: 4.0, text: '温', fontSize: 3.4, bold: true, align: 'center' }),
    text(doc, { x: 2.0, y: 16.4, width: 11.2, height: 5.0, text: '明亮散射', fontSize: 2.2, align: 'center' }),
    text(doc, { x: 14.7, y: 16.4, width: 10.6, height: 5.0, text: '土干再浇', fontSize: 2.2, align: 'center' }),
    text(doc, { x: 26.8, y: 16.4, width: 11.2, height: 5.0, text: '16–24℃', fontSize: 2.2, align: 'center' }),
    rect(doc, { x: 2.0, y: 23.4, width: 36.0, height: 4.2, filled: true, shapeKind: 'rounded', lineWidth: 0.2, locked: true }),
    text(doc, { x: 2.8, y: 24.0, width: 22.0, height: 3.0, text: '新芽期 · 7 天一检', fontSize: 2.2, bold: true, reverse: true }),
    text(doc, { x: 25.0, y: 24.0, width: 12.2, height: 3.0, text: '商跃园艺', fontSize: 2.2, reverse: true, align: 'right' })
  ];
  return finish(doc, '商跃植物签', shangyueOriginalMeta('生活', '40×30', {
    designVersion: '2.1.0', createdAt: '2026-08-18'
  }));
}

/** 商跃原创工位牌 · 40×30 */
function layoutShangyueDeskPlate() {
  const doc = createDocument(40, 30);
  doc.elements = [
    text(doc, { x: 2.0, y: 2.0, width: 13.2, height: 3.2, text: '商跃工位', fontSize: 2.2, bold: true, reverse: true, align: 'center' }),
    text(doc, { x: 2.0, y: 6.0, width: 23.2, height: 5.0, text: '赵敏', fontSize: 4.4, bold: true }),
    text(doc, { x: 2.0, y: 11.4, width: 23.2, height: 2.8, text: '产品设计', fontSize: 2.4 }),
    text(doc, { x: 2.0, y: 14.6, width: 23.2, height: 2.8, text: '分机 8806', fontSize: 2.2 }),
    text(doc, { x: 2.0, y: 17.8, width: 23.2, height: 2.8, text: '工位 3F-B12', fontSize: 2.2 }),
    qrcode(doc, { x: 26.4, y: 6.4, width: 11.2, height: 11.2, value: 'EMP://8806', errorCorrection: 'M' }),
    text(doc, { x: 26.0, y: 18.4, width: 12.0, height: 2.8, text: '企业码', fontSize: 2.2, align: 'center' }),
    line(doc, { x: 2.0, y: 23.4, width: 36.0, height: 0.3, lineWidth: 0.3, locked: true }),
    text(doc, { x: 2.0, y: 24.4, width: 36.0, height: 3.0, text: '工作时间 9:00–18:00', fontSize: 2.2 })
  ];
  return finish(doc, '商跃工位牌', shangyueOriginalMeta('办公', '40×30'));
}

/** 商跃原创样品签 · 40×20 */
function layoutShangyueLabTag() {
  const doc = createDocument(40, 20);
  doc.elements = [
    text(doc, { x: 1.6, y: 1.5, width: 36.8, height: 3.4, text: '样品 S-2026-081', fontSize: 2.6, bold: true }),
    dateEl(doc, { x: 1.6, y: 5.0, width: 18.0, height: 3.0, label: '', showTime: false, format: 'YYYY-MM-DD', fontSize: 2.3 }),
    text(doc, { x: 20.0, y: 5.0, width: 18.4, height: 3.0, text: '室温保存', fontSize: 2.2, align: 'right' }),
    line(doc, { x: 1.6, y: 8.5, width: 36.8, height: 0.3, lineWidth: 0.3, locked: true }),
    barcode(doc, { x: 1.6, y: 9.4, width: 36.8, height: 8.8, value: 'S081', format: 'code128', showText: false })
  ];
  return finish(doc, '商跃样品签', shangyueOriginalMeta('行业', '40×20'));
}

/** 商跃原创洗涤说明 · 40×30 · 面料侧栏 + 四格参数 */
function layoutShangyueCareTag() {
  const doc = createDocument(40, 30);
  doc.elements = [
    rect(doc, { x: 2.0, y: 2.0, width: 10.0, height: 26.0, filled: true, shapeKind: 'rounded', lineWidth: 0.2, locked: true }),
    text(doc, { x: 2.6, y: 3.0, width: 8.8, height: 5.0, text: '100%', fontSize: 3.2, bold: true, reverse: true, align: 'center' }),
    text(doc, { x: 2.6, y: 8.2, width: 8.8, height: 3.0, text: '纯棉', fontSize: 2.2, bold: true, reverse: true, align: 'center' }),
    text(doc, { x: 2.6, y: 12.8, width: 8.8, height: 4.8, text: '商跃\n面料卡', fontSize: 2.2, bold: true, reverse: true, align: 'center' }),
    text(doc, { x: 2.6, y: 23.4, width: 8.8, height: 3.0, text: '款 2601', fontSize: 2.2, reverse: true, align: 'center' }),
    text(doc, { x: 13.4, y: 2.0, width: 24.6, height: 4.0, text: '洗护参数', fontSize: 3.2, bold: true }),
    line(doc, { x: 13.4, y: 6.4, width: 24.6, height: 0.4, lineWidth: 0.3, locked: true }),
    rect(doc, { x: 13.4, y: 8.0, width: 11.6, height: 7.0, shapeKind: 'rect', lineWidth: 0.25, locked: true }),
    rect(doc, { x: 26.4, y: 8.0, width: 11.6, height: 7.0, shapeKind: 'rect', lineWidth: 0.25, locked: true }),
    rect(doc, { x: 13.4, y: 16.6, width: 11.6, height: 7.0, shapeKind: 'rect', lineWidth: 0.25, locked: true }),
    rect(doc, { x: 26.4, y: 16.6, width: 11.6, height: 7.0, shapeKind: 'rect', lineWidth: 0.25, locked: true }),
    text(doc, { x: 13.9, y: 9.0, width: 10.6, height: 5.0, text: '30℃\n轻柔', fontSize: 2.2, bold: true, align: 'center' }),
    text(doc, { x: 26.9, y: 9.0, width: 10.6, height: 5.0, text: '反面\n入袋', fontSize: 2.2, bold: true, align: 'center' }),
    text(doc, { x: 13.9, y: 17.6, width: 10.6, height: 5.0, text: '阴凉\n平铺', fontSize: 2.2, bold: true, align: 'center' }),
    text(doc, { x: 26.9, y: 17.6, width: 10.6, height: 5.0, text: '蒸汽\n低温', fontSize: 2.2, bold: true, align: 'center' }),
    text(doc, { x: 13.4, y: 25.0, width: 24.6, height: 2.6, text: '深浅分洗 · 反面整理', fontSize: 2.2, align: 'right' })
  ];
  return finish(doc, '商跃洗涤说明', shangyueOriginalMeta('零售', '40×30', {
    designVersion: '2.1.0', createdAt: '2026-08-18'
  }));
}

/** 商跃原创线号序列 · 30×12 */
function layoutShangyueSerialCable() {
  const doc = createDocument(30, 12);
  doc.elements = [
    text(doc, { x: 1.5, y: 1.5, width: 5.0, height: 3.0, text: 'LN', fontSize: 2.2, bold: true, reverse: true, align: 'center' }),
    serial(doc, { x: 7.0, y: 1.2, width: 21.5, height: 3.4, prefix: '', start: 2208, digits: 4, fontSize: 2.8, bold: true }),
    barcode(doc, { x: 1.5, y: 4.8, width: 27.0, height: 6.0, value: '2208', serialLinked: true, format: 'code128', showText: false })
  ];
  return finish(doc, '商跃线号序列', shangyueOriginalMeta('办公', '30×12'));
}

/** 固定资产 · 50×30 */
function layoutAsset() {
  const doc = createDocument(50, 30);
  doc.elements = [
    text(doc, {
      x: 2, y: 1.2, width: 32, height: 4,
      text: '固定资产标签', fontSize: 3.4, bold: true
    }),
    text(doc, { x: 2, y: 6, width: 32, height: 3, text: '名称：联想 ThinkPad', fontSize: 2.4 }),
    text(doc, { x: 2, y: 9.5, width: 32, height: 3, text: '部门：研发中心', fontSize: 2.4 }),
    text(doc, { x: 2, y: 13, width: 32, height: 3, text: '使用人：张工', fontSize: 2.4 }),
    serial(doc, {
      x: 2, y: 17, width: 32, height: 3.5,
      prefix: 'FA-', start: 1024, digits: 5, fontSize: 2.8, bold: true
    }),
    text(doc, { x: 2, y: 21.5, width: 32, height: 3, text: '购置：2025-11-08', fontSize: 2.3 }),
    qrcode(doc, {
      x: 35, y: 5, width: 13, height: 13,
      value: 'FA://1024'
    }),
    text(doc, {
      x: 35, y: 19, width: 13, height: 3,
      text: '扫码盘点', fontSize: 2, align: 'center'
    })
  ];
  return finish(doc, '固定资产标签', { industry: '办公', stock: '50×30' });
}

/** 药品收纳 · 40×20 */
function layoutMedicine() {
  const doc = createDocument(40, 20);
  doc.elements = [
    text(doc, {
      x: 1.5, y: 1, width: 25, height: 4,
      text: '布洛芬缓释胶囊', fontSize: 3.2, bold: true
    }),
    text(doc, {
      x: 1.5, y: 5.5, width: 25, height: 2.8,
      text: '规格：0.3g × 20 粒', fontSize: 2.2
    }),
    text(doc, {
      x: 1.5, y: 8.8, width: 25, height: 2.8,
      text: '用法：1 粒 / 12h', fontSize: 2.2
    }),
    dateEl(doc, {
      x: 1.5, y: 12.2, width: 25, height: 2.8,
      label: '有效期至', showTime: false,
      dateRole: 'expire', expireMode: 'preset', expirePresetHours: 24 * 365,
      format: 'YYYY-MM-DD', fontSize: 2.2
    }),
    text(doc, {
      x: 1.5, y: 15.5, width: 25, height: 3,
      text: '⚠ 儿童请在成人监护下使用', fontSize: 2
    }),
    material(doc, {
      x: 29, y: 3, width: 9, height: 9,
      symbol: 'warning'
    })
  ];
  return finish(doc, '药品收纳标签', { industry: '生活', stock: '40×20' });
}

/** 物流周转箱 · 50×40 */
function layoutShipping() {
  const doc = createDocument(50, 40);
  doc.elements = [
    text(doc, {
      x: 2, y: 1.5, width: 30, height: 4.5,
      text: 'TO：华东仓', fontSize: 3.8, bold: true
    }),
    text(doc, {
      x: 2, y: 7, width: 30, height: 3,
      text: '收件：杭州滨江 · 3 号库', fontSize: 2.4
    }),
    text(doc, {
      x: 2, y: 11, width: 30, height: 3,
      text: '件数：1/4', fontSize: 2.5
    }),
    text(doc, {
      x: 2, y: 15, width: 30, height: 3,
      text: '品类：易碎 · 轻拿轻放', fontSize: 2.4
    }),
    barcode(doc, {
      x: 2, y: 20, width: 30, height: 10,
      value: 'SF1234567890', format: 'code128'
    }),
    text(doc, {
      x: 2, y: 32, width: 30, height: 3,
      text: '运单 SF1234567890', fontSize: 2.3
    }),
    qrcode(doc, {
      x: 34, y: 6, width: 14, height: 14,
      value: 'SF://1234567890'
    }),
    text(doc, {
      x: 34, y: 21.5, width: 14, height: 3,
      text: '扫码签收', fontSize: 2, align: 'center'
    })
  ];
  return finish(doc, '物流周转箱标签', { industry: '仓储', stock: '50×40' });
}

/** 名片 · 50×30 */
function layoutBusinessCard() {
  const doc = createDocument(50, 30);
  doc.elements = [
    text(doc, {
      x: 2.5, y: 2, width: 30, height: 5,
      text: '李明', fontSize: 4.5, bold: true
    }),
    text(doc, {
      x: 2.5, y: 8, width: 30, height: 3,
      text: '产品经理 · 商跃团队', fontSize: 2.5
    }),
    line(doc, { x: 2.5, y: 12, width: 28, height: 0.6, lineWidth: 0.3 }),
    text(doc, {
      x: 2.5, y: 13.5, width: 30, height: 2.8,
      text: '手机 138-0000-8888', fontSize: 2.3
    }),
    text(doc, {
      x: 2.5, y: 17, width: 30, height: 2.8,
      text: '邮箱 demo＠example.invalid', fontSize: 2.2
    }),
    text(doc, {
      x: 2.5, y: 20.5, width: 30, height: 2.8,
      text: '地址 深圳南山科技园', fontSize: 2.2
    }),
    qrcode(doc, {
      x: 35, y: 7, width: 12, height: 12,
      value: 'MECARD:N:示例用户;TEL:000-0000-0000;'
    })
  ];
  return finish(doc, '商务名片', { industry: '办公', stock: '50×30' });
}

/** 服装吊牌 · 40×60 竖版用 40×30 简化 */
function layoutClothing() {
  const doc = createDocument(40, 30);
  doc.elements = [
    text(doc, {
      x: 2, y: 1.5, width: 36, height: 4.5,
      text: '春季直筒牛仔裤', fontSize: 3.4, bold: true, align: 'center'
    }),
    text(doc, {
      x: 2, y: 6.5, width: 36, height: 3,
      text: '款号：SY-2601', fontSize: 2.4, align: 'center'
    }),
    text(doc, { x: 2, y: 10.2, width: 17.5, height: 3, text: '颜色：靛蓝', fontSize: 2.3 }),
    text(doc, {
      x: 20.5, y: 10.2, width: 17.5, height: 3,
      text: '尺码：M/170', fontSize: 2.3, align: 'right'
    }),
    text(doc, {
      x: 2, y: 13.8, width: 36, height: 2.8,
      text: '面料：98% 棉 2% 氨纶', fontSize: 2.2
    }),
    text(doc, {
      x: 2, y: 17.2, width: 36, height: 4,
      text: '¥299', fontSize: 4, bold: true, align: 'center'
    }),
    barcode(doc, {
      x: 5, y: 22, width: 30, height: 6.5,
      value: '6901234567892', format: 'ean13', showText: false
    })
  ];
  return finish(doc, '服装款式吊牌', { industry: '零售', stock: '40×30' });
}

/** 餐饮效期 · 40×30 */
function layoutCatering() {
  const doc = createDocument(40, 30);
  doc.elements = [
    text(doc, {
      x: 2, y: 1.5, width: 36, height: 4.5,
      text: '厨房效期标签', fontSize: 3.6, bold: true, align: 'center'
    }),
    text(doc, { x: 2.5, y: 7, width: 14, height: 3, text: '品名', fontSize: 2.3 }),
    text(doc, {
      x: 16, y: 7, width: 21.5, height: 3,
      text: '番茄肉酱', fontSize: 2.8, bold: true, align: 'right'
    }),
    text(doc, { x: 2.5, y: 11, width: 14, height: 3, text: '制作', fontSize: 2.3 }),
    dateEl(doc, {
      x: 16, y: 10.8, width: 21.5, height: 3.2,
      label: '', showSeconds: false,
      format: 'YYYY-MM-DD HH:mm', fontSize: 2.4, align: 'right'
    }),
    text(doc, { x: 2.5, y: 15, width: 14, height: 3, text: '弃用', fontSize: 2.3 }),
    dateEl(doc, {
      x: 16, y: 15, width: 21.5, height: 3,
      label: '', showSeconds: false,
      dateRole: 'expire', expireMode: 'preset', expirePresetHours: 4,
      format: 'YYYY-MM-DD HH:mm', fontSize: 2.4, bold: true, align: 'right'
    }),
    text(doc, {
      x: 2.5, y: 20, width: 35, height: 3,
      text: '责任人：王厨', fontSize: 2.4
    }),
    text(doc, {
      x: 2.5, y: 24, width: 35, height: 3.5,
      text: '存储：冷藏 · 密封', fontSize: 2.4
    })
  ];
  return finish(doc, '餐饮效期标签', { industry: '生活', stock: '40×30' });
}

/** Wi-Fi 码 · 40×40 用 40×30 */
function layoutWifi() {
  const doc = createDocument(40, 30);
  doc.elements = [
    text(doc, {
      x: 2, y: 1.2, width: 22, height: 4,
      text: 'Wi-Fi 连接', fontSize: 3.4, bold: true
    }),
    text(doc, {
      x: 2, y: 6, width: 22, height: 3,
      text: '名称：Guest_5G', fontSize: 2.4
    }),
    text(doc, {
      x: 2, y: 9.5, width: 22, height: 3,
      text: '密码：welcome2026', fontSize: 2.4
    }),
    text(doc, {
      x: 2, y: 13.5, width: 22, height: 3,
      text: '加密：WPA2', fontSize: 2.3
    }),
    text(doc, {
      x: 2, y: 18, width: 22, height: 8,
      text: '扫码右侧二维码\n自动连接网络', fontSize: 2.3
    }),
    qrcode(doc, {
      x: 25, y: 5, width: 13, height: 13,
      value: 'WIFI:T:WPA;S:Guest_5G;P:welcome2026;;'
    })
  ];
  return finish(doc, 'Wi-Fi 码标签', { industry: '办公', stock: '40×30' });
}

/** 促销价签 · 50×30 */
function layoutPromo() {
  const doc = createDocument(50, 30);
  doc.elements = [
    rect(doc, {
      x: 1.5, y: 1.5, width: 14, height: 6,
      filled: true, lineWidth: 0.2
    }),
    text(doc, {
      x: 1.5, y: 2.2, width: 14, height: 4.5,
      text: '特价', fontSize: 3.8, bold: true, reverse: true, align: 'center'
    }),
    text(doc, {
      x: 17, y: 1.8, width: 31, height: 5,
      text: '商跃 · 牛肉三明治', fontSize: 3.2, bold: true
    }),
    text(doc, {
      x: 2, y: 9, width: 28, height: 7,
      text: '¥5.80', fontSize: 6, bold: true
    }),
    text(doc, {
      x: 30, y: 10, width: 18, height: 4,
      text: '原价 ¥8.50', fontSize: 2.4, strike: true, align: 'right'
    }),
    text(doc, {
      x: 2, y: 17, width: 46, height: 3,
      text: '配料：白面包 · 烤牛肉 · 芝士 · BBQ', fontSize: 2.2
    }),
    barcode(doc, {
      x: 2, y: 21, width: 46, height: 7.5,
      value: '6909876543212', format: 'ean13'
    })
  ];
  return finish(doc, '促销价签', { industry: '零售', stock: '50×30' });
}

/** 通用电力计量信息牌 · 50×30 简化离线版（无远程底图） */
function layoutStateGrid() {
  const doc = createDocument(50, 30);
  doc.elements = [
    text(doc, {
      x: 1.5, y: 1, width: 28, height: 3.5,
      text: '计量箱信息', fontSize: 3, bold: true
    }),
    text(doc, {
      x: 1.5, y: 5, width: 28, height: 2.8,
      text: '台区：滨江 12 号', fontSize: 2.3
    }),
    text(doc, {
      x: 1.5, y: 8.2, width: 28, height: 2.8,
      text: '户号：330108******', fontSize: 2.3
    }),
    text(doc, {
      x: 1.5, y: 11.4, width: 28, height: 2.8,
      text: '表号：MTR20260801001', fontSize: 2.3
    }),
    text(doc, {
      x: 1.5, y: 14.6, width: 28, height: 2.8,
      text: '经理：139****6621', fontSize: 2.3
    }),
    barcode(doc, {
      x: 1.5, y: 18.5, width: 28, height: 9.5,
      value: 'MTR20260801001', format: 'code128'
    }),
    qrcode(doc, {
      x: 32, y: 4, width: 15, height: 15,
      value: 'METER://330108/MTR20260801001'
    }),
    text(doc, {
      x: 31, y: 20, width: 17, height: 6,
      text: '扫码查看\n用电信息', fontSize: 2.2, align: 'center'
    })
  ];
  return finish(doc, '电力计量标识', { industry: '行业', stock: '50×30' });
}

/** 序列号线缆 · 30×12 */
function layoutSerialCable() {
  const doc = createDocument(30, 12);
  doc.elements = [
    serial(doc, {
      x: 1, y: 1.2, width: 15, height: 4.5,
      prefix: 'LN-', start: 1001, digits: 4, fontSize: 3.4, bold: true
    }),
    text(doc, {
      x: 1, y: 6.5, width: 15, height: 4,
      text: '配电柜 A 排', fontSize: 2.4
    }),
    // 12.4mm is the floor for a 4-digit Code128 at 203dpi.
    barcode(doc, {
      x: 16, y: 1.5, width: 13, height: 9,
      value: '1001', format: 'code128', showText: false
    })
  ];
  return finish(doc, '线号序列标签', { industry: '办公', stock: '30×12' });
}

/** 订婚婚礼席卡 · 50×30 */
function layoutWedding() {
  const doc = createDocument(50, 30);
  doc.elements = [
    material(doc, { x: 21, y: 1.2, width: 8, height: 5, symbol: 'rings' }),
    text(doc, {
      x: 2, y: 7, width: 46, height: 5,
      text: '张伟  &  李娜', fontSize: 4.2, bold: true, align: 'center'
    }),
    text(doc, {
      x: 2, y: 13, width: 46, height: 3,
      text: '诚邀您出席婚礼喜宴', fontSize: 2.5, align: 'center'
    }),
    text(doc, {
      x: 2, y: 17.5, width: 46, height: 4.5,
      text: '桌号  08', fontSize: 4, bold: true, align: 'center'
    }),
    text(doc, {
      x: 2, y: 23.5, width: 46, height: 3.5,
      text: '2026.10.01  喜来登宴会厅', fontSize: 2.3, align: 'center'
    })
  ];
  return finish(doc, '订婚婚礼席卡', { industry: '生活', stock: '50×30' });
}

/** 烘焙店价签 · 40×30 */
function layoutBakery() {
  const doc = createDocument(40, 30);
  doc.elements = [
    material(doc, { x: 2, y: 1.5, width: 5, height: 5, symbol: 'cake' }),
    text(doc, {
      x: 8, y: 1.8, width: 30, height: 4.5,
      text: '芒果奶油蛋糕', fontSize: 3.4, bold: true
    }),
    text(doc, { x: 2, y: 8, width: 36, height: 3, text: '口味：芒果 · 动物奶油', fontSize: 2.3 }),
    text(doc, { x: 2, y: 11.5, width: 36, height: 3, text: '规格：6 寸 / 约 680g', fontSize: 2.3 }),
    text(doc, {
      x: 2, y: 15.5, width: 36, height: 4.5,
      text: '¥128', fontSize: 4.5, bold: true, align: 'center'
    }),
    barcode(doc, {
      x: 4, y: 21, width: 32, height: 7,
      value: '6901111222333', format: 'ean13', showText: false
    })
  ];
  return finish(doc, '烘焙店价签', { industry: '零售', stock: '40×30' });
}

/** 省心净菜 · 40×30 */
function layoutFreshCut() {
  const doc = createDocument(40, 30);
  doc.elements = [
    text(doc, {
      x: 2, y: 1.5, width: 36, height: 4.5,
      text: '省心净菜 · 番茄丁', fontSize: 3.4, bold: true, align: 'center'
    }),
    text(doc, { x: 2.5, y: 7, width: 35, height: 3, text: '净含量：300g', fontSize: 2.5 }),
    text(doc, { x: 2.5, y: 10.5, width: 35, height: 3, text: '储存：冷藏 0–4℃', fontSize: 2.4 }),
    text(doc, { x: 2.5, y: 14, width: 14, height: 3, text: '保质期至', fontSize: 2.3 }),
    dateEl(doc, {
      x: 16, y: 13.8, width: 21.5, height: 3.2,
      label: '', showTime: false,
      dateRole: 'expire', expireMode: 'preset', expirePresetHours: 48,
      format: 'YYYY-MM-DD', fontSize: 2.6, bold: true, align: 'right'
    }),
    text(doc, {
      x: 2.5, y: 19, width: 35, height: 3,
      text: '开袋即用 · 请充分加热', fontSize: 2.3
    }),
    material(doc, { x: 30, y: 22, width: 7, height: 6, symbol: 'leaf' })
  ];
  return finish(doc, '省心净菜标签', { industry: '生活', stock: '40×30' });
}

/** 姓名贴 · 40×20 */
function layoutNameTag() {
  const doc = createDocument(40, 20);
  doc.elements = [
    text(doc, {
      x: 2, y: 1.5, width: 36, height: 6,
      text: '陈思远', fontSize: 5, bold: true, align: 'center'
    }),
    text(doc, {
      x: 2, y: 8.5, width: 36, height: 3.5,
      text: '三年二班 · 学号 12', fontSize: 2.6, align: 'center'
    }),
    text(doc, {
      x: 2, y: 13.5, width: 36, height: 4,
      text: '紧急联系 138-0000-1234', fontSize: 2.3, align: 'center'
    })
  ];
  return finish(doc, '姓名贴', { industry: '生活', stock: '40×20' });
}

/** 商品价签精简 · 50×30 */
function layoutRetailShelf() {
  const doc = createDocument(50, 30);
  doc.elements = [
    text(doc, {
      x: 2, y: 1.5, width: 46, height: 4.5,
      text: '有机黄瓜', fontSize: 3.8, bold: true
    }),
    text(doc, { x: 2, y: 7, width: 22, height: 3, text: '规格：500g/份', fontSize: 2.4 }),
    text(doc, { x: 26, y: 7, width: 22, height: 3, text: '产地：寿光', fontSize: 2.4, align: 'right' }),
    text(doc, {
      x: 2, y: 11.5, width: 22, height: 5,
      text: '¥6.90', fontSize: 4.5, bold: true
    }),
    text(doc, {
      x: 26, y: 12.5, width: 22, height: 3.5,
      text: '原价 ¥8.50', fontSize: 2.4, strike: true, align: 'right'
    }),
    barcode(doc, {
      x: 3, y: 18, width: 44, height: 10,
      value: '6901234567892', format: 'ean13'
    })
  ];
  return finish(doc, '商品价签精简', { industry: '零售', stock: '50×30' });
}

/** 医药价签精简 · 50×30 */
function layoutPharmaShelf() {
  const doc = createDocument(50, 30);
  doc.elements = [
    text(doc, {
      x: 2, y: 1.5, width: 46, height: 5,
      text: '阿莫西林胶囊', fontSize: 3.8, bold: true, align: 'center'
    }),
    text(doc, { x: 2, y: 7.5, width: 22, height: 3, text: '规格：0.25g×24', fontSize: 2.4 }),
    text(doc, { x: 26, y: 7.5, width: 22, height: 3, text: '单位：盒', fontSize: 2.4, align: 'right' }),
    text(doc, { x: 2, y: 11.5, width: 46, height: 3, text: '厂家：华北制药', fontSize: 2.3 }),
    text(doc, {
      x: 2, y: 16, width: 46, height: 6,
      text: '¥18.50', fontSize: 5, bold: true, align: 'center'
    }),
    text(doc, {
      x: 2, y: 23.5, width: 46, height: 3.5,
      text: '处方药 · 遵医嘱使用', fontSize: 2.2, align: 'center'
    })
  ];
  return finish(doc, '医药价签精简', { industry: '零售', stock: '50×30' });
}

/** 仓储料箱 · 50×30 */
function layoutWarehouseBin() {
  const doc = createDocument(50, 30);
  doc.elements = [
    text(doc, {
      x: 2, y: 1.5, width: 30, height: 5,
      text: 'BIN-A12-08', fontSize: 4.2, bold: true
    }),
    text(doc, { x: 2, y: 7.5, width: 30, height: 3, text: '物料：M6×20 螺栓', fontSize: 2.5 }),
    text(doc, { x: 2, y: 11.5, width: 30, height: 3, text: '编码：PN-88421', fontSize: 2.4 }),
    text(doc, { x: 2, y: 15.5, width: 30, height: 3, text: '库存：1200 pcs', fontSize: 2.4 }),
    text(doc, { x: 2, y: 20, width: 30, height: 3, text: '库区：紧固件区', fontSize: 2.3 }),
    qrcode(doc, {
      x: 34, y: 5, width: 14, height: 14,
      value: 'BIN://A12-08/PN-88421'
    }),
    text(doc, {
      x: 34, y: 20.5, width: 14, height: 3,
      text: '扫码盘点', fontSize: 2, align: 'center'
    })
  ];
  return finish(doc, '仓储料箱标签', { industry: '仓储', stock: '50×30' });
}

/** 快递面单简签 · 50×40 */
function layoutExpress() {
  const doc = createDocument(50, 40);
  doc.elements = [
    text(doc, {
      x: 2, y: 1.5, width: 46, height: 4,
      text: '快递面单', fontSize: 3.4, bold: true
    }),
    text(doc, { x: 2, y: 6.5, width: 46, height: 3, text: '收：王芳  138****5566', fontSize: 2.5 }),
    text(doc, { x: 2, y: 10.5, width: 46, height: 3, text: '址：杭州市西湖区文三路 100 号', fontSize: 2.3 }),
    text(doc, { x: 2, y: 14.5, width: 46, height: 3, text: '寄：李强  深圳南山', fontSize: 2.3 }),
    barcode(doc, {
      x: 2, y: 19, width: 46, height: 12,
      value: 'YT3123456789012', format: 'code128'
    }),
    text(doc, {
      x: 2, y: 33, width: 46, height: 4,
      text: '运单 YT3123456789012', fontSize: 2.4, align: 'center'
    })
  ];
  return finish(doc, '快递面单简签', { industry: '仓储', stock: '50×40' });
}

/** 线缆对线 · 40×12 */
function layoutCablePair() {
  const doc = createDocument(40, 12);
  doc.elements = [
    text(doc, {
      x: 1.2, y: 1, width: 20, height: 4.5,
      text: 'A端-12 / B端-08', fontSize: 3.2, bold: true
    }),
    text(doc, {
      x: 1.2, y: 6.2, width: 20, height: 4,
      text: '回路：照明支路', fontSize: 2.3
    }),
    barcode(doc, {
      x: 22, y: 1.5, width: 16.5, height: 9,
      value: 'A12B08', format: 'code128', showText: false
    })
  ];
  return finish(doc, '线缆对线标签', { industry: '办公', stock: '40×12' });
}

/** 效期批次 · 40×30 */
function layoutExpiryBatch() {
  const doc = createDocument(40, 30);
  doc.elements = [
    text(doc, {
      x: 2, y: 1.5, width: 36, height: 4.5,
      text: '效期批次标签', fontSize: 3.4, bold: true, align: 'center'
    }),
    text(doc, { x: 2.5, y: 7, width: 35, height: 3, text: '批次：LOT-20260808', fontSize: 2.5, bold: true }),
    text(doc, { x: 2.5, y: 11, width: 14, height: 3, text: '生产日期', fontSize: 2.3 }),
    dateEl(doc, {
      x: 16, y: 10.8, width: 21.5, height: 3.2,
      label: '', showTime: false, format: 'YYYY-MM-DD', fontSize: 2.5, align: 'right'
    }),
    text(doc, { x: 2.5, y: 15.5, width: 14, height: 3, text: '失效日期', fontSize: 2.3 }),
    dateEl(doc, {
      x: 16, y: 15.3, width: 21.5, height: 3.2,
      label: '', showTime: false,
      dateRole: 'expire', expireMode: 'preset', expirePresetHours: 24 * 180,
      format: 'YYYY-MM-DD', fontSize: 2.5, bold: true, align: 'right'
    }),
    text(doc, {
      x: 2.5, y: 21, width: 35, height: 5,
      text: '请按先进先出原则使用', fontSize: 2.3
    })
  ];
  return finish(doc, '效期批次标签', { industry: '生活', stock: '40×30' });
}

/** 促销爆炸贴 · 40×40 */
function layoutPromoBurst() {
  const doc = createDocument(40, 40);
  doc.elements = [
    material(doc, { x: 14, y: 1.5, width: 12, height: 8, symbol: 'percent' }),
    text(doc, {
      x: 2, y: 11, width: 36, height: 6,
      text: '特价', fontSize: 5.5, bold: true, align: 'center'
    }),
    text(doc, {
      x: 2, y: 18, width: 36, height: 8,
      text: '¥9.9', fontSize: 7, bold: true, align: 'center'
    }),
    text(doc, {
      x: 2, y: 28, width: 36, height: 4,
      text: '限时抢购', fontSize: 3.2, align: 'center'
    }),
    text(doc, {
      x: 2, y: 33, width: 36, height: 4,
      text: '原价 ¥29.9', fontSize: 2.5, strike: true, align: 'center'
    })
  ];
  return finish(doc, '促销爆炸贴', { industry: '零售', stock: '40×40' });
}

/** 珠宝小吊牌 · 30×20 */
function layoutJewelryMini() {
  const doc = createDocument(30, 20);
  doc.elements = [
    text(doc, {
      x: 1.5, y: 1, width: 27, height: 3.5,
      text: '18K 金项链', fontSize: 2.8, bold: true, align: 'center'
    }),
    text(doc, { x: 1.5, y: 5, width: 27, height: 2.5, text: '编号 SY-2201  2.1g', fontSize: 2.1, align: 'center' }),
    text(doc, {
      x: 1.5, y: 8.5, width: 27, height: 3.5,
      text: '¥3,280', fontSize: 3.4, bold: true, align: 'center'
    }),
    barcode(doc, {
      x: 3, y: 13, width: 24, height: 5.5,
      value: 'JC2201', format: 'code128', showText: false
    })
  ];
  return finish(doc, '珠宝小吊牌', { industry: '零售', stock: '30×20' });
}

/** 服装洗涤说明 · 40×30 */
function layoutGarmentCare() {
  const doc = createDocument(40, 30);
  doc.elements = [
    text(doc, {
      x: 2, y: 1.5, width: 36, height: 4,
      text: '洗涤说明', fontSize: 3.4, bold: true, align: 'center'
    }),
    text(doc, { x: 2.5, y: 7, width: 35, height: 3, text: '成分：100% 棉', fontSize: 2.4 }),
    text(doc, { x: 2.5, y: 11, width: 35, height: 3, text: '水温不超过 30℃', fontSize: 2.3 }),
    text(doc, { x: 2.5, y: 15, width: 35, height: 3, text: '不可漂白 · 不可干洗', fontSize: 2.3 }),
    text(doc, { x: 2.5, y: 19, width: 35, height: 3, text: '低温熨烫 · 悬挂晾干', fontSize: 2.3 }),
    text(doc, {
      x: 2.5, y: 24, width: 35, height: 3.5,
      text: '款号 SY-2601', fontSize: 2.4, bold: true
    })
  ];
  return finish(doc, '服装洗涤说明', { industry: '零售', stock: '40×30' });
}

/** 药品柜位 · 40×20 */
function layoutMedStorage() {
  const doc = createDocument(40, 20);
  doc.elements = [
    text(doc, {
      x: 1.5, y: 1.2, width: 25, height: 4,
      text: '柜位 B-03', fontSize: 3.4, bold: true
    }),
    text(doc, {
      x: 1.5, y: 6, width: 25, height: 3,
      text: '感冒灵颗粒', fontSize: 2.6
    }),
    text(doc, {
      x: 1.5, y: 10, width: 25, height: 3,
      text: '库存 12 盒', fontSize: 2.4
    }),
    text(doc, {
      x: 1.5, y: 14, width: 25, height: 3.5,
      text: '请核对效期', fontSize: 2.2
    }),
    material(doc, { x: 29, y: 4, width: 9, height: 9, symbol: 'warning' })
  ];
  return finish(doc, '药品柜位标签', { industry: '生活', stock: '40×20' });
}

/** 工位姓名牌 · 50×30 */
function layoutOfficeDesk() {
  const doc = createDocument(50, 30);
  doc.elements = [
    text(doc, {
      x: 2.5, y: 2, width: 30, height: 5.5,
      text: '赵敏', fontSize: 4.8, bold: true
    }),
    text(doc, {
      x: 2.5, y: 9, width: 30, height: 3,
      text: '产品设计 · UX', fontSize: 2.6
    }),
    text(doc, {
      x: 2.5, y: 13.5, width: 30, height: 3,
      text: '分机 8821', fontSize: 2.4
    }),
    text(doc, {
      x: 2.5, y: 18, width: 30, height: 3,
      text: '工位 3F-B12', fontSize: 2.4
    }),
    qrcode(doc, {
      x: 34, y: 6, width: 13, height: 13,
      value: 'EMP://8821'
    }),
    text(doc, {
      x: 34, y: 20.5, width: 13, height: 3,
      text: '企业码', fontSize: 2, align: 'center'
    })
  ];
  return finish(doc, '工位姓名牌', { industry: '办公', stock: '50×30' });
}

/** 实验室样品 · 40×20 */
function layoutLabSample() {
  const doc = createDocument(40, 20);
  doc.elements = [
    text(doc, {
      x: 1.5, y: 1, width: 24, height: 3.5,
      text: '样品 S-2026-081', fontSize: 2.8, bold: true
    }),
    dateEl(doc, {
      x: 1.5, y: 5.2, width: 24, height: 3,
      label: '', showTime: false, format: 'YYYY-MM-DD', fontSize: 2.3
    }),
    text(doc, {
      x: 1.5, y: 9, width: 24, height: 3,
      text: '室温保存', fontSize: 2.2
    }),
    barcode(doc, {
      x: 26, y: 2, width: 12.5, height: 14,
      value: 'S081', format: 'code128', showText: false
    })
  ];
  return finish(doc, '实验室样品签', { industry: '行业', stock: '40×20' });
}

/** 园艺植物 · 40×30 */
function layoutPlantCare() {
  const doc = createDocument(40, 30);
  doc.elements = [
    material(doc, { x: 2, y: 1.5, width: 6, height: 6, symbol: 'tulip' }),
    text(doc, {
      x: 9, y: 2, width: 29, height: 5,
      text: '郁金香 · 粉色', fontSize: 3.4, bold: true
    }),
    text(doc, { x: 2.5, y: 10, width: 35, height: 3, text: '日照：散射光 4–6h', fontSize: 2.4 }),
    text(doc, { x: 2.5, y: 14, width: 35, height: 3, text: '浇水：见干见湿', fontSize: 2.4 }),
    text(doc, { x: 2.5, y: 18, width: 35, height: 3, text: '温度：15–22℃', fontSize: 2.4 }),
    text(doc, {
      x: 2.5, y: 23, width: 35, height: 4,
      text: '花期约 2–3 周', fontSize: 2.5, bold: true
    })
  ];
  return finish(doc, '园艺植物标签', { industry: '生活', stock: '40×30' });
}

const LAYOUT_BUILDERS = {
  'product-simple': layoutProductPrice,
  'jewelry-price': layoutJewelry,
  'storage-code': layoutWarehouse,
  'cable-name': layoutCable,
  'home-date': layoutFoodDate,
  'shangyue-wish-card': layoutShangyueWishCard,
  'shangyue-price-tag': layoutShangyuePriceTag,
  'shangyue-bin-label': layoutShangyueBinLabel,
  'shangyue-name-sticker': layoutShangyueNameSticker,
  'shangyue-fresh-date': layoutShangyueFreshDate,
  'shangyue-wifi-card': layoutShangyueWifiCard,
  'shangyue-promo-tag': layoutShangyuePromoTag,
  'shangyue-jewelry-tag': layoutShangyueJewelryTag,
  'shangyue-garment-tag': layoutShangyueGarmentTag,
  'shangyue-ship-label': layoutShangyueShipLabel,
  'shangyue-cable-tag': layoutShangyueCableTag,
  'shangyue-asset-tag': layoutShangyueAssetTag,
  'shangyue-biz-card': layoutShangyueBizCard,
  'shangyue-kitchen-date': layoutShangyueKitchenDate,
  'shangyue-med-label': layoutShangyueMedLabel,
  'shangyue-seat-card': layoutShangyueSeatCard,
  'shangyue-bakery-tag': layoutShangyueBakeryTag,
  'shangyue-plant-tag': layoutShangyuePlantTag,
  'shangyue-desk-plate': layoutShangyueDeskPlate,
  'shangyue-lab-tag': layoutShangyueLabTag,
  'shangyue-care-tag': layoutShangyueCareTag,
  'shangyue-serial-cable': layoutShangyueSerialCable,
  'asset-card': layoutAsset,
  'medicine-box': layoutMedicine,
  'shipping-bin': layoutShipping,
  'business-card': layoutBusinessCard,
  'clothing-tag': layoutClothing,
  'catering-date': layoutCatering,
  'wifi-code': layoutWifi,
  'promo-price': layoutPromo,
  'state-grid': layoutStateGrid,
  'serial-cable': layoutSerialCable,
  'wedding-invite': layoutWedding,
  'bakery-tag': layoutBakery,
  'fresh-cut': layoutFreshCut,
  'name-tag': layoutNameTag,
  'retail-shelf': layoutRetailShelf,
  'pharma-shelf': layoutPharmaShelf,
  'warehouse-bin': layoutWarehouseBin,
  'express-waybill': layoutExpress,
  'cable-pair': layoutCablePair,
  'expiry-batch': layoutExpiryBatch,
  'promo-burst': layoutPromoBurst,
  'jewelry-mini': layoutJewelryMini,
  'garment-care': layoutGarmentCare,
  'med-storage': layoutMedStorage,
  'office-desk': layoutOfficeDesk,
  'lab-sample': layoutLabSample,
  'plant-care': layoutPlantCare
};

function attachCatalogProvenance(document, template) {
  if (!document || !template) return document;
  const metadata = Object.assign({}, document.templateMeta || {}, {
    templateId: template.id
  });
  [
    'source', 'origin', 'authorship', 'authorizationStatus', 'authorizationReference',
    'authorizedRedesign', 'manualReviewStatus',
    'approvedOriginal', 'approvalStatus', 'publicCatalog', 'releaseApproved',
    'copyright', 'batchCompatible'
  ]
    .forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(template, field)) metadata[field] = template[field];
    });
  document.templateMeta = metadata;
  return document;
}

function buildTemplateDocument(template) {
  const builder = LAYOUT_BUILDERS[template.id];
  if (builder) {
    return attachCatalogProvenance(builder(), template);
  }
  const doc = createDocument(template.size[0], template.size[1]);
  doc.name = template.name;
  doc.elements = [];
  const title = text(doc, {
    x: 2,
    y: 2,
    width: doc.widthMm - 4,
    height: Math.min(7, doc.heightMm * 0.28),
    text: template.name,
    fontSize: Math.max(3, Math.min(5, doc.heightMm * 0.18)),
    bold: true
  });
  doc.elements.push(title);
  if (template.kind === 'qr') {
    const size = Math.max(8, Math.min(doc.heightMm - 4, doc.widthMm * 0.34));
    doc.elements.push(qrcode(doc, {
      x: doc.widthMm - size - 2,
      y: 2,
      width: size,
      height: size,
      value: 'label://' + template.id
    }));
  } else if (template.kind === 'barcode') {
    doc.elements.push(barcode(doc, {
      x: 2,
      y: Math.max(7, doc.heightMm * 0.54),
      width: doc.widthMm - 4,
      height: Math.max(5, doc.heightMm * 0.36)
    }));
  }
  return attachCatalogProvenance(doc, template);
}

module.exports = {
  LAYOUT_BUILDERS,
  buildTemplateDocument
};
