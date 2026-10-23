const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const {
  PAYLOAD_TYPE,
  PREFIX,
  decodePcTemplateCode,
  isPcTemplateCode
} = require('../miniprogram/core/pc-template-code');
const { isDataUrlImage, materializeDataUrlImages } = require('../miniprogram/services/data-url-images');

let pageDefinition = null;
global.Page = (definition) => { pageDefinition = definition; };
require('../miniprogram/pages/home/index');
delete global.Page;

const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function samplePayload() {
  return {
    type: PAYLOAD_TYPE,
    v: 1,
    name: '苹果价签',
    document: {
      schemaVersion: 2,
      name: '苹果价签',
      widthMm: 40,
      heightMm: 30,
      elements: [
        { id: 'text-1', type: 'text', x: 2, y: 2, width: 30, height: 6, text: '红富士苹果 ¥9.90/斤', fontSize: 4.5, bold: true },
        { id: 'barcode-1', type: 'barcode', x: 2, y: 16, width: 30, height: 10, value: '6901234567892', format: 'ean13' }
      ]
    }
  };
}

function encode(payload, options) {
  const bytes = zlib.deflateRawSync(Buffer.from(JSON.stringify(payload), 'utf8'));
  let text = bytes.toString('base64');
  if (options && options.url) text = text.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return PREFIX + text;
}

test('desktop template code round-trips with Chinese text', () => {
  const payload = samplePayload();
  const code = encode(payload);
  assert.equal(isPcTemplateCode(code), true);
  assert.equal(isPcTemplateCode(`  ${code}\n`), true);
  assert.deepEqual(decodePcTemplateCode(code), payload);
  assert.deepEqual(decodePcTemplateCode(encode(payload, { url: true })), payload);
});

test('ordinary scan results are not treated as template codes', () => {
  ['6901234567892', 'https://example.com', 'SYL', 'syl1:abc', '', null, undefined, 42].forEach((value) => {
    assert.equal(isPcTemplateCode(value), false);
  });
});

test('truncated, corrupt, foreign and future template codes fail with readable errors', () => {
  const code = encode(samplePayload());
  const broken = [
    code.slice(0, code.length - 12),
    `${PREFIX}not-base64-at-all`,
    `${PREFIX}`,
    PREFIX + Buffer.from('plain text, not deflate').toString('base64'),
    encode({ type: 'other', v: 1, document: {} }),
    encode({ type: PAYLOAD_TYPE, v: 1 }),
    encode([1, 2, 3]),
    PREFIX + 'A'.repeat(9000)
  ];
  broken.forEach((value) => {
    assert.throws(() => decodePcTemplateCode(value), (error) => error.code === 'PC_CODE_CORRUPT' && /重新扫码/.test(error.message));
  });
  assert.throws(() => decodePcTemplateCode(encode(Object.assign(samplePayload(), { v: 2 }))), (error) => error.code === 'PC_CODE_TOO_NEW');
  assert.throws(() => decodePcTemplateCode('6901234567892'), (error) => error.code === 'PC_CODE_NOT_TEMPLATE');
});

test('scan-to-label imports a desktop template code into my templates and opens it', async () => {
  let saved = null;
  let opened = null;
  let toast = null;
  let refreshed = 0;
  global.wx = {
    scanCode(options) { options.success({ result: encode(samplePayload()), scanType: 'QR_CODE' }); },
    showToast(options) { toast = options; },
    showModal() { throw new Error('no failure dialog expected'); }
  };
  const page = Object.assign({}, pageDefinition, {
    data: { codeScanning: false },
    pageActive: true,
    repository: {
      getSettings: () => ({ stockWidthMm: 40, stockHeightMm: 30 }),
      saveUserTemplate(document, name) {
        saved = { document, name };
        return { id: 'user-template-1', name, document };
      }
    },
    refresh() { refreshed += 1; },
    setData(patch) { Object.assign(this.data, patch); },
    openEditor(document, projectId) { opened = { document, projectId }; }
  });
  await page.scanToLabel();
  assert.equal(saved.name, '苹果价签');
  assert.equal(saved.document.widthMm, 40);
  assert.equal(saved.document.elements.length, 2);
  const text = saved.document.elements[0];
  assert.equal(text.text, '红富士苹果 ¥9.90/斤');
  assert.equal(text.bold, true);
  assert.equal(text.italic, false, 'omitted fields are filled from the element defaults');
  assert.equal(saved.document.elements[1].format, 'ean13');
  assert.equal(opened.document, saved.document);
  assert.equal(opened.projectId, '');
  assert.equal(refreshed, 1);
  assert.match(toast.title, /苹果价签/);
  assert.equal(page.data.codeScanning, false);
  delete global.wx;
});

test('a damaged desktop template code offers a rescan instead of building a label', async () => {
  let modal = null;
  let opened = false;
  const code = encode(samplePayload());
  global.wx = {
    scanCode(options) { options.success({ result: code.slice(0, code.length - 20), scanType: 'QR_CODE' }); },
    showModal(options) { modal = options; },
    showToast() {}
  };
  const page = Object.assign({}, pageDefinition, {
    data: { codeScanning: false },
    repository: { getSettings: () => ({ stockWidthMm: 40, stockHeightMm: 30 }), saveUserTemplate() { throw new Error('must not save'); } },
    refresh() {},
    setData(patch) { Object.assign(this.data, patch); },
    openEditor() { opened = true; }
  });
  await page.scanToLabel();
  assert.equal(opened, false);
  assert.equal(modal.title, '模板导入失败');
  assert.equal(modal.confirmText, '重新扫码');
  assert.match(modal.content, /放大二维码/);
  delete global.wx;
});

