const test = require('node:test');
const assert = require('node:assert/strict');
const { Repository, KEYS } = require('../miniprogram/services/repository');
const { EditorSession } = require('../miniprogram/services/editor-session');
const { createDocument, createElement } = require('../miniprogram/core/document');
const { getProfile } = require('../miniprogram/core/profiles');
let homeDefinition;
let editorDefinition;
global.Page = (page) => { homeDefinition = page; };
require('../miniprogram/pages/home/index');
global.Page = (page) => { editorDefinition = page; };
require('../miniprogram/pages/editor/index');
delete global.Page;

function storage() {
  const values = new Map();
  return {
    getStorageSync(key) { return values.has(key) ? structuredClone(values.get(key)) : ''; },
    setStorageSync(key, value) { values.set(key, structuredClone(value)); },
    removeStorageSync(key) { values.delete(key); }
  };
}
function page(definition, extra) {
  return Object.assign({}, definition, {
    data: structuredClone(definition.data),
    setData(patch, callback) { Object.assign(this.data, patch); if (callback) callback(); }
  }, extra);
}
function label(name) {
  const document = createDocument(40, 30);
  document.name = name;
  document.elements = [createElement('text', document)];
  document.elements[0].text = name;
  return document;
}

test('home exposes a recoverable draft and requires a choice before opening new work', () => {
  let sheet;
  let navigations = 0;
  global.wx = Object.assign(storage(), {
    showActionSheet(options) { sheet = options; },
    showModal() { assert.fail('unexpected error dialog'); },
    navigateTo() { navigations += 1; }
  });
  const repository = new Repository(wx);
  const editorSession = new EditorSession(repository);
  editorSession.checkpoint(label('未完成价签'), '', true);
  const home = page(homeDefinition, { repository, editorSession });
  home.refresh();
  assert.equal(home.data.recoveryDraft.name, '未完成价签');
  home.openEditor(label('另一张'), '');
  assert.equal(navigations, 0);
  assert.equal(repository.getEditorAutosave().document.name, '未完成价签');
  // New options go last so the first two keep their meaning.
  assert.deepEqual(sheet.itemList, ['继续编辑草稿', '保存草稿并打开新标签', '放弃草稿，打开新标签']);
  sheet.success({ tapIndex: 0 });
  assert.equal(navigations, 1);
  assert.equal(repository.getEditorDraft().document.name, '未完成价签');
  delete global.wx;
});

test('home save-and-open archives the first label before navigating to the second', () => {
  let sheet;
  let navigations = 0;
  global.wx = Object.assign(storage(), {
    showActionSheet(options) { sheet = options; },
    showModal() { assert.fail('unexpected error dialog'); },
    navigateTo() { navigations += 1; }
  });
  const repository = new Repository(wx);
  const editorSession = new EditorSession(repository);
  editorSession.checkpoint(label('保留这张'), '', true);
  const home = page(homeDefinition, { repository, editorSession });
  home.openEditor(label('新任务'), '');
  sheet.success({ tapIndex: 1 });
  assert.equal(navigations, 1);
  assert.equal(repository.getProjects()[0].document.name, '保留这张');
  assert.equal(editorSession.open({}).document.name, '新任务');
  delete global.wx;
});

test('storage failures show a retry state and never masquerade as an empty home', () => {
  const api = storage();
  const repository = new Repository(api);
  repository.saveProject(label('已有标签'));
  const home = page(homeDefinition, { repository, editorSession: new EditorSession(repository) });
  const read = api.getStorageSync;
  api.getStorageSync = () => { throw new Error('read fault'); };
  home.refresh();
  assert.match(home.data.storageError, /读取失败/);
  assert.equal(home.data.showOnboarding, false);
  api.getStorageSync = read;
  home.refresh();
  assert.equal(home.data.storageError, '');
  assert.equal(home.data.allProjects[0].name, '已有标签');
});

test('template storage failure during editor initialization is recoverable', () => {
  const api = storage();
  const repository = new Repository(api);
  repository.migrate();
  const read = api.getStorageSync;
  api.getStorageSync = (key) => {
    if (key === KEYS.templates) throw new Error('template read fault');
    return read(key);
  };
  global.wx = { getWindowInfo() { return { windowWidth: 375 }; } };
  global.getApp = () => ({ globalData: { repository } });
  const editor = page(editorDefinition);
  assert.doesNotThrow(() => editor.onLoad({}));
  assert.match(editor.data.loadError, /读取失败/);
  delete global.wx;
  delete global.getApp;
});

test('failed autosave blocks retaining-and-exiting and exposes a retry message', () => {
  let backs = 0;
  let modal = null;
  global.wx = { navigateBack() { backs += 1; }, showModal(options) { modal = options; } };
  const editor = page(editorDefinition, {
    document: label('不能丢'), dirtySinceSave: true,
    editorSession: { checkpoint() { throw new Error('quota'); } }
  });
  editor.exitEditor();
  assert.equal(backs, 0);
  assert.match(editor.data.saveState, /保存失败/);
  // The exit says why it stopped and lets the user choose.
  assert.equal(modal.title, '草稿没有保存成功');
  assert.equal(modal.confirmText, '再试一次');
  modal.success({ confirm: false, cancel: true });
  assert.equal(backs, 1, '仍要退出 leaves');
  delete global.wx;
});

test('clearing every element still prompts to preserve or discard the modification', () => {
  let sheet;
  global.wx = { showActionSheet(options) { sheet = options; } };
  const editor = page(editorDefinition, { document: createDocument(40, 12), dirtySinceSave: true });
  editor.document.elements = [];
  editor.closeEditor();
  assert.ok(sheet);
  assert.ok(sheet.itemList.includes('保留草稿退出'));
  delete global.wx;
});

test('first print selects a device even if the remembered profile cannot fit the label', async () => {
  let opened = 0;
  const editor = page(editorDefinition, {
    document: label('大标签'), context: {}, canvasSize: {},
    connectionManager: { getSavedDevice() { return null; } },
    refreshPrintBlock() { assert.fail('must select the actual device first'); },
    openDevices() { opened += 1; }
  });
  editor.data.canvasReady = true;
  await editor.startPrint();
  assert.equal(opened, 1);
  assert.equal(editor.returnToPrintAfterConnect, true);
  editor.closeDevices();
  assert.equal(editor.returnToPrintAfterConnect, false);
});

test('printing and its history use the submitted snapshot while connection is pending', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let rendered;
  let copies;
  let history;
  global.wx = { showToast() {} };
  const editor = page(editorDefinition, {
    pageActive: true, context: {}, canvasSize: {},
    document: label('本次提交'), profile: getProfile('b1'),
    connectionManager: {
      getSavedDevice() { return { deviceId: 'b1' }; }, ensureReady() { return gate; }, touch() {}
    },
    printer: { async print(image, profile, options) { copies = options.copies; }, async cancel() {} },
    applyConnectionResult() {},
    async preparePrintImages() { return {}; },
    createPrintImageData(document) { rendered = document; return {}; },
    recordPrintSafely(value) { history = value; return true; },
    renderAll() {}
  });
  editor.data.canvasReady = true;
  editor.data.copies = 2;
  const pending = editor.startPrint();
  editor.document.name = '稍后编辑';
  editor.document.elements[0].text = '稍后编辑';
  editor.data.copies = 9;
  release({});
  await pending;
  assert.equal(rendered.elements[0].text, '本次提交');
  assert.equal(copies, 2);
  assert.equal(history.result, 'success');
  assert.equal(history.document.name, '本次提交');
  assert.equal(editor.data.printing, false);
  delete global.wx;
});
