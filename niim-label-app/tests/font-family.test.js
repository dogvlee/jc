const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FONT_CATALOG,
  collectDocumentFontIds,
  fontFallbackInfo,
  listFontCatalog,
  normalizeElementFont,
  resolveFontFamily,
  resolveFontId
} = require('../src/core/font-family');

test('font resolver keeps generics and maps JingChen ids to OFL substitutes', () => {
  assert.equal(resolveFontFamily('sans-serif'), 'sans-serif');
  assert.equal(resolveFontFamily('SERIF'), 'serif');
  assert.equal(resolveFontFamily('monospace'), 'monospace');
  assert.equal(resolveFontId('思源宋体粗'), 'sy-song');
  assert.match(resolveFontFamily('思源宋体粗'), /Noto Serif SC/);
  assert.equal(resolveFontId('ZT201'), 'sy-heiti');
  assert.match(resolveFontFamily('ZT201'), /Noto Sans SC/);
  assert.equal(resolveFontId('Harmony'), 'sy-heiti');
  assert.equal(resolveFontId('ZT195'), 'sy-mashan');
  assert.doesNotMatch(resolveFontFamily('ZT201'), /ZT201/);
});

test('open-source catalog is OFL or system and never ships JingChen files', () => {
  const catalog = listFontCatalog();
  assert.equal(catalog.length, 23);
  assert.equal(new Set(catalog.map((font) => font.id)).size, catalog.length);
  assert.ok(catalog.every((font) => font.license === 'system' || font.license === 'OFL-1.1'));
  assert.ok(FONT_CATALOG.every((font) => !(font.files || []).some((file) => /zt\d+|harmonyos|niimbot/i.test(file.url))));
  assert.ok(FONT_CATALOG.filter((font) => !font.generic).every((font) => (
    font.coverage
      && /^https:\/\/github\.com\/google\/fonts\//.test(font.sourceUrl)
      && /\/OFL\.txt$/.test(font.licenseUrl)
      && (font.files || []).every((file) => /^https:\/\/cdn\.jsdelivr\.net\//.test(file.url))
  )));
  assert.ok(catalog.some((font) => font.id === 'sy-heiti'));
  assert.ok(catalog.some((font) => font.id === 'sy-mashan'));
  assert.ok(catalog.some((font) => font.id === 'sy-huangyou'));
  assert.ok(catalog.some((font) => font.id === 'sy-lubrifont-sc' && font.coverage === '简体中文'));
  assert.ok(catalog.some((font) => font.id === 'sy-wenkai-tc' && font.coverage === '繁体中文'));
  assert.ok(catalog.some((font) => font.id === 'sy-wenkai-mono-tc' && font.category === 'mono'));
});

test('expanded free-font aliases resolve to their own on-demand families', () => {
  assert.equal(resolveFontId('滑油字'), 'sy-lubrifont-sc');
  assert.equal(resolveFontId('霞鹜文楷 TC'), 'sy-wenkai-tc');
  assert.equal(resolveFontId('粉圆体'), 'sy-huninn');
  assert.equal(resolveFontId('仙人掌明体'), 'sy-cactus-serif');
  assert.match(resolveFontFamily('LXGW WenKai Mono TC'), /LXGW WenKai Mono TC/);
});

test('normalizing an unavailable source font preserves provenance and maps to an OFL substitute', () => {
  const element = { type: 'text', fontFamily: 'ZT201' };
  normalizeElementFont(element);
  assert.equal(element.fontFamily, 'sy-heiti');
  assert.equal(element.sourceFontFamily, 'ZT201');
  const info = fontFallbackInfo(element.fontFamily, element.sourceFontFamily);
  assert.equal(info.requested, 'ZT201');
  assert.equal(info.renderFamily, 'sy-heiti');
  assert.equal(info.fallback, true);
  assert.equal(info.label, '思源黑体');

  const native = { type: 'text', fontFamily: 'serif' };
  normalizeElementFont(native);
  assert.equal(native.fontFamily, 'serif');
  assert.equal(native.sourceFontFamily, undefined);
  assert.deepEqual(collectDocumentFontIds({ elements: [element, native] }).sort(), ['serif', 'sy-heiti']);
});
