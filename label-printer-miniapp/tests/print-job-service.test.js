const test = require('node:test');
const assert = require('node:assert/strict');
const { PrintJobService } = require('../miniprogram/services/print-job-service');

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function fixture() {
  const calls = [];
  const printer = {
    async print(image, profile, options, progress) {
      calls.push({ image, profile, options });
      progress(100, '打印完成');
    },
    async cancel() {}
  };
  const config = {
    document: { name: '原始标签', elements: [{ type: 'serial', start: 10, step: 2 }] },
    profile: { id: 'd110', dpi: 203 },
    options: { copies: 3, density: 2 },
    render(document) { return document; }
  };
  return { printer, calls, config, service: new PrintJobService({ printer }) };
}

test('one job snapshots user values before preparation and prints the original serial sequence', async () => {
  const { printer, calls, config, service } = fixture();
  const gate = deferred();
  config.prepare = async (snapshot) => {
    assert.equal(printer.jobPhase, 'preparing');
    await gate.promise;
    assert.equal(snapshot.document.name, '原始标签');
    return { profile: { id: 'b1', dpi: 203 } };
  };
  const progress = [];
  config.onProgress = (value) => progress.push(value);
  const task = service.run(config);
  config.document.name = '修改后的标签';
  config.document.elements[0].start = 500;
  config.options.copies = 9;
  config.profile.id = 'b21';
  gate.resolve();
  const result = await task;
  assert.deepEqual(calls.map((call) => call.image.elements[0].currentValue), [10, 12, 14]);
  assert.deepEqual(calls.map((call) => call.options.copies), [1, 1, 1]);
  assert.equal(result.completedCopies, 3);
  assert.equal(result.totalCopies, 3);
  assert.equal(result.document.name, '原始标签');
  assert.equal(result.profile.id, 'b1');
  assert.equal(progress.filter((value) => value === 100).length, 1);
  assert.equal(printer.jobToken, null);
  assert.equal(printer.jobPhase, '');
});

test('the job lock covers preparation and other services sharing the same printer', async () => {
  const { printer, config, service } = fixture();
  const gate = deferred();
  config.prepare = () => gate.promise;
  const task = service.run(config);
  const other = new PrintJobService({ printer });
  await assert.rejects(service.run(config), { code: 'PRINT_IN_PROGRESS' });
  await assert.rejects(other.run(config), { code: 'PRINT_IN_PROGRESS' });
  gate.resolve();
  await task;
});

test('cancellation while preparing never renders or sends a print', async () => {
  const { calls, config, service } = fixture();
  const gate = deferred();
  config.prepare = () => gate.promise;
  config.render = () => { throw new Error('render must not run'); };
  const task = service.run(config);
  await service.cancel();
  gate.resolve();
  await assert.rejects(task, (error) => {
    assert.equal(error.code, 'PRINT_CANCELLED');
    assert.equal(error.printJob.completedCopies, 0);
    assert.equal(error.printJob.possiblyPrinted, false);
    return true;
  });
  assert.equal(calls.length, 0);
  assert.equal(service.running, false);
});

test('failure in the second serial page reports the first confirmed copy and never replays it', async () => {
  const { printer, config, service } = fixture();
  let sent = 0;
  printer.print = async () => {
    sent += 1;
    if (sent === 2) throw new Error('打印机缺纸');
  };
  await assert.rejects(service.run(config), (error) => {
    assert.equal(error.message, '打印机缺纸');
    assert.equal(error.printJob.completedCopies, 1);
    assert.equal(error.printJob.totalCopies, 3);
    assert.equal(error.printJob.possiblyPrinted, true);
    return true;
  });
  assert.equal(sent, 2);
});

test('the connection lock stays held during asynchronous rendering between serial pages', async () => {
  const { printer, config, service } = fixture();
  const secondRender = deferred();
  const gate = deferred();
  let rendered = 0;
  config.render = async (document) => {
    rendered += 1;
    if (rendered === 2) {
      secondRender.resolve();
      await gate.promise;
    }
    return document;
  };
  const task = service.run(config);
  await secondRender.promise;
  assert.equal(printer.jobPhase, 'printing');
  assert.ok(printer.jobToken);
  await service.cancel();
  gate.resolve();
  await assert.rejects(task, (error) => error.code === 'PRINT_CANCELLED' && error.printJob.completedCopies === 1);
});

