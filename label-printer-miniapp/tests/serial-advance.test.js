const test = require('node:test');
const assert = require('node:assert/strict');
const { createDocument, createElement } = require('../miniprogram/core/document');
const { serialValue } = require('../miniprogram/core/renderer');
const { PrintJobService } = require('../miniprogram/services/print-job-service');
const {
  applySerialAdvance,
  hasSerialElements,
  serialAdvancePlan,
  serialNumberAt
} = require('../miniprogram/core/serial-advance');

function serialLabel(fields) {
  const document = createDocument(40, 12);
  const serial = Object.assign(createElement('serial', document), { id: 'sn' }, fields);
  document.elements = [serial];
  return document;
}

test('documents without serial numbers, or with nothing printed, have no plan', () => {
  const plain = createDocument(40, 12);
  assert.equal(hasSerialElements(plain), false);
  assert.equal(serialAdvancePlan(plain, 5), null);
  assert.equal(serialAdvancePlan({}, 5), null);
  const document = serialLabel({ start: 1 });
  assert.equal(hasSerialElements(document), true);
  assert.equal(serialAdvancePlan(document, 0), null);
  assert.equal(serialAdvancePlan(document, -3), null);
  assert.equal(serialAdvancePlan(document, 'abc'), null);
});

test('the plan continues after the last printed label with renderer formatting', () => {
  const document = serialLabel({ start: 10, step: 2, digits: 4, prefix: 'A-', suffix: '#' });
  assert.deepEqual(serialAdvancePlan(document, 3), {
    lastText: 'A-0014#',
    nextText: 'A-0016#',
    patches: [{ id: 'sn', start: 16 }]
  });
});

test('step defaults to one, zero repeats and negative steps count down', () => {
  assert.equal(serialAdvancePlan(serialLabel({ start: 5, step: undefined, digits: 1 }), 4).nextText, '9');
  assert.equal(serialAdvancePlan(serialLabel({ start: 5, step: 'abc', digits: 1 }), 4).nextText, '9');
  const repeated = serialAdvancePlan(serialLabel({ start: 5, step: 0, digits: 2 }), 4);
  assert.equal(repeated.lastText, '05');
  assert.equal(repeated.nextText, '05');
  assert.deepEqual(repeated.patches, [{ id: 'sn', start: 5 }]);
  const countdown = serialAdvancePlan(serialLabel({ start: 100, step: -10, digits: 3 }), 3);
  assert.equal(countdown.lastText, '080');
  assert.equal(countdown.nextText, '070');
  assert.equal(serialNumberAt({ start: '7', step: '3' }, 2), 13);
});

test('every serial element advances by its own step while texts follow the first', () => {
  const document = serialLabel({ start: 1, step: 1, digits: 3 });
  document.elements.push(Object.assign(createElement('serial', document), { id: 'box', start: 50, step: 5, digits: 2 }));
  const plan = serialAdvancePlan(document, 10);
  assert.equal(plan.lastText, '010');
  assert.equal(plan.nextText, '011');
  assert.deepEqual(plan.patches, [{ id: 'sn', start: 11 }, { id: 'box', start: 100 }]);
});

test('applying a plan returns a patched copy and keeps linked codes on the new first number', () => {
  const document = serialLabel({ start: 1, step: 1, digits: 4, currentValue: 3 });
  const linked = Object.assign(createElement('barcode', document), { id: 'code', value: '0001', serialLinked: true });
  document.elements.push(linked);
  const plan = serialAdvancePlan(document, 20);
  const next = applySerialAdvance(document, plan);
  assert.notEqual(next, document);
  assert.equal(next.elements[0].start, 21);
  assert.equal(next.elements[0].currentValue, null, 'the editor preview must show the new start');
  assert.equal(serialValue(next.elements[0]), '0021');
  assert.equal(next.elements[1].value, '0021');
  assert.equal(document.elements[0].start, 1, 'the original document is untouched');
  assert.equal(document.elements[0].currentValue, 3);
  assert.equal(document.elements[1].value, '0001');
  assert.deepEqual(applySerialAdvance(document, null), document);
  assert.notEqual(applySerialAdvance(document, null), document);
});

test('the next job starts right after the last label the print service produced', async () => {
  const printer = {
    async print(image, profile, options, progress) { progress(100, '打印完成'); },
    async cancel() {}
  };
  const service = new PrintJobService({ printer });
  const printed = [];
  const run = (document, copies) => service.run({
    document,
    profile: { id: 'd110', dpi: 203 },
    options: { copies },
    render(page) {
      printed.push(serialValue(page.elements.find((element) => element.type === 'serial')));
      return page;
    }
  });
  const document = serialLabel({ start: 7, step: 5, digits: 3, prefix: 'SN' });
  const first = await run(document, 3);
  assert.deepEqual(printed, ['SN007', 'SN012', 'SN017']);
  const plan = serialAdvancePlan(document, first.completedCopies);
  assert.equal(plan.lastText, printed[printed.length - 1]);
  printed.length = 0;
  await run(applySerialAdvance(document, plan), 2);
  assert.deepEqual(printed, [plan.nextText, 'SN027']);
});
