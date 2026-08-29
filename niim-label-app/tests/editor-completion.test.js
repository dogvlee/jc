const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const memory = new Map();
global.__APP_VERSION__ = 'test';
global.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key)
};

const { createDocument, createElement } = require('../src/core/document');
const { getProfile, evaluatePrintability } = require('../src/core/profiles');
const { initialState, openDocument } = require('../src/app/state');
const { contextActions, propertyPanel, renderModal } = require('../src/app/views');

function freshState(type) {
  memory.clear();
  const state = initialState();
  const documentValue = createDocument(50, 30);
  if (type) {
    documentValue.elements = [createElement(type, documentValue)];
  }
  openDocument(state, documentValue);
  state.route = 'editor';
  return state;
}

test('save, exit, scan, advanced QR and restore sheets expose complete decisions', () => {
  const state = freshState('text');
  const expectations = {
    'save-template': ['save-template-name', 'save-template-folder', 'confirm-save-template'],
    'exit-editor': ['save-and-close-editor', 'save-template-and-close', 'discard-and-close-editor', 'cancel-close-editor'],
    'scan-code': ['barcode-scanner-video', 'scan-take-photo', 'scan-pick-image', 'confirm-scan-manual'],
    'advanced-qr': ['advanced-qr-type', 'advanced-qr-field', 'confirm-advanced-qr'],
    'backup-restore': ['export-backup', 'backup-strategy', 'import-backup']
  };
  for (const [modal, hooks] of Object.entries(expectations)) {
    state.modal = modal;
    const markup = renderModal(state);
    for (const hook of hooks) assert.match(markup, new RegExp(hook), `${modal} lost ${hook}`);
    assert.doesNotMatch(markup, /正在逐步完善|暂未开放|敬请期待/);
  }
});

test('a fresh blank label is printable by every advertised starter hardware family', () => {
  memory.clear();
  const state = initialState();
  assert.equal(state.settings.installedStock, 'T40×12 203 空白标签');
  const documentValue = createDocument(state.settings.defaultWidthMm, state.settings.defaultHeightMm);
  for (const profileId of ['d110', 'd11-legacy', 'b1', 'b21', 'b21-c2b', 'b21s']) {
    const result = evaluatePrintability(documentValue, getProfile(profileId));
    assert.equal(result.ok, true, `${profileId}: ${result.message}`);
  }
});

test('the impossible v1 starter stock migrates without overwriting custom stock', () => {
  memory.clear();
  memory.set('niim-label:settings', JSON.stringify({
    defaultWidthMm: 50,
    defaultHeightMm: 30,
    installedStock: 'T50×30 203 空白标签'
  }));
  const migrated = initialState();
  assert.equal(migrated.settings.defaultWidthMm, 40);
  assert.equal(migrated.settings.defaultHeightMm, 12);
  assert.equal(migrated.settings.stockDefaultsVersion, 2);

  memory.set('niim-label:settings', JSON.stringify({
    defaultWidthMm: 40,
    defaultHeightMm: 20,
    installedStock: 'T40×20 203 空白标签'
  }));
  const custom = initialState();
  assert.equal(custom.settings.defaultWidthMm, 40);
  assert.equal(custom.settings.defaultHeightMm, 20);
  assert.equal(custom.settings.installedStock, 'T40×20 203 空白标签');
});

test('barcode editor exposes every supported retail format', () => {
  const state = freshState('barcode');
  state.editorPanelTab = 'style';
  const markup = propertyPanel(state);
  for (const format of ['code128', 'code128a', 'code128b', 'code128c', 'ean13', 'upca', 'upce']) {
    assert.match(markup, new RegExp(`value="${format}"`));
  }
});

test('advanced QR codes remain structurally editable after insertion', () => {
  const state = freshState('qrcode');
  const element = state.document.elements[0];
  element.advanced = true;
  element.advancedType = 'wifi';
  element.value = 'WIFI:T:WPA;S:Shop-WiFi;P:abc12345678;;';
  state.editorPanelTab = 'content';
  assert.match(propertyPanel(state), /data-action="edit-advanced-qr"/);

  state.modal = 'advanced-qr';
  state.advancedQrEditId = element.id;
  state.advancedQrType = 'wifi';
  state.advancedQrDraft = { ssid: 'Shop-WiFi', password: 'abc12345678', security: 'WPA' };
  const markup = renderModal(state);
  assert.match(markup, /编辑二维码/);
  assert.match(markup, /更新二维码/);
});

