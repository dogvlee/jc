const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { AuthService, AUTH_STORAGE_KEY, REQUEST_TIMEOUT_MS } = require('../miniprogram/services/auth-service');

const CONFIG = { apiBaseUrl: 'https://auth.example.test', appId: 'wxba51f65eb2f643e7', consentVersion: '2026-10-15' };
const USER = { id: 'syu_test_account_1', phoneMasked: '138****8000', nickName: '商跃用户' };
const TOKEN = 'test_bearer_token_value_123456789';
const EXPIRY = Date.now() + 3600000;

function loginResponse(extra) {
  return { statusCode: 200, data: Object.assign({ ok: true, user: USER, accessToken: TOKEN, expiresAt: EXPIRY }, extra || {}) };
}

function memory(extra) {
  return Object.assign({
    version: 1, remembered: true, origin: CONFIG.apiBaseUrl, apiBaseUrl: CONFIG.apiBaseUrl,
    appId: CONFIG.appId, userId: USER.id, accessToken: TOKEN, expiresAt: EXPIRY
  }, extra || {});
}

function fixture(options) {
  const settings = options || {};
  const values = new Map(Object.entries(settings.values || {}));
  const writes = [];
  const requests = [];
  const logins = [];
  const storage = {
    getStorageSync(key) { return values.get(key); },
    setStorageSync(key, value) { writes.push(['set', key]); values.set(key, JSON.parse(JSON.stringify(value))); },
    removeStorageSync(key) { writes.push(['remove', key]); values.delete(key); }
  };
  const api = {
    login(options) {
      logins.push(options);
      if (settings.login) settings.login(options);
      else options.success({ code: 'native-login-code' });
    },
    request(options) {
      const request = { options, aborted: false };
      requests.push(request);
      if (settings.request) settings.request(options, request);
      else if (options.url.endsWith('/api/auth/session')) options.success({ statusCode: 200, data: { ok: true, user: USER, expiresAt: EXPIRY } });
      else if (options.url.endsWith('/api/auth/logout')) options.success({ statusCode: 200, data: { ok: true } });
      else options.success(loginResponse());
      return { abort() {
        request.aborted = true;
        if (!settings.silentAbort) options.fail({ errMsg: 'request:fail abort' });
      } };
    }
  };
  const service = new AuthService({ api, storage, config: Object.assign({}, CONFIG, settings.config || {}) });
  return { service, api, storage, values, writes, requests, logins };
}

async function untilRequests(harness, count = 1) {
  for (let round = 0; round < 30 && harness.requests.length < count; round += 1) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.requests.length, count);
}

test('guest startup never initializes login or sends a request, including an empty server address', async () => {
  const h = fixture({ config: { apiBaseUrl: '' } });
  assert.deepEqual(await h.service.restore(), { status: 'guest', user: null, error: '' });
  assert.deepEqual(h.logins, []);
  assert.deepEqual(h.requests, []);
  assert.equal(REQUEST_TIMEOUT_MS, 25000);
});

test('missing service configuration fails safely in Chinese without invoking wx.login', async () => {
  const h = fixture({ config: { apiBaseUrl: '' } });
  await assert.rejects(h.service.loginWithPhoneCode('phone-code'), {
    code: 'AUTH_NOT_CONFIGURED', message: '登录服务暂未开通，请稍后再试'
  });
  assert.equal(h.service.getState().status, 'guest');
  assert.equal(h.values.has(AUTH_STORAGE_KEY), false);
  assert.deepEqual(h.logins, []);
  assert.deepEqual(h.requests, []);
});

test('explicit login exchanges wx.login and native phone codes once with versioned consent', async () => {
  const h = fixture();
  const state = await h.service.loginWithPhoneCode(' phone-code-not-trimmed ');
  assert.deepEqual(state, { status: 'authenticated', user: USER, error: '' });
  assert.equal(h.logins.length, 1);
  assert.ok(h.logins[0].timeout > 0 && h.logins[0].timeout <= REQUEST_TIMEOUT_MS);
  const request = h.requests[0].options;
  assert.equal(request.url, CONFIG.apiBaseUrl + '/api/auth/wechat/phone');
  assert.equal(request.method, 'POST');
  assert.deepEqual(request.data, {
    loginCode: 'native-login-code', phoneCode: ' phone-code-not-trimmed ',
    consentAccepted: true, consentVersion: CONFIG.consentVersion
  });
  assert.equal(request.header.Authorization, undefined);
  assert.deepEqual(h.values.get(AUTH_STORAGE_KEY), memory());
});

