// Estrutura da expedição: mapa por distrito, nós, combates, recompensas, níveis, loja, descanso.
import { REG } from '../combat/registry.js';
import { makeRng, rnd, rint, pick, shuffle, weighted, sample, newSeed } from '../core/rng.js';
import { createCombat } from '../combat/flow.js';
import { addStatus, getHero } from '../combat/engine.js';
import { makeEncounter, makeBossEncounter, makeTutorialEncounter, BOSSES, TIDE_NAMES } from '../data/maps.js';
import { makeHeroUnit, writeBackHero, xpForLevel, heroStats } from './hero.js';
import {
  stats, maxHp, healRun, healPct, addPearls, addItem, addRelic, equipSuit, rollRelic, rollRelics, rollItem, rollSuit,
  addXp, pendingLevels, upgradableSkills, activeCount, hasSkill, findMemory,
} from './ops.js';
import {
  metaBonus, startingAttrs, startingItems, itemSlotsFor, knowledgeMap, recordKills, villagersFor, classUnlocked,
} from './meta.js';
import { heatMods, CONTRACTS } from '../data/hub.js';
import { VILLAGERS, VERSOS } from '../data/story.js';
import { pickEvent } from '../data/events.js';

export const DISTRICTS = {
  1: { name: 'Porto Afogado', short: 'Porto', icon: '⚓', desc: 'Cais partidos, navios virados e o cheiro de ferrugem.' },
  2: { name: 'Jardins de Coral', short: 'Jardins', icon: '🪸', desc: 'Antigos jardins da nobreza, tomados por coral vivo.' },
  3: { name: 'Bairro dos Sinos', short: 'Sinos', icon: '🔔', desc: 'Torres, praças e mil sinos que ainda tocam sozinhos.' },
  4: { name: 'Catedral do Abismo', short: 'Catedral', icon: '⛪', desc: 'O coração afogado de Aurélia. Alguém canta lá dentro.' },
};

export const NODE_INFO = {
  combat: { name: 'Combate', icon: '⚔', desc: 'Criaturas da cidade. Pérolas, experiência e um achado.' },
  elite: { name: 'Elite', icon: '☠', desc: 'Um inimigo poderoso e sua escolta. Recompensa: relíquia.' },
  event: { name: 'Mistério', icon: '❓', desc: 'Algo inesperado. Escolhas e consequências.' },
  shop: { name: 'Mercador', icon: '⚖', desc: 'Tobias, o mercador afogado. Pérolas por suprimentos.' },
  rest: { name: 'Bolsão de Ar', icon: '🫧', desc: 'Um lugar seco para respirar: curar, treinar ou vasculhar.' },
  treasure: { name: 'Tesouro', icon: '💎', desc: 'Um baú afogado. Relíquia garantida.' },
  rescue: { name: 'Resgate', icon: '🆘', desc: 'Um morador de Salgema preso. Liberte-o durante o combate.' },
  boss: { name: 'Guardião', icon: '👁', desc: 'O guardião do distrito.' },
};

const START_LEVEL = { 1: 1, 2: 4, 3: 7, 4: 10 };

// ---------- criação ----------
export function newRun(meta, { cls, weapon, start = 1, heat = 0, contract = null, seed = newSeed() }) {
  const C = REG.classes[cls];
  const mb = metaBonus(meta, heat);
  const hero = {
    name: meta.name, cls, weapon, lvl: 1, xp: 0, hp: 1,
    attrs: startingAttrs(meta, cls), skills: C.start.map((id) => ({ id, lv: 1 })),
    relics: [], suit: meta.rescued.includes('cida') ? 'kelpcape' : 'rags',
    items: startingItems(meta), slots: itemSlotsFor(meta), flags: {},
  };
  hero.items = hero.items.slice(0, hero.slots);
  const run = {
    seed, rng: makeRng(seed), district: start, startDistrict: start, heat, contract,
    hero, pearls: 0, metaBonus: mb, mods: heatMods(heat),
    map: null, cur: null, screen: 'map', combat: null, node: null,
    reward: null, levelQueue: 0, event: null, shop: null, flags: {}, seenEvents: [],
    stats: { kills: 0, combats: 0, elites: 0, bosses: 0, rescues: 0, flawless: 0, fireKills: 0, sinkKills: 0, pitKills: 0, collideKills: 0, memories: 0, district: start, turns: 0, damageTaken: 0 },
    log: [], startedAt: Date.now(),
  };
  hero.hp = maxHp(run);
  if (start > 1) {
    const L = START_LEVEL[start];
    hero.xp = xpForLevel(L);
    run.pearls = 25 * (start - 1);
    for (let i = 0; i < start - 1; i++) { const r = rollRelic(run, 1); if (r) addRelic(run, r); }
    hero.hp = maxHp(run);
  }
  genMap(run, meta);
  run.levelQueue = pendingLevels(run);
  run.screen = run.levelQueue > 0 ? 'levelup' : 'map';
  run.afterLevel = 'map';
  return run;
}

