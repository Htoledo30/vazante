// Eventos: formato válido (ids de itens/inimigos/traços/sequazes conhecidos) e um bot que joga centenas de eventos.
import assert from 'node:assert/strict';
import { newCampaign } from '../game/js/core/state.js';
import * as CH from '../game/js/systems/character.js';
import * as EV from '../game/js/systems/events.js';
import { ITEMS } from '../game/js/data/items.js';
import { ENEMIES, CANONICAL_ENEMIES } from '../game/js/data/enemies.js';
import { TRAITS } from '../game/js/data/traits.js';
import { COMPANIONS } from '../game/js/data/companions.js';
import { BACKGROUND_LIST } from '../game/js/data/backgrounds.js';
import * as flow from '../game/js/systems/flow.js';

console.warn = () => {};
let fails = 0;
const t = (name, fn) => { try { fn(); console.log('ok -', name); } catch (e) { fails++; console.log('FALHOU -', name, '\n  ', e.message); } };

t('todos os eventos têm formato válido', () => {
  const errs = EV.validateEvents(EV.EVENTS, { items: ITEMS, enemyIds: [...Object.keys(ENEMIES), ...Object.keys(CANONICAL_ENEMIES)], traits: TRAITS, companions: COMPANIONS });
  assert.equal(errs.length, 0, errs.slice(0, 12).join('\n   '));
});

t(`há eventos suficientes (${EV.EVENTS.length})`, () => {
  assert.ok(EV.EVENTS.length >= 75);
  for (const pool of ['field', 'camp', 'city', 'ruin', 'shrine', 'night']) assert.ok(EV.EVENTS.some((e) => e.pool === pool), `pool ${pool}`);
});

t('bot joga 400 eventos sem exceção', () => {
  flow.setHook('heroDeath', () => {});
  flow.setHook('eventEnd:expedition', () => {});
  flow.setHook('eventEnd:daily', () => {});
  flow.setHook('combatEnd:expedition', () => {});
  EV.installEventHooks(() => {});
  let played = 0;
  for (let i = 0; i < 400; i++) {
    const G = newCampaign({ seed: 900 + i });
    G.hero = CH.createHero({ name: 'Bot', bg: BACKGROUND_LIST[i % BACKGROUND_LIST.length].id });
    G.hero.coin = 80; G.hero.ichor = 4;
    const pool = ['field', 'camp', 'city', 'ruin', 'shrine', 'night'][i % 6];
    const region = ['r1', 'r1', 'r2', 'r3', 'r4', 'r5'][i % 6];
    const id = EV.pickEvent(G, { pool, region });
    if (!id) continue;
    EV.startEvent(G, id, { source: pool === 'city' ? 'daily' : 'expedition', region });
    const v = EV.eventView(G);
    const opts = v.options.filter((o) => !o.disabled);
    assert.ok(opts.length, `evento ${id} sem opção habilitada`);
    EV.choose(G, opts[i % opts.length].idx);
    EV.finishEvent(G);
    played++;
  }
  assert.ok(played > 300, `jogou ${played}`);
});

if (fails) { console.log(`\n${fails} falha(s)`); process.exit(1); }
