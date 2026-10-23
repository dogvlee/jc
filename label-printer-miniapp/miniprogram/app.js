const { KEYS, Repository } = require('./services/repository');
const { PrinterConnectionManager } = require('./services/printer-connection-manager');
const { AuthService } = require('./services/auth-service');
const authConfig = require('./config/auth');

const BRAND_RED = '#E02D26';
const UPDATE_RETRY_MS = 5000;

App({
  onLaunch() {
    const repository = new Repository(wx);
    // Pages expose a retry state; a storage fault must not abort app setup.
    try { repository.migrate(); } catch (error) { this.globalData.storageError = error.message; }
    const connectionManager = new PrinterConnectionManager({
      api: wx,
      storage: wx,
      deviceStorageKey: KEYS.lastDevice
    });
    connectionManager.bindStateListeners({ autoReconnect: true });

    this.globalData.repository = repository;
    this.globalData.connectionManager = connectionManager;
    this.globalData.bleSession = connectionManager.session;
    this.globalData.printerClient = connectionManager.printer;
    // Account identity is separate from this device's labels and printer.
    // Restore verifies a remembered account; guests never trigger cloud login.
    this.globalData.authService = new AuthService({ api: wx, storage: wx, config: authConfig });
    this.globalData.authService.restore().catch(() => undefined);

    const device = connectionManager.getSavedDevice();
    if (device && device.deviceId) {
      // Background: a remembered printer that is switched off must not block
      // the user from picking another one while this attempt waits.
      setTimeout(() => {
        connectionManager.ensureReady(device, { forceFresh: true, background: true }).catch(() => undefined);
      }, 800);
    }
    this.watchForUpdates();
  },

  watchForUpdates() {
    if (typeof wx.getUpdateManager !== 'function') return;
    let updateManager = null;
    try {
      updateManager = wx.getUpdateManager();
    } catch (error) {
      return;
    }
    if (!updateManager || typeof updateManager.onUpdateReady !== 'function') return;
    updateManager.onUpdateReady(() => this.promptUpdate(updateManager));
    // A failed download leaves the current version running; the next launch retries.
    if (typeof updateManager.onUpdateFailed === 'function') updateManager.onUpdateFailed(() => undefined);
  },

  promptUpdate(updateManager) {
    const printer = this.globalData.printerClient;
    // Restarting mid-job would cut a label in half; ask once the job is done.
    if (printer && (printer.printing || printer.jobPhase === 'printing')) {
      setTimeout(() => this.promptUpdate(updateManager), UPDATE_RETRY_MS);
      return;
    }
    wx.showModal({
      title: '发现新版本',
      content: '新版本已准备好，重启后生效。现在重启吗？',
      confirmText: '重启',
      cancelText: '稍后',
      confirmColor: BRAND_RED,
      success: (result) => {
        if (result && result.confirm) updateManager.applyUpdate();
      }
    });
  },

  globalData: {
    authService: null,
    repository: null,
    connectionManager: null,
    bleSession: null,
    printerClient: null
  }
});
