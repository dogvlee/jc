const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createDocument, createElement } = require('../miniprogram/core/document');
const { getProfile } = require('../miniprogram/core/profiles');

let pageDefinition = null;
global.Page = (definition) => { pageDefinition = definition; };
require('../miniprogram/pages/editor/index');
delete global.Page;

function editorFor(documentValue, overrides) {
  return Object.assign({}, pageDefinition, {
    data: {},
    document: documentValue,
    images: {},
    multiSelect: false,
    projectId: '',
    redoStack: [],
    selectedId: '',
    selectedIds: [],
    undoStack: [],
    setData(patchValue, callback) {
      Object.assign(this.data, patchValue);
      if (callback) callback();
    }
  }, overrides || {});
}

function fakeContext() {
  const translations = [];
  return {
    translations,
    setTransform() {},
    clearRect() {},
    fillRect() {},
    save() {},
    translate(x, y) { translations.push([x, y]); },
    rotate() {},
    scale() {},
    restore() {},
    setLineDash() {},
    strokeRect() {},
    getImageData(x, y, width, height) { return { x, y, width, height, data: [] }; }
  };
}

test('portrait preview keeps the document aspect ratio without a height cap', () => {
  const documentValue = createDocument(12, 75);
  const editor = editorFor(documentValue);
  global.wx = {
    getWindowInfo() { return { windowWidth: 375, pixelRatio: 3 }; }
  };

  editor.syncPageData();

  const cssWidth = 375 * 672 / 750;
  assert.equal(editor.data.previewHeightPx, 2100);
  assert.equal(editor.data.previewHeightPx / cssWidth, 75 / 12);
  delete global.wx;
});

test('preview canvases use measured CSS pixels times devicePixelRatio', () => {
  const documentValue = createDocument(40, 100);
  const labelCanvas = { width: 0, height: 0, getContext() { return {}; } };
  const selectionCanvas = { width: 0, height: 0, getContext() { return {}; } };
  let rendered = 0;
  global.wx = {
    getWindowInfo() { return { windowWidth: 375, pixelRatio: 3 }; },
    createSelectorQuery() {
      return {
        in() { return this; },
        select() { return this; },
        fields() { return this; },
        exec(callback) {
          callback([
            { node: labelCanvas, width: 336, height: 840 },
            { node: selectionCanvas, width: 336, height: 840 }
          ]);
        }
      };
    }
  };
  const editor = editorFor(documentValue, {
    loadDocumentImages() { return []; },
    renderAll() { rendered += 1; }
  });

  editor.initCanvas();

  assert.deepEqual(editor.canvasSize, { width: 1008, height: 2520 });
  assert.equal(labelCanvas.width, 1008);
  assert.equal(labelCanvas.height, 2520);
  assert.equal(selectionCanvas.width, 1008);
  assert.equal(selectionCanvas.height, 2520);
  assert.equal(editor.previewPixelRatio, 3);
  assert.equal(editor.previewDpi, 1008 * 25.4 / 40);
  assert.deepEqual(editor.canvasRect, { width: 336, height: 840 });
  assert.deepEqual(editor.touchPoint({ touches: [{ x: 168, y: 420 }] }), { x: 20, y: 50 });
  assert.equal(rendered, 1);
  delete global.wx;
});

test('print raster stays on the printer profile dpi instead of preview dpi', () => {
  const documentValue = createDocument(40, 30);
  const rect = createElement('rect', documentValue);
  rect.x = 1;
  rect.y = 1;
  rect.width = 2;
  rect.height = 2;
  documentValue.elements = [rect];
  const context = fakeContext();
  let offscreenOptions = null;
  global.wx = {
    createOffscreenCanvas(options) {
      offscreenOptions = options;
      return { width: 0, height: 0, getContext() { return context; } };
    }
  };
  const editor = editorFor(documentValue, {
    previewDpi: 640,
    profile: getProfile('b1')
  });

  const imageData = editor.createPrintImageData(documentValue);

  assert.deepEqual(offscreenOptions, { type: '2d', width: 320, height: 240 });
  assert.equal(imageData.width, 320);
  assert.equal(imageData.height, 240);
  assert.ok(Math.abs(context.translations[0][0] - (2 * 203 / 25.4)) < 1e-9);
  assert.ok(Math.abs(context.translations[0][1] - (2 * 203 / 25.4)) < 1e-9);
  delete global.wx;
});

test('paper shell has no one-axis height clamp and tall canvases remain scrollable', () => {
  const stylesheet = fs.readFileSync(
    path.join(__dirname, '../miniprogram/pages/editor/index.wxss'),
    'utf8'
  );
  const paperRule = stylesheet.match(/\.paper-shell\s*\{([^}]*)\}/);
  assert.ok(paperRule);
  assert.doesNotMatch(paperRule[1], /(?:min|max)-height/);
  assert.match(stylesheet, /\.canvas-stage\s*\{[^}]*align-items:\s*flex-start/s);
  assert.match(paperRule[1], /margin-top:\s*auto/);
  assert.match(paperRule[1], /margin-bottom:\s*auto/);
});
