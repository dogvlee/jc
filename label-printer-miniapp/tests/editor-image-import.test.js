const test = require('node:test');
const assert = require('node:assert/strict');

const { createDocument, createElement } = require('../miniprogram/core/document');

let pageDefinition = null;
global.Page = (definition) => { pageDefinition = definition; };
require('../miniprogram/pages/editor/index');
delete global.Page;

test.afterEach(() => {
  delete global.wx;
});

function useWx() {
  const toasts = [];
  global.wx = {
    showToast(options) { toasts.push(options.title); },
    chooseMedia(options) { options.success({ tempFiles: [{ tempFilePath: '/tmp/picked.jpg' }] }); }
  };
  return toasts;
}

function editorWith(overrides) {
  const documentValue = createDocument(40, 30);
  const text = createElement('text', documentValue);
  text.text = '苹果';
  documentValue.elements = [text];
  return Object.assign({}, pageDefinition, {
    pageActive: true,
    document: documentValue,
    selectedId: text.id,
    images: {},
    repository: {},
    setData() {},
    commit() { this.commits = (this.commits || 0) + 1; }
  }, overrides || {});
}

function later() {
  return new Promise((resolve) => setImmediate(resolve));
}

test('a picture that finishes decoding after the page closed is never committed', async () => {
  const toasts = useWx();
  const editor = editorWith();
  let finish;
  editor.importLabelImage = () => new Promise((resolve) => { finish = resolve; });

  editor.chooseImage({ currentTarget: { dataset: {} } });
  // The system navigates away while the photo is still being copied.
  editor.pageActive = false;
  finish({ path: '/data/label-image-1.jpg', width: 10, height: 10 });
  await later();

  assert.equal(editor.commits || 0, 0);
  assert.deepEqual(toasts, [], 'a closed page shows nothing');
});

test('a picture that finishes while the page is open is committed once', async () => {
  useWx();
  const editor = editorWith();
  let finish;
  editor.importLabelImage = () => new Promise((resolve) => { finish = resolve; });

  editor.chooseImage({ currentTarget: { dataset: {} } });
  finish({ path: '/data/label-image-1.jpg', width: 10, height: 10 });
  await later();

  assert.equal(editor.commits, 1);
});

test('a discarded session also drops the late picture', async () => {
  useWx();
  const editor = editorWith({ discardedSession: true });
  let finish;
  editor.importLabelImage = () => new Promise((resolve) => { finish = resolve; });

  editor.chooseImage({ currentTarget: { dataset: {} } });
  finish({ path: '/data/label-image-1.jpg', width: 10, height: 10 });
  await later();

  assert.equal(editor.commits || 0, 0);
});

test('a failed import says so while the page is still open', async () => {
  const toasts = useWx();
  const editor = editorWith();
  editor.importLabelImage = () => Promise.reject(new Error('no space'));
  editor.chooseImage({ currentTarget: { dataset: {} } });
  await later();
  await later();
  assert.match(String(toasts[0] || ''), /图片保存失败/);
});

test('a pick without a file path asks the owner to choose again', () => {
  const toasts = useWx();
  global.wx.chooseMedia = (options) => options.success({ tempFiles: [] });
  const editor = editorWith();
  editor.importLabelImage = () => { throw new Error('must not run'); };
  editor.chooseImage({ currentTarget: { dataset: {} } });
  assert.match(String(toasts[0] || ''), /没有拿到图片/);
});
