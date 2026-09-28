const test = require('node:test');
const assert = require('node:assert/strict');

const { createDocument, createElement } = require('../miniprogram/core/document');
const { linkedCodeValue, resolveLinkedCodes } = require('../miniprogram/core/linked-codes');
const { validateDocument } = require('../miniprogram/core/renderer');
const { PrintJobService } = require('../miniprogram/services/print-job-service');

function serialDocument() {
  const document = createDocument(40, 30);
  const serial = createElement('serial', document);
  Object.assign(serial, { id: 'serial', prefix: 'FA-', start: 1024, step: 1, digits: 4, suffix: '' });
  const linked = createElement('qrcode', document);
  Object.assign(linked, { id: 'linked', value: 'FA-1024', serialLinked: true });
  const fixed = createElement('qrcode', document);
  Object.assign(fixed, { id: 'fixed', value: 'https://example.com' });
  document.elements = [serial, linked, fixed];
  return { document, serial, linked, fixed };
}

test('a code that follows the serial number takes the serial text of the same page', () => {
  const { document, serial } = serialDocument();
  serial.currentValue = 1030;
  const resolved = resolveLinkedCodes(document);
  assert.equal(resolved.elements[1].value, 'FA-1030');
  assert.equal(resolved.elements[2].value, 'https://example.com');
  assert.equal(document.elements[1].value, 'FA-1024', '保存的文档不被改写');
  assert.equal(linkedCodeValue(document, document.elements[1]), 'FA-1030');
});

test('documents without linked codes, or without a serial, render their stored values', () => {
  const { document } = serialDocument();
  document.elements[1].serialLinked = false;
  assert.equal(resolveLinkedCodes(document), document);
  const orphan = serialDocument();
  orphan.document.elements.shift();
  assert.equal(resolveLinkedCodes(orphan.document).elements[0].value, 'FA-1024');
});

test('every printed page carries a code that matches its own serial number', async () => {
  const { document } = serialDocument();
  const values = [];
  const printer = { async print(image, profile, options, progress) { progress(100, '打印完成'); }, async cancel() {} };
  const service = new PrintJobService({ printer });
  await service.run({
    document,
    profile: { id: 'd110', dpi: 203 },
    options: { copies: 3, density: 2 },
    render(page) {
      const resolved = resolveLinkedCodes(page);
      values.push([resolved.elements[0].currentValue, resolved.elements[1].value]);
      return page;
    }
  });
  assert.deepEqual(values, [[1024, 'FA-1024'], [1025, 'FA-1025'], [1026, 'FA-1026']]);
});

test('print validation checks the value a linked code will actually print', () => {
  const document = createDocument(40, 30);
  const serial = createElement('serial', document);
  Object.assign(serial, { prefix: 'LN-', start: 2208, digits: 4 });
  const barcode = createElement('barcode', document);
  Object.assign(barcode, { x: 2, y: 10, width: 36, height: 8, value: '6901234567892', format: 'ean13', serialLinked: true });
  document.elements = [serial, barcode];
  assert.throws(() => validateDocument(document, 203), /EAN-13/);
  barcode.format = 'code128';
  assert.doesNotThrow(() => validateDocument(document, 203));
});

test('stored values of linked codes follow the first serial number after every edit', () => {
  const { syncLinkedCodes } = require('../miniprogram/core/linked-codes');
  const { document, serial, linked, fixed } = serialDocument();
  serial.prefix = 'AS-';
  serial.start = 7;
  syncLinkedCodes(document);
  assert.equal(linked.value, 'AS-0007');
  assert.equal(fixed.value, 'https://example.com');
});

test('saving and reopening a project keeps a code linked to its serial', () => {
  const { normalizeDocument } = require('../miniprogram/services/repository');
  const { document } = serialDocument();
  const reopened = normalizeDocument(JSON.parse(JSON.stringify(document)));
  assert.equal(reopened.elements[1].serialLinked, true);
  assert.equal(reopened.elements[2].serialLinked, undefined);
});

test('shelf templates with a serial number print matching codes on every copy', () => {
  const { getTemplate } = require('../miniprogram/app/catalog');
  const { buildTemplateDocument } = require('../miniprogram/app/template-layouts');
  for (const [id, first, third] of [['shangyue-asset-tag', 'FA-1024', 'FA-1026'], ['shangyue-serial-cable', '2208', '2210']]) {
    const document = buildTemplateDocument(getTemplate(id));
    const code = document.elements.find((element) => element.type === 'barcode' || element.type === 'qrcode');
    assert.equal(code.serialLinked, true, id);
    assert.equal(code.value, first, id);
    const page = JSON.parse(JSON.stringify(document));
    page.elements.find((element) => element.type === 'serial').currentValue = Number(third.replace(/[^0-9]/g, ''));
    assert.equal(linkedCodeValue(page, code), third, id);
    assert.doesNotThrow(() => validateDocument(page, 203), id);
  }
});
