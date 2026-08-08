/** Screenshots of the surfaces the P0 fixes changed, for eyeball review. */
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const runtimePackage = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'package.json');
const { chromium } = createRequire(runtimePackage)('playwright-core');
const executablePath = process.env.BROWSER_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const out = resolve(root, 'artifacts');
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });

await page.locator('.nav-item[data-route="templates"]').click();
await page.locator('.template-card').first().waitFor();
await page.locator('.segment', { hasText: '零售' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: join(out, 'shot-templates-filtered.png') });

await page.locator('.industry-chip', { hasText: '实用功能' }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: join(out, 'shot-templates-empty.png') });
await page.locator('[data-action="reset-template-filters"]').first().click();

await page.locator('.template-card', { hasText: '商品价格标签' }).first().click();
await page.locator('.template-sheet').waitFor();
await page.locator('[data-action="use-template"]').click();
await page.locator('#label-canvas').waitFor();
await page.waitForTimeout(400);
await page.screenshot({ path: join(out, 'shot-editor-landing.png') });

await page.locator('[data-action="open-print"]').first().click();
await page.locator('.print-sheet').waitFor();
await page.waitForTimeout(600);
await page.screenshot({ path: join(out, 'shot-print-blocked.png') });

await browser.close();
console.log('screenshots written to artifacts/');
