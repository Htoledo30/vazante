// Combate: um bot joga centenas de lutas contra todos os inimigos; sempre termina, sem exceção;
// salvar/restaurar no meio da luta funciona; técnicas e itens de combate executam.
import assert from 'node:assert/strict';
import { newCampaign, setG } from '../game/js/core/state.js';
import * as CH from '../game/js/systems/character.js';
import * as IT from '../game/js/systems/items.js';
import * as CB from '../game/js/systems/combat/index.js';
import * as flow from '../game/js/systems/flow.js';
import { ENEMIES } from '../game/js/data/enemies.js';
import { BACKGROUND_LIST } from '../game/js/data/backgrounds.js';
import { ITEMS } from '../game/js/data/items.js';

console.warn = () => {};
let fails = 0;
const t = (name, fn) => { try { fn(); console.log('ok -', name); } catch (e) { fails++; console.log('FALHOU -', name, '\n  ', e.stack?.split('\n').slice(0, 3).join('\n   ')); } };
let ends = 0, deaths = 0;
flow.setHook('combatEnd:expedition', () => { ends++; });
flow.setHook('heroDeath', () => { deaths++; });

function botTurn(G, i, mode = 'smart') {
  const acts = CB.heroActions(G).filter((a) => !a.disabled);
  const h = CB.heroActor(G);
  let a;
  if (mode === 'random') a = acts[i % acts.length];
  else a = (h.stamina < 3 ? acts.find((x) => x.id === 'esperar') : null)
    || acts.find((x) => x.kind === 'tech' && x.target === 'part') || acts.find((x) => x.kind === 'attack') || acts.find((x) => x.id === 'avancar') || acts.find((x) => x.id === 'guarda') || acts[0];
  let target, part;
  if (a.target === 'part' || a.target === 'enemy') {
    const ts = CB.targetsFor(G, a.id).filter((x) => x.valid);
    if (!ts.length) { a = acts.find((x) => x.id === 'guarda') || acts.find((x) => x.target === 'self' || x.target === 'none'); }
    else { target = ts[0].uid; part = ts[0].parts?.[i % Math.max(1, ts[0].parts.length)]?.id; }
  }
  return CB.act(G, { action: a.id, target, part });
}

t('todo inimigo implementado luta e morre (ou mata) sem travar', () => {
  const ids = Object.keys(ENEMIES);
  for (const [k, id] of ids.entries()) {
    for (let r = 0; r < 4; r++) {
      const G = setG(newCampaign({ seed: 77 + k * 13 + r }));
      G.hero = CH.createHero({ name: 'Bot', bg: BACKGROUND_LIST[(k + r) % BACKGROUND_LIST.length].id });
      G.hero.level = 4; G.hero.attrs.for += 2; G.hero.attrs.des += 2;
      G.hero.hp = CH.derive(G.hero).hpMax;
      CB.startCombat(G, { enemies: [id], region: 'r1', context: { source: 'expedition' } });
      let g = 0;
      while (!CB.isOver(G) && g++ < 300) { const res = botTurn(G, g, r % 2 ? 'random' : 'smart'); assert.ok(res.ok || res.why, 'ação falhou sem motivo'); }
      assert.ok(CB.isOver(G), `luta contra ${id} não terminou`);
      CB.finishCombat(G);
      assert.equal(G.combat, null);
    }
  }
});

t('salvar e restaurar no meio da luta', () => {
  const G = setG(newCampaign({ seed: 5 }));
  G.hero = CH.createHero({ name: 'Bot', bg: 'desertor' });
  CB.startCombat(G, { enemies: ['saqueador', 'cao_chaga'], region: 'r1', context: { source: 'expedition' } });
  botTurn(G, 1);
  const copy = JSON.parse(JSON.stringify(G));
  setG(copy);
  let g = 0;
  while (!CB.isOver(copy) && g++ < 300) botTurn(copy, g);
  assert.ok(CB.isOver(copy));
});

t('itens de combate e trocas de arma executam', () => {
  const G = setG(newCampaign({ seed: 11 }));
  G.hero = CH.createHero({ name: 'Bot', bg: 'cacador_bruxas' });
  for (const id of ['bomba', 'bomba_cal', 'faca_arremesso', 'agua_benta', 'oleo', 'veneno', 'bandagem', 'tonico', 'papoula', 'fumo_bruxa', 'machado_guerra']) IT.addItem(G.hero, IT.makeItem(id, { n: 2 }));
  G.hero.hp = 999; G.hero.attrs.vig = 10; CB.startCombat(G, { enemies: ['ceifeiro', 'horda_oco', 'desertor'], region: 'r1', context: { source: 'expedition' } });
  const used = new Set();
  let g = 0;
  while (!CB.isOver(G) && g++ < 200) {
    const it = CB.heroActions(G).find((a) => !a.disabled && (a.kind === 'item' || a.kind === 'swap') && !used.has(a.itemId || a.id));
    if (it) {
      used.add(it.itemId || it.id);
      const tg = it.target === 'enemy' ? CB.targetsFor(G, it.id).find((x) => x.valid)?.uid : undefined;
      const r = CB.act(G, { action: it.id, target: tg });
      assert.ok(r.ok, `${it.id}: ${r.why}`);
    } else botTurn(G, g);
  }
  assert.ok(used.size >= 6, `usou ${used.size}`);
});

t(`resumo: ${ends} vitórias/fugas, ${deaths} mortes`, () => assert.ok(ends + deaths > 0));

if (fails) { console.log(`\n${fails} falha(s)`); process.exit(1); }
