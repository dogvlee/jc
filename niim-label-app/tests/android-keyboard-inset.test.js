const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('Android IME inset is bridged into the compact content panel offset', () => {
  const activity = read('android/app/src/main/java/com/jc/niimlabel/MainActivity.java');
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const main = read('src/app/main.js');
  const styles = read('src/styles.css');

  assert.match(manifest, /android:windowSoftInputMode="adjustNothing"/);
  assert.match(activity, /WindowInsetsCompat\.Type\.ime\(\)/);
  assert.match(activity, /window\.__niimSetKeyboardInset/);
  assert.match(activity, /imeBottomPx \/ density/);
  assert.match(main, /Math\.max\(viewportInset, nativeKbInset\)/);
  assert.match(main, /window\.__niimSetKeyboardInset =/);
  assert.match(styles, /margin-bottom:\s*var\(--kb-inset, 0px\)/);
});
