const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createDocument, createElement } = require('../miniprogram/core/document');
const { PROFILES, getProfile } = require('../miniprogram/core/profiles');
const { PrintJobService } = require('../miniprogram/services/print-job-service');
const { Repository } = require('../miniprogram/services/repository');
const { EditorSession } = require('../miniprogram/services/editor-session');

let pageDefinition = null;
global.Page = (definition) => { pageDefinition = definition; };
require('../miniprogram/pkg-editor/pages/editor/index');
delete global.Page;

const read = (file) => fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pkg-editor', 'pages', 'editor', file), 'utf8');
const indexOf = (id) => PROFILES.findIndex((profile) => profile.id === id);
const LEAVE_MESSAGE = '正在打印，离开会中断打印。确定要离开吗？';

test.afterEach(() => {
  delete global.wx;
  delete global.getApp;
});

function useWx(extra) {
  const calls = { modals: [], toasts: [] };
  global.wx = Object.assign({
    showModal(options) { calls.modals.push(options); },
    showToast(options) { calls.toasts.push(options.title); },
    getDeviceInfo() { return { platform: 'android' }; }
  }, extra || {});
  return calls;
}

function label(widthMm, heightMm, build) {
  const documentValue = createDocument(widthMm, heightMm);
  documentValue.name = '测试标签';
  documentValue.elements = build ? build(documentValue) : [];
  return documentValue;
}

function textLabel() {
  return label(40, 30, (documentValue) => {
    const text = createElement('text', documentValue);
    Object.assign(text, { id: 'title', text: '苹果' });
    return [text];
  });
}

// A filled bar in the middle of the label, clear of any skipped edge strip.
function barLabel(widthMm, heightMm) {
  return label(widthMm, heightMm, (documentValue) => {
    const bar = createElement('rect', documentValue);
    Object.assign(bar, { id: 'bar', x: 10, y: 4, width: 20, height: 4, filled: true });
    return [bar];
  });
}

function fakeManager(result) {
  return {
    confirmed: '',
    confirmations: [],
    getSavedDevice() { return { deviceId: result.deviceId, name: result.name }; },
    ensureReady() { return Promise.resolve(Object.assign({}, result)); },
    touch() {},
    getConfirmedProfileId(deviceId) { return deviceId === result.deviceId ? this.confirmed : ''; },
    confirmProfile(deviceId, profileId) {
      this.confirmations.push([deviceId, profileId]);
      this.confirmed = profileId;
      return true;
    }
  };
}

function fakePrinter() {
  return {
    prints: [],
    printing: false,
    jobToken: null,
    async print(imageData, profile, options) { this.prints.push({ imageData, profile, options }); },
    async cancel() {}
  };
}

function editorFor(documentValue, overrides) {
  const history = [];
  const messages = [];
  const editor = Object.assign({}, pageDefinition, {
    data: Object.assign(structuredClone(pageDefinition.data), { canvasReady: true }),
    pageActive: true,
    document: documentValue,
    profile: getProfile('escpos-58'),
    profileSource: 'default',
    selectedId: '',
    selectedIds: [],
    multiSelect: false,
    undoStack: [],
    redoStack: [],
    projectId: '',
    dirtySinceSave: false,
    printTaskGeneration: 0,
    context: {},
    canvasSize: { width: 1, height: 1 },
    history,
    messages,
    repository: { saveSettings() {}, recordPrint(entry) { history.push(entry); } },
    setData(patch, callback) {
      if (patch.printMessage) messages.push(patch.printMessage);
      Object.assign(this.data, patch);
      if (callback) callback();
    },
    syncPageData(callback) { if (callback) callback(); },
    persistDocument() { return true; },
    initCanvas() {},
    loadDocumentImages() { return []; },
    renderAll() {},
    createPrintImageData() { return { width: 8, height: 8, data: new Uint8ClampedArray(256) }; }
  }, overrides || {});
  editor.printJobService = new PrintJobService({ printer: editor.printer || fakePrinter() });
  return editor;
}

// OffscreenCanvas whose context ignores drawing and returns a white raster
// that `paint` may mark before the page reads it back.
function rasterWx(paint) {
  const created = [];
  return {
    created,
    createOffscreenCanvas(options) {
      created.push(options);
      const store = {};
      const context = new Proxy(store, {
        get(target, key) {
          if (key === 'getImageData') {
            return (x, y, width, height) => {
              const image = { width, height, data: new Uint8ClampedArray(width * height * 4).fill(255) };
              if (paint) paint(image);
              return image;
            };
          }
          // Text drawing measures its line before painting; a fixed width keeps
          // the drawn result predictable in tests.
          if (key === 'measureText') {
            return () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
          }
          return key in target ? target[key] : () => {};
        },
        set(target, key, value) {
          target[key] = value;
          return true;
        }
      });
      return { width: 0, height: 0, getContext() { return context; } };
    }
  };
}

function paint(image, x, y, rgba) {
  image.data.set(rgba, (y * image.width + x) * 4);
}

// Thermal printers as the picker reports them: the end of the name gives
// the paper width (…58 / …80); EY-260 says nothing, so it prints as 58 mm.
const SYD58 = { deviceId: 'syd-1', name: 'SYD-58' };
const SYD80 = { deviceId: 'syd-2', name: 'SYD-80' };
const EY260 = { deviceId: 'ey-1', name: 'EY-260' };

