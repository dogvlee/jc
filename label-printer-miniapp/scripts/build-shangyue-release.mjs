import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const sourceRoot = path.join(projectRoot, 'miniprogram');
const defaultOut = path.join(projectRoot, 'dist', 'shangyue-release');
const outRoot = path.resolve(process.argv[2] || defaultOut);

const excludedPrefixes = [
  'app/imported-templates.js',
  'app/online-template-runtime-fixes.js',
  'app/online-templates-pack.js',
  'assets/materials/original/',
  'assets/online-images/',
  'assets/online-thumbs/',
  'data/niim-templates/',
  'data/original-materials.json',
  'services/authorized-template-catalog.js'
];

function isExcluded(relative) {
  const normalized = relative.replaceAll('\\', '/');
  return excludedPrefixes.some((prefix) => (
    normalized === prefix.replace(/\/$/, '') || normalized.startsWith(prefix)
  ));
}

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const relative = path.relative(sourceRoot, source).replaceAll('\\', '/');
    if (isExcluded(relative)) continue;
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(source, target);
    else fs.copyFileSync(source, target);
  }
}

if (!fs.existsSync(sourceRoot)) {
  console.error(`找不到小程序源目录：${sourceRoot}`);
  process.exit(2);
}

fs.rmSync(outRoot, { recursive: true, force: true });
copyTree(sourceRoot, outRoot);

const gate = spawnSync(process.execPath, [
  path.join(scriptDir, 'check-shangyue-release.mjs'),
  outRoot
], { stdio: 'inherit' });

if (gate.status !== 0) {
  process.exit(gate.status || 1);
}

console.log(`商跃公开包已生成：${outRoot}`);
