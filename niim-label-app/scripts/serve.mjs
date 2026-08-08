import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const port = Number(process.env.PORT) || 4173;
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

createServer(async (request, response) => {
  try {
    const cleanPath = decodeURIComponent((request.url || '/').split('?')[0]);
    const requested = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^\/+/, '');
    let file = normalize(join(dist, requested));
    if (!file.startsWith(dist) || !existsSync(file) || (await stat(file)).isDirectory()) {
      file = join(dist, 'index.html');
    }
    response.statusCode = 200;
    response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream');
    response.setHeader('Cache-Control', 'no-store');
    createReadStream(file).pipe(response);
  } catch (error) {
    response.statusCode = 500;
    response.end('Internal Server Error');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`精臣标签: http://127.0.0.1:${port}`);
});