test('connecting from the picker takes the model from the printer name and goes back to printing', () => {
  const calls = useWx();
  const editor = editorFor(textLabel(), { connectionManager: fakeManager(SYD80), returnToPrintAfterConnect: true });
  editor.data.showDevices = true;

  editor.onPrinterConnected({ detail: { result: Object.assign({}, SYD80), device: { deviceId: SYD80.deviceId, name: SYD80.name } } });

  assert.equal(editor.profile.id, 'escpos-80');
  assert.equal(editor.profileSource, 'auto');
  assert.equal(editor.data.profileIndex, indexOf('escpos-80'));
  assert.equal(editor.data.densityAdjustable, false, 'a thermal printer keeps its own density');
  assert.equal(editor.data.showDevices, false);
  assert.equal(editor.data.connectionState, 'connected');
  assert.equal(editor.data.connectionLabel, '已连接');
  assert.equal(editor.data.connectedDevice, 'SYD-80');
  assert.equal(editor.returnToPrintAfterConnect, false);
  assert.equal(editor.data.showPrintSheet, true);
  assert.equal(editor.data.printBlock, null);
  assert.equal(calls.modals.length, 0, 'connecting never asks which model the printer is');
});

test('a printer whose name gives no width asks once before the first print, then remembers the answer', async () => {
  const calls = useWx();
  const manager = fakeManager(EY260);
  const printer = fakePrinter();
  const editor = editorFor(textLabel(), { connectionManager: manager, printer, profile: getProfile('escpos-80') });

  editor.onPrinterConnected({ detail: { result: Object.assign({}, EY260), device: { deviceId: EY260.deviceId } } });
  // Connecting still never asks; the 58 mm guess stands until the owner answers.
  assert.equal(editor.profile.id, 'escpos-58');
  assert.equal(calls.modals.length, 0, 'connecting never asks which model the printer is');
  assert.deepEqual(manager.confirmations, [], 'a guess is never saved as a choice');

  editor.openPrintSheet();
  assert.equal(editor.data.printBlock.kind, 'paper-width');
  assert.equal(editor.data.printBlock.canChoosePaperWidth, true);

  // A guessed width never reaches the printer, whatever the entry point.
  await editor.startPrint();
  assert.equal(printer.prints.length, 0);
  assert.equal(editor.data.printBlock.kind, 'paper-width');

  editor.choosePrinterPaperWidth({ currentTarget: { dataset: { width: 80 } } });
  assert.equal(editor.profile.id, 'escpos-80');
  assert.equal(editor.data.printBlock, null);
  assert.deepEqual(manager.confirmations, [['ey-1', 'escpos-80']]);

  await editor.startPrint();
  assert.equal(printer.prints.length, 1);
  assert.equal(printer.prints[0].profile.id, 'escpos-80');
});

test('a printer whose name gives no width prints on 58 mm once the owner says so', async () => {
  useWx();
  const manager = fakeManager(EY260);
  const printer = fakePrinter();
  const editor = editorFor(textLabel(), { connectionManager: manager, printer, profile: getProfile('escpos-80') });

  editor.onPrinterConnected({ detail: { result: Object.assign({}, EY260), device: { deviceId: EY260.deviceId } } });
  editor.openPrintSheet();
  editor.choosePrinterPaperWidth({ currentTarget: { dataset: { width: 58 } } });
  assert.equal(editor.data.printBlock, null);
  assert.equal(editor.profile.id, 'escpos-58');

  await editor.startPrint();
  assert.equal(printer.prints[0].profile.id, 'escpos-58');
});

test('a printer whose name states its width never asks', () => {
  useWx();
  const manager = fakeManager(SYD58);
  const editor = editorFor(textLabel(), { connectionManager: manager, printer: fakePrinter() });
  editor.onPrinterConnected({ detail: { result: Object.assign({}, SYD58), device: { deviceId: SYD58.deviceId } } });
  assert.equal(editor.paperWidthBlock(), null);
  editor.openPrintSheet();
  assert.equal(editor.data.printBlock, null);
});

test('a model chosen before for a printer outranks its name', async () => {
  useWx();
  const manager = fakeManager(EY260);
  manager.confirmed = 'escpos-80';
  const printer = fakePrinter();
  const editor = editorFor(textLabel(), { connectionManager: manager, printer });
  await editor.startPrint();
  assert.equal(editor.data.printBlock, null);
  assert.equal(printer.prints[0].profile.id, 'escpos-80');
});

test('choosing another model while a printer is connected is kept for that printer', () => {
  useWx();
  const manager = fakeManager(EY260);
  const editor = editorFor(textLabel(), { connectionManager: manager });
  editor.onPrinterConnected({ detail: { result: Object.assign({}, EY260) } });

  editor.onProfileChange({ detail: { value: indexOf('escpos-80') } });
  assert.deepEqual(manager.confirmations, [['ey-1', 'escpos-80']]);

  editor.applyConnectionResult(Object.assign({}, EY260));
  assert.equal(editor.profile.id, 'escpos-80', 'the choice is not replaced by the name');
  assert.equal(editor.profileSource, 'device');
});

