const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createDocument, createElement } = require('../miniprogram/core/document');
const { listFontCatalog } = require('../miniprogram/core/font-family');
const { createImageCacheRegistry } = require('../miniprogram/core/image-cache');
const { PROFILES, getProfile } = require('../miniprogram/core/profiles');

let pageDefinition = null;
global.Page = (definition) => { pageDefinition = definition; };
require('../miniprogram/pkg-editor/pages/editor/index');
delete global.Page;

function editorWithRects() {
  const document = createDocument(40, 30);
  document.elements = [0, 1, 2].map((index) => {
    const element = createElement('rect', document);
    element.id = `rect-${index}`;
    element.x = [0, 5, 12][index];
    element.y = [1, 6, 10][index];
    element.width = 2;
    element.height = 2;
    return element;
  });
  return Object.assign({}, pageDefinition, {
    document,
    selectedIds: document.elements.map((item) => item.id),
    selectedId: 'rect-2',
    multiSelect: true,
    commit(mutator) { mutator(this.document); }
  });
}

test('editor multi-selection aligns every unlocked element', () => {
  const editor = editorWithRects();
  editor.alignSelection({ currentTarget: { dataset: { value: 'left' } } });
  assert.deepEqual(editor.document.elements.map((item) => item.x), [0, 0, 0]);

  editor.document.elements[0].y = 1;
  editor.document.elements[1].y = 6;
  editor.document.elements[2].y = 10;
  editor.alignSelection({ currentTarget: { dataset: { value: 'bottom' } } });
  assert.deepEqual(editor.document.elements.map((item) => item.y + item.height), [12, 12, 12]);
});

test('editor template panel keeps base layouts available with accurate source labels', () => {
  const editor = Object.assign({}, pageDefinition, {
    data: {},
    repository: {
      getUserTemplates: () => [{
        id: 'mine', name: '我的模板',
        document: { widthMm: 40, heightMm: 30, elements: [] }
      }]
    },
    setData(patch) { Object.assign(this.data, patch); }
  });
  editor.loadTemplates({ widthMm: 50, heightMm: 30, elements: [] });
  assert.equal(editor.data.templates.filter((item) => item.source === 'builtin-base').length, 0);
  assert.equal(editor.data.templates.filter((item) => item.source === 'shangyue-original').length, 22);
  assert.equal(editor.data.templates.filter((item) => item.source === 'shangyue-authorized-redesign').length, 0);
  assert.ok(editor.data.templates.some((item) => item.id === 'mine' && item.source === 'user'));
  assert.ok(editor.data.templates.every((item) => ['shangyue-original', 'shangyue-curated', 'user'].includes(item.source)));
  assert.equal(editor.data.templateNames.some((name) => name.includes('· 内置基础')), false);
  assert.ok(editor.data.templateNames.some((name) => name.includes('· 商跃原创')));
  assert.equal(editor.data.templateNames.some((name) => name.includes('授权改编')), false);
  // A 50×30 label lists the 50×30 scene templates first, so applying one keeps the paper.
  const scenes = editor.data.templates.filter((item) => item.source === 'shangyue-curated');
  assert.ok(scenes.length >= 50);
  assert.equal(editor.data.templates[0].source, 'shangyue-curated');
  assert.ok(editor.data.templateNames[0].endsWith('（50×30）'));
  assert.ok(editor.data.templates.every((item) => !item.document || item.source === 'user'), 'built-in layouts are built when chosen');
});

test('a scene template chosen in the editor keeps the label size', (t) => {
  global.wx = { showModal(options) { options.success({ confirm: true }); }, showToast() {} };
  t.after(() => { delete global.wx; });
  const document = createDocument(50, 30);
  const editor = Object.assign({}, pageDefinition, {
    data: {},
    document,
    selectedId: '',
    selectedIds: [],
    undoStack: [],
    redoStack: [],
    repository: { getUserTemplates: () => [] },
    setData(patch, callback) { Object.assign(this.data, patch); if (callback) callback(); },
    syncPageData(callback) { if (callback) callback(); },
    persistDocument() { return true; },
    refreshCanvas() {}
  });
  editor.loadTemplates();
  editor.loadTemplate({ detail: { value: 0 } });
  assert.deepEqual([editor.document.widthMm, editor.document.heightMm], [50, 30]);
  assert.ok(editor.document.elements.length >= 2);
  assert.equal(editor.document.name, editor.data.templates[0].name);
});

