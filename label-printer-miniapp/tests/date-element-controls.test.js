const test = require('node:test');
const assert = require('node:assert/strict');

const { createDocument, createElement } = require('../miniprogram/core/document');
const {
  dateShowsTime,
  dateStyleOf,
  dateStylePatch,
  dateTimePatch,
  formatDateValue
} = require('../miniprogram/core/renderer');

let pageDefinition = null;
global.Page = (definition) => { pageDefinition = definition; };
require('../miniprogram/pages/editor/index');
delete global.Page;

const NOW = new Date(2026, 9, 7, 9, 30, 15);

function dateElement(patch) {
  const document = createDocument(40, 30);
  return Object.assign(createElement('date', document), { autoUpdate: true }, patch || {});
}

function editorWith(element) {
  const document = createDocument(40, 30);
  element.id = 'date';
  document.elements = [element];
  return Object.assign({}, pageDefinition, {
    data: {},
    document,
    selectedId: 'date',
    selectedIds: ['date'],
    multiSelect: false,
    undoStack: [],
    redoStack: [],
    setData(patch, callback) {
      Object.assign(this.data, patch);
      if (callback) callback();
    },
    syncPageData(callback) {
      this.setData(this.selectionData(this.selectedElement()), callback);
    },
    persistDocument() { return true; },
    loadDocumentImages() { return []; },
    renderAll() {}
  });
}

test('a new date prints the date and minutes, without seconds', () => {
  const element = dateElement();
  assert.equal(formatDateValue(element, NOW), '制作日期：2026年10月07日 09:30');
  assert.equal(dateStyleOf(element), 'cn');
  assert.equal(dateShowsTime(element), true);
});

test('the time switch works for every format and nothing else changes', () => {
  const dashed = dateElement({ format: 'YYYY-MM-DD', showTime: true, label: '' });
  assert.equal(dateShowsTime(dashed), false, 'a date-only token format prints no time');
  Object.assign(dashed, dateTimePatch(dashed, true));
  assert.equal(formatDateValue(dashed, NOW), '2026-10-07 09:30');
  Object.assign(dashed, dateTimePatch(dashed, false));
  assert.equal(formatDateValue(dashed, NOW), '2026-10-07');

  const shelf = dateElement({ format: 'MM-DD HH:mm', showTime: true, label: '' });
  Object.assign(shelf, dateTimePatch(shelf, false));
  assert.equal(formatDateValue(shelf, NOW), '10-07');
  Object.assign(shelf, dateTimePatch(shelf, true));
  assert.equal(formatDateValue(shelf, NOW), '10-07 09:30');

  const chinese = dateElement();
  Object.assign(chinese, dateTimePatch(chinese, false));
  assert.equal(formatDateValue(chinese, NOW), '制作日期：2026年10月07日');
});

test('a date style button keeps whether the time prints', () => {
  const element = dateElement();
  Object.assign(element, dateStylePatch(element, 'dash'));
  assert.equal(formatDateValue(element, NOW), '制作日期：2026-10-07 09:30');
  assert.equal(dateStyleOf(element), 'dash');
  Object.assign(element, dateTimePatch(element, false));
  Object.assign(element, dateStylePatch(element, 'slash'));
  assert.equal(formatDateValue(element, NOW), '制作日期：2026/10/07');
  Object.assign(element, dateStylePatch(element, 'cn'));
  assert.equal(formatDateValue(element, NOW), '制作日期：2026年10月07日');
  assert.equal(dateStyleOf(dateElement({ format: 'YYYY年MM月DD日 HH:mm' })), 'cn', 'older labels light the 中文日期 button too');
});

test('switching to 保质期至 changes the printed words, not just the date', () => {
  const editor = editorWith(dateElement());
  const role = (value) => editor.setChoiceField({ currentTarget: { dataset: { field: 'dateRole', value } } });

  role('expire');
  const element = editor.document.elements[0];
  assert.equal(element.label, '保质期至');
  assert.equal(formatDateValue(element, NOW), '保质期至：2026年10月08日 09:30');
  role('generic');
  assert.equal(element.label, '');
  role('made');
  assert.equal(element.label, '制作日期');

  // A label of the user's own stays.
  element.label = '开封';
  role('expire');
  assert.equal(element.label, '开封');
  element.label = '有效至';
  role('made');
  assert.equal(element.label, '制作日期');
});

test('the shelf life is set in days and hours and shown as such', () => {
  const editor = editorWith(dateElement({ dateRole: 'expire', label: '保质期至', expirePresetHours: 24 }));
  editor.syncPageData();
  assert.equal(editor.data.selectedExpireDays, 1);
  assert.equal(editor.data.selectedExpireHours, 0);

  editor.updateExpiry({ currentTarget: { dataset: { part: 'days' } }, detail: { value: '3' } });
  editor.updateExpiry({ currentTarget: { dataset: { part: 'hours' } }, detail: { value: '6' } });
  const element = editor.document.elements[0];
  assert.equal(element.expirePresetHours, 3 * 24 + 6);
  assert.equal(formatDateValue(element, NOW), '保质期至：2026年10月10日 15:30');
  assert.equal(editor.data.selectedExpireDays, 3);
  assert.equal(editor.data.selectedExpireHours, 6);
});

test('the inspector time switch and style buttons follow what prints', () => {
  const editor = editorWith(dateElement({ format: 'MM-DD HH:mm', showTime: false }));
  editor.syncPageData();
  assert.equal(editor.data.selectedDateShowsTime, true, 'the switch shows the time that prints');
  editor.updateSwitch({ currentTarget: { dataset: { field: 'showTime' } }, detail: { value: false } });
  assert.equal(editor.document.elements[0].format, 'MM-DD');
  assert.equal(editor.data.selectedDateShowsTime, false);

  editor.setChoiceField({ currentTarget: { dataset: { field: 'dateStyle', value: 'dash' } } });
  assert.equal(editor.document.elements[0].format, 'YYYY-MM-DD');
  assert.equal(editor.data.selectedDateStyle, 'dash');
});

test('huge offsets are kept to ten years instead of printing NaN', (t) => {
  global.wx = { showToast() {} };
  t.after(() => { delete global.wx; });
  const editor = editorWith(dateElement());
  editor.updateField({ currentTarget: { dataset: { field: 'offsetDays' } }, detail: { value: '999999999' } });
  const element = editor.document.elements[0];
  assert.equal(element.offsetDays, 3650);
  assert.doesNotMatch(formatDateValue(element, NOW), /NaN/);
  editor.updateField({ currentTarget: { dataset: { field: 'offsetDays' } }, detail: { value: '-2' } });
  assert.equal(element.offsetDays, -2, 'a negative offset (yesterday) is allowed');
});
