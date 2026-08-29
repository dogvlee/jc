import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { PUBLIC_TEMPLATES } = require('../miniprogram/app/catalog.js');

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);

const chrome = chromeCandidates.find((candidate) => fs.existsSync(candidate));
if (!chrome) {
  console.error('未找到 Chrome / Edge，无法渲染商跃缩略图');
  process.exit(1);
}

const outDir = path.join(root, 'miniprogram', 'assets', 'shangyue-thumbs');
const webOutDir = path.join(root, '..', 'niim-label-app', 'public', 'assets', 'shangyue-thumbs');
const workDir = path.join(root, 'scripts', '.thumb-work');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(webOutDir, { recursive: true });
fs.mkdirSync(workDir, { recursive: true });

const bundlePath = path.join(workDir, 'thumbs.bundle.js');
const esbuild = spawnSync(process.execPath, [
  path.join(root, 'node_modules', 'esbuild', 'bin', 'esbuild'),
  path.join(root, 'scripts', 'render-shangyue-thumbs-browser.js'),
  '--bundle',
  '--platform=browser',
  '--format=iife',
  `--outfile=${bundlePath}`
], { cwd: root, encoding: 'utf8' });
if (esbuild.status !== 0) {
  console.error(esbuild.stderr || esbuild.stdout);
  process.exit(esbuild.status || 1);
}

const keepExisting = new Set(['shangyue-wish-card']);
const hashes = {};

for (const template of PUBLIC_TEMPLATES) {
  const htmlPath = path.join(workDir, `${template.id}.html`);
  fs.writeFileSync(htmlPath, `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#fff;width:640px;height:480px;overflow:hidden}
  canvas{display:block}
</style></head>
<body>
<canvas id="thumb" width="640" height="480"></canvas>
<script src="./thumbs.bundle.js"></script>
<script>window.renderShangyueThumb(${JSON.stringify(template.id)});</script>
</body></html>`);

  const screenshotPath = path.join(workDir, `${template.id}.png`);
  const result = spawnSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=640,480',
    '--default-background-color=ffffffff',
    `--screenshot=${screenshotPath}`,
    pathToFileURL(htmlPath)
  ], { encoding: 'utf8' });
  if (result.status !== 0 || !fs.existsSync(screenshotPath)) {
    console.error(result.stderr || result.stdout || `failed ${template.id}`);
    process.exit(result.status || 1);
  }

  const destName = path.basename(template.thumbSrc);
  const dest = path.join(outDir, destName);
  if (keepExisting.has(template.id) && fs.existsSync(dest)) {
    hashes[template.id] = createHash('sha256').update(fs.readFileSync(dest)).digest('hex');
    continue;
  }
  fs.copyFileSync(screenshotPath, dest);
  fs.copyFileSync(screenshotPath, path.join(webOutDir, destName));
  hashes[template.id] = createHash('sha256').update(fs.readFileSync(dest)).digest('hex');
}

function pathToFileURL(filePath) {
  const resolved = path.resolve(filePath).replaceAll('\\', '/');
  return `file:///${resolved}`;
}

console.log(JSON.stringify(hashes, null, 2));
