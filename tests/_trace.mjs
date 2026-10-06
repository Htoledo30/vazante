import { newCampaign, setG } from '../game/js/core/state.js';
import * as CH from '../game/js/systems/character.js';
import * as CB from '../game/js/systems/combat/index.js';
import { smartAct } from './sim-balance-lib.mjs';
console.warn = () => {};
const enc = process.argv[2].split('+'); const LV = Number(process.argv[3] || 1);
const G = setG(newCampaign({ seed: Number(process.argv[4] || 3) }));
G.hero = CH.createHero({ name: 'T', bg: process.argv[5] || 'desertor' });
for (let l = 1; l < LV; l++) { G.hero.ichor = 99; const off = CH.ensureLevelOffer(G.hero); CH.levelUp(G.hero, ['vig', 'for', 'des'][l % 3], off.talents[0]); G.hero.corruption = 0; G.hero.mutationPending = 0; }
G.hero.hp = CH.derive(G.hero).hpMax;
CB.startCombat(G, { enemies: enc, region: process.argv[6] || 'r1', context: { source: 'expedition' } });
let g = 0;
while (!CB.isOver(G) && g++ < 60) {
  const a = smartAct(G);
  console.log(`-- T${G.combat.round} HP ${G.hero.hp} st ${CB.heroActor(G).stamina} :: ${a.action}/${a.part||''} | ${CB.foes(G).map(f=>f.name+'('+Math.round(f.hp)+')@'+f.dist+':'+CB.intentText(G,f,2)).join(' ; ')}`);
  const b = G.combat.log.length; CB.act(G, a); if (G.combat) for (const l of G.combat.log.slice(b)) console.log('   ', l.text);
}