// ---------- mapa ----------
export function genMap(run, meta) {
  const r = run.rng;
  const d = run.district;
  const nRows = d === 4 ? 4 : 6; // linhas antes do chefe (inclui a de preparação)
  const rows = [];
  let id = 0;
  const villagers = villagersFor(meta, d);
  let rescuePlaced = 0;
  const maxRescue = Math.min(villagers.length, 1 + (rnd(r) < 0.35 ? 1 : 0));
  const moreElites = run.mods.moreElites;
  for (let ri = 0; ri < nRows; ri++) {
    let types;
    if (ri === 0) types = ['combat', 'combat'];
    else if (ri === nRows - 1) types = ['rest', 'shop'];
    else {
      const n = rnd(r) < 0.55 ? 3 : 2;
      types = [];
      for (let k = 0; k < n; k++) {
        const opts = [
          { t: 'combat', w: 5 },
          { t: 'event', w: 4 },
          { t: 'elite', w: ri >= 2 ? (moreElites ? 3.5 : 2) : 0 },
          { t: 'treasure', w: ri >= 2 ? 1 : 0.3 },
          { t: 'shop', w: ri >= 2 ? 1.2 : 0 },
          { t: 'rest', w: ri >= 3 ? 1 : 0 },
        ];
        types.push(weighted(r, opts).t);
      }
      if (ri >= 1 && ri <= nRows - 2 && rescuePlaced < maxRescue && (ri === nRows - 2 || rnd(r) < 0.45)) {
        types[rint(r, 0, types.length - 1)] = 'rescue';
        rescuePlaced++;
      }
      if (ri === 2 && d < 4 && !types.includes('elite')) types[rint(r, 0, types.length - 1)] = 'elite';
    }
    const row = types.map((t, k) => ({ id: id++, row: ri, x: types.length === 1 ? 1 : (k * 2) / (types.length - 1), type: t, links: [], done: false }));
    rows.push(row);
  }
  rows.push([{ id: id++, row: nRows, x: 1, type: 'boss', links: [], done: false }]);
  // ligações
  for (let ri = 0; ri < rows.length - 1; ri++) {
    const a = rows[ri], b = rows[ri + 1];
    for (const n of a) {
      const sorted = b.slice().sort((p, q) => Math.abs(p.x - n.x) - Math.abs(q.x - n.x));
      n.links.push(sorted[0].id);
      if (sorted[1] && Math.abs(sorted[1].x - n.x) <= 1.01 && rnd(r) < 0.5) n.links.push(sorted[1].id);
    }
    for (const m of b) {
      if (!a.some((n) => n.links.includes(m.id))) {
        const near = a.slice().sort((p, q) => Math.abs(p.x - m.x) - Math.abs(q.x - m.x))[0];
        near.links.push(m.id);
      }
    }
  }
  // atribui moradores aos nós de resgate
  let vi = 0;
  for (const row of rows) for (const n of row) if (n.type === 'rescue') {
    const v = villagers[vi++];
    if (v) n.villager = v.id; else n.type = 'combat';
  }
  run.map = { rows, district: d };
  run.cur = null;
  run.reveal = !!(run.flags.revealMap || meta.upgrades.light_signal || stats(run).mods.revealMap);
}

export function allNodes(run) { return run.map.rows.flat(); }
export function nodeById(run, id) { return allNodes(run).find((n) => n.id === id); }

export function selectable(run) {
  if (run.cur == null) return run.map.rows[0].map((n) => n.id);
  const cur = nodeById(run, run.cur);
  return cur.links.slice();
}

