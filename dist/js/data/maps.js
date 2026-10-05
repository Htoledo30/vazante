// Layouts de tabuleiro (7×8) por distrito e geração de encontros.
// Legenda: 0/1/2 = chão na elevação 0/1/2 · # parede · c coral (elev 1) · C coral (elev 0)
// k algas (elev 0) · p ralo · b barril · B sino · G sino grande · o óleo (elev 1) · O óleo (elev 0)
// $ tesouro · x caixote · H corrente da Carranca · S estátua
import { rnd, rint, pick, shuffle, weighted } from '../core/rng.js';
import { REG } from '../combat/registry.js';

export const LAYOUTS = {
  1: [
    { name: 'Cais Partido', rows: ['1110111', '1b10011', '1100001', '#10001#', '0000000', '1100011', '11#0#11', '2211122'] },
    { name: 'Mercado Alagado', rows: ['2110112', '1x101b1', '1000001', '10#0#01', '1000001', '1100011', '1111111', '1121211'] },
    { name: 'Estaleiro', rows: ['0011100', '0111110', '01p1p10', '0110110', '00b1100', '0011100', '1111111', '2211122'] },
    { name: 'Escadaria do Porto', rows: ['0000111', '0001112', '0011122', '001#122', '0011112', '0011111', '0111110', '1112100'] },
    { name: 'Doca Seca', rows: ['1111111', '1#000#1', '1000001', '1000001', '1b000b1', '1100011', '1111111', '2211122'] },
    { name: 'Armazém de Óleo', rows: ['1x1b1x1', '1100011', '10o1o01', '1001001', '1100011', '0000000', '1111111', '2211122'] },
  ],
  2: [
    { name: 'Bosque de Coral', rows: ['1c101c1', '10k0k01', 'c00100c', '1k010k1', '10c1c01', '1001001', '1110111', '2211122'] },
    { name: 'Anfiteatro de Coral', rows: ['2221222', '2c111c2', '1100011', '10kkk01', '100000c', 'c100011', '1110111', '1121211'] },
    { name: 'Recife Raso', rows: ['0001000', '0c010c0', '0011100', 'k01210k', '0011100', '0c010c0', '0011100', '1112111'] },
    { name: 'Estufa Afogada', rows: ['1111111', '1c0c0c1', '1000001', '#01p10#', '1000001', '1c0c0c1', '1100011', '2211122'] },
    { name: 'Canteiro de Algas', rows: ['1kkk1k1', '10000k1', '1001001', 'c01210c', '1001001', '1k00001', '1110111', '2211122'] },
  ],
  3: [
    { name: 'Praça do Campanário', rows: ['2211122', '2111112', '11B0B11', '10#2#01', '1000001', '1100011', '1111111', '2211122'] },
    { name: 'Rua das Badaladas', rows: ['1111111', '#11011#', '1100011', '0000000', '1100011', '#1B0B1#', '1111111', '2221222'] },
    { name: 'Telhados', rows: ['2200022', '2200022', '1100011', '1102011', '1100011', '2200022', '2211122', '2211122'] },
    { name: 'Claustro', rows: ['1#111#1', '1100011', '10x0x01', '1002001', '10x0x01', '1100011', '1#101#1', '1111111'] },
    { name: 'Fundição', rows: ['1b111b1', '1000001', '1#0p0#1', '1000001', '1100011', '1o000o1', '1111111', '2211122'] },
  ],
  4: [
    { name: 'Nave Afogada', rows: ['1#000#1', '1000001', '#00100#', '1001001', '1000001', '#00100#', '1000001', '1112111'] },
    { name: 'Altar de Sal', rows: ['0011100', '0012100', '0011100', '0000000', '1p000p1', '1100011', '1111111', '2211122'] },
    { name: 'Cripta', rows: ['1111111', '10p0p01', '1000001', '1#121#1', '1000001', '10p0p01', '1100011', '2211122'] },
    { name: 'Coro Submerso', rows: ['0000000', '0S000S0', '0011100', '0012100', '0011100', '0000000', '1100011', '2211122'] },
  ],
};

