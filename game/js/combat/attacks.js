// Formas de ataque dos inimigos: cálculo das casas afetadas (telegrafia) e resolução.
// Intenções relativas (golpe, linha, raio, investida...) acompanham o inimigo se ele for
// empurrado. Intenções de alvo fixo (arremesso, invocação, coral) ficam no quadrado.
import { DIRS, DIR8 } from '../core/util.js';
import {
  inB, tileAt, unitAt, damage, push, pull, addStatus, hitObject, damageTile, ignite, spreadOil,
  spawnEnemy, ev, log, walkable, isWater, heal, solidTile, placeUnit, isFlying,
} from './engine.js';
import { REG } from './registry.js';

export const ABSOLUTE = new Set(['lob', 'spawn', 'coral', 'buff', 'tide', 'mark', 'multi', 'ring']);

export function attackOf(u, it) {
  const d = REG.enemies[u.def];
  return d.attacks[it.ai];
}

export function dmgOf(c, u, a) {
  return (a.dmg || 0) + ((a.dmg || 0) > 0 ? (c.mods.enemyDmg || 0) : 0);
}

// Retorna { hits:[{x,y,dmg,push}], path:[{x,y}], moveTo }
export function shapeOf(c, u, a, it) {
  if (a.shape) return a.shape(c, u, a, it);
  const res = { hits: [], path: [] };
  const dmg = a.dmg || 0;
  const D = it.dir != null ? DIRS[it.dir] : null;
  const pushDir = (dir) => (a.push ? (a.pushDir === 'back' ? (dir + 2) % 4 : dir) : null);
  switch (a.kind) {
    case 'strike': {
      const reach = a.reach || 1;
      for (let k = 1; k <= reach; k++) {
        const x = u.x + D.x * k, y = u.y + D.y * k;
        if (!inB(c, x, y)) break;
        const t = tileAt(c, x, y);
        res.hits.push({ x, y, dmg, push: pushDir(it.dir) });
        if (t.t === 'wall') break;
      }
      break;
    }
    case 'line': case 'pull': {
      const range = a.range || 4;
      for (let k = 1; k <= range; k++) {
        const x = u.x + D.x * k, y = u.y + D.y * k;
        if (!inB(c, x, y)) break;
        const t = tileAt(c, x, y);
        const v = unitAt(c, x, y);
        if (solidTile(t) || (v && v !== u && !(v.st.sub))) {
          res.hits.push({ x, y, dmg, push: a.kind === 'pull' ? null : pushDir(it.dir), pull: a.kind === 'pull' });
          break;
        }
        res.path.push({ x, y });
      }
      break;
    }
    case 'beam': case 'cross': {
      const dirs = a.kind === 'cross' ? [0, 1, 2, 3] : [it.dir];
      for (const di of dirs) {
        const DD = DIRS[di];
        for (let k = 1; k <= (a.range || 6); k++) {
          const x = u.x + DD.x * k, y = u.y + DD.y * k;
          if (!inB(c, x, y)) break;
          const t = tileAt(c, x, y);
          if (t.t === 'wall') break;
          res.hits.push({ x, y, dmg, push: pushDir(di) });
          if (t.t === 'coral' || t.obj) break;
        }
      }
      break;
    }
    case 'lob': {
      res.hits.push({ x: it.tx, y: it.ty, dmg, push: null, main: true });
      if (a.splash) for (const d of DIRS) {
        const x = it.tx + d.x, y = it.ty + d.y;
        if (inB(c, x, y)) res.hits.push({ x, y, dmg: a.splashDmg ?? Math.max(0, dmg - 1), push: a.splashPush ? DIRS.indexOf(d) : null });
      }
      break;
    }
    case 'charge': {
      let lx = u.x, ly = u.y;
      for (let k = 1; k <= (a.range || 5); k++) {
        const x = u.x + D.x * k, y = u.y + D.y * k;
        if (!inB(c, x, y)) break;
        const t = tileAt(c, x, y);
        const v = unitAt(c, x, y);
        if (v && v !== u) { res.hits.push({ x, y, dmg, push: pushDir(it.dir) }); break; }
        if (solidTile(t)) { if (t.obj || t.t === 'coral') res.hits.push({ x, y, dmg, push: null }); break; }
        if (t.t === 'pit' && !isFlying(u)) break;
        res.path.push({ x, y }); lx = x; ly = y;
      }
      res.moveTo = { x: lx, y: ly };
      break;
    }
    case 'slam': case 'burst': {
      const r = a.radius || 1;
      const list = a.cross ? DIRS : (r === 1 ? DIR8 : null);
      if (list) {
        for (const d of list) {
          const x = u.x + d.x, y = u.y + d.y;
          if (inB(c, x, y)) res.hits.push({ x, y, dmg, push: a.push ? dirFromDelta(d.x, d.y) : null });
        }
      } else {
        for (let yy = u.y - r; yy <= u.y + r; yy++) for (let xx = u.x - r; xx <= u.x + r; xx++) {
          if ((xx === u.x && yy === u.y) || !inB(c, xx, yy)) continue;
          res.hits.push({ x: xx, y: yy, dmg, push: null });
        }
      }
      break;
    }
    case 'spawn': case 'coral': case 'mark': {
      for (const p of it.tiles || []) res.hits.push({ x: p.x, y: p.y, dmg: a.kind === 'spawn' ? 1 : dmg, push: null, spawn: a.kind === 'spawn' });
      break;
    }
    case 'buff': {
      const v = c.units.find((w) => w.id === it.target && w.hp > 0);
      if (v) res.hits.push({ x: v.x, y: v.y, dmg: 0, buff: true });
      break;
    }
    default: break;
  }
  return res;
}

