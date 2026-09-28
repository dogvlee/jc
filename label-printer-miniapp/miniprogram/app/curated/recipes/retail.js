/**
 * Retail price tags. Field sets follow the Chinese marked-price convention
 * (品名、产地、规格、单位、等级、零售价、物价员); all sample goods are fictional.
 */
const {
  barcode, chip, cols, date, divider, fitFont, frame, hline, panel, priceUnit, rows, safeBox, scaleFor, text, vline
} = require('../layout');
const { checksum } = require('../../../core/ean13');

function ean(body12) {
  return `${body12}${checksum(body12)}`;
}

const PRODUCTS = [
  { name: '云南青提', origin: '云南宾川', spec: '500g', unit: '盒', grade: '一级', price: '16.80', member: '15.20', promo: '12.90', was: '19.90', ean: ean('690123456789') },
  { name: '赣南脐橙', origin: '江西赣州', spec: '2.5kg', unit: '箱', grade: '一级', price: '39.90', member: '36.90', promo: '29.90', was: '45.00', ean: ean('692345678901') },
  { name: '东北大米', origin: '黑龙江五常', spec: '5kg', unit: '袋', grade: '一级', price: '69.00', member: '65.00', promo: '59.00', was: '75.00', ean: ean('693456789012') },
  { name: '纯牛奶', origin: '内蒙古呼和浩特', spec: '250ml×12', unit: '箱', grade: '合格', price: '58.00', member: '54.00', promo: '49.90', was: '62.00', ean: ean('694567890123') },
  { name: '原味巴旦木', origin: '新疆喀什', spec: '250g', unit: '袋', grade: '合格', price: '29.90', member: '27.90', promo: '24.90', was: '32.00', ean: ean('695678901234') },
  { name: '手工水饺', origin: '山东青岛', spec: '1kg', unit: '袋', grade: '合格', price: '26.80', member: '24.80', promo: '19.90', was: '28.80', ean: ean('696789012345') }
];

const WEIGHED = [
  { name: '红富士苹果', origin: '陕西洛川', price: '6.98', per: '500g', shelf: '冷藏 7 天' },
  { name: '散装绿豆', origin: '吉林白城', price: '5.60', per: '500g', shelf: '12 个月' },
  { name: '现烤牛角包', origin: '本店现烤', price: '3.50', per: '个', shelf: '当日售完' }
];

const MEDICINES = [
  { name: '板蓝根颗粒', spec: '10g×20袋', form: '颗粒剂', unit: '盒', maker: '示例制药有限公司', price: '18.50', insurance: '甲类' },
  { name: '维生素C片', spec: '0.1g×100片', form: '片剂', unit: '瓶', maker: '示例药业股份公司', price: '6.80', insurance: '乙类' },
  { name: '布洛芬缓释胶囊', spec: '0.3g×20粒', form: '胶囊剂', unit: '盒', maker: '示例医药集团', price: '22.00', insurance: '甲类' }
];

const TOBACCO = [
  { name: '示例卷烟（硬）', type: '烤烟型', tar: '10mg', pack: '23.00', carton: '230.00' },
  { name: '示例卷烟（细支）', type: '混合型', tar: '8mg', pack: '35.00', carton: '350.00' }
];

const TEAS = [
  { name: '明前龙井', origin: '浙江杭州', grade: '特级', unit: '500g', price: '368.00' },
  { name: '武夷岩茶', origin: '福建武夷山', grade: '一级', unit: '500g', price: '298.00' }
];

const JEWELRY = [
  { name: '足金转运珠', material: 'Au999', weight: '2.35g', code: 'SJ26-0418', price: '1,688' },
  { name: '925银项链', material: 'S925', weight: '4.10g', code: 'SY26-1207', price: '299' }
];

/** Rounded black header with a bold title left and an optional note right. */
function header(doc, box, title, note, height) {
  const inner = panel(doc, frame(box.x, box.y, box.w, height));
  const [left, right] = cols(inner, note ? [3, 2] : [1], 0.8);
  text(doc, left, title, { bold: true, reverse: true, max: Math.max(2.4, height * 0.62) });
  if (note) text(doc, right, note, { reverse: true, align: 'right', max: Math.max(2.2, height * 0.52) });
  return frame(box.x, box.y + height, box.w, box.h - height);
}

