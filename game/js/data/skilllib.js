// Auxiliares de mira e efeitos usados pelas habilidades do herói.
import { DIRS, DIR8, dirTo, dirToward } from '../core/util.js';
import { inB, tileAt, unitAt, solidTile, walkable, isWater, isDeep, damage, push, addStatus, hitObject, ev } from '../combat/engine.js';

export function lineTargets(c, h, range, { stopAtUnit = true, minRange = 1 } = {}) {
  const out = [];
  for (let d = 0; d < 4; d++) {
    const D = DIRS[d];
    for (let k = 1; k <= range; k++) {
      const x = h.x + D.x * k, y = h.y + D.y * k;
      if (!inB(c, x, y)) break;
      const t = tileAt(c, x, y);
      if (t.t === 'wall') break;
      const u = unitAt(c, x, y);
      if (k >= minRange) out.push({ x, y, dir: d });
      if (solidTile(t) || (stopAtUnit && u && !u.st.sub)) break;
    }
  }
  return out;
}

// Trajeto de um projétil: para no primeiro alvo visível ou obstáculo.
export function projectile(c, from, dir, range) {
  const D = DIRS[dir];
  const path = [];
  for (let k = 1; k <= range; k++) {
    const x = from.x + D.x * k, y = from.y + D.y * k;
    if (!inB(c, x, y)) break;
    const t = tileAt(c, x, y);
    if (t.t === 'wall') return { path, unit: null, solid: { x, y }, end: path[path.length - 1] || null };
    if (solidTile(t)) return { path, unit: null, solid: { x, y }, end: path[path.length - 1] || null };
    const u = unitAt(c, x, y);
    if (u && !u.st.sub) return { path, unit: u, solid: null, end: { x, y } };
    path.push({ x, y });
  }
  return { path, unit: null, solid: null, end: path[path.length - 1] || null };
}

export function adjTargets(c, h, filter = () => true) {
  const out = [];
  for (let d = 0; d < 4; d++) {
    const x = h.x + DIRS[d].x, y = h.y + DIRS[d].y;
    if (!inB(c, x, y)) continue;
    if (filter(x, y, unitAt(c, x, y), tileAt(c, x, y))) out.push({ x, y, dir: d });
  }
  return out;
}

export const adjUnits = (c, h) => adjTargets(c, h, (x, y, u, t) => (u && u !== h) || (t && t.obj));

export function dirTargets(c, h) {
  return adjTargets(c, h, () => true);
}

export function rangeTargets(c, h, r, filter = () => true, min = 0) {
  const out = [];
  for (let y = h.y - r; y <= h.y + r; y++) for (let x = h.x - r; x <= h.x + r; x++) {
    if (!inB(c, x, y)) continue;
    const d = Math.abs(x - h.x) + Math.abs(y - h.y);
    if (d > r || d < min) continue;
    const t = tileAt(c, x, y);
    if (t.t === 'wall') continue;
    if (filter(x, y, unitAt(c, x, y), t)) out.push({ x, y });
  }
  return out;
}

export const selfTarget = (c, h) => [{ x: h.x, y: h.y }];

export function dirOf(h, x, y) {
  const d = dirTo(h, { x, y });
  return d >= 0 ? d : dirToward(h, { x, y });
}

export function meleeHit(c, h, v, dmg, o = {}) {
  if (!v) return 0;
  ev(c, { t: 'fx', k: 'slash', x: v.x, y: v.y });
  ev(c, { t: 'sfx', k: 'hit' });
  return damage(c, v, dmg, { src: h, el: o.el || 'phys', melee: true, consumePressure: true, ...o });
}

export function hitAt(c, h, x, y, dmg, o = {}) {
  const v = unitAt(c, x, y);
  if (v && v !== h) return damage(c, v, dmg, { src: h, consumePressure: true, ...o });
  const t = tileAt(c, x, y);
  if (t && t.obj) hitObject(c, x, y, dmg, h, o.el || 'phys');
  else if (t && t.t === 'coral') { t.hp = (t.hp || 2) - dmg; if (t.hp <= 0) { t.t = 'floor'; delete t.hp; ev(c, { t: 'fx', k: 'shatter', x, y }); } }
  return 0;
}

export const enemyAt = (c, x, y) => { const u = unitAt(c, x, y); return u && u.side === 'enemy' ? u : null; };
export const inWater = (c, u) => isWater(c, u.x, u.y);
export const inDeep = (c, u) => isDeep(c, u.x, u.y);
export { DIRS, DIR8, push, addStatus, damage, walkable };
