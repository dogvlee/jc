const test = require('node:test');
const assert = require('node:assert/strict');

const {
  importNiimTemplate,
  tableCellText
} = require('../src/core/niim-template-import');
const {
  ONLINE_TEMPLATES,
  buildOnlineDocument
} = require('../src/app/online-templates-pack');
const { validateDocument } = require('../src/core/renderer');
const {
  HOLLOW_RECT_IDS,
  LINE_ELEMENT_FIXES,
  UNLOCK_ELEMENT_IDS,
  applyOnlineTemplateRuntimeFixes
} = require('../src/app/online-template-runtime-fixes');

test('NIIM rectangle fill accepts only explicit true or numeric 1', () => {
  const { document } = importNiimTemplate({
    width: 40,
    height: 30,
    elements: [
      { type: 'rect', x: 0, y: 0, width: 4, height: 4, fill: { color: '#000000' } },
      { type: 'rect', x: 4, y: 0, width: 4, height: 4, fill: '#000000' },
      { type: 'rect', x: 8, y: 0, width: 4, height: 4, fill: 'true' },
      { type: 'rect', x: 12, y: 0, width: 4, height: 4, filled: false },
      { type: 'rect', x: 16, y: 0, width: 4, height: 4, fill: true },
      { type: 'rect', x: 20, y: 0, width: 4, height: 4, fill: 1 },
      { type: 'rect', x: 24, y: 0, width: 4, height: 4, filled: true },
      { type: 'rect', x: 28, y: 0, width: 4, height: 4, filled: 1 }
    ]
  });

  assert.deepEqual(
    document.elements.map((element) => element.filled),
    [false, false, false, false, true, true, true, true]
  );
});

test('NIIM table cells extract visible object fields without object coercion', () => {
  const cells = [
    { text: '文本' },
    { value: '值' },
    { content: { label: '嵌套内容' } },
    { name: '名称' },
    { label: '标签' },
    { data: { title: '包装标题' } },
    { text: '', value: 0 },
    {}
  ];
  const { document } = importNiimTemplate({
    width: 40,
    height: 30,
    elements: [{
      type: 'table',
      x: 1,
      y: 1,
      width: 38,
      height: 20,
      rows: 2,
      columns: 4,
      cells
    }]
  });

  assert.deepEqual(
    document.elements[0].cells,
    ['文本', '值', '嵌套内容', '名称', '标签', '包装标题', '0', '']
  );
  assert.equal(tableCellText({ payload: { contentTitle: '内容标题' } }), '内容标题');
  assert.ok(document.elements[0].cells.every((cell) => cell !== '[object Object]'));
});

test('ten known generated outline rectangles are repaired only in built clones', () => {
  assert.equal(Object.keys(HOLLOW_RECT_IDS).length, 10);
  for (const [templateId, rectIds] of Object.entries(HOLLOW_RECT_IDS)) {
    const packed = ONLINE_TEMPLATES.find((item) => item.id === templateId);
    assert.ok(packed, templateId);
    const packedBefore = JSON.stringify(packed);
    const built = buildOnlineDocument(templateId);
    for (const rectId of rectIds) {
      assert.equal(
        packed.document.elements.find((element) => element.id === rectId).filled,
        true,
        `${templateId}/${rectId} keeps the generated source`
      );
      assert.equal(
        built.elements.find((element) => element.id === rectId).filled,
        false,
        `${templateId}/${rectId}`
      );
    }
    assert.equal(JSON.stringify(packed), packedBefore, `${templateId} source/provenance is unchanged`);
    assert.deepEqual(built.templateMeta, packed.document.templateMeta);
  }

  const unrelated = {
    elements: [{ id: 'rect-mskgxb89-23', type: 'rect', filled: true }]
  };
  applyOnlineTemplateRuntimeFixes('online-unrelated', unrelated);
  assert.equal(unrelated.elements[0].filled, true);
});

test('known reagent table and after-sales placeholder are repaired at build time', () => {
  const reagent = buildOnlineDocument('online-515326439');
  const table = reagent.elements.find((element) => element.id === 'table-mskgxb9a-811');
  assert.deepEqual(table.cells, ['试剂名称', '氯化钠溶液', '保存位置', '1号柜']);
  assert.ok(table.cells.every((cell) => cell !== '[object Object]'));

  const receipt = buildOnlineDocument('online-477823830');
  assert.equal(receipt.elements.some((element) => element.id === 'text-mskgxb8m-272'), false);
  assert.equal(receipt.elements.some((element) => element.text === '双击编辑'), false);

  const editedPlaceholder = {
    elements: [{ id: 'text-mskgxb8m-272', type: 'text', text: '客户自定义内容' }]
  };
  applyOnlineTemplateRuntimeFixes('online-477823830', editedPlaceholder);
  assert.equal(editedPlaceholder.elements.length, 1);
});