// Nós visíveis: 2 linhas à frente da atual (ou todas se revelado).
export function nodeVisible(run, n) {
  if (run.reveal || run.flags.revealMap) return true;
  const curRow = run.cur == null ? -1 : nodeById(run, run.cur).row;
  return n.row <= curRow + 2 || n.type === 'boss';
}

// ---------- entrar em um nó ----------
export function enterNode(run, meta, nodeId) {
  if (!selectable(run).includes(nodeId)) return false;
  const n = nodeById(run, nodeId);
  run.cur = nodeId;
  run.node = { type: n.type, id: nodeId };
  const depth = n.row;
  switch (n.type) {
    case 'combat': {
      const roll = rnd(run.rng);
      const objective = roll < 0.14 ? 'treasure' : roll < 0.24 ? 'survive' : null;
      startCombat(run, meta, makeEncounter(run.rng, { district: run.district, kind: 'normal', depth, heat: run.heat, objective }));
      break;
    }
    case 'elite':
      startCombat(run, meta, makeEncounter(run.rng, { district: run.district, kind: 'elite', depth, heat: run.heat }));
      break;
    case 'rescue': {
      const v = VILLAGERS[n.villager];
      startCombat(run, meta, makeEncounter(run.rng, { district: run.district, kind: 'normal', depth, heat: run.heat, objective: 'rescue', captive: { id: n.villager, name: v.name } }));
      break;
    }
    case 'boss':
      run.screen = 'bossintro';
      run.bossId = BOSSES[run.district];
      break;
    case 'event':
      run.event = { id: pickEvent(run, meta), result: null };
      run.screen = 'event';
      break;
    case 'shop':
      run.shop = makeShop(run, meta);
      run.screen = 'shop';
      break;
    case 'rest':
      run.screen = 'rest';
      break;
    case 'treasure': {
      const p = 12 + rint(run.rng, 0, 10);
      addPearls(run, p);
      run.reward = { kind: 'treasure', pearls: p, xp: 0, choices: rollRelics(run, 2, 1).map((id) => ({ type: 'relic', id })), text: 'Um baú afogado, ainda lacrado. Lá dentro, entre pérolas, duas relíquias. Só dá para levar uma.' };
      run.screen = 'reward';
      break;
    }
    default: break;
  }
  return true;
}

export function startBossFight(run, meta) {
  startCombat(run, meta, makeBossEncounter(run.rng, run.district), { boss: true });
}

export function startCombat(run, meta, enc, opt = {}) {
  const hu = makeHeroUnit(run.hero, run.metaBonus);
  if (run.hero.flags.reviveUsed) delete hu.mods.revive;
  const st = heroStats(run.hero, run.metaBonus);
  const mods = {
    enemyHp: run.mods.enemyHp, bossHp: run.mods.bossHp,
    enemyDmg: (run.mods.enemyDmg || 0) + (run.flags.cursed ? 1 : 0),
  };
  let schedule = enc.schedule.slice();
  const shift = (hu.mods.tideShift || 0) + (run.mods.tideUp || 0) + (run.flags.highTide ? 1 : 0);
  if (shift) schedule = schedule.map((v) => Math.max(0, Math.min(4, v + shift)));
  const delay = hu.mods.tideDelay || 0;
  for (let i = 0; i < delay; i++) schedule.unshift(schedule[0]);
  const obj = { ...enc.obj };
  if (enc.kind !== 'boss' && obj.type === 'kill') {
    // reforços: pressão de tempo
    const early = run.mods.earlyWaves ? 1 : 0;
    const pool = { 1: ['crab', 'drowned', 'gull', 'barnacle'], 2: ['hermit', 'puffer', 'urchin', 'crab'], 3: ['shade', 'bellmimic', 'crossbow', 'automaton'], 4: ['abyssal', 'echo', 'priest', 'squid'] }[run.district];
    obj.waves = [
      { round: 6 - early, defs: [pick(run.rng, pool)] },
      { round: 9 - early, defs: [pick(run.rng, pool), pick(run.rng, pool)] },
      { round: 12 - early, defs: [pick(run.rng, pool), pick(run.rng, pool)] },
    ];
    obj.wavePool = pool;
  }
  if (enc.kind === 'boss' && run.district === 4) {
    obj.concha = !!meta.hasConcha;
    obj.versos = meta.bosses.filter((b) => ['carranca', 'gardener', 'sineiro'].includes(b)).length >= 3;
  }
  const c = createCombat({
    ...enc, hero: hu, obj, seed: rint(run.rng, 1, 1e9), district: run.district, mods,
    knowledge: knowledgeMap(meta), forecast: st.forecast, title: enc.layoutName,
    intro: `${enc.layoutName} — ${enc.tideName || TIDE_NAMES[enc.tideName] || ''}`,
  });
  c.fireBonus = hu.mods.fireLong || 0;
  c.tideName = enc.tideName;
  if (hu.mods.startShield) { const h = getHero(c); addStatus(c, h, 'shield', hu.mods.startShield); c.ev = []; }
  run.combat = c;
  run.screen = 'combat';
  run.flags.cursed = 0;
  run.flags.highTide = 0;
  run.stats.combats++;
}

