const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { longPressSelection } = require('../src/core/editor-gesture');

test('holding the sole selected element keeps ordinary single selection', () => {
  assert.deepEqual(longPressSelection(['a'], 'a'), { enterMulti: false, ids: ['a'] });
  assert.deepEqual(longPressSelection([], 'a'), { enterMulti: false, ids: [] });
});

test('holding a distinct second element extends selection and deduplicates the base', () => {
  assert.deepEqual(longPressSelection(['a', 'a'], 'b'), { enterMulti: true, ids: ['a', 'b'] });
});

test('canvas long-press timer uses the pure decision and only toggles multi on enterMulti', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/main.js'), 'utf8');
  assert.match(source, /longPressSelection\(drag\.longPressBaseIds, pressId\)/);
  assert.match(source, /if \(decision\.enterMulti\) \{\s*state\.multiSelect = true;/);
  assert.match(source, /drag\.tapToContent = false;/);
});
