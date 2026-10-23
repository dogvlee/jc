const MESSAGES = Object.freeze({
  AUTH_CONSENT_REQUIRED: '请阅读并同意用户协议和隐私说明后再登录',
  AUTH_CODE_REQUIRED: '没有获取到微信授权，请重新点击登录',
  AUTH_REQUEST_INVALID: '登录请求无效，请重新点击登录',
  AUTH_WECHAT_LOGIN_FAILED: '微信身份验证未完成，请重新点击登录',
  AUTH_PHONE_EXPIRED: '手机号授权已过期，请重新点击登录',
  AUTH_PHONE_FAILED: '手机号验证未完成，请重新点击登录',
  AUTH_INVALID_SESSION: '登录已失效，请重新登录',
  AUTH_RATE_LIMITED: '操作过于频繁，请稍后再试',
  AUTH_UPSTREAM_TIMEOUT: '登录等待超时，请稍后重试',
  AUTH_SERVICE_FAILED: '登录服务暂不可用，请稍后重试',
  INVALID_JSON: '请求内容无法读取，请重试',
  BODY_TOO_LARGE: '请求内容过大，请重新操作',
  UNSUPPORTED_MEDIA_TYPE: '请求格式不支持，请更新小程序后重试',
  REQUEST_TIMEOUT: '请求等待超时，请重试',
  METHOD_NOT_ALLOWED: '请求方式不支持',
  NOT_FOUND: '请求地址不存在'
});

export class AuthError extends Error {
  constructor(code, status = 400) {
    const safeCode = Object.hasOwn(MESSAGES, code) ? code : 'AUTH_SERVICE_FAILED';
    super(MESSAGES[safeCode]);
    this.code = safeCode;
    this.status = safeCode === code ? status : 503;
  }
}

export function publicFailure(error) {
  const safe = error instanceof AuthError ? error : new AuthError('AUTH_SERVICE_FAILED', 503);
  return { status: safe.status, body: { ok: false, code: safe.code, msg: safe.message } };
}
