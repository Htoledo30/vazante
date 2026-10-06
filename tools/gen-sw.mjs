// Gera VERSION (hash do conteúdo) e ASSETS (lista de arquivos do cache offline) dentro de <root>/sw.js.
// O build roda isto sobre dist/ — game/sw.js fica com VERSION = 'dev' (rede primeiro, sem cache travado).
// Uso: node tools/gen-sw.mjs [root=dist]
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

const SKIP = new Set(['sw.js']);
const SKIP_EXT = /\.(map|md|log)$/i;

/** Lista (ordenada, com '/') de todos os arquivos servíveis em root, exceto sw.js e ocultos. */
export function listAssets(root) {
  const out = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      if (f.startsWith('.')) continue;
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (!SKIP.has(f) || d !== root) { if (!SKIP_EXT.test(f)) out.push(relative(root, p).split(sep).join('/')); }
    }
  };
  walk(root);
  return out.sort();
}

/** Hash curto e estável do conteúdo (nomes + bytes). */
export function contentVersion(root, assets = listAssets(root)) {
  const hash = createHash('sha256');
  for (const a of assets) hash.update(a).update('\0').update(readFileSync(join(root, a)));
  return hash.digest('hex').slice(0, 10);
}

/** Reescreve VERSION/ASSETS em root/sw.js. Retorna { version, count, assets }. */
export function genSW(root = 'dist') {
  const swPath = join(root, 'sw.js');
  if (!existsSync(swPath)) throw new Error(`sw.js não encontrado em ${root}`);
  const assets = listAssets(root);
  const version = contentVersion(root, assets);
  let sw = readFileSync(swPath, 'utf8');
  const before = sw;
  sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
  sw = sw.replace(/const ASSETS = \[[\s\S]*?\];/, `const ASSETS = [\n${assets.map((a) => `  '${a}',`).join('\n')}\n];`);
  if (sw === before && !before.includes(`'${version}'`)) throw new Error('sw.js sem marcadores VERSION/ASSETS');
  writeFileSync(swPath, sw);
  return { version, count: assets.length, assets };
}

if (process.argv[1] && /gen-sw\.mjs$/.test(process.argv[1])) {
  const r = genSW(process.argv[2] || 'dist');
  console.log(`sw.js atualizado: versão ${r.version}, ${r.count} arquivos`);
}
