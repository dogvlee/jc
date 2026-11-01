const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createDocument, createElement } = require('../miniprogram/core/document');
const { DOCUMENT_LIMITS } = require('../miniprogram/services/repository');

let pageDefinition = null;
global.Page = (definition) => { pageDefinition = definition; };
require('../miniprogram/pkg-editor/pages/editor/index');
delete global.Page;

const read = (file) => fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pkg-editor', 'pages', 'editor', file), 'utf8');

// A 40 x 20 mm label with one text element selected.
function editorWithText(overrides) {
  const documentValue = createDocument(40, 20);
  const text = createElement('text', documentValue);
  Object.assign(text, { id: 'title', x: 5, y: 5, width: 20, height: 8, fontSize: 4, align: 'left' });
  documentValue.elements = [text];
  const editor = Object.assign({}, pageDefinition, {
    canvasRect: { width: 400, height: 200 },
    pageActive: true,
    data: {},
    document: documentValue,
    selectedId: 'title',
    selectedIds: ['title'],
    multiSelect: false,
    undoStack: [],
    redoStack: [],
    projectId: '',
    dirtySinceSave: false,
    setData(patch, callback) {
      Object.assign(this.data, patch);
      if (callback) callback();
    },
    syncPageData(callback) {
      const selected = this.selectedElement();
      this.setData({ selected: selected ? Object.assign({}, selected) : null }, callback);
    },
    persistDocument() { return true; },
    initCanvas() {},
    loadDocumentImages() { return []; },
    renderAll() {}
  }, overrides || {});
  return { editor, text };
}

function withToast(t) {
  const toasts = [];
  const previous = global.wx;
  global.wx = { showToast: (options) => toasts.push(options.title) };
  t.after(() => { global.wx = previous; });
  return toasts;
}

const delta = (value) => ({ currentTarget: { dataset: { delta: value } } });

test('the style bar nudges the font size by half a millimetre and keeps it undoable', (t) => {
  withToast(t);
  const { editor, text } = editorWithText();
  editor.stepFontSize(delta(1));
  assert.equal(text.fontSize, 4.5);
  assert.equal(editor.undoStack.length, 1);
  editor.stepFontSize(delta(-1));
  editor.stepFontSize(delta(-1));
  assert.equal(text.fontSize, 3.5);
  assert.equal(editor.undoStack.length, 3);
});

test('the font size stops at the allowed range and says so instead of adding an undo step', (t) => {
  const toasts = withToast(t);
  const { editor, text } = editorWithText();
  text.fontSize = DOCUMENT_LIMITS.maxFontSizeMm;
  editor.stepFontSize(delta(1));
  assert.equal(text.fontSize, DOCUMENT_LIMITS.maxFontSizeMm);
  assert.equal(editor.undoStack.length, 0);
  assert.deepEqual(toasts, ['字号已经是最大']);
  text.fontSize = DOCUMENT_LIMITS.minFontSizeMm;
  editor.stepFontSize(delta(-1));
  assert.equal(text.fontSize, DOCUMENT_LIMITS.minFontSizeMm);
  assert.equal(toasts[1], '字号已经是最小');
});

test('the style bar walks the alignment left, centre, right and back', () => {
  const { editor, text } = editorWithText();
  const seen = [];
  for (let step = 0; step < 4; step += 1) {
    editor.cycleAlignment();
    seen.push(text.align);
  }
  assert.deepEqual(seen, ['center', 'right', 'left', 'center']);
  assert.equal(editor.undoStack.length, 4);
});

test('stepping with nothing selected does nothing', (t) => {
  withToast(t);
  const { editor } = editorWithText({ selectedId: '', selectedIds: [] });
  editor.stepFontSize(delta(1));
  editor.cycleAlignment();
  assert.equal(editor.undoStack.length, 0);
});

test('the editor stage carries the floating pills and a style bar that only exists with a selection', () => {
  const markup = read('index.wxml');
  const stage = markup.slice(markup.indexOf('<view class="canvas-stage">'), markup.indexOf('<view class="editor-panel">'));
  assert.match(stage, /class="stage-pills"/);
  for (const handler of ['undo', 'redo', 'openLayers', 'openSettings', 'openDevices']) {
    assert.match(stage, new RegExp(`bind(?:tap)="${handler}"`), `${handler} lives on the stage pills`);
  }
  assert.match(stage, /<view wx:if="\{\{selected\}\}" class="style-bar-wrap">/);
  for (const handler of ['toggleSelectedFlag', 'stepFontSize', 'cycleAlignment', 'duplicateSelected', 'deleteSelected', 'alignSelection', 'scanSelectedCode']) {
    assert.match(stage, new RegExp(`bindtap="${handler}"`), `${handler} is on the style bar`);
  }
  // The undo and redo that used to be in the header are gone from it.
  const header = markup.slice(markup.indexOf('<view class="editor-header"'), markup.indexOf('<view wx:if="{{templateAttentionMessage}}"'));
  assert.doesNotMatch(header, /bindtap="(?:undo|redo|openLayers|openSettings|openDevices)"/);
  assert.match(header, /class="header-main"\s+style="padding-right: \{\{menuSafeRightPx\}\}px;"/);
});

test('a failed autosave is still reachable from the header and says how to retry', () => {
  const markup = read('index.wxml');
  assert.match(markup, /class="save-status \{\{saveState == '草稿保存失败，请勿退出，点此重试' \? 'error' : ''\}\}" bindtap="persistDocument"/);
  assert.match(markup, /保存失败，点此重试/);
});

test('the position fields come first in the inspector; short phones keep the content field first with CSS order', () => {
  const markup = read('index.wxml');
  const inspector = markup.slice(markup.indexOf('<view wx:if="{{selected}}" class="inspector">'));
  const heading = inspector.indexOf('class="inspector-heading"');
  const position = inspector.indexOf('property-section position-section');
  const content = inspector.indexOf('id="content-field"');
  const arrange = inspector.indexOf('property-section arrange-section');
  const style = inspector.indexOf('property-section style-section');
  assert.ok(heading > 0 && position > heading && content > position, '位置与尺寸 sits right under the heading');
  assert.ok(arrange > content && style > arrange, 'turning and styles stay below the content');
  // The four number fields live only in the position section now.
  assert.equal((inspector.match(/class="field-grid four"/g) || []).length, 1);
  const sheet = read('index.wxss');
  const short = sheet.slice(sheet.indexOf('@media (max-height: 700px)'));
  assert.match(short, /\.position-section,\s*\.arrange-section,\s*\.style-section\s*\{\s*order:\s*1;/);
  assert.match(sheet, /\.inspector \{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/);
});