test('normal labels send one transaction and normalize the copy count once', async () => {
  const { calls, config, service } = fixture();
  config.document.elements = [];
  config.options.copies = 120;
  const result = await service.run(config);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.copies, 99);
  assert.equal(result.completedCopies, 99);
  assert.equal(result.totalCopies, 99);
});

test('UI callback failures do not turn a confirmed physical print into failure', async () => {
  const { config, service } = fixture();
  config.onProgress = () => { throw new Error('page unloaded'); };
  const result = await service.run(config);
  assert.equal(result.completedCopies, 3);
});

test('zero serial step is preserved for repeated serial values', async () => {
  const { calls, config, service } = fixture();
  config.document.elements[0].step = 0;
  await service.run(config);
  assert.deepEqual(calls.map((call) => call.image.elements[0].currentValue), [10, 10, 10]);
});

function batchDocuments() {
  return [
    { name: '甲', elements: [{ type: 'text', text: '甲' }] },
    { name: '乙', elements: [{ type: 'serial', start: 5, step: 1 }] },
    { name: '丙', elements: [] }
  ];
}

test('single documents also report their pages and document', async () => {
  const { config, service } = fixture();
  const pages = [];
  config.onPage = (index, total) => pages.push([index, total]);
  const serial = await service.run(config);
  assert.deepEqual(pages, [[0, 3], [1, 3], [2, 3]]);
  assert.equal(serial.totalPages, 3);
  assert.equal(serial.completedPages, 3);
  assert.equal(serial.totalDocuments, 1);
  assert.equal(serial.completedDocuments, 1);
  config.document.elements = [];
  config.options.copies = 5;
  const plain = await service.run(config);
  assert.equal(plain.totalPages, 1);
  assert.equal(plain.completedPages, 1);
  assert.equal(plain.completedCopies, 5);
});

test('a batch prints every document in order with its own copies and serial pages', async () => {
  const { calls, config, service } = fixture();
  delete config.document;
  config.documents = batchDocuments();
  config.options.copies = 2;
  const pages = [];
  const progress = [];
  config.onPage = (index, total, info) => pages.push([index, total, info.documentIndex, info.totalDocuments]);
  config.onProgress = (value) => progress.push(value);
  const result = await service.run(config);
  assert.deepEqual(calls.map((call) => call.image.name), ['甲', '乙', '乙', '丙']);
  assert.deepEqual(calls.map((call) => call.options.copies), [2, 1, 1, 2]);
  assert.deepEqual(calls.slice(1, 3).map((call) => call.image.elements[0].currentValue), [5, 6]);
  assert.deepEqual(pages, [[0, 4, 0, 3], [1, 4, 1, 3], [2, 4, 1, 3], [3, 4, 2, 3]]);
  assert.deepEqual(progress, [25, 50, 75, 99, 100]);
  assert.equal(result.document.name, '甲');
  assert.equal(result.totalCopies, 6);
  assert.equal(result.completedCopies, 6);
  assert.equal(result.totalPages, 4);
  assert.equal(result.completedPages, 4);
  assert.equal(result.totalDocuments, 3);
  assert.equal(result.completedDocuments, 3);
  assert.equal(result.options.copies, 2);
});

test('a batch snapshots every document before preparation', async () => {
  const { calls, config, service } = fixture();
  const gate = deferred();
  config.documents = [{ name: '甲', elements: [] }, { name: '乙', elements: [] }];
  config.prepare = async (snapshot) => {
    await gate.promise;
    assert.deepEqual(snapshot.documents.map((document) => document.name), ['甲', '乙']);
    assert.equal(snapshot.document.name, '甲');
  };
  const task = service.run(config);
  config.documents[1].name = '被改掉';
  config.documents.push({ name: '新增', elements: [] });
  gate.resolve();
  const result = await task;
  assert.deepEqual(calls.map((call) => call.image.name), ['甲', '乙']);
  assert.equal(result.totalDocuments, 2);
});

