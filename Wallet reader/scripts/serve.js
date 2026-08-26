// Local static file server + /api/scan/<kolId> endpoint for the sidewallet
// scanner, + /api/backup for the auto-backup-on-close feature. The static app
// can be opened with any file server, but the live "Rodar varredura" button
// and auto-backup-to-disk only work when this server is running, since they
// need Node (shelling out to gmgn-cli, writing files), not just a browser.
//
// Run: node scripts/serve.js  (then open http://localhost:8080)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { scanKol } = require('./sidewallet-scan');

const root = path.join(__dirname, '..');
const BACKUPS_DIR = path.join(root, 'backups');
const MAX_BACKUPS = 10;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname.startsWith('/api/scan/') && req.method === 'POST') {
    const kolId = decodeURIComponent(url.pathname.slice('/api/scan/'.length));
    try {
      const result = scanKol(kolId);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String((e && e.message) || e) }));
    }
    return;
  }

  if (url.pathname === '/api/backup' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      JSON.parse(body); // validate before writing to disk
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      fs.writeFileSync(path.join(BACKUPS_DIR, `kol-backup-${stamp}.json`), body);
      const files = fs.readdirSync(BACKUPS_DIR).filter((f) => f.startsWith('kol-backup-')).sort();
      while (files.length > MAX_BACKUPS) fs.unlinkSync(path.join(BACKUPS_DIR, files.shift()));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: String((e && e.message) || e) }));
    }
    return;
  }

  const safePath = path.normalize(url.pathname === '/' ? '/index.html' : url.pathname);
  const filePath = path.join(root, safePath);
  if (!filePath.startsWith(root)) { res.writeHead(403); res.end('forbidden'); return; }

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Wallet Reader rodando em http://localhost:${PORT} (varredura de sidewallets ativa)`));
