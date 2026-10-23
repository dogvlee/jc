/**
 * Medical care and everyday-life labels: medication reminders, sterilised
 * packs, bed cards, garments, greetings, gift tags, Wi-Fi and pantry jars.
 */
const {
  band, barcode, chip, cols, date, divider, frame, hline, infoRows, inset, outline, panel, priceUnit, qrcode, rows,
  safeBox, scaleFor, slab, text, titleWithTag, vline
} = require('../layout');
const { checksum } = require('../../../core/ean13');

const MEDICATIONS = [
  { patient: '王阿姨', drug: '阿莫西林胶囊', dose: '每日 3 次 · 每次 2 粒', meal: '饭后服用' },
  { patient: '李先生', drug: '降压片', dose: '每日 1 次 · 每次 1 片', meal: '早饭前服用' }
];

const STERILE = [
  { pack: '换药包', pot: '03', batch: '0928', staff: '王护士' },
  { pack: '缝合包', pot: '01', batch: '0927', staff: '刘护士' }
];

const BEDS = [
  { bed: '12', name: '张某某', info: '男 · 68 岁', level: '二级护理', diet: '低盐饮食', allergy: '青霉素过敏' },
  { bed: '07', name: '李某某', info: '女 · 45 岁', level: '一级护理', diet: '普食', allergy: '无过敏史' }
];

const GARMENTS = [
  { name: '纯棉圆领T恤', code: 'QY26T018', color: '雾霾蓝', size: 'L', fabric: '棉 100%', standard: 'FZ/T 73043', safety: 'B 类', price: '129', ean: `690765432101${checksum('690765432101')}` },
  { name: '休闲直筒裤', code: 'QY26K205', color: '卡其', size: '32', fabric: '棉 98% 氨纶 2%', standard: 'FZ/T 81007', safety: 'B 类', price: '239', ean: `690765432118${checksum('690765432118')}` }
];

const GREETINGS = [
  { title: '生日快乐', line: '愿你眼里有光，心中有爱', sign: '—— 爱你的家人' },
  { title: '新婚快乐', line: '执子之手，与子偕老', sign: '—— 部门全体同事' },
  { title: '中秋快乐', line: '花好月圆，阖家团圆', sign: '—— 小店敬贺' },
  { title: '感谢有你', line: '谢谢你一直以来的支持', sign: '—— 南风花店' }
];

const GIFTS = [
  { to: '亲爱的小雨', from: '妈妈', note: '愿你每天都开心' },
  { to: '尊敬的客户', from: '暖心小店', note: '感谢您的信任与支持' }
];

const WIFI = [
  { ssid: 'Home-5G', password: 'welcome26' }
];

const PANTRY = [
  { name: '白砂糖', note: '密封防潮' },
  { name: '咖啡豆', note: '开封后 2 周内饮用' },
  { name: '燕麦片', note: '阴凉干燥处存放' }
];

/** 服药提醒：药名、用法、时间勾选与饭前饭后。 */
function medicationGuide(doc, W, H, m) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [top, drug, dose, checks, meal] = rows(safe, [1.1, 1.3, 1, 1.1, 1], 0.4);
  const [tag, patient] = cols(top, [1, 1], 1);
  chip(doc, tag.x, tag.y, tag.h, '服药提醒', { max: Math.min(3.8, 3 * k) });
  text(doc, patient, m.patient, { bold: true, max: Math.min(4.4, 3.4 * k), align: 'right' });
  text(doc, drug, m.drug, { bold: true, max: Math.min(6.4, 5 * k) });
  text(doc, dose, m.dose, { max: Math.min(4.4, 3.4 * k) });
  text(doc, checks, '□ 早   □ 中   □ 晚   □ 睡前', { max: Math.min(4.4, 3.4 * k) });
  text(doc, meal, m.meal, { bold: true, max: Math.min(4, 3.2 * k) });
}

