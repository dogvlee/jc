const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MAX_DISK_CACHE_BYTES,
  MAX_DISK_CACHE_FILES,
  MAX_MEMORY_CACHE_ENTRIES,
  extensionForUrl,
  hashUrl,
  isRemoteImage,
  localizeDocumentImages,
  localizeUrl
} = require('../miniprogram/services/remote-image-cache');

test('remote image helpers accept only HTTPS and build stable cache names', () => {
  assert.equal(isRemoteImage('https://example.com/a.png'), true);
  assert.equal(isRemoteImage('http://example.com/a.png'), false);
  assert.equal(isRemoteImage('/assets/a.png'), false);
  assert.equal(extensionForUrl('https://example.com/a.JPEG?x=1'), '.jpg');
  assert.equal(hashUrl('https://example.com/a.png'), hashUrl('https://example.com/a.png'));
});

test('concurrent requests for one remote image share the same download', async () => {
  const url = 'https://oss-print.niimbot.com/public_resources/concurrent.png';
  let downloads = 0;
  let finishDownload;
  const wxMock = {
    downloadFile(options) {
      downloads += 1;
      finishDownload = () => options.success({ statusCode: 200, tempFilePath: 'wxfile://tmp/concurrent.png' });
    }
  };
  const first = localizeUrl(wxMock, url);
  const second = localizeUrl(wxMock, url);
  assert.equal(downloads, 1);
  finishDownload();
  assert.equal(await first, 'wxfile://tmp/concurrent.png');
  assert.equal(await second, 'wxfile://tmp/concurrent.png');
});

test('localizeUrl rejects non-HTTPS sources before invoking the platform', async () => {
  let downloads = 0;
  await assert.rejects(
    localizeUrl({ downloadFile() { downloads += 1; } }, 'http://example.com/a.png'),
    /HTTPS/
  );
  assert.equal(downloads, 0);
});

test('remote image memory cache has an LRU entry limit', async () => {
  let downloads = 0;
  const wxMock = {
    downloadFile(options) {
      downloads += 1;
      options.success({ statusCode: 200, tempFilePath: `wxfile://tmp/${downloads}.png` });
    }
  };
  const firstUrl = 'https://cache-limit.example/0.png';
  await localizeUrl(wxMock, firstUrl);
  for (let index = 1; index <= MAX_MEMORY_CACHE_ENTRIES; index += 1) {
    await localizeUrl(wxMock, `https://cache-limit.example/${index}.png`);
  }
  assert.equal(downloads, MAX_MEMORY_CACHE_ENTRIES + 1);
  await localizeUrl(wxMock, firstUrl);
  assert.equal(downloads, MAX_MEMORY_CACHE_ENTRIES + 2, 'oldest entry was evicted');
});

test('remote image disk cache evicts the least recently used file over its byte limit', async () => {
  const files = new Map();
  const removed = [];
  let clock = 0;
  const fsMock = {
    access(options) {
      if (files.has(options.path)) options.success({});
      else options.fail({ errMsg: 'not found' });
    },
    mkdir(options) { options.success({}); },
    saveFile(options) {
      files.set(options.filePath, { size: 10 * 1024 * 1024, time: ++clock });
      options.success({ savedFilePath: options.filePath });
    },
    readdir(options) {
      options.success({ files: Array.from(files.keys()).map((path) => path.split('/').pop()) });
    },
    stat(options) {
      const value = files.get(options.path);
      options.success({ stats: { size: value.size, lastAccessedTime: value.time } });
    },
    unlink(options) {
      removed.push(options.filePath);
      files.delete(options.filePath);
      options.success({});
    }
  };
  const wxMock = {
    env: { USER_DATA_PATH: 'wxfile://disk-lru' },
    getFileSystemManager: () => fsMock,
    downloadFile(options) {
      options.success({ statusCode: 200, tempFilePath: 'wxfile://tmp/download.png' });
    }
  };
  const urls = [1, 2, 3].map((id) => `https://disk-limit.example/${id}.png`);
  for (const url of urls) await localizeUrl(wxMock, url);
  assert.ok(30 * 1024 * 1024 > MAX_DISK_CACHE_BYTES);
  assert.equal(removed.length, 1);
  assert.match(removed[0], new RegExp(`${hashUrl(urls[0])}\\.png$`));
  assert.equal(files.size, 2);
});

test('persistent remote image cache prunes files above its limit', async () => {
  const files = Array.from({ length: MAX_DISK_CACHE_FILES + 1 }, (_, index) =>
    `${index.toString(16).padStart(16, '0')}.png`);
  const removed = [];
  const fsMock = {
    access(options) { options.fail({ errMsg: 'not found' }); },
    mkdir(options) { options.success({}); },
    saveFile(options) { options.success({ savedFilePath: options.filePath }); },
    readdir(options) { options.success({ files }); },
    stat(options) {
      const name = options.path.split('/').pop();
      options.success({ stats: { lastModifiedTime: parseInt(name, 16) || 0 } });
    },
    unlink(options) {
      removed.push(options.filePath);
      options.success({});
    }
  };
  const wxMock = {
    env: { USER_DATA_PATH: 'wxfile://usr' },
    getFileSystemManager: () => fsMock,
    downloadFile(options) {
      options.success({ statusCode: 200, tempFilePath: 'wxfile://tmp/prune.png' });
    }
  };
  await localizeUrl(wxMock, 'https://cache-prune.example/current.png');
  assert.equal(removed.length, 1);
  assert.match(removed[0], /0000000000000000\.png$/);
});

test('remote document images are downloaded once and rewritten to persistent local paths', async () => {
  const url = 'https://oss-print.niimbot.com/public_resources/a.png';
  let downloads = 0;
  let accessCalls = 0;
  const fsMock = {
    access(options) {
      accessCalls += 1;
      options.fail({ errMsg: 'not found' });
    },
    mkdir(options) {
      options.success({});
    },
    saveFile(options) {
      options.success({ savedFilePath: options.filePath });
    }
  };
  const wxMock = {
    env: { USER_DATA_PATH: 'wxfile://usr' },
    getFileSystemManager: () => fsMock,
    downloadFile(options) {
      downloads += 1;
      options.success({ statusCode: 200, tempFilePath: 'wxfile://tmp/download.png' });
    }
  };
  const source = {
    name: '远程图片模板',
    elements: [
      { id: 'a', type: 'image', path: url },
      { id: 'b', type: 'image', path: url },
      { id: 'c', type: 'image', path: '/assets/local.png' }
    ]
  };
  const localized = await localizeDocumentImages(wxMock, source);
  assert.equal(downloads, 1);
  assert.equal(accessCalls, 1);
  assert.equal(localized.elements[0].path, localized.elements[1].path);
  assert.match(localized.elements[0].path, /^wxfile:\/\/usr\/niim-online-assets\/[a-f0-9]{16}\.png$/);
  assert.equal(localized.elements[2].path, '/assets/local.png');
  assert.equal(source.elements[0].path, url, 'the catalog document is not mutated');
});
