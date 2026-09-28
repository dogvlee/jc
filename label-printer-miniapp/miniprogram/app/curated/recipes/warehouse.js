/**
 * Warehouse and logistics labels. Location barcodes drop separators so they
 * stay narrow (Code 128 packs the digits), and carton numbers auto-increment.
 */
const {
  barcode, chip, cols, date, divider, frame, hline, infoRows, panel, qrcode, rows, safeBox, scaleFor, serial, text, titleWithTag
} = require('../layout');

const MATERIALS = [
  { name: '不锈钢六角螺栓', code: 'WL10086', spec: 'M8×30 · 304', qty: '500 个', batch: 'B260928', supplier: '示例五金', status: '合格' },
  { name: '五层瓦楞纸箱', code: 'BZ20318', spec: '400×300×250mm', qty: '200 只', batch: 'B260926', supplier: '示例包材', status: '待检' },
  { name: '工业润滑油', code: 'YL00731', spec: '4L/桶', qty: '12 桶', batch: 'B260920', supplier: '示例化工', status: '合格' }
];

const BINS = [
  { code: 'A-03-02', scan: 'A0302', zone: 'A 区', row: '03 排', level: '02 层', note: '拣货位' },
  { code: 'B-12-05', scan: 'B1205', zone: 'B 区', row: '12 排', level: '05 层', note: '存储位' },
  { code: 'C-01-01', scan: 'C0101', zone: 'C 区', row: '01 排', level: '01 层', note: '退货暂存' }
];

const CARTONS = [
  { name: '儿童保温杯', qty: '24 只/箱', batch: 'BW2609', dest: '华东仓', total: 20 },
  { name: '无线耳机', qty: '50 副/箱', batch: 'EJ2609', dest: '华南仓', total: 12 }
];

const PARCELS = [
  { name: '张三', phone: '138-0000-1234', address: '浙江省杭州市西湖区\n示例路 88 号 3 幢 502', order: 'SY20260928001' },
  { name: '李四', phone: '139-0000-5678', address: '广东省深圳市南山区\n科技园示例大厦 12 楼', order: 'SY20260928002' }
];

const PICKUPS = [
  { code: 'A-128', shelf: '1 号货架', note: '凭取件码取件' },
  { code: 'B-036', shelf: '2 号货架', note: '超过 3 天请联系店员' }
];

/** 物料标识卡：名称、编码、规格、数量、批次、供应商、状态与入库日期。 */
function materialCard(doc, W, H, m) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  if (H < 36) {
    const [info, code] = cols(safe, [2.1, 1], 1.2);
    const [top, lines] = rows(info, [1.3, 3], 0.4);
    titleWithTag(doc, top, m.name, m.status, { max: 4.4, tagMax: 2.8 });
    infoRows(doc, lines, [['编码', m.code], ['规格', m.spec], ['数量', m.qty]], { max: 3 });
    const [qr, caption] = rows(code, [3, 1], 0.3);
    qrcode(doc, qr, m.code);
    date(doc, caption, { role: 'made', format: 'MM-DD', label: '入库', align: 'center', max: 2.8 });
    return;
  }
  const headH = Math.min(6.6, Math.max(4.6, H * 0.13));
  const inner = panel(doc, frame(safe.x, safe.y, safe.w, headH));
  const [title, status] = cols(inner, [2, 1], 0.8);
  text(doc, title, '物料标识卡', { bold: true, reverse: true, max: Math.max(2.6, headH * 0.6) });
  text(doc, status, `状态：${m.status}`, { reverse: true, align: 'right', bold: true, max: Math.max(2.4, headH * 0.55) });
  const body = frame(safe.x, safe.y + headH + 1, safe.w, safe.h - headH - 1);
  const [info, side] = cols(body, [2.2, 1], 1.4);
  const [name, lines] = rows(info, [1.2, 4], 0.4);
  text(doc, name, m.name, { bold: true, max: Math.min(6.4, 5 * k) });
  infoRows(doc, lines, [['编码', m.code], ['规格', m.spec], ['数量', m.qty], ['批次', m.batch], ['供应商', m.supplier]], { max: Math.min(4, 3.2 * k) });
  const [qr, caption] = rows(side, [3, 1], 0.4);
  qrcode(doc, qr, m.code);
  date(doc, caption, { role: 'made', label: '入库', format: 'MM-DD', align: 'center', max: Math.min(3.6, 2.8 * k) });
}