/** 服药时间格：药名与服药人在上，早 / 中 / 晚 / 睡前四格，用量与饭前饭后在下。 */
function medicationGuideSlots(doc, W, H, m) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const line = -3.2 * Math.min(k, 1.2);
  const [top, slots, dose, meal] = rows(safe, [1.2, 1.5, line, line], 0.8);
  titleWithTag(doc, top, m.drug, m.patient, { max: Math.min(6, 4.8 * k), tagMax: Math.min(3.6, 2.8 * k) });
  cols(slots, [1, 1, 1, 1], 0.9).forEach((cell, index) => {
    outline(doc, cell, { rounded: true, weight: 0.3 });
    text(doc, inset(cell, 0.6, 0.4), ['早', '中', '晚', '睡前'][index], { bold: true, max: Math.min(5, 4 * k), align: 'center' });
  });
  text(doc, dose, m.dose, { max: Math.min(3.8, 3 * k) });
  text(doc, meal, m.meal, { bold: true, max: Math.min(3.8, 3 * k) });
}

/** 灭菌包：包名、灭菌与失效日期、锅号批次，右侧留出化学指示卡粘贴框。 */
function sterilePack(doc, W, H, s) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const side = Math.min(safe.h * 0.68, safe.w * 0.3);
  const [info, indicator] = cols(safe, [1, -side], 1.4);
  const [name, made, until, foot] = rows(info, [1.3, 1, 1, 1], 0.4);
  const [pack, staff] = cols(name, [1.4, 1], 0.8);
  text(doc, pack, s.pack, { bold: true, max: Math.min(6, 4.8 * k) });
  text(doc, staff, s.staff, { max: Math.min(3.4, 2.6 * k), align: 'right' });
  date(doc, made, { label: '灭菌', role: 'made', max: Math.min(3.8, 3 * k) });
  date(doc, until, { label: '失效', role: 'expire', hours: 24 * 180, bold: true, max: Math.min(3.8, 3 * k) });
  text(doc, foot, `锅号 ${s.pot} · 批次 ${s.batch}`, { max: Math.min(3.4, 2.6 * k) });
  const captionH = Math.min(3.6, 2.8 * k);
  const top = indicator.y + (indicator.h - side - 0.6 - captionH) / 2;
  outline(doc, frame(indicator.x, top, side, side), { rounded: true, weight: 0.3, dashed: true });
  text(doc, frame(indicator.x - 0.5, top + side + 0.6, side + 1, captionH), '指示卡', { max: Math.min(3, 2.4 * k), align: 'center' });
}

/** 表格灭菌签：反白顶栏写包名，灭菌、失效、锅号批次、操作人排成四格表。 */
function sterilePackTable(doc, W, H, s) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const headH = Math.min(6.4, Math.max(4.6, H * 0.2));
  const [head, grid] = rows(safe, [-headH, 1], 0.8);
  const inner = panel(doc, head);
  const [name, mark] = cols(inner, [1.6, 1], 0.8);
  text(doc, name, s.pack, { bold: true, reverse: true, max: headH * 0.62 });
  text(doc, mark, '已灭菌', { reverse: true, align: 'right', max: headH * 0.5 });
  const [upper, lower] = rows(grid, [1, 1], 0.8);
  const cells = [
    [cols(upper, [1, 1], 1.6)[0], '灭菌', (box) => date(doc, box, { role: 'made', max: Math.min(3.6, 2.8 * k) })],
    [cols(upper, [1, 1], 1.6)[1], '失效', (box) => date(doc, box, { role: 'expire', hours: 24 * 180, bold: true, max: Math.min(3.6, 2.8 * k) })],
    [cols(lower, [1, 1], 1.6)[0], '锅号 / 批次', (box) => text(doc, box, `${s.pot} / ${s.batch}`, { bold: true, max: Math.min(3.6, 2.8 * k) })],
    [cols(lower, [1, 1], 1.6)[1], '操作人', (box) => text(doc, box, s.staff, { bold: true, max: Math.min(3.6, 2.8 * k) })]
  ];
  cells.forEach(([cell, caption, value]) => {
    const [top, bottom] = rows(cell, [1, 1.3], 0.2);
    text(doc, top, caption, { max: Math.min(3, 2.4 * k) });
    value(bottom);
  });
  hline(doc, grid.x, upper.y + upper.h + 0.4, grid.w, { weight: 0.25 });
  vline(doc, grid.x + grid.w / 2, grid.y, grid.h, { weight: 0.25 });
}