export const BOSS_LAYOUTS = {
  carranca: { name: 'Proa da Carranca', rows: ['#11111#', '1H101H1', '1100011', '1000001', '10b0b01', '1000001', '1100011', '2211122'], boss: { x: 3, y: 0 }, schedule: [0, 0, 1, 1, 1, 2, 2, 1, 1, 0, 0, 1, 1, 2, 2, 2] },
  gardener: { name: 'Jardim do Jardineiro', rows: ['1111111', '1c10c11', '1100011', '10k0k01', '1000001', '1c101c1', '1110111', '2211122'], boss: { x: 3, y: 1 }, schedule: [0, 1, 1, 2, 2, 1, 1, 0, 0, 1, 1, 2, 2, 1, 1, 0] },
  sineiro: { name: 'Campanário Maior', rows: ['2211122', '2G111G2', '1100011', '1002001', '1100011', '1G101G1', '1111111', '2211122'], boss: { x: 3, y: 2 }, schedule: [1, 1, 1, 2, 2, 1, 1, 2, 2, 3, 3, 2, 2, 1, 1] },
  maren: { name: 'Altar da Última Cantora', rows: ['0001000', '0011100', '0112110', '0011100', '1000001', '1100011', '1111111', '2211122'], boss: { x: 3, y: 2 }, schedule: [1, 1, 2, 2, 1, 1, 0, 0, 1, 2, 3, 2, 1, 1, 2, 2] },
};

export const TIDES = {
  rising: [0, 0, 1, 1, 2, 2, 3, 3, 3, 3],
  falling: [3, 3, 2, 2, 1, 1, 0, 0, 1, 1, 2, 2],
  wave: [1, 1, 2, 2, 1, 1, 0, 0, 1, 1, 2, 2, 1, 1],
  high: [2, 2, 2, 3, 3, 2, 2, 1, 1, 2, 2, 3],
  low: [0, 0, 0, 1, 1, 1, 2, 2, 2, 3],
  calm: [1, 1, 1, 1, 2, 2, 1, 1, 1, 1, 2, 2],
};
export const TIDE_NAMES = { rising: 'Enchente', falling: 'Vazante', wave: 'Maré Ondulante', high: 'Preamar', low: 'Baixa-mar', calm: 'Maré Mansa' };

const DISTRICT_TIDES = {
  1: [['low', 3], ['rising', 3], ['calm', 2], ['wave', 1]],
  2: [['wave', 3], ['rising', 2], ['falling', 2], ['calm', 2]],
  3: [['rising', 3], ['high', 2], ['wave', 2], ['low', 1]],
  4: [['high', 3], ['wave', 2], ['falling', 2], ['rising', 2]],
};

// Custo de ameaça de cada inimigo na montagem de grupos.
const POOLS = {
  1: [['crab', 2, 3], ['drowned', 2, 3], ['eel', 2, 2], ['gull', 1, 2], ['smuggler', 2, 2], ['barnacle', 1, 2]],
  2: [['polyp', 1, 2], ['jelly', 2, 2], ['urchin', 2, 2], ['hermit', 2, 3], ['moray', 2, 2], ['puffer', 1, 2], ['crab', 2, 1], ['smuggler', 2, 1]],
  3: [['automaton', 3, 3], ['acolyte', 2, 2], ['sentinel', 3, 2], ['shade', 2, 2], ['bellmimic', 2, 2], ['crossbow', 2, 3], ['hermit', 2, 1]],
  4: [['abyssal', 3, 3], ['priest', 2, 2], ['squid', 2, 2], ['echo', 2, 2], ['saltgolem', 3, 2], ['moray', 2, 1], ['sentinel', 3, 1]],
};
const ELITES = { 1: 'captain', 2: 'matron', 3: 'conductor', 4: 'leviathan' };
export const BOSSES = { 1: 'carranca', 2: 'gardener', 3: 'sineiro', 4: 'maren' };

