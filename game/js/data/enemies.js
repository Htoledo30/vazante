// Bestiário: inimigos comuns, elites e chefes dos quatro distritos.
import { register } from '../combat/registry.js';
import { DIRS, DIR8, manhattan, cheb } from '../core/util.js';
import { rnd, pick } from '../core/rng.js';
import {
  getHero, unitAt, tileAt, inB, isWater, isDeep, damage, addStatus, ev, log, heal, solidTile,
  raiseTile, spawnEnemy, liveEnemies, hasTag, nearestFree, walkable,
} from '../combat/engine.js';
import { genericPlan, candidateIntents, scoreIntent, approach } from '../combat/ai.js';
import { reachable } from '../combat/engine.js';
import { walkEnemy } from '../combat/attacks.js';
import { pathTo } from '../combat/engine.js';

const adjFree = (c, x, y) => DIRS.map((d) => ({ x: x + d.x, y: y + d.y })).filter((p) => {
  const t = tileAt(c, p.x, p.y);
  return t && !solidTile(t) && t.t !== 'pit' && t.t !== 'wall';
});

function submergeIdle(c, u) {
  if (isDeep(c, u.x, u.y) && !u.intent) { u.st.sub = 1; ev(c, { t: 'status', id: u.id, s: 'sub', n: 1 }); }
}

function bellsLeft(c) {
  let n = 0;
  for (const t of c.tiles) if (t.obj && t.obj.k === 'bell' && t.obj.big) n++;
  return n;
}
function chainsLeft(c) {
  let n = 0;
  for (const t of c.tiles) if (t.obj && t.obj.k === 'chain') n++;
  return n;
}