/** 床头卡：床号大字、姓名、护理级别、饮食与过敏提示。 */
function bedCard(doc, W, H, b) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [left, right] = cols(safe, [1, 2], 1.4);
  const inner = panel(doc, left);
  const [bed, unit] = rows(inner, [2.2, 1], 0.2);
  text(doc, bed, b.bed, { bold: true, reverse: true, max: Math.min(16, bed.h), align: 'center' });
  text(doc, unit, '床', { reverse: true, max: Math.min(5, unit.h), align: 'center' });
  const [name, lines] = rows(right, [1.3, 3], 0.5);
  titleWithTag(doc, name, b.name, b.level, { max: Math.min(7, 5.4 * k), tagMax: Math.min(3.6, 2.8 * k) });
  infoRows(doc, lines, [b.info, `饮食 ${b.diet}`, b.allergy], { max: Math.min(4.4, 3.4 * k) });
}

/** 床号横排：床号大字与护理级别在顶，姓名放大，饮食与过敏提示在底行。 */
function bedCardRow(doc, W, H, b) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [top, middle, bottom] = rows(safe, [1.3, 1.4, -4 * Math.min(k, 1.2)], 0.8);
  const tagH = Math.min(top.h, 5.2 * k);
  const tag = chip(doc, safe.x + safe.w, top.y + (top.h - tagH) / 2, tagH, b.level, { right: true, max: Math.min(3.8, 3 * k) });
  text(doc, frame(safe.x, top.y, tag.x - safe.x - 1, top.h), `${b.bed} 床`, { bold: true, max: Math.min(10, 7.6 * k) });
  divider(doc, top, middle, { weight: 0.3 });
  const [who, info] = cols(middle, [1.3, 1], 1);
  text(doc, who, b.name, { bold: true, max: Math.min(8, 6 * k) });
  text(doc, info, b.info, { max: Math.min(4.4, 3.4 * k), align: 'right' });
  const [diet, allergy] = cols(bottom, [1, 1], 1.2);
  text(doc, diet, `饮食 ${b.diet}`, { max: Math.min(4, 3.2 * k) });
  text(doc, allergy, b.allergy, { bold: true, max: Math.min(4, 3.2 * k), align: 'right' });
}

/** 服装吊牌：竖版含成分、执行标准、安全类别、价格与条码。 */
function garmentTag(doc, W, H, g) {
  const k = Math.max(0.9, Math.min(1.5, W / 40));
  const safe = safeBox(W, H);
  if (H <= W) {
    const [top, lines, code] = rows(safe, [1.2, 1.5, 1.6], 0.5);
    const [name, price] = cols(top, [1.6, 1], 1);
    text(doc, name, g.name, { bold: true, max: 4.6 });
    priceUnit(doc, price, `¥${g.price}`, '', { max: 5.4, right: true });
    infoRows(doc, lines, [`${g.code} · ${g.color} · ${g.size} 码`, g.fabric], { max: 3.2 });
    const codeW = Math.min(code.w, Math.max(30, code.w * 0.8));
    barcode(doc, frame(code.x + (code.w - codeW) / 2, code.y, codeW, code.h), g.ean, { format: 'ean13', showText: false });
    return;
  }
  const [brand, name, lines, price, code] = rows(safe, [0.8, 1.1, 4.2, 1.3, 1.9], 0.8);
  chip(doc, safe.x, brand.y, brand.h, '清屿服饰', { max: Math.min(4, 3.2 * k) });
  text(doc, frame(safe.x + safe.w * 0.5, brand.y, safe.w * 0.5, brand.h), `尺码 ${g.size}`, { bold: true, align: 'right', max: Math.min(4.4, 3.4 * k) });
  text(doc, name, g.name, { bold: true, max: Math.min(6, 4.6 * k) });
  infoRows(doc, lines, [['货号', g.code], ['颜色', g.color], ['成分', g.fabric], ['执行标准', g.standard], ['安全类别', g.safety], ['检验', '合格']], { max: Math.min(3.8, 3 * k) });
  divider(doc, lines, price);
  priceUnit(doc, price, `¥${g.price}`, '', { max: Math.min(8, 6 * k) });
  barcode(doc, code, g.ean, { format: 'ean13' });
}

