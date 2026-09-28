/**
 * Factory, quality, 6S, cable and laboratory labels. Sample IDs are serials
 * whose barcode or QR code follows the printed number.
 */
const {
  barcode, chip, cols, date, disc, divider, frame, hline, infoRows, inset, outline, panel, qrcode, rows, safeBox,
  scaleFor, serial, text, titleWithTag
} = require('../layout');

const STATUSES = [
  { status: '合格', note: '允许放行', inspector: 'QC-07' },
  { status: '待检', note: '检验前请勿使用', inspector: 'QC-03' },
  { status: '不合格', note: '隔离待处理', inspector: 'QC-07' },
  { status: '暂停使用', note: '设备维修中', inspector: '设备科' }
];

const CERTIFICATES = [
  { product: '不锈钢保温杯', model: '500ml · 304', inspector: '检 05', batch: 'P260928' },
  { product: '电源适配器', model: '12V 2A', inspector: '检 11', batch: 'D260927' }
];

const MACHINES = [
  { name: '数控车床', code: 'CNC-06', owner: '周工' },
  { name: '空压机组', code: 'KY-02', owner: '王师傅' }
];

const SIGNS = [
  { title: '小心地滑', note: '雨天及拖地后请慢行' },
  { title: '非工作人员禁止入内', lines: '非工作人员\n禁止入内', note: '如需进入请联系管理员' },
  { title: '请随手关门', note: '保持室内温度' }
];

const CABLES = [
  { code: 'CAB-01', from: '1F 机柜 A', to: '2F 配线架' },
  { code: 'LN-102', from: '交换机 03', to: '工位 18' }
];

const CIRCUITS = [
  { code: 'N1', use: '照明回路 · 3F 东侧', load: '16A' },
  { code: 'K3', use: '空调插座 · 会议室', load: '20A' }
];

const NETWORK = [
  { name: '核心交换机', ip: '192.168.1.1', place: '机房 A-02', admin: '网管 刘工' },
  { name: '无线 AP-12', ip: '192.168.10.12', place: '3F 走廊', admin: '网管 刘工' }
];

const LAB_SAMPLES = [
  { name: '自来水水样', item: '菌落总数', staff: '陈晨', prefix: 'YP', start: 2609001 },
  { name: '土壤样品', item: '重金属', staff: '吴迪', prefix: 'TR', start: 2609015 }
];

const REAGENTS = [
  { name: '氢氧化钠溶液', concentration: '0.1 mol/L', staff: '陈晨', days: 30 },
  { name: '无水乙醇', concentration: '75% 消毒用', staff: '吴迪', days: 7 }
];

/** 状态标签：合格 / 待检 / 不合格 / 暂停使用。 */
function statusTag(doc, W, H, s) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [word, note, foot] = rows(safe, [2.3, 1, 1], 0.5);
  const inner = panel(doc, word);
  text(doc, inner, s.status, { bold: true, reverse: true, max: Math.min(16, inner.h * 0.9), align: 'center' });
  text(doc, note, s.note, { bold: true, max: Math.min(4.4, 3.4 * k), align: 'center' });
  const [who, when] = cols(foot, [1, 1], 1);
  text(doc, who, `检验 ${s.inspector}`, { max: Math.min(3.8, 3 * k) });
  date(doc, when, { role: 'made', format: 'MM-DD', align: 'right', max: Math.min(3.8, 3 * k) });
}

/** 描边状态：状态大字写在粗描边圆角框里，说明与检验信息在下。 */
function statusTagOutline(doc, W, H, s) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [word, note, foot] = rows(safe, [2.3, 1, 1], 0.5);
  outline(doc, word, { rounded: true, weight: 0.6 });
  text(doc, inset(word, 1.2, 0.8), s.status, { bold: true, max: Math.min(16, word.h * 0.75), align: 'center' });
  text(doc, note, s.note, { max: Math.min(4.4, 3.4 * k), align: 'center' });
  const [who, when] = cols(foot, [1, 1], 1);
  text(doc, who, `检验 ${s.inspector}`, { max: Math.min(3.8, 3 * k) });
  date(doc, when, { role: 'made', format: 'MM-DD', align: 'right', max: Math.min(3.8, 3 * k) });
}

