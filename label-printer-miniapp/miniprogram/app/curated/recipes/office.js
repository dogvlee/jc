/**
 * Office, asset and people labels. Asset numbers are serials, and each
 * asset's QR code or barcode follows its own number on every printed copy.
 */
const {
  barcode, chip, cols, date, divider, frame, hline, infoRows, inset, outline, panel, qrcode, rows, safeBox, scaleFor,
  serial, slab, text, titleWithTag, vline
} = require('../layout');

const ASSETS = [
  { name: '笔记本电脑', model: '14 英寸 · 16G/512G', dept: '研发中心', owner: '张工', prefix: 'FA-', start: 1024, bought: '2025-11' },
  { name: '会议投影仪', model: '1080P · 3600 流明', dept: '行政部', owner: '会议室 A', prefix: 'FA-', start: 2048, bought: '2024-06' },
  { name: '人体工学椅', model: '网布 · 可调扶手', dept: '财务部', owner: '李会计', prefix: 'FA-', start: 3101, bought: '2023-03' }
];

const DEVICES = [
  { name: '空气压缩机', model: 'KY-7.5', code: 'SB-0317', cycle: '每 30 天', days: 30, owner: '设备科 周工' },
  { name: '冷库机组', model: 'LK-12', code: 'SB-0521', cycle: '每 15 天', days: 15, owner: '后勤 王师傅' }
];

const FILES = [
  { title: '2026 年度采购合同', dept: '采购部', keep: '30 年', prefix: 'CG-2026-', start: 1 },
  { title: '员工培训记录', dept: '人力资源部', keep: '10 年', prefix: 'RL-2026-', start: 12 }
];

const FOLDERS = [
  { title: '财务报销单据', code: 'CW-09' },
  { title: '项目周报', code: 'XM-38' },
  { title: '客户合同', code: 'HT-26' }
];

const STORAGE = [
  { title: '充电线', note: '抽屉左侧' },
  { title: '常用药品', note: '注意有效期' },
  { title: '工具', note: '用后放回' },
  { title: '证件资料', note: '勿随意取用' }
];

const BADGES = [
  { name: '陈思远', dept: '产品部', title: '产品经理', number: 'XH-0816', company: '星河科技' },
  { name: '林晓', dept: '客户成功部', title: '客户经理', number: 'XH-1203', company: '星河科技' }
];

const STUDENTS = [
  { name: '王小雨', klass: '三年级二班', number: '12 号' },
  { name: '李子轩', klass: '一年级四班', number: '28 号' }
];

const VISITORS = [
  { name: '赵明', purpose: '商务洽谈', host: '陈经理', hours: 8 },
  { name: '孙悦', purpose: '设备维修', host: '行政部', hours: 4 }
];

function company(doc, box, left, right) {
  const inner = panel(doc, box);
  const [a, b] = cols(inner, right ? [2, 1] : [1], 0.8);
  text(doc, a, left, { bold: true, reverse: true, max: Math.max(2.4, box.h * 0.6) });
  return b;
}

/** 固定资产：名称、编号、部门、使用人、购置时间，二维码跟随编号。 */
function assetTag(doc, W, H, a) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  if (H < 26) {
    const [info, code] = cols(safe, [2.2, 1], 1.2);
    const [name, number, owner] = rows(info, [1.2, 1.2, 1], 0.3);
    text(doc, name, a.name, { bold: true, max: 4.2 });
    serial(doc, number, { prefix: a.prefix, start: a.start, digits: 4, bold: true, max: 4 });
    text(doc, owner, `${a.dept} · ${a.owner}`, { max: 3 });
    qrcode(doc, code, `${a.prefix}${a.start}`, { serialLinked: true });
    return;
  }
  const headH = Math.min(6.4, Math.max(4.4, H * 0.15));
  const right = company(doc, frame(safe.x, safe.y, safe.w, headH), '固定资产', true);
  text(doc, right, '云帆科技', { reverse: true, align: 'right', max: Math.max(2.2, headH * 0.5) });
  const body = frame(safe.x, safe.y + headH + 1, safe.w, safe.h - headH - 1);
  const [info, code] = cols(body, [2.1, 1], 1.4);
  const [name, number, lines] = rows(info, [1.2, 1.1, 2.2], 0.3);
  text(doc, name, a.name, { bold: true, max: Math.min(6, 4.6 * k) });
  serial(doc, number, { prefix: a.prefix, start: a.start, digits: 4, bold: true, max: Math.min(5, 3.8 * k) });
  infoRows(doc, lines, [['部门', a.dept], ['使用人', a.owner], ['购置', a.bought]], { max: Math.min(3.6, 2.8 * k), gap: 0.2 });
  const [qr, caption] = rows(code, [3, 1], 0.3);
  qrcode(doc, qr, `${a.prefix}${a.start}`, { serialLinked: true });
  text(doc, caption, '扫码盘点', { max: Math.min(3.4, 2.6 * k), align: 'center' });
}