export function parseLayout(rows, mirror = false) {
  const tiles = [];
  for (let y = 0; y < 8; y++) {
    let row = rows[y];
    if (mirror) row = row.split('').reverse().join('');
    for (let x = 0; x < 7; x++) {
      const ch = row[x];
      const t = { e: 1, t: 'floor' };
      switch (ch) {
        case '0': t.e = 0; break;
        case '1': t.e = 1; break;
        case '2': t.e = 2; break;
        case '#': t.t = 'wall'; t.e = 3; break;
        case 'c': t.t = 'coral'; t.hp = 2; break;
        case 'C': t.t = 'coral'; t.hp = 2; t.e = 0; break;
        case 'k': t.t = 'kelp'; t.e = 0; break;
        case 'p': t.t = 'pit'; t.e = 0; break;
        case 'b': t.obj = { k: 'barrel', hp: 1 }; break;
        case 'B': t.obj = { k: 'bell', hp: 3 }; break;
        case 'G': t.obj = { k: 'bell', hp: 3, big: true }; break;
        case 'o': t.oil = true; break;
        case 'O': t.oil = true; t.e = 0; break;
        case '$': t.loot = { k: 'chest', v: 12 }; break;
        case 'x': t.obj = { k: 'crate', hp: 2, loot: 4 }; break;
        case 'H': t.obj = { k: 'chain', hp: 3 }; break;
        case 'S': t.obj = { k: 'statue', hp: 4 }; break;
        default: break;
      }
      tiles.push(t);
    }
  }
  return tiles;
}

const tAt = (tiles, x, y) => tiles[y * 7 + x];
const freeTile = (t) => t && t.t !== 'wall' && t.t !== 'pit' && t.t !== 'coral' && !t.obj;

function pickSchedule(r, district, needWater) {
  let name = weighted(r, DISTRICT_TIDES[district].map(([n, w]) => ({ n, w }))).n;
  if (needWater && TIDES[name][0] < 1) name = pick(r, ['wave', 'calm', 'high', 'falling']);
  return { name, schedule: TIDES[name].slice() };
}

// Monta um grupo de inimigos dentro de um orçamento de ameaça.
function buildGroup(r, district, budget, allowWater) {
  const pool = POOLS[district].filter(([id]) => allowWater || !(REG.enemies[id].tags || []).includes('waterOnly'));
  const out = [];
  let left = budget;
  let guard = 0;
  while (left > 0 && out.length < 6 && guard++ < 40) {
    const opts = pool.filter(([, cost]) => cost <= left);
    if (!opts.length) break;
    const [id, cost] = weighted(r, opts.map((o) => ({ o, w: o[2] }))).o;
    if (out.filter((x) => x === id).length >= 3) continue;
    out.push(id);
    left -= cost;
  }
  return out;
}

// Cria um encontro completo (tabuleiro, inimigos, maré, objetivo).
export function makeEncounter(r, { district, kind = 'normal', depth = 0, heat = 0, objective = null, captive = null }) {
  const lay = pick(r, LAYOUTS[district]);
  const mirror = rnd(r) < 0.5;
  const tiles = parseLayout(lay.rows, mirror);
  // decoração aleatória: barris, óleo, caixotes
  const extras = rint(r, 0, 2);
  for (let i = 0; i < extras; i++) {
    const x = rint(r, 0, 6), y = rint(r, 2, 5);
    const t = tAt(tiles, x, y);
    if (freeTile(t) && t.e >= 1) {
      const roll = rnd(r);
      if (roll < 0.35) t.obj = { k: 'barrel', hp: 1 };
      else if (roll < 0.6) t.oil = true;
      else if (roll < 0.8) t.obj = { k: 'crate', hp: 2, loot: 4 };
      else t.loot = { k: 'pearl', v: 3 };
    }
  }
  let budget = { 1: 5, 2: 7, 3: 10, 4: 12 }[district] + Math.min(3, Math.floor(depth / 2)) + Math.floor(heat / 3);
  if (kind === 'elite') budget = Math.max(2, budget - 4);
  const hasLow = tiles.some((t) => t.e === 0 && t.t !== 'pit' && t.t !== 'wall');
  const group = buildGroup(r, district, budget, hasLow);
  if (kind === 'elite') group.unshift(ELITES[district]);
  const needWater = group.some((id) => (REG.enemies[id].tags || []).includes('waterOnly'));
  const { name: tideName, schedule } = pickSchedule(r, district, needWater);
  // posições
  const heroPos = findHeroPos(r, tiles);
  const used = new Set([heroPos.x + ',' + heroPos.y]);
  const enemies = [];
  for (const id of group) {
    const d = REG.enemies[id];
    const waterOnly = (d.tags || []).includes('waterOnly');
    const heavy = (d.tags || []).includes('heavy');
    const cands = [];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) {
      const t = tAt(tiles, x, y);
      if (!freeTile(t) || used.has(x + ',' + y)) continue;
      const dep = Math.max(0, schedule[0] - t.e);
      if (waterOnly && dep < 1) continue;
      const tags = d.tags || [];
      if (dep >= 2 && !tags.includes('aquatic') && !tags.includes('flying') && !tags.includes('drowned')) continue;
      if (heavy && dep >= 1) continue;
      if (Math.abs(x - heroPos.x) + Math.abs(y - heroPos.y) < 4) continue;
      cands.push({ x, y, w: 1 + (4 - y) * 0.6 });
    }
    if (!cands.length) continue;
    const p = weighted(r, cands);
    used.add(p.x + ',' + p.y);
    enemies.push({ def: id, x: p.x, y: p.y });
  }
  let obj = { type: 'kill' };
  const allies = [];
  if (objective === 'rescue' && captive) {
    const cands = [];
    for (let y = 1; y < 4; y++) for (let x = 1; x < 6; x++) {
      const t = tAt(tiles, x, y);
      if (freeTile(t) && !used.has(x + ',' + y) && t.e >= 1) cands.push({ x, y });
    }
    const p = cands.length ? pick(r, cands) : { x: 3, y: 2 };
    const t = tAt(tiles, p.x, p.y);
    t.t = 'floor'; t.obj = null; if (t.e < 1) t.e = 1;
    used.add(p.x + ',' + p.y);
    allies.push({ name: captive.name, x: p.x, y: p.y, hp: 5, rescue: captive.id });
    obj = { type: 'kill', rescue: captive.id, rescueName: captive.name };
  } else if (objective === 'survive') {
    obj = { type: 'survive', rounds: 6, waves: [{ round: 3, defs: buildGroup(r, district, 3, false) }, { round: 5, defs: buildGroup(r, district, 3, false) }] };
  } else if (objective === 'treasure') {
    let placed = 0;
    for (let tries = 0; tries < 30 && placed < 3; tries++) {
      const x = rint(r, 0, 6), y = rint(r, 0, 4);
      const t = tAt(tiles, x, y);
      if (freeTile(t) && !used.has(x + ',' + y) && !t.loot) { t.loot = { k: 'chest', v: 8 }; placed++; used.add(x + ',' + y); }
    }
    obj = { type: 'kill', treasure: true };
  }
  return { tiles, layoutName: lay.name, tideName, schedule, enemies, heroPos, obj, allies, kind };
}

