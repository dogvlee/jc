/**
 * Food safety and food service labels. Every date is an auto-updating date
 * element: "made" prints the print time, "expire" adds the shelf life.
 */
const {
  chip, cols, date, divider, frame, hline, infoRows, inset, outline, panel, rows, safeBox, scaleFor, serial, slab, text,
  titleWithTag
} = require('../layout');

const SHELF = [
  { name: '手工水饺', storage: '冷冻', temperature: '-18℃', hours: 24 * 90, batch: 'SJ260928' },
  { name: '现切水果盒', storage: '冷藏', temperature: '0–4℃', hours: 24, batch: 'XQ260928' },
  { name: '卤味拼盘', storage: '冷藏', temperature: '0–4℃', hours: 48, batch: 'LW260928' },
  { name: '奶油蛋糕', storage: '冷藏', temperature: '0–4℃', hours: 48, batch: 'DG260928' }
];

const OPENED = [
  { name: '纯牛奶', note: '开封后 48 小时内饮用', hours: 48 },
  { name: '番茄酱', note: '开封后冷藏，30 天内用完', hours: 24 * 30 },
  { name: '婴儿奶粉', note: '开封后 30 天内用完', hours: 24 * 30 }
];

const PREP = [
  { name: '鸡胸肉（解冻）', storage: '冷藏', hours: 24, staff: '王师傅' },
  { name: '番茄炒蛋半成品', storage: '冷藏', hours: 4, staff: '李厨' }
];

const FOOD_SAMPLES = [
  { meal: '午餐', dish: '宫保鸡丁', staff: '张明', weight: '≥125g' },
  { meal: '晚餐', dish: '清炒时蔬', staff: '刘芳', weight: '≥125g' }
];

const FROZEN = [
  { name: '猪肉馅', batch: 'ZR-0928', location: '冷冻柜 B2', hours: 24 * 90 },
  { name: '冷冻虾仁', batch: 'XR-0927', location: '冷冻柜 A1', hours: 24 * 180 }
];

const DRINKS = [
  { name: '芝士葡萄', size: '大杯', sugar: '少糖', ice: '去冰', extra: '加椰果', number: 128 },
  { name: '杨枝甘露', size: '中杯', sugar: '标准糖', ice: '少冰', extra: '不加料', number: 36 },
  { name: '燕麦拿铁', size: '大杯', sugar: '无糖', ice: '热饮', extra: '双份浓缩', number: 7 }
];

const TAKEOUT = [
  { shop: '巷口小厨', number: 18, note: '不要葱 · 多加辣', seal: '已封口 · 拆封前请检查' },
  { shop: '绿野轻食', number: 52, note: '酱汁分装', seal: '食品安全封签' }
];

const FLAVORS = [
  { flavor: '微辣', note: '香辣牛肉' },
  { flavor: '原味', note: '经典口味' },
  { flavor: '番茄', note: '酸甜开胃' }
];

/** Rounded black strip across the top with a bold left text and a right note. */
function strip(doc, box, left, right) {
  const inner = panel(doc, box);
  const [a, b] = cols(inner, [1.6, 1], 0.8);
  text(doc, a, left, { bold: true, reverse: true, max: box.h * 0.62 });
  text(doc, b, right, { reverse: true, align: 'right', max: box.h * 0.5 });
}

/** 生产日期 + 保质期至。 */
function dateShelf(doc, W, H, item) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  if (H < 26) {
    const [top, made, expire] = rows(safe, [1.25, 1, 1], 0.4);
    text(doc, top, item.name, { bold: true, max: 4.6, bind: 'name' });
    date(doc, made, { label: '生产', role: 'made', max: 3.2 });
    date(doc, expire, { label: '到期', role: 'expire', hours: item.hours, max: 3.2, bold: true });
    return;
  }
  const [top, made, expire, foot] = rows(safe, [1.35, 1, 1, -3.2 * Math.min(k, 1.3)], 0.8);
  titleWithTag(doc, top, item.name, item.storage, { max: Math.min(6.6, 5.2 * k), tagMax: Math.min(3.6, 2.8 * k), bind: 'name' });
  date(doc, made, { label: '生产日期', role: 'made', max: Math.min(4.4, 3.4 * k) });
  date(doc, expire, { label: '保质期至', role: 'expire', hours: item.hours, max: Math.min(4.4, 3.4 * k), bold: true });
  divider(doc, expire, foot);
  text(doc, foot, `${item.temperature} ${item.storage}保存 · 批号 ${item.batch}`, { max: Math.min(3.4, 2.8 * k) });
}

