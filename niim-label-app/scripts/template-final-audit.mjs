import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'artifacts');
const runtimePackage = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'package.json');
const { chromium } = createRequire(runtimePackage)('playwright-core');
const executablePath = process.env.BROWSER_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

async function openTemplateList() {
  await page.locator('[data-action="navigate"][data-route="templates"]').first().click();
  await page.locator('.template-card').first().waitFor();
}

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await openTemplateList();
const templateIds = await page.locator('.template-card').evaluateAll((nodes) => nodes.map((node) => node.dataset.id));
const templates = [];

for (const id of templateIds) {
  await page.locator(`.template-card[data-id="${id}"]`).click();
  await page.locator('#label-canvas').waitFor();
  await page.waitForTimeout(100);
  const result = await page.evaluate(() => {
    const canvas = document.getElementById('label-canvas');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let darkPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] < 100 && pixels[index + 1] < 100 && pixels[index + 2] < 100 && pixels[index + 3] > 0) darkPixels += 1;
    }
    const rect = document.querySelector('.canvas-viewport').getBoundingClientRect();
    return {
      canvas: [canvas.width, canvas.height],
      display: [+rect.width.toFixed(1), +rect.height.toFixed(1)],
      darkPixels,
      errorToasts: [...document.querySelectorAll('.toast.error')].map((node) => node.textContent.trim())
    };
  });
  templates.push({ id, ...result });
  await page.screenshot({ path: join(output, `final3-template-${id}.png`), fullPage: true });
  await page.locator('[data-action="close-editor"]').click();
  await openTemplateList();
}

const passed = templateIds.length === 8
  && templates.every((template) => template.darkPixels > 0 && template.errorToasts.length === 0)
  && errors.length === 0;
const report = { templateCount: templateIds.length, templates, errors, passed };
await writeFile(join(output, 'final3-template-verification.json'), `${JSON.stringify(report, null, 2)}\n`);
await browser.close();
console.log(JSON.stringify(report, null, 2));
if (!passed) process.exitCode = 1;
