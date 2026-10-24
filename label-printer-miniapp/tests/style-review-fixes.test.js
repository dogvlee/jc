const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mini = path.join(__dirname, '..', 'miniprogram');
const read = (file) => fs.readFileSync(path.join(mini, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const app = read('app.wxss');
const editor = read('pkg-editor/pages/editor/index.wxss');
const picker = read('components/printer-picker/index.wxss');
const home = read('pages/home/index.wxss');

// Body of the first rule whose whole selector list is `selector`.
function rule(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const match = source.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `missing ${selector}`);
  return match[1];
}

function value(body, property) {
  const match = body.match(new RegExp(`(?:^|[;\\s])${property}:\\s*([^;]+);`));
  assert.ok(match, `missing ${property}`);
  return match[1].trim();
}

const rpx = (text) => Number(String(text).replace('rpx', ''));

test('app.wxss defines the readable small size and the text colours for success and warning', () => {
  const tokens = app.match(/(?:^|\n)page\s*\{([^}]*)\}/)[1];
  assert.match(tokens, /--font-small:\s*22rpx;/);
  assert.match(tokens, /--color-success-text:\s*#137A4A;/i);
  assert.match(tokens, /--color-warning-text:\s*#8A5200;/i);
  assert.match(tokens, /--color-text-4:\s*#6B7079;/i);
  assert.match(tokens, /--color-stage:\s*#EEF0F3;/i);
});

test('sheet close buttons keep a 60rpx circle inside an 88rpx touch target', () => {
  const body = rule(app, 'button.close-button,\nbutton.sheet-close');
  assert.equal(value(body, 'width'), '88rpx');
  assert.equal(value(body, 'height'), '88rpx');
  assert.equal(value(body, 'padding'), '14rpx');
  assert.equal(value(body, 'background-clip'), 'content-box');
  assert.equal(88 - 2 * 14, 60);
});

test('small buttons and text buttons are tall enough to tap', () => {
  assert.equal(value(rule(app, '.primary-small,\n.btn-s'), 'min-height'), '64rpx');
  assert.equal(value(rule(app, '.text-button'), 'min-height'), '72rpx');
});

test('the editor toolbar has 80 x 88rpx buttons that still fit beside the capsule on a 375px phone', () => {
  const button = rule(editor, 'button.icon-button');
  assert.equal(value(button, 'height'), '88rpx');
  assert.equal(value(button, 'flex'), '0 1 80rpx');
  assert.equal(value(button, 'min-width'), '64rpx');
  const history = rule(editor, '.history-actions');
  assert.equal(value(history, 'margin-left'), '24rpx', '关闭 stays clear of 撤销');
  assert.equal(value(history, 'gap'), '8rpx');
  assert.equal(value(rule(editor, '.header-main > .icon-button + .icon-button'), 'margin-left'), '8rpx');

  // 375px phone: the capsule starts at 280px and the header keeps 8px clear
  // of it (headerRightInset = 103px); 1rpx = 0.5px.
  const available = (375 - 103) * 2 - rpx(value(rule(editor, '.header-main'), 'padding-left'));
  const needed = 6 * 80 + 24 + 8 + 8 + 8;
  assert.ok(needed <= available, `${needed}rpx of ${available}rpx`);
  // 320px phone: the buttons may shrink to 64rpx and must still fit.
  const narrow = Math.floor((320 - 102) / (320 / 750)) - rpx(value(rule(editor, '.header-main'), 'padding-left'));
  assert.ok(6 * 64 + 24 + 8 + 8 + 8 <= narrow);
});

test('inspector actions and steppers are 72rpx tall', () => {
  const actions = rule(editor, '.compact-actions');
  assert.equal(value(actions, 'gap'), '12rpx');
  assert.equal(value(rule(editor, '.compact-actions button'), 'height'), '72rpx');
  const stepper = rule(editor, '.stepper-row button,\n.stepper button');
  assert.equal(value(stepper, 'width'), '72rpx');
  assert.equal(value(stepper, 'height'), '72rpx');
  const copies = rule(editor, '.copies-input');
  assert.equal(value(copies, 'width'), '120rpx');
  assert.equal(value(copies, 'height'), '72rpx');
});

test('words people read are never set below 22rpx, and only through tokens', () => {
  for (const [file, source] of [['editor', editor], ['picker', picker]]) {
    for (const match of source.matchAll(/font-size:\s*(\d+)rpx/g)) {
      assert.ok(Number(match[1]) >= 24, `${file} hard-codes font-size ${match[1]}rpx`);
    }
  }
  // --font-tiny is for corner badges only.
  const tiny = [...editor.matchAll(/([^{}]+)\{[^}]*var\(--font-tiny\)/g)].map((match) => match[1].trim());
  assert.deepEqual(tiny, ['.asset-vip']);
  assert.equal(value(rule(editor, '.progress-card'), 'font-size'), '26rpx');
  assert.equal(value(rule(editor, '.progress-card'), 'color'), 'var(--color-text-2)');
});

test('readable text does not use the faintest grey, and coloured words use their text colours', () => {
  const faint = [...editor.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter((match) => /(?:^|[;\s])color:\s*var\(--color-text-4\)/.test(match[2]))
    .map((match) => match[1].trim());
  // Only the pencil icon beside the label name.
  assert.deepEqual(faint, ['.document-name']);
  assert.equal(value(rule(editor, '.connection-status.connected'), 'color'), 'var(--color-success-text)');
  assert.equal(value(rule(editor, '.connection-status.connecting'), 'color'), 'var(--color-warning-text)');
  assert.equal(value(rule(editor, '.template-attention'), 'color'), 'var(--color-warning-text)');
  assert.equal(value(rule(picker, '.connected-card'), 'color'), 'var(--color-success-text)');
  assert.equal(value(rule(home, '.history-status.success'), 'color'), 'var(--color-success-text)');
  assert.equal(value(rule(picker, '.device-meta'), 'color'), 'var(--color-text-3)');
});

test('red words on the soft red fills use the pressed red', () => {
  for (const [source, selector] of [
    [app, '.danger-button,\n.danger-outline'],
    [app, '.chip.active'],
    [editor, '.error-card'],
    [editor, 'button.draft-save-status.error'],
    [editor, '.layer-actions .danger-text'],
    [editor, 'button.layer-item.active'],
    [editor, '.style-actions button.active'],
    [picker, '.device-item.connecting .device-status'],
    [home, '.template-badge'],
    [home, '.scan-cta'],
    [home, '.history-status.failed,\n.history-status.error']
  ]) {
    assert.equal(value(rule(source, selector), 'color'), 'var(--color-primary-pressed)', selector);
  }
});

test('the editor uses the shared gutter and stage token', () => {
  assert.equal(value(rule(editor, 'page'), 'background'), 'var(--color-stage)');
  assert.match(value(rule(editor, '.canvas-stage'), 'padding'), /var\(--gutter\)/);
  assert.equal(value(rule(editor, '.canvas-stage'), 'background-color'), 'var(--color-stage)');
  assert.doesNotMatch(editor, /#EEF0F3/i);
});

test('the print sheet is a column whose scrolling middle can give way', () => {
  const sheet = rule(editor, '.print-sheet');
  assert.equal(value(sheet, 'display'), 'flex');
  assert.equal(value(sheet, 'flex-direction'), 'column');
  const scroll = rule(editor, '.print-scroll');
  assert.equal(value(scroll, 'flex'), '0 1 auto');
  assert.equal(value(scroll, 'min-height'), '0');
});

test('the selection tip wraps instead of running past its pill', () => {
  const tip = rule(editor, '.selection-tip');
  assert.equal(value(tip, 'width'), 'max-content');
  assert.match(value(tip, 'max-width'), /calc\(100% - 2 \* var\(--gutter\)\)/);
  assert.doesNotMatch(tip, /white-space:\s*nowrap/);
});

test('the hero buttons keep their look but reach the 44px touch target', () => {
  const home = read('pages/home/index.wxss');
  const circle = rule(home, 'button.circle-button');
  assert.equal(value(circle, 'width'), '64rpx', 'the plate keeps the header rhythm');
  assert.equal(value(circle, 'position'), 'relative');
  // 64rpx plate + 12rpx of transparent growth on each side = 88rpx (44px).
  const ring = rule(home, 'button.circle-button::after');
  assert.equal(value(ring, 'top'), '-12rpx');
  assert.equal(value(ring, 'left'), '-12rpx');
  const pill = rule(home, 'button.device-pill');
  assert.equal(value(pill, 'min-height'), '64rpx');
  const pillRing = rule(home, 'button.device-pill::after');
  assert.equal(value(pillRing, 'top'), '-12rpx');
  assert.equal(Number(value(pill, 'min-height').replace('rpx', '')) + 2 * 12, 88);
});
