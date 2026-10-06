// Facções: reputação (−100..100), efeitos cruzados, linhas de missão, caçadores (Área D).
import { clamp } from '../core/util.js';
import { R } from '../core/rng.js';
import * as IT from './items.js';
import { FACTIONS, FACTION_IDS, CROSS, REP_TIERS, QUESTLINES } from '../data/factions.js';
import { day, journal, counter } from './time.js';
import { applyD, nestsDestroyed, killsOf, fragmentsGivenTo, fragmentsEaten } from './campaign.js';

export { FACTIONS, FACTION_IDS };

// ------------------------------------------------------------------ reputação
export const rep = (G, f) => G.factions?.[f] ?? 0;

export function repTier(v) {
  let t = REP_TIERS[0];
  for (const x of REP_TIERS) if (v >= x.min) t = x;
  return t;
}

export const isHostile = (G, f) => rep(G, f) <= -50;

/**
 * Muda a reputação. cross=true aplica os efeitos cruzados (só quando n vem de uma ação direta).
 * Retorna linhas [{text, kind}].
 */
export function addRep(G, f, n, { cross = true } = {}) {
  if (!FACTIONS[f] || !n) return [];
  const lines = [];
  const before = rep(G, f);
  G.factions[f] = clamp(before + n, -100, 100);
  const d = G.factions[f] - before;
  if (d) lines.push({ text: `${FACTIONS[f].short} ${d > 0 ? '+' : ''}${d}`, kind: d > 0 ? 'good' : 'bad' });
  if (cross) {
    for (const [o, k] of Object.entries(CROSS[f] || {})) {
      const m = Math.trunc(n * k);
      if (m) lines.push(...addRep(G, o, m, { cross: false }));
    }
  }
  // limiares
  const tb = repTier(before).id, ta = repTier(G.factions[f]).id;
  if (tb !== ta) {
    if (G.factions[f] <= -50 && before > -50) {
      lines.push({ text: `${FACTIONS[f].name} agora te quer morto.`, kind: 'bad' });
      journal(G, `${FACTIONS[f].name} declarou a Casa inimiga.`);
    } else if (G.factions[f] >= 40 && before < 40) {
      lines.push({ text: `${FACTIONS[f].name} te considera aliado.`, kind: 'good' });
      journal(G, `${FACTIONS[f].name} passou a confiar na Casa.`);
    }
  }
  return lines;
}

/** Multiplicador de preço de COMPRA pela reputação (0.75..1.25). */
export const repBuyMult = (G, f) => (f ? 1 - rep(G, f) / 400 : 1);
/** Multiplicador de preço de VENDA pela reputação (0.75..1.25). */
export const repSellMult = (G, f) => (f ? 1 + rep(G, f) / 400 : 1);

// ------------------------------------------------------------------ missões de facção
function qs(G, f) {
  G.factionQuests = G.factionQuests || {};
  return G.factionQuests[f] || (G.factionQuests[f] = { step: 0, state: 'available', base: 0, startDay: 0 });
}

function reqMet(G, need = {}) {
  const why = [];
  if (need.rep != null && rep(G, need.f) < need.rep) why.push(`exige reputação ${need.rep}`);
  if (need.boss && !G.campaign.bosses?.[need.boss]) why.push('exige um chefe derrotado');
  return why;
}

/** Estado legível da linha de missão. */
export function questView(G, f) {
  const q = qs(G, f);
  const line = QUESTLINES[f];
  if (q.step >= line.length) return { f, step: q.step, total: line.length, state: 'done', def: null };
  const def = line[q.step];
  if (q.state === 'active') {
    return { f, step: q.step, total: line.length, state: 'active', def, progress: objectiveProgress(G, f) };
  }
  const why = reqMet(G, { ...(def.need || {}), f });
  if (rep(G, f) <= -50) why.unshift('hostis com você');
  return { f, step: q.step, total: line.length, state: why.length ? 'locked' : 'available', def, why: why.join(', ') };
}

function baseFor(G, obj) {
  switch (obj.type) {
    case 'kill': return killsOf(G, obj.enemies);
    case 'nest': return nestsDestroyed(G, obj.region);
    case 'siege': return G.campaign.counters?.siegesFought || 0;
    default: return 0;
  }
}

