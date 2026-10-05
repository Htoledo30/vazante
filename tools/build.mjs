// Build de produção: gera ícones (se faltarem), atualiza a versão/lista do service worker
// e copia o jogo para dist/ (pronto para GitHub Pages ou qualquer hospedagem estática).
import { existsSync, rmSync, mkdirSync, cpSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { genSW } from './gen-sw.mjs';

if (!existsSync('game/icons/icon-512.png')) execFileSync(process.execPath, ['tools/gen-icons.mjs', 'game/icons'], { stdio: 'inherit' });
const { version, count } = genSW('game');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('game', 'dist', { recursive: true });
writeFileSync('dist/.nojekyll', '');
console.log(`Build pronto em dist/ — versão ${version}, ${count} arquivos no cache offline.`);
