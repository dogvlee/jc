const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createDocument, createElement } = require('../miniprogram/core/document');
const { listFontCatalog } = require('../miniprogram/core/font-family');
const { createImageCacheRegistry } = require('../miniprogram/core/image-cache');
const { getProfile } = require('../miniprogram/core/profiles');

let pageDefinition = null;
global.Page = (definition) => { pageDefinition = definition; };
require('../miniprogram/pages/editor/index');
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
  editor.loadTemplates();
  assert.equal(editor.data.templates.filter((item) => item.source === 'builtin-base').length, 0);
  assert.equal(editor.data.templates.filter((item) => item.source === 'shangyue-original').length, 22);
  assert.equal(editor.data.templates.filter((item) => item.source === 'shangyue-authorized-redesign').length, 0);
  assert.ok(editor.data.templates.some((item) => item.id === 'mine' && item.source === 'user'));
  assert.ok(editor.data.templates.every((item) => item.source === 'shangyue-original' || item.source === 'user'));
  assert.equal(editor.data.templateNames.some((name) => name.includes('· 内置基础')), false);
  assert.ok(editor.data.templateNames.some((name) => name.includes('· 商跃原创')));
  assert.equal(editor.data.templateNames.some((name) => name.includes('授权改编')), false);
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
    profile: getProfile('b1'),
    profileConfirmed: true
  });
  const block = editor.evaluatePrintBlock();
  assert.equal(block.kind, 'element');
  assert.equal(block.errorCode, 'CODE_MODULE_DENSITY_LOW');
  assert.equal(block.elementId, 'low-density');
  assert.match(block.message, /2 打印点\/模块/);

  const wxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'editor', 'index.wxml'), 'utf8');
  assert.match(wxml, /bindtap="fixCodeSize">按最小清晰度放大/);
  assert.match(wxml, /bindtap="focusPrintElement">定位并修改该元素/);
});