export function dirFromDelta(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 1 : 3;
  return dy > 0 ? 2 : 0;
}

// Executa a intenção do inimigo u.
export function resolveIntent(c, u) {
  const it = u.intent;
  if (!it || u.hp <= 0) return;
  const a = attackOf(u, it);
  if (it.windup > 0) {
    it.windup--;
    ev(c, { t: 'text', x: u.x, y: u.y, s: 'Carregando...', col: '#ffb347' });
    return;
  }
  u.intent = null;
  if (u.st.sub) { delete u.st.sub; ev(c, { t: 'status', id: u.id, s: 'sub', n: 0 }); }
  ev(c, { t: 'attack', id: u.id, name: a.name, kind: a.kind });
  if (a.sfx) ev(c, { t: 'sfx', k: a.sfx });
  if (a.resolve) { a.resolve(c, u, a, it); return; }
  const sh = shapeOf(c, u, a, it);
  switch (a.kind) {
    case 'tide': {
      c.tideMods.push({ d: a.delta, r: a.rounds || 2 });
      log(c, `${u.name}: ${a.name}!`, 'tide');
      return;
    }
    case 'buff': {
      const v = c.units.find((w) => w.id === it.target && w.hp > 0);
      if (v) {
        if (a.shield) addStatus(c, v, 'shield', a.shield);
        if (a.heal) heal(c, v, a.heal);
        if (a.fort) addStatus(c, v, 'fort', a.fort);
        ev(c, { t: 'fx', k: 'buff', x: v.x, y: v.y });
      }
      return;
    }
    case 'spawn': {
      for (const h of sh.hits) {
        const occ = unitAt(c, h.x, h.y);
        const t = tileAt(c, h.x, h.y);
        if (occ) { damage(c, occ, 1, { src: u, el: 'impact' }); ev(c, { t: 'text', x: h.x, y: h.y, s: 'Bloqueado', col: '#ccc' }); continue; }
        if (!t || solidTile(t) || t.t === 'pit') continue;
        const def = REG.enemies[a.spawn];
        if (def.tags && def.tags.includes('waterOnly') && !isWater(c, h.x, h.y)) continue;
        spawnEnemy(c, a.spawn, h.x, h.y);
      }
      return;
    }
    case 'coral': {
      for (const h of sh.hits) {
        const t = tileAt(c, h.x, h.y);
        if (!t || t.t === 'wall' || t.t === 'pit' || t.obj) continue;
        const occ = unitAt(c, h.x, h.y);
        if (occ) {
          if (occ.side !== u.side || a.hitsAllies) {
            damage(c, occ, h.dmg, { src: u, el: a.el || 'phys' });
            if (occ.hp > 0) addStatus(c, occ, 'root', 1);
          }
          continue;
        }
        t.t = 'coral'; t.hp = 2; t.fire = 0; t.oil = false;
        ev(c, { t: 'fx', k: 'coral', x: h.x, y: h.y });
      }
      return;
    }
    case 'charge': {
      if (sh.moveTo && (sh.moveTo.x !== u.x || sh.moveTo.y !== u.y)) {
        const from = { x: u.x, y: u.y };
        ev(c, { t: 'move', id: u.id, path: [from, ...sh.path], charge: true });
        placeUnit(c, u, sh.moveTo.x, sh.moveTo.y, 'charge');
        if (u.hp <= 0) return;
      }
      for (const h of sh.hits) applyHit(c, u, a, h);
      return;
    }
    case 'line': case 'pull':
      if (sh.path.length || sh.hits.length) ev(c, { t: 'fx', k: a.fx || 'proj', from: { x: u.x, y: u.y }, to: sh.hits[0] || sh.path[sh.path.length - 1] });
      break;
    case 'beam': case 'cross':
      ev(c, { t: 'fx', k: a.fx || 'beam', tiles: sh.hits.map((h) => ({ x: h.x, y: h.y })), from: { x: u.x, y: u.y } });
      break;
    case 'lob':
      ev(c, { t: 'fx', k: a.fx || 'lob', from: { x: u.x, y: u.y }, to: { x: it.tx, y: it.ty } });
      break;
    case 'multi':
      for (const h of sh.hits) if (h.main !== false) ev(c, { t: 'fx', k: a.fx || 'lob', from: { x: u.x, y: u.y }, to: { x: h.x, y: h.y } });
      break;
    case 'ring':
      ev(c, { t: 'fx', k: 'ring', x: it.tx, y: it.ty, r: a.radius || 2 });
      break;
    case 'wave':
      ev(c, { t: 'fx', k: 'beam', tiles: sh.hits.map((h) => ({ x: h.x, y: h.y })), from: { x: u.x, y: u.y } });
      break;
    case 'slam': case 'burst':
      ev(c, { t: 'fx', k: a.fx || 'slam', x: u.x, y: u.y, r: a.radius || 1 });
      break;
    default: break;
  }
  for (const h of sh.hits) applyHit(c, u, a, h);
  if (a.kind === 'burst' && a.selfDestruct && u.hp > 0) {
    u.mem.exploded = true;
    damage(c, u, 99, { el: 'pure' });
  }
  if (a.after) a.after(c, u, a, it);
}

