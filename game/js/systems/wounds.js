// ICOR — feridas (Área A): infligir, curar com o tempo, infecção → necrose → gangrena, tratamentos, perdas permanentes.
// Ferida (instância em hero.wounds): { uid, id, part, days, infected, treated, bleeding, bleedH, infDays, treatedBy:[], salted }
// Também faz a "manutenção diária" do herói (vícios, relíquias, mutações com Corrupção diária, regeneração natural),
// porque tickWounds é o único relógio de A que D chama (time.advanceTime).
import { WOUNDS, WOUND_LIST, PARTS, TREATMENTS } from '../data/wounds.js';
import { TRAITS } from '../data/traits.js';
import { MUTATIONS } from '../data/mutations.js';
import { R } from '../core/rng.js';
import { uid, clamp } from '../core/util.js';
import { derive, addDread, addCorruption, damageHero, heal } from './character.js';
import { unequip, itemDef, countItem, removeItem, hasItem } from './items.js';
import { rollCheck } from './checks.js';
import * as flow from './flow.js';

const LIMBS = ['bracoD', 'bracoE', 'pernas'];
export const PART_NAMES = { cabeca: 'Cabeça', tronco: 'Tronco', bracoD: 'Braço da arma', bracoE: 'Braço do escudo', pernas: 'Pernas', olho: 'Olho' };
export const SEV_NAMES = ['', 'leve', 'grave', 'mutilante'];

// ------------------------------------------------------------ leitura (derive usa)
/** Soma de mods de todas as feridas (penalidades cruas; derive aplica Ignorar a Dor). */
export function woundMods(hero) {
  const m = {};
  for (const w of hero?.wounds || []) {
    const d = WOUNDS[w.id];
    if (!d) continue;
    for (const k in d.mods) m[k] = (m[k] || 0) + d.mods[k];
    const bp = d.modsByPart?.[w.part];
    if (bp) for (const k in bp) m[k] = (m[k] || 0) + bp[k];
    if (w.infected) { m.staminaMax = (m.staminaMax || 0) - 1; m.acc = (m.acc || 0) - 3; }
  }
  return m;
}

/** { flags:[...], lost:[partes perdidas] } */
export function woundFlags(hero) {
  const flags = new Set();
  const lost = new Set();
  for (const w of hero?.wounds || []) {
    const d = WOUNDS[w.id];
    if (!d) continue;
    for (const f of d.flags) flags.add(f);
    for (const f of d.flagsByPart?.[w.part] || []) flags.add(f);
    if (d.loses) lost.add(d.loses === true ? w.part : d.loses);
    if (w.id === 'cego') lost.add('olho');
  }
  return { flags: [...flags], lost: [...lost] };
}

export function lostParts(hero) { return woundFlags(hero).lost; }
export const partLost = (hero, part) => lostParts(hero).includes(part);

export function describeWound(w) {
  const d = WOUNDS[w?.id];
  if (!d) return { name: '?', effect: '', days: 0 };
  const mods = { ...d.mods, ...(d.modsByPart?.[w.part] || {}) };
  const fl = [...d.flags, ...(d.flagsByPart?.[w.part] || [])];
  const parts = [];
  for (const [k, v] of Object.entries(mods)) parts.push(modShort(k, v));
  const FL = { noTwoHand: 'sem duas mãos', noShield: 'sem escudo', noFlee: 'não foge', noRanged: 'sem besta' };
  for (const f of fl) parts.push(FL[f] || f);
  if (d.loses) parts.push(d.loses === 'olho' ? 'perdeu o olho' : 'membro perdido');
  if (d.corrPerDay && !w.salted) parts.push(`+${d.corrPerDay} Corrupção/dia`);
  if (d.hpLossPerDay) parts.push(`−${d.hpLossPerDay} Vida/dia`);
  const days = d.days < 0 ? -1 : Math.max(0, Math.ceil(w.days));
  return {
    name: d.name, desc: d.desc, effect: parts.filter(Boolean).join(', '), days, part: w.part, partName: PART_NAMES[w.part] || w.part,
    sev: d.sev, sevName: SEV_NAMES[d.sev], infected: !!w.infected, treated: !!w.treated, bleeding: !!w.bleeding && !w.treated,
    permanent: d.days < 0, needs: d.needs && !(w.treatedBy || []).includes(d.needs) ? d.needs : null,
    treat: d.treat.slice(), status: d.status || null, bleed: d.bleed || 0,
  };
}
const SHORT = { acc: 'precisão', eva: 'esquiva', block: 'bloqueio', parry: 'aparar', dmg_all: '% dano', staminaMax: 'Fôlego', staminaRegen: 'Fôlego/turno',
  speed: '% veloc.', travel: '% viagem', intent: 'intenção', crit: 'crítico', hpMaxPct: '% Vida', check_ast: 'AST', check_von: 'VON', dreadResist: '% vs Pavor',
  food_eff: '% ração', fireResist: '% vs fogo', ambush: '% emboscada', corrResist: '% vs Corrupção', dmg_icor: '% Icor', dark: 'escuro' };
