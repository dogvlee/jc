const test = require('node:test');
const assert = require('node:assert/strict');

const { createDocument, createElement } = require('../miniprogram/core/document');
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
