// Expedição: mapas determinísticos e conexos; um bot faz várias campanhas curtas pelos sistemas
// (viajar, lutar, eventos, saque, acampar, voltar, morrer, herdeiro) sem exceção nem trava.
import assert from 'node:assert/strict';
import { newCampaign, setG, getG } from '../game/js/core/state.js';
import * as CH from '../game/js/systems/character.js';
import * as IT from '../game/js/systems/items.js';
import * as EX from '../game/js/systems/expedition.js';
import * as CAMP from '../game/js/systems/camp.js';
import * as CB from '../game/js/systems/combat/index.js';
import * as EV from '../game/js/systems/events.js';
import * as LN from '../game/js/systems/lineage.js';
import * as WS from '../game/js/systems/wounds.js';
const CAREFUL = true;
import * as CP from '../game/js/systems/campaign.js';
import * as flow from '../game/js/systems/flow.js';
import { genRegionMap, validateMap, reachableFrom } from '../game/js/systems/mapgen.js';
import { REGION_ORDER } from '../game/js/data/regions.js';
import { smartAct } from './sim-balance-lib.mjs';

console.warn = () => {};
{ let s = 12345; Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
let fails = 0;
const t = (name, fn) => { try { fn(); console.log('ok -', name); } catch (e) { fails++; console.log('FALHOU -', name, '\n  ', e.stack?.split('\n').slice(0, 4).join('\n   ')); } };

t('mapas determinísticos, válidos e conexos', () => {
  for (const r of REGION_ORDER) for (let s = 1; s < 40; s++) {
    const a = genRegionMap(s * 7919, r);
    const b = genRegionMap(s * 7919, r);
    assert.deepEqual(a, b);
    assert.deepEqual(validateMap(a), [], `${r}/${s}`);
    assert.equal(reachableFrom(a, a.entry).size ?? reachableFrom(a, a.entry).length, Object.keys(a.nodes).length);
  }
});

// ---- bot de campanha pelos sistemas ----
let nav = 'map';
const go = (s) => { nav = s; };
EX.registerHooks({ go });
EV.installEventHooks(go);
const CAUSES = {}; const DREG = {}; const LV = [];
flow.setHook('heroDeath', (G, cause, info) => { const rr = info?.region || 'cidade'; DREG[rr] = (DREG[rr] || 0) + 1; LV.push(G.hero?.level || 1); CAUSES[String(cause).replace(/Morto por .*/, 'combate')] = (CAUSES[String(cause).replace(/Morto por .*/, 'combate')] || 0) + 1; LN.onHeroDeath(G, cause, info || {}); G.combat = null; G.event = null; G.pendingLoot = null; nav = 'heirs'; });
flow.setHook('campaignEnd', (G, type) => { CP.endCampaign(G, type); nav = 'ending'; });
flow.setHook('heroCreated', (G) => { CP.onHeroCreated(G); nav = 'city'; });
for (const s of ['daily', 'city', 'camp']) if (s !== 'camp') flow.setHook(`eventEnd:${s}`, () => { nav = 'city'; });

const FST = { n: 0, lost: 0, amb: 0, ambLost: 0, night: 0, nightLost: 0, hpLost: 0, encs: {} };
function fight(G) {
  const c0 = G.combat; const amb = c0.log.some((l) => /EMBOSCADA/.test(l.text)); const night = c0.env.night;
  const hp0 = G.hero.hp / CH.derive(G.hero).hpMax; const names = c0.actors.filter((a) => a.side === 'enemy').map((a) => a.def).sort().join('+');
  let g = 0;
  while (G.combat && !CB.isOver(G) && g++ < 300) CB.act(G, smartAct(G));
  const lost = CB.isOver(G) === 'lose';
  FST.n++; if (amb) FST.amb++; if (night) FST.night++;
  if (lost) { FST.lost++; if (amb) FST.ambLost++; if (night) FST.nightLost++; FST.hpLost += hp0; FST.encs[names] = (FST.encs[names] || 0) + 1; }
  if (G.combat) CB.finishCombat(G);
}

function step(G) {
  if (G.campaign.ended) return 'ended';
  if (!G.hero || G.hero.dead) {
    if (!G.lineage.heirs?.length) return 'ended';
    LN.chooseHeir(G, 0); CP.onHeroCreated(G); return 'heir';
  }
  if (G.combat) { fight(G); return 'combat'; }
  if (G.event && !(G.event.stage === 'loot' && G.pendingLoot)) {
    if (G.event.stage === 'loot') { G.event = null; return 'event'; }
    if (G.event.stage === 'choose') { const v = EV.eventView(G); const o = v.options.find((x) => !x.disabled); EV.choose(G, o.idx); }
    else EV.finishEvent(G);
    return 'event';
  }
  if (G.pendingLoot) {
    for (const it of G.pendingLoot.items || []) IT.addItem(G.hero, it);
    G.hero.coin += G.pendingLoot.coin || 0; G.hero.ichor += G.pendingLoot.ichor || 0;
    G.pendingLoot.items = []; G.pendingLoot.coin = 0; G.pendingLoot.ichor = 0;
    const pl = G.pendingLoot; flow.lootDone(); if (G.pendingLoot === pl) G.pendingLoot = null;
    return 'loot';
  }
  if (!G.expedition) {
    // cidade: compra o básico e parte
    for (const id of ['tocha', 'racao', 'bandagem', 'aguardente']) while (IT.countItem(G.hero, id) < 3) IT.addItem(G.hero, IT.makeItem(id, { n: 1 }));
    G.hero.hp = CH.derive(G.hero).hpMax;
    while (EX.loadInfo(G).ratio > 1 && G.hero.inv.length) {
      const heavy = G.hero.inv.filter((i) => !['tocha', 'racao', 'bandagem'].includes(i.id)).sort((a, b) => IT.weightOf(b) - IT.weightOf(a))[0];
      if (!heavy) break;
      IT.removeInst(G.hero, heavy.uid);
    }
    const opts = REGION_ORDER.filter((r) => EX.regionUnlocked(G, r));
    const want = REGION_ORDER[Math.min(opts.length - 1, Math.floor(((G.hero.level || 1) - 1) / 3))];
    const r = EX.startExpedition(G, want);
    assert.ok(r.ok, r.why);
    return 'start';
  }
  const exp = G.expedition;
  const feats = EX.nodeFeatures(G, exp.node);
  if (feats.includes('stalk')) { EX.stalkAttack(G); return 'stalk'; }
  if (feats.includes('carcass') && exp.carcassDone?.[exp.node] == null) { EX.carcassApproach(G); return 'carcass'; }
  if (exp.carcassDone?.[exp.node] != null) { const rr = EX.carcassRite(G, 'burn'); if (rr.ok === false) EX.carcassRite(G, 'bury'); return 'rite'; }
  if (feats.includes('ruin') && !exp.content[exp.node]?.searched) { EX.ruinAct(G, 'search'); return 'ruin'; }
  if (feats.includes('vein') && (exp.content[exp.node]?.left || 0) > 0) { EX.veinHarvest(G, 'careful'); return 'vein'; }
  if (feats.includes('nest')) { EX.nestAssault(G, {}); return 'nest'; }
  if (feats.includes('boss') && G.hero.level >= 3) { EX.bossFight(G); return 'boss'; }
  // jogador cuidadoso: enfaixa o que sangra, come, bebe para o Pavor
  for (const w of G.hero.wounds || []) {
    if (w.bleeding && !w.treated && IT.countItem(G.hero, 'bandagem') > 0) WS.fieldTreat(G, w.uid, 'bandagem');
  }
  if ((G.hero.dread || 0) >= 60) { const a = G.hero.inv.find((i) => i.id === 'aguardente'); if (a) IT.useItem(G, a.uid); }
  const hpFrac = G.hero.hp / CH.derive(G.hero).hpMax;
  if (hpFrac < 0.45 && exp.campCount?.[exp.node] == null) { const cr = CAMP.campAt(G, { hours: 8, fire: true, watch: false, cook: true }); if (cr.ok === false) throw new Error('camp: ' + cr.why); CAMP.breakCamp(G); return 'camp'; }
  if (hpFrac < (CAREFUL ? 0.5 : 0.35) || exp.hoursOut > 70) { const r = EX.returnToCity(G); if (r.ok) return 'return'; }
  // peso: larga o mais pesado da mochila
  while (EX.loadInfo(G).blocked && G.hero.inv.length) {
    const heavy = G.hero.inv.slice().sort((a, b) => IT.weightOf(b) - IT.weightOf(a))[0];
    IT.removeInst(G.hero, heavy.uid);
  }
  const moves = EX.availableMoves(G).filter((m) => !m.disabled);
  if (!moves.length) {
    const r = EX.returnToCity(G);
    if (!r.ok) throw new Error(`sem saída: ${EX.canMove(G).why} / ${r.why} / ${JSON.stringify(EX.availableMoves(G).map((m) => m.why))}`);
    return 'return';
  }
  const fresh = moves.filter((m) => !m.visited);
  const m = (fresh.length ? fresh : moves)[Math.floor(Math.random() * (fresh.length || moves.length))];
  EX.moveTo(G, m.id);
  return 'move';
}

t('bot joga campanhas pelos sistemas sem trava', () => {
  let totalSteps = 0, deaths = 0, bosses = 0, exps = 0;
  for (let c = 0; c < 6; c++) {
    const G = setG(newCampaign({ seed: 4242 + c }));
    G.hero = CH.createHero({ name: 'Bot', bg: ['desertor', 'acougueiro', 'gladiador', 'cacador_bruxas', 'flagelante', 'cirurgia'][c] });
    CH.initHeroInWorld(G); CP.onHeroCreated(G);
    let last = '';
    let same = 0;
    for (let i = 0; i < 1500; i++) {
      const g = getG();
      if (g.hero?.ichor >= CH.levelUpCost(g.hero).ichor && !g.combat && !g.event) {
        const off = CH.ensureLevelOffer(g.hero);
        CH.levelUp(g.hero, 'vig', off.talents[0]);
        if ((g.hero.mutationPending || 0) > 0) { const mo = CH.ensureMutationOffer(g.hero); if (mo?.length) CH.applyMutation(g.hero, mo[0]); else g.hero.mutationPending = 0; }
      }
      if ((g.hero?.mutationPending || 0) > 0) { const mo = CH.ensureMutationOffer(g.hero); if (mo?.length) CH.applyMutation(g.hero, mo[0]); else g.hero.mutationPending = 0; }
      const r = step(g);
      if (r === 'start') exps++;
      if (r === 'heir') deaths++;
      if (r === 'ended') break;
      const sig = JSON.stringify([r, g.time, g.expedition?.node, g.hero?.hp, !!g.combat, !!g.event]);
      if (sig === last) same++; else same = 0;
      last = sig;
      assert.ok(same < 6, `travou em ${r} (campanha ${c}, passo ${i})`);
      totalSteps++;
    }
    bosses += Object.keys(getG().campaign.bosses || {}).length;
  }
  console.log('   lutas', FST.n, 'derrotas', FST.lost, 'emboscadas', FST.amb, '(perdeu', FST.ambLost + ')', 'noite', FST.night, '(perdeu', FST.nightLost + ')', 'vida inicial média nas derrotas', (FST.hpLost / Math.max(1, FST.lost)).toFixed(2));
  console.log('   piores:', JSON.stringify(Object.entries(FST.encs).sort((a, b) => b[1] - a[1]).slice(0, 8)));
  console.log('   causas:', JSON.stringify(CAUSES), 'regiões:', JSON.stringify(DREG), 'nível médio na morte:', (LV.reduce((a, b) => a + b, 0) / Math.max(1, LV.length)).toFixed(1));
  console.log(`   passos ${totalSteps}, expedições ${exps}, mortes ${deaths}, chefes ${bosses}`);
});

if (fails) { console.log(`\n${fails} falha(s)`); process.exit(1); }
