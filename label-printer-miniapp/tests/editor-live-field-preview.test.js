const test = require('node:test');
const assert = require('node:assert/strict');

const { createDocument, createElement } = require('../miniprogram/core/document');

let pageDefinition = null;
global.Page = (definition) => { pageDefinition = definition; };
require('../miniprogram/pages/editor/index');
delete global.Page;

function event(field, value) {
  return {
    currentTarget: { dataset: { field } },
    detail: { value }
  };
}

function editorFor(elements, selectedId) {
  const document = createDocument(40, 30);
  document.elements = elements;
  const editor = Object.assign({}, pageDefinition, {
    data: {},
    document,
    selectedId,
    selectedIds: [selectedId],
    multiSelect: false,
    undoStack: [],
    redoStack: [],
    renderCount: 0,
    persistCount: 0,
    syncCount: 0,
    setData(patch, callback) {
      Object.assign(this.data, patch);
      if (callback) callback();
    },
    renderAll() { this.renderCount += 1; },
    persistDocument() { this.persistCount += 1; },
    syncPageData(callback) {
      this.syncCount += 1;
      const selected = this.selectedElement();
      this.setData({ selected: selected ? Object.assign({}, selected) : null }, callback);
    }
  });
  return editor;
}

test('live string input updates the canvas without persisting or adding undo entries', () => {
  const document = createDocument(40, 30);
  const textElement = createElement('text', document);
  textElement.text = '原文字';
  const editor = editorFor([textElement], textElement.id);

  editor.startFieldEdit(event('text', ''));
  editor.previewField(event('text', '实时文字'));

  assert.equal(textElement.text, '实时文字');
  assert.equal(editor.data.selected.text, '实时文字');
  assert.equal(editor.renderCount, 1);
  assert.equal(editor.persistCount, 0);
  assert.equal(editor.undoStack.length, 0);
});

test('many live updates create one undo snapshot only when the field loses focus', () => {
  const document = createDocument(40, 30);
  const barcode = createElement('barcode', document);
  barcode.value = 'OLD';
  const editor = editorFor([barcode], barcode.id);

  editor.startFieldEdit(event('value', ''));
  editor.previewField(event('value', 'N'));
  editor.previewField(event('value', 'NE'));
  editor.previewField(event('value', 'NEW'));
  editor.finishFieldEdit(event('value', 'NEW'));

  assert.equal(barcode.value, 'NEW');
  assert.equal(editor.undoStack.length, 1);
  assert.equal(editor.undoStack[0].elements[0].value, 'OLD');
  assert.equal(editor.persistCount, 1);
  assert.equal(editor.syncCount, 1);
});

test('returning to the original value does not add undo history or persist', () => {
  const document = createDocument(40, 30);
  const serial = createElement('serial', document);
  serial.prefix = 'NO.';
  const editor = editorFor([serial], serial.id);

  editor.startFieldEdit(event('prefix', ''));
  editor.previewField(event('prefix', 'TMP'));
  editor.previewField(event('prefix', 'NO.'));
  editor.finishFieldEdit(event('prefix', 'NO.'));

  assert.equal(serial.prefix, 'NO.');
  assert.equal(editor.undoStack.length, 0);
  assert.equal(editor.persistCount, 0);
  assert.equal(editor.syncCount, 1);
});

test('field blur commits the draft element even if selection changed meanwhile', () => {
  const document = createDocument(40, 30);
  const first = createElement('text', document);
  const second = createElement('text', document);
  first.id = 'first';
  second.id = 'second';
  first.text = '一';
  second.text = '二';
  const editor = editorFor([first, second], first.id);

  editor.startFieldEdit(event('text', ''));
  editor.previewField(event('text', '一改'));
  editor.selectedId = second.id;
  editor.selectedIds = [second.id];
  editor.finishFieldEdit(event('text', '一完成'));

  assert.equal(first.text, '一完成');
  assert.equal(second.text, '二');
  assert.equal(editor.data.selected.id, second.id);
  assert.equal(editor.undoStack[0].elements.find((item) => item.id === first.id).text, '一');
});

test('blur without a matching live draft falls back to the regular field update', () => {
  const document = createDocument(40, 30);
  const textElement = createElement('text', document);
  const editor = editorFor([textElement], textElement.id);
  let fallbackEvent = null;
  editor.updateField = (value) => { fallbackEvent = value; };

  const blurEvent = event('text', '直接提交');
  editor.finishFieldEdit(blurEvent);

  assert.equal(fallbackEvent, blurEvent);
});

test('page unload persists a focused live field even when blur never fires', async () => {
  const document = createDocument(40, 30);
  const textElement = createElement('text', document);
  textElement.text = '离开前';
  const editor = editorFor([textElement], textElement.id);
  editor.pageActive = true;
  editor.devicePickerGeneration = 0;
  editor.printTaskGeneration = 0;
  editor.printer = { printing: false };
  editor.ownsSession = false;

  editor.startFieldEdit(event('text', ''));
  editor.previewField(event('text', '已经输入完成'));
  await editor.onUnload();

  assert.equal(textElement.text, '已经输入完成');
  assert.equal(editor.persistCount, 1);
  assert.equal(editor.undoStack.length, 1);
});

test('typing after onHide dropped the draft still reaches the label and stays undoable', () => {
  const document = createDocument(40, 30);
  const textElement = createElement('text', document);
  textElement.text = '原文字';
  const editor = editorFor([textElement], textElement.id);

  editor.startFieldEdit(event('text', ''));
  editor.previewField(event('text', '第一段'));
  // onHide / the print sheet commit and drop the draft while the input keeps
  // its focus; the next keystroke must not vanish into the native input.
  editor.commitFieldEditDraft();
  assert.equal(editor.fieldEditDraft, null);
  const undoAfterCommit = editor.undoStack.length;

  editor.previewField(event('text', '第一段第二段'));

  assert.equal(textElement.text, '第一段第二段', 'the character reaches the label');
  assert.equal(editor.fieldEditDraft.field, 'text', 'a fresh draft captures the next edit');
  assert.equal(editor.data.selected.text, '第一段第二段');
  assert.equal(editor.undoStack.length, undoAfterCommit, 'typing alone adds no undo entry yet');

  editor.finishFieldEdit(event('text', '第一段第二段'));
  assert.equal(editor.undoStack.length, undoAfterCommit + 1, 'and the edit is undoable once it settles');
  assert.equal(editor.undoStack[undoAfterCommit].elements[0].text, '第一段');
});
