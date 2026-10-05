// Motor de combate: regras puras sobre o estado serializável do combate.
// Nada aqui toca no DOM. A interface lê `c.ev` (eventos para animar) e `c.log`.
import { DIRS, DIR8, clamp, key } from '../core/util.js';
import { rnd } from '../core/rng.js';
import { REG } from './registry.js';

export const MAX_TIDE = 4;

// ---------- utilitários de estado ----------
export function ev(c, e) { c.ev.push(e); }
export function log(c, m, cls = '') {
  c.log.push({ m, c: cls, r: c.round });
  if (c.log.length > 80) c.log.shift();
}
export const inB = (c, x, y) => x >= 0 && y >= 0 && x < c.w && y < c.h;
export const tileAt = (c, x, y) => (inB(c, x, y) ? c.tiles[y * c.w + x] : null);

export function depth(c, x, y) {
  const t = tileAt(c, x, y);
  if (!t || t.t === 'wall' || t.t === 'pit') return 0;
  return Math.max(0, c.tide + (t.tm || 0) - t.e);
}
export const isWater = (c, x, y) => depth(c, x, y) > 0;
export const isDeep = (c, x, y) => depth(c, x, y) >= 2;

export function getHero(c) { return c.units.find((u) => u.side === 'player' && u.hp > 0) || null; }
export function unitAt(c, x, y) {
  for (const u of c.units) if (u.hp > 0 && u.x === x && u.y === y) return u;
  return null;
}
export function unitById(c, id) { return c.units.find((u) => u.id === id && u.hp > 0) || null; }
export function liveEnemies(c) { return c.units.filter((u) => u.hp > 0 && u.side === 'enemy'); }
export function defOf(u) { return u.def === 'hero' ? null : REG.enemies[u.def]; }
export function hasTag(u, t) { return !!(u && u.tags && u.tags.includes(t)); }
export function isFlying(u) { return hasTag(u, 'flying'); }
export function isBoss(u) { return hasTag(u, 'boss'); }
export function isSwimmer(u) { return hasTag(u, 'aquatic') || hasTag(u, 'swimmer') || isFlying(u); }

export function solidTile(t) { return !t || t.t === 'wall' || t.t === 'coral' || !!t.obj; }

// Pode parar/andar neste quadrado?
export function walkable(c, x, y, u) {
  const t = tileAt(c, x, y);
  if (!t || solidTile(t)) return false;
  if (t.t === 'pit' && !isFlying(u)) return false;
  if (u && hasTag(u, 'waterOnly') && !isWater(c, x, y)) return false;
  return true;
}

export function moveCost(c, u, x, y) {
  if (isFlying(u) || isSwimmer(u) || (u.mods && u.mods.waterWalk)) return 1;
  return isWater(c, x, y) ? 2 : 1;
}

// Dijkstra: quadrados alcançáveis com o movimento disponível.
// Unidades do mesmo lado podem ser atravessadas, mas não ocupadas.
export function reachable(c, u, maxMove) {
  const res = new Map();
  const start = { x: u.x, y: u.y, cost: 0, prev: null };
  res.set(key(u.x, u.y), start);
  const open = [start];
  while (open.length) {
    open.sort((a, b) => a.cost - b.cost);
    const cur = open.shift();
    const curT = tileAt(c, cur.x, cur.y);
    if (cur !== start && curT.t === 'kelp' && !isSwimmer(u)) continue; // algas prendem
    for (const d of DIRS) {
      const nx = cur.x + d.x, ny = cur.y + d.y;
      if (!walkable(c, nx, ny, u)) continue;
      const occ = unitAt(c, nx, ny);
      if (occ && occ !== u && (occ.side === 'enemy') !== (u.side === 'enemy')) continue;
      if (occ && occ !== u && occ.side === 'neutral') continue;
      const cost = cur.cost + moveCost(c, u, nx, ny);
      if (cost > maxMove) continue;
      const k = key(nx, ny);
      const old = res.get(k);
      if (old && old.cost <= cost) continue;
      const node = { x: nx, y: ny, cost, prev: cur };
      res.set(k, node);
      open.push(node);
    }
  }
  // remove quadrados ocupados por outros (pode atravessar aliados mas não parar)
  for (const [k, n] of res) {
    const occ = unitAt(c, n.x, n.y);
    if (occ && occ !== u) res.delete(k);
  }
  return res;
}