function findHeroPos(r, tiles) {
  const cands = [];
  for (let y = 7; y >= 6; y--) for (let x = 1; x < 6; x++) {
    const t = tAt(tiles, x, y);
    if (freeTile(t)) cands.push({ x, y, w: y === 7 ? 1 : 0.5 + (x === 3 ? 1 : 0) });
  }
  return cands.length ? weighted(r, cands) : { x: 3, y: 7 };
}

export function makeBossEncounter(r, district) {
  const id = BOSSES[district];
  const lay = BOSS_LAYOUTS[id];
  const tiles = parseLayout(lay.rows, false);
  const heroPos = { x: 3, y: 7 };
  const enemies = [{ def: id, x: lay.boss.x, y: lay.boss.y }];
  if (id === 'gardener') { enemies.push({ def: 'polyp', x: 1, y: 3 }); enemies.push({ def: 'polyp', x: 5, y: 3 }); }
  if (id === 'carranca') { enemies.push({ def: 'crab', x: 1, y: 3 }); enemies.push({ def: 'crab', x: 5, y: 3 }); }
  if (id === 'sineiro') { enemies.push({ def: 'bellmimic', x: 1, y: 3 }); }
  if (id === 'maren') { enemies.push({ def: 'abyssal', x: 0, y: 3 }); }
  return { tiles, layoutName: lay.name, tideName: 'Maré do Guardião', schedule: lay.schedule.slice(), enemies, heroPos, obj: { type: 'boss', boss: id }, allies: [], kind: 'boss' };
}

// Combate da praia (tutorial)
export function makeTutorialEncounter() {
  const rows = ['1111111', '1b10011', '1100011', '1000001', '1000001', '1100011', '1111111', '2211122'];
  const tiles = parseLayout(rows);
  return {
    tiles, layoutName: 'Praia de Salgema', tideName: 'Baixa-mar', schedule: [0, 0, 1, 1, 1, 2, 2, 2, 1, 1, 0, 0],
    enemies: [{ def: 'crab', x: 2, y: 1 }, { def: 'crab', x: 5, y: 2 }], heroPos: { x: 3, y: 6 }, obj: { type: 'kill' }, allies: [], kind: 'normal',
  };
}
