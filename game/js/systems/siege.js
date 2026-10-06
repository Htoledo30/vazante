// Cercos de Valdrem aos 30/60/90 de Chaga (Área D).
// Fluxo: Chaga cruza o limiar -> G.campaign.pendingSiege = { level, dueDay } (2 dias de aviso).
// No dia: herói na cidade escolhe LUTAR (ondas de combate, context.source='siege') ou CONFIAR na defesa (rolagem).
// Herói fora da cidade (ou morto) -> resolução automática pela defesa, com penalidade.
import { clamp } from '../core/util.js';
import { R } from '../core/rng.js';
import * as EN from '../data/enemies.js';
import * as CH from './character.js';
import { SIEGE_DISTRICT_ORDER, SERVICES, WALL } from '../data/city.js';
import { day, journal, counter, heroDread, addChaga, SIEGE_LEVELS } from './time.js';
import { addRep, rep } from './factions.js';
import { hasTrait, traitName } from './campaign.js';
import * as TR from '../data/traits.js';

export const SIEGES = {
  30: {
    level: 30, power: 35, name: 'A Primeira Horda', warn: 2,
    text: 'Os sinos tocam ao contrário. Do Ermo vem uma maré de camponeses ocos, bocas abertas, mãos de foice.',
    waves: [
      { label: 'Escada leste', enemies: ['horda_oco', 'horda_oco', 'cao_chaga'] },
      { label: 'O portão cede', enemies: ['horda_oco', 'lavrador_oco', 'lavrador_oco', 'saqueador'] },
    ],
    lose: 1,
  },
  60: {
    level: 60, power: 55, name: 'A Horda dos Enforcados', warn: 2,
    text: 'Mortos com cordas no pescoço sobem pelas próprias cordas. Lobos de tendão uivam no fosso.',
    waves: [
      { label: 'Ameias norte', enemies: ['horda_oco', 'horda_oco', 'lobo_tendao'] },
      { label: 'Os pendurados', enemies: ['enforcado', 'enforcado', 'horda_oco'] },
      { label: 'O ceifeiro', enemies: ['horda_oco', 'horda_oco', { id: 'ceifeiro', elite: true }] },
    ],
    lose: 1,
  },
  90: {
    level: 90, power: 75, name: 'A Maré de Carne', warn: 2,
    text: 'O Ermo inteiro anda. Coisas de sal, de água, de carne do deus. Não há mais horizonte, só boca.',
    waves: [
      { label: 'O fosso transborda', enemies: ['horda_oco', 'horda_oco', 'horda_oco', 'carnical'] },
      { label: 'Afogados na muralha', enemies: ['afogado', 'afogado', 'esqueleto_placas', 'horda_oco'] },
      { label: 'O cervo', enemies: [{ id: 'cervo_podre', elite: true }, 'horda_oco', 'carnical'] },
    ],
    lose: 2,
  },
};

/** B substitui ids canônicos ainda não implementados (resolveEnemyId); só ids fora do contrato são trocados aqui. */
const enemyExists = (id) => !EN.ENEMIES || !!EN.ENEMIES[id] || !!EN.CANONICAL_ENEMIES?.[id];
function sanitize(list) {
  return list.map((e) => {
    const id = typeof e === 'string' ? e : e.id;
    if (enemyExists(id)) return e;
    const sub = ['horda_oco', 'lavrador_oco', 'saqueador'].find(enemyExists) || 'horda_oco';
    return typeof e === 'string' ? sub : { ...e, id: sub };
  });
}

export const siegeDef = (level) => SIEGES[level] || null;
export const pendingSiege = (G) => G.campaign.pendingSiege || null;

/** Agenda o menor limiar ainda não resolvido que a Chaga já atingiu. */
export function checkSiegeTriggers(G) {
  const cp = G.campaign;
  cp.sieges = cp.sieges || {};
  if (cp.pendingSiege || cp.ended) return [];
  for (const lv of SIEGE_LEVELS) {
    if (G.chaga >= lv && !cp.sieges[lv]) {
      const def = SIEGES[lv];
      cp.pendingSiege = { level: lv, dueDay: day(G) + def.warn, announced: day(G), ready: false, fight: null };
      journal(G, `Os vigias avistam a horda. Cerco em ${def.warn} dias: ${def.name}.`);
      return [{ text: `CERCO em ${def.warn} dias: ${def.name}.`, kind: 'bad' }];
    }
  }
  return [];
}

/** Virada do dia: se o cerco venceu o prazo, fica pronto (cidade) ou se resolve sozinho (fora). */
export function siegeDayTick(G, d, where) {
  const ps = G.campaign.pendingSiege;
  if (!ps || d < ps.dueDay || ps.fight) return [];
  if (where === 'city' && G.hero && !G.hero.dead) { ps.ready = true; return [{ text: 'A horda chegou à muralha.', kind: 'bad' }]; }
  const r = resolveByDefense(G, { absent: true });
  return [{ text: 'Enquanto você estava fora, a horda atacou Valdrem.', kind: 'bad' }, ...r.lines];
}

