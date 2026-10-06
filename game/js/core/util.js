// Utilidades puras usadas em todo o jogo.
import { getG } from './state.js';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + f(x), 0);
export const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
export const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
export const round = (n) => Math.round(n);
export const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
export const pct = (n) => `${Math.round(n)}%`;
export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** id único e serializável (contador dentro do save). */
export function uid(prefix = 'u') {
  const G = getG();
  if (G) { G.uidSeq = (G.uidSeq || 0) + 1; return `${prefix}${G.uidSeq}`; }
  return `${prefix}${Math.random().toString(36).slice(2, 9)}`;
}

/** horas absolutas -> { day, hour } (dia começa em 1). */
export function timeOf(totalHours) {
  return { day: Math.floor(totalHours / 24) + 1, hour: totalHours % 24 };
}
export const isNightHour = (h) => h >= 20 || h < 6;
export function fmtHour(h) { return `${String(Math.floor(h)).padStart(2, '0')}h`; }

/** Escapa texto para uso seguro em innerHTML (preferir h() que já usa textContent). */
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Escolhe por peso sem RNG global (usa valor 0..1 fornecido). */
export function pickWeightedWith(list, roll, getW = (x) => x.w ?? 1) {
  const total = sum(list, getW);
  let r = roll * total;
  for (const x of list) { r -= getW(x); if (r < 0) return x; }
  return list[list.length - 1];
}
