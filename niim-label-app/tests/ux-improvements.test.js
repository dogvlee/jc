const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const memory = new Map();
global.__APP_VERSION__ = 'test';
global.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key)
};

const { createDocument } = require('../src/core/document');
const { getTemplate, templates } = require('../src/app/catalog');
const { SCENE_DEFINITIONS, templateMatchesScene } = require('../src/app/scenes');
const { initialState, openDocument, shouldPersistDraft } = require('../src/app/state');
const {
  isPlaceholderElement,
  renderMain,
  renderModal,
  templateAttentionMessage,
  templateCard
} = require('../src/app/views');

function freshState() {
  memory.clear();
  return initialState();
}

function userProject(index) {
  return {
    id: `user-project-${index}`,
    updatedAt: 100000 - index,
    source: 'user',
    document: {
      name: `用户标签${index}`,
      widthMm: 40,
      heightMm: 30,
      elements: []
    }
  };
}

test('home hides seeded projects and recommends only approved public designs', () => {
  const state = freshState();
  const markup = renderMain(state);
  assert.match(markup, /<h1>商跃标签<\/h1>/);
  assert.doesNotMatch(markup, /<h1>精臣标签<\/h1>/);
  assert.equal((markup.match(/data-action="open-project"/g) || []).length, 0);
  assert.match(markup, /<h2>最近编辑<\/h2>/);
  assert.match(markup, /还没有我的模板/);
  assert.match(markup, /data-action="all-projects"/);
  assert.match(markup, /效期标签/);
  assert.doesNotMatch(markup, /scan-placeholder|扫一扫将在接入/);
  assert.match(markup, /<button type="button" class="promo-banner"/);
  const featuredStart = markup.indexOf('<div class="template-grid home-template-grid">');
  const featuredEnd = markup.indexOf('</section>', featuredStart);
  const featuredMarkup = markup.slice(featuredStart, featuredEnd);
  const featuredIds = [...featuredMarkup.matchAll(/class="template-card"[^>]+data-id="([^"]+)"/g)]
    .map((match) => match[1]);
  assert.equal(featuredIds.length, 6);
  assert.ok(SCENE_DEFINITIONS.every((scene) => (
    featuredIds.some((id) => templateMatchesScene(getTemplate(id), scene.id))
  )));
  assert.ok(featuredIds.every((id) => {
    const template = getTemplate(id);
    return template && template.publicCatalog === true && template.releaseApproved === true;
  }));

  state.projects = Array.from({ length: 5 }, (_, index) => userProject(index));
  const withGenuineRecents = renderMain(state);
  assert.equal((withGenuineRecents.match(/data-action="open-project"/g) || []).length, 4);
});

test('all-projects route starts empty, then paginates and searches genuine user projects', () => {
  const state = freshState();
  state.route = 'projects';
  state.projectVisibleCount = 24;
  let markup = renderMain(state);
  assert.equal((markup.match(/data-action="open-project"/g) || []).length, 0);
  assert.doesNotMatch(markup, /data-action="load-more-projects"/);
  assert.match(markup, /还没有标签/);

  state.projects = Array.from({ length: 30 }, (_, index) => userProject(index));
  markup = renderMain(state);
  assert.equal((markup.match(/data-action="open-project"/g) || []).length, 24);
  assert.match(markup, /data-action="load-more-projects"/);
  assert.match(markup, new RegExp(`显示 24 / ${state.projects.length} 个`));

  state.projectQuery = '用户标签29';
  markup = renderMain(state);
  assert.match(markup, /data-action="project-search"/);
  assert.equal((markup.match(/data-action="open-project"/g) || []).length, 1);
});