function fileSystemMock(writes, options) {
  return {
    readFile(request) { request.success({ data: options.json }); },
    writeFile(request) {
      writes.push(request);
      if (options.failWrite) request.fail({ errMsg: 'writeFile:fail the maximum size of the file storage limit is exceeded' });
      else request.success({});
    },
    access(request) { request.fail({ errMsg: 'not found' }); },
    mkdir(request) { request.success({}); },
    saveFile(request) { request.success({ savedFilePath: request.filePath }); }
  };
}

test('template file import writes data-URL images to local files before saving', async () => {
  const writes = [];
  let saved = null;
  const payload = {
    type: PAYLOAD_TYPE,
    v: 1,
    name: '带图标签',
    document: {
      widthMm: 50,
      heightMm: 30,
      elements: [{ id: 'image-1', type: 'image', x: 1, y: 1, width: 10, height: 10, path: `data:image/png;base64,${PNG_1X1}`, threshold: 160 }]
    }
  };
  global.wx = {
    env: { USER_DATA_PATH: 'wxfile://usr' },
    chooseMessageFile(options) { options.success({ tempFiles: [{ path: 'wxfile://tmp/a.json', name: 'a.json', size: 500 }] }); },
    getFileSystemManager: () => fileSystemMock(writes, { json: JSON.stringify(payload) }),
    showToast() {},
    showModal(options) { throw new Error(options.content); }
  };
  const page = Object.assign({}, pageDefinition, {
    pageActive: true,
    repository: { saveUserTemplate(document, name) { saved = { document, name }; return { name }; } },
    refresh() {}
  });
  page.importTemplateFile();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(writes.length, 1);
  assert.equal(writes[0].encoding, 'base64');
  assert.equal(writes[0].data, PNG_1X1);
  assert.match(writes[0].filePath, /^wxfile:\/\/usr\/label-image-\d+-0\.png$/);
  assert.equal(saved.name, '带图标签');
  assert.equal(saved.document.elements[0].path, writes[0].filePath);
  assert.equal(saved.document.elements[0].threshold, 160);
  delete global.wx;
});

test('template packs from the desktop designer bring their images along', async () => {
  const writes = [];
  let imported = null;
  const pack = {
    type: 'shangyue-label-pack',
    templates: [
      { name: '一号', document: { widthMm: 40, heightMm: 30, elements: [{ type: 'image', x: 1, y: 1, width: 8, height: 8, path: `data:image/png;base64,${PNG_1X1}` }] } },
      { name: '二号', document: { widthMm: 40, heightMm: 30, elements: [{ type: 'text', x: 1, y: 1, width: 20, height: 5, text: '二号' }] } }
    ]
  };
  global.wx = {
    env: { USER_DATA_PATH: 'wxfile://usr' },
    chooseMessageFile(options) { options.success({ tempFiles: [{ path: 'wxfile://tmp/pack.json', name: 'pack.json', size: 900 }] }); },
    getFileSystemManager: () => fileSystemMock(writes, { json: JSON.stringify(pack) }),
    showToast() {},
    showModal() {}
  };
  const page = Object.assign({}, pageDefinition, {
    pageActive: true,
    repository: { importUserTemplates(items) { imported = items; return { imported: items.length, overflow: 0, invalid: 0 }; } },
    refresh() {}
  });
  page.importTemplateFile();
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(imported.length, 2);
  assert.equal(writes.length, 1);
  assert.equal(imported[0].document.elements[0].path, writes[0].filePath);
  assert.equal(imported[1].document.elements[0].text, '二号');
  delete global.wx;
});

test('data-URL image helper leaves other paths alone and clears unusable data', async () => {
  const writes = [];
  const api = { env: { USER_DATA_PATH: 'wxfile://usr' }, getFileSystemManager: () => fileSystemMock(writes, {}) };
  const source = {
    widthMm: 40,
    heightMm: 30,
    elements: [
      { type: 'image', path: 'https://example.com/logo.png' },
      { type: 'image', path: 'wxfile://usr/label-image-1.jpg' },
      { type: 'image', path: 'data:text/html;base64,PGgxPmhpPC9oMT4=' },
      { type: 'material', path: `data:image/jpeg;base64,${PNG_1X1}` },
      { type: 'text', path: `data:image/png;base64,${PNG_1X1}` }
    ]
  };
  const result = await materializeDataUrlImages(api, source);
  assert.notEqual(result, source, 'returns a copy');
  assert.equal(source.elements[3].path.slice(0, 5), 'data:', 'input is not mutated');
  assert.equal(result.elements[0].path, 'https://example.com/logo.png');
  assert.equal(result.elements[1].path, 'wxfile://usr/label-image-1.jpg');
  assert.equal(result.elements[2].path, '', 'non-image data is dropped');
  assert.match(result.elements[3].path, /\.jpg$/);
  assert.equal(result.elements[4].path.slice(0, 5), 'data:', 'only image and material elements are touched');
  assert.equal(writes.length, 1);
  assert.equal(isDataUrlImage(' data:image/png;base64,AAAA'), true);
  assert.equal(isDataUrlImage('wxfile://usr/a.png'), false);

  const failing = { env: { USER_DATA_PATH: 'wxfile://usr' }, getFileSystemManager: () => fileSystemMock([], { failWrite: true }) };
  await assert.rejects(materializeDataUrlImages(failing, source), /图片保存失败/);
});