export function applyHit(c, u, a, h) {
  const v = unitAt(c, h.x, h.y);
  const t = tileAt(c, h.x, h.y);
  if (v && v !== u) {
    if (v.st.sub && a.el !== 'shock' && a.el !== 'water') {
      ev(c, { t: 'text', x: v.x, y: v.y, s: 'Esquivou', col: '#7fd' });
    } else {
      const melee = a.kind === 'strike' || a.kind === 'slam' || a.kind === 'charge';
      if (h.dmg > 0) damage(c, v, h.dmg + (h.dmg > 0 ? (c.mods.enemyDmg || 0) * 0 : 0), { src: u, el: a.el || 'phys', melee, area: a.kind === 'lob' || a.kind === 'burst' });
      if (v.hp > 0 && a.st) for (const [s, n] of Object.entries(a.st)) addStatus(c, v, s, n);
      if (v.hp > 0 && h.pull) pull(c, v, u.x, u.y, a.pull || 2, { src: u });
      else if (v.hp > 0 && h.push != null && a.push) push(c, v, h.push, a.push, { src: u });
    }
  } else if (t && t.obj && h.dmg > 0) {
    hitObject(c, h.x, h.y, h.dmg, u, a.el);
  } else if (t && t.t === 'coral' && h.dmg > 0 && a.breaksCoral) {
    damageTile(c, h.x, h.y, h.dmg, u);
  }
  if (a.oil) spreadOil(c, h.x, h.y);
  if (a.ignite) ignite(c, h.x, h.y, 2);
  if (a.ink && t) { t.ink = Math.max(t.ink || 0, a.ink); }
}

