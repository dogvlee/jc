const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createDocument, createElement } = require('../miniprogram/core/document');
const { getProfile } = require('../miniprogram/core/profiles');
const { createImageCacheRegistry } = require('../miniprogram/core/image-cache');
const { resetFontLoader } = require('../miniprogram/core/font-loader');

let pageDefinition = null;
global.Page = (definition) => { pageDefinition = definition; };
require('../miniprogram/pages/editor/index');
delete global.Page;

const read = (file) => fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'editor', file), 'utf8');
const FONT_FAILURE = '字体下载失败，已先用系统字体显示，联网后可再试';

// A 40 x 20 mm label drawn on a 400 x 200 px canvas: 10 px per millimetre.
function editorFor(documentValue, overrides) {
  return Object.assign({}, pageDefinition, {
    canvasRect: { width: 400, height: 200 },
    // The page is open unless a test says otherwise; a picture import and the
    // autosave it triggers only run on a live page.
    pageActive: true,
    data: {},
    document: documentValue,
    selectedId: '',
    selectedIds: [],
    multiSelect: false,
    undoStack: [],
    redoStack: [],
    projectId: '',
    dirtySinceSave: false,
    canvasInits: 0,
    imageLoads: 0,
    renders: 0,
    persists: 0,
    setData(patch, callback) {
      Object.assign(this.data, patch);
      if (callback) callback();
    },
    syncPageData(callback) {
      const selected = this.selectedElement();
      this.setData({
        selected: selected ? Object.assign({}, selected) : null,
        projectId: this.projectId || ''
      }, callback);
    },
    persistDocument() { this.persists += 1; return true; },
    initCanvas() { this.canvasInits += 1; },
    loadDocumentImages() { this.imageLoads += 1; return []; },
    renderAll() { this.renders += 1; }
  }, overrides || {});
}

function labelWithText() {
  const document = createDocument(40, 20);
  const text = createElement('text', document);
  Object.assign(text, { id: 'title', x: 5, y: 5, width: 20, height: 8 });
  document.elements = [text];
  return { document, text };
}

function tap(editor, x, y) {
  editor.onCanvasTouchStart({ touches: [{ x, y }] });
  editor.onCanvasTouchEnd({ type: 'touchend', changedTouches: [{ x, y }] });
}

function fieldEvent(field, value) {
  return { currentTarget: { dataset: { field } }, detail: { value } };
}

