const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { curatedStats } = require('../miniprogram/app/curated/index');

let pageDefinition = null;
global.Page = (definition) => { pageDefinition = definition; };
require('../miniprogram/pages/home/index');
delete global.Page;

test('home scan-to-label is single-flight and opens one generated document', async () => {
  let scanCalls = 0;
  let finishScan;
  let openedDocument = null;
  global.wx = {
    scanCode(options) {
      scanCalls += 1;
      finishScan = () => options.success({ result: '6901234567892', scanType: 'EAN_13' });
    },
    showModal() {}
  };
  const page = Object.assign({}, pageDefinition, {
    data: { codeScanning: false },
    repository: { getSettings: () => ({ stockWidthMm: 40, stockHeightMm: 30 }) },
    setData(patch) { Object.assign(this.data, patch); },
    openEditor(document) { openedDocument = document; }
  });

  const first = page.scanToLabel();
  const second = page.scanToLabel();
  assert.equal(scanCalls, 1);
  assert.equal(page.data.codeScanning, true);
  finishScan();
  await Promise.all([first, second]);
  assert.equal(page.data.codeScanning, false);
  assert.equal(openedDocument.elements[0].type, 'barcode');
  delete global.wx;
});

test('NIIM file import caches HTTPS images before saving the user template', async () => {
  let savedDocument = null;
  global.wx = {
    env: { USER_DATA_PATH: 'wxfile://usr' },
    chooseMessageFile(options) {
      options.success({ tempFiles: [{ path: 'wxfile://tmp/template.json', name: 'online.json', size: 100 }] });
    },
    getFileSystemManager() {
      return {
        readFile(options) {
          options.success({ data: JSON.stringify({
            name: '在线图片模板', width: 40, height: 30,
            elements: [{ type: 'image', imageUrl: 'https://example.com/a.png', x: 1, y: 1, width: 10, height: 10 }]
          }) });
        },
        access(options) { options.fail({ errMsg: 'not found' }); },
        mkdir(options) { options.success({}); },
        saveFile(options) { options.success({ savedFilePath: options.filePath }); }
      };
    },
    downloadFile(options) {
      options.success({ statusCode: 200, tempFilePath: 'wxfile://tmp/a.png' });
    },
    showToast() {},
    showModal() {}
  };
  const page = Object.assign({}, pageDefinition, {
    pageActive: true,
    repository: {
      saveUserTemplate(document) {
        savedDocument = document;
        return { name: document.name };
      }
    },
    refresh() {}
  });
  page.importTemplateFile();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(savedDocument.elements[0].path, /^wxfile:\/\/usr\/niim-online-assets\//);
  delete global.wx;
});

test('template shelf contains only approved originals, authorized redesigns, and user templates', () => {
  const page = Object.assign({}, pageDefinition, {
    data: {
      templateCategory: '全部',
      templateIndustry: '全部',
      templateQuery: '',
      templateVisibleCount: 500
    },
    remoteTemplates: [{
      id: 'remote-hidden', name: '远程模板', category: '线上', industry: '行业模板',
      size: [40, 30], source: 'remote-niim'
    }],
    userTemplates: [{
      id: 'user-visible', name: '我的常用价签',
      document: { widthMm: 40, heightMm: 30, elements: [] }
    }],
    setData(patch) { Object.assign(this.data, patch); }
  });
  page.refreshTemplates();
  assert.ok(page.data.visibleTemplates.some((item) => item.id === 'user-visible'));
  assert.ok(page.data.visibleTemplates.some((item) => item.id === 'shangyue-wish-card'));
  assert.ok(page.data.visibleTemplates.some((item) => item.source === 'shangyue-original'));
  assert.ok(page.data.visibleTemplates.every((item) => item.source === 'shangyue-original' || item.source === 'user'));
  assert.equal(page.data.visibleTemplates.some((item) => item.source === 'builtin-base'), false);
  assert.equal(page.data.visibleTemplates.some((item) => item.id === 'remote-hidden'), false);
  assert.equal(pageDefinition.data.recommendedTemplates.length, 6);
  assert.equal(pageDefinition.data.recommendedTemplates[0].id, 'shangyue-wish-card');
  assert.equal(pageDefinition.data.recommendedTemplates[0].thumbSrc, '/assets/shangyue-thumbs/shangyue-wish-card-v1.png');
  assert.equal(pageDefinition.data.recommendedTemplates[0].badge, '原创');
  assert.equal(pageDefinition.data.recommendedTemplates[0].copyright, '© 2026 商跃');
  assert.ok(pageDefinition.data.recommendedTemplates.every((item) => (
    item.id.startsWith('shangyue-') && item.badge === '原创'
  )));
  const markup = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'home', 'index.wxml'), 'utf8');
  assert.match(markup, /wx:if="\{\{item\.thumbSrc\}\}"[^>]+src="\{\{item\.thumbSrc\}\}"/);
  assert.match(markup, /wx:if="\{\{item\.badge\}\}"[^>]*>\{\{item\.badge\}\}/);
  assert.match(markup, /previewTemplate\.copyright/);
  assert.match(markup, /公开货架与场景模板均为商跃原创/);
  assert.doesNotMatch(markup, /授权改编/);
  assert.match(markup, /20 款 OFL 开源中文字库/);
});