/** 到期底栏：到期日期放进反白底栏，品名、储存与生产日期在上。 */
function dateShelfBar(doc, W, H, item) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  if (H < 26) {
    const [top, bar] = rows(safe, [1, 1.35], 0.6);
    const [name, made] = cols(top, [1.1, 1], 1);
    text(doc, name, item.name, { bold: true, max: 4.4 });
    date(doc, made, { label: '产', role: 'made', format: 'MM-DD', align: 'right', max: 3.2 });
    const inner = panel(doc, bar);
    date(doc, inner, { label: '到期', role: 'expire', hours: item.hours, bold: true, reverse: true, align: 'center', max: 4 });
    return;
  }
  const [top, made, bar] = rows(safe, [1.25, -3.4 * Math.min(k, 1.3), 1.8], 0.6);
  const [name, storage] = cols(top, [1.5, 1], 1);
  text(doc, name, item.name, { bold: true, max: Math.min(6.6, 5.2 * k) });
  text(doc, storage, `${item.storage} ${item.temperature}`, { max: Math.min(3.6, 2.8 * k), align: 'right' });
  date(doc, made, { label: '生产', role: 'made', max: Math.min(3.6, 2.8 * k) });
  const inner = panel(doc, bar);
  const [caption, expire] = rows(inner, [1, 1.7], 0.2);
  text(doc, caption, '保质期至', { reverse: true, max: Math.min(3.4, 2.6 * k) });
  date(doc, expire, { role: 'expire', hours: item.hours, bold: true, reverse: true, max: Math.min(7, 5.4 * k) });
}

/** 开封顶栏：反白顶栏写品名与“已开封”，下面开封时间与用完时间。 */
function dateOpened(doc, W, H, item) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const headH = Math.min(6.4, Math.max(4.4, H * 0.2));
  if (H < 26) {
    const [head, opened, until] = rows(safe, [-headH, 1, 1], 0.5);
    strip(doc, head, item.name, '已开封');
    date(doc, opened, { label: '开封', role: 'made', format: 'MM-DD HH:mm', max: 3.2 });
    date(doc, until, { label: '用完前', role: 'expire', hours: item.hours, format: 'MM-DD HH:mm', max: 3.2, bold: true });
    return;
  }
  const [head, opened, until, note] = rows(safe, [-headH, 1, 1.1, -3.2 * Math.min(k, 1.3)], 0.6);
  strip(doc, head, item.name, '已开封');
  date(doc, opened, { label: '开封时间', role: 'made', format: 'MM-DD HH:mm', max: Math.min(4.4, 3.4 * k) });
  date(doc, until, { label: '请在此前用完', role: 'expire', hours: item.hours, format: 'MM-DD HH:mm', max: Math.min(4.4, 3.4 * k), bold: true });
  text(doc, note, item.note, { max: Math.min(3.4, 2.8 * k) });
}

