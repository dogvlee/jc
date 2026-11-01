const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { templates } = require('../miniprogram/app/catalog');
const { Repository } = require('../miniprogram/services/repository');
const { EditorSession } = require('../miniprogram/services/editor-session');

let pageDefinition = null;
global.Page = (definition) => { pageDefinition = definition; };
require('../miniprogram/pages/home/index');
delete global.Page;

const readHome = (name) => fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'home', name), 'utf8');
const tap = (dataset) => ({ currentTarget: { dataset } });

function memoryStorage() {
  const values = new Map();
  return {
    getStorageSync(key) { return values.has(key) ? structuredClone(values.get(key)) : ''; },
    setStorageSync(key, value) { values.set(key, structuredClone(value)); },
    removeStorageSync(key) { values.delete(key); }
  };
}

function setPath(target, key, value) {
  const parts = key.match(/[^.[\]]+/g);
  let node = target;
  parts.slice(0, -1).forEach((part, index) => {
    if (node[part] == null) node[part] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    node = node[part];
  });
  node[parts[parts.length - 1]] = value;
}

/** The template shelf of a home page over an empty in-memory store. */
function shelf() {
  const repository = new Repository(memoryStorage());
  repository.migrate();
  repository.saveSettings({ onboardingDone: true });
  const page = Object.assign({}, pageDefinition, {
    data: structuredClone(pageDefinition.data),
    repository,
    editorSession: new EditorSession(repository),
    setData(patch, callback) {
      Object.keys(patch).forEach((key) => setPath(this.data, key, patch[key]));
      if (callback) callback();
    }
  });
  page.refresh();
  page.navigate(tap({ route: 'templates' }));
  return page;
}

test('sub-category chips carry their counts and never lead to an empty shelf', () => {
  const page = shelf();
  for (const industry of ['全部'].concat(page.data.industries.filter((item) => item !== '全部'))) {
    page.setTemplateIndustry(tap({ value: industry }));
    const chips = page.data.categoryChips;
    assert.equal(chips[0].value, '全部', `${industry} starts with 全部`);
    assert.equal(chips[0].count, page.data.templateTotal);
    for (const chip of chips.slice(1)) {
      assert.ok(chip.count > 0, `${industry} offers ${chip.value} with nothing in it`);
      page.setTemplateCategory(tap({ value: chip.value }));
      assert.equal(page.data.visibleTemplates.length, Math.min(chip.count, 24), `${industry}/${chip.value}`);
      page.setTemplateCategory(tap({ value: '全部' }));
    }
  }
  // 实用功能 has only a few templates: most categories are not offered at all.
  page.setTemplateIndustry(tap({ value: '实用功能' }));
  assert.ok(page.data.categoryChips.length < page.data.categories.length);
});

test('the result line says what is filtered and how many cards are left', () => {
  const page = shelf();
  assert.equal(page.data.templateSummary, `共 ${page.data.templateTotal} 个模板`);
  assert.equal(page.data.templateFiltersActive, false);
  page.setTemplateCategory(tap({ value: '零售' }));
  const retail = templates.filter((item) => item.category === '零售').length;
  assert.equal(page.data.templateSummary, `零售 · 找到 ${retail} 个`);
  assert.equal(page.data.templateFiltersActive, true);
  page.resetTemplateFilters();
  assert.equal(page.data.templateFiltersActive, false);
  assert.equal(page.data.templateCategory, '全部');
});

test('scene templates show the paper-size filter they open with, and size chips with no templates are left out', () => {
  const page = shelf();
  page.setTemplateIndustry(tap({ value: '场景模板' }));
  // Default paper is 50×30: the shelf opens on it, and says so.
  assert.equal(page.data.librarySize, '50×30');
  assert.match(page.data.templateSummary, /^50×30 · 找到 \d+ 个$/);
  assert.equal(page.data.templateFiltersActive, true);
  for (const chip of page.data.sizeChips) {
    assert.ok(chip.count > 0 || chip.value === '全部' || chip.value === page.data.librarySize, `${chip.value} is a dead end`);
  }
  for (const chip of page.data.sceneChips) {
    assert.ok(chip.count > 0 || chip.value === '全部' || chip.value === page.data.libraryScene, `${chip.value} is a dead end`);
  }
});

test('a search inside one tile offers 搜全部, which keeps the words and looks everywhere', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const page = shelf();
  page.setTemplateIndustry(tap({ value: '实用功能' }));
  page.onTemplateSearch({ detail: { value: '价签' } });
  t.mock.timers.tick(300);
  assert.equal(page.data.templateQuery, '价签');
  assert.equal(page.data.templateSearchScope, true);
  assert.match(page.data.templateSummary, /“价签” · 找到 \d+ 个$/);
  page.searchAllTemplates();
  assert.equal(page.data.templateIndustry, '全部');
  assert.equal(page.data.templateQuery, '价签');
  assert.equal(page.data.templateSearchScope, false);
  assert.ok(page.data.visibleTemplates.length > 0);
  page.clearTemplateSearch();
  assert.equal(page.data.templateQuery, '');
  assert.equal(page.data.templateSummary, `共 ${page.data.templateTotal} 个模板`);
});

