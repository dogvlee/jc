const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { request: httpRequest } = require('node:http');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHash } = require('node:crypto');

const APP_ID = 'wxba51f65eb2f643e7';
const modules = Promise.all(['app', 'wechat', 'store', 'errors'].map((name) => import(pathToFileURL(path.join(__dirname, `../server/${name}.js`)))));
const body = () => ({ loginCode: 'wechat-login-code', phoneCode: 'wechat-phone-code', consentAccepted: true, consentVersion: '2026-10-15' });
const identity = (openid = 'trusted_wechat_user') => ({ appId: APP_ID, openid, phoneMasked: '138****1234' });
const count = (db, table) => db.prepare(`SELECT count(*) AS count FROM ${table}`).get().count;

async function harness(t, options = {}) {
  const [{ createServer }] = await modules;
  const db = new DatabaseSync(':memory:');
  const time = { now: 1800000000000 };
  let calls = 0;
  const server = createServer({
    appId: APP_ID, db, clock: () => time.now,
    provider: { verify: async (input) => { calls += 1; return identity(); } },
    ...options
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    db.close();
  });
  return {
    db, time, server, baseUrl, get calls() { return calls; },
    async call(route, { method = 'GET', json, token, raw, headers = {} } = {}) {
      const response = await fetch(`${baseUrl}${route}`, {
        method, redirect: 'manual',
        headers: { ...(json !== undefined || raw !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
        ...(json !== undefined ? { body: JSON.stringify(json) } : raw !== undefined ? { body: raw } : {})
      });
      return { status: response.status, headers: response.headers, body: await response.json() };
    },
    async login(input = body()) { return this.call('/api/auth/wechat/phone', { method: 'POST', json: input }); }
  };
}

test('self-hosted login persists only trusted minimal profile and token hashes, then restores session', async (t) => {
  const h = await harness(t);
  const logged = await h.login();
  assert.equal(logged.status, 200);
  assert.equal(logged.body.ok, true);
  assert.match(logged.body.accessToken, /^[A-Za-z0-9_-]{43}$/);
  assert.match(logged.body.user.id, /^syu_[A-Za-z0-9-]{36}$/);
  assert.equal(logged.body.user.phoneMasked, '138****1234');
  assert.equal(logged.body.user.nickName, '商跃用户');
  assert.equal(logged.body.expiresAt, h.time.now + 30 * 24 * 60 * 60 * 1000);
  const profile = h.db.prepare('SELECT * FROM users').get();
  assert.deepEqual(Object.keys(profile).sort(), ['app_id', 'consent_accepted_at', 'consent_version', 'id', 'openid', 'phone_masked']);
  assert.equal(profile.app_id, APP_ID);
  assert.equal(profile.openid, 'trusted_wechat_user');
  assert.equal(profile.consent_accepted_at, h.time.now);
  assert.equal(profile.consent_version, '2026-10-15');
  const storedSession = h.db.prepare('SELECT * FROM sessions').get();
  assert.equal(storedSession.token_hash, createHash('sha256').update(logged.body.accessToken).digest('hex'));
  assert.doesNotMatch(JSON.stringify([profile, storedSession]), new RegExp(`${logged.body.accessToken}|${body().phoneCode}|${body().loginCode}|session_key`));
  const session = await h.call('/api/auth/session', { token: logged.body.accessToken });
  assert.equal(session.status, 200);
  assert.deepEqual(session.body, { ok: true, user: logged.body.user, expiresAt: logged.body.expiresAt });
  assert.equal(session.headers.get('cache-control'), 'no-store');
  assert.equal(h.calls, 1);
});

test('same trusted WeChat user upserts idempotently and distinct WeChat users never merge by masked phone', async (t) => {
  let openid = 'first_wechat_user';
  const h = await harness(t, { provider: { verify: async () => identity(openid) } });
  const first = await h.login();
  h.time.now += 1000;
  const second = await h.login();
  assert.equal(second.body.user.id, first.body.user.id);
  assert.notEqual(second.body.accessToken, first.body.accessToken);
  assert.equal(count(h.db, 'users'), 1);
  // The row keeps when the owner first agreed; the later login only renews the session.
  assert.equal(h.db.prepare('SELECT consent_accepted_at AS at FROM users').get().at, h.time.now - 1000);
  openid = 'another_wechat_user';
  const third = await h.login();
  assert.notEqual(third.body.user.id, first.body.user.id);
  assert.equal(third.body.user.phoneMasked, first.body.user.phoneMasked);
  assert.equal(count(h.db, 'users'), 2);
});

test('the first consent time survives later logins and deleting an account removes its sessions', async (t) => {
  const [, , { createStore }] = await modules;
  const h = await harness(t);
  const store = createStore({ db: h.db });

  h.time.now += 1000;
  assert.equal((await h.login()).status, 200);
  const firstConsent = h.db.prepare('SELECT consent_accepted_at FROM users').get().consent_accepted_at;
  const token = (await h.login()).body.accessToken;
  h.time.now += 86400000;
  assert.equal((await h.login()).status, 200);
  assert.equal(
    h.db.prepare('SELECT consent_accepted_at FROM users').get().consent_accepted_at,
    firstConsent,
    'a later login must not replace when the owner first agreed'
  );

  const openid = 'trusted_wechat_user';
  assert.equal(store.deleteAccount({ appId: APP_ID, openid }), 1);
  assert.equal(h.db.prepare('SELECT count(*) AS n FROM users').get().n, 0);
  assert.equal(h.db.prepare('SELECT count(*) AS n FROM sessions').get().n, 0, 'sessions go with the account');
  const after = await h.call('/api/auth/session', { token });
  assert.equal(after.status, 401, 'a deleted account can no longer use its token');
  assert.throws(() => store.deleteAccount({ appId: APP_ID }), /openid/);
});

test('expired and revoked sessions return safe 401 and are removed without deleting account profiles', async (t) => {
  const h = await harness(t, { sessionTtlMs: 1000 });
  const first = await h.login();
  const logout = await h.call('/api/auth/logout', { method: 'POST', json: {}, token: first.body.accessToken });
  assert.deepEqual(logout.body, { ok: true });
  assert.equal(count(h.db, 'sessions'), 0);
  assert.equal(count(h.db, 'users'), 1);
  assert.equal((await h.call('/api/auth/session', { token: first.body.accessToken })).status, 401);
  const second = await h.login();
  h.time.now += 1000;
  const expired = await h.call('/api/auth/session', { token: second.body.accessToken });
  assert.equal(expired.status, 401);
  assert.equal(expired.body.code, 'AUTH_INVALID_SESSION');
  assert.equal(expired.headers.get('www-authenticate'), 'Bearer');
  assert.equal(count(h.db, 'sessions'), 0);
});

test('consent and code checks reject client supplied identities before any provider request', async (t) => {
  const h = await harness(t);
  for (const patch of [{ consentAccepted: false }, { consentVersion: '2025-01-01' }]) {
    assert.equal((await h.login({ ...body(), ...patch })).body.code, 'AUTH_CONSENT_REQUIRED');
  }
  for (const patch of [{ loginCode: '' }, { phoneCode: '' }, { loginCode: 'unsafe\ncode' }]) {
    assert.equal((await h.login({ ...body(), ...patch })).body.code, 'AUTH_CODE_REQUIRED');
  }
  for (const patch of [{ openid: 'attacker' }, { phoneNumber: '13812341234' }, { appId: APP_ID }]) {
    assert.equal((await h.login({ ...body(), ...patch })).body.code, 'AUTH_REQUEST_INVALID');
  }
  assert.equal(h.calls, 0);
  assert.equal(count(h.db, 'users'), 0);
  assert.equal(count(h.db, 'sessions'), 0);
});

test('Bearer authorization is mandatory and cannot come from a query or body', async (t) => {
  const h = await harness(t);
  const logged = await h.login();
  for (const route of ['/api/auth/session', `/api/auth/session?accessToken=${logged.body.accessToken}`]) {
    const response = await h.call(route);
    assert.equal(response.status, 401);
    assert.equal(response.body.code, 'AUTH_INVALID_SESSION');
  }
  assert.equal((await h.call('/api/auth/session', { headers: { Authorization: 'Bearer invalid' } })).status, 401);
});

test('routing and input format checks return JSON errors without redirects or sensitive health output', async (t) => {
  const h = await harness(t);
  const health = await h.call('/healthz');
  assert.deepEqual(health.body, { ok: true });
  assert.equal((await h.call('/does-not-exist')).status, 404);
  const method = await h.call('/api/auth/wechat/phone');
  assert.equal(method.status, 405);
  assert.equal(method.headers.get('allow'), 'POST');
  assert.equal(method.headers.get('location'), null);
  assert.equal((await h.call('/api/auth/wechat/phone', { method: 'POST', raw: '{}', headers: { 'Content-Type': 'text/plain' } })).status, 415);
  for (const raw of ['not-json', '[]', 'null']) assert.equal((await h.call('/api/auth/wechat/phone', { method: 'POST', raw })).body.code, 'INVALID_JSON');
  assert.equal((await h.call('/api/auth/wechat/phone', { method: 'POST', raw: 'x'.repeat(8193) })).status, 413);
  assert.equal(h.calls, 0);
});

test('JSON byte limit also applies to chunked bodies without Content-Length', async (t) => {
  const h = await harness(t);
  const result = await new Promise((resolve, reject) => {
    const req = httpRequest(`${h.baseUrl}/api/auth/wechat/phone`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
      let text = '';
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }));
    });
    req.on('error', reject);
    req.write(' '.repeat(4096)); req.write(' '.repeat(4096)); req.end('{}');
  });
  assert.equal(result.status, 413);
  assert.equal(result.body.code, 'BODY_TOO_LARGE');
  assert.equal(h.calls, 0);
});

