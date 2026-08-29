const test = require('node:test');
const assert = require('node:assert/strict');

const { renderSelection } = require('../miniprogram/core/renderer');

function fakeContext() {
  const arcs = [];
  const strokeRects = [];
  const noop = () => {};
  const context = {
    arcs,
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
    arc(x, y, radius) {
      arcs.push({ x, y, radius });
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
});

test('selection chrome scales fixed pixels for a high-DPR preview canvas', () => {
  const context = drawAtScale(3);

  assert.equal(context.strokeRects[0].lineWidth, 4.5);
  assert.equal(context.arcs[0].radius, 15);
});