test('the model row of the print sheet opens the picker and returns to printing', () => {
  useWx();
  const manager = fakeManager(EY260);
  const editor = editorFor(textLabel(), { connectionManager: manager });
  editor.onPrinterConnected({ detail: { result: Object.assign({}, EY260) } });
  editor.openPrintSheet();

  assert.match(read('index.wxml'), /class="summary-action[^"]*"[^>]*bindtap="openProfilePicker"/);
  editor.openProfilePicker();
  assert.equal(editor.data.showPrintSheet, false);
  assert.equal(editor.data.showSettingsSheet, true);
  editor.onProfileChange({ detail: { value: indexOf('escpos-80') } });
  assert.deepEqual(manager.confirmations, [['ey-1', 'escpos-80']]);
  assert.equal(editor.data.showSettingsSheet, false);
  assert.equal(editor.data.showPrintSheet, true);
});

test('a model picked by hand before the printer connects is used and becomes its model', async () => {
  useWx();
  const manager = fakeManager(EY260);
  const printer = fakePrinter();
  const editor = editorFor(textLabel(), { connectionManager: manager, printer });
  assert.equal(editor.data.connectionState, 'disconnected');

  editor.onProfileChange({ detail: { value: indexOf('escpos-80') } });
  assert.deepEqual(manager.confirmations, [], 'no printer is connected to remember it for yet');
  await editor.startPrint();
  assert.equal(printer.prints[0].profile.id, 'escpos-80');
  assert.deepEqual(manager.confirmations, [['ey-1', 'escpos-80']]);
  assert.equal(editor.manualProfileConfirmed, false);
});

test('切换为 … tapped while the printer is away outranks the model saved for it', async () => {
  // EY-260 does not say its paper width, so the switch asks first.
  const calls = useWx({ showModal(options) { calls.modals.push(options); options.success({ confirm: true }); } });
  const manager = fakeManager(EY260);
  manager.confirmed = 'escpos-58';
  const printer = fakePrinter();
  const editor = editorFor(barLabel(70, 30), { connectionManager: manager, printer });
  editor.openPrintSheet();
  assert.equal(editor.data.printBlock.kind, 'size');
  assert.equal(editor.data.printBlock.suggestProfileId, 'escpos-80');
  assert.equal(editor.data.printBlock.canResize, true, 'changing the label size is offered too');
  assert.equal(editor.data.savedPrinterName, 'EY-260');

  editor.applySuggestedProfile();
  assert.equal(calls.modals.length, 1);
  assert.equal(calls.modals[0].title, '打印机是 80mm 纸宽吗？');
  assert.equal(editor.data.printBlock, null);
  await editor.startPrint();
  assert.equal(editor.data.printBlock, null);
  assert.equal(printer.prints[0].profile.id, 'escpos-80');
  assert.deepEqual(manager.confirmations, [['ey-1', 'escpos-80']]);
});

test('a text box emptied on purpose prints blank instead of blocking', () => {
  useWx();
  const editor = editorFor(textLabel());
  editor.selectedId = 'title';
  editor.selectedIds = ['title'];
  editor.updateField({ currentTarget: { dataset: { field: 'text' } }, detail: { value: '' } });
  editor.openPrintSheet();
  assert.equal(editor.data.printBlock, null);

  // An untouched default text still asks to be filled in.
  const fresh = editorFor(label(40, 30, (documentValue) => [createElement('text', documentValue)]));
  fresh.openPrintSheet();
  assert.equal(fresh.data.printBlock.message, '还有文字没改，请改成你要的内容，或者删掉这个文本框');
});

test('a printer whose name says 58 is never offered the 80 mm width', () => {
  const calls = useWx();
  const manager = fakeManager({ deviceId: 'syd-1', name: 'SYD-58' });
  const editor = editorFor(barLabel(70, 30), { connectionManager: manager });
  editor.openPrintSheet();
  assert.equal(editor.data.printBlock.suggestProfileId, '');
  assert.equal(editor.data.printBlock.canResize, true);
  editor.applySuggestedProfile();
  assert.equal(calls.modals.length, 0);
  assert.deepEqual(manager.confirmations, []);

  editor.openSizeSettings();
  assert.equal(editor.data.showPrintSheet, false);
  assert.equal(editor.data.showSettingsSheet, true);
});

test('the print button says what it will do with the remembered printer', () => {
  useWx();
  const wxml = read('index.wxml');
  assert.match(wxml, /\{\{connectedDevice \? '开始打印' : savedPrinterName \? '连接并打印' : '选择打印机'\}\}/);
  const manager = fakeManager(EY260);
  const editor = editorFor(textLabel(), { connectionManager: manager });
  editor.openPrintSheet();
  assert.equal(editor.data.savedPrinterName, 'EY-260');
  editor.choosePrinterFromPrint();
  assert.equal(editor.data.showPrintSheet, false);
  assert.equal(editor.returnToPrintAfterConnect, true);
});

test('a model chosen in this visit is saved again after another printer replaced the saved one', () => {
  useWx();
  const manager = fakeManager(EY260);
  const editor = editorFor(textLabel(), { connectionManager: manager });
  editor.onPrinterConnected({ detail: { result: Object.assign({}, EY260) } });
  editor.onProfileChange({ detail: { value: indexOf('escpos-80') } });

  manager.confirmed = ''; // connecting another printer replaced the saved record
  manager.confirmations = [];
  editor.applyConnectionResult(Object.assign({}, EY260));
  assert.equal(editor.profile.id, 'escpos-80');
  assert.deepEqual(manager.confirmations, [['ey-1', 'escpos-80']]);
});

