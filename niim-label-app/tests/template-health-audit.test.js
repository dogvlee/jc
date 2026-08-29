const test = require('node:test');
const assert = require('node:assert/strict');
const { after } = require('node:test');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const auditScript = path.join(projectRoot, 'scripts', 'audit-template-health.mjs');
const fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'niim-template-audit-'));
let fixtureSequence = 0;

after(() => {
  fs.rmSync(fixtureDirectory, { recursive: true, force: true });
});

function element(type, overrides) {
  return Object.assign({
    id: `${type}-${fixtureSequence += 1}`,
    type,
    x: 1,
    y: 1,
    width: 20,
    height: 6,
    value: type === 'text' ? '正常文字' : undefined
  }, overrides || {});
}

function writeFixture(name, value) {
  const fixturePath = path.join(fixtureDirectory, `${name}-${fixtureSequence += 1}.json`);
  fs.writeFileSync(fixturePath, typeof value === 'string' ? value : JSON.stringify(value), 'utf8');
  return fixturePath;
}

function runAudit(fixturePath, flags) {
  const result = spawnSync(process.execPath, [auditScript, fixturePath].concat(flags || []), {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024
  });
  assert.equal(result.error, undefined);
  assert.notEqual(result.stdout.trim(), '', result.stderr);
  return {
    exitCode: result.status,
    report: JSON.parse(result.stdout)
  };
}

function collection(records) {
  return {
    authorization: { status: 'operator-declared; documentary reference pending' },
    records
  };
}

test('strict audit keeps safely blocked template issues as warnings', () => {
  const warningTemplate = {
    id: 'warning-template',
    name: '安全拦截警告夹具',
    width: 300,
    height: 300,
    elements: [
      element('image', { imageUrl: '文件不存在', width: 10, height: 10 }),
      element('barcode', { codeType: 20, value: '' }),
      element('barcode', { codeType: 999, value: 'ABC' }),
      element('barcode', { codeType: 24, value: '1234567890123' }),
      element('text', { value: '双击文本框编辑' }),
      element('barcode', { codeType: 20, value: 'ABCDEFGHIJKLMN', width: 2, height: 5 }),
      element('graph', { graphType: 2, outline: 0, width: 40, height: 20 }),
      element('text', { value: '字体回退可追溯', fontFamily: 'ZT201' })
    ]
  };
  const fullyLockedTemplate = {
    id: 'fully-locked-template',
    name: '全锁定夹具',
    width: 30,
    height: 20,
    elements: [element('text', { value: '导入副本应解锁', isLock: 1 })]
  };
  const fixturePath = writeFixture('warnings', collection([
    warningTemplate,
    fullyLockedTemplate
  ]));

  const { exitCode, report } = runAudit(fixturePath, ['--strict']);
  const { summary } = report;

  assert.equal(exitCode, 0);
  assert.equal(summary.strictMode, true);
  assert.equal(summary.strictBlockerFindings, 0);
  assert.equal(summary.strictBlockerTemplates, 0);
  assert.equal(summary.authorization, 'operator-declared; documentary reference pending');
  assert.equal(summary.authorizationDocumentaryPending, true);
  assert.equal(summary.missingImageElements, 1);
  assert.equal(summary.missingImageReportedTemplates, 1);
  assert.equal(summary.emptyCodeElements, 1);
  assert.equal(summary.placeholderTextElements, 1);
  assert.equal(summary.unknownCodeTypeElements, 1);
  assert.equal(summary.invalidEanElements, 1);
  assert.equal(summary.requiresUserInputElements, 4);
  assert.equal(summary.blockedByPreflightElements, 4);
  assert.equal(summary.codeQualityWarningsBelow2Dots >= 1, true);
  assert.equal(summary.profileUnsupportedTemplates >= 1, true);
  assert.equal(summary.allSemanticLockedTemplates, 1);
  assert.equal(summary.semanticUnlockAppliedTemplates, 1);
  assert.equal(summary.fontFallbackTemplates, 1);
  assert.equal(summary.runtimeUnsupportedFontElements, 0);
  assert.equal(summary.falseBlackFillElements, 0);
});

test('strict audit fails on actual schema corruption', () => {
  const fixturePath = writeFixture('corrupt-data', collection([{
    id: 'bad-dimension',
    name: '损坏尺寸夹具',
    width: '不是数字',
    height: 20,
    elements: [element('text', { value: '仍可被导入器兜底，但源数据已损坏' })]
  }]));

  const { exitCode, report } = runAudit(fixturePath, ['--strict']);

  assert.equal(exitCode, 1);
  assert.equal(report.summary.parseErrors, 0);
  assert.equal(report.summary.dataCorruptionTemplates, 1);
  assert.equal(report.summary.dataCorruptionFindings, 1);
  assert.equal(report.summary.strictBlockerTemplates, 1);
  assert.equal(report.summary.strictBlockerFindings, 1);
});

test('malformed JSON is a parse failure with exit code 2', () => {
  const fixturePath = writeFixture('parse-error', '{not-json');
  const { exitCode, report } = runAudit(fixturePath);

  assert.equal(exitCode, 2);
  assert.equal(report.summary.parseErrors, 1);
  assert.equal(report.summary.importErrors, 0);
  assert.equal(report.summary.strictBlockerFindings, 1);
});