function modShort(k, v) { return `${v > 0 ? '+' : '−'}${Math.abs(v)} ${SHORT[k] || k}`; }

// ------------------------------------------------------------ infligir
function pickPart(hero) {
  const lost = new Set(lostParts(hero));
  const list = Object.entries(PARTS).map(([p, x]) => [p, lost.has(p) ? 0 : x.w]);
  return R.weighted(list);
}

/**
 * Inflige ferida no herói. sev: 1 leve, 2 grave, 3 mutilante. part omitida = aleatória.
 * Aplica perdas permanentes (desequipa), cria coto aberto, aplica Pavor da ferida (B não precisa somar).
 * Retorna a instância (JSON) ou null.
 */
export function inflictWound(G, { part, dtype = 'corte', sev = 1, id = null } = {}) {
  const hero = G?.hero;
  if (!hero) return null;
  hero.wounds = hero.wounds || [];
  const D0 = derive(hero);
  let p = part || pickPart(hero);
  if (!PARTS[p]) p = 'tronco';
  if (LIMBS.includes(p) && D0.lostParts.includes(p)) p = 'tronco';
  let s = clamp(Math.round(sev || 1), 1, 3);
  if (dtype === 'impacto' && D0.tags.includes('ossos_ocos')) s = Math.min(3, s + 1);
  let def = id ? WOUNDS[id] : null;
  if (!def) {
    for (let ss = s; ss >= 1 && !def; ss--) {
      const c = WOUND_LIST.filter((w) => w.w > 0 && w.sev === ss && w.parts.includes(p) && w.dtypes.includes(dtype));
      if (c.length) def = R.weighted(c.map((x) => [x, x.w]));
    }
    if (!def) {
      const c = WOUND_LIST.filter((w) => w.w > 0 && w.parts.includes(p) && w.sev <= s);
      if (c.length) def = R.weighted(c.map((x) => [x, x.w]));
    }
  }
  if (!def) return null;
  // segundo olho perdido = cego
  if (def.id === 'olho_perdido' && D0.lostParts.includes('olho')) def = WOUNDS.cego;
  // não repetir permanentes idênticas na mesma parte (ex.: dedos duas vezes vira mão)
  if (def.days < 0 && hero.wounds.some((w) => w.id === def.id && w.part === p)) {
    if (def.id === 'dedos_decepados') def = WOUNDS.mao_decepada;
    else if (def.id === 'orelha_decepada') def = WOUNDS.rosto_aberto;
  }
  const w = newWound(def, p);
  hero.wounds.push(w);
  if (def.loses) loseThing(G, def.loses === true ? p : def.loses, w);
  if (def.spawn && WOUNDS[def.spawn]) hero.wounds.push(newWound(WOUNDS[def.spawn], p));
  let dread = def.dread || 0;
  if (D0.tags.includes('fobia_sangue') && def.bleed) dread += 5;
  if (D0.tags.includes('dor_reza')) dread = Math.round(dread / 2);
  if (dread) addDread(G, dread, def.name);
  const max = derive(hero).hpMax;
  if (hero.hp > max) hero.hp = max;
  return w;
}

function newWound(def, part) {
  return { uid: uid('w'), id: def.id, part, days: def.days, infected: false, treated: false, bleeding: (def.bleed || 0) > 0, bleedH: 0, infDays: 0, treatedBy: [] };
}

