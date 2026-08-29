const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  createVisionSemanticPrompt,
  exactLongCopyReuse,
  extractSemanticProfile,
  planAuthorizedRedesign,
  selectDiverseRecords
} = require('../scripts/lib/authorized-redesign');

const AUTHORIZATION = {
  status: 'operator-declared; documentary reference pending',
  reference: ''
};
const CONTEXT = {
  authorization: AUTHORIZATION,
  sourceProvider: 'fixture-catalog'
};

const VECTOR_SOURCE = {
  id: 88421,
  name: '促销价签参考',
  width: 40,
  height: 30,
  elements: [
    { type: 'text', fieldName: 'name', value: '第三方完整商品文案', x: 2, y: 2, width: 36, height: 5, fontFamily: 'source-font' },
    { type: 'text', fieldName: 'retailPrice', value: '￥19.90', x: 2, y: 9, width: 18, height: 7 },
    { type: 'barcode', value: '6901234567892', x: 2, y: 20, width: 36, height: 8 }
  ]
};

const RASTER_SOURCE = {
  ...VECTOR_SOURCE,
  id: 88422,
  elements: [
    ...VECTOR_SOURCE.elements,
    { type: 'image', path: 'https://third-party.invalid/decor.png', x: 30, y: 8, width: 7, height: 7 }
  ]
};

test('semantic extraction keeps use-case facts but excludes source expression', () => {
  const profile = extractSemanticProfile(RASTER_SOURCE, CONTEXT);
  assert.equal(profile.sourceId, '88422');
  assert.equal(profile.sourceProvider, 'fixture-catalog');
  assert.equal(profile.scene, 'price');
  assert.deepEqual(profile.fieldRoles, ['barcode', 'name', 'price']);
  assert.equal(profile.expressionSignals.sourceImages, 1);
  const serialized = JSON.stringify(profile);
  assert.doesNotMatch(serialized, /第三方完整商品文案|19\.90|third-party\.invalid|source-font/);
  assert.doesNotMatch(serialized, /"x"|"y"/);
});

test('authorized vector redesign remains an editable internal-review candidate', () => {
  const plan = planAuthorizedRedesign(VECTOR_SOURCE, CONTEXT);
  assert.match(plan.selectedId, /^sy-redesign-[a-f0-9]{12}-v[123]$/);
  assert.equal(plan.authorization.status, AUTHORIZATION.status);
  assert.equal(plan.authorization.publishAllowed, false);
  assert.equal(plan.catalogMeta.publicCatalog, false);
  assert.equal(plan.catalogMeta.releaseApproved, false);
  assert.equal(plan.document.templateMeta.approvedOriginal, false);
  assert.equal(plan.document.templateMeta.approvalStatus, 'internal-review');
  assert.equal(plan.document.templateMeta.authorizationStatus, AUTHORIZATION.status);
  assert.equal(plan.document.templateMeta.sourceProvider, 'fixture-catalog');
  assert.ok(plan.document.elements.every((element) => !['image', 'raster', 'material'].includes(element.type)));
  assert.doesNotMatch(JSON.stringify(plan.document), /第三方完整商品文案|third-party\.invalid|source-font/);
  assert.deepEqual(plan.audit.exactLongCopyReuse, []);
  assert.deepEqual(plan.audit.missingCriticalRoles, []);
  assert.equal(plan.audit.candidateForHumanReview, true);
  assert.equal(plan.reviewStatus, 'candidate');
});

test('missing authorization is never relabeled as authorized', () => {
  const plan = planAuthorizedRedesign(VECTOR_SOURCE, { sourceProvider: 'fixture-catalog' });
  assert.equal(plan.authorization.status, 'missing');
  assert.equal(plan.authorization.metadataPresent, false);
  assert.equal(plan.audit.candidateForHumanReview, false);
  assert.equal(plan.reviewStatus, 'authorization-review');
  assert.match(plan.audit.gateReasons.join(','), /authorization-metadata-missing/);
  assert.doesNotMatch(plan.document.name, /授权/);
  assert.doesNotMatch(plan.document.templateMeta.origin, /authorized/);
});

test('uncomparable layouts and raster sources fail closed to visual review', () => {
  const rasterPlan = planAuthorizedRedesign(RASTER_SOURCE, CONTEXT);
  assert.equal(rasterPlan.reviewStatus, 'visual-review');
  assert.equal(rasterPlan.document.templateMeta.reviewStatus, 'visual-review');
  assert.equal(rasterPlan.audit.sourceContainsRaster, true);
  assert.equal(rasterPlan.audit.candidateForHumanReview, false);
  assert.match(rasterPlan.audit.gateReasons.join(','), /source-contains-raster/);

  const unpositioned = {
    ...VECTOR_SOURCE,
    id: 88423,
    elements: VECTOR_SOURCE.elements.map(({ type, fieldName, value }) => ({ type, fieldName, value }))
  };
  const unpositionedPlan = planAuthorizedRedesign(unpositioned, CONTEXT);
  assert.equal(unpositionedPlan.audit.layoutComparable, false);
  assert.equal(unpositionedPlan.audit.candidateForHumanReview, false);
  assert.equal(unpositionedPlan.reviewStatus, 'visual-review');
  assert.match(unpositionedPlan.audit.gateReasons.join(','), /layout-not-comparable/);
});