test('upstream failures never create accounts or sessions and never expose provider diagnostics', async (t) => {
  const h = await harness(t, { provider: { verify() { throw new Error('https://provider/?secret=TOPSECRET phone=13812341234 phonecode=private'); } } });
  const result = await h.login();
  assert.equal(result.status, 503);
  assert.equal(result.body.code, 'AUTH_SERVICE_FAILED');
  assert.doesNotMatch(JSON.stringify(result.body), /TOPSECRET|13812341234|provider|private/);
  assert.equal(count(h.db, 'users'), 0);
  assert.equal(count(h.db, 'sessions'), 0);
});

test('upstream timeout rejects late success without minting a session', async (t) => {
  let finish;
  const h = await harness(t, { upstreamTimeoutMs: 15, provider: { verify: () => new Promise((resolve) => { finish = resolve; }) } });
  const result = await h.login();
  assert.equal(result.status, 503);
  assert.equal(result.body.code, 'AUTH_UPSTREAM_TIMEOUT');
  finish(identity());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(count(h.db, 'users'), 0);
  assert.equal(count(h.db, 'sessions'), 0);
});

test('disconnecting during WeChat verification aborts the operation and cannot persist its late result', { timeout: 3000 }, async (t) => {
  let started;
  let aborted;
  let finish;
  const starting = new Promise((resolve) => { started = resolve; });
  const aborting = new Promise((resolve) => { aborted = resolve; });
  const h = await harness(t, { provider: { verify({ signal }) {
    signal.addEventListener('abort', aborted, { once: true });
    started();
    return new Promise((resolve) => { finish = resolve; });
  } } });
  const req = httpRequest(`${h.baseUrl}/api/auth/wechat/phone`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
  req.on('error', () => {});
  req.end(JSON.stringify(body()));
  await starting;
  req.destroy();
  await aborting;
  finish(identity());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(count(h.db, 'users'), 0);
  assert.equal(count(h.db, 'sessions'), 0);
});

test('provider cannot mint a session for another AppID or with unmasked phone content', async (t) => {
  let value = { ...identity(), appId: 'wx0000000000000000' };
  const h = await harness(t, { provider: { verify: async () => value } });
  assert.equal((await h.login()).body.code, 'AUTH_PHONE_FAILED');
  value = { ...identity(), phoneMasked: '13812341234' };
  assert.equal((await h.login()).body.code, 'AUTH_PHONE_FAILED');
  assert.equal(count(h.db, 'sessions'), 0);
});

test('login limiter blocks excess traffic and has bounded storage without trusting forwarding headers', async (t) => {
  const [{ createRateLimiter }] = await modules;
  let now = 0;
  const limiter = createRateLimiter({ maxKeys: 2, globalLimit: 100, clock: () => now });
  assert.equal(limiter.allow('a', true), true);
  assert.equal(limiter.allow('b', true), true);
  assert.equal(limiter.allow('c', true), false);
  assert.equal(limiter.size, 2);
  now = 60000;
  assert.equal(limiter.allow('c', true), true);
  assert.ok(limiter.size <= 2);
  const h = await harness(t, { rateLimit: { loginLimit: 1 } });
  assert.equal((await h.login()).status, 200);
  const response = await h.call('/api/auth/wechat/phone', { method: 'POST', json: body(), headers: { 'X-Forwarded-For': '198.51.100.4' } });
  assert.equal(response.status, 429);
  assert.equal(response.body.code, 'AUTH_RATE_LIMITED');
  assert.equal(h.calls, 1);
});

test('X-Real-IP stays ignored unless the deploy declares a proxy in front', async (t) => {
  const ignored = await harness(t, { rateLimit: { loginLimit: 1 } });
  assert.equal((await ignored.login()).status, 200);
  const sameBucket = await ignored.call('/api/auth/wechat/phone', {
    method: 'POST', json: body(), headers: { 'X-Real-IP': '198.51.100.7' }
  });
  assert.equal(sameBucket.status, 429);
  assert.equal(ignored.calls, 1);

  const trusted = await harness(t, { trustProxy: true, rateLimit: { loginLimit: 1 } });
  const first = await trusted.call('/api/auth/wechat/phone', {
    method: 'POST', json: body(), headers: { 'X-Real-IP': '198.51.100.7' }
  });
  assert.equal(first.status, 200);
  // A second client behind the same proxy must keep its own bucket.
  const second = await trusted.call('/api/auth/wechat/phone', {
    method: 'POST', json: body(), headers: { 'X-Real-IP': '198.51.100.8' }
  });
  assert.equal(second.status, 200);
  const repeat = await trusted.call('/api/auth/wechat/phone', {
    method: 'POST', json: body(), headers: { 'X-Real-IP': '198.51.100.7' }
  });
  assert.equal(repeat.status, 429);
  assert.equal(repeat.body.code, 'AUTH_RATE_LIMITED');
  assert.equal(trusted.calls, 2);
});

test('a proxied client address is only accepted when it is a literal IP', async () => {
  const [{ clientAddress }] = await modules;
  const request = (headers) => ({ headers, socket: { remoteAddress: '127.0.0.1' } });
  assert.equal(clientAddress(request({ 'x-real-ip': '198.51.100.7' }), true), '198.51.100.7');
  assert.equal(clientAddress(request({ 'x-real-ip': '2001:db8::1' }), true), '2001:db8::1');
  assert.equal(clientAddress(request({ 'x-real-ip': 'unknown' }), true), '127.0.0.1');
  assert.equal(clientAddress(request({ 'x-real-ip': '1.2.3.4:9' }), true), '127.0.0.1');
  assert.equal(clientAddress(request({ 'x-real-ip': '198.51.100.7' }), false), '127.0.0.1');
  assert.equal(clientAddress(request({}), true), '127.0.0.1');
  assert.equal(clientAddress({ headers: { 'x-real-ip': ['198.51.100.9'] }, socket: {} }, true), '198.51.100.9');
});

function wechatFixture(overrides = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: new URL(url), options });
    const pathname = new URL(url).pathname;
    const values = {
      '/sns/jscode2session': { openid: 'trusted_wechat_user', session_key: 'never-persist-this' },
      '/cgi-bin/stable_token': { access_token: 'provider-access-token', expires_in: 7200 },
      '/wxa/business/getuserphonenumber': { errcode: 0, phone_info: { purePhoneNumber: '13812341234', watermark: { appid: APP_ID } } }
    };
    const value = Object.hasOwn(overrides, pathname) ? overrides[pathname] : values[pathname];
    return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  return { calls, fetchImpl };
}

