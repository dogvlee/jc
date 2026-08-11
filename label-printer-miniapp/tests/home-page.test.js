const test = require('node:test');
const assert = require('node:assert/strict');

let pageDefinition = null;
global.Page = (definition) => { pageDefinition = definition; };
require('../miniprogram/pages/home/index');
delete global.Page;

test('home scan-to-label is single-flight and opens one generated document', async () => {
  let scanCalls = 0;
  let finishScan;
  let openedDocument = null;
  global.wx = {
    scanCode(options) {
      scanCalls += 1;
      finishScan = () => options.success({ result: '6901234567892', scanType: 'EAN_13' });
    },
    showModal() {}
  };
  const page = Object.assign({}, pageDefinition, {
    data: { codeScanning: false },
    repository: { getSettings: () => ({ stockWidthMm: 40, stockHeightMm: 30 }) },
    setData(patch) { Object.assign(this.data, patch); },
    openEditor(document) { openedDocument = document; }
  });

  const first = page.scanToLabel();
  const second = page.scanToLabel();
  assert.equal(scanCalls, 1);
  assert.equal(page.data.codeScanning, true);
  finishScan();
  await Promise.all([first, second]);
  assert.equal(page.data.codeScanning, false);
  assert.equal(openedDocument.elements[0].type, 'barcode');
  delete global.wx;
});
