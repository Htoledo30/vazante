// Simulação de balanceamento (não é teste): um bot "jogador médio" luta contra encontros de r1.
// Uso: node tests/sim-balance.mjs [n=40] [nivel=1]
import { newCampaign, setG } from '../game/js/core/state.js';
import * as CH from '../game/js/systems/character.js';
import * as IT from '../game/js/systems/items.js';
import * as CB from '../game/js/systems/combat/index.js';
import * as flow from '../game/js/systems/flow.js';
import { BACKGROUND_LIST } from '../game/js/data/backgrounds.js';
import { TALENT_LIST } from '../game/js/data/talents.js';
console.warn = () => {};
const N = Number(process.argv[2] || 40);
const LV = Number(process.argv[3] || 1);
const stats = {};
let cur;
flow.setHook('combatEnd:expedition', () => { stats[cur].w++; });
flow.setHook('heroDeath', () => { stats[cur].d++; });

import { smartAct } from './sim-balance-lib.mjs';

const encs = [['saqueador'], ['saqueador', 'saqueador'], ['cao_chaga', 'cao_chaga'], ['cao_chaga', 'cao_chaga', 'cao_chaga'], ['lavrador_oco', 'lavrador_oco'], ['besteiro', 'saqueador'], ['corvos'], ['ceifeiro'], ['desertor', 'saqueador'], ['zelote', 'zelote'], ['bebedor'], ['carniceiro_rival'], ['horda_oco'], ['mae_colheita']];
for (const enc of encs) {
  cur = enc.join('+'); stats[cur] = { w: 0, d: 0, hp: 0, turns: 0 };
  for (let i = 0; i < N; i++) {
    const G = setG(newCampaign({ seed: 9000 + i * 31 }));
    G.hero = CH.createHero({ name: 'B', bg: BACKGROUND_LIST[i % BACKGROUND_LIST.length].id });
    for (let l = 1; l < LV; l++) { G.hero.ichor = 99; const off = CH.ensureLevelOffer(G.hero); CH.levelUp(G.hero, ['vig', 'for', 'des'][l % 3], off.talents[0]); G.hero.corruption = 0; G.hero.mutationPending = 0; }
    G.hero.hp = CH.derive(G.hero).hpMax;
    CB.startCombat(G, { enemies: enc, region: 'r1', context: { source: 'expedition' } });
    let g = 0;
    while (!CB.isOver(G) && g++ < 300) { CB.act(G, smartAct(G)); stats[cur].turns++; }
    if (CB.isOver(G) === 'win') stats[cur].hp += G.hero.hp / CH.derive(G.hero).hpMax;
    CB.finishCombat(G);
  }
}
for (const [k, v] of Object.entries(stats)) console.log(k.padEnd(28), 'vence', String(Math.round(100 * v.w / N)).padStart(3) + '%', ' vida restante', String(Math.round(100 * v.hp / Math.max(1, v.w))).padStart(3) + '%', ' turnos', Math.round(v.turns / N));