test('print preflight identifies the exact low-density code and exposes repair controls', () => {
  const document = createDocument(40, 30);
  const element = createElement('barcode', document);
  element.id = 'low-density';
  element.value = '1234567890';
  element.width = 12;
  document.elements = [element];
  const editor = Object.assign({}, pageDefinition, {
    document,
    profile: getProfile('escpos-58')
  });
  const block = editor.evaluatePrintBlock();
  assert.equal(block.kind, 'element');
  assert.equal(block.errorCode, 'CODE_MODULE_DENSITY_LOW');
  assert.equal(block.elementId, 'low-density');
  assert.match(block.message, /条码太密.*拉宽到至少 [\d.]+ mm/);

  const wxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pkg-editor', 'pages', 'editor', 'index.wxml'), 'utf8');
  assert.match(wxml, /bindtap="fixCodeSize">自动放大到能扫/);
  assert.match(wxml, /bindtap="focusPrintElement">定位并修改该元素/);
});

test('editor font picker exposes the open-source CJK catalog', () => {
  const catalog = listFontCatalog();
  const wxml = fs.readFileSync(path.join(__dirname, '../miniprogram/pkg-editor/pages/editor/index.wxml'), 'utf8');
  assert.equal(catalog.length, 23);
  assert.equal(catalog.filter((font) => font.remote).length, 20);
  assert.match(wxml, /wx:for="\{\{fontCatalog\}\}"/);
  assert.match(wxml, /bindtap="setFontFamily"/);
  assert.match(wxml, /\{\{fontCatalogNote\}\}/);
  assert.equal(pageDefinition.data.fontCatalogNote, '共 23 款字体，其中 20 款第一次用时要联网下载');
  assert.ok(catalog.some((font) => font.id === 'sy-heiti' && font.license === 'OFL-1.1'));
  assert.ok(catalog.every((font) => font.license === 'system' || font.license === 'OFL-1.1'));

  const document = createDocument(40, 30);
  const text = createElement('text', document);
  document.elements = [text];
  const editor = Object.assign({}, pageDefinition, {
    document,
    selectedIds: [text.id],
    selectedId: text.id,
    commit(mutator) { mutator(this.document); }
  });
  editor.setFontFamily({ currentTarget: { dataset: { value: 'sy-huangyou' } } });
  assert.equal(editor.document.elements[0].fontFamily, 'sy-huangyou');
});

test('editor multi-selection distributes three elements with equal gaps', () => {
  const editor = editorWithRects();
  editor.distributeSelection({ currentTarget: { dataset: { axis: 'horizontal' } } });
  assert.deepEqual(editor.document.elements.map((item) => item.x), [0, 6, 12]);
});

test('editor group lock applies to the complete current selection', () => {
  const editor = editorWithRects();
  editor.toggleSelectedFlag({ currentTarget: { dataset: { field: 'locked' } } });
  assert.ok(editor.document.elements.every((item) => item.locked));
});

test('editor selection rejects stale ids and exits multi-select when empty', () => {
  const editor = editorWithRects();
  editor.setSelection(['missing', 'rect-1', 'rect-1'], true);
  assert.deepEqual(editor.selectedIds, ['rect-1']);
  assert.equal(editor.multiSelect, true);
  editor.setSelection([], true);
  assert.equal(editor.selectedId, '');
  assert.equal(editor.multiSelect, false);
});

test('editor code scanning is single-flight and clears its busy state', async () => {
  const document = createDocument(40, 30);
  const barcode = createElement('barcode', document);
  document.elements = [barcode];
  let scanCalls = 0;
  let finishScan;
  global.wx = {
    scanCode(options) {
      scanCalls += 1;
      finishScan = () => options.success({ result: 'ABC-100', scanType: 'CODE_128' });
    },
    showToast() {},
    showModal() {}
  };
  const editor = Object.assign({}, pageDefinition, {
    data: { codeScanning: false },
    document,
    selectedId: barcode.id,
    selectedIds: [barcode.id],
    setData(patch) { Object.assign(this.data, patch); },
    commit(mutator) { mutator(this.document); }
  });

  const first = editor.scanSelectedCode();
  const second = editor.scanSelectedCode();
  assert.equal(scanCalls, 1);
  assert.equal(editor.data.codeScanning, true);
  finishScan();
  await Promise.all([first, second]);
  assert.equal(editor.data.codeScanning, false);
  assert.equal(barcode.value, 'ABC-100');
  delete global.wx;
});

