const test = require('node:test');
const assert = require('node:assert/strict');

const { createDocument, createElement } = require('../miniprogram/core/document');
const {
  clampGroupDelta,
  selectionHandleModeAtPoint
} = require('../miniprogram/core/geometry');

let pageDefinition = null;
global.Page = (definition) => { pageDefinition = definition; };
require('../miniprogram/pages/editor/index');
delete global.Page;

test('group translation clamps once and preserves spacing at the label edge', () => {
  const originals = [
    { x: 25, y: 2, width: 4, height: 4, rotation: 0 },
    { x: 33, y: 8, width: 4, height: 4, rotation: 0 }
  ];
  const delta = clampGroupDelta(originals, { widthMm: 40, heightMm: 20 }, { x: 10, y: 1 });
  assert.deepEqual(delta, { x: 3, y: 1 });
  assert.equal((originals[1].x + delta.x) - (originals[0].x + delta.x), 8);
});

test('group translation uses the visual bounds of a 90-degree element', () => {
  const delta = clampGroupDelta(
    [{ x: 30, y: 3, width: 8, height: 2, rotation: 90 }],
    { widthMm: 40, heightMm: 20 },
    { x: 20, y: -20 }
  );
  assert.ok(Math.abs(delta.x - 5) < 1e-9);
  assert.ok(Math.abs(delta.y) < 1e-9);
});

test('selection handles keep a 44px-class touch target outside the element', () => {
  const element = { x: 10, y: 8, width: 10, height: 4, rotation: 0, locked: false };
  const document = { widthMm: 40, heightMm: 30 };
  const canvasRect = { width: 400, height: 300 };
  assert.equal(
    selectionHandleModeAtPoint(element, { x: 22, y: 10 }, document, canvasRect, 'touch'),
    'resize-e'
  );
  assert.equal(
    selectionHandleModeAtPoint(element, { x: 15, y: 14 }, document, canvasRect, 'touch'),
    'resize-s'
  );
  assert.equal(
    selectionHandleModeAtPoint(element, { x: 22, y: 14 }, document, canvasRect, 'touch'),
    'scale'
  );
  // The rotate handle floats 26 px (2.6 mm here) above the top centre.
  assert.equal(
    selectionHandleModeAtPoint(element, { x: 15, y: 5.4 }, document, canvasRect, 'touch'),
    'rotate'
  );
  assert.equal(
    selectionHandleModeAtPoint(element, { x: 16.5, y: 4.5 }, document, canvasRect, 'touch'),
    'rotate'
  );
  assert.equal(
    selectionHandleModeAtPoint(element, { x: 19.1, y: 10 }, document, canvasRect, 'touch'),
    'move'
  );
});

test('the rotate handle drops below an element that touches the top of the label', () => {
  const element = { x: 10, y: 0.5, width: 10, height: 4, rotation: 0, locked: false };
  const document = { widthMm: 40, heightMm: 30 };
  const canvasRect = { width: 400, height: 300 };
  // Above would be off the label, so the handle sits 2.6 mm under the box,
  // and it wins over the bottom stretch handle it overlaps.
  assert.equal(
    selectionHandleModeAtPoint(element, { x: 15, y: 7.1 }, document, canvasRect, 'touch'),
    'rotate'
  );
  assert.equal(
    selectionHandleModeAtPoint(element, { x: 15, y: 4.6 }, document, canvasRect, 'touch'),
    'resize-s'
  );
});

test('selection handle hit testing follows element rotation', () => {
  const element = { x: 10, y: 8, width: 10, height: 4, rotation: 90, locked: false };
  assert.equal(
    selectionHandleModeAtPoint(
      element,
      { x: 15, y: 17 },
      { widthMm: 40, heightMm: 30 },
      { width: 400, height: 300 },
      'touch'
    ),
    'resize-e'
  );
});