function sharedFit(entries, width, height, max, bold) {
  return entries.reduce((size, value) => Math.min(size, fitFont(value, width, height, max, bold)), max);
}

/** 标准明码标价签：表格字段 + 右侧大号零售价。 */
function priceStandard(doc, W, H, p) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const headH = Math.min(5.6, Math.max(4, H * 0.14));
  const body = header(doc, safe, '商品标价签', '商跃超市', headH);
  const content = frame(body.x, body.y + 1, body.w, body.h - 1);
  const [grid, side] = cols(content, [58, 42], 1.6);
  const fields = [['品名', p.name, true], ['产地', p.origin], ['规格', p.spec], ['等级', p.grade]];
  const gridRows = rows(grid, fields.map(() => 1), 0);
  const labelW = Math.min(9, grid.w * 0.3);
  const valueW = grid.w - labelW - 1;
  const rowH = gridRows[0].h * 0.8;
  const labelSize = sharedFit(fields.map((field) => field[0]), labelW - 0.4, rowH, Math.min(3.4, 2.8 * k), false);
  const valueSize = sharedFit(fields.map((field) => field[1]), valueW, rowH, Math.min(4.6, 3.6 * k), true);
  fields.forEach(([label, value, strong], index) => {
    const row = gridRows[index];
    const inner = frame(row.x, row.y + row.h * 0.1, row.w, row.h * 0.8);
    text(doc, frame(inner.x, inner.y, labelW, inner.h), label, { size: labelSize });
    text(doc, frame(inner.x + labelW + 1, inner.y, valueW, inner.h), value, {
      size: strong ? valueSize : Math.min(valueSize, Math.min(3.8, 3 * k)), bold: Boolean(strong), bind: strong ? 'name' : ''
    });
    if (index < fields.length - 1) hline(doc, row.x, row.y + row.h, row.w, { weight: 0.25 });
  });
  vline(doc, grid.x + labelW + 0.4, grid.y + 0.4, grid.h - 0.8, { weight: 0.25 });
  vline(doc, side.x - 0.8, side.y, side.h, { weight: 0.3 });
  const small = -3.2 * Math.min(k, 1.2);
  const area = frame(side.x + 0.4, side.y, side.w - 0.8, side.h);
  const [caption, price, unit, officer] = rows(area, [small, 3, small, small], 0.3);
  text(doc, caption, '零售价', { max: Math.min(3.2, 2.6 * k), align: 'center' });
  text(doc, price, `¥${p.price}`, { bold: true, max: Math.min(11, 8 * k), align: 'center', bind: 'price' });
  text(doc, unit, `元/${p.unit}`, { max: Math.min(3.2, 2.6 * k), align: 'center' });
  text(doc, officer, '物价员 07', { max: Math.min(3, 2.4 * k), align: 'center' });
}