test('WeChat provider uses code2session, stable_token and verified phone watermark, keeping provider tokens private', async () => {
  const [, { createWeChatProvider }] = await modules;
  const fixture = wechatFixture();
  const provider = createWeChatProvider({ appId: APP_ID, appSecret: 'test-server-secret', fetchImpl: fixture.fetchImpl });
  const result = await provider.verify({ ...body(), signal: new AbortController().signal });
  assert.deepEqual(result, identity());
  assert.deepEqual(fixture.calls.map((call) => call.url.pathname), ['/sns/jscode2session', '/cgi-bin/stable_token', '/wxa/business/getuserphonenumber']);
  assert.equal(fixture.calls[0].url.searchParams.get('js_code'), body().loginCode);
  assert.equal(fixture.calls[0].url.searchParams.get('appid'), APP_ID);
  assert.equal(fixture.calls[0].options.method, 'GET');
  assert.equal(JSON.parse(fixture.calls[1].options.body).grant_type, 'client_credential');
  assert.equal(JSON.parse(fixture.calls[2].options.body).code, body().phoneCode);
  assert.ok(fixture.calls.every((call) => call.url.origin === 'https://api.weixin.qq.com' && call.options.redirect === 'error'));
  assert.doesNotMatch(JSON.stringify(result), /13812341234|session_key|provider-access-token/);
  await provider.verify({ ...body(), signal: new AbortController().signal });
  assert.equal(fixture.calls.filter((call) => call.url.pathname === '/cgi-bin/stable_token').length, 1);
});

