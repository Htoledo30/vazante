// ICOR — Geração do mapa de nós de uma região (Área C).
// Determinístico: mesma seed + região = mesmo mapa. Gerado UMA vez por campanha e salvo em G.world.regions[id].map.
// Estrutura em camadas (profundidade): entrada embaixo (camada 0), chefe no topo (maior profundidade).
// Toda aresta é bidirecional e tem terreno/horas/perigo. Todos os nós são alcançáveis a partir da entrada.
import { makeRng, hashSeed } from '../core/rng.js';
import { REGIONS } from '../data/regions.js';

export const MAP_VERSION = 1;
const LAYER_GAP = 17;   // distância vertical entre camadas (unidades do mapa; largura = 100)
const MARGIN_Y = 11;

const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * genRegionMap(seed, regionId) -> { v, region, nodes:{id:{id,x,y,type,depth,links,name}}, edges:[{a,b,terrain,name,h,hazard}], entry, boss, w, h, layers }
 */
export function genRegionMap(seed, regionId) {
  const reg = REGIONS[regionId];
  if (!reg) throw new Error(`Região desconhecida: ${regionId}`);
  const rng = makeRng(((Number(seed) >>> 0) ^ hashSeed(`map:${regionId}`)) >>> 0);

  const N = clampN(reg.nodeCount + rng.int(-1, 1), 18, 30);
  let L = clampN(Math.round(N / 3.1), 6, 10);
  const K = N - 2;
  while (2 * (L - 2) > K) L--;
  while (5 * (L - 2) < K) L++;
  const M = L - 2;

  // ---- distribuir nós nas camadas do meio (2..5 por camada) ----
  const counts = new Array(M).fill(2);
  let rest = K - 2 * M;
  let guard = 0;
  while (rest > 0 && guard++ < 1000) {
    const i = rng.int(0, M - 1);
    if (counts[i] < 5) { counts[i]++; rest--; }
  }

  const H = MARGIN_Y * 2 + (L - 1) * LAYER_GAP;
  const nodes = {};
  const layers = [];
  let seq = 0;
  const mk = (depth, x, y) => {
    const id = `n${seq++}`;
    nodes[id] = { id, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, type: 'event', depth, links: [], name: '' };
    return id;
  };
  const yOf = (layer) => H - MARGIN_Y - layer * LAYER_GAP;

  layers.push([mk(0, 50 + rng.int(-6, 6), yOf(0))]);
  for (let li = 0; li < M; li++) {
    const c = counts[li];
    const slot = 84 / c;
    const ids = [];
    for (let i = 0; i < c; i++) {
      const x = 8 + (i + 0.5) * slot + (rng.float() - 0.5) * slot * 0.36;
      const y = yOf(li + 1) + (rng.float() - 0.5) * 6;
      ids.push(mk(li + 1, clampN(x, 7, 93), y));
    }
    layers.push(ids);
  }
  layers.push([mk(L - 1, 50 + rng.int(-6, 6), yOf(L - 1))]);

  const entry = layers[0][0];
  const boss = layers[L - 1][0];

  // ---- ligações ----
  const linkSet = new Set();
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const link = (a, b) => {
    if (a === b || linkSet.has(key(a, b))) return false;
    linkSet.add(key(a, b));
    nodes[a].links.push(b); nodes[b].links.push(a);
    return true;
  };
  const between = []; // pares verticais por camada, para teste de cruzamento
  const crosses = (li, a, b) => (between[li] || []).some(([a2, b2]) =>
    a2 !== a && b2 !== b && (nodes[a].x - nodes[a2].x) * (nodes[b].x - nodes[b2].x) < 0);
  const vlink = (li, a, b, force = false) => {
    if (!force && crosses(li, a, b)) return false;
    if (link(a, b)) { (between[li] = between[li] || []).push([a, b]); return true; }
    return false;
  };

  for (let li = 0; li < L - 1; li++) {
    const A = layers[li].slice().sort((p, q) => nodes[p].x - nodes[q].x);
    const B = layers[li + 1].slice().sort((p, q) => nodes[p].x - nodes[q].x);
    const isBossLayer = li + 1 === L - 1;
    if (isBossLayer) {
      // o covil só é alcançado por 1–2 antecâmaras
      const near = A.slice().sort((p, q) => Math.abs(nodes[p].x - nodes[boss].x) - Math.abs(nodes[q].x - nodes[boss].x));
      const n = A.length >= 3 && rng.chance(55) ? 2 : 1;
      for (let i = 0; i < n; i++) vlink(li, near[i], boss, true);
      continue;
    }
    for (const a of A) {
      const byDist = B.slice().sort((p, q) => Math.abs(nodes[p].x - nodes[a].x) - Math.abs(nodes[q].x - nodes[a].x));
      vlink(li, a, byDist[0], true);
      if (byDist[1] && rng.chance(38) && Math.abs(nodes[byDist[1]].x - nodes[a].x) < 32) vlink(li, a, byDist[1]);
    }
    for (const b of B) {
      if (nodes[b].links.some((x) => nodes[x].depth === li)) continue;
      const byDist = A.slice().sort((p, q) => Math.abs(nodes[p].x - nodes[b].x) - Math.abs(nodes[q].x - nodes[b].x));
      if (!byDist.some((a) => vlink(li, a, b))) vlink(li, byDist[0], b, true);
    }
  }
  // ligações laterais (rotas alternativas, voltas)
  for (let li = 1; li < L - 1; li++) {
    const A = layers[li].slice().sort((p, q) => nodes[p].x - nodes[q].x);
    for (let i = 0; i < A.length - 1; i++) {
      if (Math.abs(nodes[A[i]].x - nodes[A[i + 1]].x) < 26 && rng.chance(20)) link(A[i], A[i + 1]);
    }
  }

  // ---- arestas com terreno ----
  const edges = [];
  for (const k of linkSet) {
    const [a, b] = k.split('|');
    const t = rng.weighted(reg.terrains.map((x) => [x, x.w]));
    edges.push({ a, b, terrain: t.id, name: t.name, h: t.h, hazard: t.hazard || null });
  }
  edges.sort((p, q) => (p.a + p.b < q.a + q.b ? -1 : 1));

  // ---- tipos ----
  nodes[entry].type = 'entry';
  nodes[boss].type = 'boss';
  const free = new Set(Object.keys(nodes).filter((id) => id !== entry && id !== boss));
  const take = (id, type) => { nodes[id].type = type; free.delete(id); };
  const pickFrom = (list) => (list.length ? list[Math.floor(rng.float() * list.length)] : null);
  const layerOf = (li) => (layers[li] || []).filter((id) => free.has(id));

  // passagem: camadas médias/tardias, de preferência nas bordas
  {
    const lo = Math.max(2, Math.ceil(L * 0.45)), hi = Math.max(lo, L - 3);
    let cands = [];
    for (let li = lo; li <= hi; li++) cands.push(...layerOf(li));
    if (!cands.length) cands = [...free];
    cands.sort((p, q) => Math.abs(nodes[q].x - 50) - Math.abs(nodes[p].x - 50));
    take(pickFrom(cands.slice(0, Math.max(1, Math.ceil(cands.length / 2)))), 'passage');
  }
  // antecâmara do chefe: acampamento ou santuário (última chance de respirar)
  const ante = nodes[boss].links.filter((id) => free.has(id));
  if (ante.length) {
    const roll = rng.float();
    if (roll < 0.5) take(ante[0], 'camp');
    else if (roll < 0.8) take(ante[0], 'shrine');
  }
  // ninhos: longe da entrada, em camadas diferentes
  {
    const usedLayers = new Set();
    for (let n = 0; n < (reg.nests || 1); n++) {
      let cands = [];
      for (let li = 2; li <= L - 2; li++) if (!usedLayers.has(li)) cands.push(...layerOf(li));
      if (!cands.length) for (let li = 2; li <= L - 2; li++) cands.push(...layerOf(li));
      const id = pickFrom(cands);
      if (!id) break;
      usedLayers.add(nodes[id].depth);
      take(id, 'nest');
    }
  }
  // abrigo cedo
  {
    const c = pickFrom([...layerOf(1), ...layerOf(2)]);
    if (c) take(c, 'camp');
  }
  // um de cada tipo essencial
  for (const t of ['vein', 'ruin', 'shrine', 'merchant', 'event', 'combat']) {
    if ((reg.nodeWeights[t] || 0) <= 0) continue;
    const minLayer = t === 'merchant' || t === 'vein' ? 2 : 1;
    const cands = [...free].filter((id) => nodes[id].depth >= minLayer);
    const id = pickFrom(cands);
    if (id) take(id, t);
  }
  // resto por peso
  const caps = { merchant: 2, camp: 4, shrine: 3 };
  const countType = (t) => Object.values(nodes).filter((n) => n.type === t && !free.has(n.id)).length;
  for (const id of [...free].sort()) {
    const opts = Object.entries(reg.nodeWeights)
      .filter(([t]) => !(caps[t] && countType(t) >= caps[t]))
      .filter(([t]) => !(nodes[id].depth === 1 && (t === 'vein' || t === 'merchant')))
      .map(([t, w]) => [t, w]);
    take(id, rng.weighted(opts));
  }

  // ---- nomes ----
  const pools = {};
  for (const id of Object.keys(nodes).sort((p, q) => Number(p.slice(1)) - Number(q.slice(1)))) {
    const n = nodes[id];
    const list = reg.names[n.type] || ['Lugar sem nome'];
    if (!pools[n.type] || !pools[n.type].length) pools[n.type] = rng.shuffle(list);
    n.name = pools[n.type].pop();
  }

  return { v: MAP_VERSION, region: regionId, nodes, edges, entry, boss, w: 100, h: H, layers: L };
}

