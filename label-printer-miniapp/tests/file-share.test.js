const test = require('node:test');
const assert = require('node:assert/strict');

const { shareTextFileSync } = require('../miniprogram/services/file-share');

function fakeWx(options) {
  const config = options || {};
  const calls = [];
  const files = new Map(Object.entries(config.files || {}));
  const api = {
    env: { USER_DATA_PATH: 'wxfile://usr' },
    calls,
    files,
    modals: [],
    getFileSystemManager() {
      return {
        writeFileSync(filePath, data, encoding) {
          if (config.writeFails) throw new Error('writeFileSync:fail the maximum size of the file storage limit is exceeded');
          calls.push({ name: 'writeFileSync', filePath, data, encoding });
          files.set(filePath.replace('wxfile://usr/', ''), data);
        },
        readdirSync(directory) {
          calls.push({ name: 'readdirSync', directory });
          return Array.from(files.keys());
        },
        unlinkSync(filePath) {
          calls.push({ name: 'unlinkSync', filePath });
          files.delete(filePath.replace('wxfile://usr/', ''));
        }
      };
    },
    showModal(modal) { api.modals.push(modal); }
  };
  if (!config.noShare) {
    api.shareFileMessage = (request) => {
      calls.push({ name: 'shareFileMessage', request });
      if (config.shareFailure) request.fail(config.shareFailure);
    };
  }
  return api;
}

test('writes the file and opens the share sheet before returning, in one synchronous call', () => {
  const api = fakeWx();
  const shared = shareTextFileSync(api, {
    fileName: 'shangyue-backup-20260930-0915.json',
    displayName: '商跃标签备份-20260930-0915.json',
    content: '{"a":1}'
  });
  assert.equal(shared, true);
  const names = api.calls.map((call) => call.name).filter((name) => name !== 'readdirSync');
  assert.deepEqual(names, ['writeFileSync', 'shareFileMessage']);
  const write = api.calls.find((call) => call.name === 'writeFileSync');
  assert.equal(write.filePath, 'wxfile://usr/shangyue-backup-20260930-0915.json');
  assert.equal(write.data, '{"a":1}');
  assert.equal(write.encoding, 'utf8');
  const share = api.calls.find((call) => call.name === 'shareFileMessage').request;
  assert.equal(share.filePath, write.filePath);
  assert.equal(share.fileName, '商跃标签备份-20260930-0915.json');
  assert.equal(typeof share.fail, 'function');
  assert.equal(api.modals.length, 0);
});

test('an old WeChat without file sharing gets an upgrade hint and nothing is written', () => {
  const api = fakeWx({ noShare: true });
  assert.equal(shareTextFileSync(api, { fileName: 'a.csv', content: 'x' }), false);
  assert.equal(api.calls.length, 0);
  assert.equal(api.modals.length, 1);
  assert.match(api.modals[0].content, /当前微信版本不能发送文件，请升级微信后再试/);
});

test('a cancelled share stays silent while a failed share explains itself', () => {
  const cancelled = fakeWx({ shareFailure: { errMsg: 'shareFileMessage:fail cancel' } });
  shareTextFileSync(cancelled, { fileName: 'a.csv', content: 'x' });
  assert.equal(cancelled.modals.length, 0);

  const failed = fakeWx({ shareFailure: { errMsg: 'shareFileMessage:fail can only be invoked by user TAP gesture.' } });
  shareTextFileSync(failed, { fileName: 'a.csv', content: 'x' });
  assert.equal(failed.modals.length, 1);
  assert.equal(failed.modals[0].showCancel, false);
  assert.doesNotMatch(failed.modals[0].content, /[A-Za-z]{4,}/, 'no raw English error text');

  // A rejected file type must not be blamed on an old WeChat: the owner would
  // look for an upgrade that cannot help.
  const unsupported = fakeWx({ shareFailure: { errMsg: 'shareFileMessage:fail file type not supported' } });
  shareTextFileSync(unsupported, { fileName: 'shangyue-data-20261021.csv', content: 'x' });
  assert.match(unsupported.modals[0].content, /\.csv 文件/);
  assert.doesNotMatch(unsupported.modals[0].content, /升级微信/);

  const unavailable = fakeWx({ shareFailure: { errMsg: 'shareFileMessage:fail not available' } });
  shareTextFileSync(unavailable, { fileName: 'a.csv', content: 'x' });
  assert.match(unavailable.modals[0].content, /升级微信/);
});

test('a full phone storage is reported and the share sheet is not opened', () => {
  const api = fakeWx({ writeFails: true });
  assert.equal(shareTextFileSync(api, { fileName: 'a.json', content: 'x' }), false);
  assert.equal(api.calls.some((call) => call.name === 'shareFileMessage'), false);
  assert.equal(api.modals.length, 1);
  assert.match(api.modals[0].content, /存储空间/);
});

test('earlier exports with the same prefix are removed so repeated exports do not pile up', () => {
  const api = fakeWx({
    files: {
      'shangyue-backup-20260901-0800.json': 'old',
      'niim-label-backup-1700000000000.json': 'older',
      'shangyue-data-20260901.csv': 'rows',
      'label-image-1.png': 'image'
    }
  });
  shareTextFileSync(api, {
    fileName: 'shangyue-backup-20260930-0915.json',
    displayName: '商跃标签备份-20260930-0915.json',
    content: 'new',
    replacePrefix: ['shangyue-backup-', 'niim-label-backup-']
  });
  assert.deepEqual(Array.from(api.files.keys()).sort(), [
    'label-image-1.png',
    'shangyue-backup-20260930-0915.json',
    'shangyue-data-20260901.csv'
  ]);
});
