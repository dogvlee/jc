const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { templates } = require('../miniprogram/app/catalog');
const {
  curatedBatchTemplates,
  curatedCategoryChips,
  curatedSizeChips,
  curatedStats,
  queryCuratedMeta
} = require('../miniprogram/app/curated/index');
const { Repository, defaultRows } = require('../miniprogram/services/repository');
const { EditorSession } = require('../miniprogram/services/editor-session');

let pageDefinition = null;
global.Page = (definition) => { pageDefinition = definition; };
require('../miniprogram/pages/home/index');
delete global.Page;

const homeDir = path.join(__dirname, '..', 'miniprogram', 'pages', 'home');
const readHome = (name) => fs.readFileSync(path.join(homeDir, name), 'utf8');

function memoryStorage() {
  const values = new Map();
  return {
    getStorageSync(key) { return values.has(key) ? structuredClone(values.get(key)) : ''; },
    setStorageSync(key, value) { values.set(key, structuredClone(value)); },
    removeStorageSync(key) { values.delete(key); }
  };
}

/** Sets `key` like WeChat's setData does, path keys such as `rows[3].name` included. */
function setPath(target, key, value) {
  const parts = key.match(/[^.[\]]+/g);
  let node = target;
  parts.slice(0, -1).forEach((part, index) => {
    if (node[part] == null) node[part] = /^\d+$/.test(parts[index + 1]) ? [] : {};
    node = node[part];
  });
  node[parts[parts.length - 1]] = value;
}

/** Home page instance with its own data; setData understands path keys. */
function homePage(extra) {
  return Object.assign({}, pageDefinition, {
    data: structuredClone(pageDefinition.data),
    setData(patch, callback) {
      Object.keys(patch).forEach((key) => setPath(this.data, key, patch[key]));
      if (callback) callback();
    }
  }, extra);
}

/** Home page backed by a real repository over in-memory storage. */
function storedHome(extra) {
  const repository = new Repository(memoryStorage());
  repository.migrate();
  repository.saveSettings({ onboardingDone: true });
  const page = homePage(Object.assign({ repository, editorSession: new EditorSession(repository) }, extra));
  return { page, repository };
}

/** Makes getApp() hand out a connection manager remembering `saved()`. */
function rememberPrinter(t, saved, extra) {
  const previous = global.getApp;
  const manager = Object.assign({ getSavedDevice: () => (typeof saved === 'function' ? saved() : saved) }, extra);
  global.getApp = () => ({ globalData: { connectionManager: manager } });
  t.after(() => {
    if (previous) global.getApp = previous;
    else delete global.getApp;
  });
  return manager;
}

function useWx(t, api) {
  const previous = global.wx;
  global.wx = api;
  t.after(() => {
    if (previous) global.wx = previous;
    else delete global.wx;
  });
  return api;
}

const tap = (dataset) => ({ currentTarget: { dataset } });

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
  assert.doesNotMatch(markup, /授权改编/);
});