/** 条码资产：品名与“固定资产”标签在上，大号编号，底部条码跟随编号。 */
function assetTagBarcode(doc, W, H, a) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const first = `${a.prefix}${a.start}`;
  if (H < 26) {
    const [top, code] = rows(safe, [1, 1.3], 0.5);
    const [name, number] = cols(top, [1.1, 1], 1);
    text(doc, name, a.name, { bold: true, max: 4 });
    serial(doc, number, { prefix: a.prefix, start: a.start, digits: 4, bold: true, align: 'right', max: 4 });
    barcode(doc, code, first, { serialLinked: true, showText: false });
    return;
  }
  const [top, number, info, code] = rows(safe, [1, 1.2, -3 * Math.min(k, 1.2), 1.6], 0.5);
  titleWithTag(doc, top, a.name, '固定资产', { max: Math.min(6, 4.6 * k), tagMax: Math.min(3.4, 2.6 * k) });
  serial(doc, number, { prefix: a.prefix, start: a.start, digits: 4, bold: true, max: Math.min(7, 5.4 * k) });
  text(doc, info, `${a.dept} · ${a.owner} · 购置 ${a.bought}`, { max: Math.min(3.4, 2.6 * k) });
  barcode(doc, code, first, { serialLinked: true, showText: false });
}

/** 设备标识与保养：型号、编号、保养周期、下次保养日期。 */
function deviceTag(doc, W, H, d) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [top, lines, next] = rows(safe, [1.3, 3, 1.1], 1);
  titleWithTag(doc, top, d.name, '设备标识', { max: Math.min(6.4, 5 * k), tagMax: Math.min(3.6, 2.8 * k) });
  infoRows(doc, lines, [['型号', d.model], ['编号', d.code], ['保养', d.cycle], ['责任人', d.owner]], { max: Math.min(4, 3.2 * k) });
  divider(doc, lines, next);
  date(doc, next, { label: '下次保养', role: 'expire', hours: 24 * d.days, bold: true, max: Math.min(4.4, 3.4 * k) });
}

/** 保养提醒块：左侧设备信息，右侧反白块写下次保养日期与周期。 */
function deviceTagService(doc, W, H, d) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [info, block] = cols(safe, [1.45, 1], 1.4);
  const [name, model, code, owner] = rows(info, [1.4, 1, 1, 1], 0.4);
  text(doc, name, d.name, { bold: true, max: Math.min(6.4, 5 * k) });
  text(doc, model, `型号 ${d.model}`, { max: Math.min(3.8, 3 * k) });
  text(doc, code, `编号 ${d.code}`, { max: Math.min(3.8, 3 * k) });
  text(doc, owner, d.owner, { max: Math.min(3.8, 3 * k) });
  const inner = slab(doc, block);
  const [caption, next, cycle] = rows(inner, [1, 1.6, 1], 0.3);
  text(doc, caption, '下次保养', { bold: true, reverse: true, max: Math.min(3.8, 3 * k), align: 'center' });
  date(doc, next, { role: 'expire', hours: 24 * d.days, format: 'MM-DD', bold: true, reverse: true, align: 'center', max: Math.min(9, 7 * k) });
  text(doc, cycle, d.cycle, { reverse: true, max: Math.min(3.4, 2.6 * k), align: 'center' });
}

