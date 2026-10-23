const { showBleError } = require('../../services/ble-errors');
const {
  classifyPrinter,
  printerDisplayName,
  signalLabel,
  sortDevices
} = require('../../core/printer-names');
const { getProfile, printerNameProfileId, savedPrinterProfile } = require('../../core/profiles');
const { isDesktopWeChat, platformName } = require('../../services/platform');

// Shared printer picker for the home and editor pages:
//   <printer-picker show="{{showDevices}}" bind:close="closeDevices" bind:connected="onPrinterConnected" />
// 'connected' detail: { result, device } (result = ensureReady result). The
// page decides whether to close the sheet; 'close' is only a request.

const BRAND_RED = '#E02D26';
const SCAN_WINDOW_MS = 15000;
const DESKTOP_MESSAGE = '电脑版微信暂不支持连接蓝牙打印机，请在手机微信里打开商跃标签';
const UNAVAILABLE_MESSAGE = '蓝牙功能暂时不能使用。请关闭小程序后重新打开，再试一次。';
const PRINTING_MESSAGE = '正在打印，打印完成后才能搜索打印机。';

function services() {
  let app = null;
  try {
    app = typeof getApp === 'function' ? getApp() : null;
  } catch (error) {
    app = null;
  }
  const globalData = app && app.globalData || {};
  return {
    manager: globalData.connectionManager || null,
    session: globalData.bleSession || null,
    printer: globalData.printerClient || null
  };
}

// Every nearby device can be connected; 深云达 (SYD) printers come first and
// are labelled 打印机, with the paper width when their name states it
// (SYD-58 -> 58mm 打印机).
function printerLabel(device, printer) {
  if (!printer.supported) return '';
  const stated = printerNameProfileId(printerDisplayName(device));
  return stated ? getProfile(stated).name : '打印机';
}

function toItem(device) {
  const printer = classifyPrinter(device);
  return {
    deviceId: device.deviceId,
    name: printerDisplayName(device),
    label: printerLabel(device, printer),
    printer: printer.supported,
    signal: signalLabel(device.RSSI)
  };
}

// The connected card says which paper width labels are printed for: the
// width the user picked for this printer, else the one its name states,
// else 58mm, the same rule the print sheet uses.
function linkView(state) {
  const device = state && state.device;
  const profile = device ? savedPrinterProfile(device) : null;
  return {
    linkStatus: state && state.status || 'disconnected',
    linkName: device ? printerDisplayName(device) : '',
    linkPaper: profile ? `${profile.paperMaxMm}mm` : '',
    linkBackground: Boolean(state && state.background)
  };
}

// Resolves true when the user confirms.
function confirmModal(options) {
  return new Promise((resolve) => {
    wx.showModal(Object.assign({}, options, {
      success: (result) => resolve(Boolean(result && result.confirm)),
      fail: () => resolve(false)
    }));
  });
}

function showNotice(title, content) {
  wx.showModal({ title, content, showCancel: false, confirmText: '知道了', confirmColor: BRAND_RED });
}

