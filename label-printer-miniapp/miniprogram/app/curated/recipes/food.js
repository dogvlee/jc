/**
 * Food safety and food service labels. Every date is an auto-updating date
 * element: "made" prints the print time, "expire" adds the shelf life.
 */
const {
  chip, cols, date, divider, frame, hline, infoRows, panel, rows, safeBox, scaleFor, serial, text, titleWithTag
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
  { shop: '商跃小厨', number: 18, note: '不要葱 · 多加辣', seal: '已封口 · 拆封前请检查' },
  { shop: '商跃轻食', number: 52, note: '酱汁分装', seal: '食品安全封签' }
];

const FLAVORS = [
  { flavor: '微辣', note: '香辣牛肉' },
  { flavor: '原味', note: '经典口味' },
  { flavor: '番茄', note: '酸甜开胃' }
];

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

/** 开封日期 + 开封后使用期限。 */
function dateOpened(doc, W, H, item) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  if (H < 26) {
    const [top, opened, until] = rows(safe, [1.25, 1, 1], 0.4);
    titleWithTag(doc, top, item.name, '已开封', { max: 4.4, tagMax: 2.8 });
    date(doc, opened, { label: '开封', role: 'made', format: 'MM-DD HH:mm', max: 3.2 });
    date(doc, until, { label: '用完前', role: 'expire', hours: item.hours, format: 'MM-DD HH:mm', max: 3.2, bold: true });
    return;
  }
  const [top, opened, until, note] = rows(safe, [1.35, 1, 1, -3.2 * Math.min(k, 1.3)], 0.8);
  titleWithTag(doc, top, item.name, '已开封', { max: Math.min(6.6, 5.2 * k), tagMax: Math.min(3.6, 2.8 * k) });
  date(doc, opened, { label: '开封时间', role: 'made', format: 'MM-DD HH:mm', max: Math.min(4.4, 3.4 * k) });
  date(doc, until, { label: '请在此前用完', role: 'expire', hours: item.hours, format: 'MM-DD HH:mm', max: Math.min(4.4, 3.4 * k), bold: true });
  divider(doc, until, note);
  text(doc, note, item.note, { max: Math.min(3.4, 2.8 * k) });
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

/** 冷冻标签：入库、保质期、位置与批号。 */
function frozenLabel(doc, W, H, item) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [top, stored, expire, foot] = rows(safe, [1.35, 1, 1, 1], 0.4);
  titleWithTag(doc, top, item.name, '冷冻', { max: Math.min(6, 5 * k), tagMax: Math.min(3.4, 2.8 * k) });
  date(doc, stored, { label: '入库', role: 'made', max: Math.min(4, 3.2 * k) });
  date(doc, expire, { label: '保质期至', role: 'expire', hours: item.hours, max: Math.min(4, 3.2 * k), bold: true });
  text(doc, foot, `${item.location} · ${item.batch}`, { max: Math.min(3.4, 2.8 * k) });
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

/** 口味贴：口味大字 + 一行说明。 */
function flavorSticker(doc, W, H, item) {
  const safe = safeBox(W, H);
  const [flavor, note] = rows(safe, [1.8, 1], 0.3);
  text(doc, flavor, item.flavor, { bold: true, max: Math.min(8, flavor.h), align: 'center' });
  text(doc, note, item.note, { max: 3.2, align: 'center' });
}

module.exports = {
  CONTENT: { SHELF, OPENED, PREP, FOOD_SAMPLES, FROZEN, DRINKS, TAKEOUT, FLAVORS },
  RECIPES: {
    dateShelf: { build: dateShelf, content: 'SHELF', scene: '效期标签', category: '食品' },
    dateOpened: { build: dateOpened, content: 'OPENED', scene: '开封标签', category: '食品' },
    prepLabel: { build: prepLabel, content: 'PREP', scene: '备料标签', category: '餐饮' },
    sampleRetention: { build: sampleRetention, content: 'FOOD_SAMPLES', scene: '食品留样', category: '餐饮' },
    frozenLabel: { build: frozenLabel, content: 'FROZEN', scene: '冷冻标签', category: '食品' },
    cupSticker: { build: cupSticker, content: 'DRINKS', scene: '饮品杯贴', category: '餐饮' },
    takeoutSeal: { build: takeoutSeal, content: 'TAKEOUT', scene: '外卖封签', category: '餐饮' },
    flavorSticker: { build: flavorSticker, content: 'FLAVORS', scene: '口味贴', category: '餐饮' }
  }
};
