const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MIN_CODE_DOTS_PER_MODULE,
  codePrintMetrics,
  resizeCodeElementToMinimum,
  validateCodeElement
} = require('../miniprogram/core/code-quality');

test('barcode preflight requires two printer dots per module and gives a usable width', () => {
  const element = { id: 'code-a', type: 'barcode', format: 'code128', value: '1234567890', width: 10 };
  const metrics = codePrintMetrics(element, 203);
  assert.equal(metrics.minimumDotsPerModule, MIN_CODE_DOTS_PER_MODULE);
  assert.equal(metrics.ok, false);
  element.width = metrics.minimumMmRounded;
  assert.doesNotThrow(() => validateCodeElement(element, 203));

  element.width = metrics.minimumMm - 0.1;
  assert.throws(() => validateCodeElement(element, 203), (error) => {
    assert.equal(error.code, 'CODE_MODULE_DENSITY_LOW');
    assert.equal(error.elementId, 'code-a');
    assert.match(error.message, /2 打印点\/模块/);
    assert.match(error.message, /宽度至少/);
    return true;
  });
});

test('QR preflight counts the four-module quiet zone on every side', () => {
  const element = { id: 'qr-a', type: 'qrcode', value: '中文标签', width: 5, height: 5 };
  const metrics = codePrintMetrics(element, 203);
  assert.equal(metrics.ok, false);
  element.width = metrics.minimumMmRounded;
  element.height = metrics.minimumMmRounded;
  assert.doesNotThrow(() => validateCodeElement(element, 203));
});

test('invalid code content retains the source element id for editor focus', () => {
  assert.throws(() => validateCodeElement({
    id: 'ean-bad', type: 'barcode', format: 'ean13', value: '123'
  }, 203), (error) => {
    assert.equal(error.code, 'INVALID_CODE_CONTENT');
    assert.equal(error.elementId, 'ean-bad');
    assert.match(error.message, /12 或 13 位/);
    return true;
  });
});

test('empty and explicitly required code content is blocked before encoding', () => {
  for (const element of [
    { id: 'empty-barcode', type: 'barcode', format: 'code128', value: '' },
    { id: 'bound-qr', type: 'qrcode', value: '示例', requiresInput: true }
  ]) {
    assert.throws(() => validateCodeElement(element, 203), (error) => {
      assert.equal(error.code, 'CODE_INPUT_REQUIRED');
      assert.equal(error.elementId, element.id);
      assert.match(error.message, /请先填写/);
      return true;
    });
  }
});

test('unsupported source symbology and retained EAN errors use actionable blockers', () => {
  assert.throws(() => validateCodeElement({
    id: 'unknown-16', type: 'barcode', format: 'unsupported', value: 'ABC',
    sourceCodeType: 16, declaredFormat: 'codeType-16', unsupportedCodeType: true,
    requiresFormatConfirmation: true
  }, 203), (error) => {
    assert.equal(error.code, 'UNSUPPORTED_CODE_TYPE');
    assert.equal(error.elementId, 'unknown-16');
    assert.match(error.message, /明确选择 Code128 或 EAN-13/);
    return true;
  });

  assert.throws(() => validateCodeElement({
    id: 'ean-checksum', type: 'barcode', format: 'ean13', value: '4006381333932',
    invalidCode: true, codeValidationMessage: 'EAN-13 校验位应为 1'
  }, 203), (error) => {
    assert.equal(error.code, 'INVALID_CODE_CONTENT');
    assert.match(error.message, /校验位应为 1/);
    return true;
  });
});

test('explicit code repair only resizes when the minimum box fits the label', () => {
  const document = { widthMm: 50, heightMm: 30 };
  const element = {
    id: 'repairable', type: 'barcode', format: 'code128', value: '1234567890',
    x: 5, y: 10, width: 20, height: 8, rotation: 0
  };
  const result = resizeCodeElementToMinimum(element, document, 203);
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.doesNotThrow(() => validateCodeElement(element, 203));
  assert.ok(element.x >= 0 && element.x + element.width <= document.widthMm);

  const impossible = { ...element, id: 'too-long', value: 'A'.repeat(40), width: 5 };
  const before = { ...impossible };
  const blocked = resizeCodeElementToMinimum(impossible, document, 203);
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /当前标签放不下/);
  assert.deepEqual(impossible, before);
});
