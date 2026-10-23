const { AuthService } = require('../../services/auth-service');
const authConfig = require('../../config/auth');

function headerMetrics() {
  let info = {};
  try { info = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()) || {}; } catch (_) {}
  const top = Number(info.statusBarHeight) || 24;
  let headerTop = top;
  try {
    const capsule = wx.getMenuButtonBoundingClientRect && wx.getMenuButtonBoundingClientRect();
    if (capsule && Number(capsule.top) > 0) headerTop = Number(capsule.top) - 6;
  } catch (_) {}
  return { headerTop: Math.max(top, headerTop) };
}

function phoneAuthorizationError(detail) {
  const message = String(detail && detail.errMsg || '');
  if (/deny|denied|cancel|取消|拒绝/i.test(message)) return '你已取消手机号授权，可以稍后再登录。';
  if (/privacy|隐私/i.test(message)) return '手机号授权暂时不可用，请稍后再试。';
  return '没有获取到手机号授权，请重新点击登录。';
}

Page({
  data: {
    headerTop: 42,
    consent: false,
    submitting: false,
    serviceConfigured: false,
    authStatus: 'guest',
    errorText: ''
  },

  onLoad() {
    this.pageActive = true;
    this.requestGeneration = 0;
    let app = null;
    try { app = getApp(); } catch (_) {}
    this.authService = app && app.globalData && app.globalData.authService
      || new AuthService({ api: wx, storage: wx, config: authConfig });
    const config = this.authService.config || authConfig;
    this.setData({ ...headerMetrics(), serviceConfigured: typeof config.apiBaseUrl === 'string' && !!config.apiBaseUrl.trim() });
    this.unsubscribeAuth = this.authService.subscribe((state) => {
      if (this.pageActive) this.setData({ authStatus: state.status });
    });
    this.setData({ authStatus: this.authService.getState().status });
  },

  onResize() {
    if (this.pageActive) this.setData(headerMetrics());
  },

  onUnload() {
    this.pageActive = false;
    this.requestGeneration += 1;
    if (this.unsubscribeAuth) this.unsubscribeAuth();
    this.unsubscribeAuth = null;
    if (this.submittingRequest && this.authService) this.authService.cancelPending();
    this.submittingRequest = false;
  },

  onConsentChange(event) {
    if (this.data.submitting) return;
    const values = event && event.detail && event.detail.value;
    this.setData({ consent: Array.isArray(values) && values.includes('agree'), errorText: '' });
  },

  requestConsent() {
    this.setData({ errorText: '请先阅读并勾选同意用户协议和隐私说明。' });
  },

  requestLogin() {
    if (!this.data.consent) return this.requestConsent();
    this.setData({ errorText: '登录服务暂未开通，请稍后再试' });
  },

  openTerms() {
    this.openAgreement('terms');
  },

  openPrivacy() {
    this.openAgreement('privacy');
  },

  openAgreement(type) {
    if (this.data.submitting || this.agreementOpening) return;
    this.agreementOpening = true;
    wx.navigateTo({
      url: `/pages/legal/index?type=${type === 'terms' ? 'terms' : 'privacy'}`,
      complete: () => { this.agreementOpening = false; },
      fail: () => {
        if (this.pageActive) this.setData({ errorText: '说明页面没有打开，请重试。' });
      }
    });
  },

  onPhoneButtonError(event) {
    if (this.pageActive && !this.data.submitting) {
      this.setData({ errorText: phoneAuthorizationError(event && event.detail) });
    }
  },

  async onGetPhoneNumber(event) {
    if (!this.pageActive || this.data.submitting) return;
    if (!this.data.consent) {
      this.requestConsent();
      return;
    }
    const detail = event && event.detail || {};
    if (typeof detail.code !== 'string' || !detail.code.trim()) {
      this.setData({ errorText: phoneAuthorizationError(detail) });
      return;
    }
    if (!this.data.serviceConfigured) return this.requestLogin();
    const generation = ++this.requestGeneration;
    this.submittingRequest = true;
    this.setData({ submitting: true, errorText: '' });
    try {
      const state = await this.authService.loginWithPhoneCode(detail.code);
      if (!this.pageActive || generation !== this.requestGeneration) return;
      if (!state || state.status !== 'authenticated' || !state.user) {
        throw new Error('账号验证未完成，请重新登录。');
      }
      this.submittingRequest = false;
      this.setData({ submitting: false });
      wx.showToast({ title: '登录成功', icon: 'success' });
      this.goBack();
    } catch (error) {
      if (!this.pageActive || generation !== this.requestGeneration) return;
      this.setData({ errorText: error && error.message || '登录未完成，请稍后再试。' });
    } finally {
      if (generation === this.requestGeneration) {
        this.submittingRequest = false;
        if (this.pageActive) this.setData({ submitting: false });
      }
    }
  },

  goBack() {
    if (this.returning) return;
    this.returning = true;
    this.requestGeneration += 1;
    if (this.submittingRequest && this.authService) this.authService.cancelPending();
    this.submittingRequest = false;
    this.setData({ submitting: false });
    const fail = () => {
      this.returning = false;
      if (this.pageActive) this.setData({ errorText: '暂时无法返回，请重试。' });
    };
    const home = () => {
      try { wx.reLaunch({ url: '/pages/home/index', fail }); } catch (_) { fail(); }
    };
    try { wx.navigateBack({ delta: 1, fail: home }); } catch (_) { home(); }
  }
});