test('missing a source critical role cannot become a candidate', () => {
  const source = {
    id: 'table-source',
    name: '库存表格',
    width: 50,
    height: 30,
    elements: [
      { type: 'table', x: 2, y: 2, width: 46, height: 20 },
      { type: 'text', fieldName: 'name', value: '库存记录', x: 2, y: 23, width: 46, height: 5 }
    ]
  };
  const plan = planAuthorizedRedesign(source, CONTEXT);
  assert.deepEqual(plan.audit.requiredCriticalRoles, ['table']);
  assert.deepEqual(plan.audit.missingCriticalRoles, ['table']);
  assert.equal(plan.audit.candidateForHumanReview, false);
  assert.notEqual(plan.reviewStatus, 'candidate');
  assert.match(plan.audit.gateReasons.join(','), /missing-critical-role/);
});

test('copy reuse checks every visible fixed-value field', () => {
  const values = ['text-copy', 'value-copy', 'prefix-copy', 'suffix-copy', 'label-copy', 'fixed-copy'];
  const source = {
    elements: [{
      text: values[0],
      value: values[1],
      prefix: values[2],
      suffix: values[3],
      label: values[4],
      fixedValue: values[5]
    }]
  };
  const document = {
    elements: [{
      text: values[0],
      value: values[1],
      prefix: values[2],
      suffix: values[3],
      label: values[4],
      fixedValue: values[5]
    }]
  };
  assert.deepEqual(exactLongCopyReuse(source, document), values.slice().sort());
});

test('same source id produces identical content regardless of catalog position', () => {
  const first = planAuthorizedRedesign(VECTOR_SOURCE, 0, CONTEXT);
  const later = planAuthorizedRedesign(VECTOR_SOURCE, 999, CONTEXT);
  assert.equal(first.selectedId, later.selectedId);
  assert.equal(first.selectedVariant, later.selectedVariant);
  assert.deepEqual(first.document, later.document);
  assert.deepEqual(first.alternatives, later.alternatives);
});

test('vision fallback is recorded as a non-invoked semantic-only prompt', () => {
  const prompt = createVisionSemanticPrompt(extractSemanticProfile(VECTOR_SOURCE));
  assert.match(prompt, /用途与字段语义/);
  assert.match(prompt, /禁止输出或复刻/);
  assert.match(prompt, /40×30mm/);

  const plan = planAuthorizedRedesign(VECTOR_SOURCE, CONTEXT);
  assert.equal(plan.vision.invoked, false);
  assert.equal(plan.vision.status, 'not-invoked');
  assert.equal(plan.vision.result, null);
  assert.equal(plan.vision.prompt, createVisionSemanticPrompt(plan.profile));
  assert.equal(plan.visionPrompt, plan.vision.prompt);
});

test('limited pilots sample different scenes instead of taking one catalog prefix', () => {
  const records = [
    { id: 'p1', name: '水果价签', width: 40, height: 30, elements: [] },
    { id: 'p2', name: '服装促销价签', width: 40, height: 30, elements: [] },
    { id: 'd1', name: '食品效期', width: 40, height: 30, elements: [] },
    { id: 'w1', name: '访客 WiFi', width: 40, height: 30, elements: [] }
  ];
  const selected = selectDiverseRecords(records, 3);
  assert.equal(selected.length, 3);
  assert.equal(new Set(selected.map((record) => extractSemanticProfile(record).scene)).size, 3);
});

test('CLI passes payload authorization and provider into plans without invoking vision', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sy-redesign-test-'));
  const input = path.join(tempDir, 'input.json');
  const output = path.join(tempDir, 'plan.json');
  fs.writeFileSync(input, JSON.stringify({
    sourceProvider: 'cli-fixture-provider',
    authorization: { status: 'fixture-approved-for-redesign', reference: 'AUTH-42' },
    records: [VECTOR_SOURCE]
  }));
  try {
    const result = spawnSync(process.execPath, [
      path.resolve(__dirname, '../scripts/plan-authorized-redesign.mjs'),
      '--input', input,
      '--out', output,
      '--limit', '1'
    ], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const payload = JSON.parse(fs.readFileSync(output, 'utf8'));
    assert.equal(payload.input.sourceProvider, 'cli-fixture-provider');
    assert.equal(payload.policy.authorizationStatus, 'fixture-approved-for-redesign');
    assert.equal(payload.policy.visionModelInvoked, false);
    assert.equal(payload.plans[0].authorization.reference, 'AUTH-42');
    assert.equal(payload.plans[0].profile.sourceProvider, 'cli-fixture-provider');
    assert.equal(payload.plans[0].vision.invoked, false);
    assert.match(payload.plans[0].vision.prompt, /用途与字段语义/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