/** 合格证：产品、型号、检验员、批号与检验日期。 */
function qcCertificate(doc, W, H, c) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  if (H < 26) {
    const [title, lines] = cols(safe, [1, 2.2], 1.2);
    const inner = panel(doc, title);
    text(doc, inner, '合格证', { bold: true, reverse: true, max: 5, align: 'center' });
    const [product, meta, when] = rows(lines, [1.2, 1, 1], 0.3);
    text(doc, product, c.product, { bold: true, max: 3.8 });
    text(doc, meta, `${c.inspector} · ${c.batch}`, { max: 3 });
    date(doc, when, { label: '检验', role: 'made', max: 3 });
    return;
  }
  const [title, lines, when] = rows(safe, [1.2, 2.8, 0.9], 1);
  text(doc, title, '合  格  证', { bold: true, max: Math.min(7, 5.4 * k), align: 'center' });
  divider(doc, title, lines, { weight: 0.3 });
  infoRows(doc, lines, [['产品', c.product], ['型号', c.model], ['检验', `${c.inspector} · 批号 ${c.batch}`]], { max: Math.min(4, 3.2 * k), gap: 0.5 });
  date(doc, when, { label: '检验日期', role: 'made', max: Math.min(4, 3.2 * k), bold: true });
}

/** 合格印章：左侧描边方框写“合格”，右侧产品、型号、检验员与日期。 */
function qcCertificateStamp(doc, W, H, c) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  if (H < 26) {
    const [top, bottom] = rows(safe, [1, 1], 0.6);
    const tag = chip(doc, safe.x, top.y, top.h, '合格', { max: 4 });
    text(doc, frame(tag.x + tag.width + 1, top.y, safe.x + safe.w - tag.x - tag.width - 1, top.h), c.product, { bold: true, max: 4 });
    const [batch, when] = cols(bottom, [1.1, 1], 1);
    text(doc, batch, `批号 ${c.batch}`, { max: 3 });
    date(doc, when, { label: '检验', role: 'made', format: 'MM-DD', align: 'right', max: 3 });
    return;
  }
  const side = Math.min(safe.h, safe.w * 0.36);
  const [stamp, info] = cols(safe, [-side, 1], 1.6);
  const box = frame(stamp.x, stamp.y + (stamp.h - side) / 2, side, side);
  outline(doc, box, { rounded: true, weight: 0.6 });
  const [word, sub] = rows(inset(box, 1, 1), [1.6, 1], 0.2);
  text(doc, word, '合格', { bold: true, max: Math.min(9, word.h), align: 'center' });
  text(doc, sub, 'QC PASS', { max: Math.min(3.4, sub.h), align: 'center' });
  const [product, model, inspector, when] = rows(info, [1.3, 1, 1, 1], 0.4);
  text(doc, product, c.product, { bold: true, max: Math.min(5, 4 * k) });
  text(doc, model, c.model, { max: Math.min(3.6, 2.8 * k) });
  text(doc, inspector, `${c.inspector} · ${c.batch}`, { max: Math.min(3.6, 2.8 * k) });
  date(doc, when, { label: '检验', role: 'made', max: Math.min(3.6, 2.8 * k) });
}

