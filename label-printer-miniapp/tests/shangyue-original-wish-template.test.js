const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const {
  APPROVED_ORIGINAL_TEMPLATES,
  BATCH_TEMPLATES,
  BUILTIN_BASE_TEMPLATES,
  getTemplate
} = require('../miniprogram/app/catalog');
const { buildTemplateDocument } = require('../miniprogram/app/template-layouts');
const { getOnlineTemplate } = require('../miniprogram/app/online-templates-pack');
const { getProfile, evaluatePrintability } = require('../miniprogram/core/profiles');
const { validateDocument } = require('../miniprogram/core/renderer');
const qrcode = require('../miniprogram/vendor/qrcode');

const TEMPLATE_ID = 'shangyue-wish-card';

function elementSignature(document) {
  return document.elements.map((element) => element.type).join('>');
}

test('original Shangyue wish card is a first-party catalog template', () => {
  const template = getTemplate(TEMPLATE_ID);
  assert.ok(template);
  assert.equal(template.name, '商跃心意祝福卡');
  assert.deepEqual(template.size, [40, 30]);
  assert.equal(template.badge, '原创');
  assert.equal(template.origin, 'shangyue-original');
  assert.equal(template.source, 'shangyue-original');
  assert.equal(template.approvedOriginal, true);
  assert.equal(template.approvalStatus, 'approved');
  assert.equal(template.publicCatalog, true);
  assert.equal(template.releaseApproved, true);
  assert.equal(template.batchCompatible, false);
  assert.equal(template.thumbSrc, 'assets/shangyue-thumbs/shangyue-wish-card-v1.png');
  assert.equal(BATCH_TEMPLATES.some((item) => item.id === TEMPLATE_ID), false);
});

test('original wish card thumbnail is a checked-in 4:3 PNG rendered from the real layout', () => {
  const template = getTemplate(TEMPLATE_ID);
  const filename = path.join(__dirname, '..', 'miniprogram', template.thumbSrc);
  const png = fs.readFileSync(filename);
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert.equal(width, 640);
  assert.equal(height, 480);
  assert.equal(width / height, 4 / 3);
  assert.equal(crypto.createHash('sha256').update(png).digest('hex'), template.thumbSha256);
});

test('original wish card has independent vector content and provenance', () => {
  const template = getTemplate(TEMPLATE_ID);
  const document = buildTemplateDocument(template);
  const serialized = JSON.stringify(document);

  assert.equal(document.templateMeta.origin, 'shangyue-original');
  assert.equal(document.templateMeta.authorship, 'shangyue-clean-room');
  assert.equal(document.templateMeta.thirdPartyAssets, false);
  assert.equal(document.templateMeta.batchCompatible, false);
  assert.match(document.templateMeta.copyright, /商跃/);
  assert.doesNotMatch(serialized, /NIIMBOT|精臣|JingChen|95598|网上国网/i);
  assert.ok(document.elements.every((element) => !['image', 'material'].includes(element.type)));
  assert.ok(document.elements.every((element) => !element.path && !element.sourceId && !element.sourceMeta));

  for (const element of document.elements) {
    assert.ok(element.x >= 0 && element.y >= 0, `${element.type} starts inside the paper`);
    assert.ok(element.x + element.width <= document.widthMm, `${element.type} fits horizontally`);
    assert.ok(element.y + element.height <= document.heightMm, `${element.type} fits vertically`);
    if (Number.isFinite(element.fontSize)) {
      assert.ok(element.fontSize >= 2.2, `${element.type} remains readable at 203 dpi`);
      assert.match(element.fontFamily || 'sans-serif', /^(sans-serif|serif|monospace)$/);
    }
  }

  const qr = document.elements.find((element) => element.type === 'qrcode');
  assert.ok(qr);
  assert.ok(qr.width >= 10.5 && qr.height >= 10.5);
  assert.equal(qr.value, '生日快乐，愿你常欢喜。');
  assert.doesNotMatch(qr.value, /example\.com|123456789/);
  assert.equal(document.elements.some((element) => element.text === '扫码见心意'), true);
  const encodedQr = qrcode(0, qr.errorCorrection);
  encodedQr.addData(qr.value, 'Byte');
  encodedQr.make();
  const availableDots = Math.floor(Math.min(qr.width, qr.height) * 203 / 25.4);
  const modulesWithQuietZone = encodedQr.getModuleCount() + 8;
  assert.ok(availableDots >= modulesWithQuietZone * 2, 'QR keeps at least two dots per module');
  assert.doesNotThrow(() => validateDocument(document, 203));
  assert.equal(evaluatePrintability(document, getProfile('b1')).ok, true);
  const dSeriesFit = evaluatePrintability(document, getProfile('d110'));
  assert.equal(dSeriesFit.ok, false);
  assert.equal(dSeriesFit.suggestProfileId, 'b1');
});

test('original wish card does not reuse the referenced online blessing layout', () => {
  const original = buildTemplateDocument(getTemplate(TEMPLATE_ID));
  const reference = getOnlineTemplate('online-512427668');

  assert.ok(reference);
  assert.notDeepEqual([original.widthMm, original.heightMm], reference.size);
  assert.notEqual(elementSignature(original), elementSignature(reference.document));
  assert.equal(original.elements.some((element) => element.type === 'image'), false);
  assert.equal(reference.document.elements.some((element) => element.type === 'image'), true);
  const referencePaths = new Set(reference.document.elements.map((element) => element.path).filter(Boolean));
  assert.ok(original.elements.every((element) => !referencePaths.has(element.path)));
});

test('only explicitly approved originals are publicly attributable to Shangyue', () => {
  assert.equal(APPROVED_ORIGINAL_TEMPLATES[0].id, TEMPLATE_ID);
  assert.equal(APPROVED_ORIGINAL_TEMPLATES.length, 22);
  assert.ok(APPROVED_ORIGINAL_TEMPLATES.every((template) => template.id.startsWith('shangyue-')));
  assert.equal(BUILTIN_BASE_TEMPLATES.length, 32);
  assert.ok(BUILTIN_BASE_TEMPLATES.every((template) => (
    template.source === 'builtin-base'
    && template.approvalStatus === 'pending-review'
    && template.publicCatalog === false
  )));
  const firstPartyDocuments = APPROVED_ORIGINAL_TEMPLATES.map((template) => buildTemplateDocument(template));
  assert.doesNotMatch(
    JSON.stringify(firstPartyDocuments),
    /NIIMBOT|精臣|JingChen|95598|网上国网/i
  );
});