// Texto curto para a interface descrever a intenção.
export function describeIntent(c, u) {
  const it = u.intent;
  if (!it) return u.st.stun ? 'Atordoado — não age.' : 'Sem ação planejada.';
  const a = attackOf(u, it);
  const dmg = dmgOf(c, u, a);
  const dirName = it.dir != null ? DIRS[it.dir].n : '';
  const parts = [];
  if (it.windup > 0) parts.push(`Carregando (${it.windup + 1} rodadas)`);
  let what = a.name;
  switch (a.kind) {
    case 'strike': what += `: golpe ao ${dirName}`; break;
    case 'line': what += `: projétil ao ${dirName} (alcance ${a.range || 4})`; break;
    case 'pull': what += `: puxa o primeiro alvo ao ${dirName}`; break;
    case 'beam': what += `: raio perfurante ao ${dirName}`; break;
    case 'cross': what += ': raios nas 4 direções'; break;
    case 'lob': what += ': arremesso em alvo fixo'; break;
    case 'charge': what += `: investida ao ${dirName}`; break;
    case 'slam': what += ': atinge ao redor'; break;
    case 'burst': what += a.selfDestruct ? ': explode!' : ': explosão ao redor'; break;
    case 'spawn': what += ': invoca reforços'; break;
    case 'coral': what += ': faz coral brotar'; break;
    case 'buff': what += ': fortalece um aliado'; break;
    case 'tide': what += a.delta > 0 ? ': faz a maré subir' : ': faz a maré baixar'; break;
    case 'multi': what += ': vários alvos fixos'; break;
    case 'ring': what += ': o sino marcado ressoa ao redor'; break;
    case 'wave': what += ': onda que varre as colunas'; break;
    default: break;
  }
  parts.push(what);
  if (dmg > 0) parts.push(`${dmg} de dano${a.el && a.el !== 'phys' ? ' (' + elName(a.el) + ')' : ''}`);
  if (a.push) parts.push(`empurra ${a.push}`);
  if (a.st) parts.push(Object.keys(a.st).map((s) => REG.statuses[s]?.name || s).join(', '));
  if (ABSOLUTE.has(a.kind)) parts.push('alvo fixo');
  else parts.push('acompanha o inimigo');
  return parts.join(' · ');
}

export function elName(el) {
  return { fire: 'fogo', shock: 'choque', poison: 'veneno', water: 'água', impact: 'impacto', pure: 'puro', phys: 'físico' }[el] || el;
}

// Movimento do inimigo pela trilha (para animação) até um destino.
export function walkEnemy(c, u, node, pathFn) {
  const path = pathFn(node);
  if (path.length <= 1) return;
  ev(c, { t: 'move', id: u.id, path });
  for (let i = 1; i < path.length; i++) {
    const stop = placeUnit(c, u, path[i].x, path[i].y, 'walk');
    if (u.hp <= 0) return;
    if (stop) break;
  }
  if (u.st.bleed && u.hp > 0) damage(c, u, 1, { el: 'pure' });
}

export { walkable };

// Mapa de ameaças: casas que serão atingidas na fase inimiga (para interface e IA do bot).
export function threatMap(c) {
  const m = new Map();
  for (const u of c.units) {
    if (u.hp <= 0 || u.side !== 'enemy' || !u.intent) continue;
    const a = attackOf(u, u.intent);
    if (!a || a.kind === 'tide' || a.kind === 'buff') continue;
    const sh = shapeOf(c, u, a, u.intent);
    for (const h of sh.hits) {
      const k = h.x + ',' + h.y;
      const e = m.get(k) || { dmg: 0, from: [], push: [], spawn: false, windup: false };
      e.dmg += h.dmg > 0 ? h.dmg + (c.mods.enemyDmg || 0) : 0;
      e.from.push(u.id);
      if (h.push != null && a.push) e.push.push(h.push);
      if (h.spawn) e.spawn = true;
      if (u.intent.windup > 0) e.windup = true;
      m.set(k, e);
    }
    if (sh.path) for (const p of sh.path) {
      const k = p.x + ',' + p.y;
      if (!m.has(k)) m.set(k, { dmg: 0, from: [u.id], push: [], path: true });
    }
  }
  return m;
}
