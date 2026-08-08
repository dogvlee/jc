import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const runtimePackage = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'package.json');
const runtimeRequire = createRequire(runtimePackage);
const { chromium } = runtimeRequire('playwright-core');
const executablePath = process.env.BROWSER_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const output = resolve(root, 'artifacts');
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.locator('h1').filter({ hasText: '标签工坊' }).waitFor();
await page.screenshot({ path: join(output, 'home-mobile.png'), fullPage: true });

const homeLayout = await page.evaluate(() => ({
  viewport: [innerWidth, innerHeight],
  scrollWidth: document.documentElement.scrollWidth,
  navItems: document.querySelectorAll('.nav-item').length,
  quickActions: document.querySelectorAll('.quick-action').length,
  templates: document.querySelectorAll('.template-card').length
}));

await page.locator('[data-action="open-devices"]').first().click();
await page.locator('.device-item').first().waitFor({ timeout: 3000 });
await page.locator('.device-item').first().click();
await page.locator('.device-banner .device-name').filter({ hasText: '浏览器预览 D110' }).waitFor({ timeout: 5000 });

await page.locator('[data-action="create-label"]').click();
await page.locator('#label-canvas').waitFor();
await page.keyboard.press('Escape');
await page.locator('.editor-panel-tab[data-tab="elements"]').waitFor();
await page.locator('[data-action="add-element"][data-type="barcode"]').click();
await page.locator('#barcode-value').waitFor();
await page.keyboard.press('Escape');

const dynamicTypes = [
  ['date', '#date-format'],
  ['serial', '#serial-prefix'],
  ['table', '.table-cell-editor'],
  ['material', '#material-symbol']
];
for (const [type, control] of dynamicTypes) {
  await page.locator(`[data-action="add-element"][data-type="${type}"]`).click();
  await page.locator(control).waitFor();
  await page.locator('[data-action="delete-selected"]').click();
}

await page.locator('.toast').last().waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});

const canvasCheck = await page.evaluate(() => {
  const canvas = document.getElementById('label-canvas');
  const context = canvas.getContext('2d');
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let dark = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index] < 100 && pixels[index + 1] < 100 && pixels[index + 2] < 100 && pixels[index + 3] > 0) dark += 1;
  }
  return {
    width: canvas.width,
    height: canvas.height,
    darkPixels: dark,
    pageScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
    editorTools: document.querySelectorAll('.element-picker-item').length
  };
});

await page.screenshot({ path: join(output, 'editor-mobile.png'), fullPage: true });
await page.locator('[data-action="open-print"]').click();
await page.locator('#print-preview-canvas').waitFor();
await page.locator('[data-action="start-print"]').click();
await page.getByText('打印完成', { exact: true }).first().waitFor({ timeout: 15000 });

await page.locator('.sheet-backdrop').click({ position: { x: 5, y: 5 } });
await page.locator('[data-action="close-editor"]').click();
await page.locator('h1').filter({ hasText: '标签工坊' }).waitFor();
await page.setViewportSize({ width: 1280, height: 900 });
await page.screenshot({ path: join(output, 'home-desktop.png'), fullPage: true });

const desktopLayout = await page.evaluate(() => ({
  viewport: [innerWidth, innerHeight],
  scrollWidth: document.documentElement.scrollWidth,
  sideNavWidth: document.querySelector('.bottom-nav').getBoundingClientRect().width,
  cards: document.querySelectorAll('.project-card,.template-card').length
}));

const result = {
  url: page.url(),
  homeLayout,
  canvasCheck,
  desktopLayout,
  errors,
  passed: errors.length === 0
    && homeLayout.scrollWidth <= homeLayout.viewport[0]
    && homeLayout.navItems === 5
    && canvasCheck.darkPixels > 50
    && canvasCheck.editorTools === 12
    && canvasCheck.pageScrollWidth <= canvasCheck.viewportWidth
    && desktopLayout.scrollWidth <= desktopLayout.viewport[0]
};

await writeFile(join(output, 'ui-smoke.json'), `${JSON.stringify(result, null, 2)}\n`);
await browser.close();
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