/** 档案盒：案卷名称、年度编号、部门与保管期限。 */
function fileBox(doc, W, H, f) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const headH = Math.min(6.6, Math.max(4.4, H * 0.15));
  company(doc, frame(safe.x, safe.y, safe.w, headH), '档案');
  const body = frame(safe.x, safe.y + headH + 1, safe.w, safe.h - headH - 1);
  const [title, number, lines] = rows(body, [1.5, 1.1, 2], 0.4);
  text(doc, title, f.title, { bold: true, max: Math.min(6.6, 5 * k) });
  serial(doc, number, { prefix: `编号 ${f.prefix}`, start: f.start, digits: 3, max: Math.min(4.2, 3.4 * k) });
  infoRows(doc, lines, [['部门', f.dept], ['保管期限', f.keep]], { max: Math.min(4, 3.2 * k) });
}

/** 编号大框：部门与保管期限在上，案卷名称居中，档案编号放进底部大框。 */
function fileBoxNumber(doc, W, H, f) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [top, title, box] = rows(safe, [1, 1.6, 1.5], 0.7);
  const keep = chip(doc, safe.x + safe.w, top.y, top.h, `保管 ${f.keep}`, { right: true, max: Math.min(3.6, 2.8 * k) });
  text(doc, frame(safe.x, top.y, keep.x - safe.x - 1, top.h), f.dept, { bold: true, max: Math.min(4, 3.2 * k) });
  text(doc, title, f.title, { bold: true, max: Math.min(7, 5.4 * k), align: 'center' });
  outline(doc, box, { rounded: true, weight: 0.35 });
  const [caption, number] = cols(inset(box, 1.2, 0.6), [1, 2.4], 1);
  text(doc, caption, '档案编号', { max: Math.min(3.6, 2.8 * k) });
  serial(doc, number, { prefix: f.prefix, start: f.start, digits: 3, bold: true, align: 'right', max: Math.min(6, 4.6 * k) });
}

/** 文件夹标签条：名称 + 编号。 */
function folderTab(doc, W, H, f) {
  const safe = safeBox(W, H);
  const [title, code] = cols(safe, [3, 1], 1.2);
  text(doc, title, f.title, { bold: true, max: safe.h * 0.72 });
  text(doc, code, f.code, { max: safe.h * 0.48, align: 'right' });
}

/** 编号在前：左侧反白编号块，右侧名称。 */
function folderTabCode(doc, W, H, f) {
  const safe = safeBox(W, H);
  const [code, title] = cols(safe, [1.3, 2.4], 1.2);
  const inner = slab(doc, code);
  text(doc, inner, f.code, { bold: true, reverse: true, max: inner.h * 0.8, align: 'center' });
  text(doc, title, f.title, { bold: true, max: safe.h * 0.72 });
}

/** 收纳分类：名称写在圆角框里，下面一行说明。 */
function storageTag(doc, W, H, s) {
  const safe = safeBox(W, H);
  const [box, note] = rows(safe, [2, 1], 0.5);
  outline(doc, box, { rounded: true, weight: 0.35 });
  text(doc, inset(box, 1, 0.6), s.title, { bold: true, max: box.h, align: 'center', bind: 'name' });
  text(doc, note, s.note, { max: Math.min(3.2, note.h), align: 'center' });
}

/** 大字 + 反白说明：名称大字居中，说明印在居中的反白小标签里。 */
function storageTagNote(doc, W, H, s) {
  const safe = safeBox(W, H);
  const [title, note] = rows(safe, [1.8, 1], 0.5);
  text(doc, title, s.title, { bold: true, max: title.h, align: 'center' });
  chip(doc, safe.x + safe.w / 2, note.y, note.h, s.note, { center: true, max: Math.min(3.2, note.h * 0.64) });
}

/** 员工名牌：公司、姓名、部门职务与工号。 */
function staffBadge(doc, W, H, b) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const headH = Math.min(6.6, Math.max(4.4, H * 0.15));
  const right = company(doc, frame(safe.x, safe.y, safe.w, headH), b.company, true);
  text(doc, right, b.number, { reverse: true, align: 'right', max: Math.max(2.2, headH * 0.5) });
  const body = frame(safe.x, safe.y + headH + 1.2, safe.w, safe.h - headH - 1.2);
  const [name, role] = rows(body, [2.2, 1], 0.6);
  text(doc, name, b.name, { bold: true, max: Math.min(14, 10 * k), align: 'center' });
  text(doc, role, `${b.dept} · ${b.title}`, { max: Math.min(5, 3.8 * k), align: 'center' });
}

