const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const net = require('node:net');
const crypto = require('node:crypto');
const automator = require('miniprogram-automator');
// Reuse the locked SDK's image decoder on local PNG buffers only.
const Jimp = require(require.resolve('jimp', { paths: [path.dirname(require.resolve('miniprogram-automator'))] }));

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index += 2) {
  if (!['--cli', '--lib'].includes(args[index]) || !args[index + 1] || args[index + 1].startsWith('--')) {
    throw new Error('参数格式：--cli <微信 CLI 路径> --lib <明确的 x.y.z 基础库版本>');
  }
}
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
const cliPath = option('--cli', process.env.WECHAT_DEVTOOLS_CLI);
if (!cliPath) throw new Error('请通过 --cli 或 WECHAT_DEVTOOLS_CLI 指定微信开发者工具 cli.bat / cli');
let requestedLibrary = option('--lib');
if (requestedLibrary && !/^\d+\.\d+\.\d+$/.test(requestedLibrary)) {
  throw new Error('--lib 必须为明确的 x.y.z 版本，不接受 latest 等别名');
}
const artifactsRoot = path.join(root, 'artifacts', 'wechat-smoke');
fs.mkdirSync(artifactsRoot, { recursive: true });
const runRoot = fs.mkdtempSync(path.join(artifactsRoot, 'run-'));
const projectRoot = path.join(runRoot, 'project');
fs.mkdirSync(projectRoot);
const report = {
  startedAt: new Date().toISOString(), environment: 'WeChat DevTools simulator / isolated tourist project',
  requestedLibrary, projectRoot, status: 'running', cases: [], exceptions: [], consoleEvents: [],
  exceptionObservation: 'After automation connection; startup output is recorded separately in devtools.log',
  limitations: ['No physical printer or mobile permission validation', 'Tourist AppID does not validate production domain or publishing permissions', 'No upload or publish performed']
};
function prepare() {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));
  requestedLibrary = requestedLibrary || config.libVersion;
  assert.match(requestedLibrary, /^\d+\.\d+\.\d+$/, '基础库必须指定明确的 x.y.z 版本');
  report.requestedLibrary = requestedLibrary;
  const bundle = spawnSync(process.execPath, [path.join(root, 'scripts', 'build-shangyue-release.mjs'), path.join(projectRoot, 'miniprogram')], { encoding: 'utf8', timeout: 30000 });
  fs.writeFileSync(path.join(runRoot, 'build.log'), (bundle.stdout || '') + (bundle.stderr || '') + (bundle.error ? bundle.error.message : ''));
  if (bundle.status !== 0) throw new Error(`公开包构建失败，请查看 ${runRoot}/build.log`);
  fs.writeFileSync(path.join(projectRoot, 'project.config.json'), JSON.stringify({
    ...config, appid: 'touristappid', projectname: `shangyue-qa-${path.basename(runRoot)}`,
    libVersion: requestedLibrary, miniprogramRoot: 'miniprogram/',
    setting: { ...config.setting, urlCheck: true }, packOptions: { ignore: [], include: [] }
  }, null, 2));

  const bundleRoot = path.join(projectRoot, 'miniprogram');
  const files = [];
  function listFiles(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) listFiles(file);
      else files.push(path.relative(bundleRoot, file).replaceAll('\\', '/'));
    }
  }
  listFiles(bundleRoot);
  const fingerprint = crypto.createHash('sha256');
  let bytes = 0;
  for (const relative of files.sort()) {
    const content = fs.readFileSync(path.join(bundleRoot, relative));
    fingerprint.update(relative + '\0').update(content).update('\0');
    bytes += content.length;
  }
  report.bundle = { files: files.length, bytes, sha256: fingerprint.digest('hex') };
  const toolManifest = path.join(path.dirname(cliPath), 'resources', 'app.asar.unpacked', 'package.json');
  if (fs.existsSync(toolManifest)) report.devtoolsVersion = JSON.parse(fs.readFileSync(toolManifest, 'utf8')).version;
}
let mini;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function withTimeout(promise, milliseconds, label) {
  let timer;
  // A call that loses the race can still reject later (DevTools answers with its
  // own timeout); that late rejection must not crash the run before the report
  // is saved.
  Promise.resolve(promise).catch(() => undefined);
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`调用超时：${label}`)), milliseconds); })
  ]).finally(() => clearTimeout(timer));
}
function saveReport() {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(runRoot, 'report.json'), JSON.stringify(report, null, 2));
}
async function until(callback, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    let value;
    try {
      value = await withTimeout(Promise.resolve().then(callback), Math.min(5000, Math.max(1, deadline - Date.now())), label);
    } catch (error) {
      // A slow simulator answer (cold start) is "not yet"; the deadline decides.
      if (!/^调用超时：/.test(error.message) || Date.now() >= deadline) throw error;
    }
    if (value) return value;
    await sleep(150);
  }
  throw new Error(`等待超时：${label}`);
}
async function current(route, timeout) {
  return until(async () => {
    const page = await mini.currentPage();
    return page && page.path === route && page;
  }, route, timeout);
}
async function tap(page, selector) {
  const element = await until(() => page.$(selector), selector);
  await element.tap();
  await sleep(100);
}
async function shot(name) {
  await sleep(250);
  const file = path.join(runRoot, `${name}.png`);
  await mini.screenshot({ path: file });
  return file;
}
async function check(name, action) {
  const entry = { name, status: 'running' };
  report.cases.push(entry);
  try { await action(); entry.status = 'passed'; console.log(`PASS ${name}`); }
  catch (error) { entry.status = 'failed'; entry.error = error.message; throw error; }
}
async function launch() {
  if (process.platform !== 'win32') {
    return automator.launch({ cliPath, projectPath: projectRoot, timeout: 60000, trustProject: true });
  }
  // Current Node versions do not spawn .bat files directly. Invoke the
  // supported CLI through PowerShell, with literal quoting for every path.
  const server = net.createServer();
  const port = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const value = server.address().port;
      server.close(() => resolve(value));
    });
  });
  const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
  report.automationPort = port;
  const command = `& ${quote(cliPath)} auto --project ${quote(projectRoot)} --auto-port ${port} --trust-project`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
    encoding: 'utf8', windowsHide: true, timeout: 45000
  });
  fs.writeFileSync(path.join(runRoot, 'devtools.log'), (result.stdout || '') + (result.stderr || ''));
  if (result.status !== 0) throw new Error(`微信 CLI 启动失败，请查看 ${runRoot}/devtools.log`);
  return until(async () => {
    try { return await automator.connect({ wsEndpoint: `ws://127.0.0.1:${port}` }); }
    catch (_) { return null; }
  }, '连接微信模拟器', 30000);
}
async function fit(page, selector, width) {
  const elements = await page.$$(selector);
  assert.ok(elements.length, `未找到 ${selector}`);
  for (const element of elements) {
    const size = await element.size();
    const offset = await element.offset();
    assert.ok(size.width > 0 && offset.left >= -1 && offset.left + size.width <= width + 1,
      `${selector} 横向溢出: left=${offset.left}, width=${size.width}, viewport=${width}`);
  }
}
async function editText(page, value) {
  const element = await until(() => page.$('textarea[data-field="text"]'), '文本输入框');
  await element.trigger('focus', {});
  await element.input(value);
  await element.trigger('blur', { value });
  await until(async () => (await page.data('selected.text')) === value, '文本更新');
}
async function canvasGeometry(page, stage) {
  const document = await page.data('document');
  const paper = await page.$('.paper-shell');
  const canvas = await page.$('.label-canvas');
  const selection = await page.$('.selection-canvas');
  const metrics = {
    stage, document: { widthMm: document.widthMm, heightMm: document.heightMm },
    paper: await paper.size(), paperOffset: await paper.offset(), canvas: await canvas.size(), selection: await selection.size(),
    runtime: await mini.evaluate(() => {
      const pages = getCurrentPages();
      const editor = pages[pages.length - 1];
      const width = editor.canvas.width;
      const height = editor.canvas.height;
      const pixels = editor.canvas.getContext('2d').getImageData(0, 0, width, height).data;
      let left = width, top = height, right = -1, bottom = -1;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4;
          if (pixels[index] < 90 && pixels[index + 1] < 90 && pixels[index + 2] < 90 && pixels[index + 3] > 200) {
            left = Math.min(left, x); top = Math.min(top, y);
            right = Math.max(right, x); bottom = Math.max(bottom, y);
          }
        }
      }
      return { canvasSize: editor.canvasSize, canvasRect: editor.canvasRect, previewDpi: editor.previewDpi,
        backing: { width, height }, ink: right < 0 ? null : {
          left: left / width, top: top / height, right: (right + 1) / width, bottom: (bottom + 1) / height
        } };
    })
  };
  report.canvases = (report.canvases || []).concat(metrics);
  const ratio = document.widthMm / document.heightMm;
  for (const box of [metrics.paper, metrics.canvas, metrics.selection]) {
    assert.ok(Math.abs(box.width / box.height - ratio) < 0.04, `${stage} Canvas 比例失真: ${JSON.stringify(metrics)}`);
  }
  assert.ok(Math.abs(metrics.runtime.canvasSize.width / metrics.runtime.canvasSize.height - ratio) < 0.04,
    `${stage} Canvas 点阵比例失真: ${JSON.stringify(metrics)}`);
}
async function canvasScreenshot(stage, file) {
  const metrics = report.canvases.find((item) => item.stage === stage);
  assert.ok(metrics.runtime.ink, `${stage} 应包含可见内容`);
  const bitmap = (await Jimp.read(fs.readFileSync(file))).bitmap;
  const scale = bitmap.width / report.system.screenWidth;
  const originX = Math.round(metrics.paperOffset.left * scale);
  const originY = Math.round(metrics.paperOffset.top * scale);
  const width = Math.round(metrics.paper.width * scale);
  const height = Math.round(metrics.paper.height * scale);
  assert.ok(originY >= 0 && originY + height <= bitmap.height, '截图检查要求纸张完整可见');
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = ((originY + y) * bitmap.width + originX + x) * 4;
      if (bitmap.data[index] < 90 && bitmap.data[index + 1] < 90 && bitmap.data[index + 2] < 90 && bitmap.data[index + 3] > 200) {
        left = Math.min(left, x); top = Math.min(top, y);
        right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
  }
  metrics.screenshotInk = right < 0 ? null : {
    left: left / width, top: top / height, right: (right + 1) / width, bottom: (bottom + 1) / height
  };
  assert.ok(metrics.screenshotInk, `${stage} 截图未显示标签内容`);
  for (const edge of ['left', 'top', 'right', 'bottom']) {
    assert.ok(Math.abs(metrics.screenshotInk[edge] - metrics.runtime.ink[edge]) < 0.08,
      `${stage} 屏幕内容与点阵比例不符（${edge}）：${JSON.stringify(metrics)}`);
  }
}

