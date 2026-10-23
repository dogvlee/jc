const assert = require('node:assert/strict');
const test = require('node:test');

const { isDesktopWeChat, platformName } = require('../miniprogram/services/platform');

test('platformName prefers getDeviceInfo and falls back to getSystemInfoSync', () => {
  assert.equal(platformName({ getDeviceInfo: () => ({ platform: 'iOS' }) }), 'ios');
  assert.equal(platformName({
    getDeviceInfo: () => ({}),
    getSystemInfoSync: () => ({ platform: 'android' })
  }), 'android');
  assert.equal(platformName({
    getDeviceInfo() { throw new Error('boom'); },
    getSystemInfoSync: () => ({ platform: 'windows' })
  }), 'windows');
});

test('platform helpers never throw on missing or failing APIs', () => {
  assert.equal(platformName({}), '');
  assert.equal(platformName({ getSystemInfoSync() { throw new Error('boom'); } }), '');
  assert.equal(isDesktopWeChat({}), false);
  assert.equal(isDesktopWeChat({ getSystemInfoSync: () => null }), false);
});

test('only Windows and Mac WeChat count as desktop', () => {
  const on = (platform) => ({ getDeviceInfo: () => ({ platform }) });
  assert.equal(isDesktopWeChat(on('windows')), true);
  assert.equal(isDesktopWeChat(on('mac')), true);
  assert.equal(isDesktopWeChat(on('ios')), false);
  assert.equal(isDesktopWeChat(on('android')), false);
  assert.equal(isDesktopWeChat(on('devtools')), false);
});

test('the global wx is used when no API is passed', () => {
  global.wx = { getDeviceInfo: () => ({ platform: 'mac' }) };
  try {
    assert.equal(isDesktopWeChat(), true);
    assert.equal(platformName(), 'mac');
  } finally {
    delete global.wx;
  }
});