/** 简洁价签：品名 + 规格产地 + 价格，大尺寸带商品条码。 */
function priceSimple(doc, W, H, p) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  if (H <= 16) {
    const [left, right] = cols(safe, [3, 2.2], 1.2);
    text(doc, left, p.name, { bold: true, max: safe.h * 0.46, bind: 'name' });
    priceUnit(doc, right, `¥${p.price}`, '', { max: safe.h * 0.58, right: true, bind: 'price' });
    return;
  }
  if (H <= 22) {
    const [top, bottom] = rows(safe, [1.1, 1], 0.8);
    const [name, spec] = cols(top, [3, 2], 1);
    text(doc, name, p.name, { bold: true, max: 4.2, bind: 'name' });
    text(doc, spec, `${p.spec}/${p.unit}`, { max: 3, align: 'right' });
    hline(doc, safe.x, top.y + top.h + 0.4, safe.w, { weight: 0.25 });
    const [origin, price] = cols(bottom, [2, 3], 1);
    text(doc, origin, p.origin, { max: 3 });
    priceUnit(doc, price, `¥${p.price}`, '', { max: 5.6, right: true, bind: 'price' });
    return;
  }
  if (H < 28) {
    const [left, right] = cols(safe, [1.2, 1], 1.4);
    const [name, info] = rows(left, [1.3, 1], 0.4);
    text(doc, name, p.name, { bold: true, max: 5.4, bind: 'name' });
    text(doc, info, `${p.spec} · ${p.origin}`, { max: 3 });
    const [amount, unit] = rows(right, [1.8, 1], 0.2);
    priceUnit(doc, amount, `¥${p.price}`, '', { max: 8, right: true, bind: 'price' });
    text(doc, unit, `元/${p.unit}`, { max: 3, align: 'right' });
    return;
  }
  const withCode = W >= 40;
  const parts = withCode ? [1.25, -3.2 * k, 1.7, 1.45] : [1.3, -3.2 * k, 1.9];
  const [name, info, price, code] = rows(safe, parts, 0.6);
  text(doc, name, p.name, { bold: true, max: Math.min(7, 5.2 * k), bind: 'name' });
  text(doc, info, `${p.spec} · ${p.origin}`, { max: Math.min(3.6, 2.8 * k) });
  priceUnit(doc, price, `¥${p.price}`, `元/${p.unit}`, { max: Math.min(11, 8 * k), unitMax: Math.min(3.6, 2.8 * k), bind: 'price' });
  if (code) {
    const codeW = Math.min(code.w, Math.max(32, code.w * 0.72));
    barcode(doc, frame(code.x, code.y, codeW, code.h), p.ean, { format: 'ean13', bind: 'code' });
  }
}

/** 促销价签：特价标签 + 划线原价 + 活动截止日期。 */
function pricePromo(doc, W, H, p) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const tagH = Math.min(6.4, Math.max(4.4, H * 0.16));
  chip(doc, safe.x, safe.y, tagH, '限时特价', { max: Math.min(4, 3 * k) });
  date(doc, frame(safe.x + safe.w * 0.45, safe.y, safe.w * 0.55, tagH), {
    label: '活动至', role: 'expire', hours: 24 * 7, format: 'MM-DD', align: 'right', max: Math.min(3.4, 2.6 * k)
  });
  const body = frame(safe.x, safe.y + tagH + 1, safe.w, safe.h - tagH - 1);
  const [name, prices] = rows(body, [1, 1.9], 0.6);
  text(doc, name, p.name, { bold: true, max: Math.min(6.6, 5 * k), bind: 'name' });
  const [was, now] = cols(prices, [1, 1.9], 1);
  const [wasCaption, wasValue] = rows(was, [1, 1.2], 0.2);
  text(doc, wasCaption, '原价', { max: Math.min(3.4, 2.6 * k), valign: 'bottom' });
  text(doc, wasValue, `¥${p.was}`, { max: Math.min(4.4, 3.4 * k), strike: true, valign: 'top' });
  priceUnit(doc, now, `¥${p.promo}`, '', { max: Math.min(12, 9 * k), right: true, bind: 'price' });
}

/** 会员价签：零售价与会员价并列。 */
function priceMember(doc, W, H, p) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [name, info, prices] = rows(safe, [1.2, -3.2 * k, 2.2], 0.6);
  text(doc, name, p.name, { bold: true, max: Math.min(6.4, 5 * k) });
  text(doc, info, `${p.origin} · ${p.spec}/${p.unit}`, { max: Math.min(3.4, 2.6 * k) });
  const [retail, member] = cols(prices, [1, 1.3], 1.4);
  const [retailCaption, retailValue] = rows(retail, [-3.2 * k, 1], 0.2);
  text(doc, retailCaption, '零售价', { max: Math.min(3.4, 2.6 * k) });
  priceUnit(doc, retailValue, `¥${p.price}`, '', { max: Math.min(7, 5.4 * k) });
  const inner = panel(doc, member);
  const [memberCaption, memberValue] = rows(inner, [-3 * k, 1], 0.2);
  text(doc, memberCaption, '会员价', { max: Math.min(3.4, 2.6 * k), reverse: true });
  priceUnit(doc, memberValue, `¥${p.member}`, '', { max: Math.min(8, 6 * k), reverse: true });
}