// Combate da praia (primeira vez)
export function tutorialCombat(run, meta) {
  const enc = makeTutorialEncounter();
  startCombat(run, meta, enc);
  run.combat.tutorial = { step: 0 };
  run.combat.obj.waves = [];
  run.tutorial = true;
}

// ---------- fim de combate ----------
export function finishCombat(run, meta) {
  const c = run.combat;
  const h = c.units.find((u) => u.side === 'player');
  writeBackHero(run.hero, h, c);
  recordKills(meta, c.kills);
  run.stats.kills += c.kills.length;
  run.stats.turns += c.round;
  run.stats.damageTaken += c.stats.taken;
  for (const k of c.kills) {
    if (k.how === 'fire' || k.how === 'burn') run.stats.fireKills++;
    if (k.how === 'sink') run.stats.sinkKills++;
    if (k.how === 'pit') run.stats.pitKills++;
    if (k.how === 'collide') run.stats.collideKills++;
  }
  if (c.phase === 'lose') { run.combat = null; run.screen = 'dead'; return; }
  const kind = c.kind;
  const mods = stats(run).mods;
  let pearls = c.reward.pearls + (kind === 'elite' ? 15 : kind === 'boss' ? 30 : 6);
  if (c.round <= 5 && kind !== 'boss') pearls += 5;
  pearls = Math.round(pearls * (1 + (mods.pearlBonus || 0) / 100));
  const xpGain = addXp(run, c.reward.xp + (kind === 'elite' ? 6 : kind === 'boss' ? 10 : 3));
  addPearls(run, pearls);
  if (c.stats.taken === 0) run.stats.flawless++;
  if (kind === 'elite') run.stats.elites++;
  const notes = [];
  if (c.obj.rescue) {
    if (c.obj.rescued) {
      if (!meta.rescued.includes(c.obj.rescue)) meta.rescued.push(c.obj.rescue);
      run.stats.rescues++;
      const v = VILLAGERS[c.obj.rescue];
      notes.push(`🆘 ${v.name} ${v.title} foi resgatado e volta para Salgema! ${v.perk}`);
    } else notes.push(`Você não conseguiu libertar ${c.obj.rescueName}. Talvez numa próxima descida.`);
  }
  for (let i = 0; i < (c.reward.memories || 0); i++) { const m = findMemory(run, meta); if (m) notes.push(`✦ Memória de Aurélia: "${m.title}"`); }
  if (c.reward.chests) notes.push(`💰 Baús abertos: ${c.reward.chests}.`);
  let choices = [];
  const extra = meta.rescued.includes('lia') ? 1 : 0;
  if (kind === 'boss') {
    run.stats.bosses++;
    const bid = BOSSES[run.district];
    const first = !meta.bosses.includes(bid);
    if (first) meta.bosses.push(bid);
    const conchas = { 1: 30, 2: 45, 3: 60, 4: 0 }[run.district];
    meta.conchas += conchas; meta.totalConchas += conchas;
    notes.push(`🐚 +${conchas} Conchas para a vila (guardadas mesmo se você cair).`);
    const vi = ['carranca', 'gardener', 'sineiro'].indexOf(bid);
    if (vi >= 0 && first) notes.push(`📜 ${VERSOS[vi].title}: ${VERSOS[vi].text}`);
    choices = rollRelics(run, 3 + extra, 2).map((id) => ({ type: 'relic', id }));
  } else if (kind === 'elite' || run.nodeBonusRelic) {
    choices = rollRelics(run, 3 + extra, run.nodeBonusRelic || 1).map((id) => ({ type: 'relic', id }));
  } else {
    const n = 3 + extra;
    const used = new Set();
    for (let i = 0; i < n; i++) {
      const roll = rnd(run.rng);
      let ch;
      if (roll < 0.22) { const id = rollRelic(run, 1); if (id && !used.has(id)) ch = { type: 'relic', id }; }
      else if (roll < 0.34) { const id = rollSuit(run); if (!used.has(id)) ch = { type: 'suit', id }; }
      if (!ch) { let id = rollItem(run); let g = 0; while (used.has(id) && g++ < 10) id = rollItem(run); ch = { type: 'item', id }; }
      used.add(ch.id);
      choices.push(ch);
    }
  }
  if (run.bonusRelicId && !run.hero.relics.includes(run.bonusRelicId)) choices.unshift({ type: 'relic', id: run.bonusRelicId });
  if (run.bonusPearls) { addPearls(run, run.bonusPearls); pearls += run.bonusPearls; }
  run.bonusRelicId = null; run.bonusPearls = 0; run.nodeBonusRelic = 0;
  run.reward = { kind, pearls, xp: xpGain, choices, notes, rounds: c.round, taken: c.stats.taken, winMsg: c.winMsg, ending: c.obj.ending };
  const n = nodeById(run, run.cur);
  if (n) n.done = true;
  run.combat = null;
  run.screen = 'reward';
  if (kind === 'boss' && run.district === 4) {
    run.reward.choices = [];
    run.screen = 'ending';
    run.ending = c.obj.ending || 'silencio';
  }
}