/** Chance de a defesa segurar a horda sozinha. */
export function defenseChance(G, { absent = false, wavesWon = 0, level } = {}) {
  const lv = level || G.campaign.pendingSiege?.level || 30;
  const def = SIEGES[lv];
  const parts = [
    { label: 'Base', v: 50 },
    { label: `Muralha ${G.city.defense} vs. horda ${def.power}`, v: G.city.defense - def.power },
  ];
  const mor = Math.round(((G.city.morale ?? 50) - 50) / 4);
  if (mor) parts.push({ label: 'Moral', v: mor });
  const cr = Math.round(clamp(rep(G, 'coroa'), -50, 50) / 10);
  if (cr) parts.push({ label: 'Guarda Cinzenta', v: cr });
  if (wavesWon) parts.push({ label: `Ondas que você quebrou (${wavesWon})`, v: wavesWon * 15 });
  if (absent) parts.push({ label: 'Você não estava lá', v: -10 });
  const lost = (G.city.lostDistricts || []).length;
  if (lost) parts.push({ label: 'Distritos perdidos', v: -3 * lost });
  const pct = clamp(parts.reduce((s, p) => s + p.v, 0), 5, 95);
  return { pct, parts };
}

export function addDefense(G, n) {
  const before = G.city.defense;
  G.city.defense = clamp(before + n, 0, WALL.max);
  const d = G.city.defense - before;
  return d ? [{ text: `Muralha ${d > 0 ? '+' : ''}${d} (${G.city.defense})`, kind: d > 0 ? 'good' : 'bad' }] : [];
}

/** Rolagem da defesa e aplicação do resultado. */
export function resolveByDefense(G, opts = {}) {
  const ps = G.campaign.pendingSiege;
  if (!ps) return { won: false, lines: [] };
  const { pct } = defenseChance(G, { ...opts, level: ps.level });
  const roll = R.int(1, 100);
  const won = roll <= pct;
  const lines = [{ text: `Defesa: ${pct}% — rolou ${roll}.`, kind: won ? 'good' : 'bad' }];
  lines.push(...applySiegeResult(G, won, { fought: !!opts.fought, absent: !!opts.absent, wavesWon: opts.wavesWon || 0 }));
  return { won, roll, pct, lines };
}

function pickLostDistricts(G, n) {
  const lost = new Set(G.city.lostDistricts || []);
  const avail = SIEGE_DISTRICT_ORDER.filter((s) => !lost.has(s) && SERVICES[s]?.losable);
  // um pouco de caos: os dois mais expostos disputam
  const out = [];
  for (let i = 0; i < n && avail.length; i++) {
    const k = avail.length > 1 && R.chance(35) ? 1 : 0;
    out.push(avail.splice(k, 1)[0]);
  }
  return out;
}

/** Aplica vitória/derrota do cerco. */
export function applySiegeResult(G, won, { fought = false, absent = false, wavesWon = 0 } = {}) {
  const ps = G.campaign.pendingSiege;
  if (!ps) return [];
  const def = SIEGES[ps.level];
  const lines = [];
  G.campaign.sieges[ps.level] = won ? 'won' : 'lost';
  if (fought) counter(G, 'siegesFought');
  if (won) {
    lines.push({ text: `${def.name}: a muralha aguentou.`, kind: 'good' });
    G.city.morale = clamp((G.city.morale ?? 50) + 12, 0, 100);
    lines.push(...addDefense(G, -4));
    lines.push(...addChaga(G, -2, 'A horda quebrou na muralha'));
    if (fought) {
      lines.push(...addRep(G, 'coroa', 10));
      const vt = TR.TRAITS?.sobrevivente_cerco ? 'sobrevivente_cerco' : 'veterano_cerco';
      if (!hasTrait(G, vt) && G.hero && !G.hero.dead) {
        G.hero.traits.push(vt);
        lines.push({ text: `Traço: ${traitName(vt)}`, kind: 'good' });
      }
    }
    journal(G, `${def.name}: Valdrem resistiu${fought ? ', e eu estava na muralha' : ''}.`);
  } else {
    const lost = pickLostDistricts(G, def.lose);
    G.city.lostDistricts = [...(G.city.lostDistricts || []), ...lost];
    const names = lost.map((s) => SERVICES[s].name).join(', ');
    lines.push({ text: `${def.name}: a horda entrou.${names ? ` Perdido: ${names}.` : ''}`, kind: 'bad' });
    const deaths = R.int(20, 60) * (ps.level / 30);
    lines.push({ text: `Mortos na cidade: ${Math.round(deaths)}. Os corpos queimam no pátio.`, kind: 'bad' });
    G.city.morale = clamp((G.city.morale ?? 50) - 15, 0, 100);
    lines.push(...addDefense(G, -8));
    lines.push(...addChaga(G, 3, 'A horda deixou podridão dentro dos muros'));
    if (absent) lines.push(...addRep(G, 'coroa', -5, { cross: false }));
    if (G.hero && !G.hero.dead && !absent) lines.push(...heroDread(G, 15, 'a cidade caindo'));
    // a Casa também sofre
    if (R.chance(40) && (G.lineage.stash || []).length) {
      const i = R.int(0, G.lineage.stash.length - 1);
      const it = G.lineage.stash.splice(i, 1)[0];
      lines.push({ text: `Saqueadores levaram algo do baú da Casa (${it.name || it.id}).`, kind: 'bad' });
    }
    journal(G, `${def.name}: a horda rompeu a muralha. Perdemos ${names || 'muita gente'}.`);
  }
  G.campaign.pendingSiege = null;
  lines.push(...checkSiegeTriggers(G));
  return lines;
}