/** 设备状态牌：运行 / 停机 / 维修勾选，责任人与日期。 */
function machineStatus(doc, W, H, m) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const headH = Math.min(7, Math.max(4.6, H * 0.15));
  const inner = panel(doc, frame(safe.x, safe.y, safe.w, headH));
  const [title, code] = cols(inner, [1.3, 1], 0.8);
  text(doc, title, '设备状态', { bold: true, reverse: true, max: Math.max(2.6, headH * 0.6) });
  text(doc, code, m.code, { reverse: true, align: 'right', max: Math.max(2.4, headH * 0.55) });
  const body = frame(safe.x, safe.y + headH + 1, safe.w, safe.h - headH - 1);
  const [name, checks, foot] = rows(body, [1.3, 1.3, 1], 0.5);
  text(doc, name, m.name, { bold: true, max: Math.min(7, 5.6 * k) });
  text(doc, checks, '□ 运行   □ 停机   □ 维修   □ 待修', { max: Math.min(5, 4 * k) });
  const [owner, when] = cols(foot, [1, 1], 1);
  text(doc, owner, `责任人 ${m.owner}`, { max: Math.min(4, 3.2 * k) });
  date(doc, when, { role: 'made', align: 'right', max: Math.min(4, 3.2 * k) });
}

/** 状态四宫格：设备名与编号在上，运行 / 停机 / 维修 / 待修各占一格。 */
function machineStatusGrid(doc, W, H, m) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [top, grid, foot] = rows(safe, [1.1, 2.4, -3.2 * Math.min(k, 1.2)], 0.8);
  titleWithTag(doc, top, m.name, m.code, { max: Math.min(7, 5.6 * k), tagMax: Math.min(3.8, 3 * k) });
  const labels = ['运行', '停机', '维修', '待修'];
  rows(grid, [1, 1], 1).forEach((line, row) => {
    cols(line, [1, 1], 1.2).forEach((cell, column) => {
      outline(doc, cell, { rounded: true, weight: 0.3 });
      text(doc, inset(cell, 1, 0.5), `□ ${labels[row * 2 + column]}`, { bold: true, max: Math.min(5, 4 * k), align: 'center' });
    });
  });
  const [owner, when] = cols(foot, [1, 1], 1);
  text(doc, owner, `责任人 ${m.owner}`, { max: Math.min(3.8, 3 * k) });
  date(doc, when, { role: 'made', align: 'right', max: Math.min(3.8, 3 * k) });
}

/** 提示用语：注意标记 + 大字提示 + 说明。 */
function safetySign(doc, W, H, s) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [top, title, note] = rows(safe, [1, 1.8, 1], 0.5);
  chip(doc, safe.x, top.y, top.h, '温馨提示', { max: Math.min(4, 3.2 * k) });
  text(doc, title, s.title, { bold: true, max: Math.min(10, 8 * k) });
  text(doc, note, s.note, { max: Math.min(4, 3.2 * k) });
}

/** 圆形警示：左侧黑色圆标与感叹号，右侧大字提示与说明。 */
function safetySignDisc(doc, W, H, s) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const side = Math.min(safe.h, safe.w * 0.32);
  const [mark, info] = cols(safe, [-side, 1], 1.8);
  const inner = disc(doc, mark);
  text(doc, inner, '!', { bold: true, reverse: true, max: inner.h, align: 'center' });
  const [title, note] = rows(info, [1.6, 1], 0.6);
  text(doc, title, s.lines || s.title, { bold: true, max: Math.min(9, 7 * k) });
  text(doc, note, s.note, { max: Math.min(4, 3.2 * k) });
}

/** 线缆标识：编号 + 起止位置。 */
function cableFlag(doc, W, H, c) {
  const safe = safeBox(W, H);
  const [code, route] = cols(safe, [1, 1.5], 1.2);
  text(doc, code, c.code, { bold: true, max: safe.h * 0.72, bind: 'code' });
  const [from, to] = rows(route, [1, 1], 0.2);
  text(doc, from, `起 ${c.from}`, { max: 3.2, align: 'right' });
  text(doc, to, `止 ${c.to}`, { max: 3.2, align: 'right' });
}