export function takeReward(run, meta, idx) {
  const rw = run.reward;
  if (!rw) return;
  if (idx != null && idx >= 0) {
    const ch = rw.choices[idx];
    if (ch.type === 'relic') addRelic(run, ch.id);
    else if (ch.type === 'item') { if (!addItem(run, ch.id)) { addPearls(run, 8); } }
    else if (ch.type === 'suit') equipSuit(run, ch.id);
  } else if (rw.choices.length) {
    addPearls(run, 8);
  }
  run.reward = null;
  afterNode(run, meta, rw.kind === 'boss');
}

function afterNode(run, meta, boss = false) {
  if (run.cur != null) { const n = nodeById(run, run.cur); if (n) n.done = true; }
  run.levelQueue = pendingLevels(run);
  run.afterLevel = boss ? 'extract' : 'map';
  if (run.levelQueue > 0) run.screen = 'levelup';
  else run.screen = run.afterLevel;
  updateContract(run);
}

// ---------- subir de nível ----------
export function levelOptions(run, meta) {
  if (run.levelOpts) return run.levelOpts;
  const n = 3 + (meta.upgrades.arch_tomes ? 1 : 0);
  const C = REG.classes[run.hero.cls];
  const opts = [];
  const newSkills = C.pool.filter((id) => !hasSkill(run, id) && (REG.skills[id].kind === 'passive' || activeCount(run) < 4));
  const ups = upgradableSkills(run);
  const r = run.rng;
  const shuffledNew = shuffle(r, newSkills);
  const attrs = shuffle(r, ['vig', 'imp', 'fol', 'can']);
  if (shuffledNew[0]) opts.push({ type: 'skill', id: shuffledNew[0] });
  if (ups.length && (rnd(r) < 0.65 || !shuffledNew[1])) opts.push({ type: 'up', id: pick(r, ups).id });
  else if (shuffledNew[1]) opts.push({ type: 'skill', id: shuffledNew[1] });
  opts.push({ type: 'attr', k: attrs[0] });
  if (n > 3) {
    if (shuffledNew[1] && !opts.some((o) => o.id === shuffledNew[1])) opts.push({ type: 'skill', id: shuffledNew[1] });
    else opts.push({ type: 'attr', k: attrs[1] });
  }
  for (const k of attrs) { if (opts.length >= n) break; if (!opts.some((o) => o.k === k)) opts.push({ type: 'attr', k }); }
  run.levelOpts = opts.slice(0, n);
  return run.levelOpts;
}

