#!/usr/bin/env node
// Local dev server: serves dist/ and rebuilds when src/ or config changes.
const http = require('http');
const fs = require('fs');
const path = require('path');
const build = require('./build');

const PORT = Number(process.env.PORT) || 8080;
const OUT = path.join(__dirname, 'dist');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

build();

let timer;
const rebuild = () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try { build(); } catch (e) { console.error(e.message); }
  }, 100);
};
fs.watch(path.join(__dirname, 'src'), { recursive: true }, rebuild);
fs.watch(path.join(__dirname, 'site.config.json'), rebuild);

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    const file = path.normalize(path.join(OUT, urlPath));
    if (!file.startsWith(OUT)) return res.writeHead(403).end();
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': TYPES['.html'] });
        return res.end(fs.existsSync(path.join(OUT, '404.html')) ? fs.readFileSync(path.join(OUT, '404.html')) : 'Not found');
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  })
  .listen(PORT, () => console.log(`Dev server: http://localhost:${PORT}`));
