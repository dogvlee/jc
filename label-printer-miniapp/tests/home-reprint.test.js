const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createDocument } = require('../miniprogram/core/document');
const { Repository } = require('../miniprogram/services/repository');

const pages = {};
global.Page = (definition) => { pages.current = definition; };
require('../miniprogram/pages/home/index');
pages.home = pages.current;
require('../miniprogram/pkg-editor/pages/editor/index');
pages.editor = pages.current;
delete global.Page;

const mini = path.join(__dirname, '..', 'miniprogram');
const readMini = (file) => fs.readFileSync(path.join(mini, file), 'utf8');

function homeWith(extra) {
  return Object.assign({}, pages.home, { data: {}, setData(patch) { Object.assign(this.data, patch); } }, extra);
}

test('再打一张 opens the saved label with print=1 and the plain open does not', (t) => {
  const urls = [];
  const previous = global.wx;
  global.wx = { navigateTo(options) { urls.push(options.url); } };
  t.after(() => { if (previous) global.wx = previous; else delete global.wx; });
  const staged = [];
  const project = { id: 'p1', document: createDocument(40, 30) };
  const page = homeWith({
    projects: [project],
    editorSession: {
      recoverable: () => null,
      stage: (document, projectId, options) => staged.push({ document, projectId, options })
    }
  });

  page.reprintProject({ currentTarget: { dataset: { id: 'p1' } } });
  assert.deepEqual(urls, ['/pkg-editor/pages/editor/index?print=1']);
  assert.equal(staged[0].projectId, 'p1');
  assert.equal(staged[0].document, project.document);

  page.editorOpening = false;
  page.openProject({ currentTarget: { dataset: { id: 'p1' } } });
  assert.equal(urls[1], '/pkg-editor/pages/editor/index');
});

test('再打一张 for an unknown label does nothing', (t) => {
  const previous = global.wx;
  global.wx = { navigateTo() { assert.fail('must not navigate'); } };
  t.after(() => { if (previous) global.wx = previous; else delete global.wx; });
  const page = homeWith({ projects: [], editorSession: { recoverable: () => null, stage() { assert.fail('must not stage'); } } });
  page.reprintProject({ currentTarget: { dataset: { id: 'missing' } } });
});

test('the recent label card has a printer button that is separate from the open buttons', () => {
  const markup = readMini('pages/home/index.wxml');
  const card = markup.slice(markup.indexOf('class="recent-card"'), markup.indexOf('</scroll-view>'));
  assert.match(card, /class="recent-print"[^>]*bindtap="reprintProject"/);
  assert.match(card, /aria-label="再打一张 \{\{item\.name\}\}"/);
  assert.match(card, /class="recent-open"[^>]*bindtap="openProject"/);
  // A button inside a button does not work in a mini program.
  assert.equal(/<button[^>]*class="recent-open"[\s\S]*?<button/.test(card.split('recent-foot')[0]), false);
});

test('the editor raises the print sheet for print=1 but never starts printing by itself', (t) => {
  const timers = [];
  const realSetTimeout = global.setTimeout;
  global.setTimeout = (callback, delay) => { timers.push({ callback, delay }); return timers.length; };
  const values = new Map();
  const previousWx = global.wx;
  const previousApp = global.getApp;
  global.wx = {
    getWindowInfo: () => ({ windowWidth: 375, pixelRatio: 2 }),
    getStorageSync: (key) => values.get(key) || '',
    setStorageSync: (key, value) => values.set(key, structuredClone(value)),
    removeStorageSync: (key) => values.delete(key)
  };
  t.after(() => {
    global.setTimeout = realSetTimeout;
    if (previousWx) global.wx = previousWx; else delete global.wx;
    if (previousApp) global.getApp = previousApp; else delete global.getApp;
  });
  const repository = new Repository(wx);
  repository.saveEditorDraft({ document: createDocument(40, 30), projectId: 'p1', dirtySinceSave: false });
  global.getApp = () => ({ globalData: { repository, bleSession: { onConnectionStateChange: () => () => {} }, printerClient: {} } });

  const calls = [];
  const editor = Object.assign({}, pages.editor, {
    data: { ...pages.editor.data },
    setData(patch, callback) { Object.assign(this.data, patch); if (callback) callback(); },
    openPrintSheet() { calls.push('sheet'); },
    startPrint() { calls.push('print'); },
    syncPageData() {}
  });

  editor.onLoad({ print: '1' });
  assert.equal(timers.length, 1, 'one delayed sheet opening');
  timers[0].callback();
  assert.deepEqual(calls, ['sheet']);

  // Without the flag nothing is scheduled.
  timers.length = 0;
  const plain = Object.assign({}, editor, { data: { ...pages.editor.data } });
  plain.onLoad({});
  assert.equal(timers.length, 0);
});

test('closing the editor cancels a pending print-sheet opening', () => {
  assert.match(readMini('pkg-editor/pages/editor/index.js'), /clearTimeout\(this\.printOpenTimer\)/);
});