export function pathTo(node) {
  const p = [];
  for (let n = node; n; n = n.prev) p.unshift({ x: n.x, y: n.y });
  return p;
}

// Distância de caminho (BFS ignorando custos de água) — usada pela IA.
export function distMap(c, from, u, ignoreUnits = true) {
  const dist = new Map();
  const q = [{ x: from.x, y: from.y }];
  dist.set(key(from.x, from.y), 0);
  while (q.length) {
    const cur = q.shift();
    const dcur = dist.get(key(cur.x, cur.y));
    for (const d of DIRS) {
      const nx = cur.x + d.x, ny = cur.y + d.y;
      const k = key(nx, ny);
      if (dist.has(k) || !inB(c, nx, ny)) continue;
      const t = tileAt(c, nx, ny);
      if (t.t === 'wall' || t.obj) continue;
      if (t.t === 'coral' && !hasTag(u, 'coralWalker')) continue;
      if (t.t === 'pit' && !isFlying(u)) continue;
      if (!ignoreUnits && unitAt(c, nx, ny)) continue;
      dist.set(k, dcur + 1);
      q.push({ x: nx, y: ny });
    }
  }
  return dist;
}

// ---------- estados ----------
export function addStatus(c, u, s, n) {
  if (!u || u.hp <= 0) return;
  const st = u.st;
  if (s === 'burn') {
    if (u.st.wet || hasTag(u, 'fireImmune') || isWater(c, u.x, u.y)) return;
    if (u.side === 'player' && u.mods.noBurn) return;
  }
  if (s === 'poison' && (hasTag(u, 'poisonImmune') || (u.side === 'player' && u.mods.noPoison))) return;
  if (s === 'stun') {
    if (hasTag(u, 'stunImmune')) { ev(c, { t: 'text', x: u.x, y: u.y, s: 'Imune', col: '#ccc' }); return; }
    const dd = defOf(u);
    if (dd && dd.onStun) dd.onStun(c, u);
    if (u.side === 'enemy' && u.intent) {
      u.intent = null;
      ev(c, { t: 'cancel', id: u.id });
    }
  }
  if (s === 'shield') st.shield = Math.min(9, (st.shield || 0) + n);
  else if (s === 'poison') st.poison = Math.min(6, (st.poison || 0) + n);
  else st[s] = Math.max(st[s] || 0, n);
  ev(c, { t: 'status', id: u.id, s, n });
}

export function clearStatus(c, u, s) { if (u.st[s]) { delete u.st[s]; ev(c, { t: 'status', id: u.id, s, n: 0 }); } }

export function effArmor(c, u) {
  let a = u.armor || 0;
  if (u.st.flip) a = 0;
  if (u.st.shell) a += 3;
  if (u.st.fort) a += 1;
  if (u.side === 'player' && u.mods.stillArmor && !c.turn.moved) a += 1;
  return a;
}

