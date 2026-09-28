import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { copyReleaseTree, reserveOutputDirectory } from './release-utils.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const sourceRoot = path.join(projectRoot, 'miniprogram');
const defaultOut = path.join(projectRoot, 'dist', 'shangyue-release');

if (!fs.existsSync(sourceRoot)) {
  console.error(`找不到小程序源目录：${sourceRoot}`);
  process.exit(2);
}

let outRoot;
try {
  outRoot = reserveOutputDirectory(process.argv[2] || defaultOut, sourceRoot, !process.argv[2]);
  copyReleaseTree(sourceRoot, outRoot);
} catch (error) {
  console.error(error.message);
  process.exit(2);
}

const gate = spawnSync(process.execPath, [
  path.join(scriptDir, 'check-shangyue-release.mjs'),
  outRoot
], { stdio: 'inherit' });

if (gate.status !== 0) {
  process.exit(gate.status || 1);
}

console.log(`商跃公开包已生成：${outRoot}`);