/** Perda permanente: desequipa o que o membro segurava e limpa feridas que não importam mais. */
function loseThing(G, part, keep) {
  const hero = G.hero;
  if (part === 'bracoD' && hero.equip.main) {
    // a arma cai; com a outra mão o jogador pode re-equipar (mão ruim)
    unequip(hero, 'main', { force: true });
  }
  if (part === 'bracoE' && hero.equip.off) unequip(hero, 'off', { force: true });
  if (part === 'olho' || part === 'cabeca') return;
  hero.wounds = hero.wounds.filter((w) => w === keep || w.part !== part || WOUNDS[w.id]?.days < 0);
  hero.prosthetics = hero.prosthetics || {};
  hero.prosthetics[part] = null;
  hero.stats = hero.stats || {};
}

// ------------------------------------------------------------ tempo
/**
 * Avança o relógio das feridas. Chamado por D (advanceTime) e pela linguagem de efeitos.
 * Por hora: sangramento (coagula em 6h, 3h com 'clot'; hemorragia interna não), regeneração natural (+1/3h).
 * Por dia: cura, infecção → necrose → gangrena, Corrupção de feridas/relíquias/mutações, vícios (fissura).
 * Morte: marca hero.flags.dead e chama flow.heroDied após a rotina atual (microtask).
 */
export function tickWounds(G, hours) {
  const hero = G?.hero;
  const lines = [];
  if (!hero || !(hours > 0) || hero.flags?.dead) return lines;
  hero.flags = hero.flags || {};
  const D = derive(hero);
  // --- sangramento por hora
  let bleedLoss = 0;
  const clotH = D.tags.includes('clot') ? 3 : 6;
  for (const w of hero.wounds) {
    const d = WOUNDS[w.id];
    if (!d || !w.bleeding || w.treated) continue;
    const hrs = d.noClot ? hours : Math.max(0, Math.min(hours, clotH - (w.bleedH || 0)));
    bleedLoss += d.bleed * hrs * (1 - D.bleedResist / 100);
    w.bleedH = (w.bleedH || 0) + hours;
    if (!d.noClot && w.bleedH >= clotH) { w.bleeding = false; lines.push({ text: `${d.name}: o sangue coagulou sozinho.`, kind: 'info' }); }
  }
  if (bleedLoss >= 1) {
    const r = damageHero(G, Math.round(bleedLoss), 'Sangrou até a morte');
    lines.push({ text: `Você sangra: −${r.dealt} Vida.`, kind: 'bad' });
    if (r.died) return die(G, lines, 'Sangrou até a morte');
  }
  // --- regeneração natural
  hero.flags.regenClock = (hero.flags.regenClock || 0) + hours;
  const canRegen = (hero.hunger || 0) <= 24 && !hero.wounds.some((w) => w.infected || (w.bleeding && !w.treated));
  const ticks = Math.floor(hero.flags.regenClock / 3);
  hero.flags.regenClock -= ticks * 3;
  if (canRegen && ticks > 0) heal(hero, ticks);
  // --- dias
  hero.flags.woundClock = (hero.flags.woundClock || 0) + hours;
  while (hero.flags.woundClock >= 24) {
    hero.flags.woundClock -= 24;
    dailyTick(G, lines);
    if (hero.flags.dead) break;
  }
  return lines;
}

function die(G, lines, cause) {
  const hero = G.hero;
  if (hero.flags.dead) return lines;
  hero.flags.dead = true;
  hero.flags.deathCause = cause;
  lines.push({ text: `Você morreu. ${cause}.`, kind: 'bad' });
  const info = { region: G.expedition?.region || null, nodeId: G.expedition?.node || null };
  const fn = () => flow.heroDied(cause, info);
  if (typeof queueMicrotask === 'function') queueMicrotask(fn); else Promise.resolve().then(fn);
  return lines;
}

