// ICOR — Acampamento (Área C). Descansar no Ermo: cura, Pavor, comida, fogo, vigia — e o risco de acordar com dentes.
// Lógica pura. A tela 'camp' (ui/screens/expedition.js) usa campPlan/campAt.
import { R } from '../core/rng.js';
import { clamp } from '../core/util.js';
import { save } from '../core/save.js';
import { sfx } from '../core/bus.js';
import { REGIONS } from '../data/regions.js';
import * as EX from './expedition.js';
import * as CH from './character.js';
import * as EV from './events.js';

const sum = (arr) => arr.reduce((s, x) => s + x, 0);

/** Opções disponíveis e o que cada uma custa. */
export function campOptions(G) {
  const exp = G.expedition;
  const hasFuel = EX.countOf(G, 'sebo') > 0 || EX.countOf(G, 'tocha') > 0;
  const rations = EX.countOf(G, 'racao') + EX.countOf(G, 'carne_seca');
  return {
    fire: { ok: hasFuel, why: 'Precisa de sebo ou uma tocha para a fogueira.' },
    cook: { ok: hasFuel && rations > 0, why: !rations ? 'Sem ração.' : 'Precisa de fogo.' },
    pray: { ok: true },
    safeSite: EX.nodeType(G, exp.region, exp.node) === 'camp',
    repeat: exp.campCount?.[exp.node] || 0,
  };
}

/** Prévia de um plano: { ambush, heal, dread, warnings } */
export function campPlan(G, plan = {}) {
  const exp = G.expedition;
  const hero = G.hero;
  const D = EX.heroD(G);
  const hours = plan.hours || 8;
  const o = campOptions(G);
  const fire = !!plan.fire && o.fire.ok;
  const ambush = EX.ambushChance(G, { camp: true, fire, watch: !!plan.watch, safeSite: o.safeSite, hours });
  const restMult = plan.watch ? 0.5 : 1;
  const healPerH = (D.hpMax || 50) * 0.02 * (1 + (D.mods?.camp_heal || 0) / 100) * (fire ? 1.35 : 1) * restMult;
  const heal = Math.round(healPerH * hours * (EX.hungerLevel(G) >= 2 ? 0.5 : 1));
  const dread = -Math.round(hours * (fire ? 2 : 1) * restMult + (plan.pray ? 8 : 0) + (plan.cook && fire ? 5 : 0));
  const warnings = [];
  if (!fire && EX.isDarkAt(G, exp.region, G.time)) warnings.push('Sem fogo, no escuro: o Pavor cresce em vez de baixar.');
  if (o.repeat > 0) warnings.push(`Você já acampou aqui ${o.repeat}x: o cheiro atrai.`);
  if (EX.hungerLevel(G) >= 2) warnings.push('Faminto: o corpo cura metade.');
  if ((hero.wounds || []).some((w) => w.bleeding && !w.treated)) warnings.push('Uma ferida sangra: enfaixe antes de dormir.');
  if (REGIONS[exp.region].env?.flesh) warnings.push('Dentro do deus, cada hora corrompe.');
  return { hours, ambush, heal, dread, fire, warnings, safeSite: o.safeSite };
}

/**
 * Acampa. plan: { hours: 4|8, fire, watch, cook, pray }.
 * Retorna { ok, lines, nav, died, ambushed }.
 */