test('a short provider token lifetime does not refetch the stable token on every lookup', async () => {
  const [, { createWeChatProvider }] = await modules;
  const fixture = wechatFixture({ '/cgi-bin/stable_token': { access_token: 'short-lived-token', expires_in: 60 } });
  const provider = createWeChatProvider({ appId: APP_ID, appSecret: 'test-server-secret', fetchImpl: fixture.fetchImpl });
  // expires_in = 60 used to give a cached token a lifetime of zero, so every
  // phone lookup paid for another stable_token call (and its rate limit).
  await provider.verify(body());
  await provider.verify(body());
  assert.equal(fixture.calls.filter((call) => call.url.pathname === '/cgi-bin/stable_token').length, 1);
});

test('WeChat provider rejects missing/mismatched phone watermark and expired login before any persistent side effect', async () => {
  const [, { createWeChatProvider }] = await modules;
  for (const watermark of [undefined, { appid: 'wx0000000000000000' }]) {
    const fixture = wechatFixture({ '/wxa/business/getuserphonenumber': { errcode: 0, phone_info: { purePhoneNumber: '13812341234', watermark } } });
    const provider = createWeChatProvider({ appId: APP_ID, appSecret: 'test-server-secret', fetchImpl: fixture.fetchImpl });
    await assert.rejects(provider.verify(body()), { code: 'AUTH_PHONE_FAILED' });
  }
  const fixture = wechatFixture({ '/sns/jscode2session': { errcode: 40029, errmsg: 'SECRET-DIAGNOSTIC' } });
  const provider = createWeChatProvider({ appId: APP_ID, appSecret: 'test-server-secret', fetchImpl: fixture.fetchImpl });
  await assert.rejects(provider.verify(body()), { code: 'AUTH_WECHAT_LOGIN_FAILED' });
  assert.equal(fixture.calls.length, 1);
});