function dailyTick(G, lines) {
  const hero = G.hero;
  const D = derive(hero);
  const healMult = Math.max(0.2, 1 + (D.mods.heal_rate || 0) / 100) * ((hero.hunger || 0) > 48 ? 0.5 : 1);
  let hpLoss = 0;
  let corr = 0;
  for (const w of [...hero.wounds]) {
    const d = WOUNDS[w.id];
    if (!d) continue;
    // infecção
    if (!w.infected && d.infect > 0 && d.days !== -1) {
      const pctInf = d.infect * (w.treated ? 0.4 : 1) * (1 - D.infectResist / 100);
      if (R.chance(pctInf)) { w.infected = true; w.infDays = 0; lines.push({ text: `${d.name} (${PART_NAMES[w.part]}) infeccionou. Febre.`, kind: 'bad' }); }
    }
    if (w.infected) {
      w.infDays = (w.infDays || 0) + 1;
      hpLoss += 3;
      if (w.id !== 'necrose' && w.id !== 'gangrena' && w.infDays >= 3) {
        w.id = 'necrose'; w.days = WOUNDS.necrose.days; w.infDays = 0; w.treated = false; w.treatedBy = [];
        lines.push({ text: `A infecção virou necrose: ${PART_NAMES[w.part]} apodrece.`, kind: 'bad' });
      } else if (w.id === 'necrose' && w.infDays >= 4) {
        w.id = 'gangrena'; w.days = -1; w.infDays = 0;
        lines.push({ text: `Gangrena em ${PART_NAMES[w.part]}. ${LIMBS.includes(w.part) ? 'Amputar ou morrer.' : 'Só um cirurgião.'}`, kind: 'bad' });
      }
      continue;
    }
    if (d.hpLossPerDay) hpLoss += d.hpLossPerDay;
    if (d.corrPerDay && !w.salted) corr += d.corrPerDay;
    // cura
    if (d.days < 0 || w.days < 0) continue;
    if (d.needs && !(w.treatedBy || []).includes(d.needs)) continue;
    w.days -= healMult * (w.treated ? 1.25 : 1);
    if (w.days <= 0) {
      hero.wounds.splice(hero.wounds.indexOf(w), 1);
      lines.push({ text: `${d.name} (${PART_NAMES[w.part]}) fechou.`, kind: 'good' });
      const tr = d.onHealTraitByPart?.[w.part] || d.onHealTrait;
      if (tr && TRAITS[tr] && !hero.traits.includes(tr)) { hero.traits.push(tr); lines.push({ text: `Cicatriz: ${TRAITS[tr].name}.`, kind: 'warn' }); }
    }
  }
  // relíquias equipadas e mutações que corrompem
  for (const s of ['amuleto1', 'amuleto2']) { const def = itemDef(hero.equip?.[s]); if (def?.corrPerDay) corr += def.corrPerDay; }
  for (const id of hero.mutations || []) if (MUTATIONS[id]?.corrPerDay) corr += MUTATIONS[id].corrPerDay;
  if (corr > 0) {
    hero.flags.corrFrac = (hero.flags.corrFrac || 0) + corr;
    const whole = Math.floor(hero.flags.corrFrac);
    hero.flags.corrFrac -= whole;
    if (whole > 0) lines.push(...addCorruption(G, whole, 'a carne do deus', { raw: true }).lines);
    if (hero.flags.dead) return;
  }
  // vícios
  for (const tid of hero.traits || []) {
    const t = TRAITS[tid];
    if (!t?.addiction) continue;
    const last = hero.flags[`lastUse_${tid}`] ?? (G.time || 0);
    if (hero.flags[`lastUse_${tid}`] == null) hero.flags[`lastUse_${tid}`] = last;
    if ((G.time || 0) - last >= t.addiction.hours && !hero.flags[`craving_${tid}`]) {
      hero.flags[`craving_${tid}`] = true;
      lines.push({ text: `Fissura (${t.name}). O corpo cobra.`, kind: 'bad' });
    }
  }
  if (hpLoss > 0) {
    const r = damageHero(G, hpLoss, 'Febre e podridão');
    lines.push({ text: `Febre e podridão: −${r.dealt} Vida.`, kind: 'bad' });
    if (r.died) die(G, lines, 'Apodreceu viva(o)');
  }
}

// ------------------------------------------------------------ tratamento
export function woundByUid(hero, wuid) { return (hero?.wounds || []).find((w) => w.uid === wuid) || null; }

/**
 * Aplica um tratamento. NÃO consome itens nem cobra moedas (quem chama faz: fieldTreat no campo, D no barbeiro).
 * opts: { where:'field'|'city', prosthetic:'gancho'|'perna_pau'|..., part }
 */
