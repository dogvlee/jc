const { KEYS, Repository } = require('./services/repository');
const { PrinterConnectionManager } = require('./services/printer-connection-manager');

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

    const device = connectionManager.getSavedDevice();
    if (device && device.deviceId) {
      setTimeout(() => {
        connectionManager.ensureReady(device, { forceFresh: true }).catch(() => undefined);
      }, 800);
    }
  },

  globalData: {
    repository: null,
    connectionManager: null,
    bleSession: null,
    printerClient: null
  }
});