export function startQuest(G, f) {
  const v = questView(G, f);
  if (v.state !== 'available') return { ok: false, reason: v.why || 'Indisponível', lines: [] };
  const q = qs(G, f);
  q.state = 'active';
  q.base = baseFor(G, v.def.obj);
  q.startDay = day(G);
  if (v.def.flagOnStart) G.campaign.flags[v.def.flagOnStart] = true;
  journal(G, `Missão (${FACTIONS[f].short}): ${v.def.title}.`);
  return { ok: true, lines: [{ text: `Missão aceita: ${v.def.title}`, kind: 'info' }] };
}

/** Progresso do objetivo da etapa ativa: { cur, need, done, label }. */
export function objectiveProgress(G, f, obj) {
  const q = qs(G, f);
  const line = QUESTLINES[f];
  obj = obj || line[q.step]?.obj;
  if (!obj) return { cur: 0, need: 0, done: false, label: '' };
  const h = G.hero;
  const cnt = (id) => (h ? (IT.countItem ? IT.countItem(h, id) : (h.inv || []).filter((i) => i.id === id).reduce((s, i) => s + (i.n || 1), 0)) : 0);
  switch (obj.type) {
    case 'kill': {
      const cur = Math.max(0, killsOf(G, obj.enemies) - (q.base || 0));
      return { cur: Math.min(cur, obj.n), need: obj.n, done: cur >= obj.n, label: `Mortos: ${Math.min(cur, obj.n)}/${obj.n}` };
    }
    case 'boss': {
      const ok = !!G.campaign.bosses?.[obj.region];
      return { cur: ok ? 1 : 0, need: 1, done: ok, label: ok ? 'Chefe morto' : 'Chefe vivo' };
    }
    case 'bring': {
      const c = cnt(obj.item);
      return { cur: Math.min(c, obj.n), need: obj.n, done: c >= obj.n, label: `Na mochila: ${Math.min(c, obj.n)}/${obj.n}` };
    }
    case 'flag': {
      const ok = !!G.campaign.flags?.[obj.k];
      return { cur: ok ? 1 : 0, need: 1, done: ok, label: ok ? 'Feito — volte para entregar' : 'Procure no Ermo (eventos)' };
    }
    case 'icor': {
      const c = h?.ichor || 0;
      return { cur: Math.min(c, obj.n), need: obj.n, done: c >= obj.n, label: `Icor: ${Math.min(c, obj.n)}/${obj.n}` };
    }
    case 'coin': {
      const c = h?.coin || 0;
      return { cur: Math.min(c, obj.n), need: obj.n, done: c >= obj.n, label: `Moedas: ${c}/${obj.n}` };
    }
    case 'fragment': {
      const c = fragmentsGivenTo(G, f) + (obj.orEaten ? fragmentsEaten(G) : 0);
      return { cur: Math.min(c, obj.n), need: obj.n, done: c >= obj.n, label: `Fragmentos: ${Math.min(c, obj.n)}/${obj.n}` };
    }
    case 'siege': {
      const c = (G.campaign.counters?.siegesFought || 0) - (q.base || 0);
      return { cur: Math.min(c, 1), need: 1, done: c >= 1, label: c >= 1 ? 'Lutou na muralha' : 'Lute no próximo cerco' };
    }
    case 'nest': {
      const c = nestsDestroyed(G, obj.region) - (q.base || 0);
      return { cur: Math.min(c, obj.n), need: obj.n, done: c >= obj.n, label: `Ninhos: ${Math.min(c, obj.n)}/${obj.n}` };
    }
    case 'corruption': {
      const c = h?.corruption || 0;
      return { cur: Math.min(c, obj.min), need: obj.min, done: c >= obj.min, label: `Corrupção: ${c}/${obj.min}` };
    }
    default: return { cur: 0, need: 1, done: false, label: '?' };
  }
}

/** Descrição curta do objetivo. */
export function objectiveText(obj) {
  switch (obj.type) {
    case 'kill': return `Matar ${obj.n}`;
    case 'boss': return 'Matar o chefe';
    case 'bring': return `Trazer ${obj.n}× ${obj.item}`;
    case 'flag': return 'Cumprir no Ermo';
    case 'icor': return `Entregar ${obj.n} Icor`;
    case 'coin': return `Pagar ${obj.n} moedas`;
    case 'fragment': return `Entregar ${obj.n} Fragmentos${obj.orEaten ? ' (ou devorá-los)' : ''}`;
    case 'siege': return 'Lutar num cerco';
    case 'nest': return `Destruir ${obj.n} ninho(s)`;
    case 'corruption': return `Corrupção ${obj.min}+`;
    default: return '';
  }
}

