// Tempo global, Chaga e o "virar do dia" (Área D).
// advanceTime é chamado pela cidade (D), pela expedição (C) e pela op de efeito {op:'time'} (A).
import { clamp, timeOf, isNightHour } from '../core/util.js';
import { campaignEnded } from './flow.js';
import * as W from './wounds.js';
import * as CH from './character.js';
import * as CP from '../data/companions.js';
import { checkSiegeTriggers, siegeDayTick } from './siege.js';
import { rollHunters, questDayTick } from './factions.js';
import { expireContracts } from './contracts.js';
import { syncCampaign, expireTempTraits } from './campaign.js';
import { FRAGMENTS } from '../data/story.js';

export const SIEGE_LEVELS = [30, 60, 90];

// ------------------------------------------------------------------ leitura
export const day = (G) => timeOf(G.time).day;
export const hour = (G) => timeOf(G.time).hour;
export const isNight = (G) => isNightHour(hour(G));
/** Horas até a próxima ocorrência da hora h (0 = agora mesmo se já for h). */
export function hoursUntil(G, h) { return ((h - hour(G)) % 24 + 24) % 24; }

// ------------------------------------------------------------------ utilidades da área D
const asLines = (x) => (Array.isArray(x) ? x : x?.lines || []).map((l) => (typeof l === 'string' ? { text: l, kind: '' } : l));

/** Entrada no diário da campanha. */
export function journal(G, text) {
  if (!G?.campaign) return;
  const j = G.campaign.journal || (G.campaign.journal = []);
  const d = day(G);
  if (j.length && j[j.length - 1].text === text && j[j.length - 1].day === d) return;
  j.push({ day: d, text });
  if (j.length > 300) j.splice(0, j.length - 300);
}

/** Registro curto (G.log). */
export function logLine(G, text, kind = '') {
  if (!G) return;
  G.log = G.log || [];
  G.log.push({ t: G.time, text, kind });
  if (G.log.length > 80) G.log.splice(0, G.log.length - 80);
}

export function counter(G, k, n = 1) {
  const c = G.campaign.counters || (G.campaign.counters = {});
  c[k] = (c[k] || 0) + n;
  return c[k];
}

/** Pavor no herói (usa A; sem A, aplica direto). */
export function heroDread(G, n, why) {
  if (!G.hero || !n) return [];
  if (CH.addDread) return asLines(CH.addDread(G, n, why));
  G.hero.dread = clamp((G.hero.dread || 0) + n, 0, 100);
  return [{ text: `${n > 0 ? '+' : ''}${n} Pavor${why ? ` (${why})` : ''}`, kind: n > 0 ? 'dread' : 'good' }];
}

/** Corrupção no herói (usa A; sem A, aplica direto). Retorna { lines, transformed, mutationPending }. */
export function heroCorruption(G, n, why) {
  if (!G.hero || !n) return { lines: [] };
  if (CH.addCorruption) {
    const r = CH.addCorruption(G, n, why) || {};
    return { lines: asLines(r), transformed: !!r.transformed, mutationPending: !!r.mutationPending };
  }
  G.hero.corruption = clamp((G.hero.corruption || 0) + n, 0, 100);
  return { lines: [{ text: `${n > 0 ? '+' : ''}${n} Corrupção${why ? ` (${why})` : ''}`, kind: n > 0 ? 'corr' : 'good' }] };
}

// ------------------------------------------------------------------ Chaga
/** Taxa diária da Chaga com a explicação de cada modificador. */
export function chagaRate(G) {
  const parts = [{ label: 'Base', v: 1 }];
  const act = G.campaign?.act || 1;
  if (act >= 3) parts.push({ label: 'A carne do deus se espalha (Ato III+)', v: 0.25 });
  if ((G.city?.morale ?? 50) < 25) parts.push({ label: 'Desespero na cidade', v: 0.25 });
  if ((G.factions?.bebedores ?? 0) >= 60) parts.push({ label: 'Bebedores alimentam a podridão', v: 0.25 });
  if ((G.factions?.sutura ?? 0) >= 60) parts.push({ label: 'Vigílias da Sutura', v: -0.25 });
  if (G.campaign?.flags?.coroa_arsenal) parts.push({ label: 'Patrulhas incendiárias da Coroa', v: -0.25 });
  const lost = G.city?.lostDistricts?.length || 0;
  if (lost >= 2) parts.push({ label: 'Distritos perdidos', v: 0.25 });
  const total = Math.max(0.5, parts.reduce((s, p) => s + p.v, 0));
  return { total, parts };
}

/** Altera a Chaga (n pode ser negativo). Dispara cercos e a queda. */
export function addChaga(G, n, why = '') {
  if (!G || !n) return [];
  const before = G.chaga;
  G.chaga = clamp(Math.round((G.chaga + n) * 100) / 100, 0, 100);
  const delta = Math.round((G.chaga - before) * 100) / 100;
  if (!delta) return [];
  const log = G.chagaLog || (G.chagaLog = []);
  const d = day(G);
  const last = log[log.length - 1];
  if (last && last.day === d && last.why === why) last.delta = Math.round((last.delta + delta) * 100) / 100;
  else log.push({ day: d, delta, why });
  if (log.length > 120) log.splice(0, log.length - 120);
  const lines = [];
  if (Math.abs(delta) >= 1 || why) {
    lines.push({ text: `Chaga ${delta > 0 ? '+' : ''}${delta}${why ? ` — ${why}` : ''}`, kind: delta > 0 ? 'rot' : 'good' });
  }
  lines.push(...checkSiegeTriggers(G));
  if (G.chaga >= 100 && !G.campaign.ended) {
    lines.push({ text: 'A Chaga alcançou a muralha.', kind: 'bad' });
    campaignEnded('fall', { day: d });
  }
  return lines;
}

