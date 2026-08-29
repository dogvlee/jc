import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chrome = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean).find((candidate) => fs.existsSync(candidate));
if (!chrome) {
  console.error('未找到 Chrome / Edge');
  process.exit(1);
}

const workDir = path.join(root, 'scripts', '.library-thumb-work');
const outDir = path.join(root, '..', 'output', 'shangyue-library', 'samples');
fs.mkdirSync(workDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });
for (const name of fs.readdirSync(outDir)) {
  if (/^\d{2}-[a-z0-9-]+-\d+x\d+\.png$/i.test(name)) {
    fs.rmSync(path.join(outDir, name));
  }
}

const bundlePath = path.join(workDir, 'library.bundle.js');
const built = spawnSync(process.execPath, [
  path.join(root, 'node_modules', 'esbuild', 'bin', 'esbuild'),
  path.join(root, 'scripts', 'render-shangyue-library-samples-browser.js'),
  '--bundle',
  '--platform=browser',
  '--format=iife',
  `--outfile=${bundlePath}`
], { cwd: root, encoding: 'utf8' });
if (built.status !== 0) {
  console.error(built.stderr || built.stdout);
  process.exit(built.status || 1);
}

const { LIBRARY_INDEX } = require('../miniprogram/app/shangyue-library/pack');
const picked = [];
const sceneIds = [...new Set(LIBRARY_INDEX.map((entry) => entry.scene))];
const reviewSizes = [[30, 12], [50, 15], [40, 30], [50, 50]];
sceneIds.forEach((scene, index) => {
  const variant = index % 3;
  const [reviewWidth, reviewHeight] = reviewSizes[index % reviewSizes.length];
  const preferred = LIBRARY_INDEX.find((entry) => (
    entry.scene === scene
    && entry.widthMm === reviewWidth
    && entry.heightMm === reviewHeight
    && entry.variant === variant
  ));
  const fallback = LIBRARY_INDEX.find((entry) => entry.scene === scene && entry.variant === variant);
  picked.push(preferred || fallback);
});

// Keep a same-scene/same-copy/same-paper triplet in the review set so the
// three layout grammars can be checked visually, not merely by unit tests.
const priceTriplet = LIBRARY_INDEX.filter((entry) => (
  entry.scene === 'price'
  && entry.item === '青提'
  && entry.widthMm === 40
  && entry.heightMm === 30
));
priceTriplet.forEach((entry) => {
  if (!picked.some((item) => item.id === entry.id)) picked.push(entry);
});

function pathToFileURL(filePath) {
  return `file:///${path.resolve(filePath).replaceAll('\\', '/')}`;
}

picked.slice(0, 28).forEach((entry, index) => {
  const htmlPath = path.join(workDir, `${entry.id}.html`);
  fs.writeFileSync(htmlPath, `<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#fff;width:640px;height:480px;overflow:hidden}
</style></head>
<body>
<canvas id="thumb" width="640" height="480"></canvas>
<script src="./library.bundle.js"></script>
<script>window.renderLibraryThumb(${JSON.stringify(entry.id)});</script>
</body></html>`);
  const dest = path.join(outDir, `${String(index + 1).padStart(2, '0')}-${entry.scene}-${entry.widthMm}x${entry.heightMm}.png`);
  const shot = spawnSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=640,480',
    '--default-background-color=ffffffff',
    `--screenshot=${dest}`,
    pathToFileURL(htmlPath)
  ], { encoding: 'utf8' });
  if (shot.status !== 0 || !fs.existsSync(dest)) {
    console.error(shot.stderr || `failed ${entry.id}`);
    process.exit(shot.status || 1);
  }
  console.log(path.basename(dest), entry.name);
});
