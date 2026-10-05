// Planejamento dos inimigos: mover e telegrafar a próxima ação.
import { DIRS, key, manhattan } from '../core/util.js';
import {
  getHero, unitAt, liveEnemies, defOf, reachable, pathTo, distMap, tileAt, isWater, isDeep,
  hasTag, inB, walkable, solidTile, addStatus, ev, isFlying,
} from './engine.js';
import { shapeOf, walkEnemy } from './attacks.js';
import { rnd } from '../core/rng.js';

export function planAll(c) {
  let order = 1;
  const list = liveEnemies(c).sort((a, b) => (a.prio || 0) - (b.prio || 0) || a.id - b.id);
  for (const u of list) {
    if (u.hp <= 0) continue;
    if (u.intent) { u.intent.order = order++; continue; } // ataque carregando
    planEnemy(c, u);
    if (u.intent && u.hp > 0) u.intent.order = order++;
  }
}

export function tickEnemyStart(c, u) {
  const st = u.st;
  const flags = { rooted: !!st.root, flipped: !!st.flip };
  if (st.stun) delete st.stun;
  if (st.shield) delete st.shield;
  for (const s of ['root', 'mark', 'flip', 'fort', 'shell', 'oiled', 'bleed']) {
    if (st[s]) { st[s]--; if (st[s] <= 0) delete st[s]; }
  }
  if (st.wet && !isWater(c, u.x, u.y)) { st.wet--; if (st.wet <= 0) delete st.wet; }
  if (u.mem.cd) for (const k in u.mem.cd) if (u.mem.cd[k] > 0) u.mem.cd[k]--;
  return flags;
}

export function planEnemy(c, u) {
  const d = defOf(u);
  const fl = tickEnemyStart(c, u);
  if (fl.flipped) { u.intent = null; return; }
  if (d.plan) { d.plan(c, u, fl); return; }
  genericPlan(c, u, d, fl);
}

export function availableAttacks(c, u, d, only) {
  const out = [];
  d.attacks.forEach((a, i) => {
    if (a.passive) return;
    if (only && !only.includes(i)) return;
    if (u.mem.cd && u.mem.cd[i] > 0) return;
    if (a.when && !a.when(c, u)) return;
    out.push(i);
  });
  return out;
}

export function candidateIntents(c, u, a, ai) {
  const h = getHero(c);
  const out = [];
  switch (a.kind) {
    case 'strike': case 'line': case 'beam': case 'charge': case 'pull':
      for (let d = 0; d < 4; d++) out.push({ ai, dir: d });
      break;
    case 'cross': case 'slam': case 'burst': case 'tide':
      out.push({ ai });
      break;
    case 'lob': {
      const targets = c.units.filter((v) => v.hp > 0 && (v.side === 'player' || v.side === 'ally'));
      for (const v of targets) {
        const dist = manhattan(u, v);
        if (dist <= (a.range || 4) && dist >= (a.minRange ?? 2)) out.push({ ai, tx: v.x, ty: v.y });
      }
      break;
    }
    case 'spawn': {
      const tiles = freeTilesNear(c, a.near === 'hero' && h ? h : u, a.count || 1, a.near === 'hero' ? 2 : 1, a.spawnWater);
      if (tiles.length) out.push({ ai, tiles });
      break;
    }
    case 'coral': {
      if (a.pattern) { const tiles = a.pattern(c, u); if (tiles.length) out.push({ ai, tiles }); }
      break;
    }
    case 'buff': {
      for (const v of c.units) {
        if (v.hp <= 0 || v.side !== 'enemy' || (v === u && !a.self)) continue;
        if (manhattan(u, v) <= (a.range || 3)) out.push({ ai, target: v.id });
      }
      break;
    }
    default: break;
  }
  return out;
}

function freeTilesNear(c, p, n, radius, needWater) {
  const list = [];
  for (let y = p.y - radius; y <= p.y + radius; y++) for (let x = p.x - radius; x <= p.x + radius; x++) {
    if (!inB(c, x, y) || (x === p.x && y === p.y)) continue;
    const t = tileAt(c, x, y);
    if (solidTile(t) || t.t === 'pit' || unitAt(c, x, y)) continue;
    if (needWater && !isWater(c, x, y)) continue;
    list.push({ x, y, d: Math.abs(x - p.x) + Math.abs(y - p.y) + rnd(c.rng) * 0.5 });
  }
  list.sort((a, b) => a.d - b.d);
  return list.slice(0, n).map((q) => ({ x: q.x, y: q.y }));
}