// ------------------------------------------------------------------ o tempo passa
/**
 * Avança o relógio. where: 'city' | 'field'. Retorna linhas [{text, kind}].
 * A cada dia novo: Chaga, feridas, contadores, contratos, cercos, caçadores, evento do amanhecer.
 */
export function advanceTime(G, hours, opts = {}) {
  const lines = [];
  if (!G || !(hours > 0)) return lines;
  const where = opts.where || (G.expedition ? 'field' : 'city');
  const startDay = day(G);
  G.time = Math.round((G.time + hours) * 100) / 100;
  if (G.hero && !G.hero.dead && W.tickWounds) {
    try { lines.push(...asLines(W.tickWounds(G, hours))); } catch (e) { console.error(e); }
  }
  const endDay = day(G);
  for (let d = startDay + 1; d <= endDay; d++) {
    lines.push(...newDay(G, d, where));
    if (G.campaign.ended) break;
  }
  return lines;
}

/** Fragmentos do deus na mochila (não equipados). */
function carriedFragments(G) {
  const h = G.hero;
  if (!h) return 0;
  const ids = new Set(Object.values(FRAGMENTS).map((f) => f.item));
  return new Set((h.inv || []).filter((i) => i && ids.has(i.id)).map((i) => i.id)).size;
}

/** Salário diário do sequaz (COMPANIONS[id].wage). Sem pagamento, a lealdade cai; a 0, ele vai embora. */
export function payWage(G) {
  const h = G.hero;
  const c = h?.companion;
  if (!c) return [];
  const def = CP.COMPANIONS?.[c.id];
  const wage = def?.wage || 0;
  if (!wage) return [];
  if ((h.coin || 0) >= wage) { h.coin -= wage; return []; }
  c.loyalty = (c.loyalty ?? 60) - 20;
  if (c.loyalty <= 0) {
    h.companion = null;
    journal(G, `${c.name} foi embora sem pagamento.`);
    return [{ text: `${c.name} cansou de trabalhar de graça e foi embora.`, kind: 'bad' }];
  }
  return [{ text: `Sem moedas para pagar ${c.name}. A lealdade cai.`, kind: 'warn' }];
}

function newDay(G, d, where) {
  const lines = [];
  const h = G.hero;
  // Chaga
  const rate = chagaRate(G).total;
  const c = G.campaign.counters || (G.campaign.counters = {});
  c.chagaFrac = (c.chagaFrac || 0) + rate;
  const whole = Math.floor(c.chagaFrac + 1e-9);
  c.chagaFrac = Math.round((c.chagaFrac - whole) * 100) / 100;
  if (whole > 0) lines.push(...addChaga(G, whole, 'A Chaga avança'));
  if (G.campaign.ended) return lines;

  if (h && !h.dead) {
    h.stats = h.stats || {};
    h.stats.daysAlive = (h.stats.daysAlive || 0) + 1;
    h.flags = h.flags || {};
    // bebida: o corpo esquece devagar (o vício/fissura é de A: traço 'alcoolatra')
    if (h.flags.drinks) h.flags.drinks = Math.max(0, h.flags.drinks - 1);
    // fragmentos na MOCHILA apodrecem quem os leva (equipados: corrPerDay de A)
    const frag = carriedFragments(G);
    if (frag > 0) {
      const r = heroCorruption(G, frag, frag > 1 ? 'Fragmentos do deus' : 'Fragmento do deus');
      lines.push({ text: 'O fragmento pulsa contra a sua pele a noite toda.', kind: 'corr' }, ...r.lines);
    }
    // sequaz: salário diário
    lines.push(...payWage(G));
    lines.push(...expireTempTraits(G, d));
  }
  // moral tende ao meio
  if (G.city) {
    if (G.city.morale > 50) G.city.morale -= 1;
    else if (G.city.morale < 50) G.city.morale += 1;
  }
  // dívida com a Guilda
  const loan = G.city?.loan;
  if (loan && loan.state === 'open' && d > loan.dueDay) {
    loan.state = 'defaulted';
    G.factions.guilda = clamp((G.factions.guilda || 0) - 30, -100, 100);
    G.campaign.flags.guilda_cobranca = true;
    lines.push({ text: 'Você não pagou a Guilda. Agora ela vai cobrar em carne.', kind: 'bad' });
    journal(G, 'Dei calote na Guilda.');
  }
  lines.push(...expireContracts(G, d));
  lines.push(...questDayTick(G, d));
  lines.push(...siegeDayTick(G, d, where));
  if (G.campaign.ended) return lines;
  if (where === 'city') {
    lines.push(...rollHunters(G, d));
    if (G.city) G.city.dawnPending = d;
  }
  lines.push(...syncCampaign(G));
  return lines;
}
