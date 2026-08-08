/**
 * Main-path smoke: 模板库 → 预览 → 使用 → 编辑器 → 打印 → 停止.
 * Guards the P0 fixes that a unit test cannot reach (real DOM + real events).
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

// 1) Template library → preview → use
await page.locator('.nav-item[data-route="templates"]').click();
await page.locator('.template-card').first().waitFor();

// Over-filter on purpose, then confirm the single escape hatch works.
await page.locator('.industry-chip', { hasText: '实用功能' }).click();
await page.locator('.segment', { hasText: '零售' }).click();
const emptyShown = await page.locator('.empty-state').count();
check('over-filtering shows an empty state', emptyShown > 0);
await page.locator('[data-action="reset-template-filters"]').first().click();
const restored = await page.locator('.template-card').count();
check('清除全部筛选 restores the catalog', restored >= 15, `cards=${restored}`);

await page.locator('.template-card', { hasText: '商品价格标签' }).first().click();
await page.locator('.template-sheet').waitFor();
await page.locator('[data-action="use-template"]').click();
await page.locator('#label-canvas').waitFor();

// 2) Editor landing must expose 打印
const printBtn = page.locator('[data-action="open-print"]');
check('editor landing shows 打印', await printBtn.count() > 0);
check('editor landing has no selection chrome', await page.locator('.niim-float-bar').count() === 0);
await page.screenshot({ path: join(output, 'p0-editor-landing.png') });

// 3) Print sheet opens even though the default model cannot print 40x30
await printBtn.first().click();
await page.locator('.print-sheet').waitFor({ timeout: 5000 });
check('print sheet opens on the default model', true);
const blocked = page.locator('.print-notice.blocked');
check('blocked print explains itself', await blocked.count() > 0);
const suggest = page.locator('[data-action="apply-suggested-profile"]');
check('blocked print offers a working model', await suggest.count() > 0);
await page.screenshot({ path: join(output, 'p0-print-blocked.png') });

await suggest.first().click();
await page.waitForTimeout(300);
check('switching model clears the blocker', await page.locator('.print-notice.blocked').count() === 0);
const submitText = (await page.locator('.print-submit').innerText()).trim();
check('submit button becomes actionable', /连接并打印|开始打印/.test(submitText), submitText);

// 4) Connecting a real D110 re-blocks this 40x30 label — and says so honestly
//    instead of pretending another menu entry could fix the hardware.
await page.locator('.print-submit').click();
await page.locator('.device-item').first().waitFor({ timeout: 8000 });
await page.locator('.device-item').first().click();
await page.locator('.print-sheet').waitFor({ timeout: 8000 });
await page.waitForTimeout(400);
const connectedBlock = page.locator('.print-notice.blocked');
check('a connected printer that cannot fit the label says so', await connectedBlock.count() > 0);
check(
  'no model suggestion once hardware decides the model',
  await page.locator('[data-action="apply-suggested-profile"]').count() === 0
);
await page.screenshot({ path: join(output, 'p0-print-blocked-connected.png') });

// 5) A label the connected printer CAN take must print end to end.
await page.locator('.print-sheet [data-action="close-modal"]').first().click();
await page.locator('[data-action="close-editor"]').click();
await page.locator('.home-hero').waitFor();
await page.locator('.nav-item[data-route="templates"]').click();
await page.locator('.template-card', { hasText: '线缆分类标签' }).first().click(); // 40x12 fits D110
await page.locator('.template-sheet').waitFor();
await page.locator('[data-action="use-template"]').click();
await page.locator('#label-canvas').waitFor();
await page.locator('[data-action="open-print"]').first().click();
await page.locator('.print-sheet').waitFor();
check('a fitting label opens the sheet unblocked', await page.locator('.print-notice.blocked').count() === 0);
await page.locator('.print-submit').click();
await page.waitForTimeout(3000);
const printing = await page.locator('[data-action="cancel-print"]').count();
await page.screenshot({ path: join(output, 'p0-printing.png') });

// 6) While printing, a stray backdrop tap must not wipe out the progress.
if (printing > 0) {
  await page.locator('.sheet-backdrop').click({ position: { x: 10, y: 10 } });
  await page.waitForTimeout(200);
  check('backdrop cannot dismiss a running print', await page.locator('.print-sheet').count() > 0);
  await page.locator('[data-action="cancel-print"]').click();
  await page.waitForTimeout(2500);
  check('停止打印 ends the run', await page.locator('[data-action="cancel-print"]').count() === 0);
} else {
  check('print ran to completion', await page.locator('.print-notice.failed').count() === 0);
}

// 7) The finished job must be in history with a truthful result
if (await page.locator('.print-sheet').count() > 0) {
  await page.locator('.print-sheet [data-action="close-modal"]').first().click();
}
await page.locator('[data-action="close-editor"]').click();
await page.locator('.home-hero').waitFor();
await page.locator('[data-action="print-history"]').first().click();
await page.locator('.history-list').waitFor();
const historyCount = await page.locator('.history-result').count();
const firstResult = historyCount ? (await page.locator('.history-result').first().innerText()).trim() : '(empty)';
check('print history records the run', ['成功', '失败', '已取消'].includes(firstResult), firstResult);
await page.screenshot({ path: join(output, 'p0-history.png') });

await browser.close();

let failed = 0;
for (const item of checks) {
  if (!item.ok) failed += 1;
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.detail ? ` (${item.detail})` : ''}`);
}
if (errors.length) {
  console.log('\nPage errors:');
  errors.forEach((line) => console.log(`  ${line}`));
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed || errors.length ? 1 : 0);