test('scene templates are a separate curated shelf and stay off the default seed list', () => {
  const page = Object.assign({}, pageDefinition, {
    data: {
      templateCategory: '全部',
      templateIndustry: '全部',
      libraryScene: '全部',
      librarySize: '全部',
      templateQuery: '',
      templateVisibleCount: 24
    },
    userTemplates: [],
    setData(patch) { Object.assign(this.data, patch); }
  });
  page.refreshTemplates();
  assert.ok(page.data.visibleTemplates.every((item) => item.source === 'shangyue-original'));
  assert.equal(page.data.visibleTemplates.some((item) => String(item.id).startsWith('sy-tpl-')), false);

  page.data.templateIndustry = '场景模板';
  page.refreshTemplates();
  assert.equal(page.data.templateTotal, curatedStats().total);
  assert.equal(page.data.visibleTemplates.length, 24);
  assert.ok(page.data.visibleTemplates.every((item) => item.source === 'shangyue-curated'));
  assert.ok(page.data.visibleTemplates.every((item) => String(item.id).startsWith('sy-tpl-')));
  const resolved = page.resolveTemplate(page.data.visibleTemplates[0].id);
  assert.ok(resolved.document.elements.length >= 2);
  assert.equal(resolved.document.templateMeta.library, 'shangyue-curated');
  page.data.libraryScene = '零售';
  page.refreshTemplates();
  assert.ok(page.data.templateTotal > 80);
  assert.ok(page.data.visibleTemplates.every((item) => item.category === '零售'));
  page.data.librarySize = '40×30';
  page.refreshTemplates();
  assert.ok(page.data.templateTotal > 0);
  assert.ok(page.data.visibleTemplates.every((item) => item.sizeText === '40×30 mm'));
  const markup = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'home', 'index.wxml'), 'utf8');
  assert.match(markup, /data-value="场景模板"/);
  assert.doesNotMatch(markup, /行业库/);
  assert.match(markup, /setLibraryScene/);
  assert.match(markup, /setLibrarySize/);
});

test('batch picker offers the tagged curated templates only', () => {
  const { curatedBatchTemplates } = require('../miniprogram/app/curated/index');
  const picks = curatedBatchTemplates();
  assert.equal(pageDefinition.data.batchTemplateNames.length, picks.length);
  assert.deepEqual(pageDefinition.data.batchTemplateNames, picks.map((item) => item.name));
  assert.equal(pageDefinition.data.batchTemplateId, picks[0].id);
  assert.equal(pageDefinition.data.batchTemplateNames.includes('商跃心意祝福卡'), false);
});

test('batch generation fills tagged fields and saves one project per row', () => {
  let saved = null;
  global.wx = { showToast() {}, showModal(options) { throw new Error(options.content); } };
  const page = Object.assign({}, pageDefinition, {
    data: Object.assign({}, pageDefinition.data, {
      dataRows: [
        { name: '青苹果', code: '6901234567892', price: '9.9', date: '' },
        { name: '香蕉', code: 'BN-2001', price: '5.5', date: '' }
      ]
    }),
    repository: {
      getSettings: () => ({ defaultProfileId: 'd110' }),
      saveProjects(documents) { saved = documents; return documents.map((document, index) => ({ id: `p${index}`, document })); }
    },
    refresh() {},
    openEditor() {},
    setData(patch) { Object.assign(this.data, patch); }
  });
  page.runBatch();
  assert.equal(saved.length, 2);
  const texts = saved.map((document) => document.elements.map((item) => item.text || item.value || '').join('|'));
  assert.match(texts[0], /青苹果/);
  assert.match(texts[0], /¥9.9/);
  assert.match(texts[0], /6901234567892/);
  assert.match(texts[1], /香蕉/);
  assert.match(texts[1], /BN-2001/);
  delete global.wx;
});

test('opening the template shelf does not request the remote NIIM catalog', () => {
  let remoteLoads = 0;
  const page = Object.assign({}, pageDefinition, {
    data: { route: 'home' },
    setData(patch, callback) { Object.assign(this.data, patch); if (callback) callback(); },
    refreshTemplates() {},
    ensureRemoteTemplateCatalog() { remoteLoads += 1; }
  });
  page.navigate({ currentTarget: { dataset: { route: 'templates' } } });
  assert.equal(page.data.route, 'templates');
  assert.equal(remoteLoads, 0);
});

