const test = require('node:test');
const assert = require('node:assert/strict');

const memory = new Map();
global.__APP_VERSION__ = 'test';
global.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key)
};

const {
  APPROVED_AUTHORIZED_REDESIGN_TEMPLATES,
  BUILTIN_BASE_TEMPLATES,
  templates
} = require('../src/app/catalog');
const { SHANGYUE_SCENE_MATERIAL_SYMBOL_IDS } = require('../src/core/materials');
const { initialState } = require('../src/app/state');
const { renderMain, renderModal } = require('../src/app/views');
const { CLEANROOM_TEMPLATE_PACK } = require('../src/app/cleanroom-template-pack');
const { queryLibraryMeta } = require('../../label-printer-miniapp/miniprogram/app/shangyue-library/pack');
const {
  SCENE_DEFINITIONS,
  countTemplatesByScene,
  sceneIdsForTemplate,
  templateMatchesScene
} = require('../src/app/scenes');

test('business scene taxonomy is complete and every public template is discoverable', () => {
  assert.equal(SCENE_DEFINITIONS.length, 6);
  assert.equal(new Set(SCENE_DEFINITIONS.map((scene) => scene.id)).size, 6);
  for (const template of templates) {
    const ids = sceneIdsForTemplate(template);
    assert.ok(ids.length >= 1, `${template.id} has no scene`);
    assert.ok(ids.every((id) => SCENE_DEFINITIONS.some((scene) => scene.id === id)), `${template.id} has unknown scene`);
  }
});

test('document-reference-pending redesigns never enter the public catalog', () => {
  const pending = BUILTIN_BASE_TEMPLATES.filter((item) => String(item.authorizationStatus || '').includes('pending'));
  assert.ok(pending.length > 0, 'fixture should retain pending items for internal rights review');
  assert.equal(APPROVED_AUTHORIZED_REDESIGN_TEMPLATES.length, 0);
  assert.ok(pending.every((item) => item.publicCatalog === false && item.releaseApproved === false));
  assert.ok(templates.every((item) => !String(item.authorizationStatus || '').includes('pending')));
});

test('scene matching supports overlaps that mirror real merchant workflows', () => {
  const bakery = templates.find((item) => item.id === 'shangyue-bakery-tag');
  assert.ok(templateMatchesScene(bakery, 'retail'));
  assert.ok(templateMatchesScene(bakery, 'expiry'));
  assert.ok(templateMatchesScene(templates.find((item) => item.id === 'shangyue-cable-tag'), 'equipment'));
  assert.ok(templateMatchesScene(templates.find((item) => item.id === 'shangyue-bin-label'), 'warehouse'));
  assert.equal(sceneIdsForTemplate(templates.find((item) => item.id === 'shangyue-size-color'))[0], 'fashion');
  assert.equal(sceneIdsForTemplate(templates.find((item) => item.id === 'shangyue-maintenance'))[0], 'equipment');
});

test('home scene counts are non-empty and use unique template records', () => {
  const counts = countTemplatesByScene(templates);
  for (const scene of SCENE_DEFINITIONS) assert.ok(counts[scene.id] > 0, `${scene.label} is empty`);
  assert.ok(Object.values(counts).every((count) => count <= templates.length));
});

