const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const {
  APPROVED_AUTHORIZED_REDESIGN_TEMPLATE_IDS,
  APPROVED_AUTHORIZED_REDESIGN_TEMPLATES,
  APPROVED_ORIGINAL_TEMPLATE_IDS,
  APPROVED_ORIGINAL_TEMPLATES,
  BATCH_TEMPLATES,
  getTemplate
} = require('../miniprogram/app/catalog');
const { buildTemplateDocument } = require('../miniprogram/app/template-layouts');
const { getOnlineTemplate } = require('../miniprogram/app/online-templates-pack');
const { getProfile, evaluatePrintability } = require('../miniprogram/core/profiles');
const { validateDocument } = require('../miniprogram/core/renderer');
const qrcode = require('../miniprogram/vendor/qrcode');

const EXPECTED_IDS = APPROVED_ORIGINAL_TEMPLATE_IDS.slice();

const REFERENCE_BY_ID = {
  'shangyue-price-tag': 'online-233730076',
  'shangyue-wish-card': 'online-512427668'
};

function elementSignature(document) {
  return document.elements.map((element) => element.type).join('>');
}

function normalizedElement(document, element) {
  return {
    type: element.type,
    cx: (element.x + element.width / 2) / document.widthMm,
    cy: (element.y + element.height / 2) / document.heightMm,
    width: element.width / document.widthMm,
    height: element.height / document.heightMm
  };
}

function normalizedElementDistance(left, right) {
  return Math.sqrt(
    ((left.cx - right.cx) ** 2)
    + ((left.cy - right.cy) ** 2)
    + ((left.width - right.width) ** 2)
    + ((left.height - right.height) ** 2)
  );
}

function oneWayLayoutDistance(left, right) {
  const rightFeatures = right.elements.map((element) => normalizedElement(right, element));
  return left.elements.reduce((sum, element) => {
    const feature = normalizedElement(left, element);
    const sameType = rightFeatures.filter((candidate) => candidate.type === feature.type);
    if (!sameType.length) return sum + 1;
    return sum + Math.min(...sameType.map((candidate) => normalizedElementDistance(feature, candidate)));
  }, 0) / Math.max(1, left.elements.length);
}

function symmetricLayoutDistance(left, right) {
  return (oneWayLayoutDistance(left, right) + oneWayLayoutDistance(right, left)) / 2;
}

function visibleCopy(document) {
  return new Set(document.elements
    .map((element) => String(element.text || '').trim())
    .filter(Boolean));
}

function encodeQr(value, errorCorrection) {
  const encoded = qrcode(0, errorCorrection || 'M');
  encoded.addData(value, 'Byte');
  encoded.make();
  return encoded;
}

test('approved original pack is the clean-room Shangyue seed set', () => {
  assert.deepEqual(APPROVED_ORIGINAL_TEMPLATES.map((item) => item.id), EXPECTED_IDS);
  assert.equal(APPROVED_ORIGINAL_TEMPLATES.length, 22);
  assert.deepEqual(APPROVED_AUTHORIZED_REDESIGN_TEMPLATE_IDS, []);
  assert.equal(APPROVED_AUTHORIZED_REDESIGN_TEMPLATES.length, 0);
  assert.ok(EXPECTED_IDS.every((id) => BATCH_TEMPLATES.every((item) => item.id !== id)));
});

for (const templateId of EXPECTED_IDS) {
  test(`${templateId} is a first-party vector original with a locked thumbnail`, () => {
    const template = getTemplate(templateId);
    assert.ok(template);
    assert.equal(template.origin, 'shangyue-original');
    assert.equal(template.source, 'shangyue-original');
    assert.equal(template.approvedOriginal, true);
    assert.equal(template.publicCatalog, true);
    assert.equal(template.releaseApproved, true);
    assert.equal(template.batchCompatible, false);
    assert.equal(template.badge, '原创');
    assert.match(template.copyright, /商跃/);
    assert.match(template.thumbSrc, /^assets\/shangyue-thumbs\/shangyue-.+-v1\.png$/);

    const filename = path.join(__dirname, '..', 'miniprogram', template.thumbSrc);
    const png = fs.readFileSync(filename);
    assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
    assert.equal(png.readUInt32BE(16), 640);
    assert.equal(png.readUInt32BE(20), 480);
    assert.equal(crypto.createHash('sha256').update(png).digest('hex'), template.thumbSha256);

    const document = buildTemplateDocument(template);
    const serialized = JSON.stringify(document);
    assert.equal(document.templateMeta.origin, 'shangyue-original');
    assert.equal(document.templateMeta.authorship, 'shangyue-clean-room');
    assert.equal(document.templateMeta.thirdPartyAssets, false);
    assert.equal(document.templateMeta.batchCompatible, false);
    assert.doesNotMatch(serialized, /NIIMBOT|精臣|JingChen|95598|网上国网/i);
    assert.ok(document.elements.every((element) => !['image', 'material'].includes(element.type)));
    assert.ok(document.elements.every((element) => !element.path && !element.sourceId && !element.sourceMeta));

    for (const element of document.elements) {
      assert.ok(element.x >= 0 && element.y >= 0, `${element.type} starts inside the paper`);
      assert.ok(element.x + element.width <= document.widthMm + 0.05, `${element.type} fits horizontally`);
      assert.ok(element.y + element.height <= document.heightMm + 0.05, `${element.type} fits vertically`);
      if (Number.isFinite(element.fontSize)) {
        assert.ok(element.fontSize >= 2.2, `${element.type} remains readable at 203 dpi`);
        assert.match(element.fontFamily || 'sans-serif', /^(sans-serif|serif|monospace)$/);
      }
    }

    const qr = document.elements.find((element) => element.type === 'qrcode');
    if (qr) {
      assert.ok(qr.width >= 10.5 && qr.height >= 10.5);
      assert.doesNotMatch(qr.value, /example\.com|123456789/);
      const encodedQr = encodeQr(qr.value, qr.errorCorrection);
      const availableDots = Math.floor(Math.min(qr.width, qr.height) * 203 / 25.4);
      assert.ok(availableDots >= (encodedQr.getModuleCount() + 8) * 2, 'QR keeps at least two dots per module');
    }

    assert.doesNotThrow(() => validateDocument(document, 203));
    assert.equal(evaluatePrintability(document, getProfile('b1')).ok, true);
  });
}

