import { createServer as createHttpServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { AuthError, publicFailure } from './errors.js';
import { createStore } from './store.js';
import { createWeChatProvider } from './wechat.js';

// Keep equal to miniprogram/config/auth.js (sent by the client) and to
// AGREEMENT_VERSION in miniprogram/pages/legal/index.js (the text the owner
// reads): tests/auth-integration.test.js fails when they drift apart.
export const CONSENT_VERSION = '2026-10-15';
export const JSON_LIMIT_BYTES = 8 * 1024;
export const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ROUTES = new Map([
  ['/healthz', 'GET'],
  ['/api/auth/wechat/phone', 'POST'],
  ['/api/auth/session', 'GET'],
  ['/api/auth/logout', 'POST']
]);
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export function createRateLimiter({ maxKeys = 2000, windowMs = 60000, loginLimit = 10, sessionLimit = 120, globalLimit = 300, clock = Date.now } = {}) {
  const buckets = new Map();
  let globalBucket = { start: clock(), count: 0 };
  return {
    allow(key, login) {
      const now = clock();
      if (now - globalBucket.start >= windowMs) globalBucket = { start: now, count: 0 };
      if (++globalBucket.count > globalLimit) return false;
      const scoped = `${login ? 'login' : 'session'}:${key}`;
      let bucket = buckets.get(scoped);
      if (!bucket || now - bucket.start >= windowMs) {
        if (!bucket && buckets.size >= maxKeys) {
          for (const [entry, value] of buckets) if (now - value.start >= windowMs) buckets.delete(entry);
          if (buckets.size >= maxKeys) return false;
        }
        bucket = { start: now, count: 0 };
        buckets.set(scoped, bucket);
      }
      return ++bucket.count <= (login ? loginLimit : sessionLimit);
    },
    get size() { return buckets.size; }
  };
}

// Only a deploy that puts a reverse proxy in front (TRUST_PROXY=1) may name
// the client: the proxy must overwrite this header, never pass a client value
// through. Anything else falls back to the TCP peer address, so a caller
// cannot pick its own rate-limit bucket by sending a header.
export const PROXY_CLIENT_HEADER = 'x-real-ip';
// An IPv4 or IPv6 literal; anything else is not an address this header may name.
const CLIENT_ADDRESS = /^(?:\d{1,3}(?:\.\d{1,3}){3}|(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4})$/i;

export function clientAddress(req, trustProxy) {
  if (trustProxy) {
    const header = req.headers ? req.headers[PROXY_CLIENT_HEADER] : '';
    const value = String(Array.isArray(header) ? header[0] : header || '').trim();
    if (CLIENT_ADDRESS.test(value)) return value.toLowerCase();
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function send(res, status, body, headers = {}) {
  if (res.destroyed || res.writableEnded) return;
  const content = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(content),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  res.end(content);
}

function jsonType(req) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '')
    || (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity')) {
    throw new AuthError('UNSUPPORTED_MEDIA_TYPE', 415);
  }
}

function readJson(req, timeoutMs, allowEmpty = false) {
  jsonType(req);
  if (Number(req.headers['content-length']) > JSON_LIMIT_BYTES) throw new AuthError('BODY_TOO_LARGE', 413);
  return new Promise((resolve, reject) => {
    let size = 0;
    let settled = false;
    const chunks = [];
    const timer = setTimeout(() => finish(new AuthError('REQUEST_TIMEOUT', 408)), timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      req.off('data', data); req.off('end', end); req.off('aborted', aborted); req.off('error', aborted);
    };
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) { req.resume(); reject(error); }
      else resolve(value);
    };
    const data = (chunk) => {
      size += chunk.length;
      if (size > JSON_LIMIT_BYTES) finish(new AuthError('BODY_TOO_LARGE', 413));
      else chunks.push(chunk);
    };
    const end = () => {
      try {
        if (!size && allowEmpty) return finish(null, {});
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('object required');
        finish(null, value);
      } catch (_) { finish(new AuthError('INVALID_JSON', 400)); }
    };
    const aborted = () => finish(new AuthError('INVALID_JSON', 400));
    req.on('data', data); req.on('end', end); req.on('aborted', aborted); req.on('error', aborted);
  });
}

function bearer(req) {
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization || '');
  if (!match) throw new AuthError('AUTH_INVALID_SESSION', 401);
  return match[1];
}

function loginInput(input) {
  const allowed = new Set(['loginCode', 'phoneCode', 'consentAccepted', 'consentVersion']);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new AuthError('AUTH_REQUEST_INVALID', 400);
  if (input.consentAccepted !== true || input.consentVersion !== CONSENT_VERSION) throw new AuthError('AUTH_CONSENT_REQUIRED', 400);
  const code = (value) => typeof value === 'string' && value.length <= 4096 && value.trim().length > 0 && !/[\u0000-\u0020\u007f]/.test(value);
  if (!code(input.loginCode) || !code(input.phoneCode)) throw new AuthError('AUTH_CODE_REQUIRED', 400);
}

