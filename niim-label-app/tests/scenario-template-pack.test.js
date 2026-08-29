const test = require('node:test');
const assert = require('node:assert/strict');

const { getTemplate, templates } = require('../src/app/catalog');
const { buildTemplateDocument, LAYOUT_BUILDERS } = require('../src/app/template-layouts');
const { getProfile, alignedCanvasSize } = require('../src/core/profiles');
const { validateDocument } = require('../src/core/renderer');

const SCENARIOS = [
  ['shangyue-shelf-dual-price', '零售价签'],
  ['shangyue-produce-origin', '零售价签'],
  ['shangyue-market-promo', '零售价签'],
  ['shangyue-pick-wave', '仓储资产'],
  ['shangyue-return-check', '仓储资产'],
  ['shangyue-tool-asset', '仓储资产'],
  ['shangyue-drink-cup', '食品效期'],
  ['shangyue-thaw-window', '食品效期'],
  ['shangyue-allergen-check', '食品效期'],
  ['shangyue-size-color', '服装珠宝'],
  ['shangyue-jewelry-repair', '服装珠宝'],
  ['shangyue-fabric-roll', '服装珠宝'],
  ['shangyue-cable-pair', '线缆设备'],
  ['shangyue-panel-port', '线缆设备'],
  ['shangyue-maintenance', '线缆设备'],
  ['shangyue-archive-box', '办公生活'],
  ['shangyue-storage-index', '办公生活'],
  ['shangyue-book-loan', '办公生活']
];

const IDS = SCENARIOS.map(([id]) => id);

function built(id) {
  const template = getTemplate(id);
  assert.ok(template, `missing catalog template ${id}`);
  return { template, document: buildTemplateDocument(template) };
}

test('original scenario pack contains three templates for each of six real jobs', () => {
  assert.equal(IDS.length, 18);
  assert.equal(new Set(IDS).size, IDS.length);

  const counts = new Map();
  SCENARIOS.forEach(([, group]) => counts.set(group, (counts.get(group) || 0) + 1));
  assert.deepEqual(Object.fromEntries(counts), {
    '零售价签': 3,
    '仓储资产': 3,
    '食品效期': 3,
    '服装珠宝': 3,
    '线缆设备': 3,
    '办公生活': 3
  });
});

test('every scenario is an approved Shangyue original in the public release catalog', () => {
  const publicIds = new Set(templates.map((item) => item.id));
  for (const [id, group] of SCENARIOS) {
    const template = getTemplate(id);
    assert.ok(publicIds.has(id), `${id} should be visible in public catalog`);
    assert.equal(template.scenarioGroup, group);
    assert.equal(template.origin, 'shangyue-original');
    assert.equal(template.source, 'shangyue-original');
    assert.equal(template.authorship, 'shangyue-clean-room');
    assert.equal(template.approvedOriginal, true);
    assert.equal(template.publicCatalog, true);
    assert.equal(template.releaseApproved, true);
    assert.equal(template.riskGuard, 'edit-before-print');
    assert.equal(typeof LAYOUT_BUILDERS[id], 'function');
  }
});

test('scenario layouts match catalog sizes, stay in bounds, and keep business fields editable', () => {
  for (const [id, group] of SCENARIOS) {
    const { template, document } = built(id);
    assert.equal(document.name, template.name, `${id} document name`);
    assert.equal(document.widthMm, template.size[0], `${id} width`);
    assert.equal(document.heightMm, template.size[1], `${id} height`);
    assert.ok(document.elements.length >= 6, `${id} should be a composed layout`);

    const meta = document.templateMeta;
    assert.equal(meta.origin, 'shangyue-original', `${id} origin`);
    assert.equal(meta.authorship, 'shangyue-clean-room', `${id} authorship`);
    assert.equal(meta.thirdPartyAssets, false, `${id} third-party asset policy`);
    assert.equal(meta.publicCatalog, true, `${id} publicCatalog`);
    assert.equal(meta.releaseApproved, true, `${id} releaseApproved`);
    assert.equal(meta.scenarioGroup, group, `${id} scenario group`);
    assert.equal(meta.riskGuard, 'edit-before-print', `${id} risk guard`);

    for (const element of document.elements) {
      assert.ok(element.width > 0 && element.height > 0, `${id}/${element.type} positive size`);
      assert.ok(element.x >= 0 && element.y >= 0, `${id}/${element.type} positive position`);
      assert.ok(element.x + element.width <= document.widthMm + 0.001, `${id}/${element.type} x overflow`);
      assert.ok(element.y + element.height <= document.heightMm + 0.001, `${id}/${element.type} y overflow`);
    }

    const required = document.elements.filter((element) => element.requiresInput === true);
    assert.ok(required.length >= 1, `${id} should block unedited sample business data`);
    required.forEach((element) => {
      assert.notEqual(element.locked, true, `${id}/${element.type} required content must remain editable`);
      assert.ok(
        element.requiresInputReason === 'placeholder-text' || element.requiresInputReason === 'sample-code',
        `${id}/${element.type} should have a known input reason`
      );
    });

    const editableSemantic = document.elements.filter((element) => (
      ['text', 'barcode', 'qrcode', 'date', 'serial'].includes(element.type) && element.locked !== true
    ));
    assert.ok(editableSemantic.length >= 2, `${id} should expose editable semantic content`);
  }
});

test('codes are explicit demo values, print-blocking until reviewed, and valid after confirmation', () => {
  for (const [id] of SCENARIOS) {
    const { document } = built(id);
    const codes = document.elements.filter((element) => element.type === 'barcode' || element.type === 'qrcode');
    codes.forEach((element) => {
      assert.equal(element.requiresInput, true, `${id}/${element.type} should require review`);
      assert.equal(element.requiresInputReason, 'sample-code', `${id}/${element.type} reason`);
      assert.equal(element.riskRole, 'sample-code', `${id}/${element.type} risk role`);
      assert.match(String(element.value), /^(?:DEMO|SYDEMO:)/, `${id}/${element.type} safe demo namespace`);
    });

    const confirmed = JSON.parse(JSON.stringify(document));
    confirmed.elements.forEach((element) => {
      if (element.type === 'barcode' || element.type === 'qrcode') {
        delete element.requiresInput;
        delete element.requiresInputReason;
      }
    });
    assert.doesNotThrow(() => validateDocument(confirmed, 203), `${id} confirmed codes should render at 203dpi`);
  }
});

test('scenario sample content contains no live contact, web, Wi-Fi, or plausible customer identifiers', () => {
  const unsafe = /https?:\/\/|www\.|example\.(?:com|cn)|WIFI:|\b1[3-9]\d{9}\b|\b\d{17}[\dXx]\b|@(?:qq|163|126|gmail)\./i;
  for (const [id] of SCENARIOS) {
    const { document } = built(id);
    const content = document.elements
      .flatMap((element) => [element.text, element.value])
      .filter((value) => value != null)
      .join('\n');
    assert.doesNotMatch(content, unsafe, `${id} should not ship plausible live business data`);
  }
});

test('every scenario fits every profile claimed by its release metadata', () => {
  for (const [id] of SCENARIOS) {
    const { template, document } = built(id);
    assert.ok(Array.isArray(template.verifiedProfiles) && template.verifiedProfiles.length >= 4, `${id} profiles`);
    template.verifiedProfiles.forEach((profileId) => {
      assert.doesNotThrow(
        () => alignedCanvasSize(document, getProfile(profileId)),
        `${id} should fit ${profileId}`
      );
    });
  }
});