test('new originals do not reuse crawled image packs or builtin counterparts', () => {
  const pairs = [
    ['shangyue-price-tag', 'product-simple'],
    ['shangyue-bin-label', 'storage-code'],
    ['shangyue-name-sticker', 'name-tag'],
    ['shangyue-fresh-date', 'home-date'],
    ['shangyue-wifi-card', 'wifi-code'],
    ['shangyue-promo-tag', 'promo-price'],
    ['shangyue-jewelry-tag', 'jewelry-price'],
    ['shangyue-garment-tag', 'clothing-tag'],
    ['shangyue-ship-label', 'shipping-bin'],
    ['shangyue-cable-tag', 'cable-name'],
    ['shangyue-asset-tag', 'asset-card'],
    ['shangyue-biz-card', 'business-card'],
    ['shangyue-kitchen-date', 'catering-date'],
    ['shangyue-med-label', 'medicine-box'],
    ['shangyue-seat-card', 'wedding-invite'],
    ['shangyue-bakery-tag', 'bakery-tag'],
    ['shangyue-plant-tag', 'plant-care'],
    ['shangyue-desk-plate', 'office-desk'],
    ['shangyue-lab-tag', 'lab-sample'],
    ['shangyue-care-tag', 'garment-care'],
    ['shangyue-serial-cable', 'serial-cable']
  ];
  for (const [originalId, builtinId] of pairs) {
    const original = buildTemplateDocument(getTemplate(originalId));
    const builtin = buildTemplateDocument(getTemplate(builtinId));
    assert.notEqual(elementSignature(original), elementSignature(builtin), originalId);
    assert.equal(original.elements.some((element) => element.type === 'image'), false);
  }

  for (const [originalId, referenceId] of Object.entries(REFERENCE_BY_ID)) {
    const original = buildTemplateDocument(getTemplate(originalId));
    const reference = getOnlineTemplate(referenceId);
    assert.ok(reference, referenceId);
    assert.notDeepEqual([original.widthMm, original.heightMm], reference.size);
    assert.notEqual(elementSignature(original), elementSignature(reference.document));
    assert.equal(reference.document.elements.some((element) => element.type === 'image'), true);
  }
});

test('redesigned pilot templates clear structural and copy-distance gates', () => {
  const pairs = [
    ['shangyue-promo-tag', 'promo-price'],
    ['shangyue-kitchen-date', 'catering-date'],
    ['shangyue-wifi-card', 'wifi-code'],
    ['shangyue-plant-tag', 'plant-care'],
    ['shangyue-care-tag', 'garment-care']
  ];

  for (const [redesignId, referenceId] of pairs) {
    const redesign = buildTemplateDocument(getTemplate(redesignId));
    const reference = buildTemplateDocument(getTemplate(referenceId));
    assert.ok(
      symmetricLayoutDistance(redesign, reference) >= 0.25,
      `${redesignId} must move its normalized layout away from ${referenceId}`
    );
    const referenceCopy = visibleCopy(reference);
    const exactReuse = [...visibleCopy(redesign)].filter((line) => referenceCopy.has(line));
    assert.deepEqual(exactReuse, [], `${redesignId} must not retain exact visible copy from ${referenceId}`);
  }
});

test('wifi original encodes a fictional WPA guest network', () => {
  const document = buildTemplateDocument(getTemplate('shangyue-wifi-card'));
  const qr = document.elements.find((element) => element.type === 'qrcode');
  assert.equal(qr.value, 'WIFI:T:WPA;S:SY-Guest;P:sy202609;;');
  assert.ok(document.elements.some((element) => element.text === '打印后请改密码'));
});

test('price original keeps a valid EAN-13 and dual prices', () => {
  const document = buildTemplateDocument(getTemplate('shangyue-price-tag'));
  const barcode = document.elements.find((element) => element.type === 'barcode');
  assert.equal(barcode.format, 'ean13');
  assert.equal(barcode.value, '6901234567892');
  assert.ok(document.elements.some((element) => element.text === '¥16.80'));
  assert.ok(document.elements.some((element) => element.text === '会员 15.20'));
});