test('a pick saved for one printer is not carried to the next', () => {
  useWx();
  const manager = fakeManager(EY260);
  const editor = editorFor(textLabel(), { connectionManager: manager });
  editor.onProfileChange({ detail: { value: indexOf('escpos-80') } });
  assert.equal(editor.manualProfileConfirmed, true, 'nothing connected yet: the pick waits');

  // The printer reconnects on its own and takes the waiting pick.
  editor.applyLinkState({ status: 'connected', device: Object.assign({}, EY260) });
  assert.deepEqual(manager.confirmations, [['ey-1', 'escpos-80']]);
  assert.equal(editor.manualProfileConfirmed, false);

  editor.onProfileChange({ detail: { value: indexOf('escpos-58') } });
  assert.equal(editor.manualProfileConfirmed, false, 'a pick saved for this printer does not wait for the next');
  editor.applyConnectionResult(Object.assign({}, SYD80));
  assert.equal(editor.profile.id, 'escpos-80', 'the next printer goes by its own name');
  assert.equal(editor.profileSource, 'auto');
});

test('a printer that reconnects on its own switches the editor to its model', () => {
  useWx();
  const editor = editorFor(barLabel(70, 30), { connectionManager: fakeManager(SYD80) });
  assert.equal(editor.profile.id, 'escpos-58');
  editor.applyLinkState({ status: 'connected', device: Object.assign({}, SYD80) });
  assert.equal(editor.profile.id, 'escpos-80');
  editor.openPrintSheet();
  assert.equal(editor.data.printBlock, null, 'a 70 mm label is not refused by the 58 mm default');
});

test('a 50 mm label prints on a 58 mm printer as the band the head reaches, and ink in a skipped strip stops it', () => {
  const documentValue = barLabel(50, 30);
  const clean = rasterWx((image) => paint(image, 200, 100, [0, 0, 0, 255]));
  global.wx = clean;
  const editor = editorFor(documentValue, { createPrintImageData: pageDefinition.createPrintImageData });
  const band = editor.createPrintImageData(documentValue, getProfile('escpos-58'), {}, 180);
  assert.deepEqual(clean.created, [{ type: '2d', width: 400, height: 240 }]);
  assert.deepEqual([band.width, band.height], [384, 240]);
  assert.deepEqual([...band.data.slice((100 * 384 + 192) * 4, (100 * 384 + 192) * 4 + 4)], [0, 0, 0, 255]);

  global.wx = rasterWx((image) => paint(image, 3, 100, [0, 0, 0, 255]));
  assert.throws(
    () => editor.createPrintImageData(documentValue, getProfile('escpos-58'), {}, 180),
    (error) => error.code === 'MARGIN_INK'
      && error.message === '这台打印机左右两侧各约 1.0 mm 打不到，请把靠边的内容往中间移一点再打印。'
  );

  // The strip is judged at the threshold the printer receives.
  global.wx = rasterWx((image) => paint(image, 3, 100, [150, 150, 150, 255]));
  assert.equal(editor.createPrintImageData(documentValue, getProfile('escpos-58'), {}, 120).width, 384);
  assert.throws(() => editor.createPrintImageData(documentValue, getProfile('escpos-58'), {}, 180), { code: 'MARGIN_INK' });
});

test('ink the preview missed stops the print with the plain margin message', async () => {
  const toasts = [];
  global.wx = Object.assign(rasterWx((image) => paint(image, 2, 50, [0, 0, 0, 255])), {
    showToast(options) { toasts.push(options.title); }
  });
  const printer = fakePrinter();
  const editor = editorFor(barLabel(50, 30), {
    connectionManager: fakeManager(SYD58),
    printer,
    createPrintImageData: pageDefinition.createPrintImageData
  });
  await editor.startPrint();
  assert.equal(printer.prints.length, 0);
  assert.equal(editor.data.printError, '这台打印机左右两侧各约 1.0 mm 打不到，请把靠边的内容往中间移一点再打印。');
  assert.equal(editor.data.printing, false);
});

test('a raw English printer error reads as plain Chinese', async () => {
  useWx();
  const printer = fakePrinter();
  printer.print = async () => {
    const error = new Error('unexpected reply');
    error.possiblyPrinted = false;
    throw error;
  };
  const editor = editorFor(textLabel(), { connectionManager: fakeManager(SYD58), printer });
  await editor.startPrint();
  assert.equal(editor.data.printError, '连接打印机时出了点问题。请把打印机关机再开机，然后重试。');
});

