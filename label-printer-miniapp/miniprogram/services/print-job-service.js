const { cloneDocument } = require('../core/document');
const { normalizeCopies } = require('../core/escpos');
const { hasSerialElements, serialNumberAt } = require('../core/serial-advance');

function jobError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function cancellationError() {
  return jobError('打印已取消', 'PRINT_CANCELLED');
}

// UI callbacks cannot change what the printer already did, so neither a
// thrown error nor a rejected promise from them may fail the job.
function notify(callback, args) {
  if (typeof callback !== 'function') return;
  try {
    const returned = callback(...args);
    if (returned && typeof returned.catch === 'function') returned.catch(() => {});
  } catch (error) { /* UI cannot change the physical print result. */ }
}

// Snapshot of a batch; null for the single-document form.
function snapshotDocuments(documents) {
  if (!Array.isArray(documents)) return null;
  if (!documents.length) throw jobError('没有可打印的标签', 'PRINT_NOTHING');
  return documents.map((document, index) => {
    if (!document || !Array.isArray(document.elements)) {
      throw jobError(`第 ${index + 1} 个标签数据损坏，未开始打印`, 'PRINT_DOCUMENT_INVALID');
    }
    return cloneDocument(document);
  });
}

// A serial document prints one label per page so every label gets its own
// number; any other document prints all its copies in one transaction.
function pagesFor(document, copies) {
  return hasSerialElements(document) ? copies : 1;
}

function jobDocuments(job) {
  return job.documents || [job.document];
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

  // A cancelled job stays silent: the page has already moved on.
  report(job, callback, args) {
    if (!job.cancelled) notify(callback, args);
  }

  result(job) {
    const documents = jobDocuments(job);
    return {
      document: cloneDocument(job.document),
      profile: Object.assign({}, job.profile),
      options: Object.assign({}, job.options),
      totalCopies: job.options.copies * documents.length,
      completedCopies: job.completedCopies,
      totalPages: job.totalPages,
      completedPages: job.completedPages,
      totalDocuments: documents.length,
      completedDocuments: job.completedDocuments,
      possiblyPrinted: job.possiblyPrinted
    };
  }

  /**
   * Prints `config.document`, or, when `config.documents` is an array, each
   * of those documents in order (for example one per data row), every one
   * `options.copies` times. Each page is one print transaction; a failure
   * stops the job and is never replayed. `prepare(job)` sees the snapshot as
   * job.document (the first document) and job.documents (batch only).
   * `onProgress(percent, message)` spans all pages; `onPage(index, total,
   * { documentIndex, totalDocuments })` runs before each page (0-based).
   * Resolves to, or attaches as error.printJob, { document, profile, options,
   * totalCopies, completedCopies (labels), totalPages, completedPages,
   * totalDocuments, completedDocuments, possiblyPrinted }.
   */
  async run(config) {
    if (this.active || this.printer.printing || this.printer.jobToken) {
      throw jobError('已有打印任务正在进行', 'PRINT_IN_PROGRESS');
    }
    const documents = snapshotDocuments(config.documents);
    const job = {
      document: documents ? documents[0] : cloneDocument(config.document),
      documents,
      profile: Object.assign({}, config.profile),
      options: Object.assign({}, config.options || {}, { copies: normalizeCopies(config.options && config.options.copies) }),
      completedCopies: 0,
      completedPages: 0,
      completedDocuments: 0,
      totalPages: 0,
      possiblyPrinted: false,
      cancelled: false
    };
    if (!documents && (!job.document || !Array.isArray(job.document.elements))) {
      throw jobError('标签数据损坏，未开始打印', 'PRINT_DOCUMENT_INVALID');
    }
    job.totalPages = jobDocuments(job).reduce((sum, document) => sum + pagesFor(document, job.options.copies), 0);
    this.active = job;
    this.printer.jobToken = job;
    this.printer.jobPhase = 'preparing';
    try {
      if (config.prepare) {
        const prepared = await config.prepare(job, { assertActive: () => this.assertActive(job) });
        this.assertActive(job);
        if (prepared && prepared.profile) job.profile = Object.assign({}, prepared.profile);
      }
      this.assertActive(job);
      this.printer.jobPhase = 'printing';
      const queue = jobDocuments(job);
      let page = 0;
      for (let documentIndex = 0; documentIndex < queue.length; documentIndex += 1) {
        page = await this.printDocument(job, config, queue[documentIndex], {
          documentIndex, totalDocuments: queue.length, firstPage: page
        });
      }
      this.report(job, config.onProgress, [100, '打印完成']);
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

  // Where each serial number of `source` starts in this job. A batch row
  // that keeps the design's numbering carries on from the rows before it
  // (A001, A002 | A003, A004 …); a row with a start of its own, such as one
  // taken from its code, starts at that number.
  serialBases(job, source) {
    const runs = job.serialRuns || (job.serialRuns = {});
    const bases = {};
    source.elements.filter((element) => element && element.type === 'serial').forEach((element) => {
      const run = runs[element.id];
      const continues = run && run.start === Number(element.start) && run.step === Number(element.step);
      bases[element.id] = continues ? run.next : 0;
    });
    return bases;
  }

  // Prints every page of one document; returns the next page number.
  async printDocument(job, config, source, position) {
    const hasSerial = hasSerialElements(source);
    const pageCount = pagesFor(source, job.options.copies);
    const copies = hasSerial ? 1 : job.options.copies;
    const serialBases = hasSerial ? this.serialBases(job, source) : null;
    for (let index = 0; index < pageCount; index += 1) {
      const page = position.firstPage + index;
      this.assertActive(job);
      this.report(job, config.onPage, [page, job.totalPages, {
        documentIndex: position.documentIndex,
        totalDocuments: position.totalDocuments
      }]);
      const document = cloneDocument(source);
      if (hasSerial) {
        document.elements.filter((element) => element && element.type === 'serial').forEach((element) => {
          element.currentValue = serialNumberAt(element, (serialBases[element.id] || 0) + index);
          job.serialRuns[element.id] = {
            start: Number(element.start),
            step: Number(element.step),
            next: (serialBases[element.id] || 0) + index + 1
          };
        });
      }
      const imageData = await config.render(document, job.profile);
      this.assertActive(job);
      try {
        await this.printer.print(imageData, job.profile, Object.assign({}, job.options, {
          copies,
          jobToken: job
        }), (value, message) => {
          this.report(job, config.onProgress, [Math.min(99, Math.round((page * 100 + value) / job.totalPages)), message]);
        });
      } catch (error) {
        // Missing completion acknowledgement cannot prove that no paper moved.
        job.possiblyPrinted = job.possiblyPrinted || error.possiblyPrinted !== false;
        throw error;
      }
      job.completedCopies += copies;
      job.completedPages += 1;
      if (index === pageCount - 1) job.completedDocuments += 1;
      job.possiblyPrinted = true;
      this.assertActive(job);
    }
    return position.firstPage + pageCount;
  }

  async cancel() {
    const job = this.active;
    if (!job) return;
    job.cancelled = true;
    await this.printer.cancel();
  }
}

module.exports = { PrintJobService };