// ---------------- consultas de grafo (puras) ----------------

export function edgeOf(map, a, b) {
  return map.edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a)) || null;
}

export function neighbors(map, id) {
  return map.nodes[id]?.links.slice() || [];
}

/** Conjunto de nós alcançáveis a partir de `from` (BFS). */
export function reachableFrom(map, from) {
  const seen = new Set([from]);
  const q = [from];
  while (q.length) {
    const cur = q.shift();
    for (const n of map.nodes[cur].links) if (!seen.has(n)) { seen.add(n); q.push(n); }
  }
  return seen;
}

/** Distâncias em saltos a partir de `from`. */
export function hopDistances(map, from) {
  const dist = { [from]: 0 };
  const q = [from];
  while (q.length) {
    const cur = q.shift();
    for (const n of map.nodes[cur].links) if (dist[n] == null) { dist[n] = dist[cur] + 1; q.push(n); }
  }
  return dist;
}

/**
 * Caminho mais curto (Dijkstra). opts.allow(id) restringe nós intermediários; opts.cost(edge) custo da aresta.
 * Retorna { path:[ids], cost } ou null.
 */
export function shortestPath(map, from, to, opts = {}) {
  const allow = opts.allow || (() => true);
  const cost = opts.cost || ((e) => e.h);
  const dist = { [from]: 0 };
  const prev = {};
  const open = new Set([from]);
  const done = new Set();
  while (open.size) {
    let cur = null;
    for (const n of open) if (cur === null || dist[n] < dist[cur]) cur = n;
    open.delete(cur);
    if (cur === to) break;
    done.add(cur);
    for (const n of map.nodes[cur].links) {
      if (done.has(n)) continue;
      if (n !== to && !allow(n)) continue;
      const e = edgeOf(map, cur, n);
      const d = dist[cur] + cost(e);
      if (dist[n] == null || d < dist[n]) { dist[n] = d; prev[n] = cur; open.add(n); }
    }
  }
  if (dist[to] == null) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(prev[path[0]]);
  return { path, cost: dist[to] };
}

/** Validação estrutural (usada em testes e ao carregar saves antigos). */
export function validateMap(map) {
  const errs = [];
  if (!map?.nodes?.[map.entry]) errs.push('sem entrada');
  if (!map?.nodes?.[map.boss]) errs.push('sem chefe');
  if (errs.length) return errs;
  const reach = reachableFrom(map, map.entry);
  for (const id of Object.keys(map.nodes)) if (!reach.has(id)) errs.push(`inalcançável: ${id}`);
  const maxDepth = Math.max(...Object.values(map.nodes).map((n) => n.depth));
  if (map.nodes[map.boss].depth !== maxDepth) errs.push('chefe fora da maior profundidade');
  if (Object.values(map.nodes).filter((n) => n.depth === maxDepth).length !== 1) errs.push('mais de um nó na profundidade do chefe');
  for (const e of map.edges) if (!map.nodes[e.a] || !map.nodes[e.b]) errs.push(`aresta inválida ${e.a}-${e.b}`);
  return errs;
}
