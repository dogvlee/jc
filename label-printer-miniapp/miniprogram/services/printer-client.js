const { sleep } = require('../core/bytes');
const {
  BAND_DELAY_MS,
  FEED_DELAY_MS,
  INIT,
  labelEnd,
  normalizeCopies,
  rasterBands,
  rasterize
} = require('../core/escpos');

// Talks ESC/POS to a thermal printer over a BleSession (core/escpos.js).
// Connecting only opens the Bluetooth link: nothing is sent until a label is
// printed. Such printers send no completion answer, so a copy counts as
// printed once its bands and the feed after it are written.
class PrinterClient {
  constructor(session) {
    this.session = session;
    this.printing = false;
    this.cancelled = false;
    this.connecting = false;
    this.ready = false;
    this.deviceId = '';
    this.session.onConnectionStateChange(() => {
      this.invalidateConnection();
    });
    if (this.session.onTransportReset) {
      this.session.onTransportReset(() => this.invalidateConnection());
    }
    this.wait = sleep;
    this.connectionRevision = 0;
    this.activePrint = null;
  }

  invalidateConnection() {
    this.connectionRevision += 1;
    this.ready = false;
    this.deviceId = '';
  }

  async connect(device, options) {
    if (this.printing || this.jobPhase === 'printing') {
      throw new Error('打印任务进行中，暂不能连接或重连');
    }
    if (this.connecting) {
      throw new Error('打印机正在连接');
    }
    this.connecting = true;
    this.invalidateConnection();
    try {
      const useExisting = options && options.existing;
      if (useExisting && !this.session.connectExisting) {
        throw new Error('当前蓝牙会话不支持恢复现有连接');
      }
      const connection = useExisting
        ? await this.session.connectExisting(device)
        : await this.session.connect(device);
      this.ready = true;
      this.deviceId = connection.deviceId || device.deviceId;
      return Object.assign(connection, { protocol: 'escpos' });
    } catch (error) {
      await this.session.disconnect();
      throw error;
    } finally {
      this.connecting = false;
    }
  }

  async connectExisting(device) {
    return this.connect(device, { existing: true });
  }

  /**
   * Prints one label `options.copies` times: ESC @, then for every copy the
   * label as GS v 0 bands and the feed for `options.labelType` (GS FF to the
   * next label, or a tear feed on continuous paper). A cancel stops between
   * bands, never inside one, and still sends the feed for a label it cut
   * short, so the next print starts at the top of a label.
   */
  async print(imageData, profile, options, onProgress) {
    options = Object.assign({}, options || {}, { copies: normalizeCopies(options && options.copies) });
    if (!this.ready || this.connecting) {
      throw new Error('打印机还没有连接好');
    }
    if (this.printing || (this.jobToken && options.jobToken !== this.jobToken)) {
      throw new Error('已有打印任务正在进行');
    }
    this.printing = true;
    this.cancelled = false;
    const job = { revision: this.connectionRevision, started: false, labelOpen: false };
    this.activePrint = job;
    const progress = (value, message) => {
      if (typeof onProgress !== 'function') return;
      try { onProgress(value, message); } catch (error) { /* UI must not change the printer result. */ }
    };
    try {
      const raster = rasterize(imageData, {
        threshold: options.threshold,
        widthDots: profile && profile.printheadPixels
      });
      const bands = rasterBands(raster, this.session.maxWriteSize);
      const feed = labelEnd(options.labelType);
      const steps = bands.length * options.copies;
      let sent = 0;
      this.assertPrintActive(job);
      await this.session.writeRaw(INIT);
      for (let copy = 0; copy < options.copies; copy += 1) {
        for (let index = 0; index < bands.length; index += 1) {
          this.assertPrintActive(job);
          job.started = true;
          job.labelOpen = true;
          await this.session.writeRaw(bands[index]);
          sent += 1;
          progress(Math.round(sent / steps * 95), '正在发送标签数据');
          await this.wait(BAND_DELAY_MS);
        }
        await this.session.writeRaw(feed);
        job.labelOpen = false;
        await this.wait(FEED_DELAY_MS);
      }
      this.assertPrintActive(job);
      progress(100, '打印完成');
      return { rows: raster.height, columns: raster.width, bands: steps, completedCopies: options.copies };
    } catch (error) {
      error.possiblyPrinted = job.started;
      if (error.code === 'PRINT_CANCELLED' && job.labelOpen && this.session.connected) {
        try {
          await this.session.writeRaw(labelEnd(options.labelType));
        } catch (feedError) {
          // The cancel result stands; the paper can be fed with the printer's button.
        }
      }
      throw error;
    } finally {
      this.printing = false;
      this.cancelled = false;
      this.activePrint = null;
    }
  }

  assertPrintActive(job) {
    if (this.cancelled) {
      const error = new Error('打印已取消');
      error.code = 'PRINT_CANCELLED';
      throw error;
    }
    if (!this.session.connected || (job && job.revision !== this.connectionRevision)) {
      const error = new Error('打印机连接已变化，已停止当前任务');
      error.code = 'TRANSPORT_RESET';
      throw error;
    }
  }

  // ESC/POS has no cancel command: the print loop stops before its next band.
  async cancel() {
    if (!this.activePrint) return;
    this.cancelled = true;
  }
}

module.exports = { PrinterClient };