test('tokens, raw phone and extra server fields never appear in state, return values or subscribers', async () => {
  const h = fixture({ request: (options) => options.success(loginResponse({
    user: Object.assign({}, USER, { phone: '13800008000', accessToken: TOKEN, openid: 'private-openid' })
  })) });
  const seen = [];
  h.service.subscribe((state) => seen.push(state));
  const state = await h.service.loginWithPhoneCode('phone-code');
  const publicOutput = JSON.stringify([state, h.service.getState(), seen]);
  for (const privateValue of [TOKEN, '13800008000', 'private-openid', 'native-login-code']) assert.equal(publicOutput.includes(privateValue), false);
  assert.deepEqual(Object.keys(state.user), ['id', 'phoneMasked', 'nickName']);
});

test('restoration sends its origin-bound bearer to session before exposing authenticated state', async () => {
  const h = fixture({ values: { [AUTH_STORAGE_KEY]: memory() }, request() {} });
  const task = h.service.restore();
  assert.equal(h.service.getState().status, 'restoring');
  assert.equal(h.service.getState().user, null);
  await untilRequests(h);
  const request = h.requests[0].options;
  assert.equal(request.url, CONFIG.apiBaseUrl + '/api/auth/session');
  assert.equal(request.method, 'GET');
  assert.equal(request.header.Authorization, 'Bearer ' + TOKEN);
  assert.equal(request.data, undefined);
  assert.deepEqual(h.logins, []);
  request.success({ statusCode: 200, data: { ok: true, user: USER, expiresAt: EXPIRY } });
  assert.equal((await task).status, 'authenticated');
});

test('an unknown server account clears only authentication memory', async () => {
  const h = fixture({ values: { [AUTH_STORAGE_KEY]: memory(), labels: ['keep'] },
    request: (options) => options.success({ statusCode: 200, data: { ok: true, user: null } }) });
  assert.equal((await h.service.restore()).status, 'guest');
  assert.equal(h.values.has(AUTH_STORAGE_KEY), false);
  assert.deepEqual(h.values.get('labels'), ['keep']);
});

test('HTTP 401 clears remembered credentials and never displays server error details', async () => {
  const h = fixture({ values: { [AUTH_STORAGE_KEY]: memory() },
    request: (options) => options.success({ statusCode: 401, data: { ok: false, code: 'anything', msg: 'private server text' } }) });
  await assert.rejects(h.service.restore(), { code: 'AUTH_INVALID_SESSION' });
  assert.equal(h.values.has(AUTH_STORAGE_KEY), false);
  assert.equal(h.service.getState().status, 'guest');
  assert.equal(h.service.getState().error.includes('private'), false);
});

test('locally expired tokens are removed without sending them or calling wx.login', async () => {
  const h = fixture({ values: { [AUTH_STORAGE_KEY]: memory({ expiresAt: Date.now() - 1 }) } });
  await assert.rejects(h.service.restore(), { code: 'AUTH_INVALID_SESSION' });
  assert.equal(h.values.has(AUTH_STORAGE_KEY), false);
  assert.deepEqual(h.requests, []);
  assert.deepEqual(h.logins, []);
});

test('explicit restoration revalidates even an already visible account with the server', async () => {
  const h = fixture();
  await h.service.loginWithPhoneCode('phone-code');
  await h.service.restore();
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[1].options.url, CONFIG.apiBaseUrl + '/api/auth/session');
  assert.equal(h.requests[1].options.header.Authorization, 'Bearer ' + TOKEN);
});

test('changing server origin, base path or appId never sends an old token to a new destination', async () => {
  for (const config of [
    { apiBaseUrl: 'https://different.example.test' },
    { apiBaseUrl: CONFIG.apiBaseUrl + '/another-service' },
    { appId: 'wx1111111111111111' }
  ]) {
    const h = fixture({ values: { [AUTH_STORAGE_KEY]: memory() }, config });
    assert.equal((await h.service.restore()).status, 'guest');
    assert.deepEqual(h.requests, []);
  }
});