// ---------- dano ----------
// o: { src: unidade, el: 'phys'|'fire'|'shock'|'poison'|'water'|'impact'|'pure', pierce, noChain, melee }
export function damage(c, u, amt, o = {}) {
  if (!u || u.hp <= 0) return 0;
  const el = o.el || 'phys';
  let a = amt;
  const src = o.src || null;
  if (u.st.sub && el !== 'water' && el !== 'shock' && el !== 'poison' && !o.area) {
    ev(c, { t: 'text', x: u.x, y: u.y, s: 'Submerso', col: '#7fd' });
    return 0;
  }
  if (a > 0) {
    if (u.st.mark) a += (src && src.side === 'player' && src.mods.markPlus) ? 2 : 1;
    if (u.st.hook && src && src.side === 'player' && src.mods.hookPlus) a += 1;
    if (el === 'shock' && u.st.wet) a += 1;
    if (el === 'fire' && u.st.oiled) { a += 2; delete u.st.oiled; }
    if (src && src.side === 'player' && u.side !== 'player') a += heroBonus(c, src, u, el, o);
    if (src && src.side !== 'player' && u.side === 'player') a += c.mods.enemyDmg || 0;
    if (u.side === 'player' && u.mods.dmgTakenMinus && el !== 'pure') a = Math.max(1, a - u.mods.dmgTakenMinus);
  }
  if (el === 'shock' && u.side === 'player' && u.mods.noShock) a = 0;
  if ((el === 'phys') && !o.pierce) a = Math.max(0, a - effArmor(c, u));
  const dd = defOf(u);
  if (dd && dd.modDamage && a > 0) a = dd.modDamage(c, u, a, o);
  if (u.invuln && el !== 'pure') {
    ev(c, { t: 'text', x: u.x, y: u.y, s: 'Invulnerável', col: '#ccc' });
    a = 0;
  }
  if (a > 0 && u.st.shield && !['burn', 'poison', 'drown'].includes(o.how)) {
    const s = Math.min(u.st.shield, a);
    u.st.shield -= s; a -= s;
    if (!u.st.shield) delete u.st.shield;
    ev(c, { t: 'block', id: u.id, n: s });
  }
  const startX = u.x, startY = u.y;
  if (a > 0) {
    u.hp -= a;
    ev(c, { t: 'dmg', id: u.id, n: a, el, x: u.x, y: u.y });
    if (src && src.side === 'player') c.stats.dealt += a;
    if (u.side === 'player') { c.stats.taken += a; c.turn.hurt = true; }
    const d = defOf(u);
    if (d && d.onDamaged && u.hp > 0) d.onDamaged(c, u, a, o);
    // espinhos: atacante corpo a corpo leva dano
    if (o.melee && src && src.hp > 0 && src !== u) {
      if (hasTag(u, 'stinging') || hasTag(u, 'spiky')) damage(c, src, 1, { el: hasTag(u, 'stinging') ? 'shock' : 'impact', src: u, noChain: true });
      if (u.side === 'player' && u.mods.thorns) damage(c, src, u.mods.thorns, { el: 'impact', src: u });
    }
  } else if (amt > 0 && !u.invuln) {
    ev(c, { t: 'text', x: u.x, y: u.y, s: '0', col: '#aaa' });
  }
  if (u.hp <= 0) kill(c, u, o);
  else if (el === 'fire' && a > 0) addStatus(c, u, 'burn', 2);
  else if (o.melee && src && src.side === 'player' && src.mods.meleeBurn && a > 0) addStatus(c, u, 'burn', 2);
  if (el === 'shock' && !o.noChain && amt > 0) chainShock(c, startX, startY, amt, u, o);
  return a;
}

function heroBonus(c, h, u, el, o) {
  let b = 0;
  const m = h.mods;
  if (el === 'fire' && m.fireDmg) b += m.fireDmg;
  if (u.st.burn && m.burnPlus) b += m.burnPlus;
  if (c.knowledge && c.knowledge[u.def] >= 2) b += 1; // inimigo estudado
  if (m.firstStrike && !c.flags.firstStrikeUsed && (el === 'phys' || el === 'impact')) { b += m.firstStrike; c.flags.firstStrikeUsed = true; }
  if (h.cs.pressure && o.consumePressure) { b += h.cs.pressure; }
  if (h.st.sub && h.mods.ambush && (el === 'phys')) b += h.mods.ambush;
  if (m.wetPlus && u.st.wet && el !== 'shock') b += m.wetPlus;
  if (m.farSight && Math.abs(u.x - h.x) + Math.abs(u.y - h.y) >= 3) b += m.farSight;
  if (m.lowHpPlus && h.hp * 2 <= h.maxHp) b += m.lowHpPlus;
  return b;
}

// Choque se espalha por toda a água conectada ao ponto atingido.
export function chainShock(c, x, y, amt, origin, o) {
  if (!isWater(c, x, y)) return;
  const seen = new Set([key(x, y)]);
  const q = [{ x, y }];
  const tiles = [];
  while (q.length) {
    const p = q.shift();
    tiles.push(p);
    for (const d of DIRS) {
      const nx = p.x + d.x, ny = p.y + d.y, k = key(nx, ny);
      if (seen.has(k) || !inB(c, nx, ny) || !isWater(c, nx, ny)) continue;
      seen.add(k); q.push({ x: nx, y: ny });
    }
  }
  ev(c, { t: 'fx', k: 'shock', tiles });
  for (const p of tiles) {
    const v = unitAt(c, p.x, p.y);
    if (v && v !== origin && !isFlying(v)) damage(c, v, amt, { el: 'shock', noChain: true, src: o.src, area: true });
  }
}

export function heal(c, u, n) {
  if (!u || u.hp <= 0 || n <= 0) return 0;
  const h = Math.min(n, u.maxHp - u.hp);
  if (h > 0) { u.hp += h; ev(c, { t: 'heal', id: u.id, n: h, x: u.x, y: u.y }); }
  return h;
}