test('WeChat access-token rejection forces one stable-token refresh and never retries endlessly', async () => {
  const [, { createWeChatProvider }] = await modules;
  for (const recoveryWorks of [true, false]) {
    let phoneCalls = 0;
    const tokenBodies = [];
    const fixture = wechatFixture();
    const fetchImpl = async (url, options) => {
      const pathname = new URL(url).pathname;
      if (pathname === '/cgi-bin/stable_token') tokenBodies.push(JSON.parse(options.body));
      if (pathname === '/wxa/business/getuserphonenumber' && (++phoneCalls === 1 || !recoveryWorks)) {
        return new Response(JSON.stringify({ errcode: 40001, errmsg: 'private provider diagnostics' }));
      }
      return fixture.fetchImpl(url, options);
    };
    const provider = createWeChatProvider({ appId: APP_ID, appSecret: 'test-server-secret', fetchImpl });
    if (recoveryWorks) assert.deepEqual(await provider.verify(body()), identity());
    else await assert.rejects(provider.verify(body()), { code: 'AUTH_SERVICE_FAILED' });
    assert.equal(phoneCalls, 2);
    assert.deepEqual(tokenBodies.map((value) => value.force_refresh), [false, true]);
  }
});

test('SQLite restart preserves account/session, and failed token insert rolls back the whole login', async (t) => {
  const [, , { createStore }] = await modules;
  const directory = mkdtempSync(path.join(tmpdir(), 'shangyue-auth-test-'));
  t.after(() => {
    const target = path.resolve(directory);
    assert.equal(path.dirname(target), path.resolve(tmpdir()));
    assert.ok(path.basename(target).startsWith('shangyue-auth-test-'));
    rmSync(target, { recursive: true, force: true });
  });
  const databasePath = path.join(directory, 'auth.sqlite');
  const data = { ...identity(), consentVersion: '2026-10-15', now: 1000, expiresAt: 100000, tokenHash: 'a'.repeat(64) };
  let store = createStore({ databasePath });
  const user = store.issue(data);
  store.close();
  store = createStore({ databasePath });
  assert.deepEqual(store.session(data.tokenHash, 2000, APP_ID).user, user);
  assert.equal(store.session(data.tokenHash, 2000, 'wx0000000000000000'), null);
  assert.throws(() => store.issue({ ...data, openid: 'another-user', tokenHash: data.tokenHash }));
  store.close();
  const db = new DatabaseSync(databasePath);
  assert.equal(count(db, 'users'), 1);
  assert.equal(count(db, 'sessions'), 1);
  db.close();
});
