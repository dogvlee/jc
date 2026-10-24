const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let definition;
global.Page = (value) => { definition = value; };
require('../miniprogram/pages/legal/index');
delete global.Page;

function legalPage(t, api, query) {
  const previous = global.wx;
  global.wx = api || {};
  t.after(() => {
    if (previous === undefined) delete global.wx;
    else global.wx = previous;
  });
  const page = Object.assign({}, definition, {
    data: structuredClone(definition.data),
    setData(patch) { Object.assign(this.data, patch); }
  });
  page.onLoad(query);
  return page;
}

function copyOf(page) {
  return [page.data.title, page.data.summary, ...page.data.sections.flatMap((section) => [section.title, ...section.paragraphs])].join('\n');
}

test('legal query selects only public static documents and defaults to privacy', (t) => {
  const page = legalPage(t, {}, { type: 'terms' });
  assert.equal(page.data.title, '用户协议');
  assert.equal(page.data.version, '2026-10-15');
  for (const query of [undefined, {}, { type: 'privacy' }, { type: '__proto__' }, { type: 'constructor' }, { type: '<script>alert(1)</script>' }, { type: ['terms'] }]) {
    page.onLoad(query);
    assert.equal(page.data.type, 'privacy');
    assert.equal(page.data.title, '隐私说明');
    assert.doesNotMatch(copyOf(page), /<script>|alert\(1\)/);
  }
});

test('reading agreements performs no login, consent or storage operation', (t) => {
  const forbidden = () => { throw new Error('Reading must not mutate consent or account state'); };
  const page = legalPage(t, {
    login: forbidden,
    request: forbidden,
    setStorageSync: forbidden,
    removeStorageSync: forbidden,
    clearStorageSync: forbidden,
    cloud: { callFunction: forbidden }
  }, { type: 'terms', agreed: 'true' });
  assert.match(copyOf(page), /打开或阅读本页不会替你同意协议，也不会自动登录/);
  assert.equal(page.data.agreed, undefined);
});

test('legal return ignores query destinations, goes back once and has a fixed home fallback', (t) => {
  const calls = [];
  let back;
  const page = legalPage(t, {
    navigateBack(options) { calls.push('back'); back = options; },
    reLaunch(options) { calls.push(options.url); }
  }, { returnTo: 'https://example.com', redirect: '/pkg-editor/pages/editor/index' });
  page.goBack();
  page.goBack();
  assert.deepEqual(calls, ['back']);
  assert.equal(back.delta, 1);
  back.fail();
  assert.deepEqual(calls, ['back', '/pages/home/index']);
});

test('legal return handles native navigation exceptions and allows retry if both routes fail', (t) => {
  let fallbackCalls = 0;
  const page = legalPage(t, {
    navigateBack() { throw new Error('empty stack'); },
    reLaunch(options) { fallbackCalls += 1; options.fail(); }
  });
  assert.doesNotThrow(() => page.goBack());
  assert.equal(page.backPending, false);
  page.goBack();
  assert.equal(fallbackCalls, 2);
});

test('legal header clears the capsule and survives missing or malformed platform metrics', (t) => {
  const api = {
    getWindowInfo: () => ({ safeArea: { top: 47 } }),
    getMenuButtonBoundingClientRect: () => ({ bottom: 83 })
  };
  const page = legalPage(t, api);
  assert.equal(page.data.headerTop, 95);
  assert.equal(page.data.safeTop, 47);
  api.getWindowInfo = () => ({ statusBarHeight: Infinity, safeArea: { top: -1 } });
  api.getMenuButtonBoundingClientRect = () => ({ bottom: Infinity });
  page.onResize();
  assert.equal(page.data.headerTop, 68);
  api.getWindowInfo = () => { throw new Error('not available'); };
  api.getMenuButtonBoundingClientRect = () => { throw new Error('not available'); };
  assert.doesNotThrow(() => page.onResize());
  assert.equal(page.data.headerTop, 68);
});

test('both agreements describe account-only identity and retained local data without fabricated contacts', (t) => {
  const page = legalPage(t, {}, { type: 'privacy' });
  for (const type of ['privacy', 'terms']) {
    page.onLoad({ type });
    const copy = copyOf(page);
    assert.match(copy, /服务端.*微信.*手机号|手机号.*服务端.*微信/);
    assert.match(copy, /仅用于账号识别/);
    assert.match(copy, /脱敏手机号/);
    assert.match(copy, /微信.*用户标识/);
    assert.match(copy, /协议同意时间和版本/);
    assert.match(copy, /标签、模板、图片、批量数据和打印历史仍保存在当前设备/);
    assert.match(copy, /退出登录只清除本机账号登录态/);
    assert.match(copy, /共用手机/);
    assert.match(copy, /反馈与投诉/);
    assert.doesNotMatch(copy, /云开发|CloudBase|shangyueAuth|shangyue_auth_users/);
    assert.doesNotMatch(copy, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|1[3-9]\d{9}|有限公司|https?:\/\//i);
    assert.ok(page.data.sections.length <= 6);
    assert.ok(copy.length < 1500);
  }
});

test('legal view keeps all copy visible and uses existing tokens and icons only', () => {
  const pageDir = path.join(__dirname, '../miniprogram/pages/legal');
  const view = fs.readFileSync(path.join(pageDir, 'index.wxml'), 'utf8');
  const style = fs.readFileSync(path.join(pageDir, 'index.wxss'), 'utf8');
  const appStyle = fs.readFileSync(path.join(pageDir, '../../app.wxss'), 'utf8');
  assert.match(view, /aria-label="返回上一页"/);
  assert.match(view, /selectable="true"/);
  assert.doesNotMatch(view, /<image|open-type="getPhoneNumber"|rich-text/);
  assert.doesNotMatch(style, /line-clamp|text-overflow|@font-face|https?:\/\//);
  for (const [, token] of style.matchAll(/var\((--[a-z0-9-]+)/g)) assert.ok(appStyle.includes(`${token}:`), `Missing token ${token}`);
  assert.match(style, /safe-area-inset-bottom/);
});