/** 库位 / 货架标签：大号库位号 + 区排层 + 库位条码。 */
function binLocation(doc, W, H, b) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  if (H < 26) {
    const [code, scan] = rows(safe, [1.1, 1], 0.6);
    const [left, right] = cols(code, [2, 1], 1);
    text(doc, left, b.code, { bold: true, max: 7, bind: 'code' });
    text(doc, right, b.note, { max: 3.2, align: 'right' });
    barcode(doc, scan, b.scan, { showText: false, bind: 'code' });
    return;
  }
  const [code, meta, scan] = rows(safe, [1.5, -3.4 * Math.min(k, 1.3), 1.4], 0.6);
  text(doc, code, b.code, { bold: true, max: Math.min(14, 10 * k), bind: 'code' });
  const [where, note] = cols(meta, [2, 1], 1);
  text(doc, where, `${b.zone} · ${b.row} · ${b.level}`, { max: Math.min(4, 3.2 * k) });
  text(doc, note, b.note, { max: Math.min(4, 3.2 * k), align: 'right' });
  barcode(doc, scan, b.scan, { showText: false, bind: 'code' });
}

/** 箱唛：品名、装箱数、批次、目的仓，箱号自动递增。 */
function cartonLabel(doc, W, H, c) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [name, lines, bottom] = rows(safe, [1.3, 3, 1.4], 1);
  titleWithTag(doc, name, c.name, c.dest, { max: Math.min(7, 5.4 * k), tagMax: Math.min(4, 3 * k) });
  infoRows(doc, lines, [['装箱', c.qty], ['批次', c.batch]], { max: Math.min(4.4, 3.4 * k) });
  divider(doc, lines, bottom, { weight: 0.3 });
  const [number, packed] = cols(bottom, [1.1, 1], 1);
  serial(doc, number, { prefix: '箱号 ', start: 1, digits: 2, suffix: ` / ${c.total}`, bold: true, max: Math.min(5.4, 4.2 * k) });
  date(doc, packed, { role: 'made', label: '装箱', format: 'MM-DD', align: 'right', max: Math.min(4, 3.2 * k) });
}

/** 收件信息：收件人、电话、地址与订单条码。 */
function parcelLabel(doc, W, H, p) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [top, address, code] = rows(safe, [1.2, 2, 1.5], 0.6);
  const tagH = Math.min(top.h, 5.6 * k);
  const tag = chip(doc, safe.x, top.y + (top.h - tagH) / 2, tagH, '收', { max: Math.min(4, 3.2 * k) });
  const rest = frame(tag.x + tag.width + 1.2, top.y, safe.w - tag.width - 1.2, top.h);
  const [name, phone] = cols(rest, [1, 1.4], 1);
  text(doc, name, p.name, { bold: true, max: Math.min(6, 4.8 * k) });
  text(doc, phone, p.phone, { bold: true, max: Math.min(4.6, 3.6 * k), align: 'right' });
  text(doc, address, p.address, { max: Math.min(4.4, 3.4 * k) });
  const codeW = Math.min(code.w, 46);
  barcode(doc, frame(safe.x + (safe.w - codeW) / 2, code.y, codeW, code.h), p.order, { fontSize: 2.4 });
}

/** 取件码：大号取件码 + 货架位置 + 到店日期。 */
function pickupCode(doc, W, H, p) {
  const k = scaleFor(W, H);
  const safe = safeBox(W, H);
  const [caption, code, foot] = rows(safe, [1, 2.2, 1], 0.4);
  const [left, right] = cols(caption, [1, 1], 1);
  text(doc, left, '取件码', { bold: true, max: Math.min(4, 3.2 * k) });
  date(doc, right, { role: 'made', label: '到店', format: 'MM-DD', align: 'right', max: Math.min(3.6, 2.8 * k) });
  text(doc, code, p.code, { bold: true, max: Math.min(14, 11 * k), align: 'center' });
  text(doc, foot, `${p.shelf} · ${p.note}`, { max: Math.min(3.6, 2.8 * k), align: 'center' });
}

module.exports = {
  CONTENT: { MATERIALS, BINS, CARTONS, PARCELS, PICKUPS },
  RECIPES: {
    materialCard: { build: materialCard, content: 'MATERIALS', scene: '物料标识', category: '仓储' },
    binLocation: { build: binLocation, content: 'BINS', scene: '库位标签', category: '仓储' },
    cartonLabel: { build: cartonLabel, content: 'CARTONS', scene: '箱唛', category: '仓储' },
    parcelLabel: { build: parcelLabel, content: 'PARCELS', scene: '收件信息', category: '物流' },
    pickupCode: { build: pickupCode, content: 'PICKUPS', scene: '取件码', category: '物流' }
  }
};
