const test = require('node:test');
const assert = require('node:assert/strict');

const { renderSelection } = require('../miniprogram/core/renderer');

function fakeContext() {
  const arcs = [];
  const rects = [];
  const strokeRects = [];
  const noop = () => {};
  const context = {
    arcs,
    rects,
    strokeRects,
    lineWidth: 1,
    setTransform: noop,
    clearRect: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    setLineDash: noop,
    fillRect: noop,
    beginPath: noop,
    fill: noop,
    stroke: noop,
    moveTo: noop,
    lineTo: noop,
    arc(x, y, radius) {
      arcs.push({ x, y, radius });
    },
    rect(x, y, width, height) {
      rects.push({ x, y, width, height });
    },
    strokeRect(x, y, width, height) {
      strokeRects.push({ x, y, width, height, lineWidth: context.lineWidth });
    }
  };
  return context;
}

function drawAtScale(displayScale) {
  const context = fakeContext();
  renderSelection(context, {
    id: 'shape-1',
    type: 'rect',
    x: 2,
    y: 3,
    width: 20,
    height: 8,
    rotation: 0,
    locked: false
  }, { width: 200, height: 100 }, 25.4, [], displayScale);
  return context;
}

test('selection chrome keeps its legacy pixel sizes when displayScale is omitted', () => {
  const context = drawAtScale(undefined);

  assert.equal(context.strokeRects[0].lineWidth, 1.5);
  assert.equal(context.arcs[0].radius, 5);
  // The corner scale handle is a square a little larger than the dots.
  assert.equal(context.rects[0].width, 12);
  assert.equal(context.rects[0].height, 12);
});

test('selection chrome scales fixed pixels for a high-DPR preview canvas', () => {
  const context = drawAtScale(3);

  assert.equal(context.strokeRects[0].lineWidth, 4.5);
  assert.equal(context.arcs[0].radius, 15);
  assert.equal(context.rects[0].width, 36);
});

test('selection chrome draws stretch dots, the corner scale square and a rotate handle', () => {
  const context = drawAtScale(1);
  // 25.4 dpi: one dot per millimetre, so the 20 x 8 box spans x -10..10, y -4..4
  // around its centre, and the rotate handle floats 26 dots from the box.
  const dots = context.arcs.filter((arc) => arc.radius === 5);
  assert.deepEqual(dots.map((arc) => [arc.x, arc.y]), [[10, 0], [0, 4]]);
  assert.deepEqual(context.rects.map((rect) => [rect.x + rect.width / 2, rect.y + rect.height / 2]), [[10, 4]]);
  const rotate = context.arcs.find((arc) => arc.radius === 6);
  assert.ok(rotate, 'the rotate handle is drawn');
  // The box is 3 mm from the label top, so the handle goes below it.
  assert.deepEqual([rotate.x, rotate.y], [0, 4 + 26]);

  const lower = fakeContext();
  renderSelection(lower, {
    id: 'shape-2', type: 'rect', x: 2, y: 40, width: 20, height: 8, rotation: 0, locked: false
  }, { width: 200, height: 100 }, 25.4, [], 1);
  const above = lower.arcs.find((arc) => arc.radius === 6);
  assert.deepEqual([above.x, above.y], [0, -4 - 26]);
});
