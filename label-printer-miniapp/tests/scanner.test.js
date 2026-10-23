const assert = require('node:assert/strict');
const test = require('node:test');

const { scanCode, scanFailurePrompt, showScanFailure } = require('../miniprogram/services/scanner');

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

test('desktop WeChat is told to scan on the phone instead of opening a camera it lacks', async () => {
  for (const platform of ['windows', 'mac']) {
    let opened = 0;
    const api = {
      getDeviceInfo: () => ({ platform }),
      scanCode() { opened += 1; }
    };
    await assert.rejects(scanCode(api), (error) => (
      error.code === 'SCAN_UNAVAILABLE' && error.message === '电脑版微信不能扫码，请在手机微信里使用扫码功能'
    ));
    assert.equal(opened, 0);
  }
  let phoneScans = 0;
  const phone = {
    getDeviceInfo: () => ({ platform: 'ios' }),
    scanCode(options) { phoneScans += 1; options.success({ result: 'A1' }); }
  };
  assert.equal((await scanCode(phone)).result, 'A1');
  assert.equal(phoneScans, 1);
});

test('a failed scan while WeChat lacks camera access is reported as a permission problem', async () => {
  const api = {
    scanCode(options) { options.fail({ errMsg: 'scanCode:fail' }); },
    getAppAuthorizeSetting: () => ({ cameraAuthorized: 'denied' })
  };
  await assert.rejects(scanCode(api), (error) => error.code === 'SCAN_PERMISSION_DENIED' && /相机权限/.test(error.message));
  const broken = {
    scanCode(options) { options.fail({ errMsg: 'scanCode:fail' }); },
    getAppAuthorizeSetting() { throw new Error('unsupported'); }
  };
  await assert.rejects(scanCode(broken), (error) => error.code === 'SCAN_FAILED');
});

test('scan failures offer the recovery action the UX spec names', () => {
  const failed = scanFailurePrompt({ code: 'SCAN_FAILED', message: '扫码失败，请检查相机权限后重试' }, {}, '无法扫码建标');
  assert.deepEqual(
    [failed.title, failed.action, failed.confirmText, failed.cancelText, failed.showCancel],
    ['无法扫码建标', 'retry', '重新扫码', '返回', true]
  );
  const mismatch = scanFailurePrompt({ code: 'SCAN_KIND_MISMATCH', message: '当前选中的是一维码' }, {}, '无法填入扫码内容');
  assert.deepEqual([mismatch.action, mismatch.confirmText, mismatch.cancelText], ['retry', '重新扫码', '取消']);
  const denied = { code: 'SCAN_PERMISSION_DENIED', message: '微信没有相机权限' };
  const settings = scanFailurePrompt(denied, { openAppAuthorizeSetting() {} }, '无法扫码建标');
  assert.deepEqual([settings.action, settings.confirmText, settings.cancelText], ['settings', '去设置', '取消']);
  assert.equal(scanFailurePrompt(denied, {}, '无法扫码建标').action, 'retry');
  const unavailable = scanFailurePrompt({ code: 'SCAN_UNAVAILABLE', message: '当前微信环境不支持扫码' }, {}, '无法扫码建标');
  assert.deepEqual([unavailable.action, unavailable.showCancel, unavailable.confirmText], ['none', false, '知道了']);
  assert.equal(scanFailurePrompt(new Error('本地存储空间不足'), {}, '无法扫码建标').action, 'none');
});

test('confirming a scan failure retries or opens system settings exactly once', () => {
  let modal = null;
  let retries = 0;
  let settingsOpened = 0;
  const api = {
    showModal(options) { modal = options; },
    openAppAuthorizeSetting() { settingsOpened += 1; }
  };
  showScanFailure(api, { code: 'SCAN_FAILED', message: '扫码失败' }, { title: '无法扫码建标', retry: () => { retries += 1; } });
  assert.equal(modal.confirmColor, '#E02D26');
  modal.success({ confirm: false, cancel: true });
  assert.equal(retries, 0);
  modal.success({ confirm: true });
  assert.equal(retries, 1);
  showScanFailure(api, { code: 'SCAN_PERMISSION_DENIED', message: '微信没有相机权限' }, { title: '无法扫码建标', retry: () => { retries += 1; } });
  modal.success({ confirm: true });
  assert.deepEqual([retries, settingsOpened], [1, 1]);
});
