const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

async function fixture(t) {
  const tools = await import('../scripts/release-utils.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'label-release-test-'));
  const source = path.join(root, 'source');
  fs.mkdirSync(source);
  // The only deleted directory is the exact mkdtemp-created fixture root.
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { ...tools, root, source };
}

test('release outputs preserve an existing user directory and every file within it', async (t) => {
  const { root, source, reserveOutputDirectory } = await fixture(t);
  const output = path.join(root, 'output');
  fs.mkdirSync(output);
  fs.writeFileSync(path.join(output, 'user.txt'), 'keep me');
  assert.throws(() => reserveOutputDirectory(output, source), /已存在/);
  const fresh = reserveOutputDirectory(output, source, true);
  assert.notEqual(fresh, output);
  assert.equal(fs.readFileSync(path.join(output, 'user.txt'), 'utf8'), 'keep me');
});

test('release output cannot recursively copy into its own source', async (t) => {
  const { source, reserveOutputDirectory } = await fixture(t);
  assert.throws(() => reserveOutputDirectory(path.join(source, 'nested'), source), /源目录内/);
  assert.equal(fs.existsSync(path.join(source, 'nested')), false);
});

test('a directory junction cannot redirect release output back into the source', async (t) => {
  const { root, source, reserveOutputDirectory } = await fixture(t);
  const alias = path.join(root, 'source-alias');
  fs.symlinkSync(source, alias, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => reserveOutputDirectory(path.join(alias, 'nested'), source), /源目录内/);
  assert.equal(fs.existsSync(path.join(source, 'nested')), false);
});

test('release copy excludes internal assets and preserves the public source', async (t) => {
  const { root, source, reserveOutputDirectory, copyReleaseTree, isExcluded } = await fixture(t);
  fs.mkdirSync(path.join(source, 'app'));
  fs.writeFileSync(path.join(source, 'app', 'imported-templates.js'), 'private');
  fs.writeFileSync(path.join(source, 'app', 'catalog.js'), 'public');
  const output = reserveOutputDirectory(path.join(root, 'output'), source);
  copyReleaseTree(source, output);
  assert.equal(fs.existsSync(path.join(output, 'app', 'imported-templates.js')), false);
  assert.equal(fs.readFileSync(path.join(output, 'app', 'catalog.js'), 'utf8'), 'public');
  assert.equal(isExcluded('assets/online-images/a.png'), true);
  assert.equal(isExcluded('assets/online-images-other/a.png'), false);
});

test('wechat release config requires an explicit valid AppID and enables domain checks', async () => {
  const { createWechatConfig } = await import('../scripts/release-utils.mjs');
  for (const appid of ['', 'touristappid', 'wx123', '../project']) {
    assert.throws(() => createWechatConfig({}, appid), /真实/);
  }
  // Format fixture only: never persisted or used to contact WeChat.
  const source = { setting: { urlCheck: false, es6: true }, packOptions: { ignore: ['old'] } };
  const result = createWechatConfig(source, 'wx0123456789abcdef');
  assert.equal(result.setting.urlCheck, true);
  assert.equal(result.setting.es6, true);
  assert.equal(result.miniprogramRoot, 'miniprogram/');
  assert.deepEqual(result.packOptions.ignore, []);
  assert.equal(source.setting.urlCheck, false);
});

test('missing AppID fails before creating the requested output project', async (t) => {
  const { root } = await fixture(t);
  const output = path.join(root, 'must-not-exist');
  const result = spawnSync(process.execPath, [
    path.resolve(__dirname, '../scripts/prepare-wechat-release.mjs'), '--appid', 'touristappid', '--out', output
  ], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /真实/);
  assert.equal(fs.existsSync(output), false);
});

test('acceptance inventory identifies only actual font origins and excludes internal online APIs', async () => {
  const { collectAcceptanceInventory } = await import('../scripts/prepare-wechat-release.mjs');
  const report = collectAcceptanceInventory(path.resolve(__dirname, '../miniprogram'));
  assert.deepEqual(report.network.fontOrigins, ['https://cdn.jsdelivr.net']);
  assert.ok(report.network.fontFiles.length > 0);
  assert.ok(report.apiUsesToReview.some((item) => item.api === 'chooseMedia'));
  assert.ok(report.apiUsesToReview.some((item) => item.api === 'openBluetoothAdapter'));
  assert.equal(report.apiUsesToReview.some((item) => item.file.includes('authorized-template-catalog')), false);
});