// ------------------------------------------------------------------ lutar na muralha
/** Começa a luta: retorna a spec do combate da 1ª onda (a UI chama startCombat). */
export function beginWallFight(G) {
  const ps = G.campaign.pendingSiege;
  if (!ps) return null;
  const def = SIEGES[ps.level];
  ps.fight = { wave: 0, waves: def.waves.length, won: 0 };
  return waveSpec(G);
}

/** Spec de combate da onda atual. */
export function waveSpec(G) {
  const ps = G.campaign.pendingSiege;
  if (!ps?.fight) return null;
  const def = SIEGES[ps.level];
  const w = def.waves[ps.fight.wave];
  return {
    enemies: sanitize(w.enemies).map((e) => (typeof e === 'string' ? { id: e, dist: R.int(0, 1) } : { dist: 1, ...e })),
    region: ps.level >= 90 ? 'r3' : ps.level >= 60 ? 'r2' : 'r1',
    night: true, dark: false, canFlee: true,
    context: { source: 'siege', wave: ps.fight.wave, level: ps.level, label: w.label },
  };
}

export const waveLabel = (G) => {
  const ps = G.campaign.pendingSiege;
  return ps?.fight ? SIEGES[ps.level].waves[ps.fight.wave]?.label : '';
};

/**
 * Fim de uma onda. outcome.result: 'win'|'fled'|'lose'.
 * Retorna { status:'next'|'done', lines }. 'next' = há outra onda (a UI mostra a pausa entre ondas).
 */
export function onWaveEnd(G, outcome = {}) {
  const ps = G.campaign.pendingSiege;
  if (!ps?.fight) return { status: 'done', lines: [] };
  const res = outcome.result;
  if (res === 'win') {
    ps.fight.won += 1;
    ps.fight.wave += 1;
    if (ps.fight.wave >= ps.fight.waves) {
      const lines = [{ text: 'A última onda quebrou nos seus pés.', kind: 'good' }];
      lines.push(...applySiegeResult(G, true, { fought: true, wavesWon: ps.fight.won }));
      return { status: 'done', won: true, lines };
    }
    return { status: 'next', lines: [{ text: `Onda quebrada. Vem outra.`, kind: 'good' }] };
  }
  // fugiu / caiu: a defesa decide o resto, com o que você conseguiu segurar
  const won = ps.fight.won;
  const lines = [];
  if (res === 'fled') {
    lines.push({ text: 'Você largou a ameia. Outros morreram no seu lugar.', kind: 'bad' });
    lines.push(...addRep(G, 'coroa', -8, { cross: false }));
    G.city.morale = clamp((G.city.morale ?? 50) - 5, 0, 100);
  }
  const r = resolveByDefense(G, { wavesWon: won, fought: won > 0 });
  lines.push(...r.lines);
  return { status: 'done', won: r.won, lines };
}

/** Pausa entre ondas: recuperar um pouco (água e bandagem dos soldados). */
export function betweenWaves(G) {
  const h = G.hero;
  if (!h) return [];
  let max = 60;
  try { if (CH.derive) max = CH.derive(h).hpMax || max; } catch { /* ignore */ }
  const heal = Math.max(5, Math.round(max * 0.12));
  h.hp = Math.min(max, (h.hp || 0) + heal);
  return [{ text: `Um soldado joga água no seu rosto e amarra um trapo. +${heal} Vida.`, kind: 'good' }];
}

/** Retirar-se antes da próxima onda (deixa a defesa resolver, com bônus pelas ondas vencidas). */
export function retreatFromWall(G) {
  const ps = G.campaign.pendingSiege;
  if (!ps?.fight) return { lines: [] };
  const r = resolveByDefense(G, { wavesWon: ps.fight.won, fought: true });
  return { won: r.won, lines: [{ text: 'Você desce das ameias, sangrando. Os outros seguram o resto.', kind: '' }, ...r.lines] };
}

/** Cerco iminente (para avisos e para bloquear viagens longas). */
export function siegeWarning(G) {
  const ps = G.campaign.pendingSiege;
  if (!ps) return null;
  const left = ps.dueDay - day(G);
  return { level: ps.level, name: SIEGES[ps.level].name, daysLeft: left, ready: !!ps.ready || left <= 0, fight: ps.fight };
}
