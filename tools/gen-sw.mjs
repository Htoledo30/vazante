// Gera a lista de arquivos do cache offline e a versão (hash do conteúdo) dentro de game/sw.js.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

export function listAssets(root) {
  const out = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (!f.startsWith('.') && f !== 'sw.js') out.push(relative(root, p).split(sep).join('/'));
    }
  };
  walk(root);
  return out.sort();
}

export function genSW(root) {
  const assets = listAssets(root);
  const hash = createHash('sha256');
  for (const a of assets) hash.update(a).update(readFileSync(join(root, a)));
  const version = hash.digest('hex').slice(0, 10);
  const swPath = join(root, 'sw.js');
  let sw = readFileSync(swPath, 'utf8');
  sw = sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`);
  sw = sw.replace(/const ASSETS = \[[\s\S]*?\];/, `const ASSETS = [\n  './',\n${assets.map((a) => `  '${a}',`).join('\n')}\n];`);
  writeFileSync(swPath, sw);
  return { version, count: assets.length };
}

if (process.argv[1] && process.argv[1].endsWith('gen-sw.mjs')) {
  const r = genSW(process.argv[2] || 'game');
  console.log(`sw.js atualizado: versão ${r.version}, ${r.count} arquivos`);
}