test('a label too wide for the chosen model is offered the one that can print it', () => {
  useWx();
  const editor = editorFor(barLabel(70, 30), { connectionManager: fakeManager(SYD58) });
  const block = editor.evaluatePrintBlock();
  assert.equal(block.kind, 'size');
  assert.equal(block.reason, 'PAPER_TOO_LARGE');
  assert.equal(block.suggestProfileId, 'escpos-80');

  editor.applyConnectionResult(Object.assign({}, SYD58));
  assert.equal(editor.evaluatePrintBlock().suggestProfileId, 'escpos-80', 'a name only guesses the paper width');

  const hopeless = editorFor(barLabel(90, 30), { profile: getProfile('escpos-80') });
  assert.equal(hopeless.evaluatePrintBlock().suggestProfileId, '', 'no model takes 90 mm paper');

  // Content in a strip the head skips names the element to move.
  const crowded = barLabel(50, 30);
  crowded.elements[0].x = 0.4;
  const margin = editorFor(crowded).evaluatePrintBlock();
  assert.equal(margin.reason, 'MARGIN_INK');
  assert.equal(margin.elementId, 'bar');
  assert.match(read('index.wxml'), /wx:if="\{\{printBlock\.elementId\}\}" bindtap="focusPrintElement"/);
});

test('the print sheet notes the blank edges a slightly wider label loses', () => {
  useWx();
  const wide = editorFor(barLabel(50, 30));
  wide.openPrintSheet();
  assert.equal(wide.data.printBlock, null);
  assert.equal(wide.data.printAreaNote, '标签比打印头略宽，两侧空白处不会打印');

  const fits = editorFor(textLabel());
  fits.openPrintSheet();
  assert.equal(fits.data.printAreaNote, '');
  assert.match(read('index.wxml'), /wx:if="\{\{printAreaNote\}\}" class="print-note"/);
});

function batchDesign() {
  return label(40, 30, (documentValue) => {
    const name = createElement('text', documentValue);
    Object.assign(name, { id: 'name', bindField: 'name', x: 2, y: 2, width: 30, height: 6 });
    const code = createElement('barcode', documentValue);
    Object.assign(code, { id: 'code', bindField: 'code', x: 2, y: 12, width: 30, height: 8 });
    return [name, code];
  });
}

test('batch preflight names the data row that cannot print', () => {
  useWx();
  const editor = editorFor(batchDesign(), { profile: getProfile('escpos-58') });
  editor.batch = {
    source: 'data',
    rows: [
      { name: '甲', code: 'A1' },
      { name: '乙', code: 'B-0000000000-0000000000-0000000000' }
    ]
  };
  editor.openPrintSheet();
  assert.equal(editor.data.printBlock.kind, 'batch');
  assert.match(editor.data.printBlock.message, /^第 2 行无法生成：条码太密/);
  const code = editor.document.elements.find((item) => item.type === 'barcode');
  assert.equal(editor.data.printBlock.elementId, code.id, 'the sheet can jump to the code in the design');

  editor.batch.rows = [{ name: '甲', code: 'A1' }, { name: ' ', code: 'B2' }];
  editor.openPrintSheet();
  assert.equal(editor.data.printBlock.message, '第 2 行：名称是空的，请在批量数据里填上这一格');
  assert.equal(editor.data.printBlock.elementId, '', 'the fix is in the data, not in the design');

  editor.batch.rows = [{ name: '甲', code: 'A1' }, { name: '乙', code: 'B2' }];
  editor.openPrintSheet();
  assert.equal(editor.data.printBlock, null);

  // A placeholder left in the design is fixed in the design, for every row.
  const note = createElement('text', editor.document);
  Object.assign(note, { id: 'note', x: 2, y: 22, width: 20, height: 5 });
  editor.document.elements.push(note);
  editor.openPrintSheet();
  assert.equal(editor.data.printBlock.message, '第 1 行：还有文字没改，请改成你要的内容，或者删掉这个文本框');
  assert.equal(editor.data.printBlock.elementId, 'note');

  // Paper that does not fit is the same for every row, so no row is named.
  const huge = batchDesign();
  huge.widthMm = 60;
  huge.heightMm = 40;
  const wide = editorFor(huge, { profile: getProfile('escpos-58') });
  wide.batch = { source: 'data', rows: [{ name: '甲', code: 'A1' }] };
  wide.openPrintSheet();
  assert.equal(
    wide.data.printBlock.message,
    '58mm 打印机只能装宽度不超过 58 mm 的标签纸，当前标签 60×40 mm 放不进去。请换成适合这台打印机的尺寸或模板。'
  );
});

test('batch printing sends one label per row and records the whole batch', async () => {
  useWx();
  const printer = fakePrinter();
  const rendered = [];
  const prepared = [];
  const runs = [];
  const editor = editorFor(batchDesign(), {
    connectionManager: fakeManager(SYD58),
    printer,
    createPrintImageData(documentValue, profile, images, threshold) {
      rendered.push([documentValue.name, threshold]);
      return {};
    },
    async preparePrintImages(documentValue) {
      prepared.push(documentValue.elements.length);
      return {};
    }
  });
  editor.batch = { source: 'data', rows: [{ name: '甲', code: 'A1' }, { name: '', code: '', price: '' }, { name: '乙', code: 'B2' }] };
  editor.data.copies = 1;
  const service = editor.printJobService;
  const run = service.run.bind(service);
  service.run = (config) => { runs.push(config); return run(config); };

  await editor.startPrint();

  assert.equal(runs[0].document, undefined);
  assert.deepEqual(runs[0].documents.map((documentValue) => documentValue.name), ['甲', '乙']);
  assert.deepEqual(rendered, [['甲', 180], ['乙', 180]]);
  assert.deepEqual(prepared, [4], 'pictures and fonts of every row are prepared once, before printing');
  assert.equal(printer.prints.length, 2);
  assert.ok(editor.messages.includes('正在打印第 1/2 张'));
  assert.ok(editor.messages.includes('正在打印第 2/2 张'));
  assert.equal(editor.history[0].name, '甲 等 2 张');
  assert.equal(editor.history[0].message, '已完成 2 张');
  assert.equal(editor.data.printMessage, '打印完成');

  // With more copies a page carries every copy of its row.
  editor.data.copies = 2;
  editor.messages.length = 0;
  await editor.startPrint();
  assert.ok(editor.messages.includes('正在打印第 1-2/4 张'));
  assert.equal(editor.history[1].name, '甲 等 4 张');
  assert.equal(editor.history[1].message, '已完成 4 张');
});

