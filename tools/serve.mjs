// Servidor estático mínimo para desenvolvimento/testes (sem dependências).
// Uso: node tools/serve.mjs [pasta=game] [porta=8080] [prefixo=/icor/]
// O prefixo simula hospedagem em subpasta (como no GitHub Pages: https://usuario.github.io/icor/).
// Porta 0 = porta livre qualquer. Também exporta startServer() para os testes.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';
import { networkInterfaces } from 'node:os';

export const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.webp': 'image/webp',
};

/** Inicia o servidor. Resolve { server, port, url, close() }. */
export function startServer({ root = 'game', port = 8080, prefix = '/icor/', host, quiet = false } = {}) {
  const base = resolve(root);
  prefix = ('/' + String(prefix || '/').replace(/^\/+|\/+$/g, '') + '/').replace('//', '/');
  const server = createServer(async (req, res) => {
    const send = (code, body = '', headers = {}) => { res.writeHead(code, headers); res.end(req.method === 'HEAD' ? undefined : body); };
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(405);
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (prefix !== '/' && (path === '/' || path === prefix.slice(0, -1))) return send(302, '', { Location: prefix });
      if (!path.startsWith(prefix)) return send(404, 'fora do prefixo');
      path = path.slice(prefix.length - 1);
      if (path.endsWith('/')) path += 'index.html';
      const file = resolve(join(base, path));
      if (file !== base && !file.startsWith(base + sep)) return send(403);
      const s = await stat(file);
      if (s.isDirectory()) return send(301, '', { Location: req.url.replace(/\/?(\?.*)?$/, '/$1') });
      const data = await readFile(file);
      const headers = {
        'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'Content-Length': data.length,
      };
      if (file.endsWith(`${sep}sw.js`)) headers['Service-Worker-Allowed'] = prefix;
      send(200, data, headers);
    } catch {
      send(404, 'não encontrado');
    }
  });
  return new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, () => {
      const p = server.address().port;
      const url = `http://localhost:${p}${prefix}`;
      if (!quiet) {
        console.log(`Servindo ${root} em ${url}`);
        for (const list of Object.values(networkInterfaces())) {
          for (const a of list || []) if (a.family === 'IPv4' && !a.internal) console.log(`  na rede local: http://${a.address}:${p}${prefix}  (service worker só funciona em https/localhost)`);
        }
      }
      ok({ server, port: p, url, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}

if (process.argv[1] && /serve\.mjs$/.test(process.argv[1])) {
  const [root = 'game', port = '8080', prefix = '/icor/'] = process.argv.slice(2);
  startServer({ root, port: Number(port), prefix }).catch((e) => {
    console.error(e.code === 'EADDRINUSE' ? `Porta ${port} ocupada. Use outra: node tools/serve.mjs ${root} 0 ${prefix}` : e);
    process.exit(1);
  });
}