/** 散称价签：按重量或个数计价。 */
function priceWeighed(doc, W, H, item) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [top, middle, bottom] = rows(safe, [1.3, 1.9, -3.4 * k], 1);
  const [name, tag] = cols(top, [3, 1.2], 1);
  text(doc, name, item.name, { bold: true, max: Math.min(6.6, 5 * k), bind: 'name' });
  const chipH = Math.min(tag.h, 4.4 * k);
  chip(doc, tag.x + tag.w, tag.y + (tag.h - chipH) / 2, chipH, '散称', { right: true, max: Math.min(3.6, 2.8 * k) });
  priceUnit(doc, middle, `¥${item.price}`, `元/${item.per}`, { max: Math.min(12, 9 * k), unitMax: Math.min(3.8, 3 * k), bind: 'price' });
  divider(doc, middle, bottom);
  const [origin, shelf] = cols(bottom, [1, 1], 1);
  text(doc, origin, `产地 ${item.origin}`, { max: Math.min(3.4, 2.6 * k) });
  text(doc, shelf, `保质 ${item.shelf}`, { max: Math.min(3.4, 2.6 * k), align: 'right' });
}

/** 条码价签：商品条码占下半部，便于收银扫码。 */
function priceBarcode(doc, W, H, p) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [top, code] = rows(safe, [1.25, 1], 0.8);
  const [info, price] = cols(top, [1.35, 1], 1);
  const [name, spec] = rows(info, [1.4, 1], 0.2);
  text(doc, name, p.name, { bold: true, max: Math.min(6, 4.6 * k), bind: 'name' });
  text(doc, spec, `${p.spec}/${p.unit}`, { max: Math.min(3.6, 2.8 * k) });
  priceUnit(doc, price, `¥${p.price}`, '', { max: Math.min(8.4, 6.4 * k), right: true, bind: 'price' });
  const codeW = Math.min(code.w, Math.max(32, code.w * 0.8));
  barcode(doc, frame(code.x + (code.w - codeW) / 2, code.y, codeW, code.h), p.ean, { format: 'ean13', bind: 'code' });
}

/** 药品标价签：品名、规格、剂型、生产企业、医保类别。 */
function pricePharmacy(doc, W, H, m) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const headH = Math.min(5.6, Math.max(4, H * 0.14));
  const body = header(doc, safe, '药品标价签', m.insurance === '甲类' ? '医保甲类' : '医保乙类', headH);
  const content = frame(body.x, body.y + 1, body.w, body.h - 1);
  const [info, side] = cols(content, [62, 38], 1.6);
  const [name, spec, form, maker] = rows(info, [1.35, 1, 1, 1], 0.3);
  text(doc, name, m.name, { bold: true, max: Math.min(5.4, 4.2 * k) });
  text(doc, spec, `规格 ${m.spec}`, { max: Math.min(3.6, 2.8 * k) });
  text(doc, form, `剂型 ${m.form} · 单位 ${m.unit}`, { max: Math.min(3.6, 2.8 * k) });
  text(doc, maker, m.maker, { max: Math.min(3.4, 2.6 * k) });
  vline(doc, side.x - 0.8, side.y, side.h, { weight: 0.3 });
  const small = -3.2 * Math.min(k, 1.2);
  const area = frame(side.x + 0.4, side.y, side.w - 0.8, side.h);
  const [caption, price, unit] = rows(area, [small, 2.2, small], 0.4);
  text(doc, caption, '零售价', { max: Math.min(3.2, 2.6 * k), align: 'center' });
  text(doc, price, `¥${m.price}`, { bold: true, max: Math.min(9.6, 7 * k), align: 'center' });
  text(doc, unit, `元/${m.unit}`, { max: Math.min(3.2, 2.6 * k), align: 'center' });
}