test('changed account identity from session requires explicit login', async () => {
  const h = fixture({ values: { [AUTH_STORAGE_KEY]: memory({ userId: 'syu_another_user' }) } });
  await assert.rejects(h.service.restore(), { code: 'AUTH_ACCOUNT_CHANGED' });
  assert.equal(h.values.has(AUTH_STORAGE_KEY), false);
});

test('HTTP is rejected except an explicit loopback development configuration', async () => {
  for (const config of [
    { apiBaseUrl: 'http://auth.example.test' },
    { apiBaseUrl: 'http://localhost:8080' },
    { apiBaseUrl: 'http://evil.localhost:8080', allowInsecureLocalhost: true },
    { apiBaseUrl: 'http://127.0.0.1.evil.test:8080', allowInsecureLocalhost: true },
    { apiBaseUrl: 'https://user:pass@auth.example.test' },
    { apiBaseUrl: 'https://auth.example.test/../other' },
    { apiBaseUrl: 'https://auth.example.test?next=https://evil.test' }
  ]) {
    const h = fixture({ config });
    await assert.rejects(h.service.loginWithPhoneCode('code'), { code: 'AUTH_INVALID_CONFIG' });
    assert.deepEqual(h.requests, []);
    assert.deepEqual(h.logins, []);
  }
  for (const apiBaseUrl of ['http://127.0.0.1:8080', 'http://localhost:8080']) {
    const h = fixture({ config: { apiBaseUrl, allowInsecureLocalhost: true } });
    assert.equal((await h.service.loginWithPhoneCode('code')).status, 'authenticated');
    assert.equal(h.requests[0].options.url, apiBaseUrl + '/api/auth/wechat/phone');
  }
});

test('redirect responses never trigger another request or follow a response URL', async () => {
  const h = fixture({ request: (options) => options.success({
    statusCode: 302, header: { Location: 'https://different.example.test' }, data: { ok: true, url: 'https://different.example.test' }
  }) });
  await assert.rejects(h.service.loginWithPhoneCode('code'), { code: 'AUTH_SERVICE_FAILED' });
  assert.equal(h.requests.length, 1);
  assert.equal(h.values.has(AUTH_STORAGE_KEY), false);
});

test('two phone logins share one flight and consume native codes only once', async () => {
  const h = fixture({ request() {} });
  const first = h.service.loginWithPhoneCode('first-phone-code');
  assert.equal(h.service.loginWithPhoneCode('second-phone-code'), first);
  await untilRequests(h);
  assert.equal(h.logins.length, 1);
  assert.equal(h.requests[0].options.data.phoneCode, 'first-phone-code');
  h.requests[0].options.success(loginResponse());
  await first;
});

test('concurrent restore requests share one flight', async () => {
  const h = fixture({ values: { [AUTH_STORAGE_KEY]: memory() }, request() {} });
  const first = h.service.restore();
  assert.equal(h.service.restore(), first);
  await untilRequests(h);
  h.requests[0].options.success({ statusCode: 200, data: { ok: true, user: USER, expiresAt: EXPIRY } });
  await first;
});