export function kill(c, u, o = {}) {
  if (u.dead) return;
  const d = defOf(u);
  // Afogados se levantam uma vez se morrem dentro d'água (fogo impede)
  if (d && hasTag(u, 'revive') && !u.mem.revived && isWater(c, u.x, u.y) && o.el !== 'fire') {
    u.mem.revived = true;
    u.hp = Math.max(1, Math.ceil(u.maxHp / 2));
    u.intent = null;
    ev(c, { t: 'text', x: u.x, y: u.y, s: 'Ergue-se!', col: '#8fc' });
    log(c, `${u.name} se ergue da água!`, 'warn');
    return;
  }
  if (u.side === 'player' && u.mods.revive && !c.flags.revived) {
    c.flags.revived = true;
    u.hp = Math.ceil(u.maxHp / 2);
    ev(c, { t: 'text', x: u.x, y: u.y, s: 'Segunda Maré!', col: '#ffd76a' });
    log(c, 'O Elixir da Segunda Maré te traz de volta!', 'good');
    c.flags.usedRevive = true;
    return;
  }
  u.hp = 0;
  u.dead = true;
  u.intent = null;
  ev(c, { t: 'death', id: u.id, x: u.x, y: u.y });
  if (u.side === 'player') {
    c.phase = 'lose';
    log(c, 'Você tomba...', 'bad');
    return;
  }
  // arpão cravado cai no chão
  const h = c.units.find((v) => v.side === 'player');
  if (h && h.cs && h.cs.harpoon && h.cs.harpoon.unit === u.id) {
    h.cs.harpoon = { x: u.x, y: u.y };
  }
  if (u.side === 'enemy') {
    c.reward.xp += d ? d.xp || 0 : 0;
    c.reward.pearls += d ? d.pearls || 0 : 0;
    c.kills.push({ def: u.def, how: o.how || o.el || 'phys' });
    if (d && d.name) log(c, `${u.name} foi derrotado.`, 'good');
    if (h && h.hp > 0) heroHook(c, 'onKill', u, o);
  }
  if (u.side === 'ally' && u.rescue) {
    c.obj.failed = true;
    log(c, `${u.name} não sobreviveu...`, 'bad');
  }
  if (d && d.onDeath) d.onDeath(c, u, o);
}

// ---------- ganchos de relíquias / passivas do herói ----------
export function heroHook(c, name, ...args) {
  const h = c.units.find((v) => v.side === 'player' && v.hp > 0);
  if (!h) return;
  for (const id of h.relics || []) {
    const r = REG.relics[id];
    if (r && r[name]) r[name](c, h, ...args);
  }
  for (const id of h.passives || []) {
    const s = REG.skills[id];
    if (s && s[name]) s[name](c, h, ...args);
  }
}

// ---------- movimento e terreno ----------
// Move uma unidade para (x,y) e aplica efeitos do quadrado. Retorna true se deve parar.
export function placeUnit(c, u, x, y, how = 'move') {
  u.x = x; u.y = y;
  return enterTile(c, u, how);
}

export function enterTile(c, u, how) {
  const t = tileAt(c, u.x, u.y);
  if (!t) return true;
  if (t.t === 'pit' && !isFlying(u)) {
    if (isBoss(u)) return true;
    ev(c, { t: 'fx', k: 'fall', x: u.x, y: u.y });
    if (u.side === 'player') {
      log(c, 'Você cai no ralo e é cuspido de volta, ferido!', 'bad');
      damage(c, u, 3, { el: 'pure' });
      if (u.hp > 0) {
        const p = nearestFree(c, u.x, u.y, u);
        if (p) { u.x = p.x; u.y = p.y; ev(c, { t: 'tp', id: u.id, x: p.x, y: p.y }); }
      }
    } else {
      log(c, `${u.name} é tragado pelo ralo!`, 'good');
      kill(c, u, { how: 'pit', el: 'pure' });
    }
    return true;
  }
  if (t.fire && !isFlying(u)) addStatus(c, u, 'burn', 2);
  const dep = depth(c, u.x, u.y);
  if (dep > 0 && !isFlying(u)) {
    u.st.wet = 2;
    if (u.st.burn) { delete u.st.burn; ev(c, { t: 'status', id: u.id, s: 'burn', n: 0 }); }
    if (dep >= 2 && hasTag(u, 'heavy') && !isBoss(u)) {
      ev(c, { t: 'fx', k: 'sink', x: u.x, y: u.y });
      log(c, `${u.name} afunda como pedra!`, 'good');
      kill(c, u, { how: 'sink', el: 'pure' });
      return true;
    }
  }
  if (u.side === 'player') {
    if (t.loot) pickLoot(c, u, t);
    if (u.cs && u.cs.harpoon && !u.cs.harpoon.unit && u.cs.harpoon.x === u.x && u.cs.harpoon.y === u.y) {
      u.cs.harpoon = null;
      ev(c, { t: 'text', x: u.x, y: u.y, s: 'Arpão recuperado', col: '#ffd76a' });
    }
    if (t.exit && c.obj.type === 'escape') { c.obj.reached = true; }
  }
  if (t.t === 'kelp' && how === 'push' && !isSwimmer(u)) return true;
  return false;
}