/** 用完时间醒目：用完前时间放进反白块，开封时间与提示在下。 */
function dateOpenedBlock(doc, W, H, item) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  if (H < 26) {
    const [block, info] = cols(safe, [1.25, 1], 1.2);
    const inner = slab(doc, block);
    const [caption, until] = rows(inner, [1, 1.5], 0.2);
    text(doc, caption, '请在此前用完', { reverse: true, max: 2.8 });
    date(doc, until, { role: 'expire', hours: item.hours, format: 'MM-DD HH:mm', bold: true, reverse: true, max: 4 });
    const [name, opened] = rows(info, [1.2, 1], 0.4);
    text(doc, name, item.name, { bold: true, max: 4, align: 'right' });
    date(doc, opened, { label: '开封', role: 'made', format: 'MM-DD', align: 'right', max: 3 });
    return;
  }
  const line = -3.2 * Math.min(k, 1.2);
  const [top, block, opened, note] = rows(safe, [1.1, 1.8, line, line], 0.5);
  titleWithTag(doc, top, item.name, '开封', { max: Math.min(6, 4.8 * k), tagMax: Math.min(3.4, 2.6 * k) });
  const inner = slab(doc, block);
  const [caption, until] = rows(inner, [1, 1.8], 0.2);
  text(doc, caption, '请在此前用完', { reverse: true, max: Math.min(3.4, 2.6 * k) });
  date(doc, until, { role: 'expire', hours: item.hours, format: 'MM-DD HH:mm', bold: true, reverse: true, max: Math.min(7, 5.4 * k) });
  date(doc, opened, { label: '开封', role: 'made', format: 'MM-DD HH:mm', max: Math.min(3.4, 2.6 * k) });
  text(doc, note, item.note, { max: Math.min(3.4, 2.6 * k) });
}

/** 食材备料 / 解冻标签：制作与到期精确到分钟。 */
function prepLabel(doc, W, H, item) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [top, name, made, expire, foot] = rows(safe, [1, 1.3, 1, 1, 1], 0.4);
  chip(doc, safe.x, top.y, top.h, '食材备料', { max: Math.min(3.4, 2.6 * k) });
  text(doc, frame(safe.x + safe.w * 0.5, top.y, safe.w * 0.5, top.h), `储存 ${item.storage}`, { max: Math.min(3.4, 2.6 * k), align: 'right' });
  text(doc, name, item.name, { bold: true, max: Math.min(6, 4.8 * k) });
  date(doc, made, { label: '制作', role: 'made', format: 'MM-DD HH:mm', max: Math.min(4, 3.2 * k) });
  date(doc, expire, { label: '到期', role: 'expire', hours: item.hours, format: 'MM-DD HH:mm', max: Math.min(4, 3.2 * k), bold: true });
  text(doc, foot, `操作人 ${item.staff}`, { max: Math.min(3.4, 2.6 * k) });
}

/** 双日期框：制作与到期各占一框，品名储存在上、操作人在下。 */
function prepLabelBoxes(doc, W, H, item) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [top, dates, foot] = rows(safe, [1.1, 1.7, -3.2 * Math.min(k, 1.2)], 0.7);
  titleWithTag(doc, top, item.name, item.storage, { max: Math.min(6, 4.8 * k), tagMax: Math.min(3.4, 2.6 * k) });
  const boxes = cols(dates, [1, 1], 1.2);
  [['制作', 'made', false], ['到期', 'expire', true]].forEach(([caption, role, strong], index) => {
    outline(doc, boxes[index], { rounded: true, weight: 0.3 });
    const [label, value] = rows(inset(boxes[index], 0.9, 0.6), [1, 1.4], 0.2);
    text(doc, label, caption, { bold: strong, max: Math.min(3.4, 2.6 * k), align: 'center' });
    date(doc, value, { role, hours: item.hours, format: 'MM-DD HH:mm', bold: strong, align: 'center', max: Math.min(4.6, 3.6 * k) });
  });
  text(doc, foot, `食材备料 · 操作人 ${item.staff}`, { max: Math.min(3.4, 2.6 * k) });
}