function editorFor(documentValue, selectedIds, multiSelect) {
  return Object.assign({}, pageDefinition, {
    canvasRect: { width: 400, height: 200 },
    data: {},
    document: documentValue,
    multiSelect,
    selectedId: selectedIds[selectedIds.length - 1] || '',
    selectedIds: selectedIds.slice(),
    setData(patch) { Object.assign(this.data, patch); },
    syncPageData(callback) { if (callback) callback(); },
    renderAll() {}
  });
}

test('editor starts a resize from the selected handle outside strict hit bounds', () => {
  const document = createDocument(40, 20);
  const element = createElement('rect', document);
  Object.assign(element, { x: 10, y: 8, width: 10, height: 4 });
  document.elements = [element];
  const editor = editorFor(document, [element.id], false);

  editor.onCanvasTouchStart({ touches: [{ x: 220, y: 100 }] });

  assert.equal(editor.drag.mode, 'resize-e');
  assert.equal(editor.selectedId, element.id);
});

test('editor selects a sub-2mm element through its touch target and repeat-taps the overlap below it', () => {
  const document = createDocument(40, 20);
  const background = createElement('rect', document);
  const hairline = createElement('line', document);
  Object.assign(background, { id: 'background', x: 0, y: 0, width: 40, height: 20 });
  Object.assign(hairline, { id: 'hairline', x: 10, y: 9.8, width: 1, height: 0.4 });
  document.elements = [background, hairline];
  const editor = editorFor(document, [], false);

  // 1.8 mm below the visual hairline, but inside its 44 px-class touch area.
  editor.onCanvasTouchStart({ touches: [{ x: 105, y: 118 }] });
  editor.onCanvasTouchEnd();
  assert.equal(editor.selectedId, 'hairline');

  // A stationary re-tap at the overlap keeps drag available on pointer-down,
  // then advances one layer only when the finger lifts without moving.
  editor.onCanvasTouchStart({ touches: [{ x: 105, y: 100 }] });
  assert.equal(editor.selectedId, 'hairline');
  const beforeJitter = { x: hairline.x, y: hairline.y };
  editor.onCanvasTouchMove({ touches: [{ x: 109, y: 103 }] });
  assert.deepEqual({ x: hairline.x, y: hairline.y }, beforeJitter);
  editor.onCanvasTouchEnd();
  assert.equal(editor.selectedId, 'background');
});

test('tapping a content-fitted handle without dragging does not mutate the element', () => {
  const document = createDocument(40, 20);
  const element = createElement('text', document);
  Object.assign(element, { x: 5, y: 5, width: 20, height: 8 });
  Object.defineProperty(element, '_fit', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: { left: 0.25, top: 0.25, w: 0.5, h: 0.5 }
  });
  document.elements = [element];
  const editor = editorFor(document, [element.id], false);
  const originalGeometry = [element.x, element.y, element.width, element.height];

  editor.onCanvasTouchStart({ touches: [{ x: 220, y: 90 }] });

  assert.equal(editor.drag.mode, 'resize-e');
  assert.equal(editor.drag.promotedFit, true);
  assert.deepEqual(
    [editor.drag.original.x, editor.drag.original.y, editor.drag.original.width, editor.drag.original.height],
    [10, 7, 10, 4]
  );
  assert.deepEqual([element.x, element.y, element.width, element.height], originalGeometry);
  editor.onCanvasTouchEnd();
  assert.deepEqual([element.x, element.y, element.width, element.height], originalGeometry);
});

test('editor group drag keeps every element at the same relative distance', () => {
  const document = createDocument(40, 20);
  const first = createElement('rect', document);
  const second = createElement('rect', document);
  Object.assign(first, { x: 25, y: 2, width: 4, height: 4 });
  Object.assign(second, { x: 33, y: 8, width: 4, height: 4 });
  document.elements = [first, second];
  const editor = editorFor(document, [first.id, second.id], true);

  editor.onCanvasTouchStart({ touches: [{ x: 350, y: 100 }] });
  editor.onCanvasTouchMove({ touches: [{ x: 450, y: 100 }] });

  assert.equal(editor.drag.mode, 'group');
  assert.equal(second.x + second.width, 40);
  assert.equal(second.x - first.x, 8);
});
