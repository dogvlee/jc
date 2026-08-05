const assert = require('node:assert/strict');
const test = require('node:test');

const { hitTest } = require('../miniprogram/core/document');

test('hitTest follows element rotation instead of using an unrotated box', () => {
  const document = {
    elements: [{ id: 'line', x: 4, y: 4, width: 8, height: 2, rotation: 90 }]
  };
  assert.equal(hitTest(document, 8, 8).id, 'line');
  assert.equal(hitTest(document, 11.5, 5), null);
});