test('a batch row problem shows before connecting and never prints', async () => {
  useWx();
  const printer = fakePrinter();
  let connects = 0;
  const manager = fakeManager(SYD58);
  manager.ensureReady = () => { connects += 1; return Promise.resolve(Object.assign({}, SYD58)); };
  const editor = editorFor(batchDesign(), { connectionManager: manager, printer, profile: getProfile('escpos-58') });
  editor.batch = { source: 'data', rows: [{ name: '甲', code: 'B-0000000000-0000000000-0000000000' }] };
  await editor.startPrint();
  assert.equal(connects, 0);
  assert.equal(printer.prints.length, 0);
  assert.match(editor.data.printBlock.message, /^第 1 行无法生成：/);
  assert.equal(editor.data.printing, false);
});

test('the editor opens in batch mode from the data page and can leave it', (t) => {
  const values = new Map();
  global.wx = {
    getWindowInfo: () => ({ windowWidth: 390, pixelRatio: 3 }),
    getStorageSync: (key) => (values.has(key) ? structuredClone(values.get(key)) : ''),
    setStorageSync: (key, value) => values.set(key, structuredClone(value)),
    removeStorageSync: (key) => values.delete(key)
  };
  const repository = new Repository(wx);
  new EditorSession(repository).stage(batchDesign(), '', {
    batch: { source: 'data', rows: [{ name: '甲', code: 'A1' }, { name: '乙', code: 'B2' }, { name: '', code: '' }] }
  });
  global.getApp = () => ({ globalData: { repository, bleSession: { onConnectionStateChange: () => () => {} }, printerClient: {} } });
  t.after(() => { delete global.getApp; });
  const editor = editorFor(null, { data: structuredClone(pageDefinition.data) });
  editor.onLoad({});
  assert.equal(editor.data.loadError, '');
  assert.equal(editor.data.batchRowCount, 2);
  assert.equal(editor.batch.rows.length, 3);

  const wxml = read('index.wxml');
  assert.match(wxml, /批量打印：\{\{batchRowCount\}\} 行数据，每行打印 \{\{copies\}\} 张/);
  assert.match(wxml, /bindtap="exitBatch">退出批量/);
  assert.ok(wxml.indexOf('class="batch-banner"') > wxml.indexOf('class="template-attention"'));
  assert.match(wxml, /<text>批量数据<\/text><text>\{\{batchRowCount\}\} 行<\/text>/);
  assert.match(wxml, /\{\{batchRowCount \? '每行份数' : '打印份数'\}\}/);

  editor.exitBatch();
  assert.equal(editor.batch, null);
  assert.equal(editor.data.batchRowCount, 0);
  assert.equal(repository.getEditorAutosave().batch, null);
});

test('after numbered labels print, the next print can continue the numbers', async () => {
  const calls = useWx();
  const documentValue = label(40, 12, (value) => {
    const serial = createElement('serial', value);
    Object.assign(serial, { id: 'sn', prefix: 'A-', start: 1, step: 1, digits: 3, x: 2, y: 2, width: 20, height: 6 });
    return [serial];
  });
  const printer = fakePrinter();
  const editor = editorFor(documentValue, { connectionManager: fakeManager(SYD58), printer });
  editor.data.copies = 3;
  await editor.startPrint();

  assert.equal(printer.prints.length, 3);
  assert.equal(calls.modals.length, 1);
  const prompt = calls.modals[0];
  assert.equal(prompt.content, '已打印到 A-003。下次从 A-004 开始吗？');
  assert.deepEqual([prompt.confirmText, prompt.cancelText], ['接着编号', '保持不变']);
  assert.equal(calls.toasts.includes('打印完成'), false, 'the question already says the print finished');

  prompt.success({ confirm: false, cancel: true });
  assert.equal(editor.document.elements[0].start, 1);

  prompt.success({ confirm: true });
  assert.equal(editor.document.elements[0].start, 4);
  assert.equal(editor.undoStack.length, 1);
  editor.undo();
  assert.equal(editor.document.elements[0].start, 1, 'undo brings the old numbers back');
});

test('a batch never asks to continue serial numbers', async () => {
  const calls = useWx();
  const design = batchDesign();
  const serial = createElement('serial', design);
  Object.assign(serial, { id: 'sn', x: 34, y: 2, width: 5, height: 5 });
  design.elements.push(serial);
  const editor = editorFor(design, { connectionManager: fakeManager(SYD58), printer: fakePrinter() });
  editor.batch = { source: 'data', rows: [{ name: '甲', code: 'A1' }] };
  await editor.startPrint();
  assert.equal(editor.data.printMessage, '打印完成');
  assert.equal(calls.modals.length, 0);
});

