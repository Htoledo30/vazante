import { REG } from '../game/js/data/index.js';
import { newMeta } from '../game/js/run/meta.js';
import { simulateRun } from './runsim.test.mjs';
import { makeRng } from '../game/js/core/rng.js';
const N = Number(process.argv[2] || 10);
for (const cls of Object.keys(REG.classes)) {
  const dist = [0,0,0,0,0]; const deathsAt = {};
  for (let i = 0; i < N; i++) {
    const meta = newMeta('Bot');
    const r = simulateRun(meta, { cls, weapon: REG.classes[cls].weapons[0], start: 1, seed: 777 + i * 17 }, makeRng(3 + i));
    dist[r.summary.district]++;
    const key = r.summary.outcome + '@D' + r.summary.district + (r.summary.outcome==='death' ? ' c' + r.run.stats.combats : '');
    deathsAt[key] = (deathsAt[key]||0)+1;
  }
  console.log(cls, 'alcance por distrito', dist.slice(1).join('/'), JSON.stringify(deathsAt));
}