function pickLoot(c, u, t) {
  const l = t.loot; t.loot = null;
  if (l.k === 'pearl') {
    c.reward.pearls += l.v;
    ev(c, { t: 'text', x: u.x, y: u.y, s: `+${l.v} pérolas`, col: '#ffd76a' });
    log(c, `Você recolhe ${l.v} pérolas.`, 'good');
  } else if (l.k === 'chest') {
    c.reward.chests = (c.reward.chests || 0) + 1;
    c.reward.pearls += l.v || 0;
    ev(c, { t: 'text', x: u.x, y: u.y, s: 'Tesouro!', col: '#ffd76a' });
    log(c, 'Você abre um baú afogado!', 'good');
  } else if (l.k === 'memory') {
    c.reward.memories = (c.reward.memories || 0) + 1;
    ev(c, { t: 'text', x: u.x, y: u.y, s: 'Memória!', col: '#c9a6ff' });
    log(c, 'Uma Memória de Aurélia brilha em sua mão.', 'good');
  }
  ev(c, { t: 'sfx', k: 'coin' });
}

export function nearestFree(c, x, y, u) {
  let best = null, bd = 99;
  for (let yy = 0; yy < c.h; yy++) for (let xx = 0; xx < c.w; xx++) {
    if (!walkable(c, xx, yy, u) || unitAt(c, xx, yy)) continue;
    const t = tileAt(c, xx, yy);
    if (t.fire) continue;
    const d = Math.abs(xx - x) + Math.abs(yy - y) + (isDeep(c, xx, yy) ? 0.5 : 0);
    if (d < bd) { bd = d; best = { x: xx, y: yy }; }
  }
  return best;
}

// Empurra u na direção dir por n casas. src = quem causou (para bônus de colisão).
export function push(c, u, dir, n, o = {}) {
  if (!u || u.hp <= 0 || n <= 0) return 0;
  if (hasTag(u, 'immobile') || (isBoss(u) && !hasTag(u, 'pushable') && !o.force)) {
    ev(c, { t: 'text', x: u.x, y: u.y, s: 'Firme', col: '#ccc' });
    if (o.collideImmobile) collide(c, u, null, o);
    return 0;
  }
  if (u.st.root && !o.force) { ev(c, { t: 'text', x: u.x, y: u.y, s: 'Preso', col: '#9c6' }); return 0; }
  if (u.side === 'player' && u.mods.immovable && !o.force) { ev(c, { t: 'text', x: u.x, y: u.y, s: 'Firme', col: '#ccc' }); return 0; }
  if (o.src && o.src.side === 'player' && o.src.mods.pushPlus && u !== o.src && !o.noBonus) n += o.src.mods.pushPlus;
  const D = DIRS[dir];
  const from = { x: u.x, y: u.y };
  let moved = 0;
  for (let i = 0; i < n; i++) {
    const nx = u.x + D.x, ny = u.y + D.y;
    if (!inB(c, nx, ny)) { emitPush(c, u, from); collide(c, u, null, o); return moved; }
    const t = tileAt(c, nx, ny);
    const other = unitAt(c, nx, ny);
    if (other) { emitPush(c, u, from); collide(c, u, other, o); return moved; }
    if (solidTile(t)) { emitPush(c, u, from); collide(c, u, { x: nx, y: ny, t }, o); return moved; }
    u.x = nx; u.y = ny; moved++;
    if (u.st.bleed && u.side !== 'player') { /* sangramento só em movimento próprio */ }
    if (enterTile(c, u, 'push')) break;
    if (u.hp <= 0) break;
  }
  emitPush(c, u, from);
  return moved;
}

