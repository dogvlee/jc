import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const build = spawn(process.execPath, [join(root, 'scripts', 'build.mjs')], { stdio: 'inherit' });
await new Promise((resolveBuild, rejectBuild) => {
  build.once('exit', (code) => code === 0 ? resolveBuild() : rejectBuild(new Error(`build exited ${code}`)));
});

await import('./serve.mjs');
