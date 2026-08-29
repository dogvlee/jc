const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { getTemplate } = require('../src/app/catalog');
const { buildOnlineDocument, getOnlineTemplate } = require('../src/app/online-templates-pack');
const { buildTemplateDocument } = require('../src/app/template-layouts');
const { validateDocument } = require('../src/core/renderer');
const { evaluatePrintability, getProfile } = require('../src/core/profiles');
const qrcode = require('../src/vendor/qrcode');

const TEMPLATE_ID = 'shangyue-wish-card';
const LEGACY_BRAND_PATTERN = /NIIMBOT|JingChen|\bJC-|精臣生态|95598|网上国网|SG20260801001/i;

test('商跃心意祝福卡是可打印的纯矢量原创种子模板', () => {
  const template = getTemplate(TEMPLATE_ID);
  assert.ok(template);
  assert.equal(template.name, '商跃心意祝福卡');
  assert.deepEqual(template.size, [40, 30]);
  assert.equal(template.badge, '原创');
  assert.equal(template.origin, 'shangyue-original');
  assert.equal(template.copyright, '© 2026 商跃');
  assert.equal(template.approvedOriginal, true);
  assert.equal(template.releaseApproved, true);
  assert.equal(template.batchCompatible, false);
  assert.equal(template.source, 'shangyue-original');

  const document = buildTemplateDocument(template);
  assert.equal(document.name, template.name);
  assert.equal(document.widthMm, template.size[0]);
  assert.equal(document.heightMm, template.size[1]);
  assert.equal(document.templateMeta.origin, 'shangyue-original');
  assert.equal(document.templateMeta.authorship, 'shangyue-clean-room');
  assert.equal(document.templateMeta.thirdPartyAssets, false);
  assert.equal(document.templateMeta.batchCompatible, false);
  assert.equal(document.templateMeta.sourceId, undefined);
  assert.equal(document.sourceMeta, undefined);

  const allowedTypes = new Set(['rect', 'line', 'text', 'qrcode', 'serial']);
  for (const element of document.elements) {
    assert.ok(allowedTypes.has(element.type), `unexpected element type: ${element.type}`);
    assert.equal('path' in element, false, `${element.type} should not carry an image path`);
    assert.ok(element.x >= 0 && element.y >= 0, `${element.type} should start inside the label`);
    assert.ok(element.x + element.width <= document.widthMm, `${element.type} x overflow`);
    assert.ok(element.y + element.height <= document.heightMm, `${element.type} y overflow`);
    if (element.type === 'text' || element.type === 'serial') {
      assert.ok(element.fontSize >= 2.2, `${element.type} should remain readable`);
      assert.equal(element.fontFamily, 'sans-serif');
    }
  }

  assert.equal(document.elements.some((element) => element.type === 'image' || element.type === 'material'), false);
  const qr = document.elements.find((element) => element.type === 'qrcode');
  assert.ok(qr);
  assert.equal(qr.value, '生日快乐，愿你常欢喜。');
  assert.ok(document.elements.some((element) => element.type === 'text' && element.text === '扫码见心意'));
  if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  }
  const qrCode = qrcode(0, qr.errorCorrection);
  qrCode.addData(qr.value, 'Byte');
  qrCode.make();
  const requiredDots = qrCode.getModuleCount() + 8;
  const availableDots = Math.floor(Math.min(qr.width, qr.height) * 203 / 25.4);
  assert.ok(Math.floor(availableDots / requiredDots) >= 2, `${availableDots} dots / ${requiredDots} modules`);
  assert.doesNotMatch(JSON.stringify(document), LEGACY_BRAND_PATTERN);
  assert.doesNotThrow(() => validateDocument(document, 203));
  assert.equal(evaluatePrintability(document, getProfile('b1')).ok, true);
  const dSeriesFit = evaluatePrintability(document, getProfile('d110'));
  assert.equal(dSeriesFit.ok, false);
  assert.equal(dSeriesFit.suggestProfileId, 'b1');
});

test('原创祝福卡与参考祝福模板保持独立的尺寸和元素结构', () => {
  const original = buildTemplateDocument(getTemplate(TEMPLATE_ID));
  const referenceTemplate = getOnlineTemplate('online-512427668');
  assert.ok(referenceTemplate, 'reference template should remain available in the untouched online pack');
  const reference = buildOnlineDocument(referenceTemplate.id);

  assert.deepEqual([original.widthMm, original.heightMm], [40, 30]);
  assert.deepEqual([reference.widthMm, reference.heightMm], [50, 30]);
  assert.notDeepEqual(
    original.elements.map((element) => element.type),
    reference.elements.map((element) => element.type)
  );
  assert.equal(original.elements.some((element) => element.type === 'image'), false);
  assert.equal(reference.elements.some((element) => element.type === 'image'), true);
});

test('商跃原创种子均为洁净室模板且不进批量', () => {
  const { CLEANROOM_TEMPLATE_PACK } = require('../src/app/cleanroom-template-pack');
  const ids = require('../src/app/catalog').templates
    .filter((item) => item.approvedOriginal === true && item.origin === 'shangyue-original')
    .map((item) => item.id);
  assert.equal(ids.length, 35 + CLEANROOM_TEMPLATE_PACK.length);
  for (const id of ids) {
    const template = getTemplate(id);
    assert.ok(template, id);
    assert.equal(template.origin, 'shangyue-original');
    assert.equal(template.approvedOriginal, true);
    assert.equal(template.publicCatalog, true);
    assert.equal(template.batchCompatible, false);
    const document = buildTemplateDocument(template);
    assert.equal(document.templateMeta.origin, 'shangyue-original');
    assert.equal(document.templateMeta.thirdPartyAssets, false);
    assert.ok(document.elements.every((element) => !['image', 'material'].includes(element.type)));
    assert.doesNotMatch(JSON.stringify(document), LEGACY_BRAND_PATTERN);
  }
});

test('自有种子模板不再出现旧品牌，电力模板名称与目录一致', () => {
  const ids = [
    'jewelry-price',
    'business-card',
    'clothing-tag',
    'promo-price',
    'state-grid',
    'jewelry-mini',
    'garment-care'
  ];
  const documents = ids.map((id) => buildTemplateDocument(getTemplate(id)));
  const visibleContent = documents.map((document) => JSON.stringify(document)).join('\n');
  assert.doesNotMatch(visibleContent, LEGACY_BRAND_PATTERN);

  const businessCard = documents[1];
  assert.ok(businessCard.elements.some((element) => element.text === '邮箱 demo＠example.invalid'));
  assert.ok(businessCard.elements.some((element) => element.type === 'qrcode'
    && element.value === 'MECARD:N:示例用户;TEL:000-0000-0000;'));
  assert.doesNotMatch(JSON.stringify(businessCard), /liming@example\.com|13800008888/);

  const stateGridTemplate = getTemplate('state-grid');
  const stateGridDocument = buildTemplateDocument(stateGridTemplate);
  assert.equal(stateGridTemplate.name, '电力计量标识');
  assert.equal(stateGridDocument.name, stateGridTemplate.name);
  assert.match(JSON.stringify(stateGridDocument), /用电信息/);
  assert.match(JSON.stringify(stateGridDocument), /METER:\/\//);

  const layoutSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app', 'template-layouts.js'), 'utf8');
  assert.doesNotMatch(layoutSource, LEGACY_BRAND_PATTERN);
});
