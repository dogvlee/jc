const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawnSync } = require('node:child_process');
const automator = require('miniprogram-automator');

const root = path.resolve(__dirname, '..');
const cli = process.env.WECHAT_DEVTOOLS_CLI;
if (!cli) throw new Error('请设置 WECHAT_DEVTOOLS_CLI 为微信开发者工具 CLI 路径');
const artifactRoot = path.join(root, 'artifacts', 'wechat-auth-smoke');
fs.mkdirSync(artifactRoot, { recursive: true });
const runRoot = fs.mkdtempSync(path.join(artifactRoot, 'run-'));
const projectRoot = path.join(runRoot, 'project');
fs.mkdirSync(projectRoot);
const config = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));
const report = {
  startedAt: new Date().toISOString(), status: 'running', cases: [], exceptions: [], projectRoot,
  environment: 'Isolated tourist WeChat DevTools project', library: config.libVersion,
  limitations: [
    'No real WeChat login, phone authorization, external account service, upload or publish',
    'Phone events and signed-in state are explicitly injected for UI checks only',
    'Server authentication is covered separately by HTTP integration tests',
    'Production request domains and physical devices still require acceptance'
  ]
};
let mini;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function save() {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(runRoot, 'report.json'), JSON.stringify(report, null, 2));
}
async function until(callback, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await callback();
    if (value) return value;
    await pause(200);
  }
  throw new Error(`等待超时：${label}`);
}
async function current(route) {
  return until(async () => {
    const page = await mini.currentPage();
    return page && page.path === route && page;
  }, route);
}
async function tap(page, selector) {
  const element = await until(() => page.$(selector), selector);
  await element.tap();
  await pause(150);
}
async function shot(name) {
  await pause(300);
  const file = path.join(runRoot, `${name}.png`);
  await mini.screenshot({ path: file });
  return file;
}
async function check(name, action) {
  const result = { name, status: 'running' };
  report.cases.push(result);
  try { await action(); result.status = 'passed'; console.log(`PASS ${name}`); }
  catch (error) { result.status = 'failed'; result.error = error.message; throw error; }
}
async function launch() {
  const server = net.createServer();
  const port = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => resolve(value)); });
  });
  const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `& ${quote(cli)} auto --project ${quote(projectRoot)} --auto-port ${port} --trust-project`],
  { encoding: 'utf8', windowsHide: true, timeout: 45000 });
  fs.writeFileSync(path.join(runRoot, 'devtools.log'), (result.stdout || '') + (result.stderr || ''));
  assert.equal(result.status, 0, '开发者工具启动失败，参见 devtools.log');
  return until(async () => {
    try { return await automator.connect({ wsEndpoint: `ws://127.0.0.1:${port}` }); } catch (_) { return null; }
  }, '连接开发者工具');
}
const watchdog = setTimeout(() => {
  report.status = 'failed'; report.error = '登录验收超过 180 秒'; save();
  if (mini) mini.disconnect();
  console.error(report.error); process.exit(1);
}, 180000);

