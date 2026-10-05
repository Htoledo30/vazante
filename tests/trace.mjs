import { REG } from '../game/js/data/index.js';
import { createCombat } from '../game/js/combat/flow.js';
import { makeEncounter, makeBossEncounter } from '../game/js/data/maps.js';
import { makeRng } from '../game/js/core/rng.js';
import { makeHeroUnit } from '../game/js/run/hero.js';
import { botTurn } from './bot.mjs';
import { testHero } from './sim.test.mjs';
import { describeIntent } from '../game/js/combat/attacks.js';
const [cls='arpoadora', d='1', boss='0', seed='3'] = process.argv.slice(2);
const r = makeRng(Number(seed));
const enc = boss==='1' ? makeBossEncounter(r, Number(d)) : makeEncounter(r, { district: Number(d) });
const hu = makeHeroUnit(testHero(cls, 1)); hu.hp = hu.maxHp;
const c = createCombat({ ...enc, hero: hu, seed: 5, district: Number(d) });
function draw() {
  const rows = [];
  for (let y=0;y<c.h;y++){ let s=''; for(let x=0;x<c.w;x++){ const u=c.units.find(u=>u.hp>0&&u.x===x&&u.y===y); const t=c.tiles[y*7+x]; const dep=Math.max(0,c.tide-t.e);
    s += u ? (u.side==='player'?'@':u.name[0]) : t.t==='wall'?'#':t.t==='coral'?'c':t.t==='pit'?'o':t.obj?t.obj.k[0].toUpperCase(): dep>=2?'~':dep===1?'-':t.fire?'^':'.'; } rows.push(s); }
  return rows.join('\n');
}
for (let i=0;i<30 && c.phase==='player';i++){
  console.log(`--- Rodada ${c.round} maré ${c.tide} HP ${c.units[0].hp}/${c.units[0].maxHp} fol ${c.units[0].fol}`);
  console.log(draw());
  for (const u of c.units) if (u.side==='enemy'&&u.hp>0) console.log(`  ${u.name} (${u.x},${u.y}) hp${u.hp} :: ${describeIntent(c,u)}`);
  const L = c.log.length;
  botTurn(c);
  for (const l of c.log.slice(L)) console.log('   >', l.m);
  c.ev=[];
}
console.log('FIM', c.phase, c.round);