test('template library renders in 24-card batches instead of mounting every template', () => {
  const state = freshState();
  state.route = 'templates';
  state.templateVisibleCount = 24;
  let markup = renderMain(state);
  const firstPageCount = Math.min(24, templates.length);
  const originalCount = templates.filter((item) => item.source === 'shangyue-original').length;
  const authorizedCount = templates.filter((item) => item.source === 'shangyue-authorized-redesign').length;
  assert.equal((markup.match(/class="template-card"/g) || []).length, firstPageCount);
  assert.match(markup, new RegExp(`当前显示 ${firstPageCount}`));
  const rightsLabel = authorizedCount
    ? `商跃原创 ${originalCount} · 已获书面授权改编 ${authorizedCount}`
    : `商跃原创 ${originalCount} · 待授权内容不公开`;
  assert.match(markup, new RegExp(rightsLabel));
  assert.match(markup, /场景预设 \d+/);
  assert.doesNotMatch(markup, /第三方目录（内部）/);
  assert.doesNotMatch(markup, /载入下一批第三方模板/);
  assert.doesNotMatch(markup, /data-category="我的"/);
  assert.doesNotMatch(markup, /离线精选/);
  assert.doesNotMatch(markup, /授权全库|授权在线/);
  const firstPageIds = [...markup.matchAll(/class="template-card"[^>]+data-id="([^"]+)"/g)]
    .map((match) => match[1]);
  assert.equal(firstPageIds[0], 'shangyue-wish-card');
  assert.match(markup, /data-industry="行业库"/);

  state.templateIndustry = '行业库';
  markup = renderMain(state);
  const libraryIds = [...markup.matchAll(/class="template-card"[^>]+data-id="([^"]+)"/g)]
    .map((match) => match[1]);
  assert.ok(libraryIds.length > 0);
  assert.ok(libraryIds.every((id) => String(id).startsWith('sy-lib-')));
  assert.match(markup, /data-action="library-scene"/);
  state.libraryScene = '商跃价签';
  markup = renderMain(state);
  assert.match(markup, /商跃价签/);
  const priced = [...markup.matchAll(/class="template-card"[^>]+data-id="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(priced.length > 0);
  assert.ok(priced.every((id) => id.startsWith('sy-lib-')));
  assert.ok(firstPageIds.every((id) => {
    const template = getTemplate(id);
    return template && ['shangyue-original', 'shangyue-authorized-redesign'].includes(template.source);
  }));

  const niimCard = templateCard({
    id: 'online-512427668',
    name: '历史对照模板',
    category: '线上',
    size: [40, 30],
    kind: 'accent',
    source: 'online-niim'
  });
  assert.match(niimCard, /template-source-badge[^>]*>精臣来源/);
  const partnerCard = templateCard({
    id: 'partner-example',
    name: '合作方模板',
    category: '行业',
    size: [40, 30],
    kind: 'accent',
    source: 'partner'
  });
  assert.match(partnerCard, /template-source-badge[^>]*>第三方来源/);
  const pendingCard = templateCard(getTemplate('product-simple'));
  assert.match(pendingCard, /template-source-badge[^>]*>内置基础 · 权属待审/);

  state.templateIndustry = '全部';
  state.templateVisibleCount = 48;
  markup = renderMain(state);
  assert.equal((markup.match(/class="template-card"/g) || []).length, Math.min(48, templates.length));
});

test('batch sheet excludes the wish card and stale settings resolve to a safe template', () => {
  const state = freshState();
  state.modal = 'batch';
  state.dataRows = [{ name: '测试商品', code: 'A-001', price: '9.9', date: '2026-08-17' }];
  state.batchSelectedRows = [0];
  state.settings.batchTemplateId = 'shangyue-wish-card';

  const markup = renderModal(state);
  assert.doesNotMatch(markup, /<option value="shangyue-wish-card"/);
  assert.match(markup, /<option value="product-simple" selected>/);

  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'main.js'), 'utf8');
  assert.match(main, /function resolveBatchTemplate\(id\)/);
  assert.match(main, /const batchTemplate = resolveBatchTemplate\(state\.settings\.batchTemplateId\)/);
  assert.match(main, /批量生成失败/);
});

test('opening a fresh document clears stale saved state while a saved project restores its timestamp', () => {
  const state = freshState();
  const documentValue = createDocument(50, 30);
  state.draftSavedAt = 123456;
  openDocument(state, documentValue);
  assert.equal(state.draftSavedAt, 0);

  const project = userProject(0);
  state.projects = [project];
  openDocument(state, project.document, project.id);
  assert.equal(state.draftSavedAt, project.updatedAt);
});

