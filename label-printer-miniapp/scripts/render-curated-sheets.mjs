// Renders the curated template library into review sheets (24 per page) with
// headless Chrome and lists any text the renderer would have to shrink.
// Output: ../output/shangyue-curated/sheet-XX.png (not shipped).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { CURATED_INDEX } = require('../miniprogram/app/curated/index.js');

const chrome = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean).find((candidate) => fs.existsSync(candidate));
if (!chrome) {
  console.error('未找到 Chrome / Edge');
  process.exit(1);
}

const filter = process.argv.slice(2).find((arg) => !arg.startsWith('--')) || '';
const filters = filter.split(',').filter(Boolean);
const ids = CURATED_INDEX.map((entry) => entry.id).filter((id) => !filters.length || filters.some((part) => id.includes(part)));
const workDir = path.join(root, 'scripts', '.curated-work');
const outDir = path.join(root, '..', 'output', 'shangyue-curated');
fs.mkdirSync(workDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const bundle = path.join(workDir, 'curated.bundle.js');
const built = spawnSync(process.execPath, [
  path.join(root, 'node_modules', 'esbuild', 'bin', 'esbuild'),
  path.join(root, 'scripts', 'render-curated-sheets-browser.js'),
  '--bundle', '--platform=browser', '--format=iife', `--outfile=${bundle}`
], { cwd: root, encoding: 'utf8' });
if (built.status !== 0) {
  console.error(built.stderr || built.stdout);
  process.exit(built.status || 1);
}

const PER_SHEET = 24;
const COLUMNS = 6;
const CELL_W = 320;
const CELL_H = 250;
const shrunk = [];
for (let start = 0, page = 1; start < ids.length; start += PER_SHEET, page += 1) {
  const pageIds = ids.slice(start, start + PER_SHEET);
  const rowsNeeded = Math.ceil(pageIds.length / COLUMNS);
  const width = COLUMNS * CELL_W;
  const height = rowsNeeded * CELL_H;
  const html = path.join(workDir, `sheet-${page}.html`);
  fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#E9EBEF}canvas{display:block}#report{display:none}</style></head><body>
<canvas id="sheet" width="${width}" height="${height}"></canvas><pre id="report"></pre>
<script src="./curated.bundle.js"></script>
<script>window.renderCuratedSheet(${JSON.stringify(pageIds)}, ${COLUMNS}, ${CELL_W}, ${CELL_H});</script>
</body></html>`);
  const png = path.join(outDir, `sheet-${String(page).padStart(2, '0')}${filter ? `-${filters[0]}` : ''}.png`);
  const common = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${width},${height}`];
  const shot = spawnSync(chrome, [...common, `--screenshot=${png}`, pathToFileURL(html).href], { encoding: 'utf8' });
  if (shot.status !== 0) {
    console.error(shot.stderr || `sheet ${page} failed`);
    process.exit(1);
  }
  const dom = spawnSync(chrome, [...common, '--dump-dom', pathToFileURL(html).href], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const match = /<pre id="report">([^<]*)<\/pre>/.exec(dom.stdout || '');
  const report = match && match[1] ? JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')) : [];
  shrunk.push(...report);
  console.log(`${png} (${pageIds.length})${report.length ? ` 缩小 ${report.length}` : ''}`);
}
console.log(JSON.stringify({ rendered: ids.length, shrunk }, null, 1));
