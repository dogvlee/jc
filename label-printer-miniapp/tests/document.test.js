const assert = require('node:assert/strict');
const test = require('node:test');

const { clampElement, createDocument, createElement, fitImageToPicture, hitTest, hitTestAll, placeNewElement } = require('../miniprogram/core/document');

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

test('a new picture frame takes the photo proportions and up to 60% of the label', () => {
  const label = createDocument(40, 30);
  const wide = fitImageToPicture(createElement('image', label), 1600, 1200, label, false);
  assert.deepEqual([wide.width, wide.height], [24, 18]);
  const tall = fitImageToPicture(createElement('image', label), 900, 1600, label, false);
  assert.equal(tall.height, 18);
  assert.ok(Math.abs(tall.width / tall.height - 900 / 1600) < 0.01);
  // A tiny label never gets a frame larger than the label minus a margin.
  const small = createDocument(20, 10);
  const squeezed = fitImageToPicture(createElement('image', small), 1000, 1000, small, false);
  assert.ok(squeezed.width <= 18 && squeezed.height <= 8);
  // Unknown proportions keep the default frame.
  const unknown = fitImageToPicture(createElement('image', label), 0, 0, label, false);
  assert.deepEqual([unknown.width, unknown.height], [15, 15]);
});

test('a replaced picture fits inside its old frame around the same centre', () => {
  const label = createDocument(40, 30);
  const frame = Object.assign(createElement('image', label), { x: 5, y: 5, width: 20, height: 10 });
  fitImageToPicture(frame, 500, 500, label, true);
  assert.deepEqual([frame.x, frame.y, frame.width, frame.height], [10, 5, 10, 10]);
});

test('clamping an element that already fits leaves every value exactly as it was', () => {
  const label = createDocument(50, 30);
  // Values whose centre lands off the binary grid are where a round trip drifts.
  const boxes = [
    [3.3, 2.7, 17.7, 9.9],
    [0.1, 0.2, 12.34, 7.89],
    [11.11, 6.66, 20.02, 12.5],
    [7.77, 3.33, 9.99, 4.44]
  ];
  boxes.forEach(([x, y, width, height], index) => {
    const element = Object.assign(createElement('rect', label), { id: `box-${index}`, x, y, width, height });
    const before = JSON.stringify(element);
    clampElement(element, label);
    // An element that fits must not move by a floating-point hair: commit()
    // compares before/after, and a hair becomes a phantom undo step.
    assert.equal(JSON.stringify(element), before, `in-bounds box ${index} stayed put`);
    clampElement(element, label);
    assert.equal(JSON.stringify(element), before, `second clamp of box ${index} is identical`);
  });
});

test('clamping still pulls an element that hangs off the label back inside', () => {
  const label = createDocument(50, 30);
  const element = Object.assign(createElement('rect', label), { x: 44, y: 0, width: 20, height: 6 });
  clampElement(element, label);
  assert.ok(element.x + element.width <= 50 + 1e-6);
  assert.ok(Math.abs(element.x - 30) < 1e-6, 'moved flush against the right edge');
});
