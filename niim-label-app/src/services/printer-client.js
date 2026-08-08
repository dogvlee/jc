const { readU16be, sleep } = require('../core/bytes');
const { encodeImageData } = require('../core/image-encoder');
const { buildPrintPlan } = require('../core/print-plan');
const { COMMAND, RESPONSE } = require('../core/protocol');

class PrinterClient {
  constructor(session) {
    this.session = session;
    this.printing = false;
    this.cancelled = false;
    this.connecting = false;
    this.ready = false;
    this.protocolVersion = 0;
    this.latestPageIndex = 0;
    this.session.onPacket((packet) => {
      if (packet.command === RESPONSE.PAGE_INDEX && packet.data.length >= 2) {
        this.latestPageIndex = readU16be(packet.data, 0);
      }
    });
    this.session.onConnectionStateChange(() => {
      this.ready = false;
    });
  }

  async connect(device) {
    if (this.connecting) {
      throw new Error('打印机正在连接');
    }
    this.connecting = true;
    this.ready = false;
    try {
      const result = await this.negotiateConnection(device);
      this.ready = true;
      return result;
    } catch (error) {
      await this.session.disconnect();
      throw error;
    } finally {
      this.connecting = false;
    }
  }

  async negotiateConnection(device) {
    const connection = await this.session.connect(device);
    const response = await this.session.request(COMMAND.CONNECT, [1], RESPONSE.CONNECT, 2500);
    if (!response.data.length || [1, 2, 3].indexOf(response.data[0]) < 0) {
      throw new Error(`打印机协议协商失败（状态 ${response.data.length ? response.data[0] : '空'}）`);
    }
    const connectResult = response.data[0];
    let statusData = null;
    this.protocolVersion = connectResult === 2 ? 1 : 0;
    if (connectResult === 3) {
      const statusResponse = await this.session.request(
        COMMAND.PRINTER_STATUS_DATA,
        [1],
        RESPONSE.PRINTER_STATUS_DATA,
        2200
      );
      statusData = Array.from(statusResponse.data);
      this.protocolVersion = 3;
      if (statusResponse.data.length > 12) {
        const versionNumber = statusResponse.data[11] * 100 + statusResponse.data[12];
        this.protocolVersion = versionNumber >= 302
          ? 5
          : versionNumber === 300 || versionNumber === 301
            ? 4
            : versionNumber >= 204
              ? 3
              : 0;
      }
    }

    let modelId = null;
    const info = {};
    const infoRequests = [
      ['model', 8, RESPONSE.PRINTER_MODEL],
      ['serial', 11, 0x4b],
      ['bluetoothAddress', 13, 0x4d],
      ['battery', 10, 0x4a],
      ['autoShutdown', 7, 0x47],
      ['labelType', 3, 0x43],
      ['hardware', 12, RESPONSE.PRINTER_HARDWARE],
      ['software', 9, RESPONSE.PRINTER_SOFTWARE]
    ];
    for (let index = 0; index < infoRequests.length; index += 1) {
      const request = infoRequests[index];
      try {
        const packet = await this.session.request(COMMAND.PRINTER_INFO, [request[1]], request[2], 1500);
        info[request[0]] = Array.from(packet.data);
      } catch (error) {
        if (connectResult === 3) {
          throw error;
        }
        info[request[0]] = null;
      }
    }
    if (info.model && info.model.length) {
      modelId = info.model.length === 1 ? info.model[0] << 8 : readU16be(info.model, 0);
    }
    if (connectResult === 3) {
      await this.session.request(COMMAND.HEARTBEAT, [4], RESPONSE.HEARTBEAT, 2200);
    }
    return Object.assign(connection, {
      negotiation: Array.from(response.data),
      connectResult,
      protocolVersion: this.protocolVersion,
      statusData,
      modelId,
      info
    });
  }