test('a suggested word from the empty shelf searches all templates at once', () => {
  const page = shelf();
  page.setTemplateIndustry(tap({ value: '实用功能' }));
  page.setTemplateCategory(tap({ value: '全部' }));
  page.useTemplateSuggestion(tap({ value: '效期' }));
  assert.equal(page.data.templateQuery, '效期');
  assert.equal(page.data.templateIndustry, '全部');
  assert.ok(page.data.visibleTemplates.length > 0);
  assert.ok(page.data.templateSuggestions.length >= 4);
});

test('reaching the end of the scene shelf loads the next cards, and only there', () => {
  const page = shelf();
  page.setTemplateIndustry(tap({ value: '场景模板' }));
  page.setLibrarySize(tap({ value: '全部' }));
  const first = page.data.visibleTemplates.length;
  assert.ok(page.data.templateTotal > first, 'the scene shelf is longer than one page');
  page.onReachBottom();
  assert.ok(page.data.visibleTemplates.length > first);
  page.navigate(tap({ route: 'projects' }));
  const loaded = page.data.visibleTemplates.length;
  page.onReachBottom();
  assert.equal(page.data.visibleTemplates.length, loaded, 'other routes do not load templates');
});

test('the printer filter is a switch of its own and the switch value is respected', () => {
  const page = shelf();
  page.setData({ printerFamily: '5', familyFilterOn: true });
  page.toggleFamilyFilter({ detail: { value: false } });
  assert.equal(page.data.familyFilterOn, false);
  page.toggleFamilyFilter({ detail: { value: true } });
  assert.equal(page.data.familyFilterOn, true);
  page.toggleFamilyFilter();
  assert.equal(page.data.familyFilterOn, false, 'a plain call still flips it');
  const markup = readHome('index.wxml');
  assert.match(markup, /<switch checked="\{\{familyFilterOn\}\}" bindchange="toggleFamilyFilter" color="#E02D26"/);
});

test('the shelf markup has the clear button, the result line, press feedback and the way back to the filters', () => {
  const markup = readHome('index.wxml');
  const shelfMarkup = markup.slice(markup.indexOf("<block wx:if=\"{{route == 'templates'}}\">"), markup.indexOf("<block wx:if=\"{{route == 'projects'}}\">"));
  assert.match(shelfMarkup, /<button wx:if="\{\{templateQuery\}\}" class="search-clear" bindtap="clearTemplateSearch" aria-label="清除搜索">/);
  assert.match(shelfMarkup, /class="result-text" aria-live="polite">\{\{templateSummary\}\}/);
  assert.match(shelfMarkup, /class="template-card library-card" hover-class="card-pressed"/);
  assert.match(shelfMarkup, /class="back-top" bindtap="scrollTemplatesTop"/);
  assert.match(shelfMarkup, /bindtap="useTemplateSuggestion"/);
  assert.doesNotMatch(shelfMarkup, /class="card-blurb"/, 'cards stay short; the blurb lives in the preview');
  assert.equal((shelfMarkup.match(/aria-role="tab"/g) || []).length, 4);
});

test('a chip row with nothing to choose but 全部 is not shown', () => {
  const markup = readHome('index.wxml');
  assert.match(markup, /<scroll-view wx:if="\{\{sceneChips\.length > 1\}\}"/);
  assert.match(markup, /<scroll-view wx:if="\{\{sizeChips\.length > 1\}\}"/);
  assert.match(markup, /<view wx:if="\{\{categoryChips\.length > 1\}\}" class="chip-wrap">/);
});

test('the 筛选 button appears once the shelf has scrolled past its filters, and only on the shelf', () => {
  const page = shelf();
  const calls = [];
  const setData = page.setData;
  page.setData = function (patch, callback) { calls.push(patch); return setData.call(this, patch, callback); };
  page.onPageScroll({ scrollTop: 120 });
  assert.equal(page.data.showTemplateTop, false);
  assert.equal(calls.length, 0, 'no setData while nothing changes');
  page.onPageScroll({ scrollTop: 900 });
  page.onPageScroll({ scrollTop: 1400 });
  assert.equal(page.data.showTemplateTop, true);
  assert.equal(calls.length, 1, 'one setData for the change, none while it stays');
  page.onPageScroll({ scrollTop: 60 });
  assert.equal(page.data.showTemplateTop, false);
  page.onPageScroll({ scrollTop: 900 });
  page.navigate(tap({ route: 'projects' }));
  assert.equal(page.data.showTemplateTop, false, 'leaving the shelf hides it');
  page.onPageScroll({ scrollTop: 2000 });
  assert.equal(page.data.showTemplateTop, false, 'other routes never show it');
});

test('while searching all templates, the chip counts include the scene templates the search also lists', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const page = shelf();
  page.onTemplateSearch({ detail: { value: '价签' } });
  t.mock.timers.tick(300);
  const total = page.data.templateTotal;
  assert.ok(total > 20, 'the search reaches into the scene templates');
  assert.equal(page.data.categoryChips[0].value, '全部');
  assert.equal(page.data.categoryChips[0].count, total, '全部 equals the result line');
  assert.match(page.data.templateSummary, new RegExp(`找到 ${total} 个$`));
  const retail = page.data.categoryChips.find((chip) => chip.value === '零售');
  page.setTemplateCategory(tap({ value: '零售' }));
  assert.equal(page.data.templateTotal, retail.count, '零售 shows as many cards as its chip said');
});