test('editing code content clears value errors while format confirmation requires an explicit choice', () => {
  const document = createDocument(40, 30);
  const barcode = createElement('barcode', document);
  barcode.value = 'ABC-16';
  barcode.format = 'unsupported';
  barcode.requiresInput = true;
  barcode.requiresInputReason = 'unsupported-code-type';
  barcode.invalidCode = true;
  barcode.unsupportedCodeType = true;
  barcode.requiresFormatConfirmation = true;
  document.elements = [barcode];
  const editor = Object.assign({}, pageDefinition, {
    document,
    selectedId: barcode.id,
    selectedIds: [barcode.id],
    commit(mutator) { mutator(this.document); }
  });

  editor.updateField({ currentTarget: { dataset: { field: 'value' } }, detail: { value: 'REAL-100' } });
  assert.equal(barcode.requiresInput, false);
  assert.equal(barcode.invalidCode, undefined);
  assert.equal(barcode.unsupportedCodeType, true, 'editing value does not guess the source symbology');

  editor.setChoiceField({ currentTarget: { dataset: { field: 'format', value: 'code128' } } });
  assert.equal(barcode.format, 'code128');
  assert.equal(barcode.unsupportedCodeType, undefined);
  assert.equal(barcode.requiresFormatConfirmation, undefined);
  assert.equal(barcode.requiresInput, false);
});

test('explicit editor text placeholders and required sample codes cannot print', () => {
  const document = createDocument(40, 30);
  const text = createElement('text', document);
  text.text = '双击文本框编辑';
  document.elements = [text];
  const editor = Object.assign({}, pageDefinition, {
    document,
    profile: getProfile('escpos-58')
  });
  assert.equal(editor.evaluatePrintBlock().kind, 'placeholder');

  const barcode = createElement('barcode', document);
  barcode.value = '123456789';
  barcode.requiresInput = true;
  barcode.requiresInputReason = 'sample-code';
  document.elements = [barcode];
  const block = editor.evaluatePrintBlock();
  assert.equal(block.kind, 'placeholder');
  assert.equal(block.canConfirmOriginal, true);

  global.wx = { showToast() {} };
  editor.data = { printBlock: block };
  editor.setData = function setData(patch) { Object.assign(this.data, patch); };
  editor.commit = function commit(mutator) { mutator(this.document); };
  editor.confirmPrintElementValue();
  assert.equal(barcode.requiresInput, false);
  assert.equal(barcode.sampleValueConfirmed, true);
  delete global.wx;
});

test('editor ignores an older image load after the same element path changes', async () => {
  const document = createDocument(40, 30);
  const element = createElement('image', document);
  element.path = 'old.png';
  document.elements = [element];
  const created = [];
  const editor = Object.assign({}, pageDefinition, {
    document,
    canvas: {
      createImage() {
        const image = {};
        created.push(image);
        return image;
      }
    },
    images: {},
    imageLoadPromises: {},
    imageCache: createImageCacheRegistry(),
    renderAll() {}
  });

  const oldLoad = editor.loadDocumentImages()[0];
  element.path = 'new.png';
  const newLoad = editor.loadDocumentImages()[0];
  created[0].onload();
  created[1].onload();
  assert.equal(await oldLoad, false);
  assert.equal(await newLoad, true);
  assert.equal(editor.images[element.id], created[1]);
});

test('editor places repeated new elements instead of stacking them at one default point', () => {
  const document = createDocument(40, 30);
  document.elements = [];
  const editor = Object.assign({}, pageDefinition, {
    document,
    selectedId: '',
    selectedIds: [],
    multiSelect: false,
    commit(mutator) { mutator(this.document); }
  });
  editor.addElement({ currentTarget: { dataset: { type: 'text' } } });
  editor.addElement({ currentTarget: { dataset: { type: 'text' } } });
  assert.equal(document.elements.length, 2);
  assert.notDeepEqual(
    [document.elements[0].x, document.elements[0].y],
    [document.elements[1].x, document.elements[1].y]
  );
});

test('a printer named for its paper width prints right away with that model', () => {
  const saved = [];
  const editor = Object.assign({}, pageDefinition, {
    data: { profileIndex: 0 },
    profile: getProfile('escpos-58'),
    repository: { saveSettings(patch) { saved.push(patch); } },
    manualProfileConfirmed: false,
    setData(patch) { Object.assign(this.data, patch); }
  });
  const applied = editor.applyConnectionResult({ deviceId: 'syd-2', name: 'SYD-80' });
  assert.equal(applied.id, 'escpos-80');
  assert.equal(editor.profile.id, 'escpos-80');
  assert.equal(editor.profileSource, 'auto');
  assert.equal(editor.data.profileIndex, PROFILES.indexOf(getProfile('escpos-80')));
  assert.equal(editor.data.densityAdjustable, false, 'the printer keeps its own density');
  assert.deepEqual(saved, [{ defaultProfileId: 'escpos-80' }]);
  // 60 mm paper only an 80 mm printer takes.
  const documentValue = createDocument(60, 40);
  const text = createElement('text', documentValue);
  Object.assign(text, { x: 4, y: 3, width: 40, height: 8, text: '苹果' });
  documentValue.elements = [text];
  assert.equal(editor.evaluatePrintBlock(documentValue, getProfile('escpos-58')).kind, 'size');
  assert.equal(editor.evaluatePrintBlock(documentValue, editor.profile), null, 'no model question before printing');
});

