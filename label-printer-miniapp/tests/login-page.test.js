const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function definitionFor(page) {
  let definition;
  global.Page = (value) => { definition = value; };
  const file = require.resolve(`../miniprogram/pages/${page}/index`);
  delete require.cache[file];
  try { require(file); } finally { delete global.Page; }
  return definition;
}

function authMock() {
  let state = { status: 'guest', user: null, error: '' };
  const listeners = new Set();
  const auth = {
    config: { apiBaseUrl: 'https://accounts.example.test' },
    logins: [], cancelled: 0,
    getState() { return structuredClone(state); },
    subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); },
    emit(next) { state = next; for (const callback of listeners) callback(auth.getState()); },
    loginWithPhoneCode(code) {
      auth.logins.push(code);
      return Promise.resolve({ status: 'authenticated', user: { id: 'syu_test', phoneMasked: '138****8000', nickName: '商跃用户' } });
    },
    cancelPending() { auth.cancelled += 1; },
    async logout() { auth.emit({ status: 'guest', user: null, error: '' }); }
  };
  return auth;
}

function harness(t, extra, config) {
  const auth = authMock();
  Object.assign(auth.config, config || {});
  const calls = { navigation: [], back: 0, toast: [], modals: [] };
  global.wx = {
    getWindowInfo() { return { statusBarHeight: 44 }; },
    getMenuButtonBoundingClientRect() { return { top: 48, bottom: 80 }; },
    navigateTo(options) { calls.navigation.push(options); if (options.complete) options.complete(); },
    navigateBack(options) { calls.back += 1; calls.backOptions = options; },
    reLaunch(options) { calls.navigation.push(options); },
    showToast(options) { calls.toast.push(options); },
    showModal(options) { calls.modals.push(options); }
  };
  global.getApp = () => ({ globalData: { authService: auth } });
  t.after(() => { delete global.wx; delete global.getApp; });
  const definition = definitionFor('login');
  const page = Object.assign({}, definition, {
    data: structuredClone(definition.data),
    setData(patch) { Object.assign(this.data, patch); }
  }, extra);
  page.onLoad();
  return { page, auth, calls };
}

test('agreements start unchecked and visiting them never logs in or consents', async (t) => {
  const { page, auth, calls } = harness(t);
  assert.equal(page.data.consent, false);
  page.openTerms(); page.openPrivacy();
  assert.deepEqual(calls.navigation.map((item) => item.url), ['/pages/legal/index?type=terms', '/pages/legal/index?type=privacy']);
  await page.onGetPhoneNumber({ detail: { code: 'must-not-send' } });
  assert.equal(auth.logins.length, 0);
  assert.equal(page.data.consent, false);
  assert.match(page.data.errorText, /勾选同意/);
});

test('denying phone permission leaves an actionable guest page without contacting auth', async (t) => {
  const { page, auth, calls } = harness(t);
  page.onConsentChange({ detail: { value: ['agree'] } });
  await page.onGetPhoneNumber({ detail: { errMsg: 'getPhoneNumber:fail user deny' } });
  assert.match(page.data.errorText, /取消手机号授权/);
  assert.equal(auth.logins.length, 0);
  assert.equal(calls.back, 0);
});

test('an unconfigured service never requests phone login even after consent', async (t) => {
  const { page, auth, calls } = harness(t, null, { apiBaseUrl: '' });
  page.onConsentChange({ detail: { value: ['agree'] } });
  page.requestLogin();
  assert.equal(page.data.serviceConfigured, false);
  assert.match(page.data.errorText, /暂未开通/);
  await page.onGetPhoneNumber({ detail: { code: 'must-not-send' } });
  assert.equal(auth.logins.length, 0);
  assert.equal(calls.back, 0);
});

test('phone code is passed once after explicit consent and verified success returns', async (t) => {
  const { page, auth, calls } = harness(t);
  let complete;
  auth.loginWithPhoneCode = (code) => {
    auth.logins.push(code);
    return new Promise((resolve) => { complete = resolve; });
  };
  page.onConsentChange({ detail: { value: ['agree'] } });
  const pending = page.onGetPhoneNumber({ detail: { code: 'one-time-code' } });
  await page.onGetPhoneNumber({ detail: { code: 'duplicate' } });
  assert.equal(page.data.submitting, true);
  complete({ status: 'authenticated', user: { id: 'syu_account' } });
  await pending;
  assert.deepEqual(auth.logins, ['one-time-code']);
  assert.equal(calls.back, 1);
  assert.equal(page.data.submitting, false);
});