/** 两端重复：编号印在左右两端，绕线后两面都能看到，中间写起止位置。 */
function cableFlagRepeat(doc, W, H, c) {
  const safe = safeBox(W, H);
  const [left, route, right] = cols(safe, [1, 1.25, 1], 0.8);
  text(doc, left, c.code, { bold: true, max: safe.h * 0.7 });
  const [from, to] = rows(route, [1, 1], 0.2);
  text(doc, from, `起 ${c.from}`, { max: 3, align: 'center' });
  text(doc, to, `止 ${c.to}`, { max: 3, align: 'center' });
  text(doc, right, c.code, { bold: true, max: safe.h * 0.7, align: 'right' });
}

/** 配电回路：回路编号、用途与额定电流。 */
function circuitLabel(doc, W, H, c) {
  const safe = safeBox(W, H);
  const [code, info] = cols(safe, [1, 3], 1.2);
  const inner = panel(doc, code);
  text(doc, inner, c.code, { bold: true, reverse: true, max: 6, align: 'center' });
  const [use, load] = rows(info, [1, 1], 0.2);
  text(doc, use, c.use, { bold: true, max: 3.6 });
  text(doc, load, `额定 ${c.load} · 检修前请断电`, { max: 3 });
}

/** 用途在上：用途加粗一行，下行回路编号反白标签与额定电流。 */
function circuitLabelUse(doc, W, H, c) {
  const safe = safeBox(W, H);
  const [use, bottom] = rows(safe, [1, 1], 0.6);
  text(doc, use, c.use, { bold: true, max: 4 });
  const tag = chip(doc, safe.x, bottom.y, bottom.h, `回路 ${c.code}`, { max: 3.4 });
  const restX = tag.x + tag.width + 1;
  text(doc, frame(restX, bottom.y, safe.x + safe.w - restX, bottom.h), `额定 ${c.load}`, { max: 3.4, align: 'right' });
}

/** 网络设备：名称、IP、位置与管理员。 */
function networkTag(doc, W, H, n) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [name, lines] = rows(safe, [1.2, 3], 0.4);
  text(doc, name, n.name, { bold: true, max: Math.min(6, 4.8 * k) });
  infoRows(doc, lines, [['IP', n.ip], ['位置', n.place], ['管理', n.admin]], { max: Math.min(4, 3.2 * k) });
}

/** IP 框：反白顶栏写设备名，IP 地址放进描边框，位置与管理员在底行。 */
function networkTagIp(doc, W, H, n) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const headH = Math.min(6.4, Math.max(4.6, H * 0.18));
  const [head, ip, foot] = rows(safe, [-headH, 1, -3.2 * Math.min(k, 1.2)], 0.8);
  const inner = panel(doc, head);
  const [name, mark] = cols(inner, [1.6, 1], 0.8);
  text(doc, name, n.name, { bold: true, reverse: true, max: headH * 0.62 });
  text(doc, mark, '网络设备', { reverse: true, align: 'right', max: headH * 0.5 });
  outline(doc, ip, { rounded: true, weight: 0.35 });
  const [caption, value] = cols(inset(ip, 1.2, 0.6), [1, 4.2], 1);
  text(doc, caption, 'IP', { bold: true, max: Math.min(4.4, 3.4 * k) });
  text(doc, value, n.ip, { bold: true, max: Math.min(8, 6 * k), align: 'right' });
  const [place, admin] = cols(foot, [1, 1], 1);
  text(doc, place, n.place, { max: Math.min(3.6, 2.8 * k) });
  text(doc, admin, n.admin, { max: Math.min(3.6, 2.8 * k), align: 'right' });
}