export function campAt(G, plan = {}) {
  const exp = G.expedition;
  if (!exp) return { ok: false, why: 'Fora do Ermo.', lines: [] };
  if (G.combat) return { ok: false, why: 'Em combate.', lines: [] };
  if (G.event) return { ok: false, why: 'Há algo acontecendo.', lines: [] };
  if (EX.heroDead(G)) return { ok: false, why: 'Morto.', lines: [] };
  const o = campOptions(G);
  const p = campPlan(G, plan);
  const lines = [];
  const hero = G.hero;
  exp.camping = true;
  exp.campCount = exp.campCount || {};
  exp.campCount[exp.node] = (exp.campCount[exp.node] || 0) + 1;

  // fogo
  let fire = false;
  if (plan.fire && o.fire.ok) {
    if (!EX.takeItem(G, 'sebo', 1)) EX.takeItem(G, 'tocha', 1);
    fire = true;
    lines.push({ text: 'Você acende uma fogueira baixa. O calor entra nos ossos.', kind: 'info' });
    sfx('fire');
  }
  // comida
  if (plan.cook && fire && o.cook.ok) {
    if (!EX.takeItem(G, 'carne_seca', 1)) EX.takeItem(G, 'racao', 1);
    const herbs = EX.takeItem(G, 'ervas', 1);
    lines.push(...EX.eat(G, { cooked: true }));
    CH.heal(hero, herbs ? 8 : 4);
    lines.push({ text: herbs ? 'Ensopado com ervas amargas. O melhor que se come no Ermo.' : 'Comida quente.', kind: 'good' });
  }
  if (plan.pray) {
    const r = EX.roll(G, { attr: 'von', diff: 20 });
    lines.push(r.ok ? { text: `Você reza para ninguém em especial. Ajuda. (VON ${r.chance}%)`, kind: 'good' } : { text: `As palavras não vêm. (VON ${r.chance}%)`, kind: '' });
    if (r.ok) CH.addDread(G, -8, 'oração');
  }

  // emboscada: em que hora?
  const ambushed = R.chance(p.ambush);
  const restHours = ambushed ? R.int(1, Math.max(1, p.hours - 1)) : p.hours;
  const res = EX.passHours(G, restHours, { mode: 'camp', fire });
  lines.push(...(res.lines || []));
  if (res.died) { exp.camping = false; return { ok: true, lines, died: true }; }
  // descanso proporcional
  const frac = restHours / p.hours;
  const healed = CH.heal(hero, Math.round(p.heal * frac));
  if (healed > 0) lines.push({ text: `Descanso: +${healed} Vida.`, kind: 'good' });
  const dark = !fire && EX.isDarkAt(G, exp.region, G.time);
  const dv = dark ? Math.round(restHours * 0.5) : Math.round(p.dread * frac);
  if (dv) lines.push(...(CH.addDread(G, dv, dark ? 'noite sem fogo' : 'descanso').lines || []));
  exp.lastCamp = { node: exp.node, at: G.time, hours: restHours, interrupted: ambushed, fire };
  exp.alert = Math.max(0, (exp.alert || 0) - 10);
  for (const l of lines) EX.addLog(G, l.text, l.kind);

  if (ambushed) {
    const enc = EX.pickEncounter(G, exp.region, { ambush: true, dark: !fire });
    const sleeping = !plan.watch;
    EX.addLog(G, sleeping ? 'Você acorda com algo em cima de você.' : 'A vigia salva sua garganta: eles vêm, mas você os vê.', 'bad');
    sfx('scream');
    const r = EX.beginCombat(G, { enemies: enc.enemies, kind: 'camp', nodeId: exp.node, ambush: sleeping ? 'enemy' : null, text: enc.text });
    return { ok: true, lines, ambushed: true, ...r };
  }
  // evento do acampamento
  if (R.chance(30) && EV.pickEvent) {
    try {
      const id = EV.pickEvent(G, { pool: 'camp', region: exp.region, tags: REGIONS[exp.region].events });
      if (id) { EV.startEvent(G, id, { source: 'camp', region: exp.region, nodeId: exp.node }); save(); return { ok: true, lines, nav: { screen: 'event' } }; }
    } catch (e) { console.error('[camp] evento', e); }
  }
  save();
  return { ok: true, lines, nav: { screen: 'camp' } };
}

/** Sai do acampamento. */
export function breakCamp(G) {
  if (G.expedition) G.expedition.camping = false;
  save();
}