test('leaving the page while printing asks first, only while the print runs', async () => {
  const alerts = [];
  const printer = fakePrinter();
  useWx({
    enableAlertBeforeUnload(options) { alerts.push(['enable', options.message, printer.prints.length]); },
    disableAlertBeforeUnload() { alerts.push(['disable', printer.prints.length]); }
  });
  const editor = editorFor(textLabel(), { connectionManager: fakeManager(SYD58), printer });
  await editor.startPrint();
  assert.deepEqual(alerts, [['enable', LEAVE_MESSAGE, 0], ['disable', 1]]);

  printer.print = async () => { throw new Error('打印机缺纸'); };
  await editor.startPrint();
  assert.deepEqual(alerts.slice(2), [['enable', LEAVE_MESSAGE, 1], ['disable', 1]]);

  // Without the API (older WeChat) printing still works.
  delete wx.enableAlertBeforeUnload;
  delete wx.disableAlertBeforeUnload;
  printer.print = fakePrinter().print;
  await editor.startPrint();
  assert.equal(printer.prints.length, 2);
});

test('an automatic reconnect reads as not connected and never blocks the picker', () => {
  useWx();
  const editor = editorFor(textLabel());
  editor.applyLinkState({ status: 'connecting', background: true, device: { deviceId: 'b1-1', name: 'B1' } });
  assert.deepEqual([editor.data.connectionState, editor.data.connectionLabel], ['disconnected', '未连接']);
  editor.openDevices();
  assert.equal(editor.data.showDevices, true);

  editor.applyLinkState({ status: 'connecting', background: false, device: { deviceId: 'b1-1', name: 'B1' } });
  assert.deepEqual([editor.data.connectionState, editor.data.connectionLabel], ['connecting', '连接中']);
  editor.applyLinkState({ status: 'connected', device: { deviceId: 'b1-1', name: 'B1-H1' } });
  assert.deepEqual([editor.data.connectionLabel, editor.data.connectedDevice], ['已连接', 'B1-H1']);

  editor.returnToPrintAfterConnect = true;
  editor.onHide();
  assert.equal(editor.data.showDevices, true, 'returning from Bluetooth settings finds the picker still open');
  assert.equal(editor.returnToPrintAfterConnect, true, 'the pending print survives a trip to settings');
});

test('the settings sheet opens the printer picker in place of the old diagnosis', () => {
  useWx();
  const editor = editorFor(textLabel());
  editor.data.showSettingsSheet = true;
  editor.openDevicesFromSettings();
  assert.equal(editor.data.showSettingsSheet, false);
  assert.equal(editor.data.showDevices, true);
  const wxml = read('index.wxml');
  assert.match(wxml, /bindtap="openDevicesFromSettings"><text class="icon icon-bluetooth" aria-hidden="true"><\/text>打印机连接<\/button>/);
  assert.match(wxml, /<text class="sheet-subtitle">连接打印机不会改动你设计的尺寸<\/text>/);
  assert.doesNotMatch(wxml, /运行连接诊断/);
});

test('print sheet wording, page data and sharing', () => {
  const wxml = read('index.wxml');
  const sheet = wxml.slice(wxml.indexOf('<block wx:if="{{showPrintSheet}}">'), wxml.indexOf('<block wx:if="{{showSettingsSheet}}">'));
  assert.match(sheet, /<text class="sheet-title">打印<\/text>/);
  for (const name of ['打印机', '打印机纸宽', '纸张类型', '浓度']) {
    assert.match(sheet, new RegExp(`<view[^>]*><text>${name}</text>`), name);
  }
  assert.doesNotMatch(sheet, /打印预览|机型参数|阈值/);
  assert.doesNotMatch(wxml, /MTU|GATT|候选|真机|协议/);

  const data = pageDefinition.data;
  assert.equal(data.contentFocus, false);
  assert.equal(data.panelScrollTarget, '');
  assert.deepEqual(data.fontLoading, {});
  assert.equal(data.batchRowCount, 0);
  assert.equal(data.printAreaNote, '');
  for (const removed of ['devices', 'scanning', 'connectedMtu', 'connectedDetails']) {
    assert.equal(Object.prototype.hasOwnProperty.call(data, removed), false, removed);
  }

  assert.deepEqual(pageDefinition.onShareAppMessage(), {
    title: '商跃标签：手机设计标签，蓝牙直接打印',
    path: '/pages/home/index'
  });
});

test('a printer that states its width never offers a size change for ink it cannot reach', () => {
  useWx();
  const manager = fakeManager({ deviceId: 'syd-1', name: 'SYD-58' });
  const edgeLabel = label(50, 30, (documentValue) => [
    Object.assign(createElement('rect', documentValue), { id: 'edge', x: 0, y: 4, width: 20, height: 4, filled: true })
  ]);
  const editor = editorFor(edgeLabel, { connectionManager: manager });
  editor.openPrintSheet();
  assert.equal(editor.data.printBlock.reason, 'MARGIN_INK');
  assert.equal(editor.data.printBlock.suggestProfileId, '', 'the name rules out another model');
  // Changing the label size cannot move ink out of a strip the head cannot reach.
  assert.equal(editor.data.printBlock.canResize, false);
  assert.equal(editor.data.printBlock.elementId, 'edge', 'the fix offered is editing that element');
  assert.match(editor.data.printBlock.message, /打不到/);
});

