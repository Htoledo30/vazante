// Build de produção: gera ícones (se faltarem), copia game/ -> dist/, grava a versão
// (hash do conteúdo) e a lista de arquivos do cache offline em dist/sw.js e cria dist/.nojekyll.
// Pronto para GitHub Pages (subpasta) ou qualquer hospedagem estática.
// Uso: node tools/build.mjs [--out dist]
import { existsSync, rmSync, mkdirSync, cpSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { genSW } from './gen-sw.mjs';
import { genIcons, ICON_FILES } from './gen-icons.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'game');
const outArg = process.argv.indexOf('--out');
const OUT = join(ROOT, outArg > 0 ? process.argv[outArg + 1] : 'dist');

export function build({ src = SRC, out = OUT, quiet = false } = {}) {
  const log = (...a) => { if (!quiet) console.log(...a); };
  const iconsDir = join(src, 'icons');
  if (ICON_FILES.some(([f]) => !existsSync(join(iconsDir, f)))) {
    log('gerando ícones…');
    genIcons(iconsDir);
  }
  // sanidade: manifest precisa ser JSON válido
  JSON.parse(readFileSync(join(src, 'manifest.webmanifest'), 'utf8'));

  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  cpSync(src, out, { recursive: true, filter: (p) => !/[\\/]\.[^\\/]+$/.test(p) });
  const { version, count } = genSW(out);
  writeFileSync(join(out, '.nojekyll'), '');
  writeFileSync(join(out, 'version.txt'), `${version}\n`);
  log(`Build pronto em ${out} — versão ${version}, ${count} arquivos no cache offline.`);
  return { version, count, out };
}

if (process.argv[1] && /build\.mjs$/.test(process.argv[1])) build();