test('a print-history storage failure never replaces the real print outcome', () => {
  const editor = Object.assign({}, pageDefinition, {
    repository: { recordPrint() { throw new Error('quota'); } }
  });
  assert.equal(editor.recordPrintSafely({ result: 'success' }), false);
});

test('the printer button opens the shared picker unless a label is printing', () => {
  const editor = Object.assign({}, pageDefinition, {
    pageActive: true,
    data: { connectionState: 'connecting', printing: false, showDevices: false },
    setData(patch) { Object.assign(this.data, patch); }
  });
  editor.openDevices();
  assert.equal(editor.data.showDevices, true, 'a connection in progress never blocks the picker');

  editor.returnToPrintAfterConnect = true;
  editor.closeDevices();
  assert.equal(editor.data.showDevices, false);
  assert.equal(editor.returnToPrintAfterConnect, false);

  editor.data.printing = true;
  editor.openDevices();
  assert.equal(editor.data.showDevices, false);

  const wxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pkg-editor', 'pages', 'editor', 'index.wxml'), 'utf8');
  assert.match(wxml, /<printer-picker show="\{\{showDevices\}\}" bind:close="closeDevices" bind:connected="onPrinterConnected" \/>/);
  assert.doesNotMatch(wxml, /device-sheet|connectDevice|disconnectDevice|forgetDevice|diagnoseConnection/);
  const json = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pkg-editor', 'pages', 'editor', 'index.json'), 'utf8'));
  assert.equal(json.usingComponents['printer-picker'], '/components/printer-picker/index');
  for (const removed of ['connectDevice', 'disconnectDevice', 'forgetDevice', 'diagnoseConnection']) {
    assert.equal(pageDefinition[removed], undefined, `${removed} 已由打印机选择组件接管`);
  }
});

test('cancelling while connection validation is pending never starts a print', async () => {
  let releaseConnection;
  const connectionGate = new Promise((resolve) => { releaseConnection = resolve; });
  let printCalls = 0;
  global.wx = { showToast() {} };
  const editor = Object.assign({}, pageDefinition, {
    pageActive: true,
    printTaskGeneration: 0,
    printCancelRequested: false,
    data: {
      printing: false,
      canvasReady: true,
      copies: 1,
      density: 3,
      threshold: 180,
      labelTypeIndex: 0,
      connectedDevice: 'SYD-58'
    },
    context: {},
    canvasSize: { width: 100, height: 60 },
    document: createDocument(40, 30),
    profile: getProfile('escpos-58'),
    connectionManager: {
      getSavedDevice() { return { deviceId: 'printer-1', name: 'SYD-58' }; },
      ensureReady() { return connectionGate; },
      touch() {}
    },
    printer: {
      printing: false,
      async cancel() {},
      async print() { printCalls += 1; }
    },
    refreshPrintBlock() { return false; },
    applyConnectionResult() {},
    evaluatePrintBlock() { return null; },
    recordPrintSafely() { return true; },
    renderAll() {},
    setData(patch) { Object.assign(this.data, patch); }
  });

  const printing = editor.startPrint();
  await new Promise((resolve) => setImmediate(resolve));
  await editor.cancelPrint();
  releaseConnection({ deviceId: 'printer-1', name: 'SYD-58' });
  await printing;

  assert.equal(printCalls, 0);
  assert.equal(editor.data.printing, false);
  assert.equal(editor.data.printMessage, '打印已取消');
  delete global.wx;
});