test('editor font picker exposes the open-source CJK catalog', () => {
  const catalog = listFontCatalog();
  const wxml = fs.readFileSync(path.join(__dirname, '../miniprogram/pages/editor/index.wxml'), 'utf8');
  assert.equal(catalog.length, 23);
  assert.equal(catalog.filter((font) => font.remote).length, 20);
  assert.match(wxml, /wx:for="\{\{fontCatalog\}\}"/);
  assert.match(wxml, /bindtap="setFontFamily"/);
  assert.match(wxml, /\{\{fontCatalogNote\}\}/);
  assert.match(pageDefinition.data.fontCatalogNote, /23 款字体 · 20 款 OFL/);
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
    profile: getProfile('b1'),
    profileConfirmed: true
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

test('candidate model mappings require a manual profile confirmation before print', () => {
  const editor = Object.assign({}, pageDefinition, {
    data: { profileIndex: 0 },
    repository: { saveSettings() {} },
    manualProfileConfirmed: false,
    setData(patch) { Object.assign(this.data, patch); }
  });
  const guessed = editor.applyConnectionResult({ modelId: 2320, name: 'D110_M', protocolVersion: 1 });
  assert.equal(guessed.id, 'd110');
  assert.equal(editor.candidateProfileVerificationRequired, true);
  assert.equal(editor.profileConfirmed, false);

  editor.manualProfileConfirmed = true;
  editor.applyConnectionResult({ modelId: 2320, name: 'D110_M', protocolVersion: 1 });
  assert.equal(editor.profileConfirmed, true);
});

test('a print-history storage failure never replaces the real print outcome', () => {
  const editor = Object.assign({}, pageDefinition, {
    repository: { recordPrint() { throw new Error('quota'); } }
  });
  assert.equal(editor.recordPrintSafely({ result: 'success' }), false);
});

test('closing the device picker ignores a late BLE scan callback', async () => {
  let deliver;
  const editor = Object.assign({}, pageDefinition, {
    pageActive: true,
    devicePickerGeneration: 0,
    data: { connectionState: 'disconnected', printing: false, showDevices: false, devices: [] },
    session: {
      scan(callback) { deliver = callback; return Promise.resolve(); },
      stopScan() { return Promise.resolve(); }
    },
    setData(patch) { Object.assign(this.data, patch); }
  });
  editor.openDevices();
  editor.closeDevices();
  deliver([{ deviceId: 'late-device' }]);
  await Promise.resolve();
  assert.deepEqual(editor.data.devices, []);
  assert.equal(editor.data.showDevices, false);
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
      connectedDevice: 'D110'
    },
    context: {},
    canvasSize: { width: 100, height: 60 },
    document: createDocument(40, 30),
    profile: getProfile('d110'),
    connectionManager: {
      getSavedDevice() { return { deviceId: 'printer-1', name: 'D110' }; },
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
    async ensureImagesReady() {},
    recordPrintSafely() { return true; },
    renderAll() {},
    setData(patch) { Object.assign(this.data, patch); }
  });

  const printing = editor.startPrint();
  await new Promise((resolve) => setImmediate(resolve));
  await editor.cancelPrint();
  releaseConnection({ deviceId: 'printer-1', name: 'D110' });
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

function remoteAssetWxMock() {
  return {
    env: { USER_DATA_PATH: 'wxfile://usr' },
    getFileSystemManager() {
      return {
        access(options) { options.fail({ errMsg: 'not found' }); },
        mkdir(options) { options.success({}); },
        saveFile(options) { options.success({ savedFilePath: options.filePath }); }
      };
    },
    downloadFile(options) {
      options.success({ statusCode: 200, tempFilePath: 'wxfile://tmp/catalog.png' });
    },
    showModal() {}
  };
}

test('an online material is cached locally before insertion into the editable document', async () => {
  global.wx = remoteAssetWxMock();
  const document = createDocument(40, 30);
  document.elements = [];
  const editor = Object.assign({}, pageDefinition, {
    pageActive: true,
    document,
    data: { materialAssetLoadingId: '', showMaterialSheet: true },
    remoteMaterials: [{
      id: 'niim-remote-test-1',
      label: '远程素材',
      asset: 'https://oss-print.niimbot.com/public_resources/material/editor-test-1.png',
      sourceUrl: 'https://oss-print.niimbot.com/public_resources/material/editor-test-1.png',
      source: 'remote-niim-material'
    }],
    selectedId: '',
    selectedIds: [],
    multiSelect: false,
    replaceMaterial: false,
    setData(patch) { Object.assign(this.data, patch); },
    commit(mutator) { mutator(this.document); },
    invalidateImage() {},
    setSelection(ids) { this.selectedIds = ids; this.selectedId = ids[0] || ''; }
  });
  await editor.pickMaterial({ currentTarget: { dataset: { id: 'niim-remote-test-1' } } });
  assert.equal(document.elements.length, 1);
  assert.equal(document.elements[0].type, 'material');
  assert.equal(document.elements[0].materialId, 'niim-remote-test-1');
  assert.match(document.elements[0].path, /^wxfile:\/\/usr\/niim-online-assets\//);
  assert.equal(editor.data.showMaterialSheet, false);
  assert.equal(editor.data.editorPanelTab, 'elements');
  delete global.wx;
});

test('an online border is cached and inserted as the bottom image layer', async () => {
  global.wx = remoteAssetWxMock();
  const document = createDocument(50, 30);
  const text = createElement('text', document);
  document.elements = [text];
  const editor = Object.assign({}, pageDefinition, {
    pageActive: true,
    document,
    data: { borderAssetLoadingId: '', showBorderSheet: true },
    remoteBorders: [{
      id: 'niim-border-remote-test-1',
      label: '远程边框',
      asset: 'https://oss-print.niimbot.com/public_resources/material/editor-border-test-1.png',
      sourceUrl: 'https://oss-print.niimbot.com/public_resources/material/editor-border-test-1.png',
      source: 'remote-niim-border',
      ninePatch: { identity: true }
    }],
    selectedId: text.id,
    selectedIds: [text.id],
    multiSelect: false,
    setData(patch) { Object.assign(this.data, patch); },
    commit(mutator) { mutator(this.document); },
    invalidateImage() {},
    setSelection(ids) { this.selectedIds = ids; this.selectedId = ids[0] || ''; }
  });
  await editor.pickBorder({ currentTarget: { dataset: { id: 'niim-border-remote-test-1' } } });
  assert.equal(document.elements.length, 2);
  assert.equal(document.elements[0].type, 'image');
  assert.equal(document.elements[0].onlineBorderId, 'niim-border-remote-test-1');
  assert.equal(document.elements[0].width, 50);
  assert.equal(document.elements[0].height, 30);
  assert.equal(document.elements[0].locked, true);
  assert.match(document.elements[0].path, /^wxfile:\/\/usr\/niim-online-assets\//);
  assert.equal(document.elements[1].id, text.id);
  assert.equal(editor.data.showBorderSheet, false);
  assert.equal(editor.data.editorPanelTab, 'elements');
  delete global.wx;
});

test('online and programmatic borders share one slot instead of stacking', async () => {
  global.wx = remoteAssetWxMock();
  const document = createDocument(50, 30);
  const programmatic = createElement('rect', document);
  programmatic.borderStyle = 'double';
  programmatic.decorativeBorder = true;
  document.elements = [programmatic];
  const editor = Object.assign({}, pageDefinition, {
    pageActive: true,
    document,
    data: { borderAssetLoadingId: '', showBorderSheet: true },
    remoteBorders: [{
      id: 'niim-border-remote-exclusive',
      label: '远程边框',
      asset: 'https://oss-print.niimbot.com/public_resources/material/exclusive.png',
      source: 'remote-niim-border'
    }],
    selectedId: programmatic.id,
    selectedIds: [programmatic.id],
    multiSelect: false,
    setData(patch) { Object.assign(this.data, patch); },
    commit(mutator) { mutator(this.document); },
    invalidateImage() {},
    setSelection(ids) { this.selectedIds = ids; this.selectedId = ids[0] || ''; }
  });

  await editor.pickBorder({ currentTarget: { dataset: { id: 'niim-border-remote-exclusive' } } });
  assert.equal(document.elements.filter((item) => item.type === 'rect' && item.decorativeBorder).length, 0);
  assert.equal(document.elements.filter((item) => item.onlineBorderId).length, 1);
  assert.equal(editor.data.editorPanelTab, 'elements');

  editor.data.showBorderSheet = true;
  await editor.pickBorder({ currentTarget: { dataset: { id: 'double' } } });
  assert.equal(document.elements.filter((item) => item.onlineBorderId).length, 0);
  assert.equal(document.elements.filter((item) => item.type === 'rect' && item.decorativeBorder).length, 1);
  assert.equal(editor.data.editorPanelTab, 'elements');
  delete global.wx;
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
  const wxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'editor', 'index.wxml'), 'utf8');
  assert.match(wxml, /class="copies-input"[^>]*bindblur="setCopiesInput"/);
});

test('inspector and layer list surface Chinese element type labels', () => {
  const { elementTypeLabel } = require('../miniprogram/core/document');
  assert.equal(elementTypeLabel('qrcode'), '二维码');
  assert.equal(elementTypeLabel('serial'), '序列号');
  assert.equal(elementTypeLabel('unknown-type'), '元素');
  const wxml = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'editor', 'index.wxml'), 'utf8');
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
    profile: getProfile('d110'),
    selectedId: barcode.id,
    selectedIds: [barcode.id],
    setData(patch) { Object.assign(this.data, patch); },
    setSelection() {},
    commit(mutator) { mutator(this.document); }
  });
  assert.throws(() => validateCodeElement(Object.assign({}, barcode, { value: 'SN-000123' }), 203), /清晰度不足/);
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
    profile: getProfile('d110'),
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
  const markup = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'editor', 'index.wxml'), 'utf8');
  const row = markup.slice(markup.lastIndexOf('<view', markup.indexOf('跟随序号递增')), markup.indexOf('跟随序号递增'));
  assert.ok(row.includes('wx:if="{{documentHasSerial || selected.serialLinked}}"'), row);
  assert.ok(markup.includes('data-field="serialLinked" bindchange="updateSwitch"'));
});
