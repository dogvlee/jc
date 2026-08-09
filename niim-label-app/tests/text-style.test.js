const test = require('node:test');
const assert = require('node:assert/strict');

const { resetTextStyle } = require('../src/core/text-style');

test('resetTextStyle restores all text-facing defaults and preserves content', () => {
  const element = {
    type: 'text',
    text: '保留内容',
    x: 7,
    y: 3,
    width: 22,
    height: 6,
    bold: true,
    underline: true,
    strike: true,
    italic: true,
    reverse: true,
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: 2,
    lineSpacing: 1,
    autoFit: false,
    wordWrap: true,
    color: '#E53935',
    align: 'right',
    verticalAlign: 'bottom',
    direction: 'vertical'
  };

  resetTextStyle(element);

  assert.deepEqual(element, {
    type: 'text',
    text: '保留内容',
    x: 7,
    y: 3,
    width: 22,
    height: 6,
    bold: false,
    underline: false,
    strike: false,
    italic: false,
    reverse: false,
    fontFamily: 'sans-serif',
    fontSize: 4,
    letterSpacing: 0,
    lineSpacing: 0,
    autoFit: true,
    wordWrap: false,
    color: '#000000',
    align: 'left',
    verticalAlign: 'middle',
    direction: 'horizontal',
    textMode: 'horizontal',
    textArcAngle: 180
  });
});

test('resetTextStyle restores the date default font size without changing date data', () => {
  const date = {
    type: 'date',
    label: '保质期至',
    baseTime: '2026-08-09T00:00:00.000Z',
    fontSize: 9,
    fontFamily: 'serif',
    autoFit: false
  };

  resetTextStyle(date);

  assert.equal(date.fontSize, 3.2);
  assert.equal(date.fontFamily, 'sans-serif');
  assert.equal(date.autoFit, true);
  assert.equal(date.label, '保质期至');
  assert.equal(date.baseTime, '2026-08-09T00:00:00.000Z');
});

test('resetTextStyle restores horizontal geometry after a vertical mode', () => {
  const documentValue = { widthMm: 50, heightMm: 30 };
  const element = {
    type: 'text',
    text: '方向',
    x: 19,
    y: 7,
    width: 6,
    height: 22,
    direction: 'vertical',
    textMode: 'vertical',
    directionLayout: { horizontalWidth: 22, horizontalHeight: 6 }
  };

  resetTextStyle(element, documentValue);

  assert.equal(element.direction, 'horizontal');
  assert.equal(element.textMode, 'horizontal');
  assert.equal(element.width, 22);
  assert.equal(element.height, 6);
  assert.equal(element.directionLayout, undefined);
});
