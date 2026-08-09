const test = require('node:test');
const assert = require('node:assert/strict');

const { contextActions, propertyPanel } = require('../src/app/views');

function stateFor(element) {
  return {
    document: { widthMm: 50, heightMm: 30, elements: [element] },
    selectedId: element.id,
    selectedIds: [element.id],
    selectedElementId: element.id,
    editorMode: 'selected',
    editorPanelTab: 'style',
    panelCollapsed: false,
    multiSelect: false,
    dataRows: [],
    materialQuery: '',
    materialChip: '最新',
    materialSearchOpen: false,
    pendingMaterialSymbol: '',
    borderQuery: '',
    borderChip: '最新',
    borderSearchOpen: false,
    userTemplates: []
  };
}

function textElement(locked) {
  return {
    id: 'text-test',
    type: 'text',
    locked,
    x: 2,
    y: 2,
    width: 20,
    height: 6,
    text: '测试',
    fontSize: 4,
    color: '#000000',
    fontFamily: 'sans-serif',
    align: 'left',
    verticalAlign: 'middle',
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    reverse: false,
    letterSpacing: 0,
    lineSpacing: 0,
    wordWrap: false,
    direction: 'horizontal'
  };
}

test('locked selection keeps only the three safe float actions', () => {
  const lockedMarkup = contextActions(stateFor(textElement(true)));
  const unlockedMarkup = contextActions(stateFor(textElement(false)));
  assert.equal((lockedMarkup.match(/class="niim-float-btn"/g) || []).length, 3);
  assert.doesNotMatch(lockedMarkup, /data-action="toggle-lock"/);
  assert.equal((unlockedMarkup.match(/class="niim-float-btn(?:\s|\")/g) || []).length, 6);
});

test('locked selection exposes unlock in the property panel', () => {
  const markup = propertyPanel(stateFor(textElement(true)));
  assert.match(markup, /class="niim-unlock-command"/);
  assert.match(markup, /data-action="toggle-lock"/);
  assert.match(markup, /解锁元素/);
});

test('locked content panel keeps the unlock command as a separate row', () => {
  const state = stateFor(textElement(true));
  state.editorPanelTab = 'content';
  const markup = propertyPanel(state);
  assert.match(markup, /class="niim-unlock-command"/);
  assert.match(markup, /class="niim-panel-body editor-panel-body content-mode"/);
});

test('canvas text placeholder does not leak into the content input', () => {
  const state = stateFor({ ...textElement(false), text: '双击编辑' });
  state.editorMode = 'content';
  state.editorPanelTab = 'content';
  const markup = propertyPanel(state);
  assert.match(markup, /class="niim-content-line"/);
  assert.match(markup, /value=""/);
  assert.doesNotMatch(markup, /class="niim-content-clear"/);
});