function emitPush(c, u, from) {
  if (from.x !== u.x || from.y !== u.y) ev(c, { t: 'move', id: u.id, path: [from, { x: u.x, y: u.y }], push: true });
}

// Puxa u em direção a (tx,ty) até parar adjacente ou colidir.
export function pull(c, u, tx, ty, n, o = {}) {
  const dx = Math.sign(tx - u.x), dy = Math.sign(ty - u.y);
  let dir = -1;
  if (dx === 0 && dy < 0) dir = 0; else if (dx > 0 && dy === 0) dir = 1; else if (dx === 0 && dy > 0) dir = 2; else if (dx < 0 && dy === 0) dir = 3;
  if (dir < 0) return 0;
  const dist = Math.abs(tx - u.x) + Math.abs(ty - u.y);
  const steps = Math.min(n, dist - 1);
  if (steps <= 0) return 0;
  return push(c, u, dir, steps, { ...o, noBonus: true });
}

export function collisionDmg(c, o) {
  let d = 1;
  if (o.src && o.src.side === 'player') d += Math.floor((o.src.attrs.imp || 0) / 2) + (o.src.mods.collide || 0);
  return d + (o.collBonus || 0);
}

function collide(c, u, other, o) {
  const base = collisionDmg(c, o);
  let extra = 0;
  if (other && other.hp !== undefined) {
    if (hasTag(other, 'spiky')) extra += 2;
    ev(c, { t: 'fx', k: 'bump', x: other.x, y: other.y });
    // a outra unidade também sofre
    damage(c, other, 1, { el: 'impact', src: o.src, how: 'collide' });
    if (o.src && o.src.side === 'player') heroHook(c, 'onCollideUnits', u, other);
  } else if (other && other.t) {
    const t = other.t;
    ev(c, { t: 'fx', k: 'bump', x: other.x, y: other.y });
    if (t.t === 'coral') { extra += hasTag(u, 'coralWeak') ? 3 : 1; damageTile(c, other.x, other.y, hasTag(u, 'coralWeak') ? 2 : 1, o.src); }
    else if (t.obj) hitObject(c, other.x, other.y, 1, o.src, 'impact');
  } else {
    ev(c, { t: 'fx', k: 'bump', x: u.x, y: u.y });
  }
  if (hasTag(u, 'carapace') && u.hp > 0) {
    u.st.flip = 2;
    if (u.intent) { u.intent = null; ev(c, { t: 'cancel', id: u.id }); }
    ev(c, { t: 'text', x: u.x, y: u.y, s: 'Virado!', col: '#ffb347' });
  }
  ev(c, { t: 'sfx', k: 'bump' });
  damage(c, u, base + extra, { el: 'impact', src: o.src, how: 'collide' });
  if (u.hp > 0 && u.side === 'enemy' && o.src && o.src.side === 'player') heroHook(c, 'onCollide', u);
}

export function damageTile(c, x, y, n, src) {
  const t = tileAt(c, x, y);
  if (!t) return;
  if (t.t === 'coral') {
    t.hp = (t.hp || 2) - n;
    if (t.hp <= 0) { t.t = 'floor'; delete t.hp; ev(c, { t: 'fx', k: 'shatter', x, y }); log(c, 'O coral se parte.'); }
  }
  if (t.obj) hitObject(c, x, y, n, src, 'phys');
}

// ---------- objetos ----------
export function hitObject(c, x, y, n, src, el) {
  const t = tileAt(c, x, y);
  if (!t || !t.obj) return;
  const ob = t.obj;
  if (ob.k === 'barrel') { explodeBarrel(c, x, y); return; }
  if (ob.k === 'bell') { ringBell(c, x, y, src); ob.hp -= 1; if (ob.hp <= 0) { t.obj = null; ev(c, { t: 'fx', k: 'shatter', x, y }); } return; }
  if (ob.k === 'crate' || ob.k === 'beacon' || ob.k === 'chain' || ob.k === 'statue' || ob.k === 'egg' || ob.k === 'pillarSalt') {
    ob.hp -= n;
    ev(c, { t: 'text', x, y, s: `-${n}`, col: '#ddd' });
    if (ob.hp <= 0) {
      t.obj = null;
      ev(c, { t: 'fx', k: 'shatter', x, y });
      if (ob.k === 'chain') { c.flags.chainsBroken = (c.flags.chainsBroken || 0) + 1; log(c, 'Uma corrente da Carranca se rompe!', 'good'); }
      if (ob.k === 'crate' && ob.loot) { t.loot = { k: 'pearl', v: ob.loot }; }
      if (ob.k === 'egg') log(c, 'O ovo é destruído.', 'good');
    }
    return;
  }
}

