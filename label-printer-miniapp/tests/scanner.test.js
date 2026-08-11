const assert = require('node:assert/strict');
const test = require('node:test');

const { scanCode } = require('../miniprogram/services/scanner');

test('scanner forwards supported code types and resolves the native result', async () => {
  let received;
  const api = {
    scanCode(options) {
      received = options;
      options.success({ result: 'ABC', scanType: 'CODE_128' });
    }
  };
  const result = await scanCode(api, { scanType: ['barCode'], onlyFromCamera: true });
  assert.equal(result.result, 'ABC');
  assert.deepEqual(received.scanType, ['barCode']);
  assert.equal(received.onlyFromCamera, true);
});

test('scanner distinguishes user cancellation from a permission failure', async () => {
  await assert.rejects(
    scanCode({ scanCode(options) { options.fail({ errMsg: 'scanCode:fail cancel' }); } }),
    (error) => error.code === 'SCAN_CANCELLED'
  );
  await assert.rejects(
    scanCode({ scanCode(options) { options.fail({ errMsg: 'scanCode:fail auth deny' }); } }),
    (error) => error.code === 'SCAN_FAILED' && /相机权限/.test(error.message)
  );
});

test('scanner reports an unsupported runtime without calling a global API', async () => {
  await assert.rejects(scanCode({}), (error) => error.code === 'SCAN_UNAVAILABLE');
});
