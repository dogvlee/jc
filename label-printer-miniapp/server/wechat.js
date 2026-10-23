import { AuthError } from './errors.js';

const API_ORIGIN = 'https://api.weixin.qq.com';
const MAX_RESPONSE_BYTES = 32 * 1024;

export function maskPhone(value) {
  return value.length >= 8 ? `${value.slice(0, 3)}****${value.slice(-4)}` : `${value.slice(0, 1)}****${value.slice(-2)}`;
}

function normalizePhone(info) {
  const value = info && (info.purePhoneNumber || info.phoneNumber);
  if (typeof value !== 'string' || !/^[+\d\s()-]{6,32}$/.test(value)) return '';
  let digits = value.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('86')) digits = digits.slice(2);
  return /^\d{6,20}$/.test(digits) ? digits : '';
}

async function readResponse(response) {
  if (!response.ok || !response.body) throw new AuthError('AUTH_SERVICE_FAILED', 503);
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.byteLength;
    if (length > MAX_RESPONSE_BYTES) throw new AuthError('AUTH_SERVICE_FAILED', 503);
    chunks.push(Buffer.from(chunk));
  }
  let result;
  try { result = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch (_) { throw new AuthError('AUTH_SERVICE_FAILED', 503); }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new AuthError('AUTH_SERVICE_FAILED', 503);
  return result;
}

export function createWeChatProvider({ appId, appSecret, fetchImpl = globalThis.fetch, clock = Date.now } = {}) {
  if (!/^wx[0-9a-f]{16}$/i.test(appId || '') || typeof appSecret !== 'string' || !appSecret.trim()) {
    throw new Error('请在服务端设置 WECHAT_APP_ID 和 WECHAT_APP_SECRET');
  }
  let access = null;
  // Each HTTP login owns its abort signal. A cancelled login must not cancel another login's token request.
  async function request(path, { method = 'POST', body, signal } = {}) {
    let response;
    try {
      response = await fetchImpl(new URL(path, API_ORIGIN), {
        method, redirect: 'error', signal,
        headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      return await readResponse(response);
    } catch (error) {
      if (signal?.aborted) throw new AuthError('AUTH_UPSTREAM_TIMEOUT', 503);
      if (error instanceof AuthError) throw error;
      // Never expose or log provider errors: they may contain secret-bearing URLs or phone data.
      throw new AuthError('AUTH_SERVICE_FAILED', 503);
    }
  }
  async function stableToken(signal, refresh = false) {
    if (!refresh && access && access.expiresAt > clock()) return access.token;
    const result = await request('/cgi-bin/stable_token', {
      signal, body: { grant_type: 'client_credential', appid: appId, secret: appSecret, force_refresh: refresh }
    });
    if ((result.errcode !== undefined && Number(result.errcode) !== 0)
      || typeof result.access_token !== 'string' || !result.access_token || result.access_token.length > 4096
      || !Number.isFinite(Number(result.expires_in)) || Number(result.expires_in) < 60) {
      throw new AuthError('AUTH_SERVICE_FAILED', 503);
    }
    // Keep the token at least half a minute so a short expires_in cannot turn
    // every phone lookup into another stable_token call.
    const lifetime = Math.max(30, Math.min(Number(result.expires_in), 7200) - 60);
    access = { token: result.access_token, expiresAt: clock() + lifetime * 1000 };
    return access.token;
  }
  async function phoneInfo(code, signal, refresh = false) {
    const token = await stableToken(signal, refresh);
    const result = await request(`/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(token)}`, { signal, body: { code } });
    if (!refresh && [40001, 40014, 42001].includes(Number(result.errcode))) {
      access = null;
      return phoneInfo(code, signal, true);
    }
    if (Number(result.errcode) !== 0) {
      if ([40001, 40014, 42001].includes(Number(result.errcode))) throw new AuthError('AUTH_SERVICE_FAILED', 503);
      throw new AuthError([40029, 41008].includes(Number(result.errcode)) ? 'AUTH_PHONE_EXPIRED' : 'AUTH_PHONE_FAILED', 400);
    }
    const info = result.phone_info;
    const phone = normalizePhone(info);
    // A missing watermark is not evidence that a code belongs to this mini program.
    if (!phone || !info.watermark || info.watermark.appid !== appId) throw new AuthError('AUTH_PHONE_FAILED', 400);
    return maskPhone(phone);
  }
  return {
    async verify({ loginCode, phoneCode, signal }) {
      const query = new URLSearchParams({ appid: appId, secret: appSecret, js_code: loginCode, grant_type: 'authorization_code' });
      const session = await request(`/sns/jscode2session?${query}`, { method: 'GET', signal });
      if ((session.errcode !== undefined && Number(session.errcode) !== 0)
        || typeof session.openid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(session.openid)) {
        throw new AuthError('AUTH_WECHAT_LOGIN_FAILED', 400);
      }
      const phoneMasked = await phoneInfo(phoneCode, signal);
      return { appId, openid: session.openid, phoneMasked };
    }
  };
}
