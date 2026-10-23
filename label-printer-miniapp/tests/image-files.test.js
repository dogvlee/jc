const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  MAX_FILES_PER_SWEEP,
  RECENT_MS,
  isLabelImagePath,
  referencedPaths,
  sweepOrphanImages
} = require('../miniprogram/services/image-files');

const ROOT = '/data';

function fakeApi(names, options = {}) {
  const removed = [];
  const fs = {
    readdirSync(dir) {
      if (options.readdirFails) throw new Error('denied');
      assert.equal(dir, ROOT);
      return names.slice();
    },
    unlinkSync(filePath) {
      if (options.unlinkFails) throw new Error('busy');
      removed.push(filePath.slice(ROOT.length + 1));
    }
  };
  if (!options.withoutStat) {
    fs.statSync = (filePath) => {
      const minutes = Number.isFinite(Number(options.ageMinutes)) ? Number(options.ageMinutes) : 10;
      const name = filePath.slice(ROOT.length + 1);
      const fresh = options.fresh || [];
      return { lastModifiedTime: Math.floor(Date.now() / 1000) - (fresh.includes(name) ? 0 : minutes * 60) };
    };
  }
  return {
    removed,
    api: {
      env: options.withoutRoot ? {} : { USER_DATA_PATH: ROOT },
      getFileSystemManager: options.withoutFs ? undefined : () => fs
    }
  };
}

const imageDocument = (...paths) => ({
  elements: paths.map((value, index) => ({ id: `el-${index}`, type: 'image', path: value }))
});

test('pictures no label refers to are deleted, used ones and other files stay', () => {
  const { api, removed } = fakeApi(['label-image-old.png', 'label-image-used.png', 'shangyue-backup-1.json']);
  const result = sweepOrphanImages(api, [
    imageDocument(`${ROOT}/label-image-used.png`)
  ], { now: Date.now() });
  assert.deepEqual(removed, ['label-image-old.png']);
  assert.deepEqual(result, { removed: 1, kept: 1 });
});

test('a picture imported a moment ago survives the sweep of another page', () => {
  const { api, removed } = fakeApi(['label-image-just-picked.jpg', 'label-image-old.jpg'], {
    fresh: ['label-image-just-picked.jpg']
  });
  const result = sweepOrphanImages(api, [], { now: Date.now() });
  assert.deepEqual(removed, ['label-image-old.jpg']);
  assert.equal(result.removed, 1);
});

test('references are matched by full path and by bare file name', () => {
  const { api, removed } = fakeApi(['label-image-a.png', 'label-image-b.png']);
  sweepOrphanImages(api, [imageDocument('label-image-a.png')], { now: Date.now() });
  assert.deepEqual(removed, ['label-image-b.png']);
  assert.deepEqual([...referencedPaths([imageDocument('/data/label-image-a.png')])], ['/data/label-image-a.png']);
});

test('documents without elements or with other paths sweep nothing they use', () => {
  assert.deepEqual([...referencedPaths([null, {}, { elements: [{ path: '/data/photo.jpg' }] }])], []);
  assert.equal(isLabelImagePath('/data/label-image-1.png'), true);
  // Any suffix we wrote is still ours; a name that merely contains the word is not.
  assert.equal(isLabelImagePath('/data/label-image-1.png.bak'), true);
  assert.equal(isLabelImagePath('/data/other-label-image-1.png'), false);
  assert.equal(isLabelImagePath('/data/label-image-'), false);
  assert.equal(isLabelImagePath('/data/photo.png'), false);
  assert.equal(isLabelImagePath(undefined), false);
});

test('a storage manager that cannot list or delete changes nothing', () => {
  assert.deepEqual(sweepOrphanImages(null, []), { removed: 0, kept: 0 });
  assert.deepEqual(sweepOrphanImages({ env: {}, getFileSystemManager() { return {}; } }, []), { removed: 0, kept: 0 });
  assert.deepEqual(sweepOrphanImages(fakeApi([], { withoutRoot: true }).api, []), { removed: 0, kept: 0 });
  assert.deepEqual(sweepOrphanImages(fakeApi([], { withoutFs: true }).api, []), { removed: 0, kept: 0 });
  assert.deepEqual(sweepOrphanImages(fakeApi([], { readdirFails: true }).api, []), { removed: 0, kept: 0 });
});

test('a file that cannot be deleted is left for the next sweep', () => {
  const { api, removed } = fakeApi(['label-image-busy.png'], { unlinkFails: true });
  const result = sweepOrphanImages(api, [], { now: Date.now() });
  assert.deepEqual(removed, []);
  assert.deepEqual(result, { removed: 0, kept: 1 });
});

test('one sweep is bounded so closing a page stays quick', () => {
  const names = Array.from({ length: MAX_FILES_PER_SWEEP + 20 }, (item, index) => `label-image-${index}.png`);
  const { api, removed } = fakeApi(names);
  const result = sweepOrphanImages(api, [], { now: Date.now() });
  assert.equal(removed.length, MAX_FILES_PER_SWEEP);
  assert.equal(result.kept, 20);
});

test('the default age guard is a minute', () => {
  assert.equal(RECENT_MS, 60000);
  const { api, removed } = fakeApi(['label-image-new.png'], { ageMinutes: 0.2 });
  sweepOrphanImages(api, []);
  assert.deepEqual(removed, [], 'half a minute old is too new to delete');
});

test('the editor sweeps when it closes, keeping what a stored label still uses', () => {
  let pageDefinition = null;
  global.Page = (definition) => { pageDefinition = definition; };
  require('../miniprogram/pages/editor/index');
  delete global.Page;

  const { api, removed } = fakeApi(['label-image-orphan.png', 'label-image-in-project.png', 'label-image-in-document.png']);
  global.wx = api;
  const projectDocument = imageDocument(`${ROOT}/label-image-in-project.png`);
  const editor = Object.assign({}, pageDefinition, {
    pageActive: false,
    document: imageDocument(`${ROOT}/label-image-in-document.png`),
    repository: {
      getProjects: () => [{ id: 'p1', document: projectDocument }],
      getUserTemplates: () => [],
      getPrintHistory: () => [],
      getEditorDraft: () => null,
      getEditorAutosave: () => null
    }
  });
  try {
    editor.sweepImageFiles();
  } finally {
    delete global.wx;
  }
  assert.deepEqual(removed, ['label-image-orphan.png']);
});
