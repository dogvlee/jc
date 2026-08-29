import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);
const chrome = chromeCandidates.find((candidate) => fs.existsSync(candidate));
if (!chrome) {
  console.error('未找到 Chrome / Edge');
  process.exit(1);
}

const pairs = [
  ['shangyue-wish-card', 'online-512427668', '商跃原创 · 祝福卡', '网上爬稿 · 祝福'],
  ['shangyue-price-tag', 'product-simple', '商跃原创 · 零售价签', '旧内置 · 商品价格'],
  ['shangyue-price-tag', 'online-233730076', '商跃原创 · 零售价签', '网上爬稿 · 价签外套'],
  ['shangyue-bin-label', 'storage-code', '商跃原创 · 仓储货位', '旧内置 · 仓储货架'],
  ['shangyue-name-sticker', 'name-tag', '商跃原创 · 姓名贴', '旧内置 · 姓名贴'],
  ['shangyue-fresh-date', 'home-date', '商跃原创 · 效期签', '旧内置 · 食品日期'],
  ['shangyue-wifi-card', 'wifi-code', '精诚授权改编 · 商跃重设计 · 连网码', '授权参考旧稿 · Wi-Fi 码'],
  ['shangyue-promo-tag', 'promo-price', '精诚授权改编 · 商跃重设计 · 促销价签', '授权参考旧稿 · 促销价签'],
  ['shangyue-jewelry-tag', 'jewelry-price', '商跃原创 · 珠宝吊牌', '旧内置 · 珠宝价格'],
  ['shangyue-garment-tag', 'clothing-tag', '商跃原创 · 服装吊牌', '旧内置 · 服装款式'],
  ['shangyue-ship-label', 'shipping-bin', '商跃原创 · 物流简签', '旧内置 · 周转箱'],
  ['shangyue-cable-tag', 'cable-name', '商跃原创 · 线缆标识', '旧内置 · 线缆分类'],
  ['shangyue-asset-tag', 'asset-card', '商跃原创 · 固定资产', '旧内置 · 固定资产'],
  ['shangyue-biz-card', 'business-card', '商跃原创 · 商务名片', '旧内置 · 商务名片'],
  ['shangyue-kitchen-date', 'catering-date', '精诚授权改编 · 商跃重设计 · 餐饮效期', '授权参考旧稿 · 厨房效期'],
  ['shangyue-med-label', 'medicine-box', '商跃原创 · 药品签', '旧内置 · 药品收纳'],
  ['shangyue-seat-card', 'wedding-invite', '商跃原创 · 席卡', '旧内置 · 婚礼席卡'],
  ['shangyue-bakery-tag', 'bakery-tag', '商跃原创 · 烘焙价签', '旧内置 · 烘焙店价签'],
  ['shangyue-plant-tag', 'plant-care', '精诚授权改编 · 商跃重设计 · 植物签', '授权参考旧稿 · 园艺植物'],
  ['shangyue-desk-plate', 'office-desk', '商跃原创 · 工位牌', '旧内置 · 工位姓名牌'],
  ['shangyue-lab-tag', 'lab-sample', '商跃原创 · 样品签', '旧内置 · 实验室样品'],
  ['shangyue-care-tag', 'garment-care', '精诚授权改编 · 商跃重设计 · 洗涤说明', '授权参考旧稿 · 服装洗涤'],
  ['shangyue-serial-cable', 'serial-cable', '商跃原创 · 线号序列', '旧内置 · 线号序列']
];

const workDir = path.join(root, 'scripts', '.thumb-work');
const outDir = path.join(root, '..', 'output', 'shangyue-compare');
fs.mkdirSync(workDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

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

function pathToFileURL(filePath) {
  return `file:///${path.resolve(filePath).replaceAll('\\', '/')}`;
}

pairs.forEach((pair, index) => {
  const [leftId, rightId, leftTitle, rightTitle] = pair;
  const htmlPath = path.join(workDir, `compare-${index}.html`);
  fs.writeFileSync(htmlPath, `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#f4f1ea;width:1320px;height:620px;overflow:hidden}
  canvas{display:block}
</style></head>
<body>
<canvas id="compare" width="1320" height="620"></canvas>
<script src="./thumbs.bundle.js"></script>
<script>window.renderShangyueCompare(${JSON.stringify(leftId)},${JSON.stringify(rightId)},${JSON.stringify(leftTitle)},${JSON.stringify(rightTitle)});</script>
</body></html>`);
  const dest = path.join(outDir, `${String(index + 1).padStart(2, '0')}-${leftId}-vs-${rightId}.png`);
  const result = spawnSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1320,620',
    '--default-background-color=fff4f1ea',
    `--screenshot=${dest}`,
    pathToFileURL(htmlPath)
  ], { encoding: 'utf8' });
  if (result.status !== 0 || !fs.existsSync(dest)) {
    console.error(result.stderr || result.stdout || `failed ${leftId} vs ${rightId}`);
    process.exit(result.status || 1);
  }
  console.log(path.relative(path.join(root, '..'), dest));
});
