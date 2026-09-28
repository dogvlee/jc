const { cloneDocument } = require('../core/document');
const { normalizeCopies } = require('../core/print-plan');

function cancellationError() {
  const error = new Error('打印已取消');
  error.code = 'PRINT_CANCELLED';
  return error;
}

// Owns one user action, including preparation and every serial-number page.
// PrinterClient owns one protocol transaction; it never replays failed rows.
class PrintJobService {
  constructor(options) {
    this.printer = options.printer;
    this.active = null;
  }

  get running() {
    return Boolean(this.active);
  }

  assertActive(job) {
    if (this.active !== job || job.cancelled) throw cancellationError();
  }

  result(job) {
    return {
      document: cloneDocument(job.document),
      profile: Object.assign({}, job.profile),
      options: Object.assign({}, job.options),
      totalCopies: job.options.copies,
      completedCopies: job.completedCopies,
      possiblyPrinted: job.possiblyPrinted
    };
  }

  async run(config) {
    if (this.active || this.printer.printing || this.printer.jobToken) {
      const error = new Error('已有打印任务正在进行');
      error.code = 'PRINT_IN_PROGRESS';
      throw error;
    }
    const job = {
      document: cloneDocument(config.document),
      profile: Object.assign({}, config.profile),
      options: Object.assign({}, config.options || {}, { copies: normalizeCopies(config.options && config.options.copies) }),
      completedCopies: 0,
      possiblyPrinted: false,
      cancelled: false
    };
    this.active = job;
    this.printer.jobToken = job;
    this.printer.jobPhase = 'preparing';
    const progress = (value, message) => {
      if (typeof config.onProgress !== 'function' || job.cancelled) return;
      try { config.onProgress(value, message); } catch (error) { /* UI cannot change the physical print result. */ }
    };
    try {
      if (config.prepare) {
        const prepared = await config.prepare(job, { assertActive: () => this.assertActive(job) });
        this.assertActive(job);
        if (prepared && prepared.profile) job.profile = Object.assign({}, prepared.profile);
      }
      this.assertActive(job);
      this.printer.jobPhase = 'printing';
      const hasSerial = job.document.elements.some((element) => element.type === 'serial');
      const pageCount = hasSerial ? job.options.copies : 1;
      for (let index = 0; index < pageCount; index += 1) {
        this.assertActive(job);
        const document = cloneDocument(job.document);
        if (hasSerial) {
          document.elements.filter((element) => element.type === 'serial').forEach((element) => {
            const step = Number(element.step);
            element.currentValue = (Number(element.start) || 0) + index * (Number.isFinite(step) ? step : 1);
          });
        }
        const imageData = await config.render(document, job.profile);
        this.assertActive(job);
        const copies = hasSerial ? 1 : job.options.copies;
        try {
          await this.printer.print(imageData, job.profile, Object.assign({}, job.options, {
            copies,
            jobToken: job
          }), (value, message) => {
            progress(Math.min(99, Math.round((index * 100 + value) / pageCount)), message);
          });
        } catch (error) {
          // Missing completion acknowledgement cannot prove that no paper moved.
          job.possiblyPrinted = job.possiblyPrinted || error.possiblyPrinted !== false;
          throw error;
        }
        job.completedCopies += copies;
        job.possiblyPrinted = true;
        this.assertActive(job);
      }
      progress(100, '打印完成');
      return this.result(job);
    } catch (error) {
      const failure = job.cancelled ? cancellationError() : error;
      failure.printJob = this.result(job);
      throw failure;
    } finally {
      if (this.active === job) this.active = null;
      if (this.printer.jobToken === job) {
        this.printer.jobToken = null;
        this.printer.jobPhase = '';
      }
    }
  }

  async cancel() {
    const job = this.active;
    if (!job) return;
    job.cancelled = true;
    await this.printer.cancel();
  }
}

module.exports = { PrintJobService };