test('known editable New Year title is unlocked only in the built clone', () => {
  assert.deepEqual(UNLOCK_ELEMENT_IDS, {
    'online-438734081': ['text-mskgxb8g-182']
  });
  const packed = ONLINE_TEMPLATES.find((item) => item.id === 'online-438734081');
  const packedTitle = packed.document.elements.find((element) => element.id === 'text-mskgxb8g-182');
  const builtTitle = buildOnlineDocument('online-438734081').elements
    .find((element) => element.id === 'text-mskgxb8g-182');
  assert.equal(packedTitle.locked, true, 'generated source remains reproducible');
  assert.equal(builtTitle.locked, false, 'title can be selected and edited');

  const unrelated = {
    elements: [{ id: 'text-mskgxb8g-182', type: 'text', locked: true }]
  };
  applyOnlineTemplateRuntimeFixes('online-unrelated', unrelated);
  assert.equal(unrelated.elements[0].locked, true);
});

function rotatedInkBounds(element) {
  const radians = Number(element.rotation || 0) * Math.PI / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  const projectedWidth = cosine * element.width + sine * element.height;
  const projectedHeight = sine * element.width + cosine * element.height;
  const centerX = element.x + element.width / 2;
  const centerY = element.y + element.height / 2;
  const stroke = Number(element.lineWidth || 0) / 2;
  return {
    left: centerX - projectedWidth / 2 - stroke,
    right: centerX + projectedWidth / 2 + stroke,
    top: centerY - projectedHeight / 2 - stroke,
    bottom: centerY + projectedHeight / 2 + stroke
  };
}

test('two known rotated divider lines keep their visible ink inside the label', () => {
  for (const [templateId, elementFixes] of Object.entries(LINE_ELEMENT_FIXES)) {
    const document = buildOnlineDocument(templateId);
    for (const lineId of Object.keys(elementFixes)) {
      const line = document.elements.find((element) => element.id === lineId);
      assert.ok(line, `${templateId}/${lineId}`);
      const bounds = rotatedInkBounds(line);
      assert.ok(bounds.left >= 0, `${templateId} left ${bounds.left}`);
      assert.ok(bounds.top >= 0, `${templateId} top ${bounds.top}`);
      assert.ok(bounds.right <= document.widthMm, `${templateId} right ${bounds.right}`);
      assert.ok(bounds.bottom <= document.heightMm, `${templateId} bottom ${bounds.bottom}`);
    }
  }
});

test('runtime repairs preserve template source and copyright metadata', () => {
  const ids = [
    ...Object.keys(HOLLOW_RECT_IDS),
    'online-515326439',
    'online-477823830',
    ...Object.keys(UNLOCK_ELEMENT_IDS),
    ...Object.keys(LINE_ELEMENT_FIXES)
  ];
  for (const id of new Set(ids)) {
    const item = ONLINE_TEMPLATES.find((template) => template.id === id);
    const before = {
      source: item.source,
      sourceMeta: JSON.parse(JSON.stringify(item.sourceMeta)),
      templateMeta: JSON.parse(JSON.stringify(item.document.templateMeta))
    };
    const built = buildOnlineDocument(id);
    assert.equal(item.source, before.source, id);
    assert.deepEqual(item.sourceMeta, before.sourceMeta, id);
    assert.deepEqual(item.document.templateMeta, before.templateMeta, id);
    assert.deepEqual(built.templateMeta, before.templateMeta, id);
  }
});

test('built online working copies require confirmation for generic codes without mutating the pack', () => {
  for (const id of ['online-515326442', 'online-515326445']) {
    const packed = ONLINE_TEMPLATES.find((item) => item.id === id);
    const packedCode = packed.document.elements.find((element) => element.type === 'barcode' || element.type === 'qrcode');
    const original = JSON.stringify(packed);
    const built = buildOnlineDocument(id);
    const builtCode = built.elements.find((element) => element.id === packedCode.id);
    assert.equal(packedCode.requiresInput, undefined);
    assert.equal(builtCode.requiresInput, true);
    assert.equal(builtCode.requiresInputReason, 'sample-code');
    assert.throws(() => validateDocument(built, 203), (error) => error.code === 'CODE_INPUT_REQUIRED');
    assert.equal(JSON.stringify(packed), original);
  }
});
