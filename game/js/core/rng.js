// Gerador pseudoaleatório com estado serializável (mulberry32).
// O estado vive dentro do save, então recarregar não "rerrola" resultados.

export function makeRng(seed) {
  return { s: (seed >>> 0) || 0x9e3779b9 };
}

export function rnd(r) {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const rint = (r, a, b) => a + Math.floor(rnd(r) * (b - a + 1));
export const chance = (r, p) => rnd(r) < p;
export const pick = (r, arr) => arr[Math.floor(rnd(r) * arr.length)];

export function shuffle(r, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd(r) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function weighted(r, items, wf = (x) => x.w) {
  let total = 0;
  for (const it of items) total += Math.max(0, wf(it));
  if (total <= 0) return items[0];
  let v = rnd(r) * total;
  for (const it of items) {
    v -= Math.max(0, wf(it));
    if (v <= 0) return it;
  }
  return items[items.length - 1];
}

// Sorteia n itens distintos.
export function sample(r, arr, n) {
  return shuffle(r, arr).slice(0, n);
}

export function newSeed() {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