(async () => {
  const watchdog = setTimeout(() => {
    report.status = 'failed';
    report.error = '整个验收流程超过 180 秒，已终止；保留独立项目现场';
    for (const entry of report.cases) if (entry.status === 'running') entry.status = 'failed';
    saveReport();
    console.error(`${report.error}\n验收记录：${path.join(runRoot, 'report.json')}`);
    try { if (mini) mini.disconnect(); } catch (_) {}
    process.exit(1);
  }, 180000);
  try {
    prepare();
    mini = await launch();
    mini.on('exception', (event) => report.exceptions.push(event));
    mini.on('console', (event) => { if (report.consoleEvents.length < 200) report.consoleEvents.push(event); });
    report.system = await mini.systemInfo();
    report.menuRect = await mini.evaluate(() => wx.getMenuButtonBoundingClientRect());
    assert.equal(report.system.SDKVersion, requestedLibrary);
    assert.equal(report.system.platform, 'devtools', '此脚本只可运行在专用模拟器项目');
    const width = report.system.windowWidth;
    // The first answer after a cold DevTools start can take tens of seconds.
    let home = await current('pages/home/index', 60000);
    await check('首次编译、首页与引导', async () => {
      assert.equal(await home.data('storageError'), '');
      assert.equal(await home.data('showOnboarding'), true);
      assert.equal((await home.data('allProjects')).length, 0, '验收项目必须为空，不能改已有项目数据');
      await shot('01-onboarding');
      await fit(home, '.onboarding-actions button', width);
      for (let index = 0; index < 3; index += 1) await tap(home, '.onboarding-actions .primary-button');
      await until(async () => !(await home.data('showOnboarding')), '完成引导');
    });
    await check('首页导航与小屏布局', async () => {
      await fit(home, '.bottom-nav button', width);
      await fit(home, '.circle-button', width);
      await fit(home, '.device-pill', width);
      const brand = await home.$('.brand-row');
      assert.ok((await brand.offset()).top >= report.menuRect.bottom, '品牌行与原生胶囊重叠');
      assert.equal(await home.data('settings.stockWidthMm'), 40);
      assert.equal(await home.data('settings.stockHeightMm'), 12);
      await shot('02-home');
    });
    let editor;
    let projectId;
    await check('新建、Canvas、真实输入与保存', async () => {
      await tap(home, '.create-nav');
      editor = await current('pages/editor/index');
      await until(() => editor.data('canvasReady'), 'Canvas ready');
      assert.equal(await editor.data('loadError'), '');
      await tap(editor, '.tool-button[data-type="text"]');
      await editText(editor, '验收标签 A');
      await tap(editor, '.save-button');
      projectId = await until(() => editor.data('projectId'), '保存到项目');
      assert.equal(await editor.data('saveState'), '已保存到标签');
      await canvasGeometry(editor, 'blank-saved');
      await fit(editor, '.header-main button', width);
      await fit(editor, '.save-button', width);
      await fit(editor, '.print-button', width);
      await shot('03-editor-saved');
    });
    await check('系统返回后首页可恢复未保存草稿', async () => {
      await editText(editor, '未保存的验收修改 B');
      await mini.navigateBack();
      home = await current('pages/home/index');
      assert.ok(await home.data('recoveryDraft'));
      await shot('04-draft-recovery');
      await tap(home, '.draft-recovery .primary-button');
      editor = await current('pages/editor/index');
      await until(() => editor.data('canvasReady'), '恢复 Canvas');
      assert.equal((await editor.data('document.elements'))[0].text, '未保存的验收修改 B');
      assert.equal(await editor.data('projectId'), projectId);
      await tap(editor, '.save-button');
      await tap(editor, '.icon-button.close');
      home = await current('pages/home/index');
      assert.equal((await home.data()).recoveryDraft, null);
      assert.equal((await home.data('allProjects')).length, 1);
    });
    await check('保存重开、打印预检与原稿一致', async () => {
      await tap(home, '.project-open');
      editor = await current('pages/editor/index');
      await until(() => editor.data('canvasReady'), '重开 Canvas');
      assert.equal((await editor.data('document.elements'))[0].text, '未保存的验收修改 B');
      await tap(editor, '.print-button');
      await until(() => editor.data('showPrintSheet'), '打开打印预检');
      assert.equal((await editor.data()).printBlock, null);
      await fit(editor, '.print-actions button', width);
      await shot('05-print-preflight');
      // No print or BLE action is performed by simulator smoke testing.
      await tap(editor, '.print-sheet .sheet-close');
      await tap(editor, '.icon-button.close');
      home = await current('pages/home/index');
    });
    await check('模板浏览、预览与进入编辑器', async () => {
      await tap(home, '.bottom-nav button[data-route="templates"]');
      const heading = await until(() => home.$('.plain-header'), '模板页标题');
      const importButton = await heading.$('button');
      assert.ok((await importButton.offset()).top >= report.menuRect.bottom, '导入按钮与原生胶囊重叠');
      await tap(home, '.library-card');
      await until(() => home.data('showTemplatePreview'), '打开模板预览');
      await shot('06-template-preview');
      await tap(home, '.preview-sheet .primary-button');
      editor = await current('pages/editor/index');
      await until(() => editor.data('canvasReady'), '模板 Canvas');
      assert.ok((await editor.data('document.elements')).length > 0);
      await canvasGeometry(editor, 'template');
      await canvasScreenshot('template', await shot('07-template-editor'));
    });
    await check('连接后未观察到运行时异常', async () => assert.deepEqual(report.exceptions, []));
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.error = error.stack || error.message;
    if (mini) { try { await withTimeout(shot('failure'), 5000, '失败截图'); } catch (_) {} }
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    saveReport();
    if (mini) {
      if (report.status === 'passed') {
        try { await withTimeout(mini.close(), 5000, '关闭验收项目'); } catch (_) { mini.disconnect(); }
      } else mini.disconnect();
    }
    clearTimeout(watchdog);
    fs.writeSync(1, `验收记录：${path.join(runRoot, 'report.json')}\n`);
    // A timed-out SDK connection may retain an unreachable WebSocket.
    process.exit(process.exitCode || (report.status === 'passed' ? 0 : 1));
  }
})().catch((error) => {
  report.status = 'failed';
  report.error = error.stack || error.message;
  try { saveReport(); } finally {
    console.error(report.error);
    process.exit(1);
  }
});