test('data rows can be applied in place and image controls describe real behavior', () => {
  const dataState = freshState('text');
  dataState.selectedIds = [];
  dataState.selectedId = '';
  dataState.editorMode = 'add';
  dataState.editorPanelTab = 'data-source';
  const dataMarkup = propertyPanel(dataState);
  assert.match(dataMarkup, /data-action="apply-editor-data-row"/);
  assert.match(dataMarkup, /data-action="manage-editor-data"/);

  const imageState = freshState('image');
  imageState.editorPanelTab = 'content';
  const contentMarkup = propertyPanel(imageState);
  assert.match(contentMarkup, /data-action="replace-photo"/);
  assert.match(contentMarkup, /拍照替换/);
  assert.doesNotMatch(contentMarkup, /随拍随打|AI/);
  imageState.editorPanelTab = 'style';
  const styleMarkup = propertyPanel(imageState);
  for (const fit of ['contain', 'cover', 'stretch']) assert.match(styleMarkup, new RegExp(`data-value="${fit}"`));
});

test('text content uses a multiline control while machine codes remain single-line', () => {
  const textState = freshState('text');
  textState.document.elements[0].text = '第一行\n第二行';
  textState.editorPanelTab = 'content';
  const textMarkup = propertyPanel(textState);
  assert.match(textMarkup, /<textarea[^>]*id="element-text"/);
  assert.match(textMarkup, /第一行\n第二行<\/textarea>/);

  const barcodeState = freshState('barcode');
  barcodeState.editorPanelTab = 'content';
  assert.match(propertyPanel(barcodeState), /<input[^>]*id="barcode-value"/);
});

test('stock sheet edits drafts and connected printer profile is immutable', () => {
  const state = freshState('text');
  state.modal = 'stock';
  state.stockLabelType = 3;
  state.stockRotationTurns = 1;
  const stockMarkup = renderModal(state);
  assert.match(stockMarkup, /data-action="stock-label-type"/);
  assert.doesNotMatch(stockMarkup, /data-action="update-setting" data-field="labelType"/);
  assert.match(stockMarkup, /90°/);

  state.modal = 'print';
  state.settings.defaultProfileId = 'b21';
  state.device = { name: 'D110', profileId: 'd110', mtu: 247 };
  const printMarkup = renderModal(state);
  assert.match(printMarkup, /id="print-profile"[^>]*disabled/);
  assert.match(printMarkup, /value="d110" selected/);
  assert.match(printMarkup, /已按当前连接设备自动识别/);
});

test('offline material and border libraries show no inert remote pager', () => {
  const state = freshState('material');
  for (const modal of ['material', 'border']) {
    state.modal = modal;
    const markup = renderModal(state);
    assert.doesNotMatch(markup, /load-more-online-(materials|borders)/);
    assert.doesNotMatch(markup, />待载入</);
  }
});

test('locked actions never advertise an operation that must fail', () => {
  const state = freshState('text');
  state.document.elements[0].locked = true;
  const actions = contextActions(state);
  assert.match(actions, /data-action="toggle-lock"/);
  assert.doesNotMatch(actions, /data-action="delete-element"|data-action="edit-element"/);

  const second = createElement('text', state.document);
  second.locked = true;
  state.document.elements.push(second);
  state.selectedIds = state.document.elements.map((item) => item.id);
  state.selectedId = second.id;
  state.multiSelect = true;
  assert.match(contextActions(state), /data-action="delete-selected" disabled/);
});

test('file cancellation and form delegation cannot leave an editor action hanging', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'main.js'), 'utf8');
  assert.match(main, /input\.addEventListener\('cancel',[\s\S]{0,100}finish\(null\)/);
  assert.match(main, /window\.addEventListener\('focus', onWindowFocus, true\)/);
  assert.equal((main.match(/!target\.matches\('input, select, textarea, option'\)/g) || []).length, 2);
  assert.match(main, /case 'replace-photo': await addImage\(true, true\)/);
  assert.match(main, /compositionstart/);
  assert.match(main, /event\.isComposing/);
  assert.match(main, /removeClosedEditorMenu\(\)/);
  assert.match(main, /target\.tagName === 'INPUT' \|\| target\.tagName === 'TEXTAREA'/);
});