/** 样品标签：样品编号自动递增，条码或二维码跟随编号。 */
function labSample(doc, W, H, s) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const first = `${s.prefix}${s.start}`;
  if (safe.w < 34) {
    const [info, code] = cols(safe, [1.25, 1], 1);
    const [number, name, when] = rows(info, [1.2, 1, 1], 0.3);
    serial(doc, number, { prefix: s.prefix, start: s.start, digits: 7, bold: true, max: 3.8 });
    text(doc, name, s.name, { max: 3.2 });
    date(doc, when, { role: 'made', format: 'MM-DD HH:mm', max: 3 });
    qrcode(doc, code, first, { serialLinked: true });
    return;
  }
  const [top, info, code] = rows(safe, [1, H < 26 ? 0.9 : 1.6, 1.5], 0.5);
  const [number, when] = cols(top, [1.1, 1], 1);
  serial(doc, number, { prefix: s.prefix, start: s.start, digits: 7, bold: true, max: Math.min(5, 4 * k) });
  date(doc, when, { role: 'made', format: 'MM-DD HH:mm', align: 'right', max: Math.min(3.8, 3 * k) });
  if (H < 26) {
    text(doc, info, `${s.name} · ${s.item}`, { max: 3.2 });
  } else {
    infoRows(doc, info, [['样品', s.name], ['项目', `${s.item} · ${s.staff}`]], { max: Math.min(4, 3.2 * k) });
  }
  barcode(doc, code, first, { serialLinked: true, showText: false });
}

/** 编号横栏 + 二维码：样品编号横贯顶部，二维码跟随编号，样品与采样信息在旁。 */
function labSampleQr(doc, W, H, s) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [top, body] = rows(safe, [1, 2.6], 0.8);
  const tag = chip(doc, safe.x + safe.w, top.y, top.h, '样品', { right: true, max: Math.min(3.4, 2.6 * k) });
  serial(doc, frame(safe.x, top.y, tag.x - safe.x - 1, top.h), {
    prefix: s.prefix, start: s.start, digits: 7, bold: true, max: Math.min(5, 4 * k)
  });
  divider(doc, top, body);
  const side = Math.min(body.h, body.w * 0.4);
  const [code, info] = cols(body, [-side, 1], 1.4);
  qrcode(doc, code, `${s.prefix}${s.start}`, { serialLinked: true });
  const [name, item, when] = rows(info, [1.2, 1, 1], 0.3);
  text(doc, name, s.name, { bold: true, max: Math.min(4, 3.2 * k) });
  text(doc, item, `${s.item} · ${s.staff}`, { max: Math.min(3.6, 2.8 * k) });
  date(doc, when, { role: 'made', format: 'MM-DD HH:mm', max: Math.min(3.6, 2.8 * k) });
}

/** 试剂顶栏：反白顶栏写试剂名与配制人，浓度加粗，配制与有效期并排。 */
function reagentLabel(doc, W, H, r) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const headH = Math.min(6.4, Math.max(4.4, H * 0.18));
  const [head, conc, dates] = rows(safe, [-headH, 1.1, 1.7], 0.6);
  const inner = panel(doc, head);
  const [name, staff] = cols(inner, [1.8, 1], 0.8);
  text(doc, name, r.name, { bold: true, reverse: true, max: headH * 0.62 });
  text(doc, staff, r.staff, { reverse: true, align: 'right', max: headH * 0.5 });
  text(doc, conc, r.concentration, { bold: true, max: Math.min(7, 5.4 * k) });
  const [made, until] = cols(dates, [1, 1], 1.2);
  const [madeCaption, madeDate] = rows(made, [1, 1.3], 0.2);
  text(doc, madeCaption, '配制日期', { max: Math.min(3.4, 2.6 * k) });
  date(doc, madeDate, { role: 'made', max: Math.min(3.8, 3 * k) });
  const [untilCaption, untilDate] = rows(until, [1, 1.3], 0.2);
  text(doc, untilCaption, '有效期至', { bold: true, max: Math.min(3.4, 2.6 * k) });
  date(doc, untilDate, { role: 'expire', hours: 24 * r.days, bold: true, max: Math.min(3.8, 3 * k) });
}