test('onUnload detaches listeners synchronously before asynchronous BLE cleanup', async () => {
  let releaseClose;
  let connectionRemoved = false;
  let managerRemoved = false;
  const closeGate = new Promise((resolve) => { releaseClose = resolve; });
  const editor = Object.assign({}, pageDefinition, {
    pageActive: true,
    printTaskGeneration: 3,
    devicePickerGeneration: 2,
    printer: { printing: false },
    ownsSession: true,
    session: { close() { return closeGate; } },
    removeConnectionListener() { connectionRemoved = true; },
    removeManagerListener() { managerRemoved = true; }
  });

  const unloading = editor.onUnload();
  assert.equal(editor.pageActive, false);
  assert.equal(editor.printCancelRequested, true);
  assert.equal(editor.printTaskGeneration, 4);
  assert.equal(connectionRemoved, true);
  assert.equal(managerRemoved, true);
  releaseClose();
  await unloading;
});

test('closing the editor with unsaved changes prompts before exiting', () => {
  let sheetOptions = null;
  let savedCount = 0;
  let backCount = 0;
  global.wx = {
    showActionSheet(options) { sheetOptions = options; },
    navigateBack() { backCount += 1; },
    setStorageSync() {},
    showToast() {},
    showModal() {}
  };
  const document = createDocument(40, 30);
  document.elements = [createElement('text', document)];
  const editor = Object.assign({}, pageDefinition, {
    data: { projectId: 'p1' },
    document,
    projectId: 'p1',
    dirtySinceSave: true,
    repository: {
      saveEditorProject(value, id) { savedCount += 1; return { id: id || 'p1' }; },
      saveEditorAutosave() {}
    },
    setData(patch) { Object.assign(this.data, patch); }
  });

  editor.closeEditor();
  assert.equal(backCount, 0);
  assert.deepEqual(sheetOptions.itemList, ['保存并退出', '保留草稿退出', '放弃修改退出']);

  sheetOptions.success({ tapIndex: 0 });
  assert.equal(savedCount, 1);
  assert.equal(backCount, 1);
  assert.equal(editor.dirtySinceSave, false);

  editor.dirtySinceSave = true;
  editor.closeEditor();
  sheetOptions.success({ tapIndex: 1 });
  assert.equal(savedCount, 1);
  assert.equal(backCount, 2);

  editor.dirtySinceSave = false;
  sheetOptions = null;
  editor.closeEditor();
  assert.equal(sheetOptions, null);
  assert.equal(backCount, 3);
  delete global.wx;
});

test('reopening the print sheet clears progress left over from the previous run', () => {
  const editor = Object.assign({}, pageDefinition, {
    data: { printing: false, printProgress: 100, printMessage: '打印完成' },
    refreshPrintBlock() { return null; },
    setData(patch) { Object.assign(this.data, patch); }
  });
  editor.openPrintSheet();
  assert.equal(editor.data.showPrintSheet, true);
  assert.equal(editor.data.printProgress, 0);
  assert.equal(editor.data.printMessage, '');

  editor.data.printing = true;
  editor.data.printProgress = 40;
  editor.data.printMessage = '正在打印';
  editor.openPrintSheet();
  assert.equal(editor.data.printProgress, 40);
  assert.equal(editor.data.printMessage, '正在打印');
});

test('print copies accept direct input and clamp to the valid range', () => {
  const editor = Object.assign({}, pageDefinition, {
    data: { copies: 3 },
    setData(patch) { Object.assign(this.data, patch); }
  });
  editor.setCopiesInput({ detail: { value: '30' } });
  assert.equal(editor.data.copies, 30);
  editor.setCopiesInput({ detail: { value: '500' } });
  assert.equal(editor.data.copies, 99);
  editor.setCopiesInput({ detail: { value: '0' } });
  assert.equal(editor.data.copies, 1);
  editor.setCopiesInput({ detail: { value: '12' } });
  editor.setCopiesInput({ detail: { value: '' } });
  assert.equal(editor.data.copies, 12);
  const wxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pkg-editor', 'pages', 'editor', 'index.wxml'), 'utf8');
  assert.match(wxml, /class="copies-input"[^>]*bindinput="setCopiesInput"/, 'typing updates the count right away');
  assert.match(wxml, /class="copies-input"[^>]*bindblur="setCopiesInput"/);
});

test('inspector and layer list surface Chinese element type labels', () => {
  const { elementTypeLabel } = require('../miniprogram/core/document');
  assert.equal(elementTypeLabel('qrcode'), '二维码');
  assert.equal(elementTypeLabel('serial'), '序列号');
  assert.equal(elementTypeLabel('unknown-type'), '元素');
  const wxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pkg-editor', 'pages', 'editor', 'index.wxml'), 'utf8');
  assert.match(wxml, /: selectedTypeLabel\}\}/);
  assert.match(wxml, /class="layer-type">\{\{item\._typeLabel\}\}/);
  assert.equal(/inspector-title">[^<]*selected\.type/.test(wxml), false);
});

