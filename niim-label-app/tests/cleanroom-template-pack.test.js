const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CLEANROOM_LAYOUT_BUILDERS,
  CLEANROOM_TASKS,
  CLEANROOM_TEMPLATE_INDEX,
  CLEANROOM_TEMPLATE_PACK,
  CLEANROOM_VARIANTS,
  PACK_VERSION,
  buildCleanroomDocument,
  cleanroomTaskChips,
  getCleanroomTemplate
} = require('../src/app/cleanroom-template-pack');
const { alignedCanvasSize, getProfile } = require('../src/core/profiles');
const { validateDocument } = require('../src/core/renderer');

const ALLOWED_CATEGORIES = new Set(['零售', '仓储', '办公', '生活', '行业']);
const ALLOWED_INDUSTRIES = new Set(['行业标识', '内容设计', '实用功能']);
const SUPPORTED_CODES = new Set(['code128', 'code128a', 'code128b', 'code128c', 'ean13', 'upca', 'upce']);

function signatureNumber(value) {
  return Math.round(Number(value) * 10) / 10;
}

function layoutSignature(documentValue) {
  return documentValue.elements.map((element) => ({
    type: element.type,
    x: signatureNumber(element.x),
    y: signatureNumber(element.y),
    width: signatureNumber(element.width),
    height: signatureNumber(element.height),
    rotation: signatureNumber(element.rotation || 0),
    fontSize: element.fontSize == null ? null : signatureNumber(element.fontSize),
    bold: Boolean(element.bold),
    reverse: Boolean(element.reverse),
    align: element.align || '',
    wordWrap: Boolean(element.wordWrap),
    lineWidth: element.lineWidth == null ? null : signatureNumber(element.lineWidth),
    filled: Boolean(element.filled),
    shapeKind: element.shapeKind || '',
    format: element.format || '',
    locked: Boolean(element.locked)
  })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('clean-room pack contains twenty business tasks with five original variants each', () => {
  assert.equal(PACK_VERSION, '2026.08-cleanroom-100');
  assert.equal(CLEANROOM_TASKS.length, 20);
  assert.equal(CLEANROOM_VARIANTS.length, 5);
  assert.equal(CLEANROOM_TEMPLATE_PACK.length, 100);
  assert.equal(new Set(CLEANROOM_TEMPLATE_PACK.map((item) => item.id)).size, 100);

  for (const taskSpec of CLEANROOM_TASKS) {
    const variants = CLEANROOM_TEMPLATE_PACK.filter((item) => item.taskId === taskSpec.id);
    assert.equal(variants.length, 5, taskSpec.id);
    assert.deepEqual(
      new Set(variants.map((item) => item.layoutVariant)),
      new Set(['focus', 'split', 'verify', 'panorama', 'ledger']),
      taskSpec.id
    );
  }

  assert.deepEqual(
    Object.fromEntries(cleanroomTaskChips().map((chip) => [chip.label, chip.templateCount])),
    {
      '全部': 100,
      '零售餐饮': 20,
      '仓储生产': 20,
      '资产设备': 20,
      '办公档案': 15,
      '服装珠宝': 15,
      '校园家庭': 10
    }
  );
});

test('catalog metadata is stable, owned by Shangyue, editable and compatible with current filters', () => {
  for (const template of CLEANROOM_TEMPLATE_PACK) {
    assert.equal(CLEANROOM_TEMPLATE_INDEX[template.id], template);
    assert.equal(getCleanroomTemplate(template.id), template);
    assert.equal(template.provenance, 'shangyue-clean-room');
    assert.equal(template.authorship, 'shangyue-clean-room');
    assert.equal(template.origin, 'shangyue-original');
    assert.equal(template.source, 'shangyue-original');
    assert.equal(template.thirdPartyAssets, false);
    assert.equal(template.approvedOriginal, true);
    assert.equal(template.publicCatalog, true);
    assert.equal(template.releaseApproved, true);
    assert.equal(template.riskGuard, 'edit-before-print');
    assert.equal(template.packVersion, PACK_VERSION);
    assert.ok(template.taskId && template.taskLabel && template.seriesGroup);
    assert.ok(template.variantLabel && template.blurb);
    assert.ok(Array.isArray(template.sceneIds) && template.sceneIds.length >= 1);
    assert.ok(ALLOWED_CATEGORIES.has(template.category), template.category);
    assert.ok(ALLOWED_INDUSTRIES.has(template.industry), template.industry);
    assert.ok(['barcode', 'qrcode'].includes(template.kind), template.kind);
    assert.deepEqual(
      [template.stockProfile.widthMm, template.stockProfile.heightMm],
      template.size
    );
    assert.equal(template.stockProfile.media, 'gap-label');
    assert.deepEqual(
      [template.printRequirements.widthMm, template.printRequirements.heightMm],
      template.size
    );
    assert.equal(template.printRequirements.media, 'gap-label');
    assert.equal(template.printRequirements.transportAgnostic, true);
    if (template.nativeLayout) {
      assert.deepEqual(template.verifiedProfiles, []);
      assert.equal(template.profilePolicy, 'runtime-capability');
      assert.equal(template.hardwareAgnostic, true);
    } else {
      assert.ok(Array.isArray(template.verifiedProfiles) && template.verifiedProfiles.length >= 4);
      assert.equal(template.profilePolicy, 'verified-profile-list');
    }
  }

  assert.equal(getCleanroomTemplate('missing-clean-room-template'), null);
  assert.throws(() => buildCleanroomDocument('missing-clean-room-template'), /Unknown clean-room template/);
});

test('pack covers compact through wide stock without making unsupported wide-profile claims', () => {
  const sizes = new Set(CLEANROOM_TEMPLATE_PACK.map((item) => item.size.join('×')));
  assert.deepEqual(sizes, new Set([
    '30×12', '30×15', '40×12', '40×20', '40×30',
    '50×30', '50×40', '60×40'
  ]));
  assert.ok(CLEANROOM_TEMPLATE_PACK.some((item) => item.size[1] <= 12));
  assert.ok(CLEANROOM_TEMPLATE_PACK.some((item) => item.size[1] === 15));
  assert.ok(CLEANROOM_TEMPLATE_PACK.some((item) => item.size[1] >= 30));
  assert.equal(CLEANROOM_TEMPLATE_PACK.filter((item) => item.size.join('×') === '50×30').length, 20);
  assert.equal(CLEANROOM_TEMPLATE_PACK.filter((item) => item.size.join('×') === '50×40').length, 10);
  assert.equal(CLEANROOM_TEMPLATE_PACK.filter((item) => item.size.join('×') === '60×40').length, 10);

  for (const template of CLEANROOM_TEMPLATE_PACK) {
    const documentValue = buildCleanroomDocument(template.id);
    for (const profileId of template.verifiedProfiles) {
      assert.doesNotThrow(
        () => alignedCanvasSize(documentValue, getProfile(profileId)),
        `${template.id} should fit ${profileId}`
      );
    }
  }
});

test('forty native wide templates are hardware-agnostic, size-faithful and safe-inset bounded', () => {
  const wideTemplates = CLEANROOM_TEMPLATE_PACK.filter((item) => item.nativeLayout);
  assert.equal(wideTemplates.length, 40);

  for (const taskSpec of CLEANROOM_TASKS) {
    const wideForTask = wideTemplates.filter((item) => item.taskId === taskSpec.id);
    assert.equal(wideForTask.length, 2, taskSpec.id);
    assert.deepEqual(
      new Set(wideForTask.map((item) => item.layoutVariant)),
      new Set(['panorama', 'ledger']),
      taskSpec.id
    );
  }

  for (const template of wideTemplates) {
    assert.deepEqual(template.verifiedProfiles, [], `${template.id} must not bind a Bluetooth model`);
    assert.equal(template.profilePolicy, 'runtime-capability');
    assert.equal(template.transportAgnostic, true);
    assert.equal(template.stockProfile.fitPolicy, 'native-size-only');
    assert.match(template.layoutFamily, /^native-wide-/);

    const documentValue = buildCleanroomDocument(template.id);
    assert.deepEqual([documentValue.widthMm, documentValue.heightMm], template.size);
    assert.deepEqual(
      [documentValue.templateMeta.printRequirements.widthMm, documentValue.templateMeta.printRequirements.heightMm],
      template.size
    );
    assert.equal(documentValue.templateMeta.profilePolicy, 'runtime-capability');
    assert.equal(documentValue.templateMeta.hardwareAgnostic, true);

    const codes = documentValue.elements.filter((element) => (
      element.type === 'barcode' || element.type === 'qrcode'
    ));
    assert.equal(codes.length, 1, `${template.id} should keep one scan target`);
    if (codes[0].type === 'qrcode') {
      assert.equal(codes[0].width, codes[0].height, `${template.id} QR must stay square`);
    }

    const inset = template.stockProfile.safeInsetMm;
    documentValue.elements.forEach((element) => {
      assert.ok(element.x >= inset - 0.001, `${template.id}/${element.id} left safe inset`);
      assert.ok(element.y >= inset - 0.001, `${template.id}/${element.id} top safe inset`);
      assert.ok(
        element.x + element.width <= documentValue.widthMm - inset + 0.001,
        `${template.id}/${element.id} right safe inset`
      );
      assert.ok(
        element.y + element.height <= documentValue.heightMm - inset + 0.001,
        `${template.id}/${element.id} bottom safe inset`
      );
    });
  }
});

test('document builders are deterministic and expose stable element identifiers', () => {
  for (const template of CLEANROOM_TEMPLATE_PACK) {
    const first = buildCleanroomDocument(template.id);
    const second = buildCleanroomDocument(template);
    const throughIndex = CLEANROOM_LAYOUT_BUILDERS[template.id]();
    assert.deepEqual(first, second, template.id);
    assert.deepEqual(first, throughIndex, template.id);
    assert.equal(first.name, template.name);
    assert.deepEqual([first.widthMm, first.heightMm], template.size);
    assert.equal(first.stockLabel, template.stock);
    assert.equal(new Set(first.elements.map((element) => element.id)).size, first.elements.length);
    assert.ok(first.elements.every((element) => element.id.startsWith(`${template.id}-e`)));
    assert.equal(first.templateMeta.templateId, template.id);
    assert.equal(first.templateMeta.provenance, 'shangyue-clean-room');
    assert.equal(first.templateMeta.taskId, template.taskId);
    assert.equal(first.templateMeta.variantLabel, template.variantLabel);
    assert.deepEqual(first.templateMeta.verifiedProfiles, template.verifiedProfiles);
  }
});

test('all one hundred templates retain distinct composition signatures on a 0.1 mm design grid', () => {
  const signatures = CLEANROOM_TEMPLATE_PACK.map((template) => (
    JSON.stringify({
      size: template.size,
      elements: layoutSignature(buildCleanroomDocument(template.id))
    })
  ));
  assert.equal(new Set(signatures).size, 100);
});

test('every element stays inside its stock and operational fields remain editable', () => {
  for (const template of CLEANROOM_TEMPLATE_PACK) {
    const documentValue = buildCleanroomDocument(template.id);
    assert.ok(documentValue.elements.length >= 7, `${template.id} composition depth`);
    for (const element of documentValue.elements) {
      assert.ok(Number.isFinite(element.x) && Number.isFinite(element.y), `${template.id}/${element.id} position`);
      assert.ok(Number.isFinite(element.width) && element.width > 0, `${template.id}/${element.id} width`);
      assert.ok(Number.isFinite(element.height) && element.height > 0, `${template.id}/${element.id} height`);
      assert.ok(element.x >= 0 && element.y >= 0, `${template.id}/${element.id} origin`);
      assert.ok(element.x + element.width <= documentValue.widthMm + 0.001, `${template.id}/${element.id} x overflow`);
      assert.ok(element.y + element.height <= documentValue.heightMm + 0.001, `${template.id}/${element.id} y overflow`);
    }

    const required = documentValue.elements.filter((element) => element.requiresInput === true);
    assert.ok(required.length >= 4, `${template.id} should require three business fields and one code`);
    required.forEach((element) => {
      assert.notEqual(element.locked, true, `${template.id}/${element.id} required field must be editable`);
      assert.ok(['placeholder-text', 'sample-code'].includes(element.requiresInputReason));
      assert.ok(['business-data', 'sample-code'].includes(element.riskRole));
    });

    const codes = documentValue.elements.filter((element) => element.type === 'barcode' || element.type === 'qrcode');
    assert.equal(codes.length, 1, `${template.id} should have one intentional scan target`);
    assert.equal(codes[0].requiresInput, true);
    assert.equal(codes[0].requiresInputReason, 'sample-code');
    assert.equal(codes[0].riskRole, 'sample-code');
    if (codes[0].type === 'barcode') assert.ok(SUPPORTED_CODES.has(codes[0].format));
    assert.ok(documentValue.elements.every((element) => element.type !== 'image'));
  }
});

test('sample content contains no third-party brand, remote reference or plausible live identity', () => {
  const forbiddenBrand = /(?:精臣|精诚|niim(?:bot)?)/i;
  const remoteReference = /(?:https?:\/\/|ftp:\/\/|www\.)/i;
  const email = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;
  const mobile = /(?:^|\D)(?:\+?86[-\s]?)?1[3-9]\d{9}(?:\D|$)/;
  const citizenId = /(?:^|\D)\d{17}[\dXx](?:\D|$)/;

  for (const template of CLEANROOM_TEMPLATE_PACK) {
    const documentValue = buildCleanroomDocument(template.id);
    const content = documentValue.elements.flatMap((element) => [
      element.text,
      element.value,
      element.path
    ]).filter((value) => value != null).join('\n');
    assert.doesNotMatch(content, forbiddenBrand, template.id);
    assert.doesNotMatch(content, remoteReference, template.id);
    assert.doesNotMatch(content, email, template.id);
    assert.doesNotMatch(content, mobile, template.id);
    assert.doesNotMatch(content, citizenId, template.id);
  }
});

test('sample codes block preflight until explicitly confirmed and then validate at 203 dpi', () => {
  for (const template of CLEANROOM_TEMPLATE_PACK) {
    const documentValue = buildCleanroomDocument(template.id);
    assert.throws(
      () => validateDocument(documentValue, 203),
      (error) => error && error.code === 'CODE_INPUT_REQUIRED',
      `${template.id} should block sample code printing`
    );

    const confirmed = clone(documentValue);
    confirmed.elements.forEach((element) => {
      if (element.type !== 'barcode' && element.type !== 'qrcode') return;
      element.requiresInput = false;
      delete element.requiresInputReason;
      element.sampleValueConfirmed = true;
    });
    assert.doesNotThrow(
      () => validateDocument(confirmed, 203),
      `${template.id} confirmed code should be a supported, readable symbology`
    );
  }
});