/** 有效期框：品名浓度在上，有效期至放进描边框，配制日期与配制人在下。 */
function reagentLabelBox(doc, W, H, r) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const line = -3.2 * Math.min(k, 1.2);
  const [name, conc, box, foot] = rows(safe, [1.2, line, 1.5, line], 0.5);
  titleWithTag(doc, name, r.name, '试剂', { max: Math.min(5.4, 4.4 * k), tagMax: Math.min(3.4, 2.8 * k) });
  text(doc, conc, r.concentration, { max: Math.min(3.8, 3 * k) });
  outline(doc, box, { rounded: true, weight: 0.4 });
  const [caption, until] = cols(inset(box, 1, 0.5), [1, 2.2], 0.8);
  text(doc, caption, '有效期至', { bold: true, max: Math.min(3.6, 2.8 * k) });
  date(doc, until, { role: 'expire', hours: 24 * r.days, bold: true, align: 'right', max: Math.min(5.4, 4.2 * k) });
  const [made, staff] = cols(foot, [1.4, 1], 1);
  date(doc, made, { label: '配制', role: 'made', max: Math.min(3.4, 2.6 * k) });
  text(doc, staff, `配制人 ${r.staff}`, { max: Math.min(3.4, 2.6 * k), align: 'right' });
}

module.exports = {
  CONTENT: { STATUSES, CERTIFICATES, MACHINES, SIGNS, CABLES, CIRCUITS, NETWORK, LAB_SAMPLES, REAGENTS },
  RECIPES: {
    statusTag: {
      styles: [statusTag, statusTagOutline],
      blurbs: ['状态标识：合格、待检、不合格、暂停使用', '状态大字写在粗描边框里，省墨且醒目'],
      content: 'STATUSES', scene: '状态标识', category: '工业'
    },
    qcCertificate: {
      styles: [qcCertificate, qcCertificateStamp],
      blurbs: ['合格证：产品、型号、检验员、批号与检验日期', '左侧“合格”印章框，右侧产品与检验信息'],
      content: 'CERTIFICATES', scene: '合格证', category: '工业'
    },
    machineStatus: {
      styles: [machineStatus, machineStatusGrid],
      blurbs: ['设备状态牌：运行 / 停机 / 维修勾选与责任人', '运行、停机、维修、待修各占一格，便于勾选'],
      content: 'MACHINES', scene: '设备状态', category: '工业'
    },
    safetySign: {
      styles: [safetySign, safetySignDisc],
      blurbs: ['温馨提示：大字提示 + 一行说明', '黑色圆标感叹号 + 大字提示'],
      content: 'SIGNS', scene: '提示标识', category: '办公'
    },
    cableFlag: {
      styles: [cableFlag, cableFlagRepeat],
      blurbs: ['线缆标识：编号 + 起止位置', '编号印在两端，绕线后两面都能看到'],
      content: 'CABLES', scene: '线缆标识', category: '通信'
    },
    circuitLabel: {
      styles: [circuitLabel, circuitLabelUse],
      blurbs: ['配电回路：回路编号、用途与额定电流', '用途加粗在上，回路编号反白标签在下'],
      content: 'CIRCUITS', scene: '配电标识', category: '通信'
    },
    networkTag: {
      styles: [networkTag, networkTagIp],
      blurbs: ['网络设备：名称、IP、位置与管理员', '反白顶栏写设备名，IP 地址放大'],
      content: 'NETWORK', scene: '网络设备', category: '通信'
    },
    labSample: {
      styles: [labSample, labSampleQr],
      blurbs: ['样品标签：编号自动递增，条码或二维码跟随编号', '二维码在左跟随编号，编号与采样信息在右'],
      content: 'LAB_SAMPLES', scene: '样品标签', category: '实验'
    },
    reagentLabel: {
      styles: [reagentLabel, reagentLabelBox],
      blurbs: ['反白顶栏写试剂名，配制与有效期并排', '有效期至放进描边框，配制日期在下'],
      content: 'REAGENTS', scene: '试剂标签', category: '实验'
    }
  }
};