export function treatWound(G, woundUid, method, opts = {}) {
  const hero = G?.hero;
  const lines = [];
  const w = woundByUid(hero, woundUid);
  if (!w) return [{ text: 'Ferida não encontrada.', kind: 'bad' }];
  const d = WOUNDS[w.id];
  if (!d.treat.includes(method)) return [{ text: `${TREATMENTS[method]?.name || method} não serve para ${d.name}.`, kind: 'warn' }];
  const mark = () => { w.treatedBy = w.treatedBy || []; if (!w.treatedBy.includes(method)) w.treatedBy.push(method); };
  const field = opts.where !== 'city';
  switch (method) {
    case 'bandagem':
      w.treated = true; w.bleeding = false; mark();
      lines.push({ text: `Você enfaixa ${d.name.toLowerCase()}. O sangue para.`, kind: 'good' });
      break;
    case 'unguento':
      mark(); w.treated = true;
      if (w.days > 0) w.days = Math.max(0.5, w.days - 2);
      lines.push({ text: `Unguento em ${d.name.toLowerCase()}. Arde, depois alivia.`, kind: 'good' });
      break;
    case 'tala':
      w.treated = true; mark();
      if (w.days > 0) w.days = Math.ceil(w.days * 0.6);
      lines.push({ text: `Tala firme. O osso vai colar mais rápido.`, kind: 'good' });
      break;
    case 'ferro_quente': {
      w.bleeding = false; w.infected = false; w.infDays = 0; w.treated = true; mark();
      lines.push({ text: `Ferro em brasa na carne. O cheiro é de porco assado. ${d.name} fechada.`, kind: 'good' });
      const r = damageHero(G, 6, 'Choque da cauterização');
      lines.push({ text: `−${r.dealt} Vida.`, kind: 'bad' });
      lines.push(...addDread(G, 8, 'cauterização').lines);
      break;
    }
    case 'sal':
      w.salted = true; w.treated = true; mark();
      if (w.days > 0) w.days = Math.max(1, Math.ceil(w.days / 2));
      lines.push({ text: `Sal na ferida. A mancha cinza para de crescer.`, kind: 'good' });
      break;
    case 'sanguessuga':
      w.salted = true; w.treated = true; mark();
      if (w.days > 0) w.days = Math.max(1, Math.ceil(w.days / 2));
      lines.push({ text: `As sanguessugas incham de ouro e caem mortas.`, kind: 'good' });
      break;
    case 'cirurgia': {
      if (w.id === 'gangrena') {
        w.id = 'necrose'; w.days = WOUNDS.necrose.days; w.treatedBy = ['cirurgia'];
        lines.push({ text: 'O cirurgião corta a carne preta até sangrar vermelho.', kind: 'good' });
      } else if (w.id === 'necrose') {
        w.id = 'corte_profundo'; w.days = 6; w.treatedBy = ['cirurgia', 'bandagem'];
        lines.push({ text: 'A carne morta sai em tiras. Fica um buraco limpo.', kind: 'good' });
      } else {
        mark();
        if (w.days > 0) w.days = Math.ceil(w.days * 0.5);
        lines.push({ text: `Cirurgia em ${d.name.toLowerCase()}. ${d.needs === 'cirurgia' ? 'Agora pode sarar.' : 'Vai sarar na metade do tempo.'}`, kind: 'good' });
      }
      w.infected = false; w.infDays = 0; w.bleeding = false; w.treated = true; w.salted = true;
      if (field) lines.push(...addDread(G, 6, 'operar a si mesmo').lines);
      break;
    }
    case 'amputar':
      return amputate(G, w.part, { where: opts.where, why: d.name });
    case 'protese':
      return fitProstheticTo(G, w, opts.prosthetic);
    default:
      return [{ text: 'Tratamento desconhecido.', kind: 'bad' }];
  }
  return lines;
}