export function applyLevel(run, meta, idx) {
  const o = levelOptions(run, meta)[idx];
  if (!o) return;
  const before = maxHp(run);
  if (o.type === 'skill') run.hero.skills.push({ id: o.id, lv: 1 });
  else if (o.type === 'up') { const s = run.hero.skills.find((k) => k.id === o.id); if (s) s.lv = 2; }
  else if (o.type === 'attr') run.hero.attrs[o.k]++;
  run.hero.lvl++;
  const after = maxHp(run);
  run.hero.hp = Math.min(after, run.hero.hp + Math.max(0, after - before) + 3);
  run.levelOpts = null;
  run.levelQueue = pendingLevels(run);
  if (run.levelQueue <= 0) run.screen = run.afterLevel || 'map';
}

// ---------- loja ----------
export function priceOf(run, meta, base) {
  let p = base;
  if (meta.rescued.includes('ana')) p *= 0.8;
  if (run.mods.priceUp) p *= 1 + run.mods.priceUp / 100;
  return Math.max(1, Math.round(p));
}

function makeShop(run, meta) {
  const extra = meta.rescued.includes('ana') ? 1 : 0;
  const items = [];
  const used = new Set();
  for (let i = 0; i < 3 + extra; i++) { let id = rollItem(run); let g = 0; while (used.has(id) && g++ < 10) id = rollItem(run); used.add(id); items.push({ type: 'item', id, price: priceOf(run, meta, REG.items[id].price) }); }
  for (const id of rollRelics(run, 2, 1)) items.push({ type: 'relic', id, price: priceOf(run, meta, 40 + 18 * (REG.relics[id].rarity || 1)) });
  const sid = rollSuit(run);
  items.push({ type: 'suit', id: sid, price: priceOf(run, meta, REG.suits[sid].price) });
  const services = [
    { type: 'heal', name: 'Remendo de Algas', desc: 'Cura 40% da vida.', price: priceOf(run, meta, 18) },
    { type: 'upgrade', name: 'Lição do Tobias', desc: 'Melhora uma técnica à sua escolha.', price: priceOf(run, meta, 45) },
  ];
  let debtMsg = null;
  if (run.flags.debt) {
    const pay = Math.min(run.pearls, run.flags.debt);
    run.pearls -= pay;
    run.flags.debt -= pay;
    debtMsg = `Tobias cobra o fiado: −${pay} pérolas.${run.flags.debt ? ` Ainda deve ${run.flags.debt}.` : ''}`;
  }
  return { items, services, debtMsg };
}

export function buy(run, meta, idx) {
  const s = run.shop;
  const it = s.items[idx];
  if (!it || it.sold) return 'Indisponível';
  if (run.pearls < it.price) return 'Pérolas insuficientes';
  if (it.type === 'item' && run.hero.items.length >= run.hero.slots) return 'Bolsa cheia';
  run.pearls -= it.price;
  if (it.type === 'item') addItem(run, it.id);
  else if (it.type === 'relic') addRelic(run, it.id);
  else if (it.type === 'suit') equipSuit(run, it.id);
  it.sold = true;
  return true;
}

export function buyService(run, meta, idx, skillId) {
  const sv = run.shop.services[idx];
  if (!sv || sv.sold) return 'Indisponível';
  if (run.pearls < sv.price) return 'Pérolas insuficientes';
  if (sv.type === 'heal') {
    if (run.hero.hp >= maxHp(run)) return 'Vida já está cheia';
    healPct(run, 40);
  } else if (sv.type === 'upgrade') {
    const s = run.hero.skills.find((k) => k.id === skillId && k.lv < 2 && REG.skills[k.id].up);
    if (!s) return 'Escolha uma técnica';
    s.lv = 2;
  }
  run.pearls -= sv.price;
  sv.sold = true;
  return true;
}

export function sellItem(run, idx) {
  const id = run.hero.items[idx];
  if (!id) return 0;
  run.hero.items.splice(idx, 1);
  const v = Math.max(3, Math.floor(REG.items[id].price / 3));
  run.pearls += v;
  return v;
}

export function leaveShop(run, meta) { run.shop = null; afterNode(run, meta); }

// ---------- descanso ----------
export function restHealAmount(run, meta) {
  const pct = 35 + (meta.upgrades.apoth_rest ? 15 : 0) - (run.mods.restPenalty || 0);
  return Math.ceil(maxHp(run) * pct / 100);
}

export function rest(run, meta, choice, skillId) {
  if (choice === 'heal') healRun(run, restHealAmount(run, meta));
  else if (choice === 'train') {
    const s = run.hero.skills.find((k) => k.id === skillId && k.lv < 2 && REG.skills[k.id].up);
    if (!s) return 'Escolha uma técnica';
    s.lv = 2;
  } else if (choice === 'search') {
    addPearls(run, 10);
    addItem(run, rollItem(run));
  }
  afterNode(run, meta);
  return true;
}