(async () => {
  try {
    const bundle = spawnSync(process.execPath, [path.join(root, 'scripts/build-shangyue-release.mjs'),
      path.join(projectRoot, 'miniprogram')], { encoding: 'utf8', timeout: 30000 });
    fs.writeFileSync(path.join(runRoot, 'build.log'), (bundle.stdout || '') + (bundle.stderr || ''));
    assert.equal(bundle.status, 0, '公开包构建失败');
    fs.writeFileSync(path.join(projectRoot, 'project.config.json'), JSON.stringify({
      ...config, appid: 'touristappid', projectname: `auth-qa-${path.basename(runRoot)}`,
      miniprogramRoot: 'miniprogram/', setting: { ...config.setting, urlCheck: true },
      packOptions: { ignore: [], include: [] }
    }, null, 2));
    mini = await launch();
    // A cold connection answers Tool.getInfo before App is initialized. Do not
    // subscribe to App logging until the simulator has finished its cold start.
    await pause(17000);
    mini.on('exception', (event) => report.exceptions.push(event));
    report.system = await mini.systemInfo();
    assert.equal(report.system.platform, 'devtools');
    assert.equal(report.system.SDKVersion, config.libVersion);
    let home = await current('pages/home/index');
    let login;
    await check('首次游客进入我的和登录页', async () => {
      if (await home.data('showOnboarding')) {
        for (let i = 0; i < 3; i++) await tap(home, '.onboarding-actions .primary-button');
      }
      await tap(home, '.bottom-nav button[data-route="profile"]');
      assert.equal(await home.data('authStatus'), 'guest');
      await shot('01-profile-guest');
      await tap(home, '.profile-account-button');
      login = await current('pages/login/index');
      assert.equal(await login.data('consent'), false);
      assert.equal(await login.data('submitting'), false);
      const button = await login.$('.login-submit');
      const offset = await button.offset(); const size = await button.size();
      assert.ok(offset.left >= 0 && offset.left + size.width <= report.system.windowWidth + 1);
      assert.ok(size.height >= 43, '登录按钮触控区域小于44px');
      await shot('02-login-default');
    });
    await check('未同意不请求授权，阅读协议不改变同意状态', async () => {
      await tap(login, '.login-submit');
      assert.match(await login.data('errorText'), /请先阅读/);
      const links = await login.$$('.login-link');
      await links[1].tap();
      const legal = await current('pages/legal/index');
      assert.match(await legal.data('title'), /隐私/);
      await shot('03-privacy');
      await tap(legal, '.legal-back');
      login = await current('pages/login/index');
      assert.equal(await login.data('consent'), false);
    });
    await check('原生勾选和未配置服务按钮不请求手机号', async () => {
      await tap(login, '.login-checkbox-label');
      await until(() => login.data('consent'), '勾选协议');
      assert.equal(await login.data('serviceConfigured'), false);
      assert.ok(!(await (await login.$('.login-submit')).attribute('open-type')), '服务未配置时不能请求手机号');
      await login.callMethod('onGetPhoneNumber', { detail: { errMsg: 'getPhoneNumber:fail user deny' } });
      assert.match(await login.data('errorText'), /取消/);
      await tap(login, '.login-submit');
      assert.match(await login.data('errorText'), /暂未开通/);
      assert.equal(await login.data('submitting'), false);
      assert.equal(await login.data('authStatus'), 'guest');
      await shot('04-login-service-unconfigured');
      await tap(login, '.login-skip');
      home = await current('pages/home/index');
      assert.equal(await home.data('authStatus'), 'guest');
    });
    await check('登录后账号布局与退出提示（仅注入显示状态）', async () => {
      await mini.evaluate(() => getApp().globalData.authService.emit('authenticated', {
        id: 'test-display-account', phoneMasked: '138****8000', nickName: '商跃用户'
      }, ''));
      await until(async () => (await home.data('authStatus')) === 'authenticated', '账号显示');
      assert.equal(await home.data('accountPhone'), '138****8000');
      assert.ok(await home.$('.account-device-note'));
      await shot('05-profile-display-fixture');
      await mini.mockWxMethod('showModal', { confirm: true, cancel: false });
      try { await tap(home, '.profile-account-button'); }
      finally { await mini.restoreWxMethod('showModal'); }
      await until(async () => (await home.data('authStatus')) === 'guest', '退出账号显示');
      assert.equal(await home.data('accountPhone'), '');
    });
    await check('未观察到运行时异常', async () => assert.deepEqual(report.exceptions, []));
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.error = error.stack || error.message;
    if (mini) { try { await shot('failure'); } catch (_) {} }
    console.error(error.message);
  } finally {
    save(); clearTimeout(watchdog);
    if (mini) {
      if (report.status === 'passed') { try { await mini.close(); } catch (_) { mini.disconnect(); } }
      else mini.disconnect();
    }
    console.log(`验收记录：${path.join(runRoot, 'report.json')}`);
    process.exit(report.status === 'passed' ? 0 : 1);
  }
})();