/** Amputa um membro (bracoD, bracoE, pernas). No campo: choque, teste de VON. */
export function amputate(G, part, { where = 'field', why = '' } = {}) {
  const hero = G.hero;
  const lines = [];
  if (!LIMBS.includes(part)) return [{ text: 'Não dá para amputar isso.', kind: 'bad' }];
  if (partLost(hero, part)) return [{ text: 'Já não existe.', kind: 'warn' }];
  const D = derive(hero);
  const field = where !== 'city';
  hero.wounds = hero.wounds.filter((w) => w.part !== part || WOUNDS[w.id]?.days < 0 && !LIMBS.includes(w.part));
  const amp = newWound(WOUNDS.amputado, part);
  hero.wounds.push(amp);
  const coto = newWound(WOUNDS.coto_aberto, part);
  if (!field) { coto.treated = true; coto.bleeding = false; coto.treatedBy = ['ferro_quente']; }
  hero.wounds.push(coto);
  loseThing(G, part, amp);
  lines.push({ text: `${PART_NAMES[part]} amputado${why ? ` (${why})` : ''}. A serra range no osso.`, kind: 'bad' });
  if (field) {
    const safe = D.tags.includes('amputacao_segura');
    let dmg = 10;
    if (!safe) {
      const chk = rollCheck(G, { attr: 'von', diff: 20 });
      if (!chk.ok) { dmg += 10; lines.push({ text: `Você desmaia de dor no meio. (VON ${chk.chance}%: falhou)`, kind: 'bad' }); }
      else lines.push({ text: `Você morde o couro e aguenta. (VON ${chk.chance}%)`, kind: 'info' });
    }
    const r = damageHero(G, dmg, 'Choque da amputação');
    lines.push({ text: `−${r.dealt} Vida.`, kind: 'bad' });
    lines.push(...addDread(G, safe ? 8 : 18, 'amputação').lines);
    if (r.died) die(G, lines, 'Morreu na própria amputação');
  } else {
    lines.push(...addDread(G, 10, 'amputação').lines);
  }
  return lines;
}

const PROSTHETIC_FOR = { bracoD: ['gancho', 'gancho_protese', 'gancho_serrilhado'], bracoE: ['gancho', 'gancho_protese', 'gancho_serrilhado'], pernas: ['perna_pau', 'perna_ferro'], olho: ['olho_vidro', 'olho_icor'] };

function fitProstheticTo(G, w, type) {
  const hero = G.hero;
  const d = WOUNDS[w.id];
  const part = d.loses === true ? w.part : d.loses;
  const allowed = PROSTHETIC_FOR[part] || [];
  const t = type || allowed[0];
  if (!allowed.includes(t)) return [{ text: 'Prótese errada para essa perda.', kind: 'warn' }];
  if (hero.wounds.some((x) => (x.id === 'coto_aberto' || x.id === 'orbita_aberta') && (x.part === w.part))) return [{ text: 'O coto ainda está aberto.', kind: 'warn' }];
  const key = part === 'olho' ? 'cabeca' : part;
  hero.prosthetics = hero.prosthetics || {};
  hero.prosthetics[key] = t === 'gancho' ? 'gancho_protese' : t;
  const NAMES = { gancho_protese: 'um gancho', gancho_serrilhado: 'um gancho serrilhado', perna_pau: 'uma perna de pau', perna_ferro: 'uma perna de ferro', olho_vidro: 'um olho de vidro', olho_icor: 'um olho de âmbar dourado' };
  return [{ text: `Encaixam ${NAMES[hero.prosthetics[key]] || 'a prótese'} no lugar. Dói. Funciona.`, kind: 'good' }];
}

// ------------------------------------------------------------ tratamento no campo (ficha)
const FIELD_TIME = { cirurgia: 2, amputar: 1, tala: 0, bandagem: 0, ferro_quente: 0, unguento: 0, sal: 0, sanguessuga: 0 };

