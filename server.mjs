import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};
const headers = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-src 'self' blob:; connect-src 'self'",
};

function safePath(pathname) {
  const candidate = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  const rel = relative(root, candidate);
  if (rel.startsWith('..') || rel.includes('..' + '/')) throw Error('bad path');
  return candidate;
}

createServer(async (req, res) => {
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end(req.method === 'HEAD' ? undefined : 'Method Not Allowed');
    return;
  }
  try {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    const path = safePath(decodeURIComponent(pathname));
    const info = await stat(path);
    if (!info.isFile()) throw Error('not a file');
    res.setHeader('Content-Type', types[extname(path)] || 'application/octet-stream');
    res.setHeader('Content-Length', info.size);
    res.writeHead(200);
    if (req.method === 'HEAD') res.end();
    else res.end(await readFile(path));
  } catch {
    res.writeHead(404);
    res.end(req.method === 'HEAD' ? undefined : 'Not found');
  }
}).listen(process.env.PORT || 5173, () => console.log('Forge IDE at http://localhost:' + (process.env.PORT || 5173)));
