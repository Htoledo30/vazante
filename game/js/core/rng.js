// RNG determinístico (mulberry32) com estado serializável.
// R usa o estado guardado em G.rng (persistido no save) — assim recarregar não "re-rola" resultados.
// makeRng(seed) cria um gerador independente (ex.: geração de mapa a partir da seed da campanha).
import { getG } from './state.js';

function step(s) {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [s, ((t ^ (t >>> 14)) >>> 0) / 4294967296];
}

export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < String(str).length; i++) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function api(next) {
  const r = {
    float: () => next(),
    /** inteiro em [a, b] inclusivo */
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    /** pct em 0..100 */
    chance: (pct) => next() * 100 < pct,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** list: [[valor, peso], ...] ou [{w, ...}] com getW */
    weighted(list, getW) {
      const w = (x) => (getW ? getW(x) : x[1]);
      const total = list.reduce((s, x) => s + Math.max(0, w(x)), 0);
      if (total <= 0) return getW ? list[0] : list[0]?.[0];
      let roll = next() * total;
      for (const x of list) {
        roll -= Math.max(0, w(x));
        if (roll < 0) return getW ? x : x[0];
      }
      return getW ? list[list.length - 1] : list[list.length - 1][0];
    },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    /** rola NdM */
    dice: (n, m) => { let s = 0; for (let i = 0; i < n; i++) s += 1 + Math.floor(next() * m); return s; },
    /** valor em [min,max] */
    range: (mm) => mm[0] + Math.floor(next() * (mm[1] - mm[0] + 1)),
  };
  return r;
}

let fallback = (Date.now() ^ 0x5bd1e995) >>> 0;

/** RNG global da campanha (estado em G.rng). */
export const R = api(() => {
  const G = getG();
  let v;
  if (G) { [G.rng, v] = step(G.rng >>> 0); }
  else { [fallback, v] = step(fallback); }
  return v;
});

/** Gerador independente com seed própria. */
export function makeRng(seed) {
  let s = (typeof seed === 'number' ? seed : hashSeed(seed)) >>> 0;
  return api(() => { let v; [s, v] = step(s); return v; });
}