  async print(imageData, profile, options, onProgress) {
    if (!this.ready || this.connecting) {
      throw new Error('打印机尚未完成协议协商');
    }
    if (this.printing) {
      throw new Error('已有打印任务正在进行');
    }
    this.printing = true;
    this.cancelled = false;
    this.latestPageIndex = 0;
    const progress = typeof onProgress === 'function' ? onProgress : () => {};
    try {
      if (profile.task === 'b1' && this.protocolVersion >= 3) {
        await this.session.request(COMMAND.HEARTBEAT, [4], RESPONSE.HEARTBEAT, 2200);
      }
      const encoded = encodeImageData(imageData, {
        direction: profile.printDirection,
        threshold: Number(options.threshold) || 180,
        checkEvery: profile.task === 'b21Legacy' ? 200 : 0
      });
      if (encoded.columns > profile.printheadPixels) {
        throw new Error(`位图宽度 ${encoded.columns}px 超过打印头 ${profile.printheadPixels}px`);
      }
      const plan = buildPrintPlan(encoded, profile, options);
      for (let index = 0; index < plan.length; index += 1) {
        if (this.cancelled) {
          throw new Error('打印已取消');
        }
        const item = plan[index];
        await this.session.request(item.command, item.data, item.oneWay ? null : item.expect, item.oneWay ? 1500 : 3500);
        progress(Math.round((index + 1) / (plan.length + 2) * 90), '正在发送标签数据');
      }
      await this.waitUntilFinished(profile, Number(options.copies) || 1, progress);
      progress(100, '打印完成');
      return { rows: encoded.rows, columns: encoded.columns, packets: plan.length };
    } catch (error) {
      try {
        await this.session.request(COMMAND.CANCEL_PRINT, [1], RESPONSE.CANCEL_PRINT, 1000);
      } catch (cancelError) {
        // Preserve the original failure.
      }
      throw error;
    } finally {
      this.printing = false;
      this.cancelled = false;
    }
  }

  async waitUntilFinished(profile, copies, progress) {
    if (profile.task === 'b21Legacy') {
      const deadline = Date.now() + Math.max(20000, copies * 15000);
      let attempt = 0;
      while (Date.now() < deadline) {
        if (this.cancelled) {
          throw new Error('打印已取消');
        }
        await sleep(350);
        const response = await this.session.request(COMMAND.PRINT_END, [1], RESPONSE.PRINT_END, 1600);
        if (response.data[0] === 1) {
          return;
        }
        attempt += 1;
        progress(92 + Math.min(6, Math.floor(attempt / 4)), '等待打印机走纸');
      }
      throw new Error('等待打印完成超时');
    }

    if (profile.task === 'd11Legacy') {
      let lastPage = this.latestPageIndex;
      let lastAdvanceAt = Date.now();
      const absoluteDeadline = Date.now() + Math.max(60000, copies * 20000);
      while (Date.now() < absoluteDeadline && Date.now() - lastAdvanceAt < 15000) {
        if (this.cancelled) {
          throw new Error('打印已取消');
        }
        if (this.latestPageIndex >= copies) {
          const response = await this.session.request(COMMAND.PRINT_END, [1], RESPONSE.PRINT_END, 2200);
          if (response.data.length && response.data[0] !== 1) {
            throw new Error('打印机尚未完成当前任务');
          }
          return;
        }
        if (this.latestPageIndex > lastPage) {
          lastPage = this.latestPageIndex;
          lastAdvanceAt = Date.now();
        }
        await sleep(150);
        progress(92 + Math.min(6, Math.floor(lastPage / Math.max(1, copies) * 6)), '等待打印机走纸');
      }
      throw new Error('等待旧版 D11 页完成通知超时');
    }

    let finished = false;
    let lastPage = -1;
    let lastAdvanceAt = Date.now();
    const absoluteDeadline = Date.now() + Math.max(60000, copies * 20000);
    while (Date.now() < absoluteDeadline && Date.now() - lastAdvanceAt < 15000) {
      if (this.cancelled) {
        throw new Error('打印已取消');
      }
      await sleep(300);
      try {
        const status = await this.session.request(COMMAND.PRINT_STATUS, [1], RESPONSE.PRINT_STATUS, 1600);
        const currentPage = status.data.length >= 2 ? readU16be(status.data, 0) : 0;
        if (currentPage > lastPage) {
          lastPage = currentPage;
          lastAdvanceAt = Date.now();
        }
        if (currentPage >= copies) {
          finished = true;
          break;
        }
        progress(92 + Math.min(6, Math.floor(currentPage / Math.max(1, copies) * 6)), '等待打印机走纸');
      } catch (error) {
        progress(92 + Math.min(6, Math.floor(Math.max(0, lastPage) / Math.max(1, copies) * 6)), '正在重试打印状态');
      }
    }
    if (!finished) {
      throw new Error('等待打印状态超时');
    }
    const response = await this.session.request(COMMAND.PRINT_END, [1], RESPONSE.PRINT_END, 2200);
    if (response.data.length && response.data[0] !== 1) {
      throw new Error('打印机尚未完成当前任务');
    }
  }

  async cancel() {
    this.cancelled = true;
    if (this.session.connected) {
      try {
        await this.session.request(COMMAND.CANCEL_PRINT, [1], RESPONSE.CANCEL_PRINT, 1200);
      } catch (error) {
        // Local cancellation still prevents more rows from being queued.
      }
    }
  }
}

module.exports = { PrinterClient };