test('backend rejection never shows success and permits a fresh authorization', async (t) => {
  const { page, auth, calls } = harness(t);
  auth.loginWithPhoneCode = () => Promise.reject(new Error('登录服务暂未开通，请稍后再试'));
  page.onConsentChange({ detail: { value: ['agree'] } });
  await page.onGetPhoneNumber({ detail: { code: 'code' } });
  assert.equal(page.data.submitting, false);
  assert.match(page.data.errorText, /暂未开通/);
  assert.equal(calls.back, 0);
  assert.equal(calls.toast.length, 0);
});

test('leaving during login cancels and ignores its late successful result', async (t) => {
  const { page, auth, calls } = harness(t);
  let complete;
  auth.loginWithPhoneCode = () => new Promise((resolve) => { complete = resolve; });
  page.onConsentChange({ detail: { value: ['agree'] } });
  const pending = page.onGetPhoneNumber({ detail: { code: 'code' } });
  page.onUnload();
  complete({ status: 'authenticated', user: { id: 'late_result' } });
  await pending;
  assert.equal(auth.cancelled, 1);
  assert.equal(calls.back, 0);
  assert.equal(calls.toast.length, 0);
});

test('reading a policy only hides the login page and preserves explicit consent', (t) => {
  const { page, auth } = harness(t);
  page.onConsentChange({ detail: { value: ['agree'] } });
  page.openPrivacy();
  assert.equal(page.data.consent, true);
  assert.equal(auth.cancelled, 0);
  assert.equal(page.pageActive, true);
});

test('profile follows verified auth state and confirmed logout keeps device data', async (t) => {
  const { page: unused, auth, calls } = harness(t);
  unused.onUnload();
  const { Repository } = require('../miniprogram/services/repository');
  const { createDocument } = require('../miniprogram/core/document');
  const values = new Map();
  const storage = {
    getStorageSync(key) { return values.has(key) ? structuredClone(values.get(key)) : ''; },
    setStorageSync(key, value) { values.set(key, structuredClone(value)); },
    removeStorageSync(key) { values.delete(key); }
  };
  const repository = new Repository(storage);
  repository.migrate();
  repository.saveProject(createDocument(40, 30));
  const before = repository.backup();
  const definition = definitionFor('home');
  const home = Object.assign({}, definition, {
    data: structuredClone(definition.data), pageActive: true, repository, authService: auth,
    setData(patch) { Object.assign(this.data, patch); }
  });
  home.bindAuthState();
  home.openLogin();
  assert.equal(calls.navigation[0].url, '/pages/login/index');
  auth.emit({ status: 'authenticated', user: { id: 'syu_test', phoneMasked: '138****8000' }, error: '' });
  assert.equal(home.data.accountPhone, '138****8000');
  home.logoutAccount();
  assert.match(calls.modals[0].content, /仍会保留/);
  await calls.modals[0].success({ confirm: true });
  assert.equal(home.data.authStatus, 'guest');
  const after = repository.backup();
  delete before.exportedAt; delete after.exportedAt;
  assert.deepEqual(after, before);
  home.onUnload();
});

test('native authorization exists only after consent and routes include both account pages', () => {
  const mini = path.join(__dirname, '..', 'miniprogram');
  const markup = fs.readFileSync(path.join(mini, 'pages/login/index.wxml'), 'utf8');
  assert.match(markup, /wx:if="\{\{consent && serviceConfigured\}\}"[\s\S]*?open-type="getPhoneNumber\|agreePrivacyAuthorization"/);
  const app = JSON.parse(fs.readFileSync(path.join(mini, 'app.json'), 'utf8'));
  assert.ok(app.pages.includes('pages/login/index'));
  assert.ok(app.pages.includes('pages/legal/index'));
});
