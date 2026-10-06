// Balanceamento por região: herói do nível e equipamento esperados contra cada encontro da região + chefe.
// Uso: node tests/sim-region.mjs r2 [n=25] [nivel]
import { newCampaign, setG } from '../game/js/core/state.js';
import * as CH from '../game/js/systems/character.js';
import * as IT from '../game/js/systems/items.js';
import * as LO from '../game/js/systems/loot.js';
import * as CB from '../game/js/systems/combat/index.js';
import * as flow from '../game/js/systems/flow.js';
import { ENCOUNTERS, BOSS_ENCOUNTERS } from '../game/js/data/encounters.js';
import { BACKGROUND_LIST } from '../game/js/data/backgrounds.js';
import { smartAct } from './sim-balance-lib.mjs';
console.warn = () => {};
const reg = process.argv[2] || 'r1';
const N = Number(process.argv[3] || 25);
const tier = Number(reg.slice(1));
const LV = Number(process.argv[4] || [0, 1, 4, 7, 9, 11][tier]);
let won = 0, died = 0;
flow.setHook('combatEnd:expedition', () => { won++; });
flow.setHook('heroDeath', () => { died++; });
function mkHero(i) {
  const G = setG(newCampaign({ seed: 7000 + i * 17 }));
  G.hero = CH.createHero({ name: 'B', bg: BACKGROUND_LIST[i % BACKGROUND_LIST.length].id });
  for (let l = 1; l < LV; l++) { G.hero.ichor = 99; const off = CH.ensureLevelOffer(G.hero); CH.levelUp(G.hero, ['vig', 'for', 'des', 'vig'][l % 4], off.talents[0]); G.hero.corruption = 0; G.hero.mutationPending = 0; }
  if (tier > 1) {
    const cls = IT.itemDef(G.hero.equip.main)?.cls;
    const w = LO.randomItem(G, { type: 'weapon', cls, tier: Math.max(1, tier - 1), q: 2 }) || LO.randomItem(G, { type: 'weapon', tier: tier - 1, q: 2 });
    if (w && IT.itemDef(w).hands === 1) { IT.addItem(G.hero, w); IT.equip(G.hero, w.uid); }
    for (const slot of ['cabeca', 'tronco', 'bracos', 'pernas']) { const a = LO.randomItem(G, { type: 'armor', slot, tier: Math.max(1, tier - 1), q: 1 }); if (a) { IT.addItem(G.hero, a); IT.equip(G.hero, a.uid); } }
  }
  G.hero.hp = CH.derive(G.hero).hpMax;
  return G;
}
const rows = [...ENCOUNTERS[reg].map((e) => [e.id, e.enemies]), ['CHEFE', BOSS_ENCOUNTERS[reg].enemies]];
const D0 = CH.derive(mkHero(0).hero);
console.log(`${reg} nível ${LV} — Vida ${D0.hpMax}, arma ${D0.weapon.dmg.join('-')}, armadura tronco ${D0.armor.tronco.corte}/${D0.armor.tronco.perf}/${D0.armor.tronco.impacto}`);
for (const [id, enemies] of rows) {
  won = 0; died = 0; let hp = 0, turns = 0;
  for (let i = 0; i < N; i++) {
    const G = mkHero(i);
    CB.startCombat(G, { enemies, region: reg, context: { source: 'expedition' } });
    let g = 0;
    while (!CB.isOver(G) && g++ < 300) { CB.act(G, smartAct(G)); turns++; }
    if (CB.isOver(G) === 'win') hp += G.hero.hp / CH.derive(G.hero).hpMax;
    CB.finishCombat(G);
  }
  console.log(id.padEnd(26), 'vence', String(Math.round(100 * won / N)).padStart(3) + '%', ' vida', String(Math.round(100 * hp / Math.max(1, won))).padStart(3) + '%', ' turnos', Math.round(turns / N));
}
