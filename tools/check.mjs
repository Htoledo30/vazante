// Verificador de integração (sem dependências): percorre game/js e confere, arquivo por arquivo,
//   - sintaxe (node --check)
//   - importações estáticas e dinâmicas apontam para arquivos existentes (caminhos relativos)
//   - nomes importados existem nas exportações do módulo-alvo
//   - telas registradas (ids) e go('id') para telas inexistentes
//   - Math.random() em lógica (systems/ e data/), caminhos absolutos ('/...') e CSS referenciado
// Uso: node tools/check.mjs [--quiet]   (sai com 1 se houver erro; avisos não falham)
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GAME = join(ROOT, 'game');
const JS = join(GAME, 'js');
const quiet = process.argv.includes('--quiet');

const errors = [];
const warns = [];
const rel = (p) => relative(ROOT, p).split(sep).join('/');

function walk(d, out = []) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.js')) out.push(p);
  }
  return out;
}

/** Remove comentários (preserva strings, templates e quebras de linha). */
export function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  const NL = '\n';
  const BS = String.fromCharCode(92); // barra invertida
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== NL) i++; continue; }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === NL) out += NL; i++; }
      i += 2; continue;
    }
    if (c === '"' || c === "'" || c === '\x60') {
      const q = c; out += c; i++;
      while (i < n && src[i] !== q) {
        if (src[i] === BS) { out += src[i] + (src[i + 1] ?? ''); i += 2; continue; }
        out += src[i]; i++;
      }
      out += q; i++; continue;
    }
    out += c; i++;
  }
  return out;
}

/** Exportações de um módulo (regex; cobre os estilos usados no projeto). */
export function exportsOf(src) {
  const s = stripComments(src);
  const names = new Set();
  for (const m of s.matchAll(/export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of s.matchAll(/export\s+(?:const|let|var)\s+\{([^}]*)\}/g)) for (const n of m[1].split(',')) { const k = n.split(':').pop().trim(); if (k) names.add(k); }
  for (const m of s.matchAll(/export\s*\{([^}]*)\}(\s*from\s*['"][^'"]+['"])?/g)) {
    for (const part of m[1].split(',')) {
      const p = part.trim(); if (!p) continue;
      const as = p.split(/\s+as\s+/);
      names.add((as[1] || as[0]).trim());
    }
  }
  if (/export\s+default\b/.test(s)) names.add('default');
  const star = [...s.matchAll(/export\s*\*\s*from\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  return { names, star };
}

/** Importações: [{ spec, names:[...], dynamic, line }] */
export function importsOf(src) {
  const s = stripComments(src);
  const out = [];
  const lineOf = (idx) => s.slice(0, idx).split('\n').length;
  for (const m of s.matchAll(/import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    const clause = m[1];
    const names = [];
    const def = clause.match(/^([A-Za-z_$][\w$]*)\s*(,|$)/);
    if (def) names.push('default');
    const braces = clause.match(/\{([\s\S]*)\}/);
    if (braces) for (const part of braces[1].split(',')) { const p = part.trim(); if (p) names.push(p.split(/\s+as\s+/)[0].trim()); }
    out.push({ spec: m[2], names, dynamic: false, line: lineOf(m.index) });
  }
  for (const m of s.matchAll(/export\s*(?:\*|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g)) out.push({ spec: m[1], names: [], dynamic: false, line: lineOf(m.index) });
  for (const m of s.matchAll(/import\s+['"]([^'"]+)['"]/g)) out.push({ spec: m[1], names: [], dynamic: false, line: lineOf(m.index) });
  for (const m of s.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push({ spec: m[1], names: [], dynamic: true, line: lineOf(m.index) });
  return out;
}

const cache = new Map();
function modInfo(file) {
  if (!cache.has(file)) {
    const src = readFileSync(file, 'utf8');
    cache.set(file, { src, ...exportsOf(src) });
  }
  return cache.get(file);
}
function allExports(file, seen = new Set()) {
  if (seen.has(file)) return new Set();
  seen.add(file);
  const info = modInfo(file);
  const names = new Set(info.names);
  for (const spec of info.star) {
    const t = resolve(dirname(file), spec);
    if (existsSync(t)) for (const n of allExports(t, seen)) if (n !== 'default') names.add(n);
  }
  return names;
}

export function runCheck() {
  const files = walk(JS);
  const screensRegistered = new Set();
  const goTargets = [];
  for (const f of files) {
    // sintaxe
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
    catch (e) { errors.push(`${rel(f)}: erro de sintaxe — ${String(e.stderr || e.message).split('\n').find((l) => /Error/.test(l)) || ''}`); continue; }
    const { src } = modInfo(f);
    for (const imp of importsOf(src)) {
      if (!imp.spec.startsWith('.')) { if (!/^https?:/.test(imp.spec)) errors.push(`${rel(f)}:${imp.line}: importação não relativa "${imp.spec}"`); continue; }
      const target = resolve(dirname(f), imp.spec);
      if (!existsSync(target)) { (imp.dynamic ? warns : errors).push(`${rel(f)}:${imp.line}: módulo inexistente ${imp.spec}${imp.dynamic ? ' (import dinâmico)' : ''}`); continue; }
      if (!imp.names.length) continue;
      const ex = allExports(target);
      for (const n of imp.names) if (!ex.has(n)) errors.push(`${rel(f)}:${imp.line}: "${n}" não é exportado por ${imp.spec}`);
    }
    const clean = stripComments(src);
    if (/[\\/](systems|data)[\\/]/.test(f) && /Math\.random\s*\(/.test(clean)) warns.push(`${rel(f)}: Math.random() em lógica (use R/makeRng)`);
    if (/[\\/]screens[\\/]/.test(f)) {
      for (const m of clean.matchAll(/\bid:\s*'([a-z_][\w]*)'/g)) {
        const after = clean.slice(m.index, m.index + 400);
        if (/\b(render|hud)\s*[(:]/.test(after)) screensRegistered.add(m[1]);
      }
    }
    for (const m of clean.matchAll(/\bgo\(\s*'([a-z_][\w]*)'/g)) goTargets.push([f, m[1]]);
    if (/(['"])\/(?:js|css|icons)\//.test(clean)) warns.push(`${rel(f)}: caminho absoluto (use relativo para funcionar em /icor/)`);
  }
  for (const [f, id] of goTargets) if (!screensRegistered.has(id)) warns.push(`${rel(f)}: go('${id}') — tela não encontrada em nenhum módulo`);
  // CSS referenciado no index.html
  const html = readFileSync(join(GAME, 'index.html'), 'utf8');
  for (const m of html.matchAll(/href="([^"]+\.css)"/g)) if (!existsSync(join(GAME, m[1]))) warns.push(`index.html: CSS ausente ${m[1]}`);
  return { files: files.length, screens: [...screensRegistered].sort(), errors, warns };
}

if (process.argv[1] && /check\.mjs$/.test(process.argv[1])) {
  const r = runCheck();
  if (!quiet) console.log(`ICOR check — ${r.files} módulos, ${r.screens.length} telas: ${r.screens.join(', ')}\n`);
  for (const w of r.warns) console.log(`aviso  ${w}`);
  for (const e of r.errors) console.log(`ERRO   ${e}`);
  console.log(`\n${r.errors.length} erro(s), ${r.warns.length} aviso(s).`);
  process.exit(r.errors.length ? 1 : 0);
}