test('home first screen follows the decided main-path order', () => {
  const markup = fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'home', 'index.wxml'), 'utf8');
  const recent = markup.indexOf('最近标签');
  const stock = markup.indexOf('当前纸张');
  const shelf = markup.indexOf('商跃模板</text>');
  const scanBanner = markup.indexOf('scan-banner');
  assert.ok(recent > 0 && stock > 0 && shelf > 0 && scanBanner > 0);
  assert.ok(recent < stock, '最近标签必须排在当前纸张之前');
  assert.ok(stock < shelf, '当前纸张必须排在商跃模板之前');
  assert.ok(scanBanner > shelf, '扫码建标只能作为更下方的次要动作');
  assert.equal(markup.includes('quick-panel'), false);
  assert.match(markup, /class="scan-banner" bindtap="scanToLabel"/);
});

test('a pending route stored by the editor is consumed once on show', () => {
  const store = new Map([['niim-label:pending-home-route', 'data']]);
  global.wx = {
    getStorageSync: (key) => (store.has(key) ? store.get(key) : ''),
    removeStorageSync: (key) => store.delete(key)
  };
  const page = Object.assign({}, pageDefinition, {
    data: { route: 'home' },
    setData(patch) { Object.assign(this.data, patch); }
  });
  page.consumePendingRoute();
  assert.equal(page.data.route, 'data');
  assert.equal(store.has('niim-label:pending-home-route'), false);
  page.data.route = 'home';
  page.consumePendingRoute();
  assert.equal(page.data.route, 'home');
  delete global.wx;
});

test('a template pack bulk-imports into user templates with a summary dialog', () => {
  let modal = null;
  let importedItems = null;
  global.wx = { showModal(options) { modal = options; } };
  const page = Object.assign({}, pageDefinition, {
    repository: {
      importUserTemplates(items) {
        importedItems = items;
        return { imported: 2, invalid: 1, overflow: 0, capacity: 80 };
      }
    },
    refresh() {}
  });
  page.importTemplatePack({ kind: 'shangyue-template-pack', templates: [{}, {}, {}] });
  assert.equal(importedItems.length, 3);
  assert.match(modal.content, /已导入 2 个模板/);
  assert.match(modal.content, /1 个数据无效/);

  const full = Object.assign({}, pageDefinition, {
    repository: {
      importUserTemplates() { return { imported: 0, invalid: 0, overflow: 3, capacity: 0 }; }
    },
    refresh() {}
  });
  full.importTemplatePack({ templates: [{}, {}, {}] });
  assert.match(modal.title, /未导入/);
  assert.match(modal.content, /上限 80/);
  delete global.wx;
});

test('template preview summarizes elements in Chinese', () => {
  const page = Object.assign({}, pageDefinition, {
    data: {},
    resolveTemplate() {
      return {
        meta: { id: 'sample', name: '示例' },
        document: { elements: [{ type: 'text' }, { type: 'text' }, { type: 'qrcode' }] }
      };
    },
    setData(patch) { Object.assign(this.data, patch); }
  });
  page.previewTemplate({ currentTarget: { dataset: { id: 'sample' } } });
  assert.equal(page.data.previewTemplate.elementSummary, '文本×2 · 二维码×1');
  assert.equal(page.data.previewTemplate.elementCount, 3);
});

test('home scan-to-label retries from the failure dialog and names the label by content', async () => {
  let scanCalls = 0;
  let modal = null;
  let openedDocument = null;
  global.wx = {
    scanCode(options) {
      scanCalls += 1;
      if (scanCalls === 1) options.fail({ errMsg: 'scanCode:fail' });
      else options.success({ result: '773012345678901', scanType: 'CODE_128' });
    },
    showModal(options) { modal = options; }
  };
  const page = Object.assign({}, pageDefinition, {
    data: { codeScanning: false },
    repository: { getSettings: () => ({ stockWidthMm: 40, stockHeightMm: 12 }) },
    setData(patch) { Object.assign(this.data, patch); },
    openEditor(document) { openedDocument = document; }
  });
  await page.scanToLabel();
  assert.equal(openedDocument, null);
  assert.equal(modal.confirmText, '重新扫码');
  assert.equal(page.data.codeScanning, false);
  modal.success({ confirm: true });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(scanCalls, 2);
  assert.equal(openedDocument.name, '条码 773012345678901');
  delete global.wx;
});

test('using a template closes its preview once the editor has opened', () => {
  let navigated = null;
  global.wx = {
    navigateTo(options) { navigated = options; options.success && options.success(); }
  };
  const page = Object.assign({}, pageDefinition, {
    data: { showTemplatePreview: true, previewTemplate: { id: 'sy-tpl-x' } },
    previewDocument: { widthMm: 40, heightMm: 30, elements: [] },
    setData(patch) { Object.assign(this.data, patch); }
  });
  page.navigateEditor();
  assert.equal(navigated.url, '/pages/editor/index');
  assert.equal(page.data.showTemplatePreview, false);
  assert.equal(page.previewDocument, null);
  delete global.wx;
});
