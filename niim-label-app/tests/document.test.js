const assert = require('node:assert/strict');
const test = require('node:test');

const { clampElement, createDocument, createElement, hitTest, hitTestAll, placeNewElement } = require('../src/core/document');

test('hitTest follows element rotation instead of using an unrotated box', () => {
  const document = {
    elements: [{ id: 'line', x: 4, y: 4, width: 8, height: 2, rotation: 90 }]
  };
  assert.equal(hitTest(document, 8, 8).id, 'line');
  assert.equal(hitTest(document, 11.5, 5), null);
});

test('clampElement keeps a rotated visual box inside the label', () => {
  const document = { widthMm: 40, heightMm: 20 };
  const element = { x: 35, y: 14, width: 10, height: 4, rotation: 45 };
  clampElement(element, document);
  const angle = Math.PI / 4;
  const extentX = Math.abs(Math.cos(angle)) * element.width / 2 + Math.abs(Math.sin(angle)) * element.height / 2;
  const extentY = Math.abs(Math.sin(angle)) * element.width / 2 + Math.abs(Math.cos(angle)) * element.height / 2;
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  assert.ok(centerX + extentX <= document.widthMm + 1e-9);
  assert.ok(centerY + extentY <= document.heightMm + 1e-9);
});

test('clampElement preserves local dimensions when a quarter-turn fits the page', () => {
  const document = { widthMm: 12, heightMm: 40 };
  const element = { x: -1, y: 1, width: 38, height: 10, rotation: 90 };

  clampElement(element, document);

  assert.equal(element.width, 38);
  assert.equal(element.height, 10);
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  assert.ok(centerX - element.height / 2 >= -1e-9);
  assert.ok(centerX + element.height / 2 <= document.widthMm + 1e-9);
  assert.ok(centerY - element.width / 2 >= -1e-9);
  assert.ok(centerY + element.width / 2 <= document.heightMm + 1e-9);
});

test('hitTestAll gives a sub-2mm element an invisible minimum selection target', () => {
  const document = {
    elements: [
      { id: 'background', x: 0, y: 0, width: 40, height: 20, rotation: 0 },
      { id: 'hairline', x: 9.5, y: 9.8, width: 1, height: 0.4, rotation: 0 }
    ]
  };

  assert.equal(hitTest(document, 10, 11.8).id, 'background');
  assert.deepEqual(
    hitTestAll(document, 10, 11.8, { minWidthMm: 4, minHeightMm: 4 }).map((item) => item.id),
    ['hairline', 'background']
  );
});

test('hitTestAll returns every overlap in visual z-order for repeat-tap cycling', () => {
  const document = {
    elements: [
      { id: 'bottom', x: 5, y: 5, width: 10, height: 6, rotation: 0 },
      { id: 'middle', x: 5, y: 5, width: 10, height: 6, rotation: 0 },
      { id: 'top', x: 5, y: 5, width: 10, height: 6, rotation: 0 }
    ]
  };

  assert.deepEqual(hitTestAll(document, 10, 8).map((item) => item.id), ['top', 'middle', 'bottom']);
});

test('placeNewElement keeps new items visible and avoids an existing default text element', () => {
  const document = createDocument(50, 30);
  document.elements = [];
  const text = createElement('text', document);
  placeNewElement(text, document);
  document.elements.push(text);

  const date = createElement('date', document);
  placeNewElement(date, document);

  const overlapWidth = Math.max(0, Math.min(text.x + text.width, date.x + date.width) - Math.max(text.x, date.x));
  const overlapHeight = Math.max(0, Math.min(text.y + text.height, date.y + date.height) - Math.max(text.y, date.y));
  assert.equal(overlapWidth * overlapHeight, 0);
  assert.ok(date.x >= 0 && date.y >= 0);
  assert.ok(date.x + date.width <= document.widthMm);
  assert.ok(date.y + date.height <= document.heightMm);
});

