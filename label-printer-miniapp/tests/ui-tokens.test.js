const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mini = path.join(__dirname, '..', 'miniprogram');
const read = (file) => fs.readFileSync(path.join(mini, file), 'utf8');
const STYLE_FILES = ['app.wxss', 'pages/home/index.wxss', 'pages/editor/index.wxss'];
// Reds used before the design-token refresh; the brand primary is now #E02D26.
const LEGACY_REDS = /#(?:f44336|f4433b|ef433c|e53935|f13932|ff5b53|ff4b43|ee3e37|f24840|e23c31|e43f34|e54438)\b/i;

function pageBlock(source) {
  const match = source.match(/(?:^|\n)page\s*\{([^}]*)\}/);
  return match ? match[1] : null;
}

test('every CSS variable used by styles is defined on page in app.wxss', () => {
  const tokens = pageBlock(read('app.wxss'));
  assert.ok(tokens, 'app.wxss 需要 page {} 设计变量块');
  const defined = new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
  for (const file of STYLE_FILES) {
    for (const match of read(file).matchAll(/var\((--[a-z0-9-]+)/g)) {
      assert.ok(defined.has(match[1]), `${file} 使用了未定义的变量 ${match[1]}`);
    }
  }
  for (const name of ['--color-primary', '--color-bg', '--color-surface', '--color-text-1', '--color-text-3', '--radius-lg', '--space-5', '--gutter']) {
    assert.ok(defined.has(name), `缺少 ${name}`);
  }
  assert.match(tokens, /--color-primary:\s*#E02D26;/i);
});

test('legacy brand reds are gone from app and page sources', () => {
  const files = [...STYLE_FILES, 'app.json', 'pages/home/index.wxml', 'pages/editor/index.wxml', 'pages/home/index.js', 'pages/editor/index.js'];
  for (const file of files) {
    const hit = read(file).match(LEGACY_REDS);
    assert.ok(!hit, `${file} 仍含旧红色 ${hit && hit[0]}`);
  }
});

test('native slider, switch and confirm colors use the brand primary', () => {
  for (const file of ['pages/home/index.wxml', 'pages/editor/index.wxml']) {
    for (const match of read(file).matchAll(/(?:activeColor|color)="(#[0-9a-fA-F]{6})"/g)) {
      assert.equal(match[1].toUpperCase(), '#E02D26', `${file} ${match[0]}`);
    }
  }
  for (const file of ['pages/home/index.js', 'pages/editor/index.js']) {
    for (const match of read(file).matchAll(/confirmColor:\s*'(#[0-9a-fA-F]{6})'/g)) {
      assert.equal(match[1].toUpperCase(), '#E02D26', `${file} ${match[0]}`);
    }
  }
});

test('page stylesheets leave the global font and text color to app.wxss', () => {
  for (const file of ['pages/home/index.wxss', 'pages/editor/index.wxss']) {
    const block = pageBlock(read(file));
    if (block) assert.doesNotMatch(block, /font-family|(?:^|;)\s*color\s*:/, `${file} 不应覆盖全局字体和文字色`);
  }
});

test('buttons that carry text keep their label vertically centred', () => {
  const app = read('app.wxss');
  for (const selector of ['.primary-button', '.outline-button']) {
    const rule = app.match(new RegExp(`${selector.replace('.', '\\.')}[^{]*\\{([^}]*)\\}`));
    assert.ok(rule, `app.wxss 缺少 ${selector}`);
  }
  assert.match(app, /\.primary-button,[\s\S]*?\{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;/);
});