/** 食品留样：餐次、菜品、留样与销毁时间、留样人。 */
function sampleRetention(doc, W, H, item) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const headH = Math.min(6.4, Math.max(4.2, H * 0.16));
  const inner = panel(doc, frame(safe.x, safe.y, safe.w, headH));
  const [title, meal] = cols(inner, [2, 1], 0.8);
  text(doc, title, '食品留样', { bold: true, reverse: true, max: Math.max(2.4, headH * 0.6) });
  text(doc, meal, item.meal, { bold: true, reverse: true, align: 'right', max: Math.max(2.4, headH * 0.6) });
  const body = frame(safe.x, safe.y + headH + 0.8, safe.w, safe.h - headH - 0.8);
  const [dish, kept, destroy, staff] = rows(body, [1.3, 1, 1, 1], 0.3);
  text(doc, dish, `菜品：${item.dish}`, { bold: true, max: Math.min(5, 4 * k) });
  date(doc, kept, { label: '留样', role: 'made', format: 'MM-DD HH:mm', max: Math.min(4, 3.2 * k) });
  date(doc, destroy, { label: '可销毁', role: 'expire', hours: 48, format: 'MM-DD HH:mm', max: Math.min(4, 3.2 * k) });
  text(doc, staff, `留样人 ${item.staff} · 重量 ${item.weight}`, { max: Math.min(3.6, 2.8 * k) });
}

/** 餐次方块：左侧反白餐次，右侧菜品、留样与可销毁时间。 */
function sampleRetentionBlock(doc, W, H, item) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const side = Math.min(safe.h, safe.w * 0.3);
  const [block, info] = cols(safe, [-side, 1], 1.4);
  const inner = slab(doc, block);
  const [meal, word] = rows(inner, [1.6, 1], 0.3);
  text(doc, meal, item.meal, { bold: true, reverse: true, max: Math.min(9, meal.h), align: 'center' });
  text(doc, word, '留样', { reverse: true, max: Math.min(4.4, word.h), align: 'center' });
  const [dish, kept, destroy, staff] = rows(info, [1.3, 1, 1, 1], 0.3);
  text(doc, dish, item.dish, { bold: true, max: Math.min(6, 4.8 * k) });
  date(doc, kept, { label: '留样', role: 'made', format: 'MM-DD HH:mm', max: Math.min(3.8, 3 * k) });
  date(doc, destroy, { label: '可销毁', role: 'expire', hours: 48, format: 'MM-DD HH:mm', bold: true, max: Math.min(3.8, 3 * k) });
  text(doc, staff, `${item.staff} · ${item.weight}`, { max: Math.min(3.4, 2.6 * k) });
}

/** 冷冻侧栏：左侧反白“冷冻”竖栏，右侧品名、入库、到期与位置批号。 */
function frozenLabel(doc, W, H, item) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [block, info] = cols(safe, [-Math.max(7, safe.w * 0.2), 1], 1.4);
  const inner = slab(doc, block);
  text(doc, inner, '冷\n冻', { bold: true, reverse: true, max: 7, align: 'center' });
  const [name, stored, expire, foot] = rows(info, [1.3, 1, 1, 1], 0.4);
  text(doc, name, item.name, { bold: true, max: Math.min(6, 5 * k) });
  date(doc, stored, { label: '入库', role: 'made', max: Math.min(4, 3.2 * k) });
  date(doc, expire, { label: '到期', role: 'expire', hours: item.hours, max: Math.min(4, 3.2 * k), bold: true });
  text(doc, foot, `${item.location} · ${item.batch}`, { max: Math.min(3.4, 2.8 * k) });
}

/** 到期大字：保质期至居中放大，入库日期与存放位置在底行。 */
function frozenLabelExpiry(doc, W, H, item) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const line = -3.2 * Math.min(k, 1.2);
  const [top, caption, expire, foot] = rows(safe, [1.2, -2.8 * Math.min(k, 1.2), 1.4, line], 0.5);
  titleWithTag(doc, top, item.name, '冷冻', { max: Math.min(6, 4.8 * k), tagMax: Math.min(3.4, 2.6 * k) });
  text(doc, caption, '保质期至', { max: Math.min(3.4, 2.6 * k), align: 'center' });
  date(doc, expire, { role: 'expire', hours: item.hours, bold: true, align: 'center', max: Math.min(8, 6 * k) });
  divider(doc, expire, foot);
  const [stored, where] = cols(foot, [1, 1], 1);
  date(doc, stored, { label: '入库', role: 'made', format: 'MM-DD', max: Math.min(3.4, 2.6 * k) });
  text(doc, where, item.location, { max: Math.min(3.4, 2.6 * k), align: 'right' });
}