/** 尺码方块：反白方块写大号尺码，品名价格在旁，条码在下。 */
function garmentTagSize(doc, W, H, g) {
  const k = Math.max(0.9, Math.min(1.5, W / 40));
  const safe = safeBox(W, H);
  if (H <= W) {
    const [top, code] = rows(safe, [1.3, 1], 0.7);
    const side = top.h;
    const [block, info] = cols(top, [-side, 1], 1.4);
    const inner = slab(doc, block);
    text(doc, inner, g.size, { bold: true, reverse: true, max: inner.h * 0.8, align: 'center' });
    const [name, meta, price] = rows(info, [1.2, 1, 1.4], 0.3);
    text(doc, name, g.name, { bold: true, max: 4.4 });
    text(doc, meta, `${g.code} · ${g.color}`, { max: 3 });
    priceUnit(doc, price, `¥${g.price}`, '', { max: 5.4 });
    const codeW = Math.min(code.w, Math.max(30, code.w * 0.8));
    barcode(doc, frame(code.x + (code.w - codeW) / 2, code.y, codeW, code.h), g.ean, { format: 'ean13', showText: false });
    return;
  }
  const side = safe.w * 0.42;
  const [top, lines, price, code] = rows(safe, [-side, 3.4, 1.2, 1.6], 0.9);
  const [block, head] = cols(top, [-side, 1], 1.4);
  const inner = slab(doc, block);
  const [caption, size] = rows(inner, [1, 2.4], 0.2);
  text(doc, caption, '尺码', { reverse: true, max: Math.min(3.4, 2.6 * k), align: 'center' });
  text(doc, size, g.size, { bold: true, reverse: true, max: size.h, align: 'center' });
  const [brand, name] = rows(head, [1, 1.6], 0.4);
  text(doc, brand, '清屿服饰', { bold: true, max: Math.min(4, 3.2 * k) });
  text(doc, name, g.name, { bold: true, max: Math.min(5.4, 4.2 * k) });
  infoRows(doc, lines, [['货号', g.code], ['颜色', g.color], ['成分', g.fabric], ['执行标准', g.standard], ['安全类别', g.safety]], { max: Math.min(3.6, 2.8 * k) });
  priceUnit(doc, price, `¥${g.price}`, '', { max: Math.min(8, 6 * k), center: true });
  barcode(doc, code, g.ean, { format: 'ean13' });
}

/** 祝福卡：大字祝福 + 一句话 + 落款。 */
function greetingCard(doc, W, H, g) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [title, line, sign] = rows(safe, [2, 1, 0.9], 0.5);
  text(doc, title, g.title, { bold: true, max: Math.min(14, 10 * k), align: 'center' });
  hline(doc, safe.x + safe.w * 0.3, line.y - 0.2, safe.w * 0.4, { weight: 0.3 });
  text(doc, line, g.line, { max: Math.min(5, 3.8 * k), align: 'center' });
  text(doc, sign, g.sign, { max: Math.min(4, 3.2 * k), align: 'right' });
}

