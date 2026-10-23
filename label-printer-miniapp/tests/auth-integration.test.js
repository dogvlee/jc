const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const { createHash } = require('node:crypto');
const { AuthService, AUTH_STORAGE_KEY } = require('../miniprogram/services/auth-service');
const { Repository, KEYS } = require('../miniprogram/services/repository');
const { createDocument, createElement } = require('../miniprogram/core/document');

const APP_ID = 'wxba51f65eb2f643e7';
const PHONE_CODE = 'one-time-phone-integration-code';
const LOGIN_CODE = 'one-time-login-integration-code';
const PRIVATE_PHONE = '13812348000';
const PRIVATE_OPENID = 'wechat_integration_openid';

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getStorageSync(key) { return values.has(key) ? structuredClone(values.get(key)) : ''; },
    setStorageSync(key, value) { values.set(key, structuredClone(value)); },
    removeStorageSync(key) { values.delete(key); }
  };
}

function businessBackup(repository) {
  const { exportedAt, ...backup } = repository.backup();
  return backup;
}

function wxHttpAdapter(origin) {
  const requests = [];
  let nativeLoginCount = 0;
  return {
    requests,
    get nativeLoginCount() { return nativeLoginCount; },
    login(options) { nativeLoginCount += 1; options.success({ code: LOGIN_CODE }); },
    request(options) {
      assert.equal(new URL(options.url).origin, origin, 'tests must never contact an external origin');
      const controller = new AbortController();
      requests.push({ url: options.url, method: options.method, headers: { ...options.header }, data: options.data });
      fetch(options.url, {
        method: options.method,
        headers: options.header,
        redirect: 'error',
        signal: controller.signal,
        ...(options.data === undefined ? {} : { body: JSON.stringify(options.data) })
      }).then(async (response) => {
        const data = await response.json();
        options.success({ statusCode: response.status, data });
      }).catch(() => options.fail({ errMsg: 'request:fail' }));
      return { abort() { controller.abort(); } };
    }
  };
}

async function harness(t, overrides = {}) {
  const [{ createServer }, { DatabaseSync }, { createWeChatProvider }] = await Promise.all([
    import('../server/app.js'), import('node:sqlite'), import('../server/wechat.js')
  ]);
  const db = new DatabaseSync(':memory:');
  const verificationCalls = [];
  // Only the upstream HTTP transport is fake: exercise the real WeChat JSON,
  // watermark and phone-masking adapter as part of the default HTTP lifecycle.
  const wechat = createWeChatProvider({
    appId: APP_ID,
    appSecret: 'integration-only-not-a-real-secret',
    async fetchImpl(input, options) {
      const url = new URL(input);
      assert.equal(url.origin, 'https://api.weixin.qq.com');
      assert.equal(options.redirect, 'error');
      let data;
      if (url.pathname === '/sns/jscode2session') {
        assert.equal(url.searchParams.get('js_code'), LOGIN_CODE);
        assert.equal(url.searchParams.get('appid'), APP_ID);
        data = { openid: PRIVATE_OPENID, session_key: 'private-integration-session-key' };
      } else if (url.pathname === '/cgi-bin/stable_token') {
        assert.equal(JSON.parse(options.body).appid, APP_ID);
        data = { access_token: 'private-wechat-provider-token', expires_in: 7200 };
      } else if (url.pathname === '/wxa/business/getuserphonenumber') {
        assert.equal(JSON.parse(options.body).code, PHONE_CODE);
        data = { errcode: 0, phone_info: { purePhoneNumber: PRIVATE_PHONE, watermark: { appid: APP_ID } } };
      } else assert.fail('unexpected upstream endpoint');
      return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  });
  const provider = overrides.provider || {
    async verify(input) {
      verificationCalls.push({ loginCode: input.loginCode, phoneCode: input.phoneCode });
      assert.equal(input.loginCode, LOGIN_CODE);
      assert.equal(input.phoneCode, PHONE_CODE);
      return wechat.verify(input);
    }
  };
  const server = createServer({ appId: APP_ID, db, provider, ...overrides });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    const closed = new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server.closeAllConnections();
    await closed;
    db.close();
  });
  const storage = memoryStorage();
  const repository = new Repository(storage);
  repository.migrate();
  const document = createDocument(50, 30);
  document.name = '本机业务标签';
  document.elements = [createElement('text', document)];
  document.elements[0].text = '这份标签不属于账号服务';
  repository.saveProject(document);
  repository.saveUserTemplate(document, '本机模板');
  repository.saveDataRows([{ id: 'row-local', name: '本机商品', code: '6901234567892', price: '19.90', date: '2026-10-15' }]);
  storage.setStorageSync(KEYS.lastDevice, { deviceId: 'local-printer', name: '本机打印机' });
  const adapter = wxHttpAdapter(origin);
  const config = { apiBaseUrl: origin, appId: APP_ID, consentVersion: '2026-10-15', allowInsecureLocalhost: true };
  const service = new AuthService({ api: adapter, storage, config });
  return { db, server, origin, storage, repository, adapter, config, service, verificationCalls };
}

