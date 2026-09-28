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