async function settle(rounds = 4) {
  for (let index = 0; index < rounds; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test('a second tap on the selected text focuses its content field and scrolls the panel to it', () => {
  const { document } = labelWithText();
  const editor = editorFor(document, { data: { editorPanelTab: 'templates' } });

  tap(editor, 150, 90);
  assert.equal(editor.selectedId, 'title');
  assert.notEqual(editor.data.contentFocus, true, 'the first tap only selects');
  assert.equal(editor.data.panelScrollTarget, 'panel-tools', 'a new selection shows the inspector from the top');

  tap(editor, 150, 90);
  assert.equal(editor.data.contentFocus, true);
  assert.equal(editor.data.panelScrollTarget, 'content-field');
  assert.equal(editor.data.editorPanelTab, 'elements');

  // A tab switch re-creates the panel; it must not replay the old request.
  editor.setEditorPanelTab({ currentTarget: { dataset: { value: 'templates' } } });
  editor.setEditorPanelTab({ currentTarget: { dataset: { value: 'elements' } } });
  assert.equal(editor.data.contentFocus, false);
  assert.equal(editor.data.panelScrollTarget, '');
});

test('finger jitter under the drag threshold still counts as a tap', () => {
  const { document } = labelWithText();
  const editor = editorFor(document, { selectedId: 'title', selectedIds: ['title'] });

  editor.onCanvasTouchStart({ touches: [{ x: 150, y: 90 }] });
  editor.onCanvasTouchMove({ touches: [{ x: 153, y: 92 }] });
  editor.onCanvasTouchEnd({ type: 'touchend' });

  assert.equal(editor.data.contentFocus, true);
  assert.equal(editor.undoStack.length, 0);
});

test('dragging the selected element moves it without opening the keyboard', () => {
  const { document, text } = labelWithText();
  const editor = editorFor(document, { selectedId: 'title', selectedIds: ['title'] });

  editor.onCanvasTouchStart({ touches: [{ x: 150, y: 90 }] });
  editor.onCanvasTouchMove({ touches: [{ x: 190, y: 90 }] });
  editor.onCanvasTouchEnd({ type: 'touchend' });

  assert.notEqual(editor.data.contentFocus, true);
  assert.notEqual(text.x, 5);
  assert.equal(editor.undoStack.length, 1);
});

test('a repeat tap over overlapping elements cycles the selection instead of typing', () => {
  const { document } = labelWithText();
  const backdrop = createElement('rect', document);
  Object.assign(backdrop, { id: 'backdrop', x: 0, y: 0, width: 40, height: 20 });
  document.elements.unshift(backdrop);
  const editor = editorFor(document, { selectedId: 'title', selectedIds: ['title'] });

  tap(editor, 150, 90);

  assert.equal(editor.selectedId, 'backdrop');
  assert.notEqual(editor.data.contentFocus, true);
});

test('holding or cancelling a touch on the selected element does not open the keyboard', (t) => {
  const { document } = labelWithText();
  const editor = editorFor(document, { selectedId: 'title', selectedIds: ['title'] });
  let clock = 1000;
  t.mock.method(Date, 'now', () => clock);

  editor.onCanvasTouchStart({ touches: [{ x: 150, y: 90 }] });
  clock += 600;
  editor.onCanvasTouchEnd({ type: 'touchend' });
  assert.notEqual(editor.data.contentFocus, true, 'a long press is not a tap');

  editor.onCanvasTouchStart({ touches: [{ x: 150, y: 90 }] });
  editor.onCanvasTouchEnd({ type: 'touchcancel' });
  assert.notEqual(editor.data.contentFocus, true, 'a cancelled touch is not a tap');
});

test('only elements with a typed content field react to a repeat tap', () => {
  const cases = [
    ['text', {}, true],
    ['qrcode', {}, true],
    ['serial', {}, true],
    ['barcode', { serialLinked: true }, false],
    ['rect', {}, false],
    ['date', {}, false]
  ];
  for (const [type, patch, focuses] of cases) {
    const document = createDocument(40, 20);
    const element = Object.assign(createElement(type, document), { id: 'target', x: 5, y: 5, width: 20, height: 8, rotation: 0 }, patch);
    document.elements = [element];
    const editor = editorFor(document, { selectedId: 'target', selectedIds: ['target'] });
    tap(editor, 150, 90);
    assert.equal(editor.data.contentFocus === true, focuses, type);
  }
});

test('blurring the content field clears the focus request so the next tap can focus again', () => {
  const { document } = labelWithText();
  const editor = editorFor(document, { selectedId: 'title', selectedIds: ['title'] });

  tap(editor, 150, 90);
  editor.startFieldEdit(fieldEvent('text', ''));
  editor.previewField(fieldEvent('text', '新的文字'));
  editor.finishFieldEdit(fieldEvent('text', '新的文字'));
  assert.equal(editor.data.contentFocus, false);

  tap(editor, 150, 90);
  assert.equal(editor.data.contentFocus, true);
});

test('undo and redo redraw in place unless the label size changes', () => {
  const { document, text } = labelWithText();
  const originalText = text.text;
  const editor = editorFor(document, { selectedId: 'title', selectedIds: ['title'] });

  editor.commit((value) => { value.elements[0].text = '改后'; });
  editor.canvasInits = 0;
  editor.renders = 0;
  editor.imageLoads = 0;

  editor.undo();
  assert.equal(editor.document.elements[0].text, originalText);
  assert.equal(editor.canvasInits, 0, 'same-size undo must not flash the canvas loading state');
  assert.equal(editor.imageLoads, 1);
  assert.equal(editor.renders, 1);

  editor.redo();
  assert.equal(editor.document.elements[0].text, '改后');
  assert.equal(editor.canvasInits, 0);
  assert.equal(editor.renders, 2);

  editor.commit((value) => { value.widthMm = 50; }, true);
  editor.canvasInits = 0;
  editor.undo();
  assert.equal(editor.document.widthMm, 40);
  assert.equal(editor.canvasInits, 1, 'a different paper size needs the canvas measured again');
  editor.redo();
  assert.equal(editor.document.widthMm, 50);
  assert.equal(editor.canvasInits, 2);
});

test('undo brings back a deleted picture and loads it again without re-measuring the canvas', () => {
  const document = createDocument(40, 30);
  const picture = createElement('image', document);
  picture.path = 'wxfile://usr/photo.jpg';
  document.elements = [picture];
  const created = [];
  const editor = editorFor(document, {
    selectedId: picture.id,
    selectedIds: [picture.id],
    canvas: { createImage() { const image = {}; created.push(image); return image; } },
    images: {},
    imageLoadPromises: {},
    imageCache: createImageCacheRegistry(),
    loadDocumentImages: pageDefinition.loadDocumentImages
  });
  editor.loadDocumentImages();
  created[0].onload();
  assert.equal(editor.images[picture.id], created[0]);

  editor.deleteSelected();
  assert.equal(editor.images[picture.id], undefined);
  editor.canvasInits = 0;

  editor.undo();
  assert.equal(editor.canvasInits, 0);
  assert.equal(created.length, 2, 'the restored picture is requested again');
  created[1].onload();
  assert.equal(editor.images[picture.id], created[1]);
});

test('applying a template to a saved label starts a new label and undo restores the saved one', (t) => {
  const toasts = [];
  const modals = [];
  global.wx = {
    showToast(options) { toasts.push(options.title); },
    showModal(options) { modals.push(options.title); options.success({ confirm: true }); }
  };
  t.after(() => { delete global.wx; });
  const document = createDocument(40, 30);
  document.name = '已保存的标签';
  const templateDocument = createDocument(50, 30);
  templateDocument.elements = [createElement('text', templateDocument)];
  const editor = editorFor(document, {
    projectId: 'project-1',
    data: { templates: [{ id: 'tpl', name: '模板甲', document: templateDocument }] }
  });

  editor.loadTemplate({ detail: { value: 0 } });
  assert.deepEqual(modals, ['套用「模板甲」？'], 'replacing the label asks first');
  assert.equal(editor.document.name, '模板甲');
  assert.equal(editor.projectId, '');
  assert.equal(editor.data.projectId, '');
  assert.equal(editor.dirtySinceSave, true);
  assert.deepEqual(toasts, ['已套用模板，保存时会存成新标签']);

  editor.undo();
  assert.equal(editor.document.name, '已保存的标签');
  assert.equal(editor.projectId, 'project-1');
  assert.equal(editor.data.projectId, 'project-1');

  editor.redo();
  assert.equal(editor.document.name, '模板甲');
  assert.equal(editor.projectId, '');

  // Saving the template as its own label, then stepping back and forth,
  // keeps each document with the label it belongs to.
  editor.projectId = 'project-2';
  editor.undo();
  assert.equal(editor.projectId, 'project-1');
  editor.redo();
  assert.equal(editor.projectId, 'project-2');
});

test('ordinary undo keeps the current saved label', (t) => {
  global.wx = {
    showToast() { assert.fail('no template toast for an unsaved label'); },
    showModal(options) { options.success({ confirm: true }); }
  };
  t.after(() => { delete global.wx; });
  const { document } = labelWithText();
  const editor = editorFor(document, { selectedId: 'title', selectedIds: ['title'] });

  editor.commit((value) => { value.elements[0].text = '第一次'; });
  editor.projectId = 'saved-afterwards';
  editor.undo();
  assert.equal(editor.projectId, 'saved-afterwards');

  const templateDocument = createDocument(40, 20);
  editor.projectId = '';
  editor.data.templates = [{ id: 'tpl', name: '模板乙', document: templateDocument }];
  editor.loadTemplate({ detail: { value: 0 } });
  assert.equal(editor.projectId, '');
});

test('a failed font download is announced once and retried only from its chip', async (t) => {
  resetFontLoader();
  const toasts = [];
  let attempts = 0;
  global.wx = {
    loadFontFace(options) {
      attempts += 1;
      setImmediate(() => options.fail(new Error('offline')));
    },
    showToast(options) { toasts.push(options.title); }
  };
  t.after(() => { delete global.wx; resetFontLoader(); });
  const { document, text } = labelWithText();
  text.fontFamily = 'sy-heiti';
  const editor = editorFor(document, { selectedId: 'title', selectedIds: ['title'], paintCanvases() {} });

  editor.refreshLoadedFonts();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(editor.data.fontLoading, { 'sy-heiti': true });

  await settle();
  assert.deepEqual(editor.data.fontLoading, {});
  assert.deepEqual(toasts, [FONT_FAILURE]);

  editor.refreshLoadedFonts();
  editor.refreshLoadedFonts();
  await settle();
  assert.equal(attempts, 1, 'redraws do not retry a failed download');

  editor.setFontFamily({ currentTarget: { dataset: { value: 'sy-heiti' } } });
  await settle();
  assert.equal(attempts, 2, 'tapping the chip again retries');
  assert.deepEqual(toasts, [FONT_FAILURE], 'the failure is announced once per font');
  assert.equal(editor.undoStack.length, 0, 'retrying the applied font is not an edit');
});

test('a downloaded font repaints the label and a font already loaded never marks its chip', async (t) => {
  resetFontLoader();
  global.wx = {
    loadFontFace(options) { setImmediate(() => options.success()); },
    showToast() { assert.fail('no toast when the font loads'); }
  };
  t.after(() => { delete global.wx; resetFontLoader(); });
  const { document, text } = labelWithText();
  text.fontFamily = 'sy-song';
  let paints = 0;
  const editor = editorFor(document, { paintCanvases() { paints += 1; } });

  editor.refreshLoadedFonts();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(editor.data.fontLoading['sy-song'], true);
  await settle(8);
  assert.deepEqual(editor.data.fontLoading, {});
  assert.equal(paints, 1);

  const reopened = editorFor(document, { paintCanvases() { paints += 1; } });
  reopened.refreshLoadedFonts();
  await settle();
  assert.equal(reopened.data.fontLoading, undefined);
  assert.equal(paints, 1);
});

test('typing a title renames live and blur records a single undo step', () => {
  const document = createDocument(40, 30);
  document.name = '旧名字';
  const editor = editorFor(document);

  editor.previewDocumentName({ detail: { value: '新' } });
  editor.previewDocumentName({ detail: { value: '新名字' } });
  assert.equal(editor.document.name, '新名字');
  assert.equal(editor.undoStack.length, 0);
  assert.equal(editor.persists, 0);
  assert.equal(editor.dirtySinceSave, true);

  editor.updateDocumentName({ detail: { value: '新名字' } });
  assert.equal(editor.document.name, '新名字');
  assert.equal(editor.undoStack.length, 1);
  assert.equal(editor.undoStack[0].name, '旧名字');
  assert.equal(editor.persists, 1);

  editor.undo();
  assert.equal(editor.document.name, '旧名字');
});

test('typing a title and changing it back leaves no history and no unsaved flag', () => {
  const document = createDocument(40, 30);
  document.name = '原名';
  const editor = editorFor(document);

  editor.previewDocumentName({ detail: { value: '' } });
  assert.equal(editor.document.name, '原名', 'an emptied field never leaves a blank name behind');
  editor.previewDocumentName({ detail: { value: '原名' } });
  editor.updateDocumentName({ detail: { value: '原名' } });

  assert.equal(editor.undoStack.length, 0);
  assert.equal(editor.persists, 0);
  assert.equal(editor.dirtySinceSave, false);
});

test('leaving the page before the title blurs still keeps the new name', async () => {
  const document = createDocument(40, 30);
  document.name = '旧名字';
  let persistedName = '';
  const editor = editorFor(document, {
    pageActive: true,
    devicePickerGeneration: 0,
    printTaskGeneration: 0,
    printer: { printing: false },
    ownsSession: false,
    persistDocument() { persistedName = this.document.name; return true; }
  });

  editor.previewDocumentName({ detail: { value: '离开前改的名' } });
  await editor.onUnload();

  assert.equal(persistedName, '离开前改的名');
  assert.equal(editor.dirtySinceSave, true);
});

test('choosing a photo asks WeChat for the compressed version', (t) => {
  let options = null;
  global.wx = { chooseMedia(value) { options = value; } };
  t.after(() => { delete global.wx; });

  editorFor(createDocument(40, 30)).chooseImage();

  assert.deepEqual(options.sizeType, ['compressed']);
  assert.deepEqual(options.mediaType, ['image']);
});

test('dragging paints at most once per frame and updates the inspector when the finger lifts', () => {
  const { document, text } = labelWithText();
  const frames = [];
  const paints = [];
  const editor = editorFor(document, {
    selectedId: 'title',
    selectedIds: ['title'],
    canvas: { requestAnimationFrame(callback) { frames.push(callback); } },
    paintCanvases(options) { paints.push(options || null); }
  });

  editor.onCanvasTouchStart({ touches: [{ x: 150, y: 90 }] });
  assert.deepEqual(paints, [null], 'the touch paints at once');
  editor.onCanvasTouchMove({ touches: [{ x: 170, y: 90 }] });
  editor.onCanvasTouchMove({ touches: [{ x: 190, y: 95 }] });
  editor.onCanvasTouchMove({ touches: [{ x: 210, y: 100 }] });
  assert.equal(frames.length, 1, 'three moves share one frame');
  assert.equal(editor.data.selected.x, 5, 'the inspector waits for the finger to lift');
  frames[0]();
  assert.deepEqual(paints, [null, { interactive: true }]);

  const renders = editor.renders;
  editor.onCanvasTouchEnd({ type: 'touchend' });
  assert.notEqual(text.x, 5);
  assert.equal(editor.data.selected.x, text.x);
  assert.equal(editor.renders, renders + 1, 'one exact paint when the finger lifts');
  assert.equal(editor.undoStack.length, 1);
  // A frame still queued after the finger lifted paints nothing.
  editor.onCanvasTouchStart({ touches: [{ x: 150, y: 90 }] });
  editor.onCanvasTouchMove({ touches: [{ x: 200, y: 90 }] });
  editor.onCanvasTouchEnd({ type: 'touchend' });
  const before = paints.length;
  frames[1]();
  assert.equal(paints.length, before);
});

test('the bottom-right corner scales the selected text as a whole', () => {
  const { document, text } = labelWithText();
  const editor = editorFor(document, { selectedId: 'title', selectedIds: ['title'] });
  assert.equal(text.fontSize, 4);

  // The 20 x 8 mm box ends at (25, 13) mm = (250, 130) px.
  editor.onCanvasTouchStart({ touches: [{ x: 252, y: 132 }] });
  assert.equal(editor.drag.mode, 'scale');
  editor.onCanvasTouchMove({ touches: [{ x: 302, y: 152 }] });
  editor.onCanvasTouchEnd({ type: 'touchend' });

  assert.deepEqual([text.x, text.y, text.width, text.height, text.fontSize], [5, 5, 25, 10, 5]);
  assert.equal(editor.undoStack.length, 1);
});

test('touching an element sends only the selection to the page, not the whole label', () => {
  const { document } = labelWithText();
  const patches = [];
  let fullSyncs = 0;
  const editor = editorFor(document, {
    data: { layers: [{ id: 'title', _selected: false }] },
    setData(patch, callback) {
      patches.push(patch);
      Object.assign(this.data, patch);
      if (callback) callback();
    }
  });
  editor.syncPageData = () => { fullSyncs += 1; };

  editor.onCanvasTouchStart({ touches: [{ x: 150, y: 90 }] });

  assert.equal(fullSyncs, 0);
  const selection = patches.find((patch) => 'selected' in patch);
  assert.equal(selection.selected.id, 'title');
  assert.equal(selection['layers[0]._selected'], true);
  assert.equal('document' in selection, false);
});

function pictureWx(overrides) {
  const calls = { compress: null, copies: [], loading: [], hidden: 0, toasts: [] };
  const wx = Object.assign({
    env: { USER_DATA_PATH: 'wxfile://usr' },
    chooseMedia(options) { options.success({ tempFiles: [{ tempFilePath: 'wxfile://tmp/photo.jpg' }] }); },
    getImageInfo(options) { options.success({ width: 4000, height: 3000, type: 'jpeg', orientation: 'up' }); },
    compressImage(options) { calls.compress = options; options.success({ tempFilePath: 'wxfile://tmp/small.jpg' }); },
    getFileSystemManager() { return { copyFile(options) { calls.copies.push(options); options.success(); } }; },
    showLoading(options) { calls.loading.push(options.title); },
    hideLoading() { calls.hidden += 1; },
    showToast(options) { calls.toasts.push(options.title); }
  }, overrides || {});
  return { wx, calls };
}

function pictureCanvas(width, height, decoded) {
  return {
    createImage() {
      const image = { width, height };
      let source = '';
      Object.defineProperty(image, 'src', {
        get: () => source,
        set: (value) => {
          source = value;
          decoded.push(value);
          Promise.resolve().then(() => image.onload());
        }
      });
      return image;
    }
  };
}

test('a large photo is shrunk, framed in its own proportions and decoded only once', async (t) => {
  const { wx, calls } = pictureWx();
  global.wx = wx;
  t.after(() => { delete global.wx; });
  const decoded = [];
  const document = createDocument(40, 30);
  document.elements = [];
  const editor = editorFor(document, {
    images: {},
    imageLoadPromises: {},
    imageCache: createImageCacheRegistry(),
    canvas: pictureCanvas(1600, 1200, decoded)
  });

  editor.chooseImage();
  await settle();

  assert.equal(calls.compress.src, 'wxfile://tmp/photo.jpg');
  assert.equal(calls.compress.compressedWidth, 1600);
  assert.equal(calls.copies[0].srcPath, 'wxfile://tmp/small.jpg');
  const picture = document.elements.find((item) => item.type === 'image');
  assert.ok(picture);
  assert.equal(picture.path, calls.copies[0].destPath);
  assert.match(picture.path, /^wxfile:\/\/usr\/label-image-\d+\.jpg$/);
  assert.ok(Math.abs(picture.width / picture.height - 4 / 3) < 0.01);
  assert.equal(editor.selectedId, picture.id);
  assert.deepEqual(decoded, [picture.path]);
  assert.ok(editor.images[picture.id], 'the decoded picture is ready for the canvas');
  assert.deepEqual(calls.loading, ['正在处理图片']);
  assert.equal(calls.hidden, 1);
  assert.deepEqual(calls.toasts, []);
});

test('a PNG keeps its clear background and a replaced picture keeps its frame', async (t) => {
  const { wx, calls } = pictureWx({
    chooseMedia(options) { options.success({ tempFiles: [{ tempFilePath: 'wxfile://tmp/logo.png' }] }); },
    getImageInfo(options) { options.success({ width: 3000, height: 3000, type: 'png', orientation: 'up' }); }
  });
  global.wx = wx;
  t.after(() => { delete global.wx; });
  const document = createDocument(40, 30);
  const frame = Object.assign(createElement('image', document), { id: 'logo', x: 5, y: 5, width: 20, height: 10, path: 'wxfile://usr/old.png' });
  document.elements = [frame];
  const editor = editorFor(document, {
    selectedId: 'logo',
    selectedIds: ['logo'],
    images: {},
    imageLoadPromises: {},
    imageCache: createImageCacheRegistry(),
    canvas: pictureCanvas(3000, 3000, [])
  });

  editor.chooseImage({ currentTarget: { dataset: { replace: '1' } } });
  await settle();

  assert.equal(calls.compress, null, 'compressing would write a JPEG with a black background');
  assert.equal(calls.copies[0].srcPath, 'wxfile://tmp/logo.png');
  assert.match(frame.path, /\.png$/);
  assert.deepEqual([frame.x, frame.y, frame.width, frame.height], [10, 5, 10, 10]);
  assert.equal(document.elements.length, 1);
});

test('a picture that cannot be saved says so and closes the loading toast', async (t) => {
  const { wx, calls } = pictureWx({
    getFileSystemManager() { return { copyFile(options) { options.fail(new Error('disk full')); } }; }
  });
  global.wx = wx;
  t.after(() => { delete global.wx; });
  const document = createDocument(40, 30);
  const count = document.elements.length;
  const editor = editorFor(document, {
    pageActive: true, images: {}, imageLoadPromises: {}, imageCache: createImageCacheRegistry()
  });

  editor.chooseImage();
  await settle();

  assert.equal(document.elements.length, count);
  assert.deepEqual(calls.toasts, ['图片保存失败，请重新选择']);
  assert.equal(calls.hidden, 1);
});

test('a field left as it was adds no undo step and keeps the label saved', () => {
  const { document } = labelWithText();
  const editor = editorFor(document, { selectedId: 'title', selectedIds: ['title'] });

  editor.updateField(fieldEvent('x', '5'));
  editor.setAlignment({ currentTarget: { dataset: { value: document.elements[0].align } } });
  assert.equal(editor.undoStack.length, 0);
  assert.equal(editor.persists, 0);
  assert.equal(editor.dirtySinceSave, false);

  editor.updateField(fieldEvent('x', '6'));
  assert.equal(editor.undoStack.length, 1);
  assert.equal(editor.dirtySinceSave, true);
});

test('undo keeps the element selected', () => {
  const { document, text } = labelWithText();
  const editor = editorFor(document, { selectedId: 'title', selectedIds: ['title'] });

  editor.setAlignment({ currentTarget: { dataset: { value: text.align === 'center' ? 'left' : 'center' } } });
  editor.undo();
  assert.equal(editor.selectedId, 'title');
  assert.equal(editor.data.selected.id, 'title');
});

test('inspector numbers stay in the range a saved label keeps', (t) => {
  const toasts = [];
  global.wx = { showToast(options) { toasts.push(options.title); } };
  t.after(() => { delete global.wx; });
  const { document, text } = labelWithText();
  const editor = editorFor(document, { selectedId: 'title', selectedIds: ['title'] });

  editor.updateField(fieldEvent('fontSize', '60'));
  assert.equal(text.fontSize, 25);
  assert.deepEqual(toasts, ['已调整为可用范围：25']);
  editor.updateField(fieldEvent('fontSize', ''));
  assert.equal(text.fontSize, 25, 'an emptied field keeps the value');
  editor.updateField(fieldEvent('fontSize', '3.5'));
  assert.equal(text.fontSize, 3.5);
});

test('turning an element to 90 degrees and back gives its size back', () => {
  const document = createDocument(40, 30);
  const title = Object.assign(createElement('text', document), { id: 'title', x: 2, y: 12, width: 36, height: 6, rotation: 0 });
  document.elements = [title];
  const editor = editorFor(document, { selectedId: 'title', selectedIds: ['title'] });
  const slide = (value) => editor.updateSlider({ currentTarget: { dataset: { field: 'rotation' } }, detail: { value } });

  slide(90);
  assert.ok(title.width < 36, 'the turned title is shrunk to fit the label');
  slide(0);
  assert.deepEqual([title.x, title.y, title.width, title.height, title.rotation], [2, 12, 36, 6, 0]);
});

test('turning with the handle gives the size back within the same gesture', () => {
  const document = createDocument(40, 20);
  const bar = Object.assign(createElement('rect', document), { id: 'bar', x: 5, y: 5, width: 30, height: 8, rotation: 0 });
  document.elements = [bar];
  const editor = editorFor(document, { selectedId: 'bar', selectedIds: ['bar'] });

  // The rotate handle floats 2.6 mm above the top centre (20, 5) mm.
  editor.onCanvasTouchStart({ touches: [{ x: 200, y: 24 }] });
  assert.equal(editor.drag.mode, 'rotate');
  editor.onCanvasTouchMove({ touches: [{ x: 266, y: 90 }] });
  assert.equal(Math.round(bar.rotation), 90);
  assert.ok(bar.width < 30, 'a quarter turn does not fit the 20 mm label');
  editor.onCanvasTouchMove({ touches: [{ x: 200, y: 24 }] });
  editor.onCanvasTouchEnd({ type: 'touchend' });
  assert.deepEqual([bar.width, bar.height, bar.rotation], [30, 8, 0]);
});

test('a label of its own size opens the size list on that size', () => {
  const document = createDocument(70, 38);
  const editor = editorFor(document, { profile: getProfile('escpos-80') });

  editor.onSizeChange({ detail: { value: 0 } });
  assert.deepEqual([document.widthMm, document.heightMm], [70, 38], 'confirming the current size changes nothing');
  assert.equal(editor.undoStack.length, 0);
  editor.onSizeChange({ detail: { value: 1 } });
  assert.deepEqual([document.widthMm, document.heightMm], [40, 12]);
  assert.equal(editor.undoStack.length, 1);
});

test('a dragged element ends on tidy numbers', () => {
  const { document, text } = labelWithText();
  const editor = editorFor(document, { selectedId: 'title', selectedIds: ['title'] });

  editor.onCanvasTouchStart({ touches: [{ x: 150, y: 90 }] });
  editor.onCanvasTouchMove({ touches: [{ x: 163.37, y: 97.91 }] });
  editor.onCanvasTouchEnd({ type: 'touchend' });
  for (const field of ['x', 'y', 'width', 'height']) {
    assert.equal(text[field], Math.round(text[field] * 100) / 100, field);
  }
});

test('discarding asks once more, and only a real exit sends home to the data page', (t) => {
  const sheets = [];
  const modals = [];
  const stored = {};
  let backs = 0;
  global.wx = {
    showActionSheet(options) { sheets.push(options); },
    showModal(options) { modals.push(options); },
    setStorageSync(key, value) { stored[key] = value; },
    navigateBack() { backs += 1; }
  };
  t.after(() => { delete global.wx; });
  const { document } = labelWithText();
  let discarded = 0;
  const editor = editorFor(document, { dirtySinceSave: true, editorSession: { discard() { discarded += 1; } } });

  // 去批量打印, then the exit menu is dismissed: nothing is stored.
  editor.openDataManager();
  assert.equal(sheets.length, 1);
  assert.deepEqual(stored, {});

  // The plain close button; 放弃修改退出 asks before anything is lost.
  editor.closeEditor({ type: 'tap' });
  sheets[1].success({ tapIndex: 2 });
  assert.equal(modals.length, 1);
  assert.equal(modals[0].content, '这张标签还没保存过，放弃后就找不回来了。');
  assert.equal(discarded, 0);
  modals[0].success({ confirm: true });
  assert.equal(discarded, 1);
  assert.equal(backs, 1);
  assert.deepEqual(stored, {}, 'the data route was not asked for this time');

  // 去批量打印 that really exits stores the route.
  const second = editorFor(labelWithText().document, { dirtySinceSave: false });
  second.openDataManager();
  assert.equal(Object.values(stored)[0], 'data');
});

test('a decorative border can be taken off again', () => {
  const document = createDocument(40, 30);
  const box = Object.assign(createElement('rect', document), { id: 'box', borderStyle: 'double', decorativeBorder: true });
  document.elements = [box];
  const editor = editorFor(document, { selectedId: 'box', selectedIds: ['box'] });
  assert.ok(pageDefinition.selectionData.call(editor, box).selectedBorderLabel);

  editor.removeBorder();
  assert.equal(box.borderStyle, undefined);
  assert.equal(box.decorativeBorder, undefined);
  assert.equal(editor.undoStack.length, 1);
  assert.match(read('index.wxml'), /bindtap="removeBorder"/);
});

test('the layer list puts the top layer first and the page gets no element data', (t) => {
  global.wx = { getWindowInfo: () => ({ windowWidth: 375, windowHeight: 700, screenWidth: 375, pixelRatio: 2 }) };
  t.after(() => { delete global.wx; });
  const { document } = labelWithText();
  const box = Object.assign(createElement('rect', document), { id: 'box' });
  document.elements.push(box);
  const editor = editorFor(document, { selectedId: 'title', selectedIds: ['title'] });

  pageDefinition.syncPageData.call(editor);
  assert.deepEqual(editor.data.layers.map((item) => item.id), ['box', 'title']);
  assert.equal(editor.data.layers[1]._selected, true);
  assert.equal(editor.data.layers[1].name, document.elements[0].text);
  assert.deepEqual(Object.keys(editor.data.document).sort(), ['heightMm', 'name', 'widthMm']);
});

test('a canvas that does not show up offers a reload instead of loading forever', async (t) => {
  let queries = 0;
  global.wx = {
    createSelectorQuery() {
      const query = {
        in() { return query; },
        select() { return query; },
        fields() { return query; },
        exec(callback) { queries += 1; callback([null, null]); }
      };
      return query;
    }
  };
  t.after(() => { delete global.wx; });
  const { document } = labelWithText();
  const editor = editorFor(document, { pageActive: true });
  pageDefinition.initCanvas.call(editor);
  assert.equal(editor.data.canvasError, '', 'the first miss is retried quietly');
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.equal(queries, 2);
  assert.equal(editor.data.canvasError, '预览没加载出来');
  assert.match(read('index.wxml'), /bindtap="initCanvas">重新加载<\/button>/);
});

test('the panel puts a compact add strip above the inspector only while something is selected', () => {
  const wxml = read('index.wxml');
  const panel = wxml.slice(wxml.indexOf('<view class="editor-panel">'), wxml.indexOf('<view class="editor-actions">'));
  assert.match(panel, /class="panel-scroll"[^>]*scroll-into-view="\{\{panelScrollTarget\}\}"/);
  assert.match(panel, /<view wx:if="\{\{selected\}\}" id="panel-tools" class="tool-strip">/);
  assert.match(panel, /<view wx:else class="tool-grid">/);
  assert.match(panel, /class="tool-chip"[^>]*bindtap="addElement"/);
  assert.ok(panel.indexOf('id="panel-tools"') < panel.indexOf('class="inspector"'));
  assert.ok(panel.indexOf('class="inspector"') < panel.indexOf('class="panel-hint"'));
});

test('content fields carry the focus request and the scroll anchor', () => {
  const wxml = read('index.wxml');
  assert.equal((wxml.match(/id="content-field"/g) || []).length, 3);
  for (const field of ['text', 'value', 'prefix']) {
    const control = wxml.match(new RegExp(`<(?:textarea|input)[^>]*data-field="${field}"[^>]*>`));
    assert.ok(control, field);
    assert.match(control[0], /focus="\{\{contentFocus\}\}"/, field);
    assert.match(control[0], /bindblur="finishFieldEdit"/, field);
  }
  assert.doesNotMatch(wxml.match(/<input[^>]*data-field="suffix"[^>]*>/)[0], /\sfocus=/);
  assert.match(wxml, /再点一下改字/);
});

test('title, font chips and template panel use their new bindings and plain wording', () => {
  const wxml = read('index.wxml');
  assert.match(wxml, /class="document-title"[^>]*bindinput="previewDocumentName"[^>]*bindblur="updateDocumentName"/);
  assert.match(wxml, /class="chip font-chip [^"]*\{\{fontLoading\[item\.id\] \? 'loading' : ''\}\}/);
  assert.match(read('index.wxss'), /\.font-chip\.loading\s*\{[^}]*animation:/);
  // The template tab is a searchable list now, not a 70-item native wheel.
  assert.match(wxml, /class="search-box template-search"/);
  assert.match(wxml, /<input value="\{\{templateQuery\}\}" bindinput="onTemplateSearch"/);
  assert.match(wxml, /wx:for="\{\{templateCards\}\}"[^>]*bindtap="loadTemplate"/);
  assert.doesNotMatch(wxml, /<picker mode="selector" range="\{\{templateNames\}\}"/);
  assert.doesNotMatch(wxml, /来源待审/);
});

// Inspector-first budget for a 375 x 667 phone: the short-screen panel is
// 540rpx, of which tabs and the action bar take 208rpx. The add strip, the
// inspector heading and the whole 文字内容 field must fit in what is left.
test('on a short phone the text content field fits in the panel without scrolling', () => {
  const stylesheet = read('index.wxss');
  const LINE_HEIGHT = 1.4; // page line-height in app.wxss
  const rule = (source, selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = source.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`));
    assert.ok(match, `missing ${selector}`);
    return match[1];
  };
  const value = (body, property) => {
    const match = body.match(new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`));
    assert.ok(match, `missing ${property}`);
    return match[1].trim();
  };
  const rpx = (token) => (token === '0' ? 0 : Number(token.replace('rpx', '')));
  // Shorthand: one or two values repeat the first vertically; three or four
  // values list top, horizontal, bottom.
  const vertical = (shorthand) => {
    const parts = shorthand.split(/\s+/).map(rpx);
    return { top: parts[0], bottom: parts.length > 2 ? parts[2] : parts[0] };
  };

  const shortScreen = stylesheet.slice(stylesheet.indexOf('@media (max-height: 700px)'));
  const panelHeight = rpx(value(rule(shortScreen, '.editor-panel'), 'height'));
  const chrome = Number(value(rule(stylesheet, '.panel-scroll'), 'height').match(/(\d+)rpx/)[1]);

  const strip = vertical(value(rule(stylesheet, '.tool-strip'), 'padding'));
  const chipHeight = rpx(value(rule(stylesheet, 'button.tool-chip'), 'height'));
  const heading = vertical(value(rule(stylesheet, '.inspector-heading'), 'padding'));
  const actionHeight = rpx(value(rule(stylesheet, '.compact-actions button'), 'height'));
  const firstSectionTop = rpx(value(rule(stylesheet, '.inspector-heading + .property-section'), 'padding-top'));
  const label = vertical(value(rule(stylesheet, '.section-label'), 'margin'));
  const textArea = rpx(value(rule(stylesheet, '.text-area'), 'min-height'));

  const used = strip.top + chipHeight + strip.bottom + 1
    + heading.top + Math.max(actionHeight, 30 * LINE_HEIGHT) + heading.bottom + 1
    + firstSectionTop + label.top + 24 * LINE_HEIGHT + label.bottom + textArea;
  assert.ok(used <= panelHeight - chrome, `${used}rpx of ${panelHeight - chrome}rpx`);
});