/** 分栏名牌：公司名在顶，左侧大号姓名，右侧部门、职务与工号。 */
function staffBadgeSplit(doc, W, H, b) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [top, body] = rows(safe, [-Math.min(4.6, 3.6 * k), 1], 1.2);
  const [name2, mark] = cols(top, [1.5, 1], 1);
  text(doc, name2, b.company, { bold: true, max: Math.min(4.2, 3.2 * k) });
  text(doc, mark, '工作证', { max: Math.min(3.8, 3 * k), align: 'right' });
  hline(doc, safe.x, top.y + top.h + 0.6, safe.w, { weight: 0.3 });
  const [name, meta] = cols(body, [1.5, 1], 1.6);
  text(doc, name, b.name, { bold: true, max: Math.min(14, 10 * k) });
  vline(doc, meta.x - 0.8, meta.y + 0.5, meta.h - 1, { weight: 0.3 });
  const [dept, title, number] = rows(inset(meta, 0.8, 0), [1, 1, 1], 0.4);
  text(doc, dept, b.dept, { max: Math.min(4, 3.2 * k) });
  text(doc, title, b.title, { bold: true, max: Math.min(4, 3.2 * k) });
  const chipH = Math.min(number.h, 4.2 * Math.min(k, 1.2));
  chip(doc, number.x, number.y + (number.h - chipH) / 2, chipH, b.number, { max: Math.min(3.4, 2.6 * k) });
}

/** 学生姓名贴：姓名大字 + 班级学号。 */
function nameSticker(doc, W, H, s) {
  const safe = safeBox(W, H);
  if (H < 18) {
    const [name, klass] = cols(safe, [1.2, 1], 1);
    text(doc, name, s.name, { bold: true, max: safe.h * 0.7, bind: 'name' });
    text(doc, klass, s.klass, { max: safe.h * 0.42, align: 'right' });
    return;
  }
  const [name, klass] = rows(safe, [1.8, 1], 0.4);
  text(doc, name, s.name, { bold: true, max: name.h, align: 'center', bind: 'name' });
  text(doc, klass, `${s.klass} · ${s.number}`, { max: Math.min(4, klass.h), align: 'center' });
}

/** 姓名 + 反白学号：姓名大字，班级在左下，学号印在反白标签里。 */
function nameStickerTag(doc, W, H, s) {
  const safe = safeBox(W, H);
  if (H < 18) {
    const [name, number] = cols(safe, [1.5, 1], 1);
    text(doc, name, s.name, { bold: true, max: safe.h * 0.7 });
    const inner = slab(doc, number);
    text(doc, inner, s.number, { bold: true, reverse: true, max: inner.h * 0.8, align: 'center' });
    return;
  }
  const [name, foot] = rows(safe, [1.8, 1], 0.5);
  text(doc, name, s.name, { bold: true, max: name.h, align: 'center' });
  const chipH = Math.min(foot.h, 5.2);
  const tag = chip(doc, safe.x + safe.w, foot.y + (foot.h - chipH) / 2, chipH, s.number, { right: true, max: Math.min(3.6, chipH * 0.64) });
  text(doc, frame(safe.x, foot.y, tag.x - safe.x - 1, foot.h), s.klass, { max: Math.min(4, foot.h) });
}

/** 访客证：访客、事由、被访人与有效时间，编号自动递增。 */
function visitorPass(doc, W, H, v) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const headH = Math.min(6.6, Math.max(4.6, H * 0.15));
  const right = company(doc, frame(safe.x, safe.y, safe.w, headH), '访客证', true);
  serial(doc, right, { prefix: 'No.', start: 1, digits: 4, align: 'right', reverse: true, max: Math.max(2.2, headH * 0.5) });
  const body = frame(safe.x, safe.y + headH + 1, safe.w, safe.h - headH - 1);
  const [name, lines, until] = rows(body, [1.5, 2, 1], 0.4);
  text(doc, name, v.name, { bold: true, max: Math.min(9, 7 * k) });
  infoRows(doc, lines, [['事由', v.purpose], ['被访人', v.host]], { max: Math.min(4, 3.2 * k) });
  date(doc, until, { label: '有效至', role: 'expire', hours: v.hours, format: 'MM-DD HH:mm', bold: true, max: Math.min(4.2, 3.2 * k) });
}