test('real HTTP login, verified restore and revoked logout preserve all device business data and keep auth private', async (t) => {
  const h = await harness(t);
  const before = businessBackup(h.repository);
  const beforeStorage = structuredClone([...h.storage.values]);
  const seen = [];
  h.service.subscribe((state) => seen.push(state));

  const loggedIn = await h.service.loginWithPhoneCode(PHONE_CODE);
  assert.equal(loggedIn.status, 'authenticated');
  assert.deepEqual(Object.keys(loggedIn.user), ['id', 'phoneMasked', 'nickName']);
  assert.deepEqual(h.verificationCalls, [{ loginCode: LOGIN_CODE, phoneCode: PHONE_CODE }]);
  assert.equal(h.adapter.nativeLoginCount, 1);
  const remembered = h.storage.getStorageSync(AUTH_STORAGE_KEY);
  assert.match(remembered.accessToken, /^[A-Za-z0-9_-]{43}$/);
  const tokenHash = createHash('sha256').update(remembered.accessToken).digest('hex');
  const databaseSession = h.db.prepare('SELECT token_hash FROM sessions').get();
  assert.equal(databaseSession.token_hash, tokenHash);
  assert.notEqual(databaseSession.token_hash, remembered.accessToken);
  const privateDatabaseRows = JSON.stringify(h.db.prepare('SELECT * FROM users').all());
  for (const value of [PRIVATE_PHONE, PHONE_CODE, LOGIN_CODE, 'private-integration-session-key', 'private-wechat-provider-token']) {
    assert.equal(privateDatabaseRows.includes(value), false);
  }
  for (const value of [PRIVATE_PHONE, PRIVATE_OPENID, PHONE_CODE, LOGIN_CODE]) {
    assert.equal(JSON.stringify(remembered).includes(value), false);
  }
  assert.equal(JSON.stringify([loggedIn, h.service.getState(), seen]).includes(remembered.accessToken), false);
  assert.deepEqual(businessBackup(h.repository), before);
  assert.equal(JSON.stringify(h.repository.backup()).includes(remembered.accessToken), false);

  const fresh = new AuthService({ api: h.adapter, storage: h.storage, config: h.config });
  assert.equal(fresh.getState().status, 'guest');
  assert.deepEqual(await fresh.restore(), loggedIn);
  assert.equal(h.adapter.nativeLoginCount, 1, 'restoration must validate the bearer without wx.login');
  assert.equal(h.adapter.requests[1].headers.Authorization, `Bearer ${remembered.accessToken}`);

  assert.equal((await fresh.logout()).status, 'guest');
  assert.equal(h.storage.getStorageSync(AUTH_STORAGE_KEY), '');
  assert.equal(h.db.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
  const revoked = await fetch(`${h.origin}/api/auth/session`, { headers: { Authorization: `Bearer ${remembered.accessToken}` } });
  assert.equal(revoked.status, 401);
  assert.deepEqual(await revoked.json(), { ok: false, code: 'AUTH_INVALID_SESSION', msg: '登录已失效，请重新登录' });
  assert.deepEqual(businessBackup(h.repository), before);
  assert.deepEqual([...h.storage.values], beforeStorage);
});

test('real HTTP expiration is rejected by restore and clears only authentication memory', async (t) => {
  let now = Date.now();
  const h = await harness(t, { clock: () => now, sessionTtlMs: 60000 });
  const before = businessBackup(h.repository);
  await h.service.loginWithPhoneCode(PHONE_CODE);
  now += 60001;
  const fresh = new AuthService({ api: h.adapter, storage: h.storage, config: h.config });
  await assert.rejects(fresh.restore(), { code: 'AUTH_INVALID_SESSION' });
  assert.equal(fresh.getState().status, 'guest');
  assert.equal(h.storage.getStorageSync(AUTH_STORAGE_KEY), '');
  assert.equal(h.db.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
  assert.deepEqual(businessBackup(h.repository), before);
});

test('cancelled real HTTP login cannot issue or persist a late verified account', async (t) => {
  let entered;
  let release;
  let signal;
  const started = new Promise((resolve) => { entered = resolve; });
  const held = new Promise((resolve) => { release = resolve; });
  const h = await harness(t, { provider: {
    async verify(input) {
      signal = input.signal;
      entered();
      await held;
      return { appId: APP_ID, openid: PRIVATE_OPENID, phoneMasked: '138****8000' };
    }
  } });
  t.after(() => release());
  const before = businessBackup(h.repository);
  const task = h.service.loginWithPhoneCode(PHONE_CODE);
  const cancelled = assert.rejects(task, { code: 'AUTH_CANCELLED' });
  await started;
  h.service.cancelPending();
  await cancelled;
  // Wait for the real HTTP disconnect to reach the server before releasing the
  // deliberately uncooperative provider. No external provider is contacted.
  for (let attempt = 0; attempt < 100 && !signal.aborted; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(signal.aborted, true);
  release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.service.getState().status, 'guest');
  assert.equal(h.storage.getStorageSync(AUTH_STORAGE_KEY), '');
  assert.equal(h.db.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
  assert.equal(h.db.prepare('SELECT count(*) AS n FROM users').get().n, 0);
  assert.deepEqual(businessBackup(h.repository), before);
});

test('the version the owner reads is the version the login sends and the server records', async () => {
  const { CONSENT_VERSION } = await import('../server/app.js');
  const clientConfig = require('../miniprogram/config/auth');
  const agreement = fs.readFileSync(path.join(__dirname, '../miniprogram/pages/legal/index.js'), 'utf8');
  const declared = /const AGREEMENT_VERSION = '([^']+)'/.exec(agreement);

  assert.ok(declared, 'the agreement page states the version of its text');
  assert.equal(clientConfig.consentVersion, CONSENT_VERSION,
    'a client that names any other version can never log in (AUTH_CONSENT_REQUIRED)');
  assert.equal(declared[1], CONSENT_VERSION,
    'the text the owner reads must be the version stored as their consent');
});
