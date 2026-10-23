const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'editor', file), 'utf8');

// DevTools paints the 2D canvases above every sheet and ignores opacity and
// visibility. Sliding them off-screen keeps sheets readable, while their layout
// size stays measurable: initCanvas can run with a sheet open (size change,
// device connect), and a display:none canvas would measure 0 x 0.
test('editor canvases slide off-screen while any sheet is open', () => {
  const wxml = read('index.wxml');
  const binding = wxml.match(/class="paper-shell \{\{([^}]*)\? 'under-sheet' : ''\}\}"/);
  assert.ok(binding, '.paper-shell 需要在弹层打开时加上 under-sheet');
  const sheetFlags = [
    ...[...wxml.matchAll(/<block wx:if="\{\{(show[A-Za-z]+)\}\}">/g)].map((match) => match[1]),
    // The printer picker is a component that draws its own sheet.
    ...[...wxml.matchAll(/<printer-picker\b[^>]*\sshow="\{\{(show[A-Za-z]+)\}\}"/g)].map((match) => match[1])
  ];
  assert.ok(sheetFlags.length >= 6);
  assert.ok(sheetFlags.includes('showDevices'), '打印机选择弹层也要让画布让开');
  for (const flag of sheetFlags) {
    assert.match(binding[1], new RegExp(`\\b${flag}\\b`), `${flag} 打开时画布仍会盖住弹层`);
  }

  const rule = read('index.wxss').match(/\.paper-shell\.under-sheet[^{]*\{([^}]*)\}/);
  assert.ok(rule, '缺少 .paper-shell.under-sheet 样式');
  assert.match(rule[1], /transform:\s*translateX\(/);
  assert.doesNotMatch(rule[1], /display\s*:\s*none|visibility|opacity/);
});