/** 访客大字：左侧反白“访客”块与编号，右侧姓名、事由、被访人与有效时间。 */
function visitorPassBadge(doc, W, H, v) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const side = Math.min(safe.h, safe.w * 0.34);
  const [block, info] = cols(safe, [-side, 1], 1.6);
  const inner = panel(doc, block);
  const [word, number] = rows(inner, [2, 1], 0.3);
  text(doc, word, '访客', { bold: true, reverse: true, max: Math.min(12, word.h), align: 'center' });
  serial(doc, number, { prefix: 'No.', start: 1, digits: 4, reverse: true, align: 'center', max: Math.min(3.6, 2.8 * k) });
  const [name, purpose, host, until] = rows(info, [1.5, 1, 1, 1.1], 0.5);
  text(doc, name, v.name, { bold: true, max: Math.min(9, 7 * k) });
  text(doc, purpose, `事由 ${v.purpose}`, { max: Math.min(4, 3.2 * k) });
  text(doc, host, `被访人 ${v.host}`, { max: Math.min(4, 3.2 * k) });
  date(doc, until, { label: '有效至', role: 'expire', hours: v.hours, format: 'MM-DD HH:mm', bold: true, max: Math.min(4.2, 3.2 * k) });
}

module.exports = {
  CONTENT: { ASSETS, DEVICES, FILES, FOLDERS, STORAGE, BADGES, STUDENTS, VISITORS },
  RECIPES: {
    assetTag: {
      styles: [assetTag, assetTagBarcode],
      blurbs: ['固定资产：编号自动递增，盘点二维码跟随编号', '大号资产编号，底部条码跟随编号'],
      content: 'ASSETS', scene: '固定资产', category: '办公'
    },
    deviceTag: {
      styles: [deviceTag, deviceTagService],
      blurbs: ['设备标识：型号、编号、保养周期与下次保养日期', '右侧反白块写下次保养日期与周期'],
      content: 'DEVICES', scene: '设备标识', category: '工业'
    },
    fileBox: {
      styles: [fileBox, fileBoxNumber],
      blurbs: ['档案盒：案卷名称、编号、部门与保管期限', '案卷名称居中，档案编号放进底部大框'],
      content: 'FILES', scene: '档案盒', category: '办公'
    },
    folderTab: {
      styles: [folderTab, folderTabCode],
      blurbs: ['文件夹标签条：名称 + 编号', '反白编号在前，名称在后'],
      content: 'FOLDERS', scene: '文件夹标签', category: '办公'
    },
    storageTag: {
      styles: [storageTag, storageTagNote],
      blurbs: ['收纳分类：名称写在圆角框里 + 一行说明', '名称大字，说明印在反白小标签里'],
      content: 'STORAGE', scene: '收纳分类', category: '生活'
    },
    staffBadge: {
      styles: [staffBadge, staffBadgeSplit],
      blurbs: ['员工名牌：公司、姓名、部门职务与工号', '左侧大号姓名，右侧部门职务与工号'],
      content: 'BADGES', scene: '员工名牌', category: '办公'
    },
    nameSticker: {
      styles: [nameSticker, nameStickerTag],
      blurbs: ['学生姓名贴：姓名大字 + 班级学号', '姓名大字，学号印在反白标签里'],
      content: 'STUDENTS', scene: '姓名贴', category: '生活'
    },
    visitorPass: {
      styles: [visitorPass, visitorPassBadge],
      blurbs: ['访客证：编号自动递增，有效时间精确到分钟', '左侧反白“访客”块与编号，右侧访客信息'],
      content: 'VISITORS', scene: '访客证', category: '办公'
    }
  }
};