Component({
  options: { addGlobalClass: true },

  properties: {
    show: { type: Boolean, value: false }
  },

  data: {
    notice: '',
    androidHint: false,
    scanning: false,
    scanEnded: false,
    scanHint: '',
    devices: [],
    connectingId: '',
    busy: false,
    checking: false,
    linkStatus: 'disconnected',
    linkName: '',
    linkPaper: '',
    linkBackground: false
  },

  observers: {
    show(value) {
      if (value) this.open();
      else this.deactivate();
    }
  },

  lifetimes: {
    created() {
      this.alive = true;
      this.active = false;
      this.connecting = false;
      this.scanGeneration = 0;
      this.scanTimer = null;
      this.devices = new Map();
      this.unsubscribeLink = null;
      this.resumeOnShow = false;
    },

    attached() {
      this.alive = true;
      this.subscribeLink();
      if (this.data.show) this.open();
    },

    detached() {
      this.deactivate();
      this.alive = false;
      if (this.unsubscribeLink) this.unsubscribeLink();
      this.unsubscribeLink = null;
    }
  },

  pageLifetimes: {
    // Settings pages (Bluetooth, permissions) hide the page; search again on
    // return so a fixed problem shows printers without another tap.
    hide() {
      if (!this.active) return;
      this.resumeOnShow = true;
      this.stopScanning();
    },

    show() {
      if (!this.resumeOnShow) return;
      this.resumeOnShow = false;
      this.rescan();
    }
  },

  methods: {
    open() {
      if (this.active || !this.alive) return;
      this.active = true;
      const session = services().session;
      let notice = '';
      if (isDesktopWeChat(wx)) notice = DESKTOP_MESSAGE;
      else if (!session || typeof session.scan !== 'function') notice = UNAVAILABLE_MESSAGE;
      this.setData({ notice, androidHint: platformName(wx) === 'android' });
      if (notice) return;
      this.syncLink();
      // A connection started before the sheet was closed is still running;
      // keep its row and loading state instead of starting a competing scan.
      if (!this.connecting) this.startScan();
    },

    deactivate() {
      if (!this.active) return;
      this.active = false;
      this.resumeOnShow = false;
      this.stopScanning();
    },

    startScan() {
      const { session, printer } = services();
      if (!session) return;
      const generation = ++this.scanGeneration;
      this.clearScanTimer();
      this.devices = new Map();
      // Discovery competes with the print data for the radio.
      if (printer && (printer.printing || printer.jobPhase === 'printing')) {
        this.setData({ scanning: false, scanEnded: true, scanHint: PRINTING_MESSAGE, devices: [] });
        return;
      }
      this.setData({ scanning: true, scanEnded: false, scanHint: '', devices: [] });
      // Discovery drains the battery and never ends on its own.
      this.scanTimer = setTimeout(() => this.finishScan(generation), SCAN_WINDOW_MS);
      let scanning;
      try {
        scanning = session.scan((devices) => this.receiveDevices(generation, devices));
      } catch (error) {
        scanning = Promise.reject(error);
      }
      Promise.resolve(scanning).catch((error) => {
        if (!this.alive || !this.active || generation !== this.scanGeneration) return;
        this.clearScanTimer();
        this.scanGeneration += 1;
        const described = showBleError(wx, error, { title: '无法搜索打印机', retry: () => this.rescan() });
        this.setData({ scanning: false, scanEnded: true, scanHint: described.message });
      });
    },

    receiveDevices(generation, devices) {
      if (!this.alive || !this.active || generation !== this.scanGeneration) return;
      const sorted = sortDevices(devices);
      this.devices = new Map(sorted.map((device) => [device.deviceId, device]));
      this.setData({ devices: sorted.map(toItem) });
    },

    finishScan(generation) {
      this.scanTimer = null;
      if (!this.alive || !this.active || generation !== this.scanGeneration) return;
      this.stopScanning();
    },

    stopScanning() {
      this.scanGeneration += 1;
      this.clearScanTimer();
      if (!this.data.scanning) return;
      const session = services().session;
      if (session && typeof session.stopScan === 'function') {
        try {
          Promise.resolve(session.stopScan()).catch(() => undefined);
        } catch (error) {
          // Stopping is best-effort; the next scan restarts discovery anyway.
        }
      }
      if (this.alive) this.setData({ scanning: false, scanEnded: true });
    },

    clearScanTimer() {
      if (this.scanTimer) clearTimeout(this.scanTimer);
      this.scanTimer = null;
    },

    rescan() {
      if (!this.alive || !this.active || this.connecting || this.data.notice) return;
      this.startScan();
    },

    onClose() {
      this.stopScanning();
      this.triggerEvent('close');
    },

    connectDevice(event) {
      const dataset = event && event.currentTarget && event.currentTarget.dataset || {};
      const device = this.devices.get(dataset.id);
      if (!device) return Promise.resolve();
      return this.connectTo(device);
    },

    async connectTo(device) {
      if (this.connecting || !this.alive) return;
      const { manager, printer } = services();
      if (!manager && !printer) {
        showNotice('暂时连不上', UNAVAILABLE_MESSAGE);
        return;
      }
      this.connecting = true;
      this.stopScanning();
      this.setData({ connectingId: device.deviceId });
      try {
        const result = await this.requestConnection(device, manager, printer);
        if (!this.alive) return;
        this.setData({ connectingId: '' });
        this.triggerEvent('connected', { result, device: Object.assign({}, device) });
      } catch (error) {
        if (!this.alive) return;
        this.setData({ connectingId: '' });
        // The user closed the sheet meanwhile; the page shows "未连接" anyway.
        if (this.active) showBleError(wx, error, { title: '连接失败', retry: () => this.connectTo(device) });
      } finally {
        this.connecting = false;
      }
    },

    async requestConnection(device, manager, printer) {
      if (!manager) return printer.connect(device);
      try {
        return await manager.ensureReady(device, { forceFresh: true });
      } catch (error) {
        // With stable reconnect switched off the plain client still connects.
        if (error && error.code === 'BLE_RECONNECT_OFF' && printer) return printer.connect(device);
        throw error;
      }
    },

    subscribeLink() {
      const manager = services().manager;
      if (this.unsubscribeLink || !manager || typeof manager.subscribe !== 'function') return;
      this.unsubscribeLink = manager.subscribe((state) => this.applyLinkState(state));
      this.syncLink();
    },

    syncLink() {
      const manager = services().manager;
      if (manager && typeof manager.getState === 'function') this.applyLinkState(manager.getState());
    },

    applyLinkState(state) {
      if (!this.alive) return;
      const next = linkView(state);
      if (next.linkStatus === this.data.linkStatus && next.linkName === this.data.linkName
        && next.linkPaper === this.data.linkPaper && next.linkBackground === this.data.linkBackground) return;
      this.setData(next);
    },

    async disconnectPrinter() {
      const manager = services().manager;
      if (!manager || this.data.busy) return;
      this.setData({ busy: true });
      try {
        await manager.disconnect();
      } catch (error) {
        // The state listener shows whatever link is left.
      } finally {
        if (this.alive) this.setData({ busy: false });
      }
    },

    // Forgetting drops the remembered printer, and getting it back means
    // searching for it again, so it asks first.
    async forgetPrinter() {
      const manager = services().manager;
      if (!manager || this.data.busy) return;
      const confirmed = await confirmModal({
        title: '忘记打印机',
        content: '忘记后要重新搜索才能连接，确定吗？',
        confirmText: '忘记',
        confirmColor: BRAND_RED
      });
      if (!confirmed || !this.alive || this.data.busy) return;
      this.setData({ busy: true });
      try {
        await manager.forget();
        wx.showToast({ title: '已忘记打印机', icon: 'success' });
      } catch (error) {
        // Forgetting is local; a failed disconnect still clears the binding.
      } finally {
        if (this.alive) this.setData({ busy: false });
      }
    },

    async checkConnection() {
      if (this.data.checking || this.connecting) return;
      const manager = services().manager;
      if (!manager || typeof manager.diagnose !== 'function') {
        showNotice('检查连接', UNAVAILABLE_MESSAGE);
        return;
      }
      const saved = typeof manager.getSavedDevice === 'function' ? manager.getSavedDevice() : null;
      if (!saved) {
        showNotice('检查连接', '还没有连接过打印机。请先在列表里点一下你的打印机。');
        return;
      }
      this.setData({ checking: true });
      if (typeof wx.showLoading === 'function') wx.showLoading({ title: '正在检查', mask: true });
      let report;
      try {
        report = await manager.diagnose();
      } catch (error) {
        report = { error: error && error.message || '检查失败', errorCode: error && error.code != null ? String(error.code) : '' };
      } finally {
        if (typeof wx.hideLoading === 'function') wx.hideLoading();
        if (this.alive) this.setData({ checking: false });
      }
      if (!this.alive) return;
      if (!report || !report.error) {
        wx.showModal({ title: '检查连接', content: '连接正常，可以打印', showCancel: false, confirmText: '好的', confirmColor: BRAND_RED });
        return;
      }
      const reselect = report.errorCode === 'BLE_RECONNECT_OFF';
      showBleError(wx, { message: report.error, code: report.errorCode }, {
        title: '连接有问题',
        retry: reselect ? () => this.rescan() : () => this.checkConnection()
      });
    }
  }
});