/** Entrega a etapa ativa (consome itens/Icor/moedas exigidos) e aplica a recompensa. */
export function turnInQuest(G, f) {
  const q = qs(G, f);
  const line = QUESTLINES[f];
  const def = line[q.step];
  if (!def || q.state !== 'active') return { ok: false, reason: 'Nenhuma missão ativa', lines: [] };
  const p = objectiveProgress(G, f);
  if (!p.done) return { ok: false, reason: 'Objetivo incompleto', lines: [] };
  const lines = [];
  const h = G.hero;
  if (def.obj.type === 'bring') {
    if (IT.removeItem) IT.removeItem(h, def.obj.item, def.obj.n);
    lines.push({ text: `−${def.obj.n}× ${def.obj.item}`, kind: '' });
  }
  if (def.obj.type === 'icor') { h.ichor -= def.obj.n; lines.push({ text: `−${def.obj.n} Icor`, kind: '' }); }
  if (def.obj.type === 'coin') { h.coin -= def.obj.n; lines.push({ text: `−${def.obj.n} moedas`, kind: '' }); }
  lines.push({ text: def.done, kind: 'info' });
  lines.push(...applyD(G, def.reward, { source: 'quest', f }).lines);
  q.step += 1;
  q.state = q.step >= line.length ? 'done' : 'available';
  q.base = 0;
  counter(G, `quest_${f}`);
  journal(G, `Missão cumprida (${FACTIONS[f].short}): ${def.title}.`);
  if (q.state === 'done') {
    G.campaign.flags[`questline_${f}`] = true;
    journal(G, `A linha de missões da ${FACTIONS[f].name} terminou.`);
  }
  return { ok: true, lines };
}

/** Op de efeito {op:'questStep', f, step}: marca o objetivo 'flag' da etapa como feito (ou avança se step = etapa atual). */
export function questStep(G, f, step) {
  const q = qs(G, f);
  const line = QUESTLINES[f];
  if (!line) return [];
  const idx = step == null ? q.step : step - 1;   // step é 1-based nos eventos
  const def = line[idx];
  if (!def) return [];
  if (def.obj.type === 'flag') G.campaign.flags[def.obj.k] = true;
  return [{ text: `Missão: ${def.title} — objetivo cumprido. Volte a ${FACTIONS[f].short}.`, kind: 'info' }];
}

/** Abandonar a etapa ativa: custa reputação. */
export function abandonQuest(G, f) {
  const q = qs(G, f);
  if (q.state !== 'active') return [];
  q.state = 'available';
  q.base = 0;
  const def = QUESTLINES[f][q.step];
  if (def?.flagOnStart) delete G.campaign.flags[def.flagOnStart];
  return addRep(G, f, -6, { cross: false });
}

/** Missões ativas cujo objetivo já foi cumprido (para avisos no hub). */
export function questsReady(G) {
  return FACTION_IDS.filter((f) => qs(G, f).state === 'active' && objectiveProgress(G, f).done);
}

export function questDayTick() { return []; }

// ------------------------------------------------------------------ caçadores
/**
 * Ao amanhecer na cidade: facções hostis (≤ −50) e a Guilda cobrando dívida podem mandar caçadores.
 * Define G.city.threat = { f, enemies, text } (a tela da cidade força o combate).
 */
export function rollHunters(G, d) {
  if (!G.city || G.city.threat || !G.hero || G.hero.dead) return [];
  const last = G.city.lastHuntDay || 0;
  if (d - last < 4) return [];
  const angry = FACTION_IDS.filter((f) => isHostile(G, f) || (f === 'guilda' && G.campaign.flags.guilda_cobranca));
  for (const f of angry) {
    const hate = Math.max(0, -rep(G, f) - 40);       // −50 => 10, −100 => 60
    const pct = clamp(8 + hate / 2, 8, 35);
    if (R.chance(pct)) {
      const fac = FACTIONS[f];
      const n = rep(G, f) <= -80 ? 3 : 2;
      const enemies = R.shuffle(fac.hunters).concat(fac.hunters).slice(0, n);
      G.city.threat = { f, enemies, text: fac.hunterText, day: d };
      G.city.lastHuntDay = d;
      return [{ text: `${fac.short}: caçadores na cidade.`, kind: 'bad' }];
    }
  }
  return [];
}

/** Resolver ameaça pagando (só Guilda/Coroa aceitam suborno). */
export function bribeCost(G, f) {
  if (f === 'guilda') return G.city?.loan?.state === 'defaulted' ? G.city.loan.owe : 80;
  if (f === 'coroa') return 100;
  return null;
}
