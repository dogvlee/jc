const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { normalizeSearchText, queryCuratedMeta } = require('../miniprogram/app/curated/index');
const { createDocument, createElement } = require('../miniprogram/core/document');
const { buildMiniPreview } = require('../miniprogram/core/mini-preview');
const { findExcelDamagedCodes } = require('../miniprogram/services/csv');
const { EditorSession } = require('../miniprogram/services/editor-session');
const { localizeUrl } = require('../miniprogram/services/remote-image-cache');
const { KEYS, Repository } = require('../miniprogram/services/repository');

let pageDefinition = null;
global.Page = (definition) => { pageDefinition = definition; };
require('../miniprogram/pages/home/index');
delete global.Page;

const read = (name) => fs.readFileSync(path.join(__dirname, '..', 'miniprogram', 'pages', 'home', name), 'utf8');
const tap = (dataset) => ({ currentTarget: { dataset } });
const cell = (index, field, value) => ({ currentTarget: { dataset: { index, field } }, detail: { value } });

function memoryStorage() {
  const values = new Map();
  return {
    values,
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

/** Home page instance; every setData patch is kept in `patches`. */
function homePage(extra) {
  return Object.assign({}, pageDefinition, {
    data: structuredClone(pageDefinition.data),
    patches: [],
    setData(patch, callback) {
      this.patches.push(patch);
      Object.keys(patch).forEach((key) => setPath(this.data, key, patch[key]));
      if (callback) callback();
    }
  }, extra);
}

function storedHome(api, extra) {
  const storage = api || memoryStorage();
  const repository = new Repository(storage);
  repository.migrate();
  repository.saveSettings({ onboardingDone: true });
  const page = homePage(Object.assign({ repository, editorSession: new EditorSession(repository) }, extra));
  return { page, repository, storage };
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

function csvApi(state) {
  return {
    chooseMessageFile(options) { options.success({ tempFiles: [{ path: 'wxfile://tmp/data.csv', size: 100 }] }); },
    getFileSystemManager: () => ({ readFile(options) { options.success({ data: state.text }); } }),
    showActionSheet(options) { state.sheet = options; },
    showModal(options) { state.modal = options; },
    showToast(options) { state.toast = options; }
  };
}

async function settle(rounds = 6) {
  for (let index = 0; index < rounds; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function label(name) {
  const document = createDocument(40, 30);
  document.name = name;
  return document;
}

test('importing a CSV over rows the user typed asks to replace or append; sample rows go quietly', (t) => {
  const state = { text: '苹果,6901234567892,9.9,\n香蕉,BN-2001,5.5,' };
  useWx(t, csvApi(state));
  const { page, repository } = storedHome();
  page.refresh();
  page.navigate(tap({ route: 'data' }));

  // The table still holds the sample rows: nobody typed them.
  page.importCsv();
  assert.equal(state.sheet, undefined);
  assert.deepEqual(repository.getDataRows().map((row) => row.name), ['苹果', '香蕉']);

  state.text = '橙子,OR-1,3,';
  page.importCsv();
  assert.deepEqual(state.sheet.itemList, ['替换现有 2 行', '追加到后面']);
  assert.equal(state.sheet.alertText, '表格里已有 2 行数据');
  assert.equal(repository.getDataRows().length, 2, 'nothing changes before the answer');
  state.sheet.success({ tapIndex: 1 });
  assert.deepEqual(repository.getDataRows().map((row) => row.name), ['苹果', '香蕉', '橙子']);
  assert.deepEqual(page.data.dataRows.map((row) => row.name), ['苹果', '香蕉', '橙子']);
  assert.equal(state.toast.title, '已追加 1 行');

  state.sheet = undefined;
  page.importCsv();
  state.sheet.success({ tapIndex: 0 });
  assert.deepEqual(repository.getDataRows().map((row) => row.name), ['橙子']);
  assert.equal(state.toast.title, '已导入 1 行');
});

test('a CSV whose codes Excel turned into 6.90123E+12 is refused with the steps to fix it', (t) => {
  const state = { text: '名称,条码,价格\n牛奶,6.90123E+12,5\n面包,6901234567892,3' };
  useWx(t, csvApi(state));
  const { page, repository } = storedHome();
  page.refresh();
  const before = repository.getDataRows();
  page.importCsv();
  assert.equal(state.modal.title, '条码被 Excel 改坏了');
  assert.match(state.modal.content, /第 1 行的编码变成了“6\.90123E\+12”/);
  assert.match(state.modal.content, /设成「文本」/);
  assert.deepEqual(repository.getDataRows(), before);
  // Excel always writes the sign, so a code like 1E5 is left alone.
  assert.deepEqual(findExcelDamagedCodes([{ code: '6.90123E+12' }, { code: '6901234567892' }, { code: '1E5' }, { code: '1E+05' }]), [1, 4]);
});

test('a print record opens as a new label, so saving cannot overwrite a newer version', () => {
  let opened = null;
  const page = homePage({
    printHistoryRecords: [{ id: 'h1', projectId: 'p1', document: label('旧价签') }],
    openEditor(document, projectId) { opened = { document, projectId }; }
  });
  page.openHistoryItem(tap({ id: 'h1' }));
  assert.equal(opened.projectId, '');
  assert.equal(opened.document.name, '旧价签');
});

test('restoring a backup drops bad table rows and print records one by one', () => {
  const { page, repository } = storedHome();
  const payload = Object.assign(repository.backup(), {
    projects: [{ id: 'p1', name: '价签', document: label('价签'), updatedAt: 1 }],
    dataRows: [{ id: 'r1', name: '苹果', code: 690, price: 9.9, date: '' }, null, { id: 'r2', name: { bad: true } }, 'x'],
    printHistory: [null, { id: 'h1', name: '价签', result: 'success', at: 5, message: '已完成 1 份' }, 42]
  });
  const checked = repository.inspectBackup(payload);
  assert.deepEqual(checked.dataRows, [{ id: 'r1', name: '苹果', code: '690', price: '9.9', date: '' }]);
  assert.deepEqual(checked.printHistory.map((item) => item.id), ['h1']);
  repository.restore(payload);
  page.refresh();
  assert.equal(page.data.storageError, '');
  assert.equal(page.data.historyTotal, 1);
  assert.equal(page.data.printHistory[0].name, '价签');
  assert.equal(page.data.projectTotal, 1);
});

test('a broken print record already stored no longer locks the home page', () => {
  const { page, storage } = storedHome();
  storage.setStorageSync(KEYS.printHistory, [null, { id: 'h1', name: '价签', result: 'failed', message: 'writeBLECharacteristicValue:fail' }]);
  page.refresh();
  assert.equal(page.data.storageError, '');
  assert.equal(page.data.printHistory.length, 1);
  assert.equal(page.data.printHistory[0].message, '打印失败');
});

test('a damaged label is hidden with a notice; cleaning it up lets saving work again', (t) => {
  const { page, repository, storage } = storedHome();
  const good = repository.saveProject(label('好的'));
  const stored = storage.getStorageSync(KEYS.projects);
  stored.push({ id: 'broken', document: { widthMm: 0, heightMm: 12 } });
  storage.setStorageSync(KEYS.projects, stored);

  page.refresh();
  assert.equal(page.data.storageError, '', 'the other labels stay usable');
  assert.deepEqual(page.data.allProjects.map((item) => item.name), ['好的']);
  assert.equal(page.data.damagedRecords, 1);
  // Saving keeps refusing until the user agrees to remove the damaged record.
  assert.throws(() => repository.saveProject(createDocument(40, 30)), { code: 'STORAGE_DATA_INVALID' });

  let modal = null;
  useWx(t, { showModal(options) { modal = options; }, showToast() {} });
  page.cleanDamagedRecords();
  assert.equal(modal.confirmColor, '#E02D26');
  modal.success({ confirm: true });
  assert.equal(page.data.damagedRecords, 0);
  assert.doesNotThrow(() => repository.saveProject(createDocument(40, 30)));
  assert.ok(repository.getProjects().some((item) => item.id === good.id));
  const markup = read('index.wxml');
  assert.match(markup, /bindtap="cleanDamagedRecords">清理<\/button>/);
});

test('a damaged draft offers to discard it instead of showing the error page', (t) => {
  const { page, storage } = storedHome();
  storage.setStorageSync(KEYS.editorAutosave, { document: { widthMm: -1 }, dirtySinceSave: true });
  page.refresh();
  assert.equal(page.data.storageError, '');
  assert.equal(page.data.recoveryDraft.damaged, true);
  let modal = null;
  useWx(t, { showModal(options) { modal = options; } });
  page.discardDraft();
  assert.equal(modal.title, '放弃损坏的草稿？');
  assert.equal(modal.confirmColor, '#E02D26');
  modal.success({ confirm: true });
  assert.equal(page.data.recoveryDraft, null);
  assert.match(read('index.wxml'), /wx:if="\{\{recoveryDraft && recoveryDraft\.damaged\}\}"/);
});

test('the storage error page never shows an English exception', () => {
  const page = homePage({ repository: { migrate() { throw new TypeError("Cannot read properties of null (reading 'id')"); } } });
  page.refresh();
  assert.doesNotMatch(page.data.storageError, /[A-Za-z]{4,}/);
  assert.match(page.data.storageError, /本地数据读取失败/);
});

test('the first onShow right after onLoad does not read storage again', (t) => {
  useWx(t, { getWindowInfo: () => ({}), showShareMenu() {}, getStorageSync: () => '', removeStorageSync() {} });
  const previousApp = global.getApp;
  global.getApp = () => ({ globalData: { repository: {} } });
  t.after(() => { if (previousApp) global.getApp = previousApp; else delete global.getApp; });
  let refreshes = 0;
  const page = homePage({ bindConnectionState() {}, refresh() { refreshes += 1; } });
  page.onLoad();
  page.onShow();
  assert.equal(refreshes, 1);
  page.onShow();
  assert.equal(refreshes, 2, 'coming back later reads storage again');
});

test('the batch table reaches the page only on the data route; a typed cell sends only that cell', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { page, repository } = storedHome();
  repository.saveDataRows(Array.from({ length: 50 }, (item, index) => ({ id: `r${index}`, name: `商品${index}`, code: '', price: '', date: '' })));
  page.refresh();
  assert.equal('dataRows' in page.patches[page.patches.length - 1], false, 'the home route gets no table');
  assert.equal(page.data.batchRowCount, 50);

  page.navigate(tap({ route: 'data' }));
  assert.equal(page.data.dataRows.length, 50);
  page.patches.length = 0;
  page.onDataCellInput(cell(3, 'price', '9.9'));
  t.mock.timers.tick(400);
  const sent = page.patches.flatMap((patch) => Object.keys(patch).filter((key) => key.startsWith('dataRows')));
  assert.deepEqual(sent, ['dataRows[3].price']);
  assert.equal(page.data.dataRows[3].price, '9.9');
  assert.equal(repository.getDataRows()[3].price, '9.9');
});

test('coming back to the home page resends neither template cards nor home picks that did not change', () => {
  const { page, repository } = storedHome();
  page.refresh();
  page.setTemplateIndustry(tap({ value: '场景模板' }));
  page.loadMoreTemplates();
  assert.equal(page.data.visibleTemplates.length, 48);
  page.patches.length = 0;
  page.refresh();
  assert.equal(page.patches.length, 1, 'one setData per refresh');
  assert.equal('visibleTemplates' in page.patches[0], false);
  assert.equal('recommendedTemplates' in page.patches[0], false);
  assert.equal(page.data.visibleTemplates.length, 48);

  // A new user template is something the shelf shows, so it is rebuilt.
  repository.saveUserTemplate(label('我的价签'), '我的价签');
  page.patches.length = 0;
  page.refresh();
  assert.ok('visibleTemplates' in page.patches[0]);
});

test('the 我的 tab shows every user template whatever category another tab picked', () => {
  const { page, repository } = storedHome();
  repository.saveUserTemplate(label('我的价签'), '我的价签');
  page.refresh();
  page.setTemplateCategory(tap({ value: '零售' }));
  page.setTemplateIndustry(tap({ value: '我的' }));
  assert.deepEqual(page.data.visibleTemplates.map((item) => item.name), ['我的价签']);
  const markup = read('index.wxml');
  assert.match(markup, /<block wx:elif="\{\{templateIndustry != '我的'\}\}">/);
  assert.match(markup, /还没有我的模板/);
  assert.match(markup, /在编辑器「模板」里点「将当前标签保存为模板」/);
  // The tabs people need most come first on narrow screens.
  const tabs = markup.slice(markup.indexOf('class="filter-row tab-row"'));
  assert.ok(tabs.indexOf('data-value="全部"') < tabs.indexOf('data-value="场景模板"'));
  assert.ok(tabs.indexOf('data-value="场景模板"') < tabs.indexOf('data-value="我的"'));
  assert.ok(tabs.indexOf('data-value="我的"') < tabs.indexOf('wx:for="{{industries}}"'));
});

test('template search understands 40x30, 40*30, 40 30 and wifi, and waits for typing to pause', (t) => {
  assert.equal(normalizeSearchText('４０X３０'), '40×30');
  assert.equal(normalizeSearchText('Wi-Fi'), 'wifi');
  const total = queryCuratedMeta({ query: '40×30' }).total;
  assert.ok(total > 0);
  ['40x30', '40*30', '40 30', '40X30'].forEach((query) => assert.equal(queryCuratedMeta({ query }).total, total, query));
  assert.ok(queryCuratedMeta({ query: 'wifi' }).total > 0);
  assert.equal(queryCuratedMeta({ query: 'wifi' }).total, queryCuratedMeta({ query: 'Wi-Fi' }).total);

  t.mock.timers.enable({ apis: ['setTimeout'] });
  const page = homePage({ userTemplates: [] });
  page.onTemplateSearch({ detail: { value: '4' } });
  page.onTemplateSearch({ detail: { value: '40x' } });
  page.onTemplateSearch({ detail: { value: '40x30' } });
  assert.equal(page.data.templateQuery, '', 'nothing is filtered while typing');
  t.mock.timers.tick(250);
  assert.equal(page.data.templateQuery, '40x30');
  assert.ok(page.data.visibleTemplates.length > 0);
  assert.ok(page.data.visibleTemplates.every((item) => item.sizeText === '40×30 mm'));
});

test('生成标签 runs once per tap and is refused when the labels would not fit', (t) => {
  const modals = [];
  useWx(t, { showModal(options) { modals.push(options); }, showToast() {} });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let saves = 0;
  const page = homePage({
    repository: {
      saveDataRows() {},
      saveProjects(documents) { saves += 1; return documents.map((document, index) => ({ id: `p${index}`, document })); }
    },
    refresh() {},
    openEditor() {}
  });
  page.data.dataRows = [{ id: 'r1', name: '苹果', code: '6901234567892', price: '9.9', date: '' }];
  page.data.batchRowCount = 1;
  page.runBatch();
  page.runBatch();
  assert.equal(saves, 1, 'a second tap while saving does nothing');
  t.mock.timers.tick(350);
  page.data.projectRoom = 0;
  page.runBatch();
  assert.equal(saves, 1);
  assert.match(modals[modals.length - 1].content, /最多还能存 0 个标签/);
  assert.match(read('index.wxml'), /最多还能存 \{\{projectRoom\}\} 个标签/);
});

test('a table edit storage refuses stays on screen with a notice and a retry', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  useWx(t, { showModal() {}, showToast() {} });
  const storage = memoryStorage();
  const { page, repository } = storedHome(storage);
  repository.saveDataRows([{ id: 'a', name: '旧名字', code: '', price: '', date: '' }]);
  page.refresh();
  page.navigate(tap({ route: 'data' }));
  const write = storage.setStorageSync;
  let full = true;
  storage.setStorageSync = (key, value) => {
    if (full && key === KEYS.dataRows) throw new Error('quota');
    write(key, value);
  };

  page.onDataCellInput(cell(0, 'name', '新名字'));
  t.mock.timers.tick(400);
  assert.equal(page.data.dataSaveFailed, true);
  // Coming back from a scan or the background must not throw the edit away.
  page.refresh();
  assert.equal(page.data.dataRows[0].name, '新名字');
  assert.equal(page.data.dataSaveFailed, true);

  full = false;
  page.retryDataSave();
  assert.equal(page.data.dataSaveFailed, false);
  assert.equal(repository.getDataRows()[0].name, '新名字');
  assert.match(read('index.wxml'), /有修改还没保存[^<]*<\/text><button class="outline-button btn-s" bindtap="retryDataSave">重试<\/button>/);
});

test('label and print counts are totals, whatever the search box holds', () => {
  const { page, repository } = storedHome();
  repository.saveProject(label('苹果价签'));
  repository.saveProject(label('仓库货位'));
  page.refresh();
  page.onProjectSearch({ detail: { value: '价签' } });
  assert.equal(page.data.allProjects.length, 1);
  assert.equal(page.data.projectTotal, 2);
  page.onProjectSearch({ detail: { value: '没有这个' } });
  assert.equal(page.data.allProjects.length, 0);
  page.clearProjectSearch();
  assert.equal(page.data.allProjects.length, 2);
  const markup = read('index.wxml');
  assert.match(markup, /<text>\{\{projectTotal\}\}<\/text><text>我的标签<\/text>/);
  assert.match(markup, /<text>\{\{historyTotal\}\}<\/text><text>打印记录<\/text>/);
  assert.match(markup, /没有找到「\{\{projectQuery\}\}」/);
  assert.match(markup, /bindtap="clearProjectSearch">清除搜索<\/button>/);
  assert.doesNotMatch(markup, /本地项目/);
});

test('print history uses plain words: no platform errors, 已取消 for cancelled, 无副本 instead of a dead button', () => {
  const { page, storage } = storedHome();
  storage.setStorageSync(KEYS.printHistory, [
    { id: 'a', name: '价签', result: 'failed', message: 'writeBLECharacteristicValue:fail 10008', at: 1 },
    { id: 'b', name: '价签', result: 'failed', message: 'writeBLECharacteristicValue 超时；请装 58mm 纸', at: 2 },
    { id: 'c', name: '价签', result: 'cancelled', message: '打印已取消', at: 3 },
    { id: 'd', name: '价签', result: 'success', message: '已完成 2 份', at: 4, document: label('价签') }
  ]);
  page.refresh();
  const [a, b, c, d] = page.data.printHistory;
  assert.equal(a.message, '打印失败');
  assert.equal(b.message, '请装 58mm 纸');
  assert.deepEqual([c.result, c.statusLabel, c.statusIcon, c.message], ['cancelled', '已取消', 'icon-x', '打印已取消']);
  assert.deepEqual([d.statusLabel, d.message, d.canOpen], ['成功', '已完成 2 份', true]);
  assert.equal(a.canOpen, false);
  const markup = read('index.wxml');
  assert.match(markup, /aria-label="\{\{item\.statusLabel\}\}"/);
  assert.match(markup, /<text wx:else class="history-no-copy">无副本<\/text>/);
  assert.doesNotMatch(markup, /仅记录/);
});

test('deleting a label and discarding a draft confirm in red', (t) => {
  const modals = [];
  useWx(t, { showModal(options) { modals.push(options); } });
  const page = homePage({ projects: [{ id: 'p1', name: '价签' }] });
  page.deleteProject(tap({ id: 'p1' }));
  page.discardDraft();
  assert.deepEqual(modals.map((modal) => modal.confirmColor), ['#E02D26', '#E02D26']);
  assert.equal(modals[0].confirmText, '删除');
});

test('restoring checks the backup before asking to overwrite anything', (t) => {
  const modals = [];
  let file = JSON.stringify({ schemaVersion: 2, projects: [{ id: 'bad', document: {} }], templates: [] });
  useWx(t, {
    chooseMessageFile(options) { options.success({ tempFiles: [{ path: 'wxfile://tmp/b.json', size: 10 }] }); },
    getFileSystemManager: () => ({ readFile: (options) => options.success({ data: file }) }),
    showModal(options) { modals.push(options); },
    showToast(options) { modals.push({ toast: options.title }); }
  });
  const { page, repository } = storedHome();
  page.importBackup();
  assert.equal(modals.length, 1);
  assert.equal(modals[0].title, '恢复失败', 'a damaged file never reaches the overwrite question');

  const source = new Repository(memoryStorage());
  source.saveProject(label('备份里的价签'));
  file = JSON.stringify(source.backup());
  page.importBackup();
  const confirm = modals[1];
  assert.equal(confirm.title, '确认恢复备份');
  assert.match(confirm.content, /备份里有 1 个标签、0 个模板/);
  confirm.success({ confirm: true });
  assert.equal(repository.getProjects()[0].name, '备份里的价签');
  assert.equal(modals[2].toast, '已恢复 1 个标签');
});

test('table rows show real examples, a number pad for prices, and ask before deleting a filled row', (t) => {
  const markup = read('index.wxml');
  assert.match(markup, /placeholder="6901234567890"/);
  assert.match(markup, /<input type="digit" value="\{\{item\.price\}\}"/);
  assert.match(markup, /placeholder="\{\{datePlaceholder\}\}"/);
  assert.doesNotMatch(markup, /YYYY-MM-DD|690\.\.\./);
  assert.match(pageDefinition.data.datePlaceholder, /^\d{4}-\d{2}-\d{2}$/);

  const modals = [];
  useWx(t, { showModal(options) { modals.push(options); } });
  const saves = [];
  const page = homePage({ repository: { saveDataRows(rows) { saves.push(rows.map((row) => row.id)); } } });
  page.data.route = 'data';
  page.data.dataRows = [{ id: 'blank', name: '', code: '', price: '', date: '' }, { id: 'apple', name: '苹果', code: '', price: '', date: '' }];
  page.removeDataRow(tap({ index: 0 }));
  assert.deepEqual(saves, [['apple']], 'a blank row goes at once');
  page.removeDataRow(tap({ index: 0 }));
  assert.equal(saves.length, 1, 'a filled row waits for the answer');
  assert.match(modals[0].content, /苹果/);
  assert.equal(modals[0].confirmColor, '#E02D26');
  modals[0].success({ confirm: true });
  assert.deepEqual(saves, [['apple'], []]);
});

test('importing a template file shows a loading mask, ignores repeat taps, and offers it without pictures that cannot download', async (t) => {
  const calls = { loading: [], hidden: 0, modals: [], toasts: [], picks: 0 };
  useWx(t, {
    env: { USER_DATA_PATH: 'wxfile://usr' },
    chooseMessageFile(options) {
      calls.picks += 1;
      options.success({ tempFiles: [{ path: 'wxfile://tmp/t.json', name: 't.json', size: 100 }] });
    },
    getFileSystemManager() {
      return {
        readFile(options) {
          options.success({ data: JSON.stringify({
            name: '在线图片模板', width: 40, height: 30,
            elements: [{ type: 'image', imageUrl: 'https://example.com/offline.png', x: 1, y: 1, width: 10, height: 10 }]
          }) });
        },
        access(options) { options.fail({ errMsg: 'not found' }); }
      };
    },
    downloadFile(options) { options.fail({ errMsg: 'downloadFile:fail url not in domain list' }); },
    showLoading(options) { calls.loading.push(options); },
    hideLoading() { calls.hidden += 1; },
    showModal(options) { calls.modals.push(options); },
    showToast(options) { calls.toasts.push(options.title); }
  });
  let saved = null;
  const page = homePage({
    pageActive: true,
    repository: { saveUserTemplate(document, name) { saved = { document, name }; return { name }; } },
    refresh() {}
  });
  page.importTemplateFile();
  page.importTemplateFile();
  assert.equal(calls.picks, 1, 'a second tap while importing does nothing');
  assert.deepEqual(calls.loading.map((item) => [item.title, item.mask]), [['正在导入模板', true]]);
  await settle();
  assert.equal(calls.hidden, 1);
  const offer = calls.modals[0];
  assert.equal(offer.title, '模板图片没下载下来');
  assert.equal(offer.confirmText, '不带图片');
  assert.equal(saved, null);
  offer.success({ confirm: true });
  assert.equal(saved.name, '在线图片模板');
  assert.equal(saved.document.elements[0].path, '');
  assert.deepEqual(calls.toasts, ['已导入“在线图片模板”']);
});

test('a picture that cannot download fails with a plain message and a code', async () => {
  await assert.rejects(
    localizeUrl({ downloadFile(options) { options.fail({ errMsg: 'downloadFile:fail timeout' }); } }, 'https://example.com/x.png'),
    (error) => error.code === 'IMAGE_DOWNLOAD_FAILED' && error.message === '图片没有下载下来，请检查网络后重试'
      && /timeout/.test(error.detail)
  );
});

test('long success messages are not cut off by the success icon', () => {
  const source = read('index.js');
  const titles = [...source.matchAll(/showToast\(\{ title: ([^}]+?), icon: 'success' \}\)/g)].map((match) => match[1]);
  assert.ok(titles.length > 0);
  titles.forEach((title) => assert.ok(!title.includes('${'), `${title} can be longer than the 7 characters the icon leaves`));
});

test('thumbnails show where a picture sits', () => {
  const document = createDocument(40, 30);
  document.elements = [Object.assign(createElement('image', document), { id: 'logo', x: 2, y: 2, width: 10, height: 8, path: 'wxfile://usr/logo.png' })];
  const preview = buildMiniPreview(document, 200, 150);
  assert.equal(preview.nodes.length, 1);
  assert.equal(preview.nodes[0].kind, 'picture');
  assert.match(preview.nodes[0].style, /^left:5%;top:6\.67%;width:25%;height:26\.67%;/);
  assert.match(read('index.wxss'), /\.mini-node\.picture \{/);
});

test('home copy says 标签 and 打印机, and the guide ends with a single button', () => {
  const markup = read('index.wxml');
  assert.doesNotMatch(markup, /标签机|机型|本地项目/);
  assert.match(markup, /纸张和打印机是否匹配/);
  assert.match(markup, /<button wx:if="\{\{onboardingStep < 2\}\}" class="outline-button btn-l" bindtap="skipOnboarding">跳过<\/button>/);
  assert.match(markup, /点首页右上角的「未连接」/);
  assert.match(markup, /<text class="sheet-subtitle">\{\{previewTemplate\.sizeText\}\} · \{\{previewTemplate\.category\}\}<\/text>/);
  assert.match(markup, /<text>使用帮助<\/text>/);
  const source = read('index.js');
  assert.doesNotMatch(source, /已恢复 \$\{restored\.projects\} 个项目|本批项目|创建的项目/);
});

test('“显示更多” sends only the cards that were not on screen yet', () => {
  const { page } = storedHome();
  // A search on 全部 mixes the 22 built-in cards with scene matches: the
  // hardest layout, because the scene block moves down as the first grows.
  page.data.templateQuery = '价';
  page.data.templateVisibleCount = 24;
  page.refresh();
  assert.equal(page.data.visibleTemplates.length, 24);
  // The built-in block comes first and does not change between pages, so it is
  // never rewritten; only the scene block after it is.
  const builtIn = page.data.visibleTemplates.filter((item) => item.source !== 'shangyue-curated').length;
  assert.ok(builtIn > 0, 'the built-in cards lead the list');
  page.patches.length = 0;

  page.loadMoreTemplates();

  const patch = page.patches[page.patches.length - 1];
  const cardKeys = Object.keys(patch).filter((key) => key.startsWith('visibleTemplates'));
  assert.equal('visibleTemplates' in patch, false, 'the whole list is never resent');
  assert.ok(cardKeys.length > 0, 'the new page still arrives');
  cardKeys.forEach((key) => {
    const index = Number(key.replace(/[^0-9]/g, ''));
    assert.ok(index >= builtIn, key + ' rewrote a card that was already correct');
  });
  assert.equal(page.data.visibleTemplates.length, 48);
  assert.equal(page.data.templateVisibleCount, 48);
});

test('reopening 模板 with nothing changed sends no cards', () => {
  const { page } = storedHome();
  page.refresh();
  page.patches.length = 0;
  page.navigate(tap({ route: 'templates' }));
  const patches = page.patches.filter((patch) => Object.keys(patch).some((key) => key.startsWith('visibleTemplates')));
  assert.deepEqual(patches, []);
  assert.equal(page.data.route, 'templates');
});

test('leaving while the batch toast shows opens no editor from a dead page', (t) => {
  useWx(t, { showModal() {}, showToast() {} });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let opened = 0;
  const page = homePage({
    repository: {
      saveDataRows() {},
      saveProjects(documents) { return documents.map((document, index) => ({ id: 'p' + index, document })); }
    },
    refresh() {},
    openEditor() { opened += 1; }
  });
  page.data.dataRows = [{ id: 'r1', name: '苹果', code: '6901234567892', price: '9.9', date: '' }];
  page.data.batchRowCount = 1;
  page.runBatch();
  assert.ok(page.batchSavingTimer, 'the timer is kept so it can be cleared');
  page.onUnload();
  t.mock.timers.tick(500);
  assert.equal(opened, 0);
});
