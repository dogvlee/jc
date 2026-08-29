const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const AUDIT_MODULE = '../scripts/audit-cleanroom-pack.mjs';

function documentWith(elements, size = [40, 30]) {
  return {
    widthMm: size[0],
    heightMm: size[1],
    elements
  };
}

function element(type, overrides = {}) {
  return Object.assign({
    id: `${type}-1`,
    type,
    x: 2,
    y: 2,
    width: 18,
    height: 5,
    rotation: 0
  }, overrides);
}

function originalTemplate(id, document, overrides = {}) {
  return Object.assign({
    id,
    name: `商跃原创 ${id}`,
    provenance: {
      method: 'clean-room',
      owner: '商跃',
      basis: '用户任务与通用标签需求'
    },
    origin: 'shangyue-original',
    authorship: 'shangyue-clean-room',
    copyright: '© 2026 商跃',
    thirdPartyAssets: false,
    document
  }, overrides);
}

test('clean-room gate accepts owned, local, unique and bounded layouts without a BLE profile', async () => {
  const { auditCleanroomPack, layoutSignature } = await import(AUDIT_MODULE);
  const pack = {
    templates: [
      originalTemplate('shangyue-gate-retail', documentWith([
        element('text', { text: '商品名称', fontSize: 3.2, bold: true }),
        element('barcode', {
          id: 'barcode-1',
          x: 2,
          y: 12,
          width: 30,
          height: 10,
          value: 'SYDEMO:A01',
          format: 'code128',
          requiresInput: true,
          requiresInputReason: 'sample-code'
        })
      ])),
      originalTemplate('shangyue-gate-warehouse', documentWith([
        element('rect', { width: 36, height: 26, lineWidth: 0.3 }),
        element('text', { x: 4, y: 5, width: 20, text: '库位区', fontSize: 4, bold: true }),
        element('qrcode', {
          id: 'qrcode-1',
          x: 27,
          y: 11,
          width: 10,
          height: 10,
          value: 'SYDEMO:W01',
          requiresInput: true,
          requiresInputReason: 'sample-code'
        })
      ]))
    ]
  };

  const report = auditCleanroomPack(pack);
  assert.equal(report.passed, true, JSON.stringify(report.issues));
  assert.equal(report.summary.templates, 2);
  assert.equal(report.summary.codesChecked, 2);
  assert.equal(report.summary.profileClaimsChecked, 0);
  assert.equal(report.summary.layoutSignatures, 2);
  assert.match(layoutSignature(pack.templates[0].document), /^[a-f0-9]{20}$/);
});

test('gate blocks competitor provenance, source ids, remote content, contacts, unsafe codes and overflow', async () => {
  const { auditCleanroomPack } = await import(AUDIT_MODULE);
  const bad = {
    id: 'niim-template-233730076',
    name: 'NIIMBOT 精臣花店',
    source: 'online-niim',
    sourceId: '233730076',
    thumbSrc: 'https://cdn.example.com/template.png',
    authorship: 'third-party',
    copyright: '© Other Vendor',
    thirdPartyAssets: true,
    verifiedProfiles: [],
    document: documentWith([
      element('text', { text: '电话：13812345678' }),
      element('qrcode', {
        x: 35,
        y: 24,
        width: 10,
        height: 10,
        value: 'https://example.com/customer'
      })
    ])
  };

  const report = auditCleanroomPack({ templates: [bad] });
  const codes = new Set(report.issues.map((issue) => issue.code));
  assert.equal(report.passed, false);
  for (const code of [
    'PROVENANCE_REQUIRED',
    'INVALID_AUTHORSHIP',
    'INVALID_COPYRIGHT',
    'THIRD_PARTY_ASSET_DECLARATION_REQUIRED',
    'THIRD_PARTY_SOURCE_ID',
    'FORBIDDEN_COMPETITOR_BRAND',
    'FORBIDDEN_THIRD_PARTY_SOURCE',
    'REMOTE_REFERENCE_FORBIDDEN',
    'REMOTE_ASSET_FORBIDDEN',
    'REAL_CONTACT_FORBIDDEN',
    'ELEMENT_OUT_OF_BOUNDS',
    'CODE_REQUIRES_INPUT'
  ]) {
    assert.ok(codes.has(code), `missing ${code}: ${JSON.stringify(report.issues)}`);
  }
  assert.equal(codes.has('PRINT_PROFILE_REQUIRED'), false);
});