test('editor exposes imported-font fallback and print sheet offers an undoable code resize', () => {
  const state = freshState();
  const documentValue = createDocument(40, 30);
  documentValue.elements = [{
    id: 'legacy-font', type: 'text', x: 1, y: 1, width: 20, height: 5,
    text: '字体', fontSize: 4, fontFamily: 'ZT201'
  }];
  openDocument(state, documentValue);
  state.route = 'editor';
  state.editorMode = 'selected';
  state.editorPanelTab = 'style';
  const editorMarkup = renderMain(state);
  assert.match(editorMarkup, /源字体“ZT201”未随模板提供/);
  assert.match(editorMarkup, /开源「思源黑体」/);
  assert.match(editorMarkup, /23 款字体 · 20 款 OFL 开源字体按需加载/);
  assert.match(editorMarkup, /niim-font-chip active[^>]*data-value="sy-heiti"/);
  assert.match(editorMarkup, /data-value="sy-lubrifont-sc"/);

  state.modal = 'print';
  state.printBlock = {
    kind: 'element',
    message: '条码清晰度不足',
    elementId: 'code-low-density',
    errorCode: 'CODE_MODULE_DENSITY_LOW',
    suggestProfileId: ''
  };
  const printMarkup = renderModal(state);
  assert.match(printMarkup, /data-action="fix-code-size"/);
  assert.match(printMarkup, /按最小清晰度放大/);
  assert.match(printMarkup, /定位并修改/);
});

test('import attention and placeholder helpers surface missing assets and unconfirmed content', () => {
  assert.equal(isPlaceholderElement({ type: 'text', text: '双击文本框编辑' }), true);
  assert.equal(isPlaceholderElement({ type: 'barcode', value: '123456789', requiresInput: true }), true);
  assert.equal(isPlaceholderElement({ type: 'barcode', value: 'ABC', unsupportedCodeType: true, requiresInput: true }), false);

  const message = templateAttentionMessage({
    widthMm: 40,
    heightMm: 20,
    templateMeta: { needsAttention: true, missingImageCount: 1 },
    elements: [{ type: 'qrcode', value: '123456', requiresInput: true }]
  });
  assert.match(message, /1 张图片缺失/);
  assert.match(message, /1 个内容需要填写或确认/);

  const state = freshState();
  state.modal = 'print';
  state.printBlock = {
    kind: 'placeholder', message: '请确认编码', elementId: 'sample-code',
    canConfirmOriginal: true, suggestProfileId: ''
  };
  assert.match(renderModal(state), /data-action="confirm-placeholder-value"[^>]*>确认使用当前编码/);
});

test('an untouched blank draft is discarded while changed or existing documents persist', () => {
  const documentValue = createDocument(50, 30);
  documentValue.elements = [];
  const baseline = JSON.stringify(documentValue);
  assert.equal(shouldPersistDraft(documentValue, '', baseline), false);
  assert.equal(shouldPersistDraft(documentValue, 'project-existing', baseline), true);
  documentValue.name = '已命名标签';
  assert.equal(shouldPersistDraft(documentValue, '', baseline), true);
  assert.equal(shouldPersistDraft(null, '', ''), false);
});

test('default print settings opens real controls and user-facing info contains no backend placeholders', () => {
  const state = freshState();
  state.modal = 'default-print-settings';
  const settingsMarkup = renderModal(state);
  assert.match(settingsMarkup, /id="default-print-settings-title"/);
  assert.match(settingsMarkup, /data-field="defaultProfileId"/);
  assert.match(settingsMarkup, /data-field="density"/);
  assert.match(settingsMarkup, /data-action="change-copies"/);

  state.modal = 'help';
  const helpMarkup = renderModal(state);
  assert.match(helpMarkup, /使用帮助/);
  assert.doesNotMatch(helpMarkup, /API_BASE_URL|AUTH_PROVIDER|FEEDBACK_ENDPOINT|STORAGE_PROVIDER/);

  state.modal = 'about';
  const aboutMarkup = renderModal(state);
  assert.match(aboutMarkup, /商跃标签/);
  assert.match(aboutMarkup, /通过权属门禁的商跃原创或已获书面授权内容/);
  assert.match(aboutMarkup, /待补授权内容不公开展示/);
  assert.match(aboutMarkup, /20 款 OFL 开源中文字库/);
  assert.match(aboutMarkup, /href="THIRD_PARTY_NOTICES\.txt"/);
  assert.doesNotMatch(aboutMarkup, /精臣标签/);
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'public', 'THIRD_PARTY_NOTICES.txt')), true);
});

