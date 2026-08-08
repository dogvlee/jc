/**
 * Editor + data smoke: tap-to-edit, live undo state, batch autosave, back button.
 * Covers the P0 fixes whose proof is a DOM state change rather than markup.
 */
import { mkdir } from 'node:fs/promises';
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

const checks = [];
function check(name, condition, detail) {
  checks.push({ name, ok: !!condition, detail: detail || '' });
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`);
}

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.locator('.home-hero').waitFor();

// --- Editor: tap an already-selected text to edit it, and watch undo wake up ---
await page.locator('.nav-item[data-route="templates"]').click();
await page.locator('.template-card', { hasText: '商品价格标签' }).first().click();
await page.locator('.template-sheet').waitFor();
await page.locator('[data-action="use-template"]').click();
await page.locator('#label-canvas').waitFor();

check('undo starts disabled on a fresh template', await page.locator('[data-action="undo"]').isDisabled());

const canvas = page.locator('#selection-canvas');
const box = await canvas.boundingBox();
// The title text sits in the top band of the 40x30 label.
const titlePoint = { x: box.x + box.width * 0.5, y: box.y + box.height * 0.12 };

await page.mouse.click(titlePoint.x, titlePoint.y);
await page.waitForTimeout(350);
check('first tap selects and shows the float bar', await page.locator('.niim-float-bar').count() > 0);
check('first tap does not hijack the screen with a keyboard', await page.locator('.niim-content-line').count() === 0);

await page.mouse.click(titlePoint.x, titlePoint.y);
await page.waitForTimeout(400);
const contentInput = page.locator('.niim-content-line');
check('second tap on the same text opens its content editor', await contentInput.count() > 0);
await page.screenshot({ path: join(output, 'p0-tap-to-edit.png') });

if (await contentInput.count() > 0) {
  await contentInput.fill('青森苹果');
  await page.waitForTimeout(250);
  await page.locator('[data-action="content-done"]').first().click();
  await page.waitForTimeout(400);
  check('undo becomes available right after an edit', !(await page.locator('[data-action="undo"]').isDisabled()));

  await page.locator('[data-action="undo"]').click();
  await page.waitForTimeout(300);
  check('redo becomes available after undoing', !(await page.locator('[data-action="redo"]').isDisabled()));
}

// --- Back button (web fallback): must step back, not leave the app ---
await page.locator('[data-action="open-print"]').first().click();
await page.locator('.print-sheet').waitFor();
await page.goBack();
await page.waitForTimeout(400);
check('back closes the sheet instead of leaving', await page.locator('.print-sheet').count() === 0);
check('back kept us in the editor', await page.locator('#label-canvas').count() > 0);

await page.goBack();
await page.waitForTimeout(500);
check('back again leaves the editor for home', await page.locator('.home-hero').count() > 0);
check('the app is still alive', page.url().includes('127.0.0.1:4173'));

// --- Batch data: typing must survive a page switch and a reload ---
await page.locator('.nav-item[data-route="data"]').click();
await page.locator('.data-table').waitFor();
const firstCell = page.locator('[data-action="update-data-cell"][data-row="0"][data-field="name"]');
await firstCell.fill('自动落盘验证');
await page.waitForTimeout(900);
const status = (await page.locator('[data-role="data-save-status"]').innerText()).trim();
check('the table says when it saved', /已保存/.test(status), status);

await page.locator('.nav-item[data-route="home"]').click();
await page.locator('.home-hero').waitFor();
await page.reload({ waitUntil: 'networkidle' });
await page.locator('.nav-item[data-route="data"]').click();
await page.locator('.data-table').waitFor();
const restored = await page.locator('[data-action="update-data-cell"][data-row="0"][data-field="name"]').inputValue();
check('batch rows survive a cold reload', restored === '自动落盘验证', restored);
await page.screenshot({ path: join(output, 'p0-batch-autosave.png') });

await browser.close();

const failed = checks.filter((item) => !item.ok).length;
if (errors.length) {
  console.log('\nPage errors:');
  errors.forEach((line) => console.log(`  ${line}`));
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed || errors.length ? 1 : 0);