test('a template that cannot be read leaves the label and the undo stack alone', () => {
  const calls = useWx({ showModal(options) { calls.modals.push(options); } });
  const editor = editorFor(textLabel());
  const before = JSON.stringify(editor.document);

  editor.applyTemplate({ name: '坏模板', document: { widthMm: 0, heightMm: 0, elements: [] } });

  assert.match(calls.modals[0].title, /模板打不开/);
  assert.match(calls.modals[0].content, /没有套用/);
  assert.equal(JSON.stringify(editor.document), before, 'the open label is untouched');
  assert.equal(editor.undoStack.length, 0, 'nothing changed, so there is nothing to undo');
});

test('a template the table cannot fill ends batch mode', () => {
  const calls = useWx();
  const editor = editorFor(textLabel());
  editor.batch = { rows: [{ id: 'r1', name: '苹果' }], source: 'data' };
  editor.setData({ batchRowCount: 1 });

  // A design with only shapes has nothing a row can fill, so every row would
  // print the very same label.
  editor.applyTemplate({ name: '纯图形模板', document: barLabel(40, 30) });

  assert.equal(editor.batch, null);
  assert.equal(editor.data.batchRowCount, 0);
  assert.match(String(calls.toasts[calls.toasts.length - 1] || ''), /已退出批量打印/);
});

test('a template the table can fill keeps batch mode', () => {
  const calls = useWx();
  const editor = editorFor(textLabel());
  const batch = { rows: [{ id: 'r1', name: '苹果' }], source: 'data' };
  editor.batch = batch;
  editor.setData({ batchRowCount: 1 });

  editor.applyTemplate({ name: '文字模板', document: textLabel() });

  assert.equal(editor.batch, batch, 'one label per row still makes sense');
  assert.equal(editor.data.batchRowCount, 1);
  assert.equal(calls.toasts.length, 0);
});

test('a text box that reaches into the strip is judged by its pixels, not its box', async () => {
  global.wx = Object.assign(rasterWx(() => {}), { showToast() {} });
  const printer = fakePrinter();
  const wideText = label(50, 30, (documentValue) => [
    Object.assign(createElement('text', documentValue), {
      id: 'wide', x: 0, y: 10, width: 20, height: 6, text: '中', align: 'center'
    })
  ]);
  const editor = editorFor(wideText, {
    connectionManager: fakeManager(SYD58),
    printer,
    createPrintImageData: pageDefinition.createPrintImageData
  });

  // The box crosses the 1 mm strip; the glyphs inside it do not, so the label
  // is not blocked before printing.
  editor.openPrintSheet();
  assert.equal(editor.data.printBlock, null);
  await editor.startPrint();
  assert.equal(printer.prints.length, 1, 'blank strips print');
});

test('a text that really has ink in the strip still stops before printing', async () => {
  global.wx = Object.assign(rasterWx((image) => paint(image, 2, 50, [0, 0, 0, 255])), { showToast() {} });
  const printer = fakePrinter();
  const wideText = label(50, 30, (documentValue) => [
    Object.assign(createElement('text', documentValue), {
      id: 'wide', x: 0, y: 10, width: 20, height: 6, text: '中', align: 'center'
    })
  ]);
  const editor = editorFor(wideText, {
    connectionManager: fakeManager(SYD58),
    printer,
    createPrintImageData: pageDefinition.createPrintImageData
  });

  editor.openPrintSheet();
  assert.equal(editor.data.printBlock, null, 'the box alone does not block');
  await editor.startPrint();
  assert.equal(printer.prints.length, 0);
  assert.match(editor.data.printError, /打不到/);
});

test('a possibly printed failure asks before the same label goes out again', async () => {
  const calls = useWx({ showModal(options) { calls.modals.push(options); } });
  const printer = fakePrinter();
  const editor = editorFor(barLabel(40, 30), {
    connectionManager: fakeManager(SYD58), printer, createPrintImageData: pageDefinition.createPrintImageData
  });
  editor.setData({ printMayHavePrinted: true, connectedDevice: 'SYD-58' });

  // The red 开始打印 is replaced by a deliberate second step.
  assert.match(read('index.wxml'), /wx:elif="\{\{printMayHavePrinted\}\}"[^>]*bindtap="confirmReprint"/);
  await editor.confirmReprint();
  assert.equal(calls.modals.length, 1);
  assert.match(calls.modals[0].content, /可能已经有标签打出来/);
  assert.equal(printer.prints.length, 0, 'nothing goes out until the owner confirms');
});

test('an empty label tells the print sheet where the first element comes from', () => {
  useWx();
  const empty = label(40, 30);
  const editor = editorFor(empty, { connectionManager: fakeManager(SYD58) });
  editor.openPrintSheet();
  assert.equal(editor.data.printBlock.kind, 'empty');
  assert.equal(editor.data.printBlock.canAddElement, true);

  editor.closePrintAndAdd();
  assert.equal(editor.data.showPrintSheet, false);
  assert.equal(editor.data.editorPanelTab, 'elements');
  assert.match(read('index.wxml'), /wx:if="\{\{printBlock.canAddElement\}\}"[^>]*bindtap="closePrintAndAdd"/);
});
