/**
 * Minimal static file server for test/content-harness.html (no dependencies).
 * Usage: npm run harness  → http://localhost:8765/test/content-harness.html
 */
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = Number(process.env.PORT) || 8765;
const ROOT = path.resolve('.');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json' };

http.createServer((req, res) => {
  const filePath = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Harness: http://localhost:${PORT}/test/content-harness.html`));
