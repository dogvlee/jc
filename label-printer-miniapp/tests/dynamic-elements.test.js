const test = require('node:test');
const assert = require('node:assert/strict');

const { createDocument, createElement } = require('../miniprogram/core/document');
const { formatDateValue, serialValue } = require('../miniprogram/core/renderer');

test('compact default text and barcode occupy separate bands on a 12 mm label', () => {
  const document = createDocument(40, 12);
  const text = document.elements[0];
  const barcode = createElement('barcode', document);
  assert.ok(text.y + text.height <= barcode.y);
  assert.ok(barcode.y + barcode.height <= document.heightMm);
});

test('date elements apply a deterministic token format', () => {
  const element = createElement('date', createDocument(40, 20));
  element.label = '';
  element.format = 'YYYY/MM/DD HH:mm:ss';
  element.baseTime = new Date(2026, 7, 3, 9, 5, 7).toISOString();
  element.autoUpdate = false;
  assert.equal(formatDateValue(element, new Date(2026, 7, 3, 9, 5, 7)), '2026/08/03 09:05:07');
  element.label = '制作日期';
  element.format = 'YYYY年MM月DD日 HH:mm';
  element.showSeconds = false;
  assert.match(formatDateValue(element, new Date(2026, 7, 3, 9, 5, 7)), /^制作日期：2026年08月03日 09:05/);
  element.autoUpdate = false;
  element.fixedValue = '固定日期';
  assert.equal(formatDateValue(element, new Date()), '制作日期：固定日期');
});

test('date expire role adds preset hours', () => {
  const element = createElement('date', createDocument(50, 30));
  element.label = '保质期至';
  element.dateRole = 'expire';
  element.expireMode = 'preset';
  element.expirePresetHours = 24;
  element.offsetDays = 0;
  element.baseTime = new Date(2026, 7, 5, 22, 13, 0).toISOString();
  element.autoUpdate = false;
  element.showSeconds = false;
  const text = formatDateValue(element, new Date(2026, 7, 5, 22, 13, 0));
  assert.match(text, /保质期至：2026年08月06日 22:13/);
});

test('serial elements honor prefix, suffix, digits, and the current print value', () => {
  const element = createElement('serial', createDocument(40, 20));
  element.prefix = 'SN-';
  element.suffix = '-A';
  element.digits = 5;
  element.start = 7;
  assert.equal(serialValue(element), 'SN-00007-A');
  element.currentValue = 12;
  assert.equal(serialValue(element), 'SN-00012-A');
});

test('table and material elements have printable defaults', () => {
  const document = createDocument(40, 30);
  const table = createElement('table', document);
  const material = createElement('material', document);
  assert.equal(table.cells.length, table.rows * table.columns);
  assert.equal(material.symbol, 'check');
  assert.ok(table.width <= document.widthMm);
  assert.ok(material.height <= document.heightMm);
});

test('editor elements expose transform and advanced style defaults', () => {
  const document = createDocument(40, 20);
  const text = document.elements[0];
  const barcode = createElement('barcode', document);
  const qrcode = createElement('qrcode', document);

  assert.equal(text.locked, false);
  assert.equal(text.mirrorX, false);
  assert.equal(text.mirrorY, false);
  assert.equal(text.direction, 'horizontal');
  assert.equal(text.verticalAlign, 'middle');
  assert.equal(text.autoFit, true);
  assert.equal(text.underline, false);
  assert.equal(text.text, '双击编辑');
  assert.equal(text.color, '#000000');
  assert.equal(text.wordWrap, false);
  assert.equal(barcode.textPosition, 'bottom');
  assert.equal(barcode.value, '0');
  assert.equal(barcode.format, 'code128');
  assert.equal(qrcode.errorCorrection, 'M');
  assert.equal(qrcode.color, '#000000');
});

test('material catalog is available and sizable', () => {
  const { MATERIAL_CATALOG } = require('../miniprogram/core/materials');
  assert.ok(MATERIAL_CATALOG.length >= 20);
  const document = createDocument(40, 30);
  const material = createElement('material', document);
  material.symbol = 'star';
  assert.equal(material.symbol, 'star');
});
