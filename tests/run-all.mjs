// Roda todos os tests/*.test.mjs em sequência (cada um num processo Node separado),
// mostra um resumo e sai com código != 0 se algum falhar.
// Uso: node tests/run-all.mjs [filtro...] [--verbose]
//   filtro: parte do nome do arquivo (ex.: "combat" roda só combat.test.mjs)
import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..');
const args = process.argv.slice(2);
const verbose = args.includes('--verbose') || args.includes('-v');
const filters = args.filter((a) => !a.startsWith('-'));
const TIMEOUT = Number(process.env.TEST_TIMEOUT || 180000);

const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.test.mjs'))
  .filter((f) => !filters.length || filters.some((x) => f.includes(x)))
  .sort();

if (!files.length) {
  console.log(filters.length ? `Nenhum teste corresponde a: ${filters.join(', ')}` : 'Nenhum arquivo tests/*.test.mjs encontrado.');
  process.exit(filters.length ? 1 : 0);
}

function run(file) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [join(DIR, file)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; if (verbose) process.stdout.write(d); });
    child.stderr.on('data', (d) => { out += d; if (verbose) process.stderr.write(d); });
    const timer = setTimeout(() => { out += `\n[tempo esgotado após ${TIMEOUT / 1000}s]`; child.kill('SIGKILL'); }, TIMEOUT);
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ file, code: code ?? (signal ? 1 : 0), ms: Date.now() - t0, out });
    });
  });
}

console.log(`ICOR — ${files.length} arquivo(s) de teste\n`);
const results = [];
for (const f of files) {
  process.stdout.write(`▶ ${f} … `);
  const r = await run(f);
  results.push(r);
  console.log(`${r.code === 0 ? 'PASSOU' : 'FALHOU'} (${(r.ms / 1000).toFixed(1)}s)`);
  if (r.code !== 0 && !verbose) {
    const tail = r.out.trim().split('\n').slice(-25).join('\n');
    console.log(tail.replace(/^/gm, '    │ '));
  }
}

const bad = results.filter((r) => r.code !== 0);
const totalMs = results.reduce((s, r) => s + r.ms, 0);
console.log('\n──────── resumo ────────');
for (const r of results) {
  // tenta extrair "N ok, M falha(s)" ou similar da saída do arquivo
  const m = r.out.match(/(\d+)\s*(?:ok|passou|passaram|passed)[^\n]*?(\d+)\s*(?:falha|falhas|falhou|failed)/i);
  const counts = m ? ` [${m[1]} ok / ${m[2]} falha(s)]` : '';
  console.log(`${r.code === 0 ? '✔' : '✘'} ${r.file}${counts}`);
}
console.log(`\n${results.length - bad.length}/${results.length} arquivos passaram em ${(totalMs / 1000).toFixed(1)}s.`);
if (bad.length) {
  console.log(`Falharam: ${bad.map((r) => r.file).join(', ')}`);
  process.exit(1);
}
