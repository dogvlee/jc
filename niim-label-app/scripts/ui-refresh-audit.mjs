import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'artifacts', 'modern-ui-audit');
const runtimePackage = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'package.json');
const { chromium } = createRequire(runtimePackage)('playwright-core');
const executablePath = process.env.BROWSER_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const viewports = [
  { width: 320, height: 700 },
  { width: 390, height: 844 },
  { width: 800, height: 900 },
  { width: 1280, height: 900 }
];

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const report = { viewports: {}, errors: [], passed: false };

async function pageMetrics(page) {
  return page.evaluate(() => ({
    viewport: [innerWidth, innerHeight],
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    navItems: document.querySelectorAll('.nav-item').length
  }));
}

for (const viewport of viewports) {
  const key = `${viewport.width}x${viewport.height}`;
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.locator('h1').filter({ hasText: '标签工坊' }).waitFor();
  const pages = {};
  pages.home = await pageMetrics(page);
  await page.screenshot({ path: join(output, `${key}-home.png`) });

  if (key === '390x844') {
    await page.locator('[data-action="open-devices"]').first().click();
    await page.locator('.bottom-sheet').waitFor();
    await page.locator('.device-item').first().waitFor({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
    pages.devicesSheet = {
      ...await pageMetrics(page),
      devices: await page.locator('.device-item').count(),
      visible: await page.locator('.bottom-sheet').isVisible()
    };
    await page.screenshot({ path: join(output, `${key}-devices-sheet.png`) });
    await page.locator('.sheet-backdrop').click({ position: { x: 5, y: 5 } });
  }

  await page.locator('[data-action="navigate"][data-route="templates"]').first().click();
  await page.locator('h1').filter({ hasText: '模板库' }).waitFor();
  pages.templates = { ...await pageMetrics(page), cards: await page.locator('.template-card').count() };
  await page.screenshot({ path: join(output, `${key}-templates.png`) });

  await page.locator('[data-action="navigate"][data-route="data"]').first().click();
  await page.locator('h1').filter({ hasText: '批量数据' }).waitFor();
  pages.data = { ...await pageMetrics(page), rows: await page.locator('.data-table tbody tr').count() };
  await page.screenshot({ path: join(output, `${key}-data.png`) });

  await page.locator('[data-action="navigate"][data-route="profile"]').first().click();
  await page.locator('h1').filter({ hasText: '我的' }).waitFor();
  pages.profile = { ...await pageMetrics(page), settings: await page.locator('.settings-row').count() };
  await page.screenshot({ path: join(output, `${key}-profile.png`) });

  await page.locator('[data-action="navigate"][data-route="home"]').first().click();
  await page.locator('[data-action="create-label"]').click();
  await page.locator('#label-canvas').waitFor();
  pages.editorEmpty = await page.evaluate(() => ({
    ...{
      viewport: [innerWidth, innerHeight],
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth
    },
    topbarActions: document.querySelectorAll('.editor-topbar [data-action]').length,
    tools: document.querySelectorAll('.element-picker-item').length,
    panelTabs: document.querySelectorAll('.editor-panel-tab').length
  }));
  await page.screenshot({ path: join(output, `${key}-editor-empty.png`) });

  await page.locator('[data-action="add-element"][data-type="text"]').click();
  await page.locator('#element-text').waitFor();
  pages.editorSelected = await page.evaluate(() => {
    const context = document.querySelector('.context-actions');
    const rect = context?.getBoundingClientRect();
    return {
      viewport: [innerWidth, innerHeight],
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      contextActions: document.querySelectorAll('.context-action').length,
      contextInsideViewport: Boolean(rect && rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight),
      selectedPixelsAvailable: Boolean(document.querySelector('#selection-canvas')),
      saveVisible: Boolean(document.querySelector('[data-action="save-project"]')),
      printVisible: Boolean(document.querySelector('[data-action="open-print"]'))
    };
  });
  await page.screenshot({ path: join(output, `${key}-editor-selected.png`) });

  if (key === '390x844') {
    await page.locator('[data-action="open-print"]').click();
    await page.locator('#print-preview-canvas').waitFor();
    await page.waitForTimeout(300);
    pages.printSheet = {
      ...await pageMetrics(page),
      previewVisible: await page.locator('#print-preview-canvas').isVisible(),
      submitVisible: await page.locator('[data-action="start-print"]').isVisible()
    };
    await page.screenshot({ path: join(output, `${key}-print-sheet.png`) });
    await page.locator('.sheet-backdrop').click({ position: { x: 5, y: 5 } });
  }

  report.viewports[key] = { pages, errors };
  report.errors.push(...errors.map((error) => `${key}: ${error}`));
  await context.close();
}

const pageResults = Object.values(report.viewports).flatMap((entry) => Object.values(entry.pages));
report.passed = report.errors.length === 0
  && pageResults.every((result) => result.documentWidth <= result.viewport[0] && result.bodyWidth <= result.viewport[0])
  && Object.values(report.viewports).every(({ pages, errors }) => errors.length === 0
    && pages.home.navItems === 5
    && pages.templates.cards === 8
    && pages.data.rows >= 1
    && pages.profile.settings >= 1
    && pages.editorEmpty.topbarActions === 7
    && pages.editorEmpty.tools === 12
    && pages.editorSelected.contextActions === 6
    && pages.editorSelected.contextInsideViewport
    && pages.editorSelected.saveVisible
    && pages.editorSelected.printVisible
    && (!pages.devicesSheet || (pages.devicesSheet.visible && pages.devicesSheet.devices >= 1))
    && (!pages.printSheet || (pages.printSheet.previewVisible && pages.printSheet.submitVisible)));

await writeFile(join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
await browser.close();
console.log(JSON.stringify({
  viewports: Object.keys(report.viewports),
  errors: report.errors,
  passed: report.passed
}, null, 2));
if (!report.passed) process.exitCode = 1;