test('a scanned value too dense for its barcode offers to enlarge it straight away', async () => {
  const { validateCodeElement } = require('../miniprogram/core/code-quality');
  const document = createDocument(40, 30);
  const barcode = createElement('barcode', document);
  document.elements = [barcode];
  let modal = null;
  const toasts = [];
  global.wx = {
    scanCode(options) { options.success({ result: 'SN-000123', scanType: 'CODE_128' }); },
    showToast(options) { toasts.push(options.title); },
    showModal(options) { modal = options; }
  };
  const editor = Object.assign({}, pageDefinition, {
    data: { codeScanning: false },
    document,
    profile: getProfile('escpos-58'),
    selectedId: barcode.id,
    selectedIds: [barcode.id],
    setData(patch) { Object.assign(this.data, patch); },
    setSelection() {},
    commit(mutator) { mutator(this.document); }
  });
  assert.throws(() => validateCodeElement(Object.assign({}, barcode, { value: 'SN-000123' }), 203), /条码太密/);
  await editor.scanSelectedCode();
  assert.equal(barcode.value, 'SN-000123');
  assert.equal(modal.title, '条码已填入');
  assert.equal(modal.confirmText, '放大');
  modal.success({ confirm: true });
  assert.doesNotThrow(() => validateCodeElement(barcode, 203));
  assert.ok(barcode.x >= 0 && barcode.x + barcode.width <= document.widthMm);
  assert.deepEqual(toasts, ['已放大，请检查排版']);
  delete global.wx;
});

test('a scanned value that cannot fit the label says so instead of offering a resize', async () => {
  const document = createDocument(20, 12);
  const barcode = createElement('barcode', document);
  document.elements = [barcode];
  let modal = null;
  global.wx = {
    scanCode(options) { options.success({ result: 'SF1234567890123', scanType: 'CODE_128' }); },
    showToast() {},
    showModal(options) { modal = options; }
  };
  const editor = Object.assign({}, pageDefinition, {
    data: { codeScanning: false },
    document,
    profile: getProfile('escpos-58'),
    selectedId: barcode.id,
    selectedIds: [barcode.id],
    setData(patch) { Object.assign(this.data, patch); },
    commit(mutator) { mutator(this.document); }
  });
  await editor.scanSelectedCode();
  assert.equal(barcode.value, 'SF1234567890123');
  assert.equal(modal.showCancel, false);
  assert.match(modal.content, /放不下/);
  delete global.wx;
});