/** 竖线信笺：左侧粗竖线点缀，大字祝福左对齐，一句话与落款在下。 */
function greetingCardAccent(doc, W, H, g) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [bar, body] = cols(safe, [-Math.max(1.2, k), 1], 1.8);
  band(doc, frame(bar.x, bar.y + bar.h * 0.08, bar.w, bar.h * 0.84), { square: true });
  const [title, line, sign] = rows(body, [2, 1, 0.9], 0.5);
  text(doc, title, g.title, { bold: true, max: Math.min(12, 9 * k) });
  text(doc, line, g.line, { max: Math.min(4.6, 3.6 * k) });
  text(doc, sign, g.sign, { max: Math.min(3.8, 3 * k), align: 'right' });
}

/** 礼品标签：To / From 与一句祝福。 */
function giftTag(doc, W, H, g) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [to, note, from] = rows(safe, [1.2, 1.4, 1], 0.9);
  text(doc, to, `To：${g.to}`, { bold: true, max: Math.min(5.4, 4.2 * k) });
  text(doc, note, g.note, { max: Math.min(5, 3.8 * k), align: 'center' });
  divider(doc, note, from, { dashed: true });
  text(doc, from, `From：${g.from}`, { max: Math.min(4.4, 3.4 * k), align: 'right' });
}

/** 丝带礼签：祝福语印在横贯中间的反白丝带上，To 在上、From 在下。 */
function giftTagRibbon(doc, W, H, g) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [to, ribbon, from] = rows(safe, [1, 1.3, 1], 0.8);
  text(doc, to, `To：${g.to}`, { bold: true, max: Math.min(5, 3.8 * k) });
  const inner = panel(doc, ribbon);
  text(doc, inner, g.note, { bold: true, reverse: true, max: Math.min(5, 3.8 * k), align: 'center' });
  text(doc, from, `From：${g.from}`, { max: Math.min(4.4, 3.4 * k), align: 'right' });
}

/** Wi-Fi 连接卡：扫码连接 + 网络名与密码。 */
function wifiCard(doc, W, H, w) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const payload = `WIFI:T:WPA;S:${w.ssid};P:${w.password};;`;
  if (W / H > 1.2) {
    const side = Math.min(safe.h, safe.w * 0.42);
    const [code, info] = cols(safe, [-side, 1], 1.6);
    qrcode(doc, code, payload);
    const [title, ssid, password, note] = rows(info, [1.3, 1, 1, 1], 0.4);
    text(doc, title, '扫码连 Wi-Fi', { bold: true, max: Math.min(5.4, 4.2 * k) });
    text(doc, ssid, `网络 ${w.ssid}`, { max: Math.min(4, 3.2 * k) });
    text(doc, password, `密码 ${w.password}`, { bold: true, max: Math.min(4, 3.2 * k) });
    text(doc, note, '请改成实际密码', { max: Math.min(3.4, 2.6 * k) });
    return;
  }
  const [title, code, meta] = rows(safe, [1, 4.6, 1.4], 0.5);
  text(doc, title, '扫码连 Wi-Fi', { bold: true, max: Math.min(6, 4.6 * k), align: 'center' });
  qrcode(doc, code, payload);
  infoRows(doc, meta, [`网络 ${w.ssid}`, `密码 ${w.password}`], { max: Math.min(4, 3.2 * k), align: 'center' });
}