/** 卷烟价签：单盒价与整条价。 */
function priceTobacco(doc, W, H, t) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [top, middle, bottom] = rows(safe, [1.2, 2, -3.4 * k], 1);
  const [name, type] = cols(top, [2.2, 1], 1);
  text(doc, name, t.name, { bold: true, max: Math.min(6, 4.6 * k) });
  text(doc, type, t.type, { max: Math.min(3.6, 2.8 * k), align: 'right' });
  const [pack, carton] = cols(middle, [1.2, 1], 1.2);
  const [packCaption, packValue] = rows(pack, [-3.2 * k, 1], 0.2);
  text(doc, packCaption, '零售价（元/盒）', { max: Math.min(3.4, 2.6 * k) });
  text(doc, packValue, t.pack, { bold: true, max: Math.min(11, 8 * k) });
  const [cartonCaption, cartonValue] = rows(carton, [-3.2 * k, 1], 0.2);
  text(doc, cartonCaption, '元/条', { max: Math.min(3.4, 2.6 * k), align: 'right' });
  text(doc, cartonValue, t.carton, { bold: true, max: Math.min(6.6, 5 * k), align: 'right' });
  divider(doc, middle, bottom);
  text(doc, bottom, `焦油量 ${t.tar} · 吸烟有害健康`, { max: Math.min(3.4, 2.6 * k) });
}

/** 茶叶价签：品名、产地、等级与按斤计价。 */
function priceTea(doc, W, H, t) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [name, info, price] = rows(safe, [1.4, -3.4 * k, 1.9], 0.6);
  const [title, grade] = cols(name, [3, 1], 1);
  text(doc, title, t.name, { bold: true, max: Math.min(7, 5.4 * k) });
  const chipH = Math.min(grade.h, 4.6 * k);
  chip(doc, grade.x + grade.w, grade.y + (grade.h - chipH) / 2, chipH, t.grade, { right: true, max: Math.min(3.8, 3 * k) });
  text(doc, info, `产地 ${t.origin}`, { max: Math.min(3.6, 2.8 * k) });
  priceUnit(doc, price, `¥${t.price}`, `元/${t.unit}`, { max: Math.min(11, 8 * k), unitMax: Math.min(3.8, 3 * k) });
}

/** 珠宝标签：品名、材质、克重、编号与价格。 */
function priceJewelry(doc, W, H, j) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  if (H <= 22) {
    const [left, right] = cols(safe, [1.3, 1], 1.2);
    const [name, detail] = rows(left, [1.2, 1], 0.3);
    text(doc, name, j.name, { bold: true, max: 4.2 });
    text(doc, detail, `${j.material} · ${j.weight}`, { max: 3 });
    const [code, price] = rows(right, [1, 1.2], 0.3);
    text(doc, code, j.code, { max: 3, align: 'right' });
    priceUnit(doc, price, `¥${j.price}`, '', { max: 5, right: true });
    return;
  }
  const [name, material, code, price] = rows(safe, [1.3, 1, 1, 1.5], 0.4);
  text(doc, name, j.name, { bold: true, max: Math.min(6, 4.6 * k) });
  text(doc, material, `材质 ${j.material} · 重量 ${j.weight}`, { max: Math.min(3.6, 2.8 * k) });
  text(doc, code, `编号 ${j.code}`, { max: Math.min(3.6, 2.8 * k) });
  priceUnit(doc, price, `¥${j.price}`, '', { max: Math.min(8, 6 * k) });
}

module.exports = {
  CONTENT: { PRODUCTS, WEIGHED, MEDICINES, TOBACCO, TEAS, JEWELRY },
  RECIPES: {
    priceStandard: { build: priceStandard, content: 'PRODUCTS', scene: '商品价签', category: '零售' },
    priceSimple: { build: priceSimple, content: 'PRODUCTS', scene: '商品价签', category: '零售' },
    pricePromo: { build: pricePromo, content: 'PRODUCTS', scene: '促销价签', category: '零售' },
    priceMember: { build: priceMember, content: 'PRODUCTS', scene: '会员价签', category: '零售' },
    priceWeighed: { build: priceWeighed, content: 'WEIGHED', scene: '散称价签', category: '零售' },
    priceBarcode: { build: priceBarcode, content: 'PRODUCTS', scene: '条码价签', category: '零售' },
    pricePharmacy: { build: pricePharmacy, content: 'MEDICINES', scene: '药品价签', category: '医药' },
    priceTobacco: { build: priceTobacco, content: 'TOBACCO', scene: '卷烟价签', category: '零售' },
    priceTea: { build: priceTea, content: 'TEAS', scene: '茶叶价签', category: '零售' },
    priceJewelry: { build: priceJewelry, content: 'JEWELRY', scene: '珠宝标签', category: '零售' }
  }
};