export function explodeBarrel(c, x, y) {
  const t = tileAt(c, x, y);
  if (!t || !t.obj || t.obj.k !== 'barrel') return;
  t.obj = null;
  ev(c, { t: 'fx', k: 'boom', x, y });
  ev(c, { t: 'sfx', k: 'boom' });
  log(c, 'Um barril de óleo explode!', 'warn');
  const tiles = [{ x, y }, ...DIR8.map((d) => ({ x: x + d.x, y: y + d.y }))].filter((p) => inB(c, p.x, p.y));
  for (const p of tiles) {
    const tt = tileAt(c, p.x, p.y);
    if (tt.t !== 'wall' && tt.t !== 'pit' && DIRS.some((d) => d.x === p.x - x && d.y === p.y - y)) tt.oil = true;
  }
  tt0(c, x, y).oil = true;
  for (const p of tiles) {
    const v = unitAt(c, p.x, p.y);
    if (v) damage(c, v, 2, { el: 'fire', area: true, how: 'barrel' });
  }
  for (const p of tiles) {
    const tt = tileAt(c, p.x, p.y);
    if (tt.obj && tt.obj.k === 'barrel') explodeBarrel(c, p.x, p.y);
    else if (tt.oil) ignite(c, p.x, p.y, 2);
  }
}
const tt0 = (c, x, y) => tileAt(c, x, y);

export function ringBell(c, x, y, src, radius = 1) {
  ev(c, { t: 'fx', k: 'ring', x, y, r: radius });
  ev(c, { t: 'sfx', k: 'bell' });
  log(c, 'DONG! O sino ressoa.', 'warn');
  for (const u of c.units.slice()) {
    if (u.hp <= 0 || u === src) continue;
    if (Math.max(Math.abs(u.x - x), Math.abs(u.y - y)) <= radius) addStatus(c, u, 'stun', 1);
  }
}

// ---------- fogo e óleo ----------
export function ignite(c, x, y, dur = 2) {
  const t = tileAt(c, x, y);
  if (!t || t.t === 'wall' || t.t === 'pit') return false;
  if (isWater(c, x, y) && !t.oil) { ev(c, { t: 'fx', k: 'steam', x, y }); return false; }
  if (t.obj && t.obj.k === 'barrel') { explodeBarrel(c, x, y); return true; }
  const already = t.fire > 0;
  t.fire = Math.max(t.fire || 0, dur + (t.oil ? 1 : 0) + (c.fireBonus || 0));
  if (t.t === 'kelp') { t.t = 'floor'; }
  if (!already) ev(c, { t: 'fx', k: 'fire', x, y });
  const u = unitAt(c, x, y);
  if (u && !isFlying(u)) {
    if (u.st.oiled) damage(c, u, 0 + 2, { el: 'fire', area: true });
    addStatus(c, u, 'burn', 2);
  }
  if (!already && t.oil) {
    for (const d of DIRS) {
      const n = tileAt(c, x + d.x, y + d.y);
      if (n && n.oil && !n.fire) ignite(c, x + d.x, y + d.y, dur);
    }
  }
  return true;
}

export function spreadOil(c, x, y) {
  const t = tileAt(c, x, y);
  if (!t || t.t === 'wall' || t.t === 'pit') return;
  t.oil = true;
  const u = unitAt(c, x, y);
  if (u && !isFlying(u)) addStatus(c, u, 'oiled', 3);
  if (t.fire) ignite(c, x, y, 2);
}

// ---------- maré ----------
export function tideAt(c, round) {
  const s = c.schedule;
  let v = c.loopTide ? s[(round - 1) % s.length] : s[Math.min(round - 1, s.length - 1)];
  for (const m of c.tideMods) if (round - c.round < m.r) v += m.d;
  return clamp(v, 0, MAX_TIDE);
}

