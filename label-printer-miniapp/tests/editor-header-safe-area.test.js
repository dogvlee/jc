const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let pageDefinition = null;
global.Page = (definition) => { pageDefinition = definition; };
require('../miniprogram/pkg-editor/pages/editor/index');
delete global.Page;

test('custom editor controls reserve the WeChat capsule area', () => {
  global.wx = {
    getMenuButtonBoundingClientRect() {
      return { left: 280, right: 367, top: 28, bottom: 60 };
    }
  };
  assert.equal(pageDefinition.headerRightInset({ windowWidth: 375 }), 103);
  delete global.wx;
});

test('editor header inset has a compact fallback when capsule metrics are unavailable', () => {
  global.wx = {};
  assert.equal(pageDefinition.headerRightInset({ windowWidth: 375 }), 9);
  assert.equal(pageDefinition.headerRightInset({}, null), 9);
  delete global.wx;
});

test('editor header applies the computed inset to the custom navigation row', () => {
  const template = fs.readFileSync(
    path.join(__dirname, '../miniprogram/pkg-editor/pages/editor/index.wxml'),
    'utf8'
  );
  assert.match(template, /class="header-main"\s+style="padding-right: \{\{menuSafeRightPx\}\}px;"/);
});
