// Habilidades do herói: básicas (da arma), ativas e passivas, por ofício.
import { register } from '../combat/registry.js';
import { DIRS, DIR8, dirTo, manhattan, cheb } from '../core/util.js';
import {
  getHero, unitAt, tileAt, inB, isWater, isDeep, damage, push, pull, addStatus, ev, log, heal,
  ignite, spreadOil, setTide, tideAt, raiseTile, walkable, solidTile, liveEnemies, hasTag, placeUnit,
  hitObject, isBoss, collisionDmg, applyFlood, unitById, checkEnd,
} from '../combat/engine.js';
import {
  lineTargets, projectile, adjTargets, adjUnits, dirTargets, rangeTargets, selfTarget, dirOf,
  meleeHit, hitAt, enemyAt,
} from './skilllib.js';

const A = (h, k) => (h && h.attrs ? h.attrs[k] || 0 : 0);
const wp = (h, k, def) => (h && h.wp && h.wp[k] != null ? h.wp[k] : def);
const imp2 = (h) => Math.floor(A(h, 'imp') / 2);
const can2 = (h) => Math.floor(A(h, 'can') / 2);

// Mudança de maré pela Cantora (e outros cantos)
function sing(c, h, delta, rounds) {
  c.tideMods.push({ d: delta, r: rounds });
  setTide(c, tideAt(c, c.round));
  ev(c, { t: 'fx', k: 'song', x: h.x, y: h.y });
  if (h.passives.includes('c_harmony')) heal(c, h, 1 + Math.floor(A(h, 'can') / 3));
}

function returnHarpoon(c, h) {
  if (!h.cs.harpoon) return;
  const hp = h.cs.harpoon;
  if (hp.unit) { const v = unitById(c, hp.unit); if (v) delete v.st.hook; }
  h.cs.harpoon = null;
  ev(c, { t: 'text', x: h.x, y: h.y, s: 'Arpão de volta', col: '#ffd76a' });
}

function hookedUnit(c, h) {
  const hp = h.cs.harpoon;
  return hp && hp.unit ? unitById(c, hp.unit) : null;
}