test('home and template library expose the six business scenes as real filters', () => {
  memory.clear();
  const state = initialState();
  state.settings.onboardingDone = true;
  const home = renderMain(state);
  assert.equal((home.match(/data-action="open-scene"/g) || []).length, SCENE_DEFINITIONS.length);
  for (const scene of SCENE_DEFINITIONS) {
    assert.match(home, new RegExp(`data-scene="${scene.id}"`));
    assert.match(home, new RegExp(`打开${scene.label}模板`));
  }

  state.route = 'templates';
  state.templateScene = 'warehouse';
  const library = renderMain(state);
  const ids = [...library.matchAll(/class="template-card"[^>]+data-id="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(ids.length > 0);
  assert.ok(ids.every((id) => templateMatchesScene(templates.find((item) => item.id === id), 'warehouse')));
  assert.match(library, /aria-label="仓储物流" aria-selected="true"/);
});

test('template library exposes task-first discovery and filters clean-room variants', () => {
  memory.clear();
  const state = initialState();
  state.settings.onboardingDone = true;
  state.route = 'templates';
  state.templateScene = 'retail';
  const library = renderMain(state);
  assert.match(library, /热门任务/);
  assert.match(library, /data-action="template-task" data-task="货架价签"/);
  assert.match(library, /aria-label="按纸张尺寸筛选"/);
  assert.match(library, new RegExp(`原创任务系列 ${CLEANROOM_TEMPLATE_PACK.length}`));

  state.templateTask = '货架价签';
  const filtered = renderMain(state);
  const ids = [...filtered.matchAll(/class="template-card"[^>]+data-id="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, CLEANROOM_TEMPLATE_PACK.filter((item) => item.taskLabel === '货架价签').length);
  assert.ok(ids.every((id) => templates.find((item) => item.id === id).taskLabel === '货架价签'));
  assert.match(filtered, /data-task="货架价签"[^>]+aria-selected="true"/);

  state.templateTask = '全部';
  state.templateSize = '40×30';
  const sized = renderMain(state);
  assert.match(sized, /data-action="template-size" data-size="40×30"[^>]+aria-selected="true"/);
  assert.match(sized, /40×30 mm/);
});

test('wide-stock discovery is physical-size exact and independent of the selected BLE profile', () => {
  memory.clear();
  const state = initialState();
  state.settings.onboardingDone = true;
  state.route = 'templates';

  for (const [size, expectedCount] of [['50×30', 20], ['50×40', 10], ['60×40', 10]]) {
    state.templateSize = size;
    state.settings.defaultProfileId = 'd110';
    const d110Markup = renderMain(state);
    const d110Ids = [...d110Markup.matchAll(/class="template-card"[^>]+data-id="([^"]+)"/g)].map((match) => match[1]);

    assert.equal(d110Ids.length, expectedCount, `${size} should expose every wide original`);
    assert.ok(d110Ids.every((id) => {
      const item = templates.find((template) => template.id === id);
      return item && `${item.size[0]}×${item.size[1]}` === size;
    }), `${size} returned a mismatched physical stock`);

    state.settings.defaultProfileId = 'b21';
    const b21Markup = renderMain(state);
    const b21Ids = [...b21Markup.matchAll(/class="template-card"[^>]+data-id="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(b21Ids, d110Ids, `${size} catalog changed with BLE profile`);
    assert.doesNotMatch(b21Markup, /适配(?: D11| D110| B1| B21)|不适配|机型限制/);
  }
});

test('industry-library stock chips state width by height in millimetres', () => {
  memory.clear();
  const state = initialState();
  state.settings.onboardingDone = true;
  state.route = 'templates';
  state.templateIndustry = '行业库';
  const markup = renderMain(state);
  assert.match(markup, /aria-label="纸张尺寸（宽×高）"/);
  assert.match(markup, /data-action="library-size" data-size="50×30"[^>]*>50×30 mm<\/button>/);
});

test('clean-room preview identifies ownership, task and layout without duplicate badges', () => {
  memory.clear();
  const state = initialState();
  state.modal = 'template-preview';
  state.templatePreviewId = 'sy-cr-shelf-price-focus';
  const preview = renderModal(state);
  assert.equal((preview.match(/>商跃原创</g) || []).length, 1);
  assert.match(preview, /任务 货架价签/);
  assert.match(preview, /版式 醒目版/);
});

test('industry preset cards resolve into a real preview instead of a dead end', () => {
  memory.clear();
  const first = queryLibraryMeta({ limit: 1 }).items[0];
  assert.ok(first && String(first.id).startsWith('sy-lib-'));
  const state = initialState();
  state.modal = 'template-preview';
  state.templatePreviewId = first.id;
  const preview = renderModal(state);
  assert.doesNotMatch(preview, /模板不可用/);
  assert.match(preview, /id="template-preview-canvas"/);
  assert.match(preview, new RegExp(`${first.size[0]}×${first.size[1]} mm`));
  assert.match(preview, new RegExp(`data-action="use-template" data-id="${first.id}"`));
});

test('material sheet makes every original scenario symbol named and touch-discoverable', () => {
  memory.clear();
  const state = initialState();
  state.modal = 'material';
  state.materialChip = '商跃';
  const markup = renderModal(state);
  assert.match(markup, /商跃素材/);
  assert.match(markup, /商跃原创 \d+/);
  for (const id of SHANGYUE_SCENE_MATERIAL_SYMBOL_IDS) {
    assert.match(markup, new RegExp(`data-symbol="${id}"[^>]+aria-label="素材 [^"]+"`));
  }
  assert.ok((markup.match(/class="niim-mat-name"/g) || []).length >= SHANGYUE_SCENE_MATERIAL_SYMBOL_IDS.length);
});