register('enemies', {
  // ================= DISTRITO 1 — PORTO AFOGADO =================
  crab: {
    name: 'Caranguejo-Ferrugem', d: 1, hp: 3, armor: 1, move: 2, tags: ['carapace'], xp: 3, pearls: 1, sprite: 'crab',
    attacks: [{ name: 'Pinça', kind: 'strike', dmg: 2 }],
    desc: 'Carapaça grossa (armadura 1). Se colidir com algo, fica Virado: sem armadura e sem agir.',
    tip: 'Empurre-o contra paredes ou outros inimigos. Colisões ignoram armadura.',
  },
  drowned: {
    name: 'Afogado', d: 1, hp: 4, move: 1, tags: ['revive', 'drowned'], xp: 3, pearls: 1, sprite: 'drowned',
    attacks: [{ name: 'Golpe Encharcado', kind: 'strike', dmg: 3, push: 1 }],
    desc: 'Lento e pesado de bater. Se morrer dentro d\'água, levanta-se uma vez com metade da vida.',
    tip: 'Mate-o em terra firme ou com fogo para que não volte.',
  },
  eel: {
    name: 'Enguia-Lume', d: 1, hp: 3, move: 3, tags: ['aquatic', 'waterOnly'], xp: 3, pearls: 2, sprite: 'eel', preferWater: true,
    attacks: [{ name: 'Descarga', kind: 'line', range: 3, dmg: 1, el: 'shock', fx: 'zap', sfx: 'zap' }],
    idle: submergeIdle,
    desc: 'Só se move na água. Em água funda fica Submersa quando não ataca. Seu choque se espalha por toda a água conectada.',
    tip: 'Quando a maré baixa ela encalha e fica indefesa. Saia da água antes que ela dispare.',
  },
  gull: {
    name: 'Gaivota Carniceira', d: 1, hp: 2, move: 3, tags: ['flying'], xp: 2, pearls: 1, sprite: 'gull',
    attacks: [{ name: 'Rasante', kind: 'charge', range: 4, dmg: 2 }],
    desc: 'Voa sobre água e ralos. Investe em linha reta até atingir algo.',
    tip: 'A investida acompanha a gaivota: se ela for empurrada, o rasante muda de rota.',
  },
  smuggler: {
    name: 'Contrabandista Afogado', d: 1, hp: 3, move: 2, keepDist: 3, tags: ['drowned'], xp: 3, pearls: 3, sprite: 'smuggler',
    attacks: [
      { name: 'Garrafa de Óleo', kind: 'lob', range: 4, dmg: 1, splash: true, splashDmg: 0, oil: true, fx: 'bottle' },
      { name: 'Tocha', kind: 'lob', range: 4, dmg: 1, el: 'fire', ignite: true, weight: 2, fx: 'torch',
        when: (c) => { const h = getHero(c); return h && (tileAt(c, h.x, h.y).oil || h.st.oiled); } },
    ],
    desc: 'Arremessa garrafas de óleo e, quando você está encharcado de óleo, uma tocha.',
    tip: 'Óleo flutua: até sobre a água ele pega fogo. Fique longe das manchas.',
  },
  barnacle: {
    name: 'Bomba de Cracas', d: 1, hp: 2, move: 2, xp: 2, pearls: 1, sprite: 'barnacle', reckless: true,
    attacks: [{ name: 'Estourar', kind: 'burst', dmg: 2, selfDestruct: true, fx: 'boom', sfx: 'boom' }],
    onDeath(c, u, o) {
      if (u.mem.exploded) return;
      ev(c, { t: 'fx', k: 'boom', x: u.x, y: u.y });
      for (const d of DIR8) { const v = unitAt(c, u.x + d.x, u.y + d.y); if (v) damage(c, v, 1, { el: 'impact', area: true }); }
    },
    desc: 'Rasteja até você e explode. Se for morta, estoura mesmo assim (1 de dano ao redor).',
    tip: 'Empurre-a para perto de outros inimigos antes de destruí-la.',
  },
  captain: {
    name: 'Capitão Cracas', d: 1, elite: true, hp: 13, armor: 1, move: 1, xp: 10, pearls: 10, sprite: 'captain',
    attacks: [
      { name: 'Canhão de Mão', kind: 'line', range: 7, dmg: 3, push: 1, windup: 1, cd: 1, weight: 1.5, fx: 'cannon', sfx: 'boom' },
      { name: 'Sabre', kind: 'strike', dmg: 2 },
      { name: 'Apito', kind: 'spawn', spawn: 'barnacle', count: 2, cd: 3 },
    ],
    desc: 'Elite. Carrega o canhão por uma rodada antes de disparar. Convoca Bombas de Cracas.',
    tip: 'O canhão é relativo a ele: empurre-o e o tiro sai torto — talvez em um aliado dele.',
  },

  // ================= DISTRITO 2 — JARDINS DE CORAL =================
  polyp: {
    name: 'Pólipo', d: 2, hp: 3, move: 0, tags: ['immobile'], xp: 2, pearls: 1, sprite: 'polyp',
    attacks: [{
      name: 'Brotar', kind: 'coral', dmg: 1, cd: 1, idleScore: 2,
      pattern(c, u) {
        const h = getHero(c);
        const cands = adjFree(c, u.x, u.y).filter((p) => !unitAt(c, p.x, p.y) || unitAt(c, p.x, p.y).side === 'player');
        cands.sort((a, b) => (h ? manhattan(a, h) - manhattan(b, h) : 0));
        return cands.slice(0, 2);
      },
    }],
    onDeath(c, u) {
      ev(c, { t: 'fx', k: 'poison', x: u.x, y: u.y });
      for (const d of DIRS) { const v = unitAt(c, u.x + d.x, u.y + d.y); if (v) addStatus(c, v, 'poison', 2); }
    },
    desc: 'Imóvel. Faz coral brotar ao redor (quem estiver no lugar leva dano e fica preso). Ao morrer, solta veneno nos vizinhos.',
    tip: 'Mate-o à distância ou empurre algo contra ele.',
  },
  jelly: {
    name: 'Água-viva', d: 2, hp: 3, move: 2, tags: ['aquatic', 'waterOnly', 'stinging'], xp: 3, pearls: 2, sprite: 'jelly', preferWater: true,
    attacks: [{ name: 'Tentáculos', kind: 'slam', cross: true, dmg: 2, el: 'shock', fx: 'zap' }],
    desc: 'Urticante: quem a golpeia corpo a corpo leva 1 de choque. Encalha fora d\'água.',
    tip: 'Ataque à distância, ou baixe a maré para deixá-la encalhada.',
  },
  urchin: {
    name: 'Ouriço-Rei', d: 2, hp: 5, armor: 1, move: 1, tags: ['spiky', 'heavy'], xp: 3, pearls: 2, sprite: 'urchin',
    attacks: [{ name: 'Rolar', kind: 'charge', range: 3, dmg: 2, push: 1 }],
    desc: 'Espinhoso: quem colide com ele leva +2, quem o golpeia corpo a corpo leva 1. Pesado: afunda em água funda.',
    tip: 'Use-o como arma: empurre outros inimigos contra ele.',
  },
  hermit: {
    name: 'Ermitão', d: 2, hp: 5, move: 2, xp: 3, pearls: 2, sprite: 'hermit',
    attacks: [{ name: 'Garra Pesada', kind: 'strike', dmg: 3 }],
    plan(c, u, fl) {
      const h = getHero(c);
      if (h && manhattan(u, h) <= 1) { u.st.shell = 1; ev(c, { t: 'status', id: u.id, s: 'shell', n: 1 }); }
      genericPlan(c, u, this, fl);
    },
    desc: 'Quando começa o turno ao seu lado, recolhe-se na concha (+3 armadura contra golpes físicos).',
    tip: 'Fogo, choque, veneno e colisões atravessam a concha.',
  },
  moray: {
    name: 'Moreia', d: 2, hp: 4, move: 3, tags: ['aquatic', 'waterOnly'], xp: 3, pearls: 2, sprite: 'moray', preferWater: true,
    attacks: [{ name: 'Bote', kind: 'strike', reach: 2, dmg: 3 }],
    idle: submergeIdle,
    desc: 'Ataca duas casas em linha. Submerge em água funda quando não ataca.',
    tip: 'Fique fora da linha dela, ou na terra.',
  },
  puffer: {
    name: 'Baiacu', d: 2, hp: 3, move: 2, tags: ['aquatic'], xp: 2, pearls: 1, sprite: 'puffer', reckless: true,
    attacks: [{ name: 'Inflar', kind: 'burst', dmg: 2, st: { poison: 2 }, selfDestruct: true, fx: 'poison', sfx: 'boom' }],
    desc: 'Explode em espinhos venenosos ao seu lado.',
    tip: 'Mantenha distância ou empurre-o para junto dos aliados dele.',
  },
  matron: {
    name: 'Mãe-Coral', d: 2, elite: true, hp: 15, armor: 1, move: 0, tags: ['immobile'], xp: 10, pearls: 10, sprite: 'matron',
    attacks: [
      { name: 'Esporos', kind: 'lob', range: 6, dmg: 1, splash: true, splashDmg: 1, st: { poison: 2 }, fx: 'spore' },
      { name: 'Gerar Pólipo', kind: 'spawn', spawn: 'polyp', count: 1, cd: 2, near: 'hero', weight: 1.2 },
    ],
    desc: 'Elite imóvel. Lança esporos venenosos e semeia Pólipos perto de você.',
    tip: 'Avance rápido: ela não se move, mas o jardim dela cresce.',
  },

  // ================= DISTRITO 3 — BAIRRO DOS SINOS =================
  automaton: {
    name: 'Autômato Sineiro', d: 3, hp: 7, armor: 2, move: 1, tags: ['heavy'], xp: 4, pearls: 3, sprite: 'automaton',
    attacks: [{ name: 'Martelo', kind: 'slam', cross: true, dmg: 3, push: 1, sfx: 'bump' }],
    desc: 'Blindado (armadura 2) e pesado: afunda instantaneamente em água funda.',
    tip: 'Empurre-o para a água funda ou espere a maré subir sob ele.',
  },
  acolyte: {
    name: 'Acólito do Coro', d: 3, hp: 4, move: 2, keepDist: 3, xp: 3, pearls: 2, sprite: 'acolyte',
    attacks: [
      { name: 'Hino de Proteção', kind: 'buff', shield: 3, range: 4 },
      { name: 'Cântico da Enchente', kind: 'tide', delta: 1, rounds: 2, cd: 3, score: () => 4 },
      { name: 'Nota Aguda', kind: 'line', range: 3, dmg: 1 },
    ],
    desc: 'Protege aliados com Escudo e canta para a maré subir.',
    tip: 'Prioridade: um acólito vivo torna todos os outros mais duros.',
  },
  sentinel: {
    name: 'Sentinela de Bronze', d: 3, hp: 6, armor: 1, move: 1, tags: ['heavy'], xp: 4, pearls: 3, sprite: 'sentinel',
    attacks: [{ name: 'Raio Solar', kind: 'beam', range: 7, dmg: 3, windup: 1, cd: 1, fx: 'beam', sfx: 'zap' }],
    desc: 'Carrega um raio perfurante por uma rodada. Atinge tudo na linha até uma parede.',
    tip: 'Use a carga para empurrá-lo e mirar o raio nos aliados dele.',
  },
  shade: {
    name: 'Sombra Afogada', d: 3, hp: 4, move: 4, tags: ['flying'], xp: 3, pearls: 2, sprite: 'shade',
    attacks: [{ name: 'Toque Gélido', kind: 'strike', dmg: 2, st: { mark: 2 } }],
    desc: 'Flutua sobre tudo e deixa você Exposto (+1 de dano recebido).',
    tip: 'Frágil: um bom golpe resolve.',
  },
  bellmimic: {
    name: 'Sineta', d: 3, hp: 3, move: 2, xp: 3, pearls: 2, sprite: 'bellmimic',
    attacks: [{ name: 'Badalo', kind: 'slam', dmg: 1, st: { stun: 1 }, sfx: 'bell' }],
    desc: 'Seus golpes atordoam: você perde a ação do próximo turno.',
    tip: 'Nunca termine o turno colado a ela.',
  },
  crossbow: {
    name: 'Besteiro de Bronze', d: 3, hp: 4, move: 2, keepDist: 3, xp: 3, pearls: 2, sprite: 'crossbow',
    attacks: [{ name: 'Virote', kind: 'line', range: 6, dmg: 2, push: 1, fx: 'bolt' }],
    desc: 'Atira de longe e empurra o alvo.',
    tip: 'Coloque um obstáculo — ou um inimigo — entre vocês.',
  },
  conductor: {
    name: 'Regente do Coro', d: 3, elite: true, hp: 15, move: 2, armor: 1, xp: 10, pearls: 12, sprite: 'conductor',
    attacks: [
      { name: 'Batuta', kind: 'strike', dmg: 3, push: 1 },
      { name: 'Fortíssimo', kind: 'cross', range: 3, dmg: 2, cd: 2, fx: 'beam' },
      { name: 'Convocar Coro', kind: 'spawn', spawn: 'acolyte', count: 1, cd: 3 },
    ],
    desc: 'Elite. Rege os acólitos e solta ondas sonoras nas quatro direções.',
    tip: 'Mate os acólitos convocados antes que blindem o Regente.',
  },

  // ================= DISTRITO 4 — CATEDRAL DO ABISMO =================
  abyssal: {
    name: 'Abissal', d: 4, hp: 8, armor: 1, move: 2, tags: ['aquatic'], xp: 5, pearls: 3, sprite: 'abyssal', preferWater: true,
    attacks: [
      { name: 'Garras Abissais', kind: 'strike', dmg: 4 },
      { name: 'Arrastar', kind: 'pull', range: 3, dmg: 1, pull: 2 },
    ],
    desc: 'Caçador das profundezas: puxa a presa para perto e a dilacera.',
    tip: 'O puxão pode trazê-lo para o alcance dos seus golpes — ou para a água funda.',
  },
  priest: {
    name: 'Sacerdote da Maré', d: 4, hp: 6, move: 2, keepDist: 3, tags: ['drowned'], xp: 4, pearls: 3, sprite: 'priest',
    attacks: [
      { name: 'Bênção Salgada', kind: 'buff', heal: 3, shield: 1, range: 4 },
      { name: 'Prece da Maré', kind: 'tide', delta: 1, rounds: 3, cd: 3, score: () => 4 },
      { name: 'Jato Salgado', kind: 'line', range: 4, dmg: 2, el: 'water' },
    ],
    desc: 'Cura aliados e faz a maré subir por três rodadas.',
    tip: 'Interrompa-o: atordoar cancela a prece.',
  },
  squid: {
    name: 'Lula Sombria', d: 4, hp: 5, move: 3, tags: ['aquatic'], xp: 4, pearls: 3, sprite: 'squid', preferWater: true,
    attacks: [
      { name: 'Nuvem de Tinta', kind: 'lob', range: 4, dmg: 1, splash: true, splashDmg: 1, ink: 3, fx: 'ink' },
      { name: 'Tentáculo', kind: 'strike', reach: 2, dmg: 2 },
    ],
    desc: 'Espalha tinta: intenções de inimigos dentro da tinta ficam ocultas.',
    tip: 'Na dúvida, não fique perto de quem está na tinta.',
  },
  echo: {
    name: 'Eco', d: 4, hp: 6, move: 3, xp: 4, pearls: 3, sprite: 'echo',
    attacks: [{ name: 'Reverberação', kind: 'line', range: 5, dmg: 3, fx: 'zap' }],
    onDamaged(c, u) {
      const spots = [];
      for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (walkable(c, x, y, u) && !unitAt(c, x, y) && !tileAt(c, x, y).fire) spots.push({ x, y });
      if (!spots.length) return;
      const p = spots[Math.floor(rnd(c.rng) * spots.length)];
      u.x = p.x; u.y = p.y; u.intent = null;
      ev(c, { t: 'tp', id: u.id, x: p.x, y: p.y });
      ev(c, { t: 'cancel', id: u.id });
    },
    desc: 'Ao sofrer dano sem morrer, ressoa e reaparece em outro lugar (cancelando o ataque).',
    tip: 'Ferir o Eco é uma forma de desarmá-lo. Matá-lo de uma vez é melhor.',
  },
  saltgolem: {
    name: 'Guardião de Sal', d: 4, hp: 10, armor: 2, move: 1, tags: ['heavy'], xp: 5, pearls: 4, sprite: 'saltgolem',
    attacks: [{ name: 'Punho de Sal', kind: 'strike', dmg: 4, push: 2 }],
    onDeath(c, u) { raiseTile(c, u.x, u.y, 1); log(c, 'O guardião desmorona num monte de sal.'); },
    desc: 'Blindado e pesado. Ao morrer, vira um monte de sal (eleva o terreno).',
    tip: 'Pesado: a água funda resolve o problema.',
  },
  leviathan: {
    name: 'Cria do Leviatã', d: 4, elite: true, hp: 20, armor: 1, move: 2, tags: ['aquatic'], xp: 12, pearls: 14, sprite: 'leviathan',
    attacks: [
      { name: 'Mordida', kind: 'strike', dmg: 5 },
      { name: 'Vagalhão', kind: 'beam', range: 7, dmg: 2, push: 1, windup: 1, cd: 2, fx: 'wave' },
    ],
    onRoundEnd(c, u) { if (isWater(c, u.x, u.y)) heal(c, u, 1); },
    desc: 'Elite. Regenera 1 por rodada na água. O Vagalhão empurra tudo na linha.',
    tip: 'Combata-o com a maré baixa.',
  },

  // ================= CHEFES =================
  carranca: {
    name: 'A Carranca', d: 1, boss: true, hp: 32, move: 0, tags: ['boss', 'immobile', 'stunImmune'], xp: 20, pearls: 25, sprite: 'carranca',
    modDamage(c, u, a, o) {
      if (o.el === 'pure') return a;
      const n = chainsLeft(c);
      if (n > 0) return Math.max(0, a - n);
      return a + 1;
    },
    attacks: [
      { name: 'Canhonada', kind: 'multi', dmg: 3, fx: 'cannon', sfx: 'boom',
        shape: (c, u, a, it) => ({ hits: it.tiles.map((p) => ({ x: p.x, y: p.y, dmg: a.dmg, push: null })), path: [] }) },
      { name: 'Onda de Proa', kind: 'wave', dmg: 1, push: 2,
        shape(c, u, a) {
          const hits = [];
          for (let y = u.y + 1; y < c.h; y++) for (let x = u.x - 1; x <= u.x + 1; x++) {
            if (!inB(c, x, y) || tileAt(c, x, y).t === 'wall') continue;
            hits.push({ x, y, dmg: a.dmg, push: 2 });
          }
          hits.sort((p, q) => q.y - p.y);
          return { hits, path: [] };
        } },
      { name: 'Chamado da Tripulação', kind: 'spawn', spawn: 'drowned' },
      { name: 'Maré Alta', kind: 'tide', delta: 1, rounds: 3 },
      { name: 'Chamado das Gaivotas', kind: 'spawn', spawn: 'gull' },
    ],
    plan(c, u) {
      const h = getHero(c);
      if (!h) return;
      const p2 = u.hp <= u.maxHp / 2;
      const seq = p2 ? [0, 1, 3, 0, 2, 4] : [0, 1, 2, 0, 1, 4];
      const step = (u.mem.step || 0) % seq.length;
      u.mem.step = (u.mem.step || 0) + 1;
      let ai = seq[step];
      if ((ai === 2 || ai === 4) && liveEnemies(c).length >= 5) ai = 0;
      const a = this.attacks[ai];
      if (a.kind === 'multi') {
        const tiles = [{ x: h.x, y: h.y }];
        const extra = p2 ? 2 : 1;
        const cands = [];
        for (let y = 2; y < c.h; y++) for (let x = 0; x < c.w; x++) {
          if ((x === h.x && y === h.y) || solidTile(tileAt(c, x, y))) continue;
          if (manhattan({ x, y }, h) <= 3) cands.push({ x, y, r: rnd(c.rng) });
        }
        cands.sort((p, q) => p.r - q.r);
        for (let i = 0; i < extra && i < cands.length; i++) tiles.push({ x: cands[i].x, y: cands[i].y });
        u.intent = { ai, tiles };
      } else if (a.kind === 'spawn') {
        const tiles = [];
        for (let y = 1; y <= 2; y++) for (let x = 0; x < c.w; x++) {
          const t = tileAt(c, x, y);
          if (!solidTile(t) && t.t !== 'pit' && !unitAt(c, x, y)) tiles.push({ x, y, r: rnd(c.rng) });
        }
        tiles.sort((p, q) => p.r - q.r);
        u.intent = { ai, tiles: tiles.slice(0, 2).map((p) => ({ x: p.x, y: p.y })) };
      } else {
        u.intent = { ai };
      }
    },
    onCombatStart(c, u) { c.flags.bossName = u.name; },
    onDeath(c) { c.obj.done = true; c.obj.doneText = 'A Carranca racha e afunda na lama!'; },
    desc: 'Chefe do Porto. Presa ao casco por correntes: cada corrente intacta reduz em 1 todo dano que ela sofre. Sem correntes, sofre +1.',
    tip: 'Quebre as correntes (golpes ou colisões) antes de investir contra ela.',
  },
  gardener: {
    name: 'O Jardineiro', d: 2, boss: true, hp: 42, armor: 1, move: 1, tags: ['boss', 'pushable', 'coralWeak', 'coralWalker'], xp: 25, pearls: 30, sprite: 'gardener',
    attacks: [
      { name: 'Galho Espinhoso', kind: 'strike', dmg: 3, push: 1, weight: 1.5 },
      { name: 'Florescer', kind: 'coral', dmg: 2, idleScore: 0,
        pattern(c) {
          const h = getHero(c);
          if (!h) return [];
          return DIRS.map((d) => ({ x: h.x + d.x, y: h.y + d.y })).filter((p) => {
            const t = tileAt(c, p.x, p.y);
            return t && t.t !== 'wall' && t.t !== 'pit' && !t.obj;
          }).concat([{ x: h.x, y: h.y }]);
        } },
      { name: 'Esporos', kind: 'lob', range: 6, dmg: 1, splash: true, splashDmg: 1, st: { poison: 2 }, fx: 'spore' },
      { name: 'Semear', kind: 'spawn', spawn: 'polyp', count: 2, near: 'hero' },
    ],
    plan(c, u, fl) {
      const h = getHero(c);
      if (!h) return;
      const p2 = u.hp <= u.maxHp / 2;
      u.mem.turn = (u.mem.turn || 0) + 1;
      const t = u.mem.turn;
      if (p2 && t % 4 === 0 && liveEnemies(c).length < 5) { genericPlan(c, u, this, fl, [3]); if (u.intent) return; }
      // tenta golpear se estiver perto
      genericPlan(c, u, this, fl, [0]);
      if (u.intent) return;
      const pick2 = t % 2 === 0 || !p2 ? 1 : 2;
      const a = this.attacks[pick2];
      if (pick2 === 1) u.intent = { ai: 1, tiles: a.pattern(c, u) };
      else u.intent = { ai: 2, tx: h.x, ty: h.y };
    },
    onRoundEnd(c, u) {
      if (isWater(c, u.x, u.y)) { heal(c, u, 2); ev(c, { t: 'text', x: u.x, y: u.y, s: 'Regenera', col: '#9be35a' }); }
    },
    onDeath(c) { c.obj.done = true; c.obj.doneText = 'O Jardineiro se desfaz em coral morto.'; },
    desc: 'Chefe dos Jardins. Faz coral brotar ao seu redor para te aprisionar. Regenera 2 por rodada na água. Colidir com coral o fere gravemente (+3).',
    tip: 'Empurre-o contra o próprio coral, e lute com a maré baixa.',
  },
  sineiro: {
    name: 'O Sineiro', d: 3, boss: true, hp: 56, armor: 0, move: 3, tags: ['boss'], xp: 30, pearls: 35, sprite: 'sineiro',
    modDamage(c, u, a, o) {
      if (o.el === 'pure') return a;
      if ((u.mem.dazed || 0) > 0 || bellsLeft(c) === 0) return a + 1;
      return Math.max(1, Math.floor(a / 2));
    },
    onStun(c, u) { u.mem.dazed = 2; ev(c, { t: 'text', x: u.x, y: u.y, s: 'Desafinado!', col: '#ffe066' }); log(c, 'O Sineiro está desafinado: vulnerável até o fim do seu próximo turno!', 'good'); },
    attacks: [
      { name: 'Dobre', kind: 'ring', dmg: 2, radius: 2, st: { stun: 1 }, sfx: 'bell',
        shape(c, u, a, it) {
          const hits = [];
          const seen = new Set();
          const centers = [{ x: it.tx, y: it.ty }];
          if (it.tiles2) centers.push(it.tiles2);
          for (const ce of centers) {
            for (let y = ce.y - 2; y <= ce.y + 2; y++) for (let x = ce.x - 2; x <= ce.x + 2; x++) {
              if (!inB(c, x, y) || (x === ce.x && y === ce.y)) continue;
              if ((x === u.x && y === u.y) || seen.has(x + ',' + y)) continue;
              seen.add(x + ',' + y);
              hits.push({ x, y, dmg: a.dmg, push: null });
            }
          }
          return { hits, path: [] };
        } },
      { name: 'Martelo de Bronze', kind: 'strike', dmg: 4, push: 2, weight: 1.3 },
      { name: 'Dobre Fúnebre', kind: 'tide', delta: 1, rounds: 2 },
    ],
    plan(c, u, fl) {
      const h = getHero(c);
      if (!h) return;
      if (u.mem.dazed > 0) u.mem.dazed--;
      u.mem.turn = (u.mem.turn || 0) + 1;
      const bells = [];
      c.tiles.forEach((t, i) => { if (t.obj && t.obj.k === 'bell' && t.obj.big) bells.push({ x: i % c.w, y: Math.floor(i / c.w) }); });
      const p2 = u.hp <= u.maxHp / 2;
      if (p2 && u.mem.turn % 4 === 0) { u.intent = { ai: 2 }; return; }
      // golpe direto se possível
      genericPlan(c, u, this, fl, [1]);
      if (u.intent) return;
      if (!bells.length) { approach(c, u, this, reachable(c, u, u.move), h); return; }
      // escolhe sino mais próximo do herói e se teleporta para perto de outro sino
      bells.sort((a, b) => cheb(a, h) - cheb(b, h));
      const target = bells[0];
      const far = bells[bells.length - 1];
      const spot = adjFree(c, far.x, far.y).filter((p) => !unitAt(c, p.x, p.y) && cheb(p, target) > 2);
      if (spot.length) {
        const p = spot[Math.floor(rnd(c.rng) * spot.length)];
        u.x = p.x; u.y = p.y;
        ev(c, { t: 'tp', id: u.id, x: p.x, y: p.y });
      }
      u.intent = { ai: 0, tx: target.x, ty: target.y };
      if (p2 && bells.length > 1) u.intent.tiles2 = { x: bells[1].x, y: bells[1].y };
    },
    onDeath(c) { c.obj.done = true; c.obj.doneText = 'O último dobre se cala. O Sineiro caiu.'; },
    desc: 'Chefe dos Sinos. Ressonante: sofre metade do dano enquanto houver sinos grandes. Atordoá-lo o deixa Desafinado (vulnerável, +1 de dano) até o fim do seu próximo turno.',
    tip: 'Golpeie um sino grande perto dele para atordoá-lo — ou destrua os sinos.',
  },
  maren: {
    name: 'Maren, a Última Cantora', d: 4, boss: true, hp: 75, armor: 1, move: 2, tags: ['boss', 'aquatic'], xp: 0, pearls: 0, sprite: 'maren',
    attacks: [
      { name: 'Lança d\'Água', kind: 'beam', range: 6, dmg: 3, fx: 'wave' },
      { name: 'Abraço do Mar', kind: 'pull', range: 5, dmg: 1, pull: 3 },
      { name: 'Maré Alta', kind: 'tide', delta: 1, rounds: 2, cd: 3, score: () => 3 },
      { name: 'Coro dos Afogados', kind: 'spawn', spawn: 'drowned', count: 2, cd: 4, near: 'hero' },
      { name: 'Canto Final', kind: 'cross', range: 7, dmg: 3, windup: 1, cd: 2, fx: 'beam' },
      { name: 'Redemoinho', kind: 'lob', range: 5, dmg: 2, splash: true, splashDmg: 1, fx: 'wave' },
    ],
    plan(c, u, fl) {
      const ph = u.mem.phase || 1;
      const only = ph === 1 ? [0, 1, 2] : ph === 2 ? [0, 1, 3, 5] : [0, 3, 4, 5];
      genericPlan(c, u, this, fl, only);
    },
    onDamaged(c, u) {
      const ph = u.mem.phase || 1;
      if (ph === 1 && u.hp <= Math.ceil(u.maxHp * 2 / 3)) {
        u.mem.phase = 2;
        c.obj.phase = 2;
        log(c, 'Maren: "Vocês roubaram a minha voz. Eu só quero minha cidade de volta."', 'boss');
        addStatus(c, u, 'shield', 5);
        const spots = [{ x: 0, y: 0 }, { x: c.w - 1, y: 0 }];
        for (const s of spots) { const p = nearestFree(c, s.x, s.y, null); if (p) spawnEnemy(c, 'priest', p.x, p.y); }
        ev(c, { t: 'banner', s: 'Fase 2 — Coro dos Afogados' });
      } else if (ph === 2 && u.hp <= Math.ceil(u.maxHp / 3)) {
        u.mem.phase = 3;
        c.obj.phase = 3;
        c.tideMods.push({ d: 1, r: 99 });
        log(c, 'Maren: "Então que o mar leve tudo — a vila, você, eu."', 'boss');
        ev(c, { t: 'banner', s: 'Fase 3 — A Grande Ressaca' });
      }
    },
    onDeath(c) { c.obj.done = true; c.obj.ending = 'silencio'; c.obj.doneText = 'O canto de Maren se apaga.'; },
    desc: 'A Última Cantora de Aurélia. Comanda a maré. Três fases: Lança e Abraço; Coro dos Afogados; A Grande Ressaca.',
    tip: 'Talvez exista outro jeito de terminar isto além da lâmina.',
  },
  // Cativo (aliado a ser resgatado) — usado só para exibição
  captive: { name: 'Desaparecido', d: 0, hp: 4, attacks: [], sprite: 'captive', desc: 'Um morador de Salgema preso na cidade.' },
});