test('layout fingerprint blocks text-only reskins and duplicate template ids', async () => {
  const { auditCleanroomPack, layoutSignature } = await import(AUDIT_MODULE);
  const firstDocument = documentWith([
    element('text', { text: '原文案', fontSize: 3.5, bold: true }),
    element('barcode', {
      y: 12,
      width: 30,
      height: 9,
      value: 'SYDEMO:FIRST',
      requiresInput: true
    })
  ]);
  const reskinnedDocument = JSON.parse(JSON.stringify(firstDocument));
  reskinnedDocument.elements[0].text = '只替换文案';
  reskinnedDocument.elements[1].value = 'SYDEMO:SECOND';

  assert.equal(layoutSignature(firstDocument), layoutSignature(reskinnedDocument));

  const report = auditCleanroomPack({
    templates: [
      originalTemplate('shangyue-layout-a', firstDocument),
      originalTemplate('shangyue-layout-b', reskinnedDocument),
      originalTemplate('shangyue-layout-a', documentWith([
        element('text', { x: 10, y: 10, text: '另一个布局' })
      ]))
    ]
  });
  const codes = new Set(report.issues.map((issue) => issue.code));
  assert.ok(codes.has('DUPLICATE_LAYOUT_SIGNATURE'));
  assert.ok(codes.has('DUPLICATE_TEMPLATE_ID'));
});

test('gate checks rotated bounds, known print profiles, and profile printability callbacks', async () => {
  const { auditCleanroomPack } = await import(AUDIT_MODULE);
  const template = originalTemplate(
    'shangyue-profile-check',
    documentWith([
      element('line', { x: 0, y: 6, width: 14, height: 0.5, rotation: 90 })
    ], [40, 12]),
    { verifiedProfiles: ['unknown-printer', 'd110'] }
  );
  const report = auditCleanroomPack(
    { templates: [template] },
    {
      validateProfile(document, profileId) {
        if (profileId === 'd110') throw new Error('超出打印头');
      }
    }
  );
  const codes = new Set(report.issues.map((issue) => issue.code));
  assert.ok(codes.has('ELEMENT_OUT_OF_BOUNDS'));
  assert.ok(codes.has('UNKNOWN_PRINT_PROFILE'));
  assert.ok(codes.has('PROFILE_PRINTABILITY_FAILED'));
});

test('optional model compatibility claims must be substantiated', async () => {
  const { auditCleanroomPack } = await import(AUDIT_MODULE);
  const template = originalTemplate(
    'shangyue-unverified-profile-claim',
    documentWith([element('text', { text: '与蓝牙型号无关' })]),
    { verifiedProfiles: ['b1'] }
  );

  const withoutValidator = auditCleanroomPack({ templates: [template] });
  assert.equal(withoutValidator.passed, false);
  assert.equal(withoutValidator.summary.profileClaimsChecked, 1);
  assert.ok(withoutValidator.issues.some((issue) => issue.code === 'PROFILE_CLAIM_UNVERIFIED'));

  const validated = auditCleanroomPack(
    { templates: [template] },
    { validateProfile() {} }
  );
  assert.equal(validated.passed, true, JSON.stringify(validated.issues));
});

test('CLI can audit a standalone JSON pack before it is wired into the catalog', () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'shangyue-cleanroom-'));
  const packPath = path.join(tempDirectory, 'pack.json');
  const scriptPath = path.resolve(__dirname, '..', 'scripts', 'audit-cleanroom-pack.mjs');
  const pack = {
    templates: [
      originalTemplate('shangyue-standalone-pack', documentWith([
        element('text', { text: '独立模板包', bold: true })
      ]), { verifiedProfiles: ['b1'] })
    ]
  };
  fs.writeFileSync(packPath, JSON.stringify(pack), 'utf8');
  try {
    const result = spawnSync(process.execPath, [scriptPath, packPath], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.passed, true);
    assert.equal(report.summary.profileClaimsChecked, 1);
    assert.equal(report.source.endsWith('pack.json'), true);
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});