/** 奶茶杯贴：取餐号自动递增，饮品规格一眼可读。 */
function cupSticker(doc, W, H, item) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [top, name, options, extra] = rows(safe, [1.35, 1.25, 1, 0.9], 0.4);
  const [number, time] = cols(top, [1, 1.2], 1);
  serial(doc, number, { prefix: '#', start: item.number, digits: 3, bold: true, max: Math.min(6.4, 5 * k) });
  date(doc, time, { role: 'made', format: 'MM-DD HH:mm', align: 'right', max: Math.min(3.4, 2.8 * k) });
  text(doc, name, item.name, { bold: true, max: Math.min(6, 4.8 * k) });
  text(doc, options, `${item.size} · ${item.sugar} · ${item.ice}`, { max: Math.min(4.2, 3.4 * k) });
  text(doc, extra, item.extra, { max: Math.min(3.6, 2.8 * k) });
}

/** 取餐号方块：左侧反白大号取餐号，右侧饮品、规格与加料。 */
function cupStickerBlock(doc, W, H, item) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const side = Math.min(safe.h, safe.w * 0.42);
  const [block, info] = cols(safe, [-side, 1], 1.4);
  const inner = slab(doc, block);
  const [caption, number] = rows(inner, [1, 2.2], 0.2);
  text(doc, caption, '取餐号', { reverse: true, max: Math.min(3.4, 2.6 * k), align: 'center' });
  serial(doc, number, { start: item.number, digits: 3, bold: true, reverse: true, align: 'center', max: Math.min(12, 9 * k) });
  const [name, options, extra, time] = rows(info, [1.3, 1, 1, 1], 0.3);
  text(doc, name, item.name, { bold: true, max: Math.min(6, 4.8 * k) });
  text(doc, options, `${item.size} · ${item.sugar}`, { max: Math.min(3.8, 3 * k) });
  text(doc, extra, `${item.ice} · ${item.extra}`, { max: Math.min(3.8, 3 * k) });
  date(doc, time, { role: 'made', format: 'MM-DD HH:mm', max: Math.min(3.2, 2.6 * k) });
}

/** 外卖封签：店名、取餐号、备注与封口提示。 */
function takeoutSeal(doc, W, H, item) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const headH = Math.min(6.4, Math.max(4.2, H * 0.17));
  const inner = panel(doc, frame(safe.x, safe.y, safe.w, headH));
  const [shop, time] = cols(inner, [1.2, 1], 0.8);
  text(doc, shop, item.shop, { bold: true, reverse: true, max: Math.max(2.4, headH * 0.6) });
  const body = frame(safe.x, safe.y + headH + 0.8, safe.w, safe.h - headH - 0.8);
  date(doc, time, { role: 'made', format: 'MM-DD HH:mm', align: 'right', reverse: true, max: Math.max(2.2, headH * 0.5) });
  const [numberRow, note, seal] = rows(body, [1.6, 1, 1], 0.8);
  const [caption, number] = cols(numberRow, [1, 1.6], 0.8);
  text(doc, caption, '取餐号', { max: Math.min(4, 3.2 * k), valign: 'bottom' });
  serial(doc, number, { start: item.number, digits: 2, bold: true, max: Math.min(9, 7 * k), align: 'right' });
  text(doc, note, `备注：${item.note}`, { max: Math.min(3.6, 3 * k) });
  divider(doc, note, seal, { dashed: true });
  text(doc, seal, item.seal, { max: Math.min(3.4, 2.8 * k), align: 'center' });
}

/** 取餐号居中：大号取餐号在中间，封口提示印在底部反白条上。 */
function takeoutSealCenter(doc, W, H, item) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [top, number, note, seal] = rows(safe, [1, 2, 1, 1], 0.5);
  const [shop, time] = cols(top, [1.2, 1], 1);
  text(doc, shop, item.shop, { bold: true, max: Math.min(5, 4 * k) });
  date(doc, time, { role: 'made', format: 'MM-DD HH:mm', align: 'right', max: Math.min(3.4, 2.6 * k) });
  serial(doc, number, { prefix: '#', start: item.number, digits: 2, bold: true, align: 'center', max: Math.min(14, 10 * k) });
  text(doc, note, item.note, { max: Math.min(3.8, 3 * k), align: 'center' });
  const inner = panel(doc, seal);
  text(doc, inner, item.seal, { reverse: true, align: 'center', max: Math.min(3.4, 2.6 * k) });
}

