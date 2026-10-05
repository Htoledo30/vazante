// Servidor estático mínimo para desenvolvimento/testes (sem dependências).
// Uso: node tools/serve.mjs <pasta> <porta> [prefixo]
// O prefixo opcional simula hospedagem em subpasta (ex.: /vazante/ no GitHub Pages).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const root = process.argv[2] || 'game';
const port = Number(process.argv[3] || 8080);
const prefix = (process.argv[4] || '/').replace(/\/?$/, '/');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!path.startsWith(prefix)) { res.writeHead(404); res.end('fora do prefixo'); return; }
    path = path.slice(prefix.length - 1);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(normalize(root))) { res.writeHead(403); res.end(); return; }
    const s = await stat(file);
    if (s.isDirectory()) { res.writeHead(301, { Location: req.url + '/' }); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch (e) {
    res.writeHead(404); res.end('não encontrado');
  }
});
server.listen(port, () => console.log(`Servindo ${root} em http://localhost:${port}${prefix}`));