export function setTide(c, v, reason) {
  const old = c.tide;
  c.tide = clamp(v, 0, MAX_TIDE);
  if (c.tide === old) return;
  ev(c, { t: 'tide', from: old, to: c.tide });
  ev(c, { t: 'sfx', k: c.tide > old ? 'wave' : 'ebb' });
  log(c, c.tide > old ? `A maré sobe (nível ${c.tide}).` : `A maré baixa (nível ${c.tide}).`, 'tide');
  applyFlood(c);
  heroHook(c, 'onTide', c.tide - old);
}

// Recalcula efeitos de água em todo o tabuleiro.
export function applyFlood(c) {
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const t = tileAt(c, x, y);
    if (t.fire && isWater(c, x, y) && !t.oil) { t.fire = 0; ev(c, { t: 'fx', k: 'steam', x, y }); }
  }
  for (const u of c.units.slice()) {
    if (u.hp <= 0 || isFlying(u)) continue;
    const dep = depth(c, u.x, u.y);
    if (dep > 0) {
      u.st.wet = 2;
      if (u.st.burn) delete u.st.burn;
      if (dep >= 2 && hasTag(u, 'heavy') && !isBoss(u)) {
        ev(c, { t: 'fx', k: 'sink', x: u.x, y: u.y });
        log(c, `${u.name} afunda com a maré!`, 'good');
        kill(c, u, { how: 'sink', el: 'pure' });
      }
    } else if (hasTag(u, 'waterOnly')) {
      if (!u.st.stranded) { u.st.stranded = 1; ev(c, { t: 'text', x: u.x, y: u.y, s: 'Encalhada!', col: '#ffb347' }); }
    }
    if (dep > 0 && u.st.stranded) delete u.st.stranded;
    if (dep < 2 && u.st.sub && u.side === 'enemy') delete u.st.sub;
  }
}

// Mudanças de elevação (Sal Grosso, Âncora de Sal etc.)
export function raiseTile(c, x, y, n) {
  const t = tileAt(c, x, y);
  if (!t || t.t === 'wall' || t.t === 'pit') return;
  t.e = clamp(t.e + n, 0, 3);
  ev(c, { t: 'fx', k: n > 0 ? 'rise' : 'sink', x, y });
  applyFlood(c);
}

// ---------- invocação ----------
export function spawnEnemy(c, defId, x, y, extra = {}) {
  const d = REG.enemies[defId];
  if (!d) throw new Error('Inimigo desconhecido: ' + defId);
  const hpBonus = isBossDef(d) ? (c.mods.bossHp || 0) : (c.mods.enemyHp || 0);
  const u = {
    id: c.nextId++, side: 'enemy', def: defId, name: d.name, x, y,
    hp: d.hp + hpBonus, maxHp: d.hp + hpBonus, armor: d.armor || 0, move: d.move ?? 2,
    st: {}, tags: (d.tags || []).slice(), intent: null, order: 0, mem: {}, ...extra,
  };
  c.units.push(u);
  ev(c, { t: 'spawn', id: u.id, x, y });
  if (d.onSpawn) d.onSpawn(c, u);
  enterTile(c, u, 'spawn');
  return u;
}
const isBossDef = (d) => (d.tags || []).includes('boss');

export function cleanup(c) {
  c.units = c.units.filter((u) => u.hp > 0 || u.side === 'player');
}

// Checa condição de vitória do objetivo atual.
export function checkEnd(c) {
  if (c.phase === 'lose' || c.phase === 'win') return;
  const h = getHero(c);
  if (!h) { c.phase = 'lose'; return; }
  const o = c.obj;
  const foes = liveEnemies(c).filter((u) => !hasTag(u, 'minor'));
  if (o.type === 'escape') {
    if (o.reached) win(c, 'Você escapou pela saída!');
    return;
  }
  if (o.type === 'survive') {
    if (foes.length === 0 && c.round >= 2) win(c, 'A área está limpa!');
    return;
  }
  if (o.type === 'boss') {
    if (o.done) win(c, o.doneText || 'O guardião caiu!');
    return;
  }
  if (foes.length === 0) win(c, 'Todos os inimigos foram derrotados!');
}

export function win(c, msg) {
  c.phase = 'win';
  c.winMsg = msg;
  // inimigos menores restantes fogem
  for (const u of c.units) if (u.side === 'enemy' && u.hp > 0) { u.hp = 0; u.dead = true; ev(c, { t: 'death', id: u.id, x: u.x, y: u.y, flee: true }); }
  log(c, msg, 'good');
  ev(c, { t: 'sfx', k: 'win' });
}

export function rand(c) { return rnd(c.rng); }