/** 收纳罐：名称大字，下面装罐日期与保存提示（大尺寸分两栏）。 */
function pantryJar(doc, W, H, p) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  if (H < 26) {
    const [name, when, note] = rows(safe, [2, 1, 1], 0.4);
    text(doc, name, p.name, { bold: true, max: Math.min(11, name.h), align: 'center' });
    date(doc, when, { label: '装罐', role: 'made', align: 'center', max: Math.min(3.8, 3 * k) });
    text(doc, note, p.note, { max: Math.min(3.8, 3 * k), align: 'center' });
    return;
  }
  const [name, foot] = rows(safe, [2, 1], 0.8);
  text(doc, name, p.name, { bold: true, max: Math.min(12, name.h), align: 'center' });
  hline(doc, safe.x + safe.w * 0.15, name.y + name.h + 0.4, safe.w * 0.7, { weight: 0.3 });
  const [when, note] = cols(foot, [1, 1.3], 1);
  date(doc, when, { label: '装罐', role: 'made', format: 'MM-DD', max: Math.min(3.8, 3 * k) });
  text(doc, note, p.note, { max: Math.min(3.8, 3 * k), align: 'right' });
}

/** 竖排罐签：名称印在左侧反白块，装罐日期与保存提示在右。 */
function pantryJarBlock(doc, W, H, p) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [block, info] = cols(safe, [1, 1.2], 1.4);
  const inner = slab(doc, block);
  text(doc, inner, p.name, { bold: true, reverse: true, max: Math.min(10, inner.h * 0.6), align: 'center' });
  const [caption, when, note] = rows(info, [1, 1.2, 1.2], 0.4);
  text(doc, caption, '装罐日期', { max: Math.min(3.4, 2.6 * k) });
  date(doc, when, { role: 'made', bold: true, max: Math.min(4.4, 3.4 * k) });
  text(doc, note, p.note, { max: Math.min(3.6, 2.8 * k) });
}

module.exports = {
  CONTENT: { MEDICATIONS, STERILE, BEDS, GARMENTS, GREETINGS, GIFTS, WIFI, PANTRY },
  RECIPES: {
    medicationGuide: {
      styles: [medicationGuide, medicationGuideSlots],
      blurbs: ['服药提醒：用法用量、早中晚勾选与饭前饭后', '早、中、晚、睡前四格，服药人写在标签角'],
      content: 'MEDICATIONS', scene: '服药提醒', category: '医药'
    },
    sterilePack: {
      styles: [sterilePack, sterilePackTable],
      blurbs: ['灭菌与失效日期、锅号批次，右侧留化学指示卡框', '反白顶栏写包名，灭菌信息排成四格表'],
      content: 'STERILE', scene: '灭菌标签', category: '医药'
    },
    bedCard: {
      styles: [bedCard, bedCardRow],
      blurbs: ['床头卡：床号大字、护理级别、饮食与过敏提示', '床号与护理级别在顶，姓名放大，过敏提示加粗'],
      content: 'BEDS', scene: '床头卡', category: '医药'
    },
    garmentTag: {
      styles: [garmentTag, garmentTagSize],
      blurbs: ['服装吊牌：货号、成分、执行标准、安全类别与条码', '反白尺码方块，品名价格在旁，条码在下'],
      content: 'GARMENTS', scene: '服装吊牌', category: '零售'
    },
    greetingCard: {
      styles: [greetingCard, greetingCardAccent],
      blurbs: ['祝福卡：大字祝福 + 一句话 + 落款', '左侧粗竖线点缀，祝福语左对齐'],
      content: 'GREETINGS', scene: '祝福卡', category: '生活'
    },
    giftTag: {
      styles: [giftTag, giftTagRibbon],
      blurbs: ['礼品标签：To / From 与一句祝福', '祝福语印在横贯中间的反白丝带上'],
      content: 'GIFTS', scene: '礼品标签', category: '生活'
    },
    wifiCard: {
      styles: [wifiCard],
      blurbs: ['Wi-Fi 卡：扫码连接，附网络名与密码'],
      content: 'WIFI', scene: 'Wi-Fi 卡', category: '生活'
    },
    pantryJar: {
      styles: [pantryJar, pantryJarBlock],
      blurbs: ['收纳罐：名称大字、装罐日期与保存提示', '名称印在左侧反白块，日期与提示在右'],
      content: 'PANTRY', scene: '收纳罐', category: '生活'
    }
  }
};
