const DEFAULT_CONFIG = require('../config/auth');

// Private authentication memory is deliberately outside Repository and its backups.
const AUTH_STORAGE_KEY = 'shangyue:auth-session:v1';
const REQUEST_TIMEOUT_MS = 25000;
// A hickup of the network or of the owner's service is not a logout: the
// remembered session is retried once before the page shows a guest.
const TRANSIENT_CODES = ['AUTH_TIMEOUT', 'AUTH_SERVICE_FAILED', 'AUTH_UPSTREAM_TIMEOUT', 'AUTH_RATE_LIMITED'];
const TRANSIENT_RETRY_MS = 800;

function isTransient(error) {
  return Boolean(error) && TRANSIENT_CODES.indexOf(error.code) >= 0;
}
const PUBLIC_ERRORS = {
  AUTH_NOT_CONFIGURED: '登录服务暂未开通，请稍后再试',
  AUTH_INVALID_CONFIG: '登录服务暂不可用，请稍后再试',
  AUTH_UNAVAILABLE: '当前微信暂不支持登录，请更新微信后重试',
  AUTH_TIMEOUT: '登录等待超时，请检查网络后重试',
  AUTH_CANCELLED: '登录已取消',
  AUTH_CODE_REQUIRED: '没有获取到手机号授权，请重新点击登录',
  AUTH_WECHAT_LOGIN_FAILED: '微信身份验证失败，请重新点击登录',
  AUTH_CONSENT_REQUIRED: '请阅读并同意隐私政策和服务协议后再登录',
  AUTH_PHONE_EXPIRED: '手机号授权已过期，请重新点击登录',
  AUTH_PHONE_FAILED: '手机号验证未完成，请重新点击登录',
  AUTH_PROFILE_INVALID: '账号验证未完成，请重新登录',
  AUTH_INVALID_SESSION: '登录已过期，请重新登录',
  AUTH_ACCOUNT_CHANGED: '当前账号已变化，请重新登录',
  AUTH_RATE_LIMITED: '登录尝试较多，请稍后再试',
  AUTH_UPSTREAM_TIMEOUT: '微信登录服务响应超时，请稍后再试',
  AUTH_STORAGE_FAILED: '登录状态未能保存，请检查手机存储空间后重试',
  AUTH_LOGOUT_STORAGE_FAILED: '退出状态未能保存，请重试',
  AUTH_SERVICE_FAILED: '登录服务暂不可用，请检查网络后重试'
};

function authError(code) {
  const safeCode = Object.prototype.hasOwnProperty.call(PUBLIC_ERRORS, code) ? code : 'AUTH_SERVICE_FAILED';
  const error = new Error(PUBLIC_ERRORS[safeCode]);
  error.code = safeCode;
  return error;
}

function absent(value) {
  return value === '' || value === undefined || value === null;
}

function publicUser(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || typeof value.id !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(value.id)
    || typeof value.phoneMasked !== 'string' || !/^\+?\d{1,5}\*{3,8}\d{2,4}$/.test(value.phoneMasked)
    || typeof value.nickName !== 'string') throw authError('AUTH_PROFILE_INVALID');
  const nickName = value.nickName.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40);
  if (!nickName) throw authError('AUTH_PROFILE_INVALID');
  return { id: value.id, phoneMasked: value.phoneMasked, nickName };
}

function validToken(value) {
  return typeof value === 'string' && value.length >= 16 && value.length <= 4096
    && /^[A-Za-z0-9._~+/-]+={0,2}$/.test(value);
}

function validExpiry(value) {
  return Number.isSafeInteger(value) && value > Date.now();
}

