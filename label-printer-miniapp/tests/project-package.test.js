const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mini = path.join(__dirname, '..', 'miniprogram');
const config = JSON.parse(fs.readFileSync(path.join(mini, 'app.json'), 'utf8'));
const subPackages = config.subPackages || config.subpackages || [];

test('the editor lives in its own subpackage so the main package keeps headroom', () => {
  // The main package is capped at 2 MiB and the editor is the largest page.
  assert.equal(config.pages.includes('pages/editor/index'), false);
  assert.ok(subPackages.some((pack) => pack.root === 'pkg-editor'), 'pkg-editor is declared');

  const editorPack = subPackages.find((pack) => pack.root === 'pkg-editor');
  assert.ok(editorPack.pages.includes('pages/editor/index'));
  for (const page of editorPack.pages) {
    for (const extension of ['.js', '.wxml', '.wxss', '.json']) {
      const file = path.join(mini, editorPack.root, `${page}${extension}`);
      assert.ok(fs.existsSync(file), `${pack_path(editorPack, page, extension)} is in the package`);
    }
  }
});

function pack_path(pack, page, extension) {
  return `${pack.root}/${page}${extension}`;
}

test('every subpackage page exists and nothing else reaches into another package', () => {
  for (const pack of subPackages) {
    for (const page of pack.pages) {
      assert.ok(fs.existsSync(path.join(mini, pack.root, `${page}.js`)), `${pack.root}/${page}.js`);
    }
  }
  // The home page opens the editor by its package path.
  const home = fs.readFileSync(path.join(mini, 'pages/home/index.js'), 'utf8');
  assert.match(home, /url: '\/pkg-editor\/pages\/editor\/index'/);
  assert.doesNotMatch(home, /url: '\/pages\/editor\/index'/);
});

test('the editor coordinates still point one level further out', () => {
  const editor = fs.readFileSync(path.join(mini, 'pkg-editor/pages/editor/index.js'), 'utf8');
  // A page in pkg-editor/pages/editor needs ../../../ to reach miniprogram/app.
  assert.match(editor, /require\('\.\.\/\.\.\/\.\.\/app\//);
  assert.doesNotMatch(editor, /require\('\.\.\/\.\.\/app\//);
});