// ---------- eventos ----------
export function resolveEvent(run, meta, choiceIdx, eventDef) {
  const ch = eventDef.choices[choiceIdx];
  const out = ch.do(run, { meta, rng: run.rng });
  run.event.result = out.text;
  run.event.fight = out.fight || null;
  if (out.bonusRelic) run.nodeBonusRelic = out.bonusRelic;
  if (out.bonusRelicId) run.bonusRelicId = out.bonusRelicId;
  if (out.bonusPearls) run.bonusPearls = out.bonusPearls;
  if (run.flags.revealMap) run.reveal = true;
  return out;
}

export function continueEvent(run, meta) {
  const fight = run.event && run.event.fight;
  run.event = null;
  if (fight) {
    const n = nodeById(run, run.cur);
    const depth = n ? n.row : 2;
    if (fight === 'gulls') {
      const enc = makeEncounter(run.rng, { district: run.district, kind: 'normal', depth, heat: run.heat });
      enc.enemies = enc.enemies.map((e) => ({ ...e, def: 'gull' }));
      enc.enemies.push({ ...enc.enemies[0], def: 'gull', x: (enc.enemies[0].x + 1) % 7 });
      startCombat(run, meta, enc);
    } else startCombat(run, meta, makeEncounter(run.rng, { district: run.district, kind: fight === 'elite' ? 'elite' : 'normal', depth, heat: run.heat }));
    return;
  }
  afterNode(run, meta);
}

// ---------- após o chefe ----------
export function descend(run, meta) {
  run.district++;
  run.stats.district = Math.max(run.stats.district, run.district);
  meta.bestDistrict = Math.max(meta.bestDistrict, run.district);
  healPct(run, 30);
  run.flags.revealMap = false;
  genMap(run, meta);
  run.screen = 'map';
  updateContract(run);
}

// ---------- contrato ----------
export function contractProgress(run) {
  if (!run.contract) return null;
  const C = CONTRACTS[run.contract];
  let v = 0;
  switch (C.track) {
    case 'district': v = run.stats.district; break;
    case 'pearlsHeld': v = run.pearls; break;
    default: v = run.stats[C.track] || 0;
  }
  return { v: Math.min(v, C.goal), goal: C.goal, done: v >= C.goal, C };
}
function updateContract(run) {
  const p = contractProgress(run);
  if (p && p.done && !run.contractDone && p.C.track !== 'pearlsHeld') run.contractDone = true;
}

// ---------- encerramento ----------
// outcome: 'extract' | 'death' | 'ending' | 'abandon'
export function endRun(run, meta, outcome) {
  const p = contractProgress(run);
  let contractReward = 0;
  if (p && (run.contractDone || p.done) && outcome !== 'abandon') contractReward = p.C.reward;
  const rate = outcome === 'death' || outcome === 'abandon' ? 0.5 : 1;
  let conchas = Math.floor(run.pearls * rate) + contractReward;
  if (run.heat > 0) conchas = Math.round(conchas * (1 + run.heat * 0.1));
  meta.conchas += conchas;
  meta.totalConchas += conchas;
  meta.runs++;
  if (outcome === 'death' || outcome === 'abandon') meta.deaths++;
  if (outcome === 'extract') meta.extracts++;
  meta.bestDistrict = Math.max(meta.bestDistrict, run.district);
  if (outcome === 'ending') {
    if (!meta.endings.includes(run.ending)) meta.endings.push(run.ending);
    meta.heatUnlocked = Math.max(meta.heatUnlocked, Math.min(10, run.heat + 1));
    meta.heatBest = Math.max(meta.heatBest, run.heat);
  }
  meta.lastClass = run.hero.cls;
  const summary = {
    outcome, conchas, contractReward, pearls: run.pearls, district: run.district, cls: run.hero.cls, lvl: run.hero.lvl,
    kills: run.stats.kills, combats: run.stats.combats, rescues: run.stats.rescues, bosses: run.stats.bosses,
    memories: run.stats.memories, ending: run.ending || null, heat: run.heat, date: Date.now(),
  };
  meta.lastRun = summary;
  return summary;
}

export { classUnlocked };
