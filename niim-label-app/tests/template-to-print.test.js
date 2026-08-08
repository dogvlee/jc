const test = require('node:test');
const assert = require('node:assert/strict');

// state.js reads settings/projects through services/store on demand.
const memory = new Map();
global.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key)
};

const { templates } = require('../src/app/catalog');
const { buildTemplateDocument } = require('../src/app/template-layouts');
const { initialState, openDocument } = require('../src/app/state');
const { propertyPanel, renderMain, renderModal } = require('../src/app/views');

function freshState() {
  memory.clear();
  return initialState();
}

function openTemplate(state, id) {
  openDocument(state, buildTemplateDocument(templates.find((item) => item.id === id)));
  return state;
}

test('every template lands in an editor that still shows 保存 / 打印', () => {
  for (const template of templates) {
    const state = openTemplate(freshState(), template.id);
    // openDocument selects first element on style (or content for date/serial) so 保存/打印 stay visible
    if (state.document.elements.length) {
      assert.ok(state.selectedId, `${template.id} should select first element`);
      assert.equal(state.editorMode, 'selected');
    } else {
      assert.equal(state.selectedId, '');
      assert.equal(state.editorMode, 'add');
    }

    const panel = propertyPanel(state);
    assert.ok(panel.includes('data-action="open-print"'), `${template.id} lost the print button on landing`);
    assert.ok(panel.includes('data-action="save-project"'), `${template.id} lost the save button on landing`);
  }
});

test('a label the current model cannot print still opens the print sheet with a way out', () => {
  const state = openTemplate(freshState(), 'product-simple'); // 40x30
  state.settings.defaultProfileId = 'd110'; // 12mm printhead — cannot take 30mm
  state.modal = 'print';
  state.printBlock = {
    kind: 'size',
    message: '当前机型打印高度最多约 12.0 mm',
    suggestProfileId: 'b1'
  };

  const markup = renderModal(state);
  assert.ok(markup.includes('print-notice blocked'), 'blocked print should explain itself in the sheet');
  assert.ok(markup.includes('data-action="apply-suggested-profile"'), 'should offer a model that can print it');
  assert.ok(markup.includes('data-action="open-stock-sheet"'), 'should offer changing the stock');
  // The model picker lives in this sheet, so the sheet must never be withheld.
  assert.ok(markup.includes('id="print-profile"'));
});

test('the print sheet cannot be dismissed while printing, and offers a stop', () => {
  const state = openTemplate(freshState(), 'product-simple');
  state.modal = 'print';
  state.printing = true;
  state.printProgress = 40;
  state.printMessage = '正在传输';

  const markup = renderModal(state);
  assert.ok(markup.includes('data-action="cancel-print"'), 'printing must be stoppable');
  assert.ok(
    markup.includes('<div class="sheet-backdrop"></div>'),
    'the backdrop must not close the sheet mid-print'
  );

  state.printing = false;
  assert.ok(renderModal(state).includes('<div class="sheet-backdrop" data-action="close-modal"></div>'));
});

test('a failed print keeps its reason and a retry on screen', () => {
  const state = openTemplate(freshState(), 'product-simple');
  state.modal = 'print';
  state.printError = { message: '打印机连接已断开，请靠近后重新连接再试' };

  const markup = renderModal(state);
  assert.ok(markup.includes('print-notice failed'));
  assert.ok(markup.includes('打印机连接已断开'));
  assert.ok(markup.includes('data-action="retry-print"'));
});

test('an over-filtered template library offers one button that restores everything', () => {
  const state = freshState();
  state.route = 'templates';
  state.templateCategory = '零售';
  state.templateIndustry = '实用功能';
  state.templateQuery = '防水';

  const markup = renderMain(state);
  assert.ok(markup.includes('没有模板'), 'the combination should genuinely be empty');
  assert.ok(markup.includes('data-action="reset-template-filters"'), 'the only exit must clear every filter');
  // The user should be able to see which filters produced the empty screen.
  assert.ok(markup.includes('零售') && markup.includes('实用功能') && markup.includes('防水'));
});

test('the template library reports how much of the catalog a filter is hiding', () => {
  const state = freshState();
  state.route = 'templates';
  assert.ok(renderMain(state).includes('个可用'));

  state.templateCategory = '零售';
  const filtered = renderMain(state);
  assert.match(filtered, /筛选出 \d+ \/ \d+ 个/);
});
