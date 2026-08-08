import { cp, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const require = createRequire(import.meta.url);
const esbuild = require('esbuild');

await rm(resolve(root, 'dist'), { recursive: true, force: true });
await mkdir(resolve(root, 'dist', 'assets'), { recursive: true });

await esbuild.build({
  entryPoints: [resolve(root, 'src', 'app', 'main.js')],
  outfile: resolve(root, 'dist', 'assets', 'app.js'),
  bundle: true,
  minify: false,
  sourcemap: true,
  platform: 'browser',
  target: ['chrome100'],
  define: {
    __APP_VERSION__: JSON.stringify('1.0.0')
  }
});

await Promise.all([
  cp(resolve(root, 'src', 'index.html'), resolve(root, 'dist', 'index.html')),
  cp(resolve(root, 'src', 'styles.css'), resolve(root, 'dist', 'assets', 'styles.css')),
  cp(resolve(root, 'public'), resolve(root, 'dist'), { recursive: true })
]);

console.log('Built dist/');
