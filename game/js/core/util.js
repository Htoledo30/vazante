// Utilitários puros (sem DOM) usados pela lógica do jogo e pela interface.

export const DIRS = [
  { x: 0, y: -1, n: 'norte' },
  { x: 1, y: 0, n: 'leste' },
  { x: 0, y: 1, n: 'sul' },
  { x: -1, y: 0, n: 'oeste' },
];
export const DIAG = [{ x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }];
export const DIR8 = [...DIRS, ...DIAG];
export const ARROWS = ['↑', '→', '↓', '←'];

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export const opposite = (d) => (d + 2) % 4;
export const key = (x, y) => x + ',' + y;

// Direção (0..3) se os pontos estão alinhados em linha reta, senão -1.
export function dirTo(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (dx === 0 && dy < 0) return 0;
  if (dy === 0 && dx > 0) return 1;
  if (dx === 0 && dy > 0) return 2;
  if (dy === 0 && dx < 0) return 3;
  return -1;
}

// Melhor direção cardinal aproximada de from para to.
export function dirToward(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return dx > 0 ? 1 : 3;
  if (dy !== 0) return dy > 0 ? 2 : 0;
  return 0;
}

export function sum(arr, f = (x) => x) { let s = 0; for (const a of arr) s += f(a); return s; }
export function uniq(arr) { return [...new Set(arr)]; }
export function fmtSigned(n) { return n > 0 ? '+' + n : '' + n; }
