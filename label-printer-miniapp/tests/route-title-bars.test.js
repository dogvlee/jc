const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Every page of the home shell puts its title beside the WeChat capsule, as
// the home page does with its greeting (Figma 方案 B). The capsule covers the
// right end of that row, so only a back button on the left may share it.
const read = (name) => fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'home', name), 'utf8').replace(/\r\n/g, '\n');
const markup = read('index.wxml');
const style = read('index.wxss');

function block(route) {
  const open = `<block wx:if="{{route == '${route}'}}">`;
  const start = markup.indexOf(open);
  assert.ok(start >= 0, `${route} route is missing`);
  const next = markup.indexOf('<block wx:if="{{route == ', start + open.length);
  return markup.slice(start, next < 0 ? markup.length : next);
}

function bar(route) {
  const bars = block(route).match(/<view class="route-bar[^"]*" style="top: \{\{heroTop\}\}px; padding-right: \{\{capsuleInset\}\}px;">.*<\/view>/g) || [];
  assert.equal(bars.length, 1, `${route} has one title bar on the capsule row`);
  return bars[0];
}

function rule(selector) {
  const start = style.indexOf(`${selector} {`);
  assert.ok(start >= 0, selector);
  return style.slice(start, style.indexOf('}', start));
}

const zIndex = (source) => Number((source.match(/z-index: (\d+);/) || [])[1]);

test('the tab pages show their title beside the capsule and nothing else on that row', () => {
  const titles = {
    templates: /<text class="route-title">\{\{templateIndustry == '场景模板' \? '场景模板' : templateIndustry == '我的' \? '我的模板' : '商跃模板'\}\}<\/text>/,
    projects: /<text class="route-title">我的标签<\/text>/,
    profile: /<text class="route-title">我的<\/text>/
  };
  for (const [route, title] of Object.entries(titles)) {
    const row = bar(route);
    assert.match(row, title, route);
    assert.doesNotMatch(row, /<button/, `${route} keeps its buttons off the capsule row`);
  }
});

test('batch data has back and a two-line title on the capsule row, like the editor header', () => {
  const row = bar('data');
  assert.match(row, /^<view class="route-bar sub"/);
  assert.equal((row.match(/<button/g) || []).length, 1, 'only 返回 shares the row');
  assert.match(row, /<button class="circle-button back-button" data-route="profile" bindtap="navigate" aria-label="返回我的"><text class="icon icon-chevron-left" aria-hidden="true"><\/text><\/button>/);
  assert.match(row, /<text class="route-name">批量数据<\/text><text class="route-note">填好表格，每一行打印一张标签<\/text>/);
  assert.ok(row.indexOf('back-button') < row.indexOf('route-name'), 'back comes first, on the left');
});

test('no page repeats its title under the capsule, and content starts right below the row', () => {
  for (const route of ['templates', 'projects', 'data', 'profile']) {
    assert.doesNotMatch(block(route), /plain-header|header-copy|header-lead/, `${route} has no second header under the capsule`);
  }
  const intro = /<view class="route-intro" style="padding-top: \{\{headerTop - (\d+)\}\}px;"><text class="plain-subtitle">/;
  assert.match(block('templates'), intro);
  assert.match(block('projects'), intro);
  assert.match(block('data'), /<view class="route-content data-content" style="padding-top: \{\{headerTop\}\}px;">/);
  assert.match(block('profile'), /<view class="profile-hero" style="padding-top: \{\{headerTop\}\}px;">/);
  // The strip that hides scrolled content ends above the subtitle, so it is visible at rest.
  const cover = Number(markup.match(/class="top-cover" style="height: \{\{headerTop - (\d+)\}\}px;"/)[1]);
  assert.ok(Number(block('templates').match(intro)[1]) < cover);
});

test('the buttons that sat beside the titles now sit beside what they act on', () => {
  const templates = block('templates');
  assert.match(templates, /<view class="search-row"><view class="search-box">.*?<\/view><button class="outline-button search-side" bindtap="importTemplateFile" aria-label="导入模板">/);
  assert.match(block('projects'), /<view class="search-row"><view class="search-box">.*?<\/view><button class="primary-small search-side" bindtap="createBlank">/);
  assert.match(block('data'), /<view class="data-toolbar">.*bindtap="importCsv".*bindtap="exportCsv".*bindtap="addDataRow"/);
  // The empty 我的模板 shelf offers the import itself instead of pointing at a top-right button.
  assert.doesNotMatch(markup, /右上角「导入模板」/);
  assert.match(templates, /还没有我的模板[\s\S]*?<button class="outline-button btn-m" bindtap="importTemplateFile">/);
});

test('the title bars are fixed on the capsule row, above the top cover and below the sheets', () => {
  const barRule = rule('.route-bar');
  assert.match(barRule, /position: fixed;/);
  assert.match(barRule, /height: 44px;/, 'heroTop is the top of a 44px row centred on the capsule');
  assert.ok(zIndex(barRule) > zIndex(rule('.top-cover')), 'the title stays above the strip that hides scrolled content');
  assert.ok(zIndex(barRule) < zIndex(rule('.modal-layer')), 'sheets still cover the title');
  assert.match(rule('.route-title'), /text-overflow: ellipsis;/);
  assert.match(rule('.route-name,\n.route-note'), /text-overflow: ellipsis;/);
});