// Pontua o resultado de uma intenção (quanto maior, melhor para o inimigo).
export function scoreIntent(c, u, a, it, d) {
  if (a.kind === 'tide') return a.score ? a.score(c, u) : 3;
  if (a.kind === 'spawn') return 5;
  if (a.kind === 'buff') {
    const v = c.units.find((w) => w.id === it.target);
    if (!v) return 0;
    let s = 2;
    if (a.heal) s += (v.maxHp - v.hp) * 2;
    if (a.shield && !v.st.shield) s += 3 + (hasTag(v, 'boss') ? 4 : 0);
    if (a.fort && !v.st.fort) s += 2;
    return s;
  }
  const sh = shapeOf(c, u, a, it);
  let s = 0;
  const reckless = d && d.reckless;
  for (const h of sh.hits) {
    const v = unitAt(c, h.x, h.y);
    if (a.kind === 'coral') {
      if (v && v.side === 'player') s += 8 + h.dmg * 2;
      else if (!v) s += a.idleScore ?? 1;
      continue;
    }
    if (!v || v === u) {
      const t = tileAt(c, h.x, h.y);
      if (t && t.obj && t.obj.k === 'barrel') {
        const hero = getHero(c);
        if (hero && Math.max(Math.abs(hero.x - h.x), Math.abs(hero.y - h.y)) <= 1) s += 6;
      }
      continue;
    }
    if (v.st.sub) continue;
    if (v.side === 'player') s += 10 + h.dmg * 2 + (h.push != null ? 2 : 0) + (a.st ? 2 : 0);
    else if (v.side === 'ally') s += 7 + h.dmg;
    else if (v.side === 'enemy') s -= reckless ? 1 : 9;
  }
  return s;
}

function positionScore(c, u, d, x, y) {
  const t = tileAt(c, x, y);
  let s = 0;
  if (t.fire && !isFlying(u)) s -= 6;
  if (isDeep(c, x, y) && !isFlying(u)) {
    if (hasTag(u, 'heavy')) s -= 999;
    else if (!hasTag(u, 'aquatic')) s -= 4;
  }
  if (hasTag(u, 'aquatic') && isWater(c, x, y)) s += 1;
  if (t.oil && !isFlying(u)) s -= 1;
  return s;
}

export function genericPlan(c, u, d, fl = {}, only = null) {
  const hero = getHero(c);
  if (!hero) { u.intent = null; return; }
  const mv = (fl.rooted || u.st.stranded || hasTag(u, 'immobile')) ? 0 : u.move;
  const reach = reachable(c, u, mv);
  const atks = availableAttacks(c, u, d, only);
  const ox = u.x, oy = u.y;
  let best = null;
  for (const node of reach.values()) {
    u.x = node.x; u.y = node.y;
    const ps = positionScore(c, u, d, node.x, node.y);
    for (const ai of atks) {
      const a = d.attacks[ai];
      for (const it of candidateIntents(c, u, a, ai)) {
        const s = scoreIntent(c, u, a, it, d);
        if (s <= 0) continue;
        const total = s * (a.weight || 1) + ps - node.cost * 0.15 + rnd(c.rng) * 0.3;
        if (!best || total > best.score) best = { node, ai, it, score: total };
      }
    }
  }
  u.x = ox; u.y = oy;
  if (best && best.score > 0) {
    walkEnemy(c, u, best.node, pathTo);
    if (u.hp <= 0) return;
    const a = d.attacks[best.ai];
    u.intent = { ...best.it };
    if (a.windup) u.intent.windup = a.windup;
    if (a.cd) { u.mem.cd = u.mem.cd || {}; u.mem.cd[best.ai] = a.cd + 1; }
    return;
  }
  approach(c, u, d, reach, hero);
  u.intent = null;
  if (d.idle) d.idle(c, u);
}

// Sem ataque possível: aproxima-se (ou mantém distância preferida).
export function approach(c, u, d, reach, target) {
  if (!reach || reach.size <= 1) return;
  const dm = distMap(c, target, u);
  const pref = d.keepDist || 1;
  let best = null;
  for (const node of reach.values()) {
    const dist = dm.get(key(node.x, node.y));
    const dd = dist == null ? 50 : dist;
    let s = -Math.abs(dd - pref) * 3 + positionScore(c, u, d, node.x, node.y) - node.cost * 0.1;
    if (d.preferWater && isWater(c, node.x, node.y)) s += 2;
    s += rnd(c.rng) * 0.2;
    if (!best || s > best.s) best = { node, s };
  }
  if (best) walkEnemy(c, u, best.node, pathTo);
}

export { walkable };