test('help explains the app plainly and makes no claims it cannot keep', () => {
  const markup = readHome('index.wxml');
  const help = markup.slice(markup.indexOf('showHelpSheet}}'), markup.indexOf('showOnboarding}}'));
  assert.doesNotMatch(help, /逐套设计并检查过可打印性|公开货架与场景模板均为商跃原创/);
  assert.doesNotMatch(help, /OFL|20 款/);
  assert.doesNotMatch(help, /连接诊断|样张验收|真机验证|MTU|GATT/);
  assert.match(help, /通过蓝牙连接 58mm、80mm 热敏打印机直接打印/);
  assert.doesNotMatch(help, /精臣|NIIMBOT|D11|B21/i);
  assert.match(help, /找不到打印机：打开手机蓝牙，把打印机靠近手机，确认它没有被其他手机连着/);
  assert.match(help, /打印尺寸不对：换成适合你打印机的模板或纸张/);
  assert.match(help, /在「我的」里导出备份/);
  assert.match(help, /部分字体需要联网下载/);
  assert.equal((help.match(/<text>[1-4]\. /g) || []).length, 4);
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
  assert.equal(page.data.templateTotal, queryCuratedMeta({ category: '零售' }).total);
  assert.ok(page.data.templateTotal >= 50);
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

test('showing more scene templates sends only the next page of cards', () => {
  const patches = [];
  const page = Object.assign({}, pageDefinition, {
    data: {
      templateCategory: '全部',
      templateIndustry: '场景模板',
      libraryScene: '全部',
      librarySize: '全部',
      templateQuery: '',
      templateVisibleCount: 24
    },
    userTemplates: [],
    setData(patch) {
      patches.push(patch);
      Object.keys(patch).forEach((key) => {
        const indexed = /^(\w+)\[(\d+)\]$/.exec(key);
        if (indexed) this.data[indexed[1]][Number(indexed[2])] = patch[key];
        else this.data[key] = patch[key];
      });
    }
  });
  page.refreshTemplates();
  page.loadMoreTemplates();
  const appended = patches[patches.length - 1];
  assert.equal(appended.visibleTemplates, undefined);
  assert.equal(Object.keys(appended).filter((key) => key.startsWith('visibleTemplates[')).length, 24);
  const ids = page.data.visibleTemplates.map((item) => item.id);
  assert.deepEqual(ids, queryCuratedMeta({ limit: 48 }).items.map((item) => item.id));
  assert.ok(page.data.visibleTemplates.every((item) => item.preview && item.preview.nodes.length));
  // Changing a filter or returning to the tab rebuilds the list from the same 48.
  page.refreshTemplates();
  assert.deepEqual(page.data.visibleTemplates.map((item) => item.id), ids);
});

test('batch picker offers the tagged curated templates only', () => {
  const picks = curatedBatchTemplates();
  assert.equal(pageDefinition.data.batchTemplateNames.length, picks.length);
  // Before a printer is known every pick says which printers it suits.
  assert.deepEqual(pageDefinition.data.batchTemplateNames, picks.map((item) => `${item.name}（适用 ${item.fitLabel}）`));
  assert.equal(pageDefinition.data.batchTemplateId, picks[0].id);
  assert.equal(pageDefinition.data.batchTemplateNames.some((name) => name.includes('商跃心意祝福卡')), false);
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
      getSettings: () => ({ defaultProfileId: 'escpos-58' }),
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

test('template preview names the printers that fit and the paper, not element counts', () => {
  const page = homePage({ userTemplates: [] });
  page.previewTemplate(tap({ id: 'shangyue-price-tag' }));
  const preview = page.data.previewTemplate;
  assert.equal(preview.fitLabel, '58mm · 80mm');
  assert.equal(preview.sizeText, '40×30 mm');
  assert.equal(preview.fitNotice, '');
  assert.equal(preview.elementSummary, undefined);
  assert.equal(preview.elementCount, undefined);

  // A document without shelf metadata is measured on the spot: 60 mm paper
  // is too wide for a 58 mm printer.
  const custom = homePage({
    resolveTemplate() {
      return { meta: { id: 'sample', name: '示例', sizeText: '60×40 mm' }, document: { widthMm: 60, heightMm: 40, elements: [] } };
    }
  });
  custom.previewTemplate(tap({ id: 'sample' }));
  assert.equal(custom.data.previewTemplate.fitLabel, '80mm');

  const markup = readHome('index.wxml');
  assert.match(markup, /'适用打印机：' \+ previewTemplate\.fitLabel/);
  assert.match(markup, /纸张 \{\{previewTemplate\.sizeText\}\}/);
  assert.doesNotMatch(markup, /elementSummary|elementCount|个元素/);
});

test('the preview warns when the remembered printer cannot print a template but still opens it', () => {
  let opened = null;
  const page = homePage({ userTemplates: [], openEditor(document) { opened = document; } });
  page.data.printerFamily = '5';
  page.data.printerFamilyLabel = '58mm';
  // 60×40 paper only an 80 mm printer takes.
  page.previewTemplate(tap({ id: 'sy-tpl-priceStandard-60x40-00' }));
  assert.equal(page.data.previewTemplate.fitLabel, '80mm');
  assert.equal(page.data.previewTemplate.fitNotice, '你的打印机（58mm）打印不了这个尺寸，可以换一个模板');
  page.usePreviewTemplate();
  assert.equal(opened.widthMm, 60);
  page.previewTemplate(tap({ id: 'shangyue-price-tag' }));
  assert.equal(page.data.previewTemplate.fitNotice, '');
  assert.match(readHome('index.wxml'), /wx:if="\{\{previewTemplate\.fitNotice\}\}"/);
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

test('创建 Wi-Fi 码 opens the Wi-Fi template from the public shelf', () => {
  let opened = null;
  const page = homePage({ openEditor(document) { opened = document; } });
  page.createWifiLabel();
  assert.ok(opened, 'the menu button must open a label');
  // `templates` is what the shelf shows; getTemplate() also finds hidden base templates.
  const meta = templates.find((item) => item.id === opened.templateMeta.templateId);
  assert.ok(meta, 'the Wi-Fi template must be a public template');
  assert.equal(meta.kind, 'qr');
  assert.ok(opened.elements.some((element) => element.type === 'qrcode'));
});

test('backup export writes and shares the file inside the tap, with dated names', (t) => {
  const calls = [];
  useWx(t, {
    env: { USER_DATA_PATH: 'wxfile://usr' },
    getFileSystemManager: () => ({
      writeFileSync(filePath, data, encoding) { calls.push({ name: 'write', filePath, data, encoding }); },
      readdirSync: () => ['niim-label-backup-1.json'],
      unlinkSync(filePath) { calls.push({ name: 'unlink', filePath }); }
    }),
    shareFileMessage(options) { calls.push({ name: 'share', options }); },
    showModal(options) { throw new Error(options.content); }
  });
  const page = homePage({ repository: { backup: () => ({ schemaVersion: 2, projects: [{ id: 'p1' }] }) } });
  assert.notEqual(pageDefinition.exportBackup.constructor.name, 'AsyncFunction');
  assert.equal(page.exportBackup(), undefined, 'no promise: the share must run inside the tap');
  assert.deepEqual(calls.map((call) => call.name), ['unlink', 'write', 'share']);
  const write = calls[1];
  assert.match(write.filePath, /^wxfile:\/\/usr\/shangyue-backup-\d{8}-\d{4}\.json$/);
  assert.equal(write.encoding, 'utf8');
  assert.equal(JSON.parse(write.data).projects[0].id, 'p1');
  assert.equal(calls[2].options.filePath, write.filePath);
  assert.match(calls[2].options.fileName, /^商跃标签备份-\d{8}-\d{4}\.json$/);
});

test('data export shares an Excel-ready CSV named in Chinese', (t) => {
  let written = null;
  let shared = null;
  useWx(t, {
    env: { USER_DATA_PATH: 'wxfile://usr' },
    getFileSystemManager: () => ({
      writeFileSync(filePath, data) { written = { filePath, data }; },
      readdirSync: () => [],
      unlinkSync() {}
    }),
    shareFileMessage(options) { shared = options; },
    showModal(options) { throw new Error(options.content); }
  });
  const page = homePage({ repository: { saveDataRows() {} } });
  page.data.dataRows = [{ id: 'a', name: '青苹果', code: '6901234567892', price: '9.9', date: '' }];
  assert.notEqual(pageDefinition.exportCsv.constructor.name, 'AsyncFunction');
  page.exportCsv();
  assert.ok(written.data.startsWith('﻿名称,编码/条码,价格,日期\r\n青苹果,'));
  assert.match(written.filePath, /^wxfile:\/\/usr\/shangyue-data-\d{8}\.csv$/);
  assert.match(shared.fileName, /^商跃标签数据-\d{8}\.csv$/);
});

function csvWx(t, state) {
  return useWx(t, {
    chooseMessageFile(options) {
      if (state.chooseFailure) options.fail(state.chooseFailure);
      else options.success({ tempFiles: [{ path: 'wxfile://tmp/data.csv', size: 100 }] });
    },
    getFileSystemManager: () => ({
      readFile(options) {
        if (state.readFails) options.fail({ errMsg: 'readFile:fail' });
        else options.success({ data: state.text });
      }
    }),
    showActionSheet(options) {
      state.sheet = options;
      if (state.sheetChoice !== undefined) options.success({ tapIndex: state.sheetChoice });
    },
    showModal(options) { state.modal = options; },
    showToast(options) { state.toast = options; }
  });
}

test('CSV import explains a non-UTF-8 file and never wipes the table with nothing', (t) => {
  const state = { text: '��,�\n1,2' };
  csvWx(t, state);
  let saves = 0;
  const page = homePage({ repository: { saveDataRows() { saves += 1; } } });
  page.data.dataRows = [{ id: 'keep', name: '已有', code: '', price: '', date: '' }];
  page.importCsv();
  assert.equal(state.modal.content, '文件编码不是 UTF-8。请在 Excel 里选择「另存为 → CSV UTF-8（逗号分隔）」后再导入。');
  state.modal = null;
  state.text = '';
  page.importCsv();
  assert.match(state.modal.content, /没有找到数据行/);
  state.modal = null;
  state.readFails = true;
  page.importCsv();
  assert.match(state.modal.content, /CSV UTF-8/);
  assert.equal(saves, 0);
  assert.equal(page.data.dataRows[0].id, 'keep');
});

test('CSV import keeps a headerless first row and maps Excel headers', (t) => {
  const state = { text: '青苹果,6901234567892,9.9,2026-09-01\n香蕉,BN-2001,5.5,', sheetChoice: 0 };
  csvWx(t, state);
  let saved = null;
  const page = homePage({ repository: { saveDataRows(rows) { saved = rows; } } });
  page.data.route = 'data';
  page.importCsv();
  assert.equal(state.modal, undefined);
  assert.equal(saved.length, 2);
  assert.equal(saved[0].name, '青苹果');
  assert.equal(page.data.dataRows[1].code, 'BN-2001');
  assert.equal(page.data.batchRowCount, 2);
  assert.match(state.toast.title, /已导入 2 行/);
  state.text = '﻿商品名称,售价,条码\n毛巾,8,T-9';
  page.importCsv();
  assert.match(state.sheet.itemList[0], /替换现有 2 行/, 'typed rows are not replaced without asking');
  assert.deepEqual([saved[0].name, saved[0].price, saved[0].code], ['毛巾', '8', 'T-9']);
  // Cancelling the file picker stays quiet.
  state.modal = null;
  state.chooseFailure = { errMsg: 'chooseMessageFile:fail cancel' };
  page.importCsv();
  assert.equal(state.modal, null);
});

test('a backup file that cannot be read says so in plain words instead of doing nothing', (t) => {
  let modal = null;
  let read = (options) => options.fail({ errMsg: 'readFile:fail no such file' });
  const api = useWx(t, {
    chooseMessageFile(options) { options.success({ tempFiles: [{ path: 'wxfile://tmp/b.json', size: 10 }] }); },
    getFileSystemManager: () => ({ readFile: (options) => read(options) }),
    showModal(options) { modal = options; }
  });
  const page = homePage({ repository: {} });
  page.importBackup();
  assert.equal(modal.title, '恢复失败');
  assert.doesNotMatch(modal.content, /[A-Za-z]{4,}/);
  // A damaged file must not surface the JSON parser's English message.
  modal = null;
  read = (options) => options.success({ data: '{"projects": [' });
  page.importBackup();
  assert.equal(modal.title, '恢复失败');
  assert.doesNotMatch(modal.content, /[A-Za-z]{4,}/);
  // Clients without the chat file picker explain instead of throwing.
  modal = null;
  delete api.chooseMessageFile;
  assert.doesNotThrow(() => page.importBackup());
  assert.match(modal.content, /升级微信/);
});

test('the data route explains where CSV files come from and leads back to 我的', () => {
  const markup = readHome('index.wxml');
  const data = markup.slice(markup.indexOf("route == 'data'"), markup.indexOf("route == 'profile'"));
  assert.match(data, /先把 CSV 文件发到微信聊天（如文件传输助手），再点「导入 CSV」/);
  assert.match(data, /class="back-button" data-route="profile" bindtap="navigate"/);
  assert.equal((data.match(/bindinput="onDataCellInput" bindblur="updateDataCell"/g) || []).length, 4);
  const page = homePage();
  page.data.route = 'data';
  page.navigate(tap({ route: 'profile' }));
  assert.equal(page.data.route, 'profile');
  assert.equal(page.data.routeTitle, '我的');
});

test('table typing is saved shortly after the last keystroke and at once on blur', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const saves = [];
  const page = homePage({ repository: { saveDataRows(rows) { saves.push(rows.map((row) => row.name)); } } });
  page.data.route = 'data';
  page.data.dataRows = [{ id: 'a', name: '', code: '', price: '', date: '' }];
  const cell = (value) => ({ currentTarget: { dataset: { index: 0, field: 'name' } }, detail: { value } });
  page.onDataCellInput(cell('青'));
  page.onDataCellInput(cell('青苹'));
  t.mock.timers.tick(399);
  assert.equal(saves.length, 0);
  t.mock.timers.tick(1);
  assert.deepEqual(saves, [['青苹']]);
  assert.equal(page.data.dataRows[0].name, '青苹');
  assert.equal(page.data.batchRowCount, 1);
  page.onDataCellInput(cell('青苹果'));
  page.updateDataCell(cell('青苹果'));
  assert.deepEqual(saves, [['青苹'], ['青苹果']]);
  t.mock.timers.tick(1000);
  assert.equal(saves.length, 2, 'blur already saved; the timer must not save again');
  page.updateDataCell(cell('青苹果'));
  assert.equal(saves.length, 2, 'an unchanged blur writes nothing');
});

test('storage failures in tap handlers are shown instead of thrown', (t) => {
  const modals = [];
  useWx(t, {
    showModal(options) {
      modals.push(options);
      if (options.success) options.success({ confirm: true });
    },
    showToast() {}
  });
  const full = () => { throw new Error('手机存储空间不足，请清理后重试'); };
  const page = homePage({
    repository: {
      saveSettings: full,
      getSettings: full,
      saveDataRows: full,
      deleteProject: full,
      deleteUserTemplate: full
    },
    refresh() { throw new Error('must not refresh after a failed write'); },
    projects: [{ id: 'p1', name: '价签' }]
  });
  page.data.settings = { density: 2, threshold: 180, labelType: 1, stockWidthMm: 40, stockHeightMm: 30 };
  page.data.dataRows = [{ id: 'a', name: '甲', code: '', price: '', date: '' }];
  page.data.previewTemplate = { id: 'u1', name: '我的', source: 'user' };
  const attempts = [
    () => page.chooseStockPreset(tap({ value: '50x30' })),
    () => page.updateStockField({ currentTarget: { dataset: { field: 'stockWidthMm' } }, detail: { value: '60' } }),
    () => page.updateSetting({ currentTarget: { dataset: { field: 'density' } }, detail: { value: 3 } }),
    () => page.addDataRow(),
    () => page.removeDataRow(tap({ index: 0 })),
    () => page.updateDataCell({ currentTarget: { dataset: { index: 0, field: 'name' } }, detail: { value: '乙' } }),
    () => page.deleteProject(tap({ id: 'p1' })),
    () => page.deletePreviewTemplate()
  ];
  attempts.forEach((attempt) => assert.doesNotThrow(attempt));
  const errors = modals.filter((modal) => modal.content === '手机存储空间不足，请清理后重试');
  assert.ok(errors.length >= 7, `expected a dialog per failed write, got ${errors.length}`);
  assert.equal(page.data.settings.stockWidthMm, 40);
  assert.equal(page.data.dataRows.length, 1);
  assert.doesNotThrow(() => page.finishOnboarding());
  assert.equal(page.data.showOnboarding, false, 'the guide closes even when storage fails');
});

test('changing the paper refreshes the home picks in the same update', () => {
  const { page } = storedHome();
  page.refresh();
  assert.equal(page.data.stockName, '50×30 mm 标签纸');
  assert.equal(page.data.recommendedSubtitle, '适合你的 50×30 标签纸');

  page.chooseStockPreset(tap({ value: '70x50' }));

  // Both halves of the paper card and the picks beside it agree at once; the
  // stale pair would send the owner to a label that does not fit the paper.
  assert.equal(page.data.stockName, '70×50 mm 标签纸');
  assert.equal(page.data.recommendedSubtitle, '适合你的 70×50 标签纸');
  assert.equal(page.data.recommendedTemplates.length, 6);
  assert.ok(page.data.recommendedTemplates.every((item) => item.sizeText === '70×50 mm'));
});

test('the paper type picker stores 1-4 like the editor does', () => {
  let saved = null;
  const page = homePage({ repository: { saveSettings(patch) { saved = patch; return Object.assign({ stockWidthMm: 40, stockHeightMm: 30 }, patch); } } });
  page.updateSetting({ currentTarget: { dataset: { field: 'labelType' } }, detail: { value: '1' } });
  assert.deepEqual(saved, { labelType: 2 });
  assert.equal(page.data.settings.labelType, 2);
});

test('the draft sheet can also discard the draft, after a confirmation', (t) => {
  let sheet = null;
  let confirm = null;
  const calls = [];
  useWx(t, {
    showActionSheet(options) { sheet = options; },
    showModal(options) { confirm = options; },
    navigateTo() { calls.push('navigate'); }
  });
  let draft = { document: { name: '旧草稿' }, projectId: '' };
  const page = homePage({
    editorSession: {
      recoverable: () => draft,
      discard() { calls.push('discard'); draft = null; },
      stage(document, projectId, options) { calls.push(['stage', document.name, options]); }
    }
  });
  const batch = { rows: [{ name: '甲' }], source: 'data' };
  page.openEditor({ name: '新标签' }, '', { batch });
  assert.deepEqual(sheet.itemList, ['继续编辑草稿', '保存草稿并打开新标签', '放弃草稿，打开新标签']);
  sheet.success({ tapIndex: 2 });
  assert.equal(confirm.confirmColor, '#E02D26');
  confirm.success({ confirm: false });
  assert.deepEqual(calls, []);
  confirm.success({ confirm: true });
  assert.deepEqual(calls, ['discard', ['stage', '新标签', { batch }], 'navigate']);
});

test('discarding the draft for a batch print keeps nothing of the old draft', (t) => {
  const { createDocument, createElement } = require('../miniprogram/core/document');
  const label = (name) => {
    const document = createDocument(40, 30);
    document.name = name;
    document.elements = [createElement('text', document)];
    return document;
  };
  let sheet = null;
  let confirm = null;
  let navigations = 0;
  const storage = memoryStorage();
  useWx(t, Object.assign(storage, {
    showActionSheet(options) { sheet = options; },
    showModal(options) { confirm = options; },
    navigateTo() { navigations += 1; }
  }));
  const repository = new Repository(storage);
  const editorSession = new EditorSession(repository);
  editorSession.checkpoint(label('旧草稿'), '', true);
  const page = homePage({ repository, editorSession });
  const rows = [{ id: 'r1', name: '甲', code: 'A-1', price: '', date: '' }];
  page.openEditor(label('批量底稿'), '', { batch: { rows, source: 'data' } });
  sheet.success({ tapIndex: 2 });
  assert.equal(navigations, 0, 'nothing is thrown away before the user confirms');
  confirm.success({ confirm: true });
  assert.equal(navigations, 1);
  assert.equal(repository.getProjects().length, 0, 'the old draft was discarded, not saved');
  const opened = new EditorSession(repository).open({});
  assert.equal(opened.document.name, '批量底稿');
  assert.deepEqual(opened.batch, { rows, source: 'data' });
});

const DATA_FIELDS = ['name', 'code', 'price', 'date'];

test('批量打印 checks every row first, then opens the editor in batch mode', (t) => {
  let modal = null;
  let staged = null;
  useWx(t, { showModal(options) { modal = options; }, showToast() {}, navigateTo() {} });
  const page = homePage({
    repository: { saveDataRows() {} },
    editorSession: { recoverable: () => null, stage(document, projectId, options) { staged = { document, projectId, options }; } },
    navigateEditor() {}
  });
  page.data.dataRows = [
    { id: 'r1', name: '青苹果', code: '6901234567892', price: '9.9', date: '' },
    { id: 'r2', name: '', code: '', price: '', date: '' },
    { id: 'r3', name: '香蕉', code: '', price: '5.5', date: '' }
  ];
  page.printBatch();
  assert.equal(staged, null);
  assert.equal(modal.content, '第 3 行无法生成：请先填写条码内容');

  modal = null;
  page.data.dataRows[2] = { id: 'r3', name: '香蕉', code: 'BN-2001', price: '5.5', date: '' };
  page.printBatch();
  assert.equal(modal, null);
  assert.equal(staged.projectId, '');
  assert.equal(staged.document.templateMeta.libraryId, page.data.batchTemplateId);
  assert.equal(staged.document.templateMeta.batchCompatible, true);
  assert.equal(staged.options.batch.source, 'data');
  assert.deepEqual(staged.options.batch.rows.map((row) => row.name), ['青苹果', '', '香蕉'], 'row numbers match the table');
  assert.ok(staged.options.batch.rows.every((row) => DATA_FIELDS.every((field) => typeof row[field] === 'string')));

  const markup = readHome('index.wxml');
  assert.match(markup, /bindtap="printBatch" disabled="\{\{!batchRowCount\}\}">批量打印 \{\{batchRowCount\}\} 张/);
  assert.match(markup, /bindtap="runBatch" disabled="\{\{!batchRowCount \|\| batchRowCount > projectRoom\}\}">生成 \{\{batchRowCount\}\} 个标签（分别保存）/);
});

test('share menu offers chats and Moments, and 我的 has a feedback entry', (t) => {
  let menu = null;
  useWx(t, { getWindowInfo: () => ({}), showShareMenu(options) { menu = options; } });
  const previousApp = global.getApp;
  global.getApp = () => ({ globalData: { repository: {} } });
  t.after(() => { if (previousApp) global.getApp = previousApp; else delete global.getApp; });
  const page = homePage({ bindConnectionState() {}, refresh() {} });
  page.onLoad();
  assert.deepEqual(menu.menus, ['shareAppMessage', 'shareTimeline']);
  assert.deepEqual(page.onShareAppMessage(), { title: '商跃标签：手机设计标签，蓝牙直接打印', path: '/pages/home/index' });
  assert.equal(page.onShareTimeline().title, '商跃标签：手机设计标签，蓝牙直接打印');
  const markup = readHome('index.wxml');
  assert.match(markup, /<button open-type="feedback"><text class="menu-icon icon icon-pencil"[^>]*><\/text><view><text>意见反馈<\/text><text class="menu-note">打印机连不上、模板不合适都可以告诉我们<\/text>/);
});

test('settings copy says what the black-and-white threshold affects', () => {
  const markup = readHome('index.wxml');
  // It decides black or white for every dot of the label, not only pictures.
  assert.match(markup, /<text>黑白阈值<\/text>/);
  assert.match(markup, /影响整张标签：数值越大，浅灰越容易打成黑色。默认 180/);
  assert.doesNotMatch(markup, /只影响图片和素材/);
  assert.match(markup, /\{\{densityAdjustable \? '浓度 ' \+ settings\.density \+ ' · ' : ''\}\}黑白阈值 \{\{settings\.threshold\}\}/);
  assert.doesNotMatch(markup, /· 阈值/);
});

test('a thermal printer keeps its own density, so home offers none to set', () => {
  const { page } = storedHome();
  page.refresh();
  assert.equal(page.data.densityAdjustable, false, 'both thermal models fix density at the printer');
  const markup = readHome('index.wxml');
  assert.match(markup, /<view wx:if="\{\{densityAdjustable\}\}" class="setting-row"><view class="setting-label"><text>打印浓度<\/text>/);
});

test('without a remembered printer the shelf shows everything with fit labels', () => {
  const { page } = storedHome();
  page.refresh();
  assert.equal(page.data.storageError, '');
  assert.equal(page.data.printerFamily, '');
  assert.equal(page.data.stockName, '50×30 mm 标签纸');
  assert.equal(page.data.stockFitHint, '');
  // The home picks are templates for the paper in use (50×30 by default).
  assert.equal(page.data.recommendedSubtitle, '适合你的 50×30 标签纸');
  assert.equal(page.data.recommendedTemplates.length, 6);
  assert.ok(page.data.recommendedTemplates.every((item) => item.sizeText === '50×30 mm'));
  assert.ok(page.data.recommendedTemplates.every((item) => item.fitLabel && item.fitText === `适用 ${item.fitLabel}`));
  assert.equal(page.data.libraryTotal, curatedStats().total);
  assert.equal(page.data.templateTotal, templates.length);
  assert.ok(page.data.visibleTemplates.every((item) => item.fitLabel && !item.fitMismatch));
  const markup = readHome('index.wxml');
  assert.match(markup, /<button wx:if="\{\{printerFamily\}\}" class="chip filter-chip family-chip/);
  assert.match(markup, /只看 \{\{printerFamilyLabel\}\} 能打印的/);
  assert.equal((markup.match(/class="card-fit \{\{item\.fitMismatch \? 'mismatch' : ''\}\}">\{\{item\.fitText\}\}/g) || []).length, 2);
  assert.match(markup, /<text class="stock-name">\{\{stockName\}\}<\/text>/);
  assert.doesNotMatch(markup, /203 空白标签|>T\{\{/);
});

test('a remembered 58mm printer narrows the shelf, home picks and paper hint to what it prints', (t) => {
  rememberPrinter(t, { deviceId: 'syd-1', name: 'SYD-58' });
  const { page, repository } = storedHome();
  repository.saveSettings({ stockWidthMm: 60, stockHeightMm: 40 });
  page.refresh();
  assert.equal(page.data.printerFamily, '5');
  assert.equal(page.data.printerFamilyLabel, '58mm');
  assert.equal(page.data.stockName, '60×40 mm 标签纸');
  assert.equal(page.data.stockFitHint, '这台打印机装不下这个尺寸，请换纸');
  // 50 mm paper is wider than the 48 mm head but still fits a 58 mm printer.
  assert.equal(page.stockPatch({ stockWidthMm: 50, stockHeightMm: 30 }).stockFitHint, '');

  assert.equal(page.data.recommendedSubtitle, '适合你的 58mm 打印机');
  const picks = page.data.recommendedTemplates;
  assert.equal(picks.length, 6);
  assert.ok(picks.every((item) => item.fitFamilies.includes('5') && !item.fitMismatch));
  // Every built-in template prints on 58 mm, so they fill the picks first.
  assert.deepEqual(picks.map((item) => item.id), templates.slice(0, 6).map((item) => item.id), 'built-in templates first');

  assert.ok(page.data.visibleTemplates.length > 0);
  assert.ok(page.data.visibleTemplates.every((item) => item.fitFamilies.includes('5')));
  assert.deepEqual(page.data.batchTemplateNames, curatedBatchTemplates('5').map((item) => item.name));
  assert.ok(curatedBatchTemplates('5').length < curatedBatchTemplates().length, 'picks too wide for 58 mm are left out');

  page.setTemplateIndustry(tap({ value: '场景模板' }));
  assert.equal(page.data.templateTotal, queryCuratedMeta({ family: '5' }).total);
  assert.ok(page.data.templateTotal < curatedStats().total, 'templates only an 80 mm printer prints are hidden');
  assert.deepEqual(page.data.libraryScenes, curatedCategoryChips('5'));
  assert.deepEqual(page.data.librarySizes, curatedSizeChips('5'));
  assert.equal(page.data.libraryTotal, curatedStats('5').total);
  assert.ok(page.data.visibleTemplates.every((item) => item.fitFamilies.includes('5')));

  // Switching 「只看…」 off shows the whole shelf, marking what this printer cannot print.
  page.toggleFamilyFilter();
  assert.equal(page.data.familyFilterOn, false);
  assert.equal(page.data.templateTotal, curatedStats().total);
  assert.deepEqual(page.data.libraryScenes, curatedCategoryChips());
  assert.ok(page.data.visibleTemplates.some((item) => item.fitMismatch));
  assert.deepEqual(page.data.batchTemplateNames, curatedBatchTemplates().map((item) => `${item.name}（适用 ${item.fitLabel}）`));
  page.toggleFamilyFilter();
  assert.equal(page.data.templateTotal, curatedStats('5').total);
});

test('a size chip the printer family does not have falls back to 全部', (t) => {
  rememberPrinter(t, { deviceId: 'syd-1', name: 'SYD-58' });
  const { page } = storedHome();
  assert.ok(curatedSizeChips().includes('60×40') && !curatedSizeChips('5').includes('60×40'));
  page.data.libraryScene = '零售';
  page.data.librarySize = '60×40';
  page.data.templateIndustry = '场景模板';
  page.refresh();
  assert.equal(page.data.librarySize, '全部');
  assert.equal(page.data.libraryScene, '零售', 'a scene this printer has stays chosen');
  assert.equal(page.data.templateTotal, queryCuratedMeta({ family: '5', category: '零售' }).total);
});

test('one 58mm printer with 50×30 paper sees 50×30 templates first', (t) => {
  rememberPrinter(t, { deviceId: 'ey-1', name: 'EY-260' });
  const { page, repository } = storedHome();
  repository.saveSettings({ stockWidthMm: 50, stockHeightMm: 30 });
  page.refresh();
  assert.equal(page.data.recommendedSubtitle, '适合你的 58mm 打印机和 50×30 标签纸');
  assert.equal(page.data.recommendedTemplates.length, 6);
  assert.ok(page.data.recommendedTemplates.every((item) => item.sizeText === '50×30 mm' && item.fitFamilies.includes('5')));

  // The scene shelf opens on the paper size; 全部 is still there.
  page.setTemplateIndustry(tap({ value: '场景模板' }));
  assert.equal(page.data.librarySize, '50×30');
  assert.equal(page.data.templateTotal, queryCuratedMeta({ family: '5', size: '50×30' }).total);
  assert.ok(page.data.visibleTemplates.every((item) => item.sizeText === '50×30 mm'));
  page.setLibrarySize(tap({ value: '全部' }));
  assert.equal(page.data.templateTotal, queryCuratedMeta({ family: '5' }).total);

  // Paper the shelf has nothing for keeps the printer's picks.
  repository.saveSettings({ stockWidthMm: 33, stockHeightMm: 21 });
  page.refresh();
  assert.equal(page.data.recommendedSubtitle, '适合你的 58mm 打印机');
});

test('a remembered printer without a model pick goes by its name, as it does when it connects', (t) => {
  let saved = { deviceId: 'syd-2', name: 'SYD-80' };
  rememberPrinter(t, () => saved);
  const { page, repository } = storedHome();
  page.refresh();
  assert.equal(page.data.printerFamily, '8');
  assert.equal(page.data.printerFamilyLabel, '80mm');
  assert.equal(page.data.recommendedSubtitle, '适合你的 80mm 打印机和 50×30 标签纸');

  // A name that gives no paper width counts as 58 mm, whatever model was used last.
  saved = { deviceId: 'ey-1', name: 'EY-260' };
  repository.saveSettings({ defaultProfileId: 'escpos-80' });
  page.refresh();
  assert.equal(page.data.printerFamily, '5');
  assert.equal(page.data.printerFamilyLabel, '58mm');
});

test('searching the 全部 tab also finds matching scene templates, after the built-in ones', () => {
  const page = homePage({ userTemplates: [] });
  page.data.templateQuery = '价签';
  page.data.templateVisibleCount = 500;
  page.refreshTemplates();
  const builtIn = templates.filter((item) => [item.name, item.category, item.industry, item.blurb]
    .some((value) => String(value || '').includes('价签')));
  const curated = queryCuratedMeta({ query: '价签' });
  assert.ok(curated.total > 0);
  assert.equal(page.data.templateTotal, builtIn.length + curated.total);
  const firstCurated = page.data.visibleTemplates.findIndex((item) => item.source === 'shangyue-curated');
  assert.equal(firstCurated, builtIn.length);
  assert.ok(page.data.visibleTemplates.slice(firstCurated).every((item) => item.source === 'shangyue-curated'));
  // Paging shows the rest of the combined list.
  page.data.templateVisibleCount = 24;
  page.refreshTemplates();
  assert.equal(page.data.visibleTemplates.length, 24);
  page.loadMoreTemplates();
  assert.equal(page.data.visibleTemplates.length, Math.min(48, page.data.templateTotal));
});

test('the model the user picked for a printer decides the shelf over its name', (t) => {
  let saved = { deviceId: 'syd-1', name: 'SYD-58', confirmedProfileId: 'escpos-80' };
  rememberPrinter(t, () => saved, { getConfirmedProfileId: (deviceId) => (deviceId === saved.deviceId ? saved.confirmedProfileId || '' : '') });
  useWx(t, { showToast() {} });
  const { page, repository } = storedHome();
  page.refresh();
  assert.equal(page.data.printerFamily, '8');

  page.onPrinterConnected({ detail: { result: { deviceId: 'syd-1', name: 'SYD-58' }, device: { deviceId: 'syd-1' } } });
  assert.equal(repository.getSettings().defaultProfileId, 'escpos-80');
  assert.equal(page.data.printerFamily, '8');

  // Without a pick the name decides.
  saved = { deviceId: 'syd-1', name: 'SYD-58' };
  page.onPrinterConnected({ detail: { result: { deviceId: 'syd-1', name: 'SYD-58' }, device: { deviceId: 'syd-1' } } });
  assert.equal(repository.getSettings().defaultProfileId, 'escpos-58');
  assert.equal(page.data.printerFamily, '5');

  // A pick saved by an older version names a model the app no longer has: the name decides.
  saved = { deviceId: 'syd-2', name: 'SYD-80', confirmedProfileId: 'd110' };
  page.onPrinterConnected({ detail: { result: { deviceId: 'syd-2', name: 'SYD-80' }, device: { deviceId: 'syd-2' } } });
  assert.equal(repository.getSettings().defaultProfileId, 'escpos-80');
  assert.equal(page.data.printerFamily, '8');
});

test('the printer button opens the picker in place; connecting remembers the model', (t) => {
  let saved = null;
  rememberPrinter(t, () => saved);
  let toast = null;
  useWx(t, { showToast(options) { toast = options; } });
  const { page, repository } = storedHome();
  page.refresh();
  assert.equal(page.data.printerFamily, '');
  page.openDevices();
  assert.equal(page.data.showDevices, true);
  page.closeDevices();
  assert.equal(page.data.showDevices, false);
  page.openDevices();
  saved = { deviceId: 'syd-2', name: 'SYD-80' };
  page.onPrinterConnected({ detail: {
    result: { deviceId: 'syd-2', name: 'SYD-80' },
    device: { deviceId: 'syd-2', name: 'SYD-80' }
  } });
  assert.equal(page.data.showDevices, false);
  assert.equal(toast.title, '已连接 SYD-80');
  assert.equal(repository.getSettings().defaultProfileId, 'escpos-80');
  assert.equal(page.data.printerFamily, '8');
  assert.equal(page.data.recommendedSubtitle, '适合你的 80mm 打印机和 50×30 标签纸');

  // 忘记设备 inside the picker: closing it stops filtering by that printer.
  page.openDevices();
  saved = null;
  page.closeDevices();
  assert.equal(page.data.printerFamily, '');
  assert.equal(page.data.recommendedSubtitle, '适合你的 50×30 标签纸');

  // A printer whose name gives no paper width counts as 58 mm.
  saved = { deviceId: 'ey-1', name: 'EY-260' };
  page.onPrinterConnected({ detail: {
    result: { deviceId: 'ey-1', name: 'EY-260' },
    device: { deviceId: 'ey-1', name: 'EY-260' }
  } });
  assert.equal(repository.getSettings().defaultProfileId, 'escpos-58');
  assert.equal(page.data.printerFamily, '5');
  assert.equal(page.data.recommendedSubtitle, '适合你的 58mm 打印机和 50×30 标签纸');

  const json = JSON.parse(readHome('index.json'));
  assert.equal(json.usingComponents['printer-picker'], '/components/printer-picker/index');
  assert.match(readHome('index.wxml'), /<printer-picker show="\{\{showDevices\}\}" bind:close="closeDevices" bind:connected="onPrinterConnected" \/>/);
  assert.doesNotMatch(readHome('index.js'), /devices=1/);
});

test('a quiet automatic reconnect reads 未连接; one the user started reads 连接中', (t) => {
  let listener = null;
  rememberPrinter(t, null, {
    subscribe(callback) { listener = callback; return () => {}; },
    getState: () => ({ status: 'connecting', device: { name: 'SYD-58' }, background: true })
  });
  const page = homePage();
  page.bindConnectionState();
  assert.deepEqual([page.data.connected, page.data.connectionLabel], [false, '未连接']);
  listener({ status: 'connecting', device: { name: 'SYD-58' }, background: false });
  assert.equal(page.data.connectionLabel, '连接中…');
  listener({ status: 'connected', device: { name: 'SYD-58' }, background: false });
  assert.deepEqual([page.data.connected, page.data.connectionLabel], [true, 'SYD-58']);
  listener({ status: 'disconnected', device: null, background: false });
  assert.equal(page.data.connectionLabel, '未连接');
});

test('a sample row whose date the owner edited is not replaced by an import without asking', (t) => {
  const state = { text: '毛巾,8,T-9,2026-12-01\n' };
  csvWx(t, state);
  let saves = 0;
  const page = homePage({ repository: { saveDataRows() { saves += 1; } } });
  page.data.route = 'data';
  // The untouched example rows may be replaced silently…
  page.data.dataRows = defaultRows();
  page.importCsv();
  assert.equal(state.sheet, undefined, 'an untouched example never asks');
  assert.equal(saves, 1);

  // …but a row the owner typed into — even only its date — must ask first.
  state.sheet = undefined;
  state.toast = undefined;
  page.data.dataRows = defaultRows().map((row) => Object.assign({}, row));
  page.data.dataRows[0].date = '2026-12-31';
  page.importCsv();
  assert.ok(state.sheet, 'the owner data prompts for replace or append');
  assert.match(state.sheet.itemList[0], /替换现有 1 行/);
});