test('a batch failure reports confirmed pages and never continues or replays', async () => {
  const { printer, config, service } = fixture();
  config.documents = batchDocuments();
  config.options.copies = 2;
  const sent = [];
  printer.print = async (image) => {
    sent.push(image.name);
    if (sent.length === 3) throw new Error('打印机缺纸');
  };
  await assert.rejects(service.run(config), (error) => {
    assert.equal(error.message, '打印机缺纸');
    assert.equal(error.printJob.completedPages, 2);
    assert.equal(error.printJob.totalPages, 4);
    assert.equal(error.printJob.completedCopies, 3);
    assert.equal(error.printJob.totalCopies, 6);
    assert.equal(error.printJob.completedDocuments, 1);
    assert.equal(error.printJob.totalDocuments, 3);
    assert.equal(error.printJob.possiblyPrinted, true);
    return true;
  });
  assert.deepEqual(sent, ['甲', '乙', '乙']);
  assert.equal(service.running, false);
});

test('cancelling a batch stops before the next document is sent', async () => {
  const { printer, config, service } = fixture();
  config.documents = batchDocuments().map((document) => Object.assign(document, { elements: [] }));
  let sent = 0;
  printer.print = async () => {
    sent += 1;
    if (sent === 2) await service.cancel();
  };
  await assert.rejects(service.run(config), (error) => {
    assert.equal(error.code, 'PRINT_CANCELLED');
    assert.equal(error.printJob.completedPages, 2);
    assert.equal(error.printJob.completedDocuments, 2);
    return true;
  });
  assert.equal(sent, 2);
});

test('an empty or broken batch is refused before the printer is locked', async () => {
  const { printer, calls, config, service } = fixture();
  config.documents = [];
  await assert.rejects(service.run(config), { code: 'PRINT_NOTHING' });
  config.documents = [{ name: '甲', elements: [] }, null];
  await assert.rejects(service.run(config), (error) => {
    assert.equal(error.code, 'PRINT_DOCUMENT_INVALID');
    assert.match(error.message, /第 2 个/);
    return true;
  });
  assert.equal(calls.length, 0);
  assert.ok(!printer.jobToken);
  assert.equal(service.running, false);
});

test('page callbacks cannot fail a batch, even asynchronously', async () => {
  const { config, service } = fixture();
  config.documents = [{ name: '甲', elements: [] }, { name: '乙', elements: [] }];
  let pages = 0;
  config.onPage = () => {
    pages += 1;
    if (pages === 1) throw new Error('page unloaded');
    return Promise.reject(new Error('late failure'));
  };
  config.onProgress = () => Promise.reject(new Error('late failure'));
  const result = await service.run(config);
  assert.equal(pages, 2);
  assert.equal(result.completedPages, 2);
});

test('batch rows that share the design serial number keep counting across rows', async () => {
  const { calls, config, service } = fixture();
  delete config.document;
  config.options.copies = 2;
  const row = (name) => ({ name, elements: [{ id: 'no', type: 'serial', start: 1, step: 1 }] });
  config.documents = [row('苹果'), row('香蕉'), row('橙子')];
  await service.run(config);
  assert.deepEqual(calls.map((call) => call.image.elements[0].currentValue), [1, 2, 3, 4, 5, 6]);
});

test('a batch row whose serial starts from its own code keeps that start', async () => {
  const { calls, config, service } = fixture();
  delete config.document;
  config.options.copies = 2;
  config.documents = [
    { name: 'A', elements: [{ id: 'no', type: 'serial', start: 100, step: 1 }] },
    { name: 'B', elements: [{ id: 'no', type: 'serial', start: 200, step: 1 }] }
  ];
  await service.run(config);
  assert.deepEqual(calls.map((call) => call.image.elements[0].currentValue), [100, 101, 200, 201]);
});
