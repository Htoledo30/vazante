// Simulação: muitos combates com o bot, por classe e distrito, para pegar exceções e medir dificuldade.
import { REG } from '../game/js/data/index.js';
import { createCombat } from '../game/js/combat/flow.js';
import { makeEncounter, makeBossEncounter } from '../game/js/data/maps.js';
import { makeRng } from '../game/js/core/rng.js';
import { makeHeroUnit } from '../game/js/run/hero.js';
import { playCombat } from './bot.mjs';

export function testHero(cls, level = 1) {
  const C = REG.classes[cls];
  const pool = C.pool.filter((id) => REG.skills[id].kind === 'active');
  const skills = C.start.map((id) => ({ id, lv: 1 }));
  for (let i = 0; skills.length < Math.min(4, 1 + Math.floor(level / 2)) && i < pool.length; i++) if (!skills.some((s) => s.id === pool[i])) skills.push({ id: pool[i], lv: 1 });
  const attrs = { ...C.attrs };
  attrs.vig += Math.floor(level / 2);
  const hero = { name: 'Teste', cls, weapon: C.weapons[0], attrs, skills, relics: [], suit: 'rags', items: ['tonic', 'tonic'], hp: 99, flags: {} };
  return hero;
}

export function runSim({ n = 20, quiet = false } = {}) {
  const res = {};
  let errors = 0;
  for (const cls of Object.keys(REG.classes)) {
    for (const district of [1, 2, 3, 4]) {
      let wins = 0, hpLeft = 0, rounds = 0;
      for (let i = 0; i < n; i++) {
        const r = makeRng(1000 + i * 7 + district * 131);
        const enc = i % 10 === 9 ? makeBossEncounter(r, district) : makeEncounter(r, { district, depth: i % 5, kind: i % 7 === 3 ? 'elite' : 'normal', objective: i % 6 === 2 ? 'survive' : i % 6 === 4 ? 'rescue' : null, captive: { id: 'x', name: 'Fulano' } });
        const hero = testHero(cls, district * 3);
        const hu = makeHeroUnit(hero);
        hu.hp = hu.maxHp;
        try {
          const c = createCombat({ ...enc, hero: hu, seed: 77 + i, district, obj: { ...enc.obj, concha: true, versos: true } });
          const out = playCombat(c, 40);
          if (out === 'win') { wins++; hpLeft += c.units.find((u) => u.side === 'player').hp; }
          rounds += c.round;
        } catch (e) {
          errors++;
          console.error(`ERRO ${cls} D${district} #${i}:`, e.stack);
          if (errors > 5) throw e;
        }
      }
      res[`${cls} D${district}`] = { win: `${wins}/${n}`, avgHp: wins ? (hpLeft / wins).toFixed(1) : '-', avgRounds: (rounds / n).toFixed(1) };
    }
  }
  if (!quiet) console.table(res);
  return { res, errors };
}

if (process.argv[1] && process.argv[1].endsWith('sim.test.mjs')) {
  const { errors } = runSim({ n: Number(process.argv[2] || 20) });
  process.exit(errors ? 1 : 0);
}