export function createApp(options = {}) {
  const appId = options.appId || process.env.WECHAT_APP_ID;
  if (!/^wx[0-9a-f]{16}$/i.test(appId || '')) throw new Error('请在服务端设置 WECHAT_APP_ID');
  const clock = options.clock || Date.now;
  const provider = options.provider || createWeChatProvider({ appId, appSecret: options.appSecret || process.env.WECHAT_APP_SECRET, clock });
  const store = options.store || createStore({ db: options.db, databasePath: options.databasePath });
  const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const upstreamTimeoutMs = options.upstreamTimeoutMs ?? 18000;
  if (!Number.isSafeInteger(sessionTtlMs) || sessionTtlMs <= 0 || sessionTtlMs > 90 * 24 * 60 * 60 * 1000
    || !Number.isFinite(upstreamTimeoutMs) || upstreamTimeoutMs <= 0 || upstreamTimeoutMs > 20000) {
    store.close();
    throw new Error('登录服务时限配置无效');
  }
  const limiter = options.limiter || createRateLimiter({ clock, ...(options.rateLimit || {}) });
  const trustProxy = options.trustProxy === true;
  const pendingLogins = new Set();
  let closed = false;
  const cleanupTimer = setInterval(() => { try { store.cleanup(clock()); } catch (_) { /* Request path reports failures safely. */ } }, 60000);
  cleanupTimer.unref();

  async function verify(input, req, res) {
    if (pendingLogins.size >= 20) throw new AuthError('AUTH_RATE_LIMITED', 429);
    const controller = new AbortController();
    pendingLogins.add(controller);
    let rejectOperation;
    const cancelled = () => {
      controller.abort();
      rejectOperation?.(new AuthError('AUTH_UPSTREAM_TIMEOUT', 503));
    };
    const disconnected = () => { if (!res.writableEnded) cancelled(); };
    req.once('aborted', cancelled);
    res.once('close', disconnected);
    let timer;
    try {
      const identity = await Promise.race([
        Promise.resolve().then(() => provider.verify({ loginCode: input.loginCode, phoneCode: input.phoneCode, signal: controller.signal })),
        new Promise((_, reject) => { rejectOperation = reject; timer = setTimeout(cancelled, upstreamTimeoutMs); })
      ]);
      if (controller.signal.aborted || res.destroyed || closed) throw new AuthError('AUTH_UPSTREAM_TIMEOUT', 503);
      if (!identity || identity.appId !== appId || typeof identity.openid !== 'string'
        || !/^[A-Za-z0-9_-]{1,128}$/.test(identity.openid)
        || typeof identity.phoneMasked !== 'string' || !/^\d{1,3}\*{4}\d{2,4}$/.test(identity.phoneMasked)) {
        throw new AuthError('AUTH_PHONE_FAILED', 400);
      }
      return identity;
    } finally {
      clearTimeout(timer);
      req.off('aborted', cancelled);
      res.off('close', disconnected);
      pendingLogins.delete(controller);
    }
  }

  const handler = async (req, res) => {
    let pathname;
    try {
      if (closed) throw new AuthError('AUTH_SERVICE_FAILED', 503);
      if (!req.url?.startsWith('/')) throw new AuthError('NOT_FOUND', 404);
      pathname = new URL(req.url, 'http://localhost').pathname;
      const method = ROUTES.get(pathname);
      if (!method) throw new AuthError('NOT_FOUND', 404);
      if (req.method !== method) throw new AuthError('METHOD_NOT_ALLOWED', 405);
      if (pathname === '/healthz') return send(res, 200, { ok: true });
      // Client headers are ignored unless the deploy declares a proxy in front
      // (TRUST_PROXY=1) that overwrites X-Real-IP; the proxy also keeps its own
      // per-source limits.
      if (!limiter.allow(clientAddress(req, trustProxy), pathname.endsWith('/phone'))) throw new AuthError('AUTH_RATE_LIMITED', 429);
      if (pathname === '/api/auth/wechat/phone') {
        const input = await readJson(req, 5000);
        loginInput(input);
        const identity = await verify(input, req, res);
        const now = clock();
        const accessToken = randomBytes(32).toString('base64url');
        const expiresAt = now + sessionTtlMs;
        const user = store.issue({ ...identity, consentVersion: CONSENT_VERSION, now, expiresAt, tokenHash: hashToken(accessToken) });
        return send(res, 200, { ok: true, user, accessToken, expiresAt });
      }
      if (pathname === '/api/auth/logout') {
        const input = await readJson(req, 5000, true);
        if (Object.keys(input).length) throw new AuthError('AUTH_REQUEST_INVALID', 400);
      }
      const tokenHash = hashToken(bearer(req));
      const session = store.session(tokenHash, clock(), appId);
      if (!session) throw new AuthError('AUTH_INVALID_SESSION', 401);
      if (pathname === '/api/auth/logout') {
        store.revoke(tokenHash, clock());
        return send(res, 200, { ok: true });
      }
      return send(res, 200, { ok: true, ...session });
    } catch (error) {
      req.resume();
      const failure = publicFailure(error);
      const headers = { Connection: 'close' };
      if (failure.status === 405 && ROUTES.has(pathname)) headers.Allow = ROUTES.get(pathname);
      if (failure.status === 401) headers['WWW-Authenticate'] = 'Bearer';
      if (failure.status === 429) headers['Retry-After'] = '60';
      send(res, failure.status, failure.body, headers);
    }
  };
  handler.close = () => {
    if (closed) return;
    closed = true;
    clearInterval(cleanupTimer);
    for (const controller of pendingLogins) controller.abort();
    store.close();
  };
  return handler;
}

export function createServer(options = {}) {
  const app = createApp(options);
  const server = createHttpServer({ maxHeaderSize: 8192, requestTimeout: 10000, headersTimeout: 10000, keepAliveTimeout: 5000 }, (req, res) => {
    app(req, res).catch(() => send(res, 503, { ok: false, code: 'AUTH_SERVICE_FAILED', msg: '登录服务暂不可用，请稍后重试' }));
  });
  server.maxConnections = 100;
  server.on('close', app.close);
  return server;
}