test('explicit login supersedes restoration and ignores late unauthorized responses', async () => {
  const h = fixture({ values: { [AUTH_STORAGE_KEY]: memory() }, silentAbort: true,
    request: (options) => { if (options.method === 'POST') options.success(loginResponse()); } });
  const restoration = h.service.restore();
  const cancelled = assert.rejects(restoration, { code: 'AUTH_CANCELLED' });
  await untilRequests(h);
  assert.equal((await h.service.loginWithPhoneCode('fresh-code')).status, 'authenticated');
  await cancelled;
  assert.equal(h.requests[0].aborted, true);
  h.requests[0].options.success({ statusCode: 401, data: { ok: false } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.service.getState().status, 'authenticated');
  assert.deepEqual(h.values.get(AUTH_STORAGE_KEY), memory());
});

test('native wx.login failure or cancellation never dispatches a phone exchange', async () => {
  for (const [errMsg, code] of [['login:fail cancel', 'AUTH_CANCELLED'], ['login:fail network', 'AUTH_WECHAT_LOGIN_FAILED']]) {
    const h = fixture({ login: (options) => options.fail({ errMsg }) });
    await assert.rejects(h.service.loginWithPhoneCode('phone-code'), { code });
    assert.deepEqual(h.requests, []);
  }
});

test('cancelling during wx.login prevents the late native code from being sent', async () => {
  const h = fixture({ login() {} });
  const task = h.service.loginWithPhoneCode('phone-code');
  const cancelled = assert.rejects(task, { code: 'AUTH_CANCELLED' });
  await new Promise((resolve) => setImmediate(resolve));
  h.service.cancelPending();
  await cancelled;
  h.logins[0].success({ code: 'late-login-code' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(h.requests, []);
  assert.deepEqual(h.writes, []);
});

test('cancel aborts wx.request, releases its promise and rejects late successful authentication', async () => {
  const h = fixture({ request() {}, silentAbort: true });
  const task = h.service.loginWithPhoneCode('phone-code');
  const cancelled = assert.rejects(task, { code: 'AUTH_CANCELLED' });
  await untilRequests(h);
  assert.equal(h.service.cancelPending().status, 'guest');
  await cancelled;
  assert.equal(h.requests[0].aborted, true);
  h.requests[0].options.success(loginResponse());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.service.getState().status, 'guest');
  assert.equal(h.values.has(AUTH_STORAGE_KEY), false);
});

test('timeout during native login releases the lock without dispatching a late code', async () => {
  const h = fixture({ login() {} });
  h.service.operationTimeoutMs = 10;
  await assert.rejects(h.service.loginWithPhoneCode('phone-code'), { code: 'AUTH_TIMEOUT' });
  h.logins[0].success({ code: 'late-login-code' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.service.pending, null);
  assert.deepEqual(h.requests, []);
});

test('timeout aborts a request and a late response cannot overwrite a new login', async () => {
  const h = fixture({ request: (options, request) => { if (h.requests.length === 2) options.success(loginResponse()); }, silentAbort: true });
  h.service.operationTimeoutMs = 10;
  await assert.rejects(h.service.loginWithPhoneCode('first-code'), { code: 'AUTH_TIMEOUT' });
  assert.equal(h.requests[0].aborted, true);
  assert.equal((await h.service.loginWithPhoneCode('second-code')).status, 'authenticated');
  h.requests[0].options.success({ statusCode: 401, data: { ok: false } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.service.getState().status, 'authenticated');
  assert.deepEqual(h.values.get(AUTH_STORAGE_KEY), memory());
});

test('transport failure and server errors use safe Chinese error messages', async () => {
  const h = fixture({ request: (options) => options.fail({ errMsg: 'private provider detail' }) });
  await assert.rejects(h.service.loginWithPhoneCode('code'), { code: 'AUTH_SERVICE_FAILED' });
  assert.equal(h.service.getState().error.includes('private'), false);
  const limited = fixture({ request: (options) => options.success({ statusCode: 429, data: { ok: false, code: 'AUTH_RATE_LIMITED', msg: 'private detail' } }) });
  await assert.rejects(limited.service.loginWithPhoneCode('code'), { code: 'AUTH_RATE_LIMITED', message: '登录尝试较多，请稍后再试' });
});

test('native timeout callbacks from either stage use the timeout message', async () => {
  const nativeLogin = fixture({ login: (options) => options.fail({ errMsg: 'login:fail timeout' }) });
  await assert.rejects(nativeLogin.service.loginWithPhoneCode('code'), { code: 'AUTH_TIMEOUT' });
  const nativeRequest = fixture({ request: (options) => options.fail({ errMsg: 'request:fail timeout' }) });
  await assert.rejects(nativeRequest.service.loginWithPhoneCode('code'), { code: 'AUTH_TIMEOUT' });
});

test('a missing HTTP status cannot be mistaken for a successful login', async () => {
  const h = fixture({ request: (options) => options.success({ data: loginResponse().data }) });
  await assert.rejects(h.service.loginWithPhoneCode('code'), { code: 'AUTH_SERVICE_FAILED' });
  assert.equal(h.service.getState().status, 'guest');
});

test('missing native APIs cannot fabricate authenticated state', async () => {
  for (const missing of ['login', 'request']) {
    const h = fixture();
    h.api[missing] = undefined;
    await assert.rejects(h.service.loginWithPhoneCode('code'), { code: 'AUTH_UNAVAILABLE' });
    assert.equal(h.service.getState().status, 'guest');
  }
});

test('malformed users, bearer injection and expired server credentials fail closed', async () => {
  for (const extra of [
    { user: null }, { user: {} }, { user: Object.assign({}, USER, { phoneMasked: '13800008000' }) },
    { accessToken: TOKEN + '\r\nInjected: value' }, { accessToken: '' }, { expiresAt: Date.now() - 1 }
  ]) {
    const h = fixture({ request: (options) => options.success(loginResponse(extra)) });
    await assert.rejects(h.service.loginWithPhoneCode('code'));
    assert.equal(h.service.getState().status, 'guest');
    assert.equal(h.values.has(AUTH_STORAGE_KEY), false);
  }
});

test('logout first clears private memory and then revokes the captured token on the fixed server', async () => {
  const h = fixture({ values: { [AUTH_STORAGE_KEY]: memory(), labels: ['keep'], printer: 'keep' }, request() {} });
  const task = h.service.logout();
  assert.equal(h.service.getState().status, 'guest');
  assert.equal(h.values.has(AUTH_STORAGE_KEY), false);
  await untilRequests(h);
  const request = h.requests[0].options;
  assert.equal(request.url, CONFIG.apiBaseUrl + '/api/auth/logout');
  assert.equal(request.method, 'POST');
  assert.equal(request.header.Authorization, 'Bearer ' + TOKEN);
  request.success({ statusCode: 200, data: { ok: true } });
  assert.equal((await task).status, 'guest');
  assert.deepEqual(h.values.get('labels'), ['keep']);
  assert.equal(h.values.get('printer'), 'keep');
  assert.ok(h.writes.every((write) => write[1] === AUTH_STORAGE_KEY));
  assert.equal((await h.service.restore()).status, 'guest');
  assert.equal(h.requests.length, 1);
});

test('failed or timed-out remote logout leaves local state guest and no remembered login', async () => {
  for (const request of [(options) => options.fail({ errMsg: 'network error' }), () => {}]) {
    const h = fixture({ values: { [AUTH_STORAGE_KEY]: memory() }, request });
    h.service.operationTimeoutMs = 10;
    assert.equal((await h.service.logout()).status, 'guest');
    assert.equal(h.values.has(AUTH_STORAGE_KEY), false);
  }
});

test('late logout responses never clear or replace a new authenticated session', async () => {
  const h = fixture({ values: { [AUTH_STORAGE_KEY]: memory() }, request: (options) => {
    if (options.url.endsWith('/api/auth/wechat/phone')) options.success(loginResponse({ accessToken: TOKEN + '_new' }));
  } });
  const logout = h.service.logout();
  await untilRequests(h);
  await h.service.loginWithPhoneCode('new-login-code');
  h.requests[0].options.success({ statusCode: 401, data: { ok: false } });
  await logout;
  assert.equal(h.service.getState().status, 'authenticated');
  assert.equal(h.values.get(AUTH_STORAGE_KEY).accessToken, TOKEN + '_new');
});

test('logout during login cancels the request and does not resurrect late credentials', async () => {
  const h = fixture({ request() {}, silentAbort: true });
  const login = h.service.loginWithPhoneCode('code');
  const cancelled = assert.rejects(login, { code: 'AUTH_CANCELLED' });
  await untilRequests(h);
  await h.service.logout();
  await cancelled;
  h.requests[0].options.success(loginResponse());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.service.getState().status, 'guest');
  assert.equal(h.values.has(AUTH_STORAGE_KEY), false);
});

test('storage write failure cannot display successful authentication', async () => {
  const h = fixture();
  h.storage.setStorageSync = () => { throw new Error('full'); };
  await assert.rejects(h.service.loginWithPhoneCode('code'), { code: 'AUTH_STORAGE_FAILED' });
  assert.equal(h.service.getState().status, 'guest');
});

test('a logout tombstone blocks restoration when removal fails', async () => {
  const h = fixture({ values: { [AUTH_STORAGE_KEY]: memory(), labels: ['keep'] } });
  h.storage.removeStorageSync = () => { throw new Error('remove failed'); };
  await h.service.logout();
  assert.deepEqual(h.values.get(AUTH_STORAGE_KEY), { version: 1, remembered: false });
  assert.equal((await h.service.restore()).status, 'guest');
  assert.deepEqual(h.values.get('labels'), ['keep']);
});

test('logout storage failure is reported instead of claiming credentials were removed', async () => {
  const h = fixture({ values: { [AUTH_STORAGE_KEY]: memory() } });
  h.storage.removeStorageSync = () => { throw new Error('remove failed'); };
  h.storage.setStorageSync = () => { throw new Error('write failed'); };
  await assert.rejects(h.service.logout(), { code: 'AUTH_LOGOUT_STORAGE_FAILED' });
  assert.equal(h.service.getState().status, 'guest');
  assert.deepEqual(h.requests, []);
});

test('subscribers cannot mutate state or change successful authentication by throwing', async () => {
  const h = fixture();
  const seen = [];
  h.service.subscribe((state) => { if (state.user) state.user.id = 'mutated'; throw new Error('page'); });
  const remove = h.service.subscribe((state) => { seen.push(state); return Promise.reject(new Error('async page')); });
  const result = await h.service.loginWithPhoneCode('code');
  result.user.nickName = 'mutated';
  assert.equal(h.service.getState().user.nickName, USER.nickName);
  assert.equal(seen[seen.length - 1].user.id, USER.id);
  remove();
  await h.service.logout();
  assert.equal(seen[seen.length - 1].status, 'authenticated');
});

test('client configuration defaults to the owner service with no guessed address or embedded credential', () => {
  assert.deepEqual(require('../miniprogram/config/auth'), {
    apiBaseUrl: '', appId: CONFIG.appId, consentVersion: CONFIG.consentVersion
  });
  const source = fs.readFileSync(path.resolve(__dirname, '../miniprogram/services/auth-service.js'), 'utf8');
  assert.equal(/wx\.cloud|callFunction|cloudbase|session_key|AppSecret/.test(source), false);
});

test('a network hiccup during restore retries once instead of logging the owner out', async () => {
  let calls = 0;
  const h = fixture({
    values: { [AUTH_STORAGE_KEY]: memory() },
    retryDelayMs: 0,
    request(options) {
      calls += 1;
      if (calls === 1) options.fail({ errMsg: 'request:fail timeout' });
      else options.success({ statusCode: 200, data: { ok: true, user: USER, expiresAt: EXPIRY } });
    }
  });
  h.service.retryDelayMs = 0;
  const state = await h.service.restore();
  assert.equal(state.status, 'authenticated');
  assert.equal(calls, 2);
  assert.deepEqual(h.values.get(AUTH_STORAGE_KEY), memory(), 'the token never left the device');
});

test('a restore that stays unreachable ends as guest but keeps the remembered session', async () => {
  let calls = 0;
  const h = fixture({
    values: { [AUTH_STORAGE_KEY]: memory() },
    request(options) { calls += 1; options.fail({ errMsg: 'request:fail timeout' }); }
  });
  h.service.retryDelayMs = 0;
  await assert.rejects(h.service.restore(), { code: 'AUTH_TIMEOUT' });
  assert.equal(calls, 2, 'one retry, then it gives up');
  assert.equal(h.service.getState().status, 'guest');
  assert.deepEqual(h.values.get(AUTH_STORAGE_KEY), memory(), 'a timeout is not a revocation');
});

test('a rejected session is never retried and is forgotten at once', async () => {
  let calls = 0;
  const h = fixture({
    values: { [AUTH_STORAGE_KEY]: memory() },
    request(options) { calls += 1; options.success({ statusCode: 401, data: { ok: false, code: 'AUTH_INVALID_SESSION' } }); }
  });
  h.service.retryDelayMs = 0;
  await assert.rejects(h.service.restore(), { code: 'AUTH_INVALID_SESSION' });
  assert.equal(calls, 1);
  assert.equal(h.values.has(AUTH_STORAGE_KEY), false);
  assert.equal(h.service.getState().status, 'guest');
});
