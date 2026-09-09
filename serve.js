// Dependency-free static server for fnsq-advisory
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const PORT = 8830;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json', '.pdf': 'application/pdf' };
/* Run the /api functions in-process so the chat widget can be exercised end to
   end without `vercel dev`. The shim gives the handler the small slice of the
   Vercel request/response surface these functions actually use: req.body already
   parsed, res.status().json(), res.setHeader. */
function apiShim(req, res, name) {
  const modPath = path.join(ROOT, 'api', name + '.js');
  if (!fs.existsSync(modPath)) { res.writeHead(404); return res.end('no such function'); }
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 1e6) req.destroy(); });
  req.on('end', () => {
    try { req.body = raw ? JSON.parse(raw) : {}; } catch (e) { req.body = {}; }
    res.status = code => { res.statusCode = code; return res; };
    res.json = obj => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(obj));
      return res;
    };
    let handler;
    try {
      delete require.cache[require.resolve(modPath)];   // pick up edits without a restart
      handler = require(modPath);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('function failed to load: ' + e.message);
    }
    Promise.resolve()
      .then(() => handler(req, res))
      .catch(e => {
        console.error(name, e);
        if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('500'); }
      });
  });
}

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);

  const api = p.match(/^\/api\/([a-z0-9_-]+)$/i);
  if (api) return apiShim(req, res, api[1]);

  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, path.normalize(p).replace(/^([.][.][\\/])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log('fnsq-advisory on http://localhost:' + PORT));