// No response URL is used for a subsequent request. Limit the configured base
// to HTTPS and ordinary path segments; HTTP requires an explicit loopback opt-in.
function endpoint(config) {
  const raw = typeof config.apiBaseUrl === 'string' ? config.apiBaseUrl.trim() : '';
  if (!raw) throw authError('AUTH_NOT_CONFIGURED');
  const match = /^(https?):\/\/([A-Za-z0-9.-]+)(?::([0-9]{1,5}))?((?:\/[A-Za-z0-9._~-]+)*\/*)$/i.exec(raw);
  if (!match || !/^wx[a-f0-9]{16}$/i.test(String(config.appId || ''))
    || typeof config.consentVersion !== 'string' || !config.consentVersion) throw authError('AUTH_INVALID_CONFIG');
  const scheme = match[1].toLowerCase();
  const host = match[2].toLowerCase();
  const port = match[3] ? Number(match[3]) : 0;
  const path = (match[4] || '').replace(/\/+$/, '');
  if ((match[3] && (port < 1 || port > 65535)) || host.split('.').some((part) => !part || /^-|-$/.test(part))
    || path.split('/').some((part) => part === '.' || part === '..')
    || (scheme !== 'https' && !(config.allowInsecureLocalhost === true && (host === 'localhost' || host === '127.0.0.1')))) {
    throw authError('AUTH_INVALID_CONFIG');
  }
  const explicitPort = port && !((scheme === 'https' && port === 443) || (scheme === 'http' && port === 80)) ? ':' + port : '';
  const origin = scheme + '://' + host + explicitPort;
  return { origin, baseUrl: origin + path, appId: config.appId };
}

class AuthService {
  constructor(options) {
    const settings = options || {};
    this.api = settings.api || (typeof wx !== 'undefined' ? wx : null);
    this.storage = settings.storage || this.api;
    this.config = Object.assign({}, DEFAULT_CONFIG, settings.config || {});
    this.state = { status: 'guest', user: null, error: '' };
    this.listeners = [];
    this.generation = 0;
    this.pending = null;
    this.logoutPending = null;
    this.operationTimeoutMs = REQUEST_TIMEOUT_MS;
    // Tests shorten the retry; a real page waits a moment so a slow network
    // recovers without the owner seeing a login screen flash by.
    this.retryDelayMs = Number(settings.retryDelayMs) >= 0 ? Number(settings.retryDelayMs) : TRANSIENT_RETRY_MS;
  }

  getState() {
    return { status: this.state.status, user: this.state.user && Object.assign({}, this.state.user), error: this.state.error };
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter((item) => item !== listener); };
  }

  emit(status, user, error) {
    this.state = { status, user: user ? Object.assign({}, user) : null, error: error || '' };
    this.listeners.slice().forEach((listener) => {
      try {
        const returned = listener(this.getState());
        if (returned && typeof returned.catch === 'function') returned.catch(() => {});
      } catch (failure) { /* Page callbacks cannot change the authentication result. */ }
    });
    return this.getState();
  }

  readMemory(allowExpired) {
    let value;
    try {
      if (!this.storage || typeof this.storage.getStorageSync !== 'function') throw new Error('storage unavailable');
      value = this.storage.getStorageSync(AUTH_STORAGE_KEY);
    } catch (error) { throw authError('AUTH_STORAGE_FAILED'); }
    if (!value || value.version !== 1 || value.remembered !== true) return null;
    const target = endpoint(this.config);
    if (value.origin !== target.origin || value.apiBaseUrl !== target.baseUrl || value.appId !== target.appId
      || typeof value.userId !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(value.userId)
      || !validToken(value.accessToken) || !Number.isSafeInteger(value.expiresAt)) return null;
    if (!allowExpired && !validExpiry(value.expiresAt)) {
      this.forget();
      throw authError('AUTH_INVALID_SESSION');
    }
    return { userId: value.userId, accessToken: value.accessToken, expiresAt: value.expiresAt, target };
  }

  remember(user, accessToken, expiresAt, target) {
    const value = {
      version: 1, remembered: true, origin: target.origin, apiBaseUrl: target.baseUrl,
      appId: target.appId, userId: user.id, accessToken, expiresAt
    };
    try {
      if (!this.storage || typeof this.storage.setStorageSync !== 'function') throw new Error('storage unavailable');
      this.storage.setStorageSync(AUTH_STORAGE_KEY, value);
      if (JSON.stringify(this.storage.getStorageSync(AUTH_STORAGE_KEY)) !== JSON.stringify(value)) throw new Error('storage verification failed');
    } catch (error) {
      try { this.forget(); } catch (cleanupError) {}
      throw authError('AUTH_STORAGE_FAILED');
    }
  }

  forget() {
    if (!this.storage || typeof this.storage.getStorageSync !== 'function') throw authError('AUTH_LOGOUT_STORAGE_FAILED');
    try {
      this.storage.removeStorageSync(AUTH_STORAGE_KEY);
      if (absent(this.storage.getStorageSync(AUTH_STORAGE_KEY))) return;
    } catch (error) { /* A tombstone also prevents restoration if removal fails. */ }
    try {
      this.storage.setStorageSync(AUTH_STORAGE_KEY, { version: 1, remembered: false });
      const saved = this.storage.getStorageSync(AUTH_STORAGE_KEY);
      if (saved && saved.version === 1 && saved.remembered === false) return;
    } catch (error) {}
    throw authError('AUTH_LOGOUT_STORAGE_FAILED');
  }

  restore() {
    if (this.pending) return this.pending.promise;
    let memory;
    try { memory = this.readMemory(); } catch (error) {
      this.emit('guest', null, error.message);
      return Promise.reject(error);
    }
    if (!memory) return Promise.resolve(this.emit('guest', null, ''));
    const flight = this.start('restore', null, memory).catch((error) => {
      if (!isTransient(error) || !this.restoreStillWanted(memory)) throw error;
      return new Promise((resolve) => setTimeout(resolve, this.retryDelayMs))
        .then(() => {
          // The owner may have signed in, signed out or started logging in
          // while the retry waited; that operation now owns the state.
          if (this.pending || !this.restoreStillWanted(memory)) return this.getState();
          return this.start('restore', null, memory);
        })
        .catch((retryError) => {
          // Still unreachable: the page reads as a guest, but the token stays
          // so the next launch can restore without a fresh phone consent.
          this.emit('guest', null, retryError.message);
          throw retryError;
        });
    });
    // Concurrent callers share this flight, retry included.
    if (this.pending) this.pending.promise = flight;
    return flight;
  }

  // A retry only makes sense while the same remembered session is on this
  // device and the owner has not signed in or out in the meantime.
  restoreStillWanted(memory) {
    if (!memory || this.state.status === 'authenticated') return false;
    try {
      const stored = this.readMemory(true);
      return Boolean(stored && stored.accessToken === memory.accessToken);
    } catch (error) {
      return false;
    }
  }

  loginWithPhoneCode(phoneCode) {
    if (this.pending && this.pending.kind === 'login') return this.pending.promise;
    if (this.state.status === 'authenticated') return Promise.resolve(this.getState());
    if (typeof phoneCode !== 'string' || !phoneCode.trim() || phoneCode.length > 4096) {
      const error = authError('AUTH_CODE_REQUIRED');
      this.emit('guest', null, error.message);
      return Promise.reject(error);
    }
    this.cancelPending();
    return this.start('login', phoneCode, null);
  }

  assertCurrent(operation) {
    if (operation.finished || (!operation.detached
      && (this.pending !== operation || this.generation !== operation.generation))) throw authError('AUTH_CANCELLED');
  }

  bounded(operation, work) {
    return new Promise((resolve, reject) => {
      const finish = (error, value) => {
        if (operation.finished) return;
        operation.finished = true;
        clearTimeout(timer);
        operation.cancelOperation = null;
        if (error) {
          if (operation.abortCurrent) {
            try { operation.abortCurrent(); } catch (failure) {}
          }
          reject(error);
        } else resolve(value);
      };
      operation.deadline = Date.now() + this.operationTimeoutMs;
      const timer = setTimeout(() => finish(authError('AUTH_TIMEOUT')), this.operationTimeoutMs);
      operation.cancelOperation = () => finish(authError('AUTH_CANCELLED'));
      Promise.resolve().then(() => {
        this.assertCurrent(operation);
        return work();
      }).then((value) => finish(null, value), (error) => finish(error));
    });
  }

  loginCode(operation) {
    this.assertCurrent(operation);
    if (!this.api || typeof this.api.login !== 'function') return Promise.reject(authError('AUTH_UNAVAILABLE'));
    return new Promise((resolve, reject) => {
      try {
        this.api.login({
          timeout: Math.max(1, operation.deadline - Date.now()),
          success: (result) => {
            if (!result || typeof result.code !== 'string' || !result.code.trim()) reject(authError('AUTH_WECHAT_LOGIN_FAILED'));
            else resolve(result.code);
          },
          fail: (error) => {
            const message = String(error && error.errMsg || '');
            reject(authError(/cancel|deny/i.test(message) ? 'AUTH_CANCELLED'
              : /timeout|timed out/i.test(message) ? 'AUTH_TIMEOUT' : 'AUTH_WECHAT_LOGIN_FAILED'));
          }
        });
      } catch (error) { reject(authError('AUTH_WECHAT_LOGIN_FAILED')); }
    });
  }

  request(operation, method, path, target, data, accessToken) {
    this.assertCurrent(operation);
    if (!this.api || typeof this.api.request !== 'function') return Promise.reject(authError('AUTH_UNAVAILABLE'));
    return new Promise((resolve, reject) => {
      let complete = false;
      const finish = (error, value) => {
        if (complete) return;
        complete = true;
        operation.abortCurrent = null;
        if (error) reject(error); else resolve(value);
      };
      const header = { 'content-type': 'application/json' };
      if (accessToken) header.Authorization = 'Bearer ' + accessToken;
      try {
        const task = this.api.request({
          url: target.baseUrl + path, method, header, data,
          timeout: Math.max(1, operation.deadline - Date.now()),
          success: (response) => finish(null, response),
          fail: (error) => finish(authError(/timeout|timed out/i.test(String(error && error.errMsg || ''))
            ? 'AUTH_TIMEOUT' : 'AUTH_SERVICE_FAILED'))
        });
        if (!complete && task && typeof task.abort === 'function') operation.abortCurrent = () => task.abort();
      } catch (error) { finish(authError('AUTH_SERVICE_FAILED')); }
    });
  }

  responseBody(response, operation) {
    this.assertCurrent(operation);
    if (response && Number(response.statusCode) === 401) {
      if (!operation.detached) this.forget();
      throw authError('AUTH_INVALID_SESSION');
    }
    const result = response && response.data;
    const status = Number(response && response.statusCode);
    if (!Number.isInteger(status) || status < 200 || status >= 300
      || !result || result.ok !== true) throw authError(result && result.code);
    return result;
  }

  start(kind, phoneCode, memory) {
    const operation = { kind, generation: ++this.generation, finished: false, abortCurrent: null, promise: null };
    this.pending = operation;
    operation.promise = this.bounded(operation, async () => {
      const target = endpoint(this.config);
      let response;
      if (kind === 'login') {
        const loginCode = await this.loginCode(operation);
        this.assertCurrent(operation);
        response = await this.request(operation, 'POST', '/api/auth/wechat/phone', target, {
          loginCode, phoneCode, consentAccepted: true, consentVersion: this.config.consentVersion
        });
      } else {
        response = await this.request(operation, 'GET', '/api/auth/session', target, undefined, memory.accessToken);
      }
      const result = this.responseBody(response, operation);
      if (kind === 'restore' && result.user === null) {
        this.forget();
        return this.emit('guest', null, '');
      }
      const user = publicUser(result.user);
      const token = kind === 'login' ? result.accessToken : memory.accessToken;
      if (!validToken(token) || !validExpiry(result.expiresAt)) {
        if (memory) this.forget();
        throw authError('AUTH_INVALID_SESSION');
      }
      if (memory && memory.userId !== user.id) {
        this.forget();
        throw authError('AUTH_ACCOUNT_CHANGED');
      }
      this.assertCurrent(operation);
      this.remember(user, token, result.expiresAt, target);
      this.assertCurrent(operation);
      return this.emit('authenticated', user, '');
    }).catch((failure) => {
      const error = authError(failure && failure.code);
      // A transient restore failure keeps the current status (restoring): the
      // caller retries once instead of telling the owner they were logged out.
      const keepStatus = kind === 'restore' && isTransient(error);
      if (!keepStatus && this.pending === operation && this.generation === operation.generation) {
        this.emit('guest', null, error.message);
      }
      throw error;
    }).finally(() => { if (this.pending === operation) this.pending = null; });
    operation.promise.catch(() => {});
    this.emit(kind === 'restore' ? 'restoring' : 'logging-in', null, '');
    return operation.promise;
  }

  cancelPending() {
    const operation = this.pending;
    if (!operation) return this.getState();
    this.generation += 1;
    this.pending = null;
    if (operation.cancelOperation) operation.cancelOperation();
    return this.emit('guest', null, '');
  }

  logout() {
    if (this.logoutPending) return this.logoutPending;
    this.cancelPending();
    let remembered = null;
    try { remembered = this.readMemory(true); } catch (error) { /* Local logout still works without network configuration. */ }
    try { this.forget(); } catch (error) {
      this.emit('guest', null, error.message);
      return Promise.reject(error);
    }
    this.emit('guest', null, '');
    if (!remembered) return Promise.resolve(this.getState());
    const operation = { detached: true, finished: false, abortCurrent: null };
    const task = this.bounded(operation, async () => {
      const response = await this.request(operation, 'POST', '/api/auth/logout', remembered.target, {}, remembered.accessToken);
      this.responseBody(response, operation);
    }).catch(() => {
      // Failed remote revocation must never restore a locally logged-out user.
    }).then(() => this.getState()).finally(() => { if (this.logoutPending === task) this.logoutPending = null; });
    this.logoutPending = task;
    return task;
  }
}

module.exports = { AuthService, AUTH_STORAGE_KEY, REQUEST_TIMEOUT_MS };
