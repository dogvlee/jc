import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const required = [
  'dist/index.html',
  'dist/assets/app.js',
  'dist/assets/styles.css',
  'dist/manifest.webmanifest'
];

for (const relative of required) {
  const details = await stat(resolve(root, relative));
  if (!details.isFile() || details.size === 0) {
    throw new Error(`Invalid build artifact: ${relative}`);
  }
}

const html = await readFile(resolve(root, 'dist/index.html'), 'utf8');
if (!html.includes('id="app"') || !html.includes('assets/app.js')) {
  throw new Error('Built index.html is missing the app mount or bundle');
}
console.log('Build artifacts verified');