register('skills', {
  // =================== ARPOADORA ===================
  h_throw: {
    name: 'Arremessar Arpão', cls: 'arpoadora', kind: 'basic', cost: 0, icon: '🔱', attack: true,
    desc: (lv, h) => `Linha até ${wp(h, 'range', 4)}. Causa ${wp(h, 'throwDmg', 2)} e FISGA o alvo${wp(h, 'bleed', 0) ? ' (Sangrando)' : ''}. O arpão fica cravado até você puxá-lo ou pisar nele.`,
    available: (c, h) => (!h.cs.harpoon ? true : 'O arpão está fora — puxe-o ou recolha-o'),
    targets: (c, h) => lineTargets(c, h, wp(h, 'range', 4)),
    apply(c, h, x, y) {
      const dir = dirOf(h, x, y);
      const pr = projectile(c, h, dir, wp(h, 'range', 4));
      ev(c, { t: 'fx', k: 'harpoon', from: { x: h.x, y: h.y }, to: pr.end || pr.solid || { x, y } });
      ev(c, { t: 'sfx', k: 'throw' });
      if (pr.unit) {
        const v = pr.unit;
        h.cs.harpoon = { unit: v.id };
        damage(c, v, wp(h, 'throwDmg', 2), { src: h, el: 'phys', consumePressure: true });
        if (v.hp > 0) {
          v.st.hook = 1;
          ev(c, { t: 'status', id: v.id, s: 'hook', n: 1 });
          if (wp(h, 'bleed', 0)) addStatus(c, v, 'bleed', wp(h, 'bleed', 0));
        }
      } else {
        if (pr.solid) hitObject(c, pr.solid.x, pr.solid.y, 1, h, 'phys');
        const land = pr.end || { x: h.x, y: h.y };
        if (land.x === h.x && land.y === h.y) { h.cs.harpoon = null; return; }
        h.cs.harpoon = { x: land.x, y: land.y };
      }
    },
  },
  h_pull: {
    name: 'Puxar Corda', cls: 'arpoadora', kind: 'basic', cost: 0, icon: '🪝', attack: true,
    desc: (lv, h) => `Puxa o alvo fisgado ${wp(h, 'pull', 2)} casas na sua direção (colisões causam dano). Se o alvo for imóvel, VOCÊ é puxado até ele. O arpão volta à mão.`,
    available: (c, h) => (h.cs.harpoon ? true : 'O arpão está na sua mão'),
    targets(c, h) {
      const v = hookedUnit(c, h);
      if (v) return [{ x: v.x, y: v.y }];
      const hp = h.cs.harpoon;
      return hp && hp.x != null ? [{ x: hp.x, y: hp.y }] : [];
    },
    apply(c, h) {
      const v = hookedUnit(c, h);
      ev(c, { t: 'sfx', k: 'pull' });
      if (v) {
        const d = dirTo(h, v);
        const immovable = hasTag(v, 'immobile') || (isBoss(v) && !hasTag(v, 'pushable')) || v.st.root;
        if (immovable && d >= 0) {
          const dist = manhattan(h, v) - 1;
          if (dist > 0) push(c, h, d, dist, { force: true });
        } else if (d >= 0) {
          pull(c, v, h.x, h.y, wp(h, 'pull', 2), { src: h });
        } else {
          // não alinhado: puxão em direção aproximada
          const dx = Math.sign(h.x - v.x), dy = Math.sign(h.y - v.y);
          const dir = Math.abs(h.x - v.x) >= Math.abs(h.y - v.y) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
          push(c, v, dir, 1, { src: h });
        }
      } else if (h.cs.harpoon && h.cs.harpoon.x != null) {
        const hp = h.cs.harpoon;
        const d = dirTo(h, hp);
        if (d >= 0) {
          const back = (d + 2) % 4;
          for (let k = manhattan(h, hp) - 1; k >= 1; k--) {
            const x = h.x + DIRS[d].x * k, y = h.y + DIRS[d].y * k;
            const u = unitAt(c, x, y);
            if (u && u.side === 'enemy') { damage(c, u, 1, { src: h }); if (u.hp > 0) push(c, u, back, 1, { src: h }); break; }
          }
        }
      }
      returnHarpoon(c, h);
      if (h.passives.includes('a_tight')) { addStatus(c, h, 'shield', 1); h.fol = Math.min(h.folMax, h.fol + 1); }
    },
  },
  h_zip: {
    name: 'Lançar-se', cls: 'arpoadora', kind: 'basic', cost: 0, icon: '🧗', quick: false,
    desc: () => 'Você é puxado pela corrente até ficar ao lado do alvo fisgado (ou do arpão no chão). O arpão volta à mão.',
    available: (c, h) => (h.cs.harpoon ? true : 'O arpão está na sua mão'),
    targets(c, h) {
      const v = hookedUnit(c, h);
      if (v && dirTo(h, v) >= 0) return [{ x: v.x, y: v.y }];
      const hp = h.cs.harpoon;
      return hp && hp.x != null && dirTo(h, hp) >= 0 ? [{ x: hp.x, y: hp.y }] : [];
    },
    apply(c, h, x, y) {
      const d = dirTo(h, { x, y });
      const v = hookedUnit(c, h);
      const dist = manhattan(h, { x, y }) - (v ? 1 : 0);
      if (d >= 0 && dist > 0) push(c, h, d, dist, { force: true });
      returnHarpoon(c, h);
    },
  },
  h_jab: {
    name: 'Cabo do Arpão', cls: 'arpoadora', kind: 'basic', cost: 0, icon: '👊', attack: true,
    desc: (lv, h) => `Golpe adjacente: ${1 + wp(h, 'jabBonus', 0)} de dano e empurra 1 casa.`,
    targets: (c, h) => adjUnits(c, h),
    apply(c, h, x, y) {
      const v = unitAt(c, x, y);
      const d = dirTo(h, { x, y });
      if (v) { meleeHit(c, h, v, 1 + wp(h, 'jabBonus', 0)); if (v.hp > 0) push(c, v, d, 1, { src: h }); }
      else hitAt(c, h, x, y, 1);
    },
  },
  a_brutal: {
    name: 'Puxão Brutal', cls: 'arpoadora', kind: 'active', cost: 1, icon: '💥', attack: true, tag: 'Ímp',
    desc: (lv, h) => `Arranca o alvo fisgado até você: ele se choca contra você e sofre ${2 + lv - 1 + imp2(h)} de impacto${lv > 1 ? ' e fica Atordoado' : ''}. O arpão volta.`,
    up: '+1 de dano e atordoa.',
    available: (c, h) => (hookedUnit(c, h) ? true : 'Precisa de um alvo fisgado'),
    targets: (c, h) => { const v = hookedUnit(c, h); return v ? [{ x: v.x, y: v.y }] : []; },
    apply(c, h, x, y, lv) {
      const v = hookedUnit(c, h);
      if (!v) return;
      ev(c, { t: 'sfx', k: 'pull' });
      if (dirTo(h, v) >= 0) pull(c, v, h.x, h.y, 9, { src: h });
      else push(c, v, Math.abs(h.x - v.x) >= Math.abs(h.y - v.y) ? (h.x > v.x ? 1 : 3) : (h.y > v.y ? 2 : 0), 2, { src: h });
      if (v.hp > 0) {
        ev(c, { t: 'fx', k: 'bump', x: v.x, y: v.y });
        damage(c, v, 2 + lv - 1 + imp2(h), { src: h, el: 'impact', consumePressure: true });
        if (lv > 1 && v.hp > 0) addStatus(c, v, 'stun', 1);
      }
      returnHarpoon(c, h);
    },
  },
  a_anchor: {
    name: 'Âncora', cls: 'arpoadora', kind: 'active', cost: 2, icon: '⚓', attack: true, tag: 'Ímp',
    desc: (lv, h) => `Golpe adjacente devastador: ${3 + lv - 1 + imp2(h)} de dano e empurra 2 casas.`,
    up: '+1 de dano.',
    targets: (c, h) => adjUnits(c, h),
    apply(c, h, x, y, lv) {
      const v = unitAt(c, x, y);
      const d = dirTo(h, { x, y });
      if (v) { meleeHit(c, h, v, 3 + lv - 1 + imp2(h)); if (v.hp > 0) push(c, v, d, 2, { src: h }); }
      else hitAt(c, h, x, y, 3);
      ev(c, { t: 'shake', n: 4 });
    },
  },
  a_spin: {
    name: 'Rodopio', cls: 'arpoadora', kind: 'active', cost: 2, icon: '🌀', attack: true,
    desc: (lv) => `Gira o arpão: todas as unidades nas 8 casas ao redor sofrem ${lv} de dano e são empurradas 1 casa para longe.`,
    up: '+1 de dano.',
    targets: selfTarget,
    apply(c, h, x, y, lv) {
      ev(c, { t: 'fx', k: 'spin', x: h.x, y: h.y });
      const vs = DIR8.map((d) => ({ d, v: unitAt(c, h.x + d.x, h.y + d.y) })).filter((q) => q.v);
      for (const { d, v } of vs) {
        meleeHit(c, h, v, lv);
        if (v.hp > 0) {
          const dir = Math.abs(d.x) >= Math.abs(d.y) ? (d.x > 0 ? 1 : 3) : (d.y > 0 ? 2 : 0);
          push(c, v, d.x !== 0 && d.y !== 0 ? (d.y > 0 ? 2 : 0) : dir, 1, { src: h });
        }
      }
    },
  },
  a_net: {
    name: 'Rede de Pesca', cls: 'arpoadora', kind: 'active', cost: 1, icon: '🕸',
    desc: (lv) => `Arremessa (alcance ${lv > 1 ? 4 : 3}) uma rede em cruz: unidades atingidas ficam Presas (1) e Expostas (${lv}).`,
    up: '+1 alcance e Exposto dura mais.',
    targets: (c, h, lv) => rangeTargets(c, h, lv > 1 ? 4 : 3, () => true, 1),
    apply(c, h, x, y, lv) {
      ev(c, { t: 'fx', k: 'net', x, y });
      for (const p of [{ x, y }, ...DIRS.map((d) => ({ x: x + d.x, y: y + d.y }))]) {
        const v = unitAt(c, p.x, p.y);
        if (v && v.side === 'enemy') { addStatus(c, v, 'root', 1); addStatus(c, v, 'mark', lv); }
      }
    },
  },
  a_swap: {
    name: 'Troca de Corda', cls: 'arpoadora', kind: 'active', cost: 1, icon: '🔁',
    quick: (lv) => lv > 1,
    desc: (lv) => `Troca de lugar com o alvo fisgado (o arpão continua cravado).${lv > 1 ? ' Não gasta a ação.' : ''}`,
    up: 'Vira ação rápida (não gasta a ação).',
    available: (c, h) => (hookedUnit(c, h) ? true : 'Precisa de um alvo fisgado'),
    targets: (c, h) => { const v = hookedUnit(c, h); return v ? [{ x: v.x, y: v.y }] : []; },
    apply(c, h, x, y, lv) {
      const v = hookedUnit(c, h);
      if (!v || hasTag(v, 'immobile') || isBoss(v)) { ev(c, { t: 'text', x: h.x, y: h.y, s: 'Não se move', col: '#ccc' }); return; }
      const hx = h.x, hy = h.y;
      ev(c, { t: 'move', id: h.id, path: [{ x: hx, y: hy }, { x: v.x, y: v.y }] });
      ev(c, { t: 'move', id: v.id, path: [{ x: v.x, y: v.y }, { x: hx, y: hy }] });
      h.x = v.x; h.y = v.y; v.x = hx; v.y = hy;
      placeUnit(c, h, h.x, h.y, 'tp');
      placeUnit(c, v, v.x, v.y, 'tp');
    },
  },
  a_double: {
    name: 'Fisga Dupla', cls: 'arpoadora', kind: 'active', cost: 2, icon: '🎣', attack: true,
    desc: (lv) => `Um segundo arpão (alcance 4): ${lv + 1} de dano e puxa o alvo 1 casa. Não usa o arpão principal.`,
    up: '+1 de dano.',
    targets: (c, h) => lineTargets(c, h, 4),
    apply(c, h, x, y, lv) {
      const pr = projectile(c, h, dirOf(h, x, y), 4);
      ev(c, { t: 'fx', k: 'harpoon', from: { x: h.x, y: h.y }, to: pr.end || pr.solid || { x, y } });
      if (pr.unit) {
        damage(c, pr.unit, lv + 1, { src: h, consumePressure: true });
        if (pr.unit.hp > 0) pull(c, pr.unit, h.x, h.y, 1, { src: h });
      } else if (pr.solid) hitObject(c, pr.solid.x, pr.solid.y, lv + 1, h, 'phys');
    },
  },
  a_leap: {
    name: 'Salto com Arpão', cls: 'arpoadora', kind: 'active', cost: 1, icon: '🦘',
    desc: (lv) => `Salta em linha reta até ${lv > 1 ? 4 : 3} casas (por cima de tudo). Inimigos adjacentes ao pouso são empurrados 1 casa${lv > 1 ? ' e sofrem 1 de dano' : ''}.`,
    up: '+1 alcance e o pouso causa dano.',
    targets(c, h, lv) {
      const out = [];
      for (let d = 0; d < 4; d++) for (let k = 1; k <= (lv > 1 ? 4 : 3); k++) {
        const x = h.x + DIRS[d].x * k, y = h.y + DIRS[d].y * k;
        if (!inB(c, x, y)) break;
        if (walkable(c, x, y, h) && !unitAt(c, x, y)) out.push({ x, y });
      }
      return out;
    },
    apply(c, h, x, y, lv) {
      ev(c, { t: 'move', id: h.id, path: [{ x: h.x, y: h.y }, { x, y }], jump: true });
      placeUnit(c, h, x, y, 'jump');
      ev(c, { t: 'fx', k: 'slam', x, y, r: 1 });
      for (let d = 0; d < 4; d++) {
        const v = unitAt(c, x + DIRS[d].x, y + DIRS[d].y);
        if (v && v.side === 'enemy') { if (lv > 1) damage(c, v, 1, { src: h }); if (v.hp > 0) push(c, v, d, 1, { src: h }); }
      }
    },
  },
  a_bigcatch: {
    name: 'Pesca Grande', cls: 'arpoadora', kind: 'active', cost: 3, icon: '🐋',
    desc: (lv) => `Lança redes nas 4 direções: o primeiro inimigo de cada linha é puxado ${lv + 1} casas em sua direção.`,
    up: 'Puxa 1 casa a mais.',
    targets: selfTarget,
    apply(c, h, x, y, lv) {
      for (let d = 0; d < 4; d++) {
        const pr = projectile(c, h, d, 7);
        if (pr.unit && pr.unit.side === 'enemy') { ev(c, { t: 'fx', k: 'harpoon', from: { x: h.x, y: h.y }, to: pr.end }); pull(c, pr.unit, h.x, h.y, lv + 1, { src: h }); }
      }
    },
  },
  a_ironTide: {
    name: 'Maré de Ferro', cls: 'arpoadora', kind: 'passive', icon: '⛓',
    desc: () => 'Inimigos Fisgados sofrem +1 de dano de todas as suas fontes.',
    mods: () => ({ hookPlus: 1 }),
  },
  a_tight: {
    name: 'Corda Esticada', cls: 'arpoadora', kind: 'passive', icon: '🧶',
    desc: () => 'Sempre que usar Puxar Corda, ganha 1 Escudo e 1 Fôlego.',
  },

  // =================== FAROLEIRO ===================
  f_bash: {
    name: 'Golpe de Lanterna', cls: 'faroleiro', kind: 'basic', cost: 0, icon: '🏮', attack: true,
    desc: (lv, h) => (wp(h, 'powder', 0) ? 'Golpe adjacente: 2 de fogo no alvo e 1 de fogo nos vizinhos dele.' : `Golpe adjacente: ${wp(h, 'bashDmg', 2)} de dano e deixa o alvo Em Chamas (se não estiver molhado).`),
    targets: (c, h) => adjUnits(c, h),
    apply(c, h, x, y) {
      const v = unitAt(c, x, y);
      if (!v) { hitAt(c, h, x, y, 2, { el: 'fire' }); return; }
      if (wp(h, 'powder', 0)) {
        ev(c, { t: 'fx', k: 'boom', x, y });
        meleeHit(c, h, v, 2, { el: 'fire' });
        for (const d of DIRS) { const w = unitAt(c, x + d.x, y + d.y); if (w && w !== h) damage(c, w, 1, { src: h, el: 'fire', area: true }); }
      } else {
        meleeHit(c, h, v, wp(h, 'bashDmg', 2));
        if (v.hp > 0) addStatus(c, v, 'burn', 2);
      }
    },
  },
  f_beam: {
    name: 'Facho de Luz', cls: 'faroleiro', kind: 'basic', cost: 0, icon: '🔦', attack: true,
    desc: (lv, h) => `Linha até ${wp(h, 'beamRange', 4)}: 1 de dano e deixa o alvo Exposto (2)${wp(h, 'beamPush', 0) ? ' e o empurra 1 casa' : ''}.`,
    targets: (c, h) => lineTargets(c, h, wp(h, 'beamRange', 4)),
    apply(c, h, x, y) {
      const dir = dirOf(h, x, y);
      const pr = projectile(c, h, dir, wp(h, 'beamRange', 4));
      ev(c, { t: 'fx', k: 'light', from: { x: h.x, y: h.y }, to: pr.end || pr.solid || { x, y } });
      if (pr.unit) {
        damage(c, pr.unit, 1, { src: h });
        if (pr.unit.hp > 0) addStatus(c, pr.unit, 'mark', 2);
        if (pr.unit.hp > 0 && wp(h, 'beamPush', 0)) push(c, pr.unit, dir, 1, { src: h });
      } else if (pr.solid) hitObject(c, pr.solid.x, pr.solid.y, 1, h, 'phys');
    },
  },
  f_oil: {
    name: 'Frasco de Óleo', cls: 'faroleiro', kind: 'active', cost: 1, icon: '🛢',
    quick: (lv) => lv > 1,
    desc: (lv) => `Arremessa óleo em cruz (alcance ${lv > 1 ? 5 : 4}). Unidades atingidas ficam Oleadas (próximo fogo +2). Óleo flutua na água.${lv > 1 ? ' Ação rápida.' : ''}`,
    up: 'Alcance 5 e não gasta a ação.',
    targets: (c, h, lv) => rangeTargets(c, h, lv > 1 ? 5 : 4, () => true, 1),
    apply(c, h, x, y, lv) {
      ev(c, { t: 'fx', k: 'bottle', from: { x: h.x, y: h.y }, to: { x, y } });
      for (const p of [{ x, y }, ...DIRS.map((d) => ({ x: x + d.x, y: y + d.y }))]) if (inB(c, p.x, p.y)) spreadOil(c, p.x, p.y);
    },
  },
  f_spark: {
    name: 'Faísca', cls: 'faroleiro', kind: 'active', cost: 1, icon: '✨',
    desc: (lv) => `Incendeia um quadrado a até ${lv > 1 ? 5 : 3} casas. O fogo se alastra por todo óleo conectado.`,
    up: 'Alcance 5.',
    targets: (c, h, lv) => rangeTargets(c, h, lv > 1 ? 5 : 3, () => true, 1),
    apply(c, h, x, y) {
      ev(c, { t: 'fx', k: 'spark', from: { x: h.x, y: h.y }, to: { x, y } });
      ev(c, { t: 'sfx', k: 'fire' });
      const v = unitAt(c, x, y);
      if (!ignite(c, x, y, 2) && v) addStatus(c, v, 'burn', 2);
      if (v && v.side === 'enemy') damage(c, v, 1, { src: h, el: 'fire' });
    },
  },
  f_flash: {
    name: 'Clarão', cls: 'faroleiro', kind: 'active', cost: 2, icon: '💡', cd: 1,
    desc: (lv) => `Lampejo ofuscante: todos os inimigos a até ${lv} casa(s) (inclusive diagonais) ficam Atordoados — seus ataques são cancelados. Recarga 1.`,
    up: 'Raio 2.',
    targets: selfTarget,
    apply(c, h, x, y, lv) {
      ev(c, { t: 'fx', k: 'flash', x: h.x, y: h.y, r: lv });
      ev(c, { t: 'sfx', k: 'flash' });
      for (const u of liveEnemies(c)) if (cheb(u, h) <= lv) addStatus(c, u, 'stun', 1);
    },
  },
  f_throw: {
    name: 'Lanterna Arremessada', cls: 'faroleiro', kind: 'active', cost: 2, icon: '🔥', attack: true,
    desc: (lv) => `Arremessa a lanterna (alcance 3): ${lv + 1} de fogo no centro, ${lv} nos vizinhos, e incendeia a cruz.`,
    up: '+1 de dano.',
    targets: (c, h) => rangeTargets(c, h, 3, () => true, 1),
    apply(c, h, x, y, lv) {
      ev(c, { t: 'fx', k: 'torch', from: { x: h.x, y: h.y }, to: { x, y } });
      ev(c, { t: 'fx', k: 'boom', x, y });
      for (const p of [{ x, y, d: lv + 1 }, ...DIRS.map((d) => ({ x: x + d.x, y: y + d.y, d: lv }))]) {
        if (!inB(c, p.x, p.y)) continue;
        const v = unitAt(c, p.x, p.y);
        if (v && v !== h) damage(c, v, p.d, { src: h, el: 'fire', area: true });
        ignite(c, p.x, p.y, 2);
      }
    },
  },
  f_steam: {
    name: 'Vapor', cls: 'faroleiro', kind: 'active', cost: 2, icon: '♨',
    desc: (lv) => `Ferve a água ao seu redor (raio ${lv}): o nível da água ali baixa 1 por 3 rodadas, e inimigos que estavam na água sofrem ${lv + 1} de escaldadura.`,
    up: 'Raio 2 e +1 de dano.',
    targets: selfTarget,
    apply(c, h, x, y, lv) {
      ev(c, { t: 'fx', k: 'steamBig', x: h.x, y: h.y, r: lv });
      for (let yy = h.y - lv; yy <= h.y + lv; yy++) for (let xx = h.x - lv; xx <= h.x + lv; xx++) {
        if (!inB(c, xx, yy)) continue;
        const v = unitAt(c, xx, yy);
        if (v && v.side === 'enemy' && isWater(c, xx, yy)) damage(c, v, lv + 1, { src: h, el: 'pure', area: true });
        const t = tileAt(c, xx, yy);
        t.tm = -1; t.tmd = 3;
      }
      applyFlood(c);
    },
  },
  f_beacon: {
    name: 'Farol Portátil', cls: 'faroleiro', kind: 'active', cost: 2, icon: '🗼',
    desc: (lv) => `Ergue um pequeno farol adjacente (3 de vida, bloqueia passagem). No fim de cada turno seu, ele dispara contra o inimigo mais próximo a até 3 casas: ${lv} de dano e Exposto.`,
    up: '+1 de dano por disparo.',
    targets: (c, h) => adjTargets(c, h, (x, y, u, t) => !u && !solidTile(t) && t.t !== 'pit'),
    apply(c, h, x, y, lv) {
      const t = tileAt(c, x, y);
      t.obj = { k: 'beacon', hp: 3, lv };
      ev(c, { t: 'fx', k: 'rise', x, y });
      if (!h.passives.includes('sys_beacon')) h.passives.push('sys_beacon');
    },
  },
  sys_beacon: {
    name: 'Faróis', kind: 'hidden', hidden: true,
    onTurnEnd(c, h) {
      c.tiles.forEach((t, i) => {
        if (!t.obj || t.obj.k !== 'beacon') return;
        const x = i % c.w, y = Math.floor(i / c.w);
        let best = null;
        for (const u of liveEnemies(c)) {
          const d = manhattan(u, { x, y });
          if (d <= 3 && !u.st.sub && (!best || d < best.d)) best = { u, d };
        }
        if (best) {
          ev(c, { t: 'fx', k: 'light', from: { x, y }, to: { x: best.u.x, y: best.u.y } });
          damage(c, best.u, t.obj.lv || 1, { src: h });
          if (best.u.hp > 0) addStatus(c, best.u, 'mark', 1);
        }
      });
    },
  },
  f_ember: {
    name: 'Brasa Viva', cls: 'faroleiro', kind: 'passive', icon: '🕯',
    desc: () => 'Seu dano de fogo +1. Todo incêndio no campo dura 1 rodada a mais.',
    mods: () => ({ fireDmg: 1, fireLong: 1 }),
  },
  f_fuse: {
    name: 'Pavio Curto', cls: 'faroleiro', kind: 'passive', icon: '🧨',
    desc: () => 'Inimigos que morrem Em Chamas explodem: 2 de fogo nos vizinhos.',
    onKill(c, h, u) {
      if (!u.st.burn) return;
      ev(c, { t: 'fx', k: 'boom', x: u.x, y: u.y });
      for (const d of DIRS) { const v = unitAt(c, u.x + d.x, u.y + d.y); if (v && v !== h) damage(c, v, 2, { src: h, el: 'fire', area: true }); }
    },
  },
  f_glare: {
    name: 'Luz Cegante', cls: 'faroleiro', kind: 'passive', icon: '🌟',
    desc: () => 'Inimigos Expostos sofrem +2 de dano (em vez de +1) dos seus ataques.',
    mods: () => ({ markPlus: 1 }),
  },
  f_blaze: {
    name: 'Incêndio', cls: 'faroleiro', kind: 'active', cost: (lv) => (lv > 1 ? 1 : 2), icon: '🌋',
    desc: (lv) => `Incendeia TODO óleo a até 4 casas de você e todas as unidades Oleadas nessa área. Custo ${lv > 1 ? 1 : 2}.`,
    up: 'Custo 1.',
    available(c, h) {
      for (let i = 0; i < c.tiles.length; i++) if (c.tiles[i].oil && manhattan(h, { x: i % c.w, y: Math.floor(i / c.w) }) <= 4) return true;
      return liveEnemies(c).some((u) => u.st.oiled && manhattan(h, u) <= 4) ? true : 'Nenhum óleo por perto';
    },
    targets: selfTarget,
    apply(c, h) {
      ev(c, { t: 'sfx', k: 'fire' });
      for (let i = 0; i < c.tiles.length; i++) {
        const x = i % c.w, y = Math.floor(i / c.w);
        if (c.tiles[i].oil && manhattan(h, { x, y }) <= 4 && !(x === h.x && y === h.y)) ignite(c, x, y, 2);
      }
      for (const u of liveEnemies(c)) if (u.st.oiled && manhattan(h, u) <= 4) damage(c, u, 1, { src: h, el: 'fire', area: true });
    },
  },

  // =================== MERGULHADORA ===================
  m_thrust: {
    name: 'Estocada de Tridente', cls: 'mergulhadora', kind: 'basic', cost: 0, icon: '🔱', attack: true,
    desc: (lv, h) => `Atinge as 2 casas à frente: ${wp(h, 'thrustDmg', 2)} de dano (+1 se você estiver na água).`,
    targets: (c, h) => adjTargets(c, h, (x, y, u, t) => t.t !== 'wall'),
    apply(c, h, x, y) {
      const d = dirTo(h, { x, y });
      const dmg = wp(h, 'thrustDmg', 2) + (isWater(c, h.x, h.y) ? 1 : 0);
      ev(c, { t: 'fx', k: 'thrust', from: { x: h.x, y: h.y }, dir: d });
      for (let k = 1; k <= 2; k++) {
        const xx = h.x + DIRS[d].x * k, yy = h.y + DIRS[d].y * k;
        if (!inB(c, xx, yy) || tileAt(c, xx, yy).t === 'wall') break;
        const v = unitAt(c, xx, yy);
        if (v && v !== h) meleeHit(c, h, v, dmg, { melee: k === 1 });
        else hitAt(c, h, xx, yy, dmg);
        if (tileAt(c, xx, yy).obj) break;
      }
    },
  },
  m_slash: {
    name: 'Corte de Coral', cls: 'mergulhadora', kind: 'basic', cost: 0, icon: '🗡', attack: true,
    desc: () => 'Golpe adjacente: 3 de dano e Sangrando (3).',
    targets: (c, h) => adjUnits(c, h),
    apply(c, h, x, y) {
      const v = unitAt(c, x, y);
      if (v) { meleeHit(c, h, v, 3); if (v.hp > 0) addStatus(c, v, 'bleed', 3); } else hitAt(c, h, x, y, 3);
    },
  },
  m_netshot: {
    name: 'Disparo de Rede', cls: 'mergulhadora', kind: 'basic', cost: 0, icon: '🕸', attack: true,
    desc: () => 'Linha até 4: 1 de dano e Prende o alvo (1).',
    targets: (c, h) => lineTargets(c, h, 4),
    apply(c, h, x, y) {
      const pr = projectile(c, h, dirOf(h, x, y), 4);
      ev(c, { t: 'fx', k: 'net', x: (pr.end || { x, y }).x, y: (pr.end || { x, y }).y });
      if (pr.unit) { damage(c, pr.unit, 1, { src: h }); if (pr.unit.hp > 0) addStatus(c, pr.unit, 'root', 1); }
    },
  },
  m_shove: {
    name: 'Empurrão', cls: 'mergulhadora', kind: 'basic', cost: 0, icon: '🤚',
    desc: () => 'Empurra um alvo adjacente 2 casas (1 de dano se ele estiver na água).',
    targets: (c, h) => adjUnits(c, h),
    apply(c, h, x, y) {
      const v = unitAt(c, x, y);
      const d = dirTo(h, { x, y });
      if (!v) { hitAt(c, h, x, y, 1); return; }
      if (isWater(c, v.x, v.y)) damage(c, v, 1, { src: h, el: 'water' });
      if (v.hp > 0) push(c, v, d, 2, { src: h });
    },
  },
  m_sub: {
    name: 'Submergir', cls: 'mergulhadora', kind: 'active', cost: (lv) => (lv > 1 ? 0 : 1), quick: true, icon: '🫧', keepSub: true,
    desc: (lv) => `Ação rápida. Em água FUNDA, você mergulha: fica Submersa (imune a dano físico e fogo) até agir ou sair da água funda. Custo ${lv > 1 ? 0 : 1}.`,
    up: 'Custo 0.',
    available: (c, h) => (isDeep(c, h.x, h.y) ? (h.st.sub ? 'Já está submersa' : true) : 'Precisa estar em água funda'),
    targets: selfTarget,
    apply(c, h) { addStatus(c, h, 'sub', 1); ev(c, { t: 'fx', k: 'splash', x: h.x, y: h.y }); },
  },
  m_whirl: {
    name: 'Redemoinho', cls: 'mergulhadora', kind: 'active', cost: 2, icon: '🌀', attack: true,
    desc: (lv) => `Em um quadrado com água (alcance 3): unidades ao redor são puxadas 1 casa para o centro e quem estiver na água sofre ${lv} de dano.`,
    up: '+1 de dano.',
    targets: (c, h) => rangeTargets(c, h, 3, (x, y) => isWater(c, x, y), 1),
    apply(c, h, x, y, lv) {
      ev(c, { t: 'fx', k: 'whirl', x, y });
      ev(c, { t: 'sfx', k: 'wave' });
      const ring = DIR8.map((d) => ({ x: x + d.x, y: y + d.y })).map((p) => ({ p, u: unitAt(c, p.x, p.y) })).filter((q) => q.u && q.u !== h);
      for (const { u } of ring) if (isWater(c, u.x, u.y)) damage(c, u, lv, { src: h, el: 'water', area: true });
      const center = unitAt(c, x, y);
      if (center && center !== h && isWater(c, x, y)) damage(c, center, lv, { src: h, el: 'water', area: true });
      for (const { u } of ring) if (u.hp > 0 && u !== h) {
        const dx = x - u.x, dy = y - u.y;
        if (dx !== 0 && dy !== 0) continue;
        const dir = dirTo(u, { x, y });
        if (dir >= 0) push(c, u, dir, 1, { src: h });
      }
    },
  },
  m_wave: {
    name: 'Onda', cls: 'mergulhadora', kind: 'active', cost: 2, icon: '🌊',
    desc: (lv) => `Escolha uma direção: tudo numa faixa de 3 de largura e 2 de profundidade à sua frente é empurrado ${lv} casa(s); quem estiver na água sofre 1.`,
    up: 'Empurra 2 casas.',
    targets: dirTargets,
    apply(c, h, x, y, lv) {
      const d = dirTo(h, { x, y });
      const D = DIRS[d], P = DIRS[(d + 1) % 4];
      const tiles = [];
      for (let k = 2; k >= 1; k--) for (let s = -1; s <= 1; s++) tiles.push({ x: h.x + D.x * k + P.x * s, y: h.y + D.y * k + P.y * s });
      ev(c, { t: 'fx', k: 'beam', tiles, from: { x: h.x, y: h.y }, wave: true });
      ev(c, { t: 'sfx', k: 'wave' });
      for (const p of tiles) {
        const v = unitAt(c, p.x, p.y);
        if (!v || v === h) continue;
        if (isWater(c, v.x, v.y)) damage(c, v, 1, { src: h, el: 'water', area: true });
        if (v.hp > 0) push(c, v, d, lv, { src: h });
      }
    },
  },
  m_dive: {
    name: 'Mergulho', cls: 'mergulhadora', kind: 'active', cost: 1, icon: '🐬',
    desc: (lv) => `Nada instantaneamente até um quadrado com água a até ${lv > 1 ? 6 : 4} casas.${lv > 1 ? ' Se for água funda, chega Submersa.' : ''}`,
    up: 'Alcance 6 e chega Submersa em água funda.',
    targets: (c, h, lv) => rangeTargets(c, h, lv > 1 ? 6 : 4, (x, y, u, t) => !u && isWater(c, x, y) && walkable(c, x, y, h), 1),
    apply(c, h, x, y, lv) {
      ev(c, { t: 'move', id: h.id, path: [{ x: h.x, y: h.y }, { x, y }], dive: true });
      placeUnit(c, h, x, y, 'dive');
      ev(c, { t: 'fx', k: 'splash', x, y });
      if (lv > 1 && isDeep(c, x, y)) addStatus(c, h, 'sub', 1);
    },
    keepSub: true,
  },
  m_drown: {
    name: 'Afogar', cls: 'mergulhadora', kind: 'active', cost: 2, icon: '🫳', attack: true,
    desc: (lv) => `Segura um inimigo adjacente que esteja na água: ${2 + lv} de dano de água (ignora armadura) e o Prende (1).`,
    up: '+1 de dano.',
    targets: (c, h) => adjTargets(c, h, (x, y, u) => u && u.side === 'enemy' && isWater(c, x, y)),
    apply(c, h, x, y, lv) {
      const v = unitAt(c, x, y);
      ev(c, { t: 'fx', k: 'splash', x, y });
      damage(c, v, 2 + lv, { src: h, el: 'water', consumePressure: true });
      if (v.hp > 0) addStatus(c, v, 'root', 1);
    },
  },
  m_bubble: {
    name: 'Bolha', cls: 'mergulhadora', kind: 'active', cost: 1, quick: true, icon: '🫧',
    desc: (lv) => `Ação rápida: ganha ${lv + 1} de Escudo (+1 se estiver na água).`,
    up: '+1 de Escudo.',
    targets: selfTarget,
    apply(c, h, x, y, lv) { addStatus(c, h, 'shield', lv + 1 + (isWater(c, h.x, h.y) ? 1 : 0)); },
    keepSub: true,
  },
  m_spout: {
    name: 'Tromba d\'Água', cls: 'mergulhadora', kind: 'active', cost: (lv) => (lv > 1 ? 2 : 3), icon: '🌪',
    desc: (lv) => `Ergue uma coluna de água (alcance 3): numa área 3×3 a água sobe 2 níveis por 2 rodadas. Afunda pesados, afoga os de terra. Custo ${lv > 1 ? 2 : 3}.`,
    up: 'Custo 2.',
    targets: (c, h) => rangeTargets(c, h, 3, () => true, 0),
    apply(c, h, x, y) {
      ev(c, { t: 'fx', k: 'whirl', x, y });
      ev(c, { t: 'sfx', k: 'wave' });
      for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) {
        if (!inB(c, xx, yy)) continue;
        const t = tileAt(c, xx, yy);
        t.tm = 2; t.tmd = 2;
      }
      applyFlood(c);
    },
  },
  m_ambush: {
    name: 'Emboscada', cls: 'mergulhadora', kind: 'passive', icon: '🦈',
    desc: () => 'Ataques físicos feitos enquanto Submersa causam +2 de dano.',
    mods: () => ({ ambush: 2 }),
  },
  m_pressure: {
    name: 'Pressão', cls: 'mergulhadora', kind: 'passive', icon: '⏬',
    desc: () => 'Terminar o turno em água funda acumula 1 Pressão (máx. 3). Seu próximo ataque soma a Pressão ao dano.',
    onTurnEnd(c, h) {
      if (isDeep(c, h.x, h.y)) { h.cs.pressure = Math.min(3, (h.cs.pressure || 0) + 1); ev(c, { t: 'text', x: h.x, y: h.y, s: `Pressão ${h.cs.pressure}`, col: '#7fd' }); }
    },
  },
  m_current: {
    name: 'Correnteza', cls: 'mergulhadora', kind: 'passive', icon: '〰',
    desc: () => 'Começar o turno na água dá +1 de Movimento e +1 de Fôlego.',
    mods: () => ({ waterMove: 1 }),
    onTurnStart(c, h) { if (isWater(c, h.x, h.y)) h.fol = Math.min(h.folMax, h.fol + 1); },
  },

  // =================== CANTORA DE MARÉ ===================
  c_note: {
    name: 'Nota', cls: 'cantora', kind: 'basic', cost: 0, icon: '🎵', attack: true, tag: 'Canto',
    desc: (lv, h) => `Um inimigo a até 3 casas (sem precisar de linha): ${1 + Math.floor(A(h, 'can') / 3)} de dano, +1 se ele estiver na água${wp(h, 'notePush', 0) ? '; na água, também é empurrado 1 casa para longe' : ''}.`,
    targets: (c, h) => rangeTargets(c, h, 3, (x, y, u) => u && u.side === 'enemy' && !u.st.sub, 1),
    apply(c, h, x, y) {
      const v = unitAt(c, x, y);
      ev(c, { t: 'fx', k: 'note', from: { x: h.x, y: h.y }, to: { x, y } });
      ev(c, { t: 'sfx', k: 'note' });
      const wet = isWater(c, x, y);
      damage(c, v, 1 + Math.floor(A(h, 'can') / 3) + (wet ? 1 : 0), { src: h, el: 'water' });
      if (v.hp > 0 && wet && wp(h, 'notePush', 0)) { const d = dirTo(h, v); push(c, v, d >= 0 ? d : (Math.abs(v.x - h.x) > Math.abs(v.y - h.y) ? (v.x > h.x ? 1 : 3) : (v.y > h.y ? 2 : 0)), 1, { src: h }); }
    },
  },
  c_horn: {
    name: 'Búzio de Guerra', cls: 'cantora', kind: 'basic', cost: 0, icon: '📯', attack: true,
    desc: () => 'Som perfurante em linha (até 4): 1 de dano em TODAS as unidades na linha.',
    targets: (c, h) => lineTargets(c, h, 4, { stopAtUnit: false }),
    apply(c, h, x, y) {
      const d = dirOf(h, x, y);
      const tiles = [];
      for (let k = 1; k <= 4; k++) {
        const xx = h.x + DIRS[d].x * k, yy = h.y + DIRS[d].y * k;
        if (!inB(c, xx, yy) || tileAt(c, xx, yy).t === 'wall') break;
        tiles.push({ x: xx, y: yy });
      }
      ev(c, { t: 'fx', k: 'beam', tiles, from: { x: h.x, y: h.y } });
      for (const p of tiles) { const v = unitAt(c, p.x, p.y); if (v && v.side === 'enemy') damage(c, v, 1, { src: h, el: 'water' }); }
    },
  },
  c_hum: {
    name: 'Sussurro', cls: 'cantora', kind: 'basic', cost: 0, icon: '🌬',
    desc: () => 'Adjacente: 1 de dano e empurra 1 casa.',
    targets: (c, h) => adjUnits(c, h),
    apply(c, h, x, y) {
      const v = unitAt(c, x, y);
      if (!v) { hitAt(c, h, x, y, 1); return; }
      meleeHit(c, h, v, 1);
      if (v.hp > 0) push(c, v, dirTo(h, { x, y }), 1, { src: h });
    },
  },
  c_flood: {
    name: 'Canto da Enchente', cls: 'cantora', kind: 'active', cost: 2, icon: '🌊', song: true,
    desc: (lv) => `A maré sobe 1 nível agora e por ${lv + 1} rodadas (contando esta).`,
    up: 'Dura 1 rodada a mais.',
    targets: selfTarget,
    available: (c) => (c.tide >= 4 ? 'A maré já está no máximo' : true),
    apply(c, h, x, y, lv) { sing(c, h, +1, lv + 1); },
  },
  c_ebb: {
    name: 'Canto da Vazante', cls: 'cantora', kind: 'active', cost: 2, icon: '🏝', song: true,
    desc: (lv) => `A maré baixa 1 nível agora e por ${lv + 1} rodadas (contando esta).`,
    up: 'Dura 1 rodada a mais.',
    targets: selfTarget,
    available: (c) => (c.tide <= 0 ? 'A maré já está no mínimo' : true),
    apply(c, h, x, y, lv) { sing(c, h, -1, lv + 1); },
  },
  c_current: {
    name: 'Corrente', cls: 'cantora', kind: 'active', cost: 2, icon: '➰', song: false,
    desc: (lv) => `Escolha uma direção: TODAS as outras unidades que estão na água são arrastadas ${lv} casa(s) nessa direção.`,
    up: 'Arrasta 2 casas.',
    targets: dirTargets,
    apply(c, h, x, y, lv) {
      const d = dirTo(h, { x, y });
      const D = DIRS[d];
      const list = c.units.filter((u) => u.hp > 0 && u !== h && isWater(c, u.x, u.y));
      list.sort((a, b) => (b.x * D.x + b.y * D.y) - (a.x * D.x + a.y * D.y));
      ev(c, { t: 'fx', k: 'current', dir: d });
      ev(c, { t: 'sfx', k: 'wave' });
      for (const u of list) if (u.hp > 0) push(c, u, d, lv, { src: h });
    },
  },
  c_living: {
    name: 'Maré Viva', cls: 'cantora', kind: 'active', cost: 2, icon: '💦', tag: 'Canto',
    desc: (lv, h) => `Todos os inimigos que estão na água sofrem ${1 + can2(h) + (lv - 1)} de dano de água (ignora armadura).`,
    up: '+1 de dano.',
    targets: selfTarget,
    apply(c, h, x, y, lv) {
      ev(c, { t: 'fx', k: 'song', x: h.x, y: h.y });
      for (const u of liveEnemies(c)) if (isWater(c, u.x, u.y)) damage(c, u, 1 + can2(h) + (lv - 1), { src: h, el: 'water', area: true });
    },
  },
  c_lament: {
    name: 'Lamento', cls: 'cantora', kind: 'active', cost: 1, cd: 2, icon: '🎶',
    desc: (lv) => `Um inimigo a até 3 casas fica Atordoado (ataque cancelado)${lv > 1 ? ' e Exposto (2)' : ''}. Recarga 2.`,
    up: 'Também deixa Exposto.',
    targets: (c, h) => rangeTargets(c, h, 3, (x, y, u) => u && u.side === 'enemy', 1),
    apply(c, h, x, y, lv) {
      const v = unitAt(c, x, y);
      ev(c, { t: 'fx', k: 'note', from: { x: h.x, y: h.y }, to: { x, y } });
      addStatus(c, v, 'stun', 1);
      if (lv > 1) addStatus(c, v, 'mark', 2);
    },
  },
  c_salt: {
    name: 'Âncora de Sal', cls: 'cantora', kind: 'active', cost: 1, icon: '🧂', quick: (lv) => lv > 1,
    desc: (lv) => `Cristaliza sal num quadrado a até 3 casas: o terreno sobe 1 nível (máx. 2) permanentemente.${lv > 1 ? ' Ação rápida.' : ''}`,
    up: 'Não gasta a ação.',
    targets: (c, h) => rangeTargets(c, h, 3, (x, y, u, t) => t.t !== 'pit' && t.e < 2 && !t.obj && t.t !== 'coral', 0),
    apply(c, h, x, y) { raiseTile(c, x, y, 1); },
  },
  c_lullaby: {
    name: 'Canção de Ninar', cls: 'cantora', kind: 'active', cost: 2, icon: '🌙',
    desc: (lv) => `Inimigos a até ${lv + 1} casas que estejam na água ficam Atordoados.`,
    up: 'Raio +1.',
    targets: selfTarget,
    apply(c, h, x, y, lv) {
      ev(c, { t: 'fx', k: 'song', x: h.x, y: h.y });
      for (const u of liveEnemies(c)) if (manhattan(u, h) <= lv + 1 && isWater(c, u.x, u.y)) addStatus(c, u, 'stun', 1);
    },
  },
  c_surge: {
    name: 'Arrebentação', cls: 'cantora', kind: 'active', cost: (lv) => (lv > 1 ? 2 : 3), icon: '🌊', attack: true,
    desc: (lv) => `Todas as unidades a até 2 casas são empurradas 1 casa para longe e sofrem 1 de dano (2 se estiverem na água). Custo ${lv > 1 ? 2 : 3}.`,
    up: 'Custo 2.',
    targets: selfTarget,
    apply(c, h) {
      ev(c, { t: 'fx', k: 'flash', x: h.x, y: h.y, r: 2, col: '#5ec8ff' });
      ev(c, { t: 'sfx', k: 'wave' });
      const list = c.units.filter((u) => u.hp > 0 && u !== h && manhattan(u, h) <= 2);
      list.sort((a, b) => manhattan(b, h) - manhattan(a, h));
      for (const u of list) {
        damage(c, u, isWater(c, u.x, u.y) ? 2 : 1, { src: h, el: 'water', area: true });
        if (u.hp > 0) {
          const dx = u.x - h.x, dy = u.y - h.y;
          const dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
          push(c, u, dir, 1, { src: h });
        }
      }
    },
  },
  c_choir: {
    name: 'Coro', cls: 'cantora', kind: 'passive', icon: '👥',
    desc: () => 'Sempre que a maré muda (por qualquer motivo), você ganha 2 de Escudo.',
    onTide(c, h) { addStatus(c, h, 'shield', 2); },
  },
  c_harmony: {
    name: 'Harmonia', cls: 'cantora', kind: 'passive', icon: '🎼', tag: 'Canto',
    desc: (lv, h) => `Seus cantos de maré curam ${1 + Math.floor(A(h, 'can') / 3)} de vida.`,
  },

  // =================== CONTEXTUAIS ===================
  free_captive: {
    name: 'Libertar', kind: 'context', cost: 0, icon: '🔓',
    desc: () => 'Solta um morador preso ao seu lado. Ele foge para a superfície.',
    available: (c, h) => (c.units.some((u) => u.captive && u.hp > 0 && manhattan(u, h) === 1) ? true : 'Fique ao lado do morador'),
    targets: (c, h) => c.units.filter((u) => u.captive && u.hp > 0 && manhattan(u, h) === 1).map((u) => ({ x: u.x, y: u.y })),
    apply(c, h, x, y) {
      const u = unitAt(c, x, y);
      if (!u) return;
      u.hp = 0; u.dead = true;
      c.obj.rescued = (c.obj.rescued || 0) + 1;
      ev(c, { t: 'death', id: u.id, x: u.x, y: u.y, flee: true });
      ev(c, { t: 'text', x, y, s: 'Resgatado!', col: '#9be35a' });
      log(c, `${u.name} foi libertado e corre para a superfície!`, 'good');
    },
  },
  ending_concha: {
    name: 'Devolver a Concha-Mãe', kind: 'context', cost: 0, icon: '🐚',
    desc: () => 'Entregar a Maren aquilo que os fundadores de Salgema roubaram.',
    available: (c, h) => (c.obj.concha && (c.obj.phase || 1) >= 2 ? true : 'Ainda não'),
    targets: (c) => liveEnemies(c).filter((u) => u.def === 'maren').map((u) => ({ x: u.x, y: u.y })),
    apply(c) { c.obj.done = true; c.obj.ending = 'concha'; c.obj.doneText = 'Maren segura a Concha-Mãe. O mar se acalma.'; },
  },
  ending_versos: {
    name: 'Cantar os Três Versos', kind: 'context', cost: 0, icon: '👑',
    desc: () => 'Cantar a canção inteira de Aurélia e tomar a voz da maré para si.',
    available: (c) => (c.obj.versos && (c.obj.phase || 1) >= 2 ? true : 'Ainda não'),
    targets: (c, h) => [{ x: h.x, y: h.y }],
    apply(c) { c.obj.done = true; c.obj.ending = 'versos'; c.obj.doneText = 'Sua voz cobre a de Maren. A maré agora obedece a você.'; },
  },
});