/** 口味贴：反白圆角块写口味，下面一行说明。 */
function flavorSticker(doc, W, H, item) {
  const safe = safeBox(W, H);
  const [flavor, note] = rows(safe, [1.9, 1], 0.5);
  const inner = panel(doc, flavor);
  text(doc, inner, item.flavor, { bold: true, reverse: true, max: Math.min(8, inner.h), align: 'center' });
  text(doc, note, item.note, { max: 3.2, align: 'center' });
}

/** 口味横排：左侧反白口味块，右侧加粗说明。 */
function flavorStickerSide(doc, W, H, item) {
  const safe = safeBox(W, H);
  const [block, note] = cols(safe, [1.1, 1], 1.2);
  const inner = slab(doc, block);
  text(doc, inner, item.flavor, { bold: true, reverse: true, max: Math.min(8, inner.h * 0.9), align: 'center' });
  text(doc, note, item.note, { bold: true, max: Math.min(4.4, safe.h * 0.4), align: 'center' });
}

module.exports = {
  CONTENT: { SHELF, OPENED, PREP, FOOD_SAMPLES, FROZEN, DRINKS, TAKEOUT, FLAVORS },
  RECIPES: {
    dateShelf: {
      styles: [dateShelf, dateShelfBar],
      blurbs: ['生产日期与保质期至，打印时按保质期自动计算', '到期日期放进反白底栏，远看也醒目'],
      content: 'SHELF', scene: '效期标签', category: '食品'
    },
    dateOpened: {
      styles: [dateOpened, dateOpenedBlock],
      blurbs: ['反白顶栏标明已开封，开封与用完时间精确到分钟', '用完时间放进反白块，开封时间与提示在下'],
      content: 'OPENED', scene: '开封标签', category: '食品'
    },
    prepLabel: {
      styles: [prepLabel, prepLabelBoxes],
      blurbs: ['后厨备料或解冻：制作、到期、储存与操作人', '制作与到期各占一框，品名储存在上'],
      content: 'PREP', scene: '备料标签', category: '餐饮'
    },
    sampleRetention: {
      styles: [sampleRetention, sampleRetentionBlock],
      blurbs: ['食品留样：餐次、菜品、留样 48 小时后可销毁', '左侧反白餐次，右侧菜品与留样销毁时间'],
      content: 'FOOD_SAMPLES', scene: '食品留样', category: '餐饮'
    },
    frozenLabel: {
      styles: [frozenLabel, frozenLabelExpiry],
      blurbs: ['左侧“冷冻”竖栏：入库、到期、位置与批号', '保质期至居中放大，入库日期与位置在底行'],
      content: 'FROZEN', scene: '冷冻标签', category: '食品'
    },
    cupSticker: {
      styles: [cupSticker, cupStickerBlock],
      blurbs: ['饮品杯贴：取餐号自动递增，规格甜度温度一行看清', '左侧反白大号取餐号，右侧饮品与做法'],
      content: 'DRINKS', scene: '饮品杯贴', category: '餐饮'
    },
    takeoutSeal: {
      styles: [takeoutSeal, takeoutSealCenter],
      blurbs: ['外卖封签：店名、取餐号、备注与封口提示', '取餐号居中放大，封口提示印在反白底条'],
      content: 'TAKEOUT', scene: '外卖封签', category: '餐饮'
    },
    flavorSticker: {
      styles: [flavorSticker, flavorStickerSide],
      blurbs: ['口味贴：反白口味块 + 一行说明', '口味块在左，说明在右，适合窄条'],
      content: 'FLAVORS', scene: '口味贴', category: '餐饮'
    }
  }
};