/** Opções de tratamento para a UI. where 'field' (com itens) ou 'city' (barbeiro: D define preço). */
export function treatOptions(G, woundUid, { where = 'field' } = {}) {
  const hero = G?.hero;
  const w = woundByUid(hero, woundUid);
  if (!w) return [];
  const d = WOUNDS[w.id];
  const D = derive(hero);
  const out = [];
  const inCombat = !!(G.combat && !G.combat.result);
  for (const m of d.treat) {
    const T = TREATMENTS[m];
    if (!T) continue;
    const o = { method: m, label: T.name, sub: T.desc, disabled: false, why: null, item: T.item, hours: where === 'field' ? FIELD_TIME[m] || 0 : 0 };
    if (inCombat) { o.disabled = true; o.why = 'Em combate, use Itens.'; }
    if (m === 'protese') {
      if (where === 'field') { o.disabled = true; o.why = 'Equipe uma prótese da mochila, ou procure o barbeiro.'; }
      if (hero.wounds.some((x) => (x.id === 'coto_aberto' || x.id === 'orbita_aberta') && x.part === w.part)) { o.disabled = true; o.why = 'O coto ainda está aberto.'; }
      out.push(o); continue;
    }
    if (where === 'field') {
      if (m === 'cirurgia') {
        if (!D.tags.includes('cirurgia_campo')) { o.disabled = true; o.why = 'Só um cirurgião (ou Mãos Firmes/Mãos Limpas).'; }
        else if (!hasItem(hero, 'bandagem')) { o.disabled = true; o.why = 'Precisa de 1 bandagem.'; }
        else o.sub = `${T.desc} Gasta 1 bandagem, ${o.hours}h.`;
      } else if (m === 'amputar') {
        if (!LIMBS.includes(w.part)) { o.disabled = true; o.why = 'Só membros.'; }
        else if (!hasCuttingTool(hero)) { o.disabled = true; o.why = 'Precisa de lâmina ou serra equipada.'; }
        else {
          const safe = D.tags.includes('amputacao_segura');
          o.sub = safe ? `${o.hours}h, 10 de dano. Para sempre.` : `${o.hours}h, 10–20 de dano, teste de VON. Para sempre.`;
        }
      } else if (T.item) {
        const n = countItem(hero, T.item);
        if (n <= 0) { o.disabled = true; o.why = `Sem ${itemDef(T.item)?.name || T.item}.`; }
        else o.sub = `${T.desc} (tem ${n})`;
      }
    }
    if (!o.disabled) {
      if (m === 'bandagem' && w.treated && !w.bleeding) { o.disabled = true; o.why = 'Já enfaixada.'; }
      if (m !== 'bandagem' && m !== 'amputar' && (w.treatedBy || []).includes(m) && !w.infected) { o.disabled = true; o.why = 'Já feito.'; }
    }
    out.push(o);
  }
  return out;
}

function hasCuttingTool(hero) {
  const d = itemDef(hero.equip?.main);
  return !!d && ['corte'].includes(d.dtype) || ['cutelo', 'machado', 'espada', 'adaga', 'montante', 'foice'].includes(d?.cls);
}

/** Tratamento no campo pela ficha: consome item/tempo e aplica. Retorna { ok, lines, hours }. */
export function fieldTreat(G, woundUid, method) {
  const opt = treatOptions(G, woundUid, { where: 'field' }).find((o) => o.method === method);
  if (!opt) return { ok: false, lines: [{ text: 'Indisponível.', kind: 'warn' }], hours: 0 };
  if (opt.disabled) return { ok: false, lines: [{ text: opt.why, kind: 'warn' }], hours: 0 };
  const hero = G.hero;
  if (method === 'cirurgia') removeItem(hero, 'bandagem', 1);
  else if (opt.item) removeItem(hero, opt.item, 1);
  const lines = treatWound(G, woundUid, method, { where: 'field' });
  return { ok: true, lines, hours: opt.hours || 0 };
}

/** Preço sugerido no barbeiro (D pode usar/ajustar). */
export function surgeonPrice(w, method, prosthetic) {
  const d = WOUNDS[w?.id];
  const sev = d?.sev || 1;
  const P = { bandagem: 4, unguento: 8, tala: 10, ferro_quente: 8, sal: 12, sanguessuga: 10, cirurgia: 15 + sev * 25, amputar: 35 };
  if (method === 'protese') return { gancho: 40, gancho_protese: 40, gancho_serrilhado: 220, perna_pau: 30, perna_ferro: 260, olho_vidro: 20, olho_icor: 400 }[prosthetic || 'gancho'] ?? 40;
  return (P[method] ?? 20) + (w?.infected ? 15 : 0);
}
/** Dias que o barbeiro leva (D avança o tempo). */
export function surgeonDays(w, method) {
  if (method === 'cirurgia') return WOUNDS[w?.id]?.sev >= 3 ? 2 : 1;
  if (method === 'amputar') return 2;
  if (method === 'protese') return 1;
  return 0;
}

/** Cura n feridas não permanentes (as mais leves primeiro); sem n = todas as não permanentes. */
export function healWounds(hero, n = null) {
  const list = (hero.wounds || []).filter((w) => WOUNDS[w.id]?.days >= 0 && w.id !== 'coto_aberto' || w.id === 'coto_aberto');
  const cand = list.filter((w) => WOUNDS[w.id]?.days >= 0).sort((a, b) => (WOUNDS[a.id].sev - WOUNDS[b.id].sev) || (a.days - b.days));
  const pick = n == null ? cand : cand.slice(0, n);
  for (const w of pick) hero.wounds.splice(hero.wounds.indexOf(w), 1);
  return pick.map((w) => WOUNDS[w.id].name);
}
