// Simula expedições inteiras (sem navegador) com o bot: exercita mapa, eventos, loja,
// descanso, recompensas, níveis, chefes, morte e finais. Pega exceções e mede o alcance.
import { REG } from '../game/js/data/index.js';
import { newMeta } from '../game/js/run/meta.js';
import {
  newRun, selectable, enterNode, finishCombat, takeReward, levelOptions, applyLevel, resolveEvent, continueEvent,
  buy, leaveShop, rest, startBossFight, descend, endRun,
} from '../game/js/run/run.js';
import { eventById, checkReq } from '../game/js/data/events.js';
import { playCombat } from './bot.mjs';
import { makeRng, rnd } from '../game/js/core/rng.js';

export function simulateRun(meta, opts, rng, log = false) {
  const run = newRun(meta, opts);
  let steps = 0;
  const trace = [];
  while (steps++ < 400) {
    const sc = run.screen;
    trace.push(sc);
    switch (sc) {
      case 'map': {
        const s = selectable(run);
        enterNode(run, meta, s[Math.floor(rnd(rng) * s.length)]);
        break;
      }
      case 'combat': {
        const out = playCombat(run.combat, 80, () => rnd(rng));
        if (out === 'player') { // empate por limite: considera derrota
          run.combat.phase = 'lose';
        }
        finishCombat(run, meta);
        break;
      }
      case 'reward': takeReward(run, meta, run.reward.choices.length ? 0 : null); break;
      case 'levelup': levelOptions(run, meta); applyLevel(run, meta, 0); break;
      case 'event': {
        const ev = eventById(run.event.id);
        if (run.event.result == null) {
          const ok = ev.choices.map((ch, i) => (checkReq(run, ch.req) === true ? i : -1)).filter((i) => i >= 0);
          resolveEvent(run, meta, ok[Math.floor(rnd(rng) * ok.length)], ev);
        } else continueEvent(run, meta);
        break;
      }
      case 'shop': {
        const i = run.shop.items.findIndex((it) => !it.sold && it.price <= run.pearls);
        if (i >= 0) buy(run, meta, i);
        leaveShop(run, meta);
        break;
      }
      case 'rest': rest(run, meta, 'heal'); break;
      case 'bossintro': startBossFight(run, meta); break;
      case 'extract': descend(run, meta); break;
      case 'dead': return { summary: endRun(run, meta, 'death'), run, trace };
      case 'ending': return { summary: endRun(run, meta, 'ending'), run, trace };
      default: throw new Error('tela desconhecida ' + sc);
    }
  }
  return { summary: endRun(run, meta, 'abandon'), run, trace, stuck: true };
}

if (process.argv[1] && process.argv[1].endsWith('runsim.test.mjs')) {
  const N = Number(process.argv[2] || 8);
  let errors = 0;
  const rows = [];
  for (const cls of Object.keys(REG.classes)) {
    let best = 0, sumD = 0, endings = 0, conchas = 0;
    for (let i = 0; i < N; i++) {
      const meta = newMeta('Bot');
      meta.hasConcha = i % 2 === 0;
      const rng = makeRng(99 + i * 13);
      try {
        const r = simulateRun(meta, { cls, weapon: REG.classes[cls].weapons[i % 3], start: 1 + (i % 4), seed: 5000 + i * 31 }, rng);
        best = Math.max(best, r.summary.district);
        sumD += r.summary.district;
        if (r.summary.outcome === 'ending') endings++;
        conchas += r.summary.conchas;
        if (r.stuck) console.log('PRESO', cls, i, r.trace.slice(-10));
      } catch (e) {
        errors++;
        console.error('ERRO', cls, i, e.stack);
      }
    }
    rows.push({ cls, 'distrito médio': (sumD / N).toFixed(2), melhor: best, finais: endings, conchas: Math.round(conchas / N) });
  }
  console.table(rows);
  process.exit(errors ? 1 : 0);
}
