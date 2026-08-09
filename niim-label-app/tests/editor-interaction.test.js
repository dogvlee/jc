const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { contextActions, propertyPanel } = require('../src/app/views');
const mainSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'main.js'), 'utf8');

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

test('text direction control exposes six native modes and an arc angle slider', () => {
  const state = stateFor({ ...textElement(false), textMode: 'arc', textArcAngle: 81 });
  state.textDirectionOpen = true;
  const markup = propertyPanel(state);
  const modes = [...markup.matchAll(/data-action="set-text-mode" data-mode="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(modes, [
    'horizontal',
    'horizontal-90',
    'horizontal-90-words-rotate',
    'vertical',
    'vertical-words-rotate',
    'arc'
  ]);
  assert.match(markup, /text_mode_horizontal_cn\.svg/);
  assert.match(markup, /text_mode_arc_cn\.svg/);
  assert.match(markup, /class="niim-dir-opt active" data-action="set-text-mode" data-mode="arc"/);
  assert.match(markup, /class="niim-text-arc-slider" type="range" min="0" max="180" step="1" value="81"/);
  assert.match(markup, /class="niim-text-arc-readout">81°<\/output>/);
});

test('arc angle live edits create one undo entry when the slider change finishes', () => {
  assert.equal((mainSource.match(/'fontSize', 'rotation', 'textArcAngle'\]\.includes\(field\)/g) || []).length, 2);
  assert.match(mainSource, /autosave:\s*field === 'fontSize' \|\| field === 'textArcAngle'/);
});

test('legacy vertical documents select the vertical mode without a textMode field', () => {
  const state = stateFor({ ...textElement(false), direction: 'vertical' });
  state.textDirectionOpen = true;
  const markup = propertyPanel(state);
  assert.match(markup, /class="niim-dir-opt active" data-action="set-text-mode" data-mode="vertical"/);
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