test('preview, search, touch and accessibility regressions remain explicitly guarded', () => {
  const root = path.join(__dirname, '..');
  const css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'src', 'app', 'main.js'), 'utf8');
  const index = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
  const views = fs.readFileSync(path.join(root, 'src', 'app', 'views.js'), 'utf8');

  assert.match(css, /\.template-preview-loading\[hidden\][\s\S]*display:\s*none\s*!important/);
  assert.match(css, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(main, /MOVE_DEADZONE_PX = Object\.freeze\(\{ touch: 8, pen: 8, mouse: 3 \}\)/);
  assert.match(main, /handleHitRegion\(candidate\.name, candidate\.deltaX, candidate\.deltaY, pointerType\)/);
  assert.match(main, /currentTab\.closest\('\[role="tablist"\]'\)/);
  assert.match(main, /\['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'\]/);
  assert.match(main, /querySelector\('\[data-action="border-search"\]'\)[\s\S]{0,180}setSelectionRange/);
  const modalInputHandler = main.match(/modalRoot\.addEventListener\('input',[\s\S]*?\n\}\);/);
  assert.ok(modalInputHandler, 'modal input delegation must stay mounted');
  for (const action of ['update-setting', 'stock-field', 'rename-template-field', 'border-search', 'material-search', 'save-template-name', 'scan-manual-value', 'advanced-qr-field', 'document-name-draft']) {
    assert.match(modalInputHandler[0], new RegExp(`'${action}'`));
  }
  assert.match(main, /node\.setAttribute\('role', type === 'error' \? 'alert' : 'status'\)/);
  assert.doesNotMatch(index, /user-scalable=no|id="app"[^>]*aria-live/);
  assert.match(views, /loading=" \+ Qs \+ "lazy"/);
  assert.match(views, /id="selection-canvas"[^>]*tabindex="0"[^>]*aria-label=/);
});

test('batch project generation never truncates existing user projects', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'main.js'), 'utf8');
  assert.match(main, /state\.projects = \[\.\.\.projects, \.\.\.state\.projects\];/);
  assert.doesNotMatch(main, /\[\.\.\.projects, \.\.\.state\.projects\]\.slice\(/);
});

test('print sheet explains center-crop stock and empty canvas in plain language', () => {
  const state = freshState();
  state.document = createDocument(50, 30);
  state.document.elements = [{ id: 't1', type: 'text', x: 5, y: 5, width: 20, height: 6, text: '内容', rotation: 0 }];
  state.settings.defaultProfileId = 'b1';
  state.modal = 'print';
  state.printBlock = null;
  const markup = renderModal(state);
  assert.match(markup, /将居中裁切打印/);
  assert.match(markup, /左右各约 1\.0 mm/);
  assert.doesNotMatch(markup, /MTU/, '打印面板不再暴露 MTU 术语');

  state.printBlock = { kind: 'empty', message: '画布还是空的，请先添加至少一个标签元素。', suggestProfileId: '' };
  const blocked = renderModal(state);
  assert.match(blocked, /画布还是空的/);
  assert.match(blocked, /返回编辑/);

  state.printBlock = null;
  state.document = createDocument(40, 30);
  state.document.elements = [];
  const fits = renderModal(state);
  assert.doesNotMatch(fits, /将居中裁切打印/, '未裁切时不显示提示条');
});

test('device rows speak human copy instead of raw BLE jargon', () => {
  const state = freshState();
  state.modal = 'devices';
  state.devices = [{ deviceId: 'AA:BB:CC:DD:EE:FF', name: 'B1-G325', RSSI: -55 }];
  state.device = { deviceId: 'AA:BB:CC:DD:EE:FF', name: 'B1-G325', mtu: 247 };
  const markup = renderModal(state);
  assert.doesNotMatch(markup, /RSSI/);
  assert.doesNotMatch(markup, /MTU/);
  assert.match(markup, /信号强/);
  assert.match(markup, /编号 DD:EE:FF/);
  assert.match(markup, /传输通道就绪/);
});
