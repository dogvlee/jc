const { clampElement, createDocument } = require('../src/core/document');
const { snapElementPosition } = require('../src/core/geometry');

function moveElement(documentValue, element, deltaX) {
  element.x += deltaX;
  const others = documentValue.elements.filter((item) => item.id !== element.id);
  const snapped = snapElementPosition(element, documentValue, others, 0.45);
  element.x = snapped.x;
  element.y = snapped.y;
  clampElement(element, documentValue);
}

const documentValue = createDocument(50, 30);
const element = documentValue.elements[0];
Object.assign(element, { x: 2, y: 5, width: 16, height: 6 });

const before = element.x;
moveElement(documentValue, element, 8);
const after = element.x;
const dx = after - before;

const beforeLeft = element.x;
moveElement(documentValue, element, -6);
const afterLeft = element.x;
const leftDx = afterLeft - beforeLeft;

const result = {
  before,
  after,
  dx,
  beforeLeft,
  afterLeft,
  leftDx,
  pass: dx > 4 && leftDx < -4
};

console.log(JSON.stringify(result));
if (!result.pass) process.exitCode = 1;
