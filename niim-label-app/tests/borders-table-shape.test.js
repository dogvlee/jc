const test = require('node:test');
const assert = require('node:assert/strict');
const { createDocument, createElement } = require('../src/core/document');
const { renderDocument } = require('../src/core/renderer');
const { BORDER_CATALOG, BORDER_CHIPS, bordersForChip, borderById, drawBorderStyle } = require('../src/core/borders');

function mockContext() {
  const noop = () => {};
  return {
    lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
    strokeStyle: '#000', fillStyle: '#000', font: '10px sans-serif',
    textAlign: 'left', textBaseline: 'top', canvas: {},
    beginPath: noop, moveTo: noop, lineTo: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, arc: noop, ellipse: noop,
    closePath: noop, stroke: noop, fill: noop,
    save: noop, restore: noop, translate: noop, rotate: noop,
    rect: noop, fillRect: noop, clearRect: noop, strokeRect: noop,
    setTransform: noop, setLineDash: noop, scale: noop, clip: noop,
    fillText: noop, drawImage: noop, putImageData: noop, arcTo: noop,
    measureText: () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 })
  };
}

test('border catalog and chips (no VIP)', () => {
  assert.ok(BORDER_CATALOG.length >= 10);
  assert.ok(BORDER_CHIPS.includes('\u6700\u65b0'));
  assert.ok(BORDER_CHIPS.includes('\u70ed\u95e8'));
  assert.ok(!BORDER_CHIPS.includes('VIP'));
  assert.equal(borderById('double').id, 'double');
  const hot = bordersForChip('\u70ed\u95e8');
  assert.ok(hot.length > 0);
  const q = bordersForChip('\u641c\u7d22', 'double');
  assert.ok(q.some((item) => item.id === 'double'));
});

test('drawBorderStyle all catalog entries', () => {
  const ctx = mockContext();
  for (const item of BORDER_CATALOG) {
    assert.doesNotThrow(() => drawBorderStyle(ctx, item.draw || item.id, 0, 0, 80, 40, 2));
  }
});

test('table defaults 3x2 empty cells lineWidth 0.4', () => {
  const doc = createDocument(50, 30);
  const el = createElement('table', doc);
  assert.equal(el.rows, 3);
  assert.equal(el.columns, 2);
  assert.equal(el.cells.length, 6);
  assert.ok(el.cells.every((c) => c === ''));
  assert.equal(el.lineWidth, 0.4);
  assert.ok(el.rowH > 0);
  assert.ok(el.colW > 0);
  assert.ok(el.strokeColor);
  assert.ok(el.textColor);
});

test('rect has borderStyle field', () => {
  const doc = createDocument(50, 30);
  const el = createElement('rect', doc);
  assert.equal(el.borderStyle, '');
  el.borderStyle = 'double';
  el.filled = false;
  doc.elements = [el];
  assert.doesNotThrow(() => renderDocument(mockContext(), doc, { width: 200, height: 120 }, 203, {}));
});

test('drawTable uses strokeColor textColor bold align', () => {
  const doc = createDocument(50, 30);
  const el = createElement('table', doc);
  el.cells = ['A', 'B', 'C', 'D', 'E', 'F'];
  el.strokeColor = '#E53935';
  el.textColor = '#E53935';
  el.bold = true;
  el.italic = true;
  el.align = 'left';
  el.verticalAlign = 'top';
  el.fontSize = 3;
  doc.elements = [el];
  assert.doesNotThrow(() => renderDocument(mockContext(), doc, { width: 200, height: 120 }, 203, {}));
});

test('shape kinds render', () => {
  const doc = createDocument(50, 30);
  doc.elements = [];
  for (const kind of ['line', 'rounded', 'rect', 'ellipse', 'circle']) {
    const el = createElement(kind === 'line' ? 'line' : 'rect', doc);
    el.shapeKind = kind;
    el.dashed = kind === 'line';
    doc.elements.push(el);
  }
  assert.doesNotThrow(() => renderDocument(mockContext(), doc, { width: 200, height: 120 }, 203, {}));
});