test('editor scan-fill failures offer a rescan per the UX spec', async () => {
  const document = createDocument(40, 30);
  const barcode = createElement('barcode', document);
  document.elements = [barcode];
  let scanCalls = 0;
  let modal = null;
  global.wx = {
    scanCode(options) {
      scanCalls += 1;
      options.success({ result: 'https://example.com', scanType: 'QR_CODE' });
    },
    showToast() {},
    showModal(options) { modal = options; }
  };
  const editor = Object.assign({}, pageDefinition, {
    data: { codeScanning: false },
    document,
    selectedId: barcode.id,
    selectedIds: [barcode.id],
    setData(patch) { Object.assign(this.data, patch); },
    commit(mutator) { mutator(this.document); }
  });
  await editor.scanSelectedCode();
  assert.equal(barcode.value, '0');
  assert.equal(modal.title, '无法填入扫码内容');
  assert.deepEqual([modal.confirmText, modal.cancelText], ['重新扫码', '取消']);
  modal.success({ confirm: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(scanCalls, 2);
  delete global.wx;
});

test('turning on serial follow makes the code print the serial text and keeps it in sync', () => {
  const document = createDocument(40, 30);
  const serial = createElement('serial', document);
  Object.assign(serial, { prefix: 'FA-', start: 1024, digits: 4 });
  const qr = createElement('qrcode', document);
  document.elements = [serial, qr];
  const editor = Object.assign({}, pageDefinition, {
    document,
    selectedId: qr.id,
    selectedIds: [qr.id],
    commit: pageDefinition.commit,
    recordSnapshot() {},
    persistDocument() {},
    syncPageData() {}
  });
  editor.updateSwitch({ currentTarget: { dataset: { field: 'serialLinked' } }, detail: { value: true } });
  assert.equal(qr.serialLinked, true);
  assert.equal(qr.value, 'FA-1024');
  editor.selectedId = serial.id;
  editor.selectedIds = [serial.id];
  editor.commit(() => { serial.start = 1100; });
  assert.equal(qr.value, 'FA-1100');
});

test('the code inspector offers serial follow only when the label has a serial number', () => {
  const markup = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pkg-editor', 'pages', 'editor', 'index.wxml'), 'utf8');
  const row = markup.slice(markup.lastIndexOf('<view', markup.indexOf('跟随序号递增')), markup.indexOf('跟随序号递增'));
  assert.ok(row.includes('wx:if="{{documentHasSerial || selected.serialLinked}}"'), row);
  assert.ok(markup.includes('data-field="serialLinked" bindchange="updateSwitch"'));
});

test('a copies value out of range snaps back in the box the owner is looking at', () => {
  const editor = Object.assign({}, pageDefinition, {
    data: { copies: 3, copiesInput: '3' },
    setData(patch) { Object.assign(this.data, patch); }
  });
  editor.setCopiesInput({ detail: { value: '500' } });
  assert.equal(editor.data.copies, 99);
  assert.equal(editor.data.copiesInput, '99', 'the box shows the number that will print');

  editor.setCopiesInput({ detail: { value: '' } });
  assert.equal(editor.data.copies, 99, 'an emptied box keeps the last usable count');

  // The job keeps the count it started with, whatever is typed meanwhile.
  editor.data.printing = true;
  editor.setCopiesInput({ detail: { value: '7' } });
  assert.equal(editor.data.copies, 99);
  assert.equal(editor.data.copiesInput, '99');
});

test('the bottom panel lifts above an open keyboard instead of being covered', () => {
  const listeners = [];
  global.wx = {
    onKeyboardHeightChange(listener) { listeners.push(listener); },
    offKeyboardHeightChange(listener) { const index = listeners.indexOf(listener); if (index >= 0) listeners.splice(index, 1); }
  };
  try {
    const editor = Object.assign({}, pageDefinition, {
      data: { keyboardHeight: 0 },
      setData(patch) { Object.assign(this.data, patch); }
    });
    editor.bindKeyboard();
    assert.equal(listeners.length, 1, 'one listener owns the keyboard state');
    listeners[0]({ height: 280 });
    assert.equal(editor.data.keyboardHeight, 280);
    // Silly heights are clamped, not applied blindly.
    listeners[0]({ height: 5000 });
    assert.equal(editor.data.keyboardHeight, 420);
    listeners[0]({ height: 0 });
    assert.equal(editor.data.keyboardHeight, 0, 'closing the keyboard restores the layout');
    editor.unbindKeyboard();
    assert.equal(listeners.length, 0);
  } finally {
    delete global.wx;
  }
  const markup = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pkg-editor', 'pages', 'editor', 'index.wxml'), 'utf8');
  assert.match(markup, /class="editor-page" style="padding-bottom: \{\{keyboardHeight\}\}px;"/);
});

test('deleting an element says so, and a multi-selection asks first', () => {
  const calls = { toasts: [], modals: [] };
  global.wx = {
    showToast(options) { calls.toasts.push(options.title); },
    showModal(options) { calls.modals.push(options); }
  };
  try {
    const documentValue = createDocument(40, 30);
    const elements = [createElement('text', documentValue), createElement('text', documentValue), createElement('rect', documentValue)];
    documentValue.elements = elements;
    const editor = Object.assign({}, pageDefinition, {
      data: { copies: 1 },
      document: documentValue,
      selectedId: elements[0].id,
      selectedIds: [elements[0].id],
      undoStack: [],
      redoStack: [],
      setData(patch, callback) { Object.assign(this.data, patch); if (callback) callback(); },
      commit(mutator) { mutator(this.document); },
      setSelection(ids) { this.selectedIds = ids; },
      invalidateImage() {}
    });

    editor.deleteSelected();
    assert.equal(documentValue.elements.length, 2);
    assert.match(calls.toasts[0], /已删除「文本」，可点左上角撤销/);

    // Two at once asks first: many deletions deserve a question.
    editor.selectedIds = [elements[1].id, elements[2].id];
    editor.selectedId = elements[1].id;
    editor.deleteSelected();
    assert.equal(documentValue.elements.length, 2, 'nothing goes until the dialog is confirmed');
    assert.match(calls.modals[0].title, /删除这 2 个元素/);
    calls.modals[0].success({ confirm: true });
    assert.equal(documentValue.elements.length, 0);
  } finally {
    delete global.wx;
  }
});

test('the template tab is a searchable list with size and source on every card', () => {
  const editor = Object.assign({}, pageDefinition, {
    data: {},
    repository: {
      getUserTemplates: () => [{ id: 'mine', name: '我的价签模板', document: { widthMm: 40, heightMm: 30, elements: [] } }]
    },
    setData(patch) { Object.assign(this.data, patch); }
  });
  editor.loadTemplates({ widthMm: 50, heightMm: 30, elements: [] });

  const cards = editor.data.templateCards;
  assert.ok(cards.length >= 50, 'every template has a card');
  assert.deepEqual(Object.keys(cards[0]).sort(), ['id', 'index', 'kind', 'name', 'sizeText', 'sourceLabel', 'thumbSrc']);
  assert.equal(cards[0].index, 0, 'the card knows its place in the list');
  assert.match(cards[0].sizeText, /^\d+×\d+ mm$/);
  assert.ok(['场景模板', '商跃原创', '我的'].includes(cards[0].sourceLabel));
  const mine = cards.find((card) => card.id === 'mine');
  assert.equal(mine.sourceLabel, '我的');
  assert.equal(mine.sizeText, '40×30 mm');

  // Search matches names and sizes, and the list says so when nothing matches.
  editor.onTemplateSearch({ detail: { value: '我的价签' } });
  assert.deepEqual(editor.data.templateCards.map((card) => card.id), ['mine']);
  editor.onTemplateSearch({ detail: { value: '50x30' } });
  assert.ok(editor.data.templateCards.length > 0);
  editor.onTemplateSearch({ detail: { value: '不存在的模板' } });
  assert.deepEqual(editor.data.templateCards, []);
  editor.onTemplateSearch({ detail: { value: '' } });
  assert.equal(editor.data.templateCards.length, cards.length, 'clearing the search restores the list');
});

test('a card tap opens the same apply confirmation as the old picker', (t) => {
  let modal = null;
  global.wx = { showModal(options) { modal = options; }, showToast() {} };
  t.after(() => { delete global.wx; });
  const document = createDocument(50, 30);
  const editor = Object.assign({}, pageDefinition, {
    data: {},
    document,
    selectedId: '',
    selectedIds: [],
    undoStack: [],
    redoStack: [],
    dirtySinceSave: true,
    repository: { getUserTemplates: () => [] },
    setData(patch, callback) { Object.assign(this.data, patch); if (callback) callback(); },
    syncPageData(callback) { if (callback) callback(); },
    persistDocument() { return true; },
    refreshCanvas() {}
  });
  editor.loadTemplates();
  const card = editor.data.templateCards[3];

  editor.loadTemplate({ currentTarget: { dataset: { index: card.index } } });
  assert.ok(modal, 'applying a template still asks first');
  assert.match(modal.title, new RegExp(editor.data.templates[card.index].name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  modal.success({ confirm: true });
  assert.equal(editor.document.name, editor.data.templates[card.index].name);
});

test('the material sheet filters its symbols with the catalogue chips', () => {
  const { MATERIAL_CATALOG, MATERIAL_CHIPS } = require('../miniprogram/core/materials');
  const editor = Object.assign({}, pageDefinition, {
    data: Object.assign({}, pageDefinition.data),
    setData(patch) { Object.assign(this.data, patch); }
  });

  assert.deepEqual(editor.data.materialChips, ['全部'].concat(MATERIAL_CHIPS));
  assert.equal(editor.data.materialChip, '全部');

  const all = editor.materialOptionsFor('全部');
  assert.equal(all.length, MATERIAL_CATALOG.length, 'every symbol is reachable');
  assert.ok(all.every((item) => typeof item.category === 'string' && Array.isArray(item.tags)));

  const warning = editor.materialOptionsFor('警示');
  assert.ok(warning.length > 0 && warning.length < all.length);
  assert.ok(warning.every((item) => item.category === '警示' || item.tags.includes('警示')));

  editor.selectMaterialChip({ currentTarget: { dataset: { chip: '物流' } } });
  assert.equal(editor.data.materialChip, '物流');
  assert.ok(editor.data.materialOptions.length > 0);
  assert.ok(editor.data.materialOptions.every((item) => item.category === '物流' || item.tags.includes('物流')));

  editor.selectMaterialChip({ currentTarget: { dataset: { chip: '全部' } } });
  assert.equal(editor.data.materialOptions.length, MATERIAL_CATALOG.length);

  const markup = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pkg-editor', 'pages', 'editor', 'index.wxml'), 'utf8');
  assert.match(markup, /wx:for="\{\{materialChips\}\}"[^>]*bindtap="selectMaterialChip"/);
  assert.match(markup, /wx:for="\{\{materialOptions\}\}"/);
  assert.match(markup, /这一类还没有素材/);
});
