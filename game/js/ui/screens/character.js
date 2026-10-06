// Telas de personagem (Área A): criação, ficha (abas), subir de nível, mutação, saque e folha de item.
import { h, button, bar, chip, section, kv, prose, grid, tabs, clear } from '../dom.js';
import { go, back, refresh, modal, sheet, toastMsg, currentScreen } from '../app.js';
import { getG } from '../../core/state.js';
import { save } from '../../core/save.js';
import { sfx } from '../../core/bus.js';
import { R } from '../../core/rng.js';
import * as flow from '../../systems/flow.js';
import * as CH from '../../systems/character.js';
import * as IT from '../../systems/items.js';
import * as WS from '../../systems/wounds.js';
import * as EX from '../../systems/expedition.js';
import * as TM from '../../systems/time.js';
import { randomName } from '../../systems/names.js';
import { BACKGROUND_LIST, BACKGROUNDS } from '../../data/backgrounds.js';
import { TALENTS, STYLES } from '../../data/talents.js';
import { MUTATIONS } from '../../data/mutations.js';
import { TRAITS } from '../../data/traits.js';
import { WOUNDS } from '../../data/wounds.js';
import { ITEMS, SLOT_NAMES, CLASS_NAMES, DTYPE_NAMES, QUALITY } from '../../data/items.js';
import { TECHNIQUES, CLASS_TECHNIQUES, MASTERY_THRESHOLDS, MASTERY_NAMES, masteryLevel } from '../../data/techniques.js';
import { helpButton, hintOnce } from '../help.js';

const ATTRS = CH.ATTRS;
const A_NAME = CH.ATTR_NAMES;
const A_SHORT = CH.ATTR_SHORT;
const KIND_CHIP = { good: 'good', bad: 'bad', warn: 'warn', info: 'info', ichor: 'warn', corr: 'corr', rot: 'rot', blood: 'blood', dread: 'bad' };

function linesEl(lines) {
  return h('div.ch-lines', (lines || []).filter((l) => l && l.text).map((l) => h('div.ch-line', { class: `t-${l.kind || 'info'}` }, l.text)));
}
function showLines(title, lines) {
  if (!lines?.length) return;
  modal({ title, body: linesEl(lines), buttons: [{ label: 'Ok', kind: 'primary' }] });
}

/** Passa horas no contexto atual (campo ou cidade). */
function spendHours(G, hours) {
  if (!(hours > 0)) return { lines: [], died: false };
  if (G.expedition) return EX.passHours(G, hours, { mode: 'work' });
  return { lines: TM.advanceTime(G, hours, { where: 'city' }) || [], died: false };
}

function inCombat(G) { return !!(G.combat && !G.combat.result); }

// =====================================================================================
// CRIAÇÃO
// =====================================================================================
const cs = { name: null, bg: null, attrs: null, sex: null, nameIdx: 0 };

function resetCreate(params = {}) {
  const B = BACKGROUNDS[params.bg] || BACKGROUND_LIST[0];
  cs.bg = B.id;
  cs.sex = B.sex || 'm';
  cs.name = params.name || randomName(R, cs.sex);
  cs.attrs = baseAttrs(B);
}
function baseAttrs(B) { const a = {}; for (const k of ATTRS) a[k] = 3 + (B.attrs[k] || 0); return a; }
function spent() {
  const B = BACKGROUNDS[cs.bg];
  const base = baseAttrs(B);
  return ATTRS.reduce((s, k) => s + (cs.attrs[k] - base[k]), 0);
}

function previewHero() {
  return CH.createHero({ name: cs.name, bg: cs.bg, attrs: cs.attrs, sex: cs.sex });
}

const createScreen = {
  id: 'create',
  hud: false,
  onEnter(params) { if (!cs.bg || params?.fresh) resetCreate(params || {}); },
  render({ main, dock }) {
    const G = getG();
    if (!G) { main.append(prose('Nenhuma campanha.')); dock.append(button('Voltar', () => go('title'), { kind: 'wide' })); return; }
    if (!cs.bg) resetCreate();
    const B = BACKGROUNDS[cs.bg];
    const left = CH.CREATE_POINTS - spent();
    main.append(h('h1.ch-title', 'Quem entra no Ermo'));
    main.append(h('p.muted.small', `Casa ${G.lineage?.house || ''} · ${G.lineage?.generation || 1}ª geração`));

    // nome
    main.append(section('Nome',
      h('div.row',
        h('input.ch-name-input', { type: 'text', value: cs.name, maxLength: 20, attrs: { 'aria-label': 'Nome', autocomplete: 'off', autocapitalize: 'words' },
          on: { change: (e) => { cs.name = String(e.target.value || '').replace(/[<>]/g, '').trim().slice(0, 20) || cs.name; } } }),
        button('⟳', () => { cs.name = randomName(R, cs.sex); refresh(); }, { kind: ['ghost'], title: 'Sortear nome' }),
        button(cs.sex === 'f' ? '♀' : '♂', () => { cs.sex = cs.sex === 'f' ? 'm' : 'f'; cs.name = randomName(R, cs.sex); refresh(); }, { kind: ['ghost'], title: 'Trocar' })),
    ));

    // origem
    const cards = h('div.ch-bg-list', BACKGROUND_LIST.map((b) => {
      const sel = b.id === cs.bg;
      const t = TRAITS[b.trait];
      const el = h('button.ch-bg-card', { type: 'button', class: sel ? 'is-selected' : '',
        on: { click: () => { if (cs.bg !== b.id) { cs.bg = b.id; cs.attrs = baseAttrs(b); if (b.sex && b.sex !== cs.sex) { cs.sex = b.sex; cs.name = randomName(R, cs.sex); } sfx('tap'); refresh(); } } } },
        h('div.ch-bg-name', b.name),
        h('div.ch-bg-short', b.short),
        sel ? h('div.ch-bg-more',
          h('div.small', b.style || ''),
          h('div.small.t-info', `Atributos: ${Object.entries(b.attrs).map(([k, v]) => `${A_SHORT[k]} +${v}`).join(', ')}`),
          t ? h('div.small.t-ichor', `Traço: ${t.name} — ${t.desc}`) : null,
          h('div.small.muted', `Kit: ${(b.kit.equip || []).map(([id]) => ITEMS[id]?.name || id).join(', ')}; ${(b.kit.inv || []).map(([id, n]) => `${n}× ${ITEMS[id]?.name || id}`).join(', ')}; ${b.kit.coin || 0} moedas${b.kit.ichor ? `, ${b.kit.ichor} Icor` : ''}.`)) : null);
      return el;
    }));
    main.append(section('Origem', cards));

    // atributos
    const rows = ATTRS.map((k) => {
      const base = 3 + (B.attrs[k] || 0);
      const v = cs.attrs[k];
      return h('div.ch-attr-row',
        h('div.ch-attr-label', h('b', A_SHORT[k]), h('span.small.muted', ` ${A_NAME[k]}`), h('div.small.muted', CH.ATTR_DESC[k])),
        button('−', () => { if (cs.attrs[k] > base) { cs.attrs[k]--; refresh(); } }, { kind: ['ghost'], disabled: v <= base, why: 'Mínimo da origem.' }),
        h('div.ch-attr-val', String(v)),
        button('+', () => { if (left > 0 && v < CH.CREATE_MAX) { cs.attrs[k]++; refresh(); } }, { kind: ['ghost'], disabled: left <= 0 || v >= CH.CREATE_MAX, why: left <= 0 ? 'Sem pontos.' : `Máximo ${CH.CREATE_MAX} na criação.` }));
    });
    main.append(section(`Atributos · ${left} ponto(s) livre(s)`, ...rows));

    // prévia
    let D = null;
    try { D = CH.derive(previewHero()); } catch (e) { console.error(e); }
    if (D) {
      main.append(section('Como você chega ao Ermo',
        grid([
          kv('Vida', D.hpMax), kv('Fôlego', `${D.staminaMax} (+${D.staminaRegen}/turno)`),
          kv('Precisão', D.acc), kv('Esquiva', D.eva),
          kv('Carga', `${D.load}/${D.carryMax}`), kv('Crítico', `${D.crit}%`),
          kv('Resist. Pavor', `${D.dreadResist}%`), kv('Resist. Corrupção', `${D.corrResist}%`),
          kv('Arma', `${D.weapon.def?.name || 'Punhos'} ${D.weapon.dmg[0]}–${D.weapon.dmg[1]}`), kv('Lê intenções', ['vago', 'parcial', 'exato'][D.intentDetail]),
        ], 2)));
    }
    dock.append(h('div.dock-row',
      button('Voltar', () => go(G.hero ? 'city' : 'title'), { kind: 'ghost' }),
      button(left > 0 ? `Entrar (${left} pts sobrando)` : 'Entrar no Ermo', () => finishCreate(), { kind: 'primary' })));
    hintOnce('inicio');
  },
};

function finishCreate() {
  const G = getG();
  const hero = CH.createHero({ name: cs.name, bg: cs.bg, attrs: cs.attrs, sex: cs.sex, gen: G.lineage?.generation || 1 });
  G.hero = hero;
  const lines = CH.initHeroInWorld(G);
  cs.bg = null;
  save();
  sfx('bell');
  flow.heroCreated();
  if (lines?.length) setTimeout(() => showLines('Sua origem pesa', lines), 300);
}

// =====================================================================================
// FICHA
// =====================================================================================
let sheetTab = 'status';

const sheetScreen = {
  id: 'sheet',
  onEnter(params) { if (params?.tab) sheetTab = params.tab; },
  render({ main, dock }) {
    const G = getG();
    const hero = G?.hero;
    if (!hero) { main.append(prose('Sem herói.')); dock.append(button('Voltar', () => back('city'), { kind: 'wide' })); return; }
    const { D, st } = CH.heroStatus(hero);
    const B = BACKGROUNDS[hero.bg];
    main.append(h('div.ch-head',
      h('div', h('h2.ch-hname', hero.name), h('div.small.muted', `${B?.name || ''} · nível ${hero.level} · ${hero.gen || 1}ª geração da Casa ${G.lineage?.house || ''}`)),
      h('div.row.row-wrap', st.map(([t, k]) => chip(t, k)))));
    const wN = (hero.wounds || []).length;
    main.append(tabs([
      { id: 'status', label: 'Status' }, { id: 'equip', label: 'Equipado' }, { id: 'inv', label: 'Mochila', badge: (hero.inv || []).length || null },
      { id: 'corpo', label: 'Corpo', badge: wN || null }, { id: 'dadivas', label: 'Dádivas', badge: (hero.mutationPending || 0) > 0 ? '!' : null },
      { id: 'tecnicas', label: 'Técnicas' },
    ], sheetTab, (id) => { sheetTab = id; refresh({ scrollTop: true }); }));
    const T = { status: tabStatus, equip: tabEquip, inv: tabInv, corpo: tabCorpo, dadivas: tabDadivas, tecnicas: tabTecnicas }[sheetTab] || tabStatus;
    T(main, G, hero, D);
    const row = h('div.dock-row', button('Voltar', () => back(G.expedition ? 'map' : 'city'), { kind: 'ghost' }));
    if (CH.canLevelUp(hero) && !inCombat(G)) row.append(button('Beber Icor (nível)', () => go('levelup'), { kind: 'blood' }));
    if ((hero.mutationPending || 0) > 0 && !inCombat(G)) row.append(button('Mutação!', () => go('mutation'), { kind: 'blood' }));
    dock.append(row);
  },
};

function tabStatus(main, G, hero, D) {
  const lvCost = CH.levelUpCost(hero);
  main.append(section('Recursos',
    h('div.stack',
      h('div', h('div.small', `Vida ${hero.hp}/${D.hpMax}`), bar(hero.hp, D.hpMax, 'hp')),
      h('div', h('div.small', h('span', `Pavor ${hero.dread || 0}/100 `), helpButton('pavor')), bar(hero.dread || 0, 100, 'dread')),
      h('div', h('div.small', h('span', `Corrupção ${hero.corruption || 0}/100 `), helpButton('corrupcao')), bar(hero.corruption || 0, 100, 'corr')),
      h('div', h('div.small', h('span', `Icor ${hero.ichor || 0} · próximo nível: ${lvCost.ichor} frascos, +${lvCost.corruption} Corrupção `), helpButton('nivel')), bar(Math.min(hero.ichor || 0, lvCost.ichor), lvCost.ichor, 'xp')),
      kv('Moedas', hero.coin || 0), kv('Fome', hero.hunger > 24 ? 'Faminto' : hero.hunger > 12 ? 'Com fome' : 'Alimentado'))));
  main.append(section('Atributos', ...ATTRS.map((k) => {
    const base = hero.attrs[k];
    const eff = D.attrs[k];
    return kv(`${A_SHORT[k]} · ${A_NAME[k]}`, eff !== base ? `${eff} (base ${base})` : `${eff}`, eff > base ? 'good' : eff < base ? 'bad' : '');
  })));
  main.append(section('Combate',
    grid([
      kv('Precisão', D.acc), kv('Esquiva', D.eva), kv('Crítico', `${D.crit}%`), kv('Velocidade', `${D.speed > 0 ? '+' : ''}${D.speed}%`),
      kv('Fôlego', `${D.staminaMax} (+${D.staminaRegen})`), kv('Lê intenções', ['vago', 'parcial', 'exato'][D.intentDetail]),
      kv('Carga', `${D.load}/${D.carryMax}`, D.overloaded ? 'bad' : ''), kv('Armadura (tronco)', `${D.armor.tronco.corte}/${D.armor.tronco.perf}/${D.armor.tronco.impacto}`),
    ], 2),
    h('div.small.muted', 'Armadura: corte / perfuração / impacto.')));
  main.append(section('Resistências',
    grid([kv('Pavor', `${D.dreadResist}%`), kv('Corrupção', `${D.corrResist}%`), kv('Sangramento', `${D.bleedResist}%`), kv('Infecção', `${D.infectResist}%`), kv('Fogo', `${D.fireResist}%`), kv('Veneno', `${D.poisonResist}%`)], 2)));
  main.append(section('Registro', grid([kv('Mortes', hero.stats?.kills || 0), kv('Execuções', hero.stats?.executions || 0), kv('Membros decepados', hero.stats?.severed || 0), kv('Expedições', hero.stats?.expeditions || 0)], 2)));
  if (hero.companion) {
    const c = hero.companion;
    main.append(section('Sequaz', kv(c.name, `${c.hp}/${c.hpMax} · ordem: ${c.order}`)));
  }
}

const SLOT_ORDER = ['main', 'off', 'cabeca', 'tronco', 'bracos', 'pernas', 'amuleto1', 'amuleto2'];

function tabEquip(main, G, hero, D) {
  const list = h('div.ch-slots', SLOT_ORDER.map((s) => {
    const inst = hero.equip?.[s];
    const def = inst ? IT.itemDef(inst) : null;
    let sub = '';
    if (def?.type === 'weapon') sub = `${D.weapon.inst === inst ? `${D.weapon.dmg[0]}–${D.weapon.dmg[1]} ${DTYPE_NAMES[def.dtype] || ''}` : `${def.dmg[0]}–${def.dmg[1]}`}`;
    else if (def?.armor) sub = `${def.armor.corte}/${def.armor.perf}/${def.armor.impacto}`;
    else if (def?.kind === 'shield') sub = `bloqueio ${D.offhand.block || def.block}%`;
    if (inst && inst.dur != null) sub += ` · ${inst.dur}/${IT.maxDur(inst)}`;
    return button(inst ? IT.itemName(inst) : '— vazio —', inst ? () => itemSheet(inst.uid) : null,
      { kind: ['left', inst ? '' : 'ghost'].filter(Boolean), sub: `${SLOT_NAMES[s]}${sub ? ` · ${sub}` : ''}`, disabled: !inst, why: 'Nada aqui. Equipe pela Mochila.' });
  }));
  main.append(section('Equipamento', list));
  const pr = hero.prosthetics || {};
  const prs = Object.entries(pr).filter(([, v]) => v);
  if (prs.length) main.append(section('Próteses', ...prs.map(([k, v]) => kv(WS.PART_NAMES[k] || k, IT.prostheticDef(v)?.name || v))));
  if (D.weapon.unusable) main.append(h('div.panel.t-bad', `Arma inutilizável: ${D.weapon.unusable}`));
  if (D.weapon.reqFail) main.append(h('div.panel.t-warn', 'Você não tem força/destreza para essa arma: −15 precisão, +2 Fôlego por golpe.'));
}

function tabInv(main, G, hero, D) {
  const inv = hero.inv || [];
  main.append(h('div.ch-load', h('span.small', `Carga ${D.load}/${D.carryMax}`), bar(D.load, D.carryMax, D.overloaded ? 'dread' : 'stam'), helpButton('peso')));
  if (!inv.length) { main.append(h('p.muted', 'Mochila vazia.')); return; }
  const groups = [['weapon', 'Armas'], ['armor', 'Armaduras'], ['offhand', 'Mão secundária'], ['trinket', 'Amuletos'], ['consumable', 'Consumíveis'], ['ammo', 'Munição'], ['material', 'Materiais'], ['prosthetic', 'Próteses'], ['tome', 'Tomos'], ['key', 'Chaves e relíquias']];
  for (const [type, label] of groups) {
    const items = inv.filter((i) => IT.itemDef(i)?.type === type);
    if (!items.length) continue;
    main.append(section(label, h('div.stack', items.map((i) => {
      const def = IT.itemDef(i);
      const sub = [`${Math.round(IT.weightOf(i) * 10) / 10} peso`, def.use?.field ? 'usável' : null, i.dur != null ? `${i.dur}/${IT.maxDur(i)}` : null].filter(Boolean).join(' · ');
      return button(`${IT.itemName(i)}${(i.n || 1) > 1 ? ` ×${i.n}` : ''}`, () => itemSheet(i.uid), { kind: 'left', sub });
    }))));
  }
}

function tabCorpo(main, G, hero) {
  const ws = hero.wounds || [];
  main.append(h('p.small.muted', 'Feridas curam com dias. Tratar ajuda; algumas precisam do barbeiro. ', helpButton('feridas')));
  if (!ws.length) main.append(h('div.panel', 'Nenhuma ferida. Por enquanto.'));
  for (const w of ws) {
    const d = WS.describeWound(w);
    const opts = WS.treatOptions(G, w.uid, { where: 'field' });
    const flags = [];
    if (d.bleeding) flags.push(chip('sangrando', 'blood'));
    if (d.infected) flags.push(chip('infeccionada', 'rot'));
    if (d.treated) flags.push(chip('tratada', 'good'));
    if (d.permanent) flags.push(chip('permanente', 'bad'));
    if (d.needs) flags.push(chip(`precisa: ${d.needs}`, 'warn'));
    main.append(h('div.panel.ch-wound',
      h('div.row', h('b', d.name), h('span.spacer'), h('span.small.muted', d.partName)),
      h('div.small', d.desc || ''),
      d.effect ? h('div.small.t-bad', d.effect) : null,
      h('div.small.muted', d.permanent ? 'Não cura sozinha.' : `Cura em ~${d.days} dia(s).`),
      h('div.row.row-wrap', flags),
      inCombat(G) ? null : h('div.grid.grid-2', opts.filter((o) => o.method !== 'protese').map((o) => button(o.label, async () => {
        if (o.method === 'amputar') {
          const ok = await import('./shell.js').then((m) => m.confirmRisky(`Amputar ${d.partName.toLowerCase()}? Para sempre.`, { title: 'Amputar' }));
          if (!ok) return;
        }
        const r = WS.fieldTreat(G, w.uid, o.method);
        const lines = [...(r.lines || [])];
        if (r.ok && r.hours) { const t = spendHours(G, r.hours); lines.push(...(t.lines || [])); }
        save();
        refresh();
        showLines('Tratamento', lines);
      }, { kind: ['small'], disabled: o.disabled, why: o.why, sub: o.disabled ? undefined : o.sub }))),
    ));
  }
  const D = CH.derive(hero);
  if (D.lostParts.length) main.append(section('Perdas', ...D.lostParts.map((p) => kv(WS.PART_NAMES[p] || p, hero.prosthetics?.[p === 'olho' ? 'cabeca' : p] ? `prótese: ${IT.prostheticDef(hero.prosthetics[p === 'olho' ? 'cabeca' : p])?.name}` : 'perdido', 'bad'))));
}

function tabDadivas(main, G, hero) {
  if ((hero.mutationPending || 0) > 0) main.append(h('div.panel.ch-alert', h('b.t-corr', 'A carne está mudando.'), ' ', button('Escolher mutação', () => go('mutation'), { kind: ['blood', 'small'] })));
  main.append(section('Dádivas', ...(hero.talents.length ? hero.talents.map((id) => {
    const t = TALENTS[id];
    return h('div.ch-entry', h('b', t?.name || id), h('span.small.muted', ` · ${STYLES[t?.style] || ''}`), h('div.small', t?.desc || ''));
  }) : [h('p.small.muted', 'Nenhuma. Beba Icor para subir de nível e escolher.')])));
  main.append(section('Mutações', ...(hero.mutations.length ? hero.mutations.map((id) => {
    const m = MUTATIONS[id];
    return h('div.ch-entry', h('b.t-corr', m?.name || id), h('div.small', m?.desc || ''), h('div.small.muted', m?.look || ''));
  }) : [h('p.small.muted', 'Nenhuma. Ainda.')])));
  main.append(section('Traços', ...(hero.traits.length ? hero.traits.map((id) => {
    const t = TRAITS[id];
    const k = t?.good === true ? 'good' : t?.good === false ? 'bad' : 'warn';
    return h('div.ch-entry', h('b', { class: `t-${k}` }, t?.name || id), h('div.small', t?.desc || ''));
  }) : [h('p.small.muted', 'Nenhum.')])));
}

function tabTecnicas(main, G, hero) {
  const D = CH.derive(hero);
  const cls = D.weapon.cls || 'desarmado';
  main.append(h('p.small.muted', 'Usar uma classe de arma acumula maestria; cada nível libera técnicas. ', helpButton('maestria')));
  const classes = Object.keys(CLASS_TECHNIQUES).filter((k) => k !== 'geral');
  const known = classes.filter((k) => (hero.mastery?.[k] || 0) > 0 || k === cls);
  for (const k of known) {
    const uses = hero.mastery?.[k] || 0;
    const lv = masteryLevel(uses);
    const next = MASTERY_THRESHOLDS[lv + 1];
    main.append(section(`${CLASS_NAMES[k] || k} · ${MASTERY_NAMES[lv]}${k === cls ? ' (em mãos)' : ''}`,
      next ? h('div', h('div.small.muted', `${uses}/${next} para o próximo nível`), bar(uses, next, 'xp')) : h('div.small.t-good', 'Maestria completa.'),
      ...(CLASS_TECHNIQUES[k] || []).map((id) => {
        const t = TECHNIQUES[id];
        const ok = t.mastery <= lv;
        return h('div.ch-entry', { class: ok ? '' : 'is-locked' }, h('b', ok ? t.name : `🔒 ${t.name}`), h('span.small.muted', ` · ${MASTERY_NAMES[t.mastery]}`), h('div.small', t.desc));
      })));
  }
  const learned = (hero.techniques || []).filter((id) => TECHNIQUES[id]);
  if (learned.length) main.append(section('Aprendidas', ...learned.map((id) => h('div.ch-entry', h('b', TECHNIQUES[id].name), h('div.small', TECHNIQUES[id].desc)))));
  main.append(section('Gerais', ...(CLASS_TECHNIQUES.geral || []).filter((id) => !TECHNIQUES[id].tome).map((id) => h('div.ch-entry', h('b', TECHNIQUES[id].name), h('div.small', TECHNIQUES[id].desc)))));
}

// =====================================================================================
// FOLHA DE ITEM
// =====================================================================================
function compareLines(hero, inst) {
  const def = IT.itemDef(inst);
  if (!def) return [];
  const slot = IT.slotFor(def, hero);
  const cur = slot ? hero.equip?.[slot] : null;
  if (!cur || cur.uid === inst.uid) return [];
  const cd = IT.itemDef(cur);
  const out = [];
  const q = (i) => QUALITY[i.q ?? 1]?.mult || 1;
  if (def.dmg && cd?.dmg) {
    const a = Math.round(((def.dmg[0] + def.dmg[1]) / 2) * q(inst));
    const b = Math.round(((cd.dmg[0] + cd.dmg[1]) / 2) * q(cur));
    out.push({ text: `Dano médio base ${a} vs ${b} (${IT.itemName(cur)})`, kind: a > b ? 'good' : a < b ? 'bad' : '' });
    if (def.time !== cd.time) out.push({ text: `Tempo ${def.time} vs ${cd.time}`, kind: def.time < cd.time ? 'good' : 'bad' });
  }
  if (def.armor && cd?.armor) {
    const s = (d, i) => Math.round((d.armor.corte + d.armor.perf + d.armor.impacto) * q(i));
    const a = s(def, inst), b = s(cd, cur);
    out.push({ text: `Armadura total ${a} vs ${b} (${IT.itemName(cur)})`, kind: a > b ? 'good' : a < b ? 'bad' : '' });
    if ((def.heavy || 0) !== (cd.heavy || 0)) out.push({ text: `Peso de armadura ${def.heavy || 0} vs ${cd.heavy || 0}`, kind: (def.heavy || 0) < (cd.heavy || 0) ? 'good' : 'bad' });
  }
  return out;
}

export function itemSheet(uid, opts = {}) {
  const G = getG();
  const hero = G.hero;
  const f = IT.findInst(hero, uid);
  if (!f) { toastMsg('Item não encontrado.', 'warn'); return; }
  const inst = f.inst;
  const def = IT.itemDef(inst);
  const buttons = [];
  const after = (res, title) => {
    save();
    refresh();
    if (res?.lines?.length) showLines(title || def.name, res.lines);
    if (res?.pending?.length) handlePending(G, res.pending);
  };
  if (!inCombat(G)) {
    if (f.where === 'inv') {
      if (['weapon', 'armor', 'offhand', 'trinket', 'prosthetic'].includes(def.type)) {
        const chk = IT.canEquip(hero, uid);
        buttons.push({ label: def.type === 'prosthetic' ? 'Encaixar' : 'Equipar', kind: 'primary', disabled: !chk.ok, why: chk.reason, onClick: () => { const r = IT.equip(hero, uid); if (!r.ok) toastMsg(r.reason, 'warn'); else sfx('tap'); save(); refresh(); } });
        if (def.type === 'weapon' && (def.props?.includes('leve') || def.cls === 'adaga') && def.hands !== 2) {
          const c2 = IT.canEquip(hero, uid, 'off');
          buttons.push({ label: 'Na outra mão', disabled: !c2.ok, why: c2.reason, onClick: () => { const r = IT.equip(hero, uid, 'off'); if (!r.ok) toastMsg(r.reason, 'warn'); save(); refresh(); } });
        }
      }
      if (def.type === 'consumable' || def.type === 'tome') {
        const cu = IT.canUseItem(G, inst);
        buttons.push({ label: def.type === 'tome' ? 'Estudar' : 'Usar', kind: 'primary', disabled: !cu.ok, why: cu.reason, onClick: () => {
          const r = IT.useItem(G, uid);
          if (!r.ok) { toastMsg(r.reason || 'Não deu.', 'warn'); return; }
          sfx(def.id === 'aguardente' ? 'ichor' : 'heal');
          after(r, def.name);
        } });
      }
      if (!def.quest) buttons.push({ label: 'Largar', kind: 'danger', onClick: async () => {
        const ok = await import('./shell.js').then((m) => m.confirmRisky(`Largar ${IT.itemName(inst)}${(inst.n || 1) > 1 ? ` (×${inst.n})` : ''}? Fica para trás.`, { title: 'Largar' }));
        if (!ok) return;
        IT.removeInst(hero, uid);
        save(); refresh();
      } });
    } else {
      const r = { label: 'Desequipar', kind: 'ghost', onClick: () => { const x = IT.unequip(hero, f.where); if (!x.ok) toastMsg(x.reason, 'warn'); save(); refresh(); } };
      if (IT.isCursed(inst)) { r.disabled = true; r.why = 'Maldita: não sai da mão.'; }
      buttons.push(r);
    }
  }
  buttons.push({ label: 'Fechar', kind: 'ghost' });
  const cmp = compareLines(hero, inst);
  sheet({
    title: IT.itemName(inst),
    body: h('div', h('div.ch-item-lines', IT.describeItem(inst).map((l) => h('div.small', l))), cmp.length ? h('div.ch-compare', h('div.small.muted', 'Comparado ao equipado:'), linesEl(cmp)) : null),
    buttons,
  });
}

function handlePending(G, pending) {
  const death = pending.find((p) => p.type === 'death');
  if (death && !death.handled) { flow.heroDied(death.cause || 'Morte', {}); return; }
  if (pending.some((p) => p.type === 'loot') && G.pendingLoot) go('loot');
}

// =====================================================================================
// SUBIR DE NÍVEL
// =====================================================================================
const lv = { attr: null, talent: null };
const levelupScreen = {
  id: 'levelup',
  onEnter() { lv.attr = null; lv.talent = null; },
  render({ main, dock }) {
    const G = getG();
    const hero = G?.hero;
    if (!hero) { dock.append(button('Voltar', () => back('city'), { kind: 'wide' })); return; }
    const cost = CH.levelUpCost(hero);
    const blocker = CH.levelUpBlocker(hero);
    const offer = CH.ensureLevelOffer(hero);
    main.append(h('h2', `Beber o deus — nível ${hero.level + 1}`));
    main.append(prose(`Custa ${cost.ichor} frascos de Icor (você tem ${hero.ichor || 0}) e +${cost.corruption} de Corrupção (agora ${hero.corruption || 0}/100). A cada 25 de Corrupção, a carne muda.`));
    if ((hero.corruption || 0) + cost.corruption >= 100) main.append(h('div.panel.t-bad', 'ISSO VAI TE MATAR. A Corrupção chega a 100.'));
    else if (Math.floor(((hero.corruption || 0) + cost.corruption) / 25) > Math.floor((hero.corruption || 0) / 25)) main.append(h('div.panel.t-corr', 'Você vai cruzar um limiar: uma mutação vem junto.'));
    main.append(section('+1 atributo', h('div.grid.grid-3', ATTRS.map((k) => button(`${A_SHORT[k]} ${hero.attrs[k]}`, () => { lv.attr = k; refresh(); },
      { kind: lv.attr === k ? 'primary' : '', sub: hero.attrs[k] >= CH.ATTR_MAX ? 'máx.' : `→ ${hero.attrs[k] + 1}`, disabled: hero.attrs[k] >= CH.ATTR_MAX, why: 'Máximo.' })))));
    main.append(section('Escolha uma dádiva', ...offer.talents.map((id) => {
      const t = TALENTS[id];
      const sel = lv.talent === id;
      return button(t.name, () => { lv.talent = id; refresh(); }, { kind: ['left', sel ? 'primary' : ''].filter(Boolean), sub: `${STYLES[t.style] || ''} · ${t.desc}` });
    })));
    dock.append(h('div.dock-row',
      button('Voltar', () => back('sheet'), { kind: 'ghost' }),
      button('Beber', async () => {
        if (!lv.attr || !lv.talent) { toastMsg('Escolha um atributo e uma dádiva.', 'warn'); return; }
        const ok = await import('./shell.js').then((m) => m.confirmRisky(`Beber ${cost.ichor} frascos de Icor? +${cost.corruption} Corrupção.`, { title: 'Beber o deus' }));
        if (!ok) return;
        const lines = CH.levelUp(hero, lv.attr, lv.talent);
        sfx('levelup');
        save();
        if (hero.flags?.dead) return; // transformação: o fluxo de morte assume
        go((hero.mutationPending || 0) > 0 ? 'mutation' : 'sheet', {}, { replace: true });
        showLines('O Icor desce queimando', lines);
      }, { kind: 'blood', disabled: !!blocker || !lv.attr || !lv.talent, why: blocker || 'Escolha atributo e dádiva.' })));
  },
};

// =====================================================================================
// MUTAÇÃO
// =====================================================================================
const mutationScreen = {
  id: 'mutation',
  render({ main, dock }) {
    const G = getG();
    const hero = G?.hero;
    if (!hero || (hero.mutationPending || 0) <= 0) {
      main.append(prose('Nada muda. Por ora.'));
      dock.append(button('Voltar', () => go(G?.expedition ? 'map' : 'city', {}, { replace: true }), { kind: 'wide' }));
      return;
    }
    const offer = CH.ensureMutationOffer(hero);
    save();
    main.append(h('h2.t-corr', 'A carne muda'));
    main.append(prose(`Corrupção ${hero.corruption}. O Icor reescreve você. Escolha o que cresce — os dois cobram.`));
    if (!offer?.length) {
      main.append(prose('Não há mais nada para mudar. Só para apodrecer.'));
      hero.mutationPending = 0;
    }
    for (const id of offer || []) {
      const m = MUTATIONS[id];
      main.append(h('div.panel.ch-mut',
        h('h3.t-corr', m.name), h('div', m.desc), h('div.small.muted', m.look),
        button(`Aceitar ${m.name}`, () => {
          const lines = CH.applyMutation(hero, id);
          sfx('corrupt');
          save();
          go(G.expedition ? 'map' : 'city', {}, { replace: true });
          showLines('Mutação', lines);
        }, { kind: ['blood', 'wide'] })));
    }
    hintOnce('corrupcao');
    if (!offer?.length) dock.append(button('Voltar', () => go(G.expedition ? 'map' : 'city', {}, { replace: true }), { kind: 'wide' }));
  },
};

// =====================================================================================
// SAQUE
// =====================================================================================
let lootSel = null;
const lootScreen = {
  id: 'loot',
  onEnter() { lootSel = null; },
  render({ main, dock }) {
    const G = getG();
    const pl = G?.pendingLoot;
    const hero = G?.hero;
    if (!pl || !hero) {
      main.append(prose('Nada para pegar.'));
      dock.append(button('Continuar', () => finishLoot(), { kind: ['primary', 'wide'] }));
      return;
    }
    const items = pl.items || [];
    if (!lootSel || lootSel.length !== items.length) lootSel = items.map(() => true);
    const D = CH.derive(hero);
    const addW = items.reduce((s, it, i) => s + (lootSel[i] ? IT.weightOf(it) : 0), 0);
    const newLoad = Math.round((D.load + addW) * 10) / 10;
    main.append(h('h2', pl.title || 'Saque'));
    if (pl.coin || pl.ichor) main.append(h('div.panel.ch-loot-money', pl.coin ? h('span', `◉ ${pl.coin} moedas`) : null, pl.ichor ? h('span.t-ichor', `⚱ ${pl.ichor} Icor`) : null, h('span.small.muted', ' (sem peso — vem junto)')));
    main.append(h('div.ch-load', h('span.small', `Carga depois: ${newLoad}/${D.carryMax}`), bar(newLoad, D.carryMax, newLoad > D.carryMax ? 'dread' : 'stam')));
    if (newLoad > D.carryMax) main.append(h('div.small.t-warn', 'Sobrecarregado: viagens mais lentas, menos Fôlego. Muito acima: não anda.'));
    if (!items.length) main.append(h('p.muted', 'Nenhum item.'));
    items.forEach((it, i) => {
      const def = IT.itemDef(it);
      const sel = lootSel[i];
      const cmp = def && ['weapon', 'armor', 'offhand'].includes(def.type) ? compareLines(hero, it) : [];
      main.append(h('div.ch-loot-row', { class: sel ? 'is-selected' : '' },
        button(`${sel ? '☑' : '☐'} ${IT.itemName(it)}${(it.n || 1) > 1 ? ` ×${it.n}` : ''}`, () => { lootSel[i] = !lootSel[i]; refresh(); },
          { kind: ['left'], sub: `${Math.round(IT.weightOf(it) * 10) / 10} peso · ${IT.itemValue(it)} moedas${cmp[0] ? ` · ${cmp[0].text}` : ''}` }),
        button('i', () => sheet({ title: IT.itemName(it), body: h('div', IT.describeItem(it).map((l) => h('div.small', l))), buttons: [{ label: 'Fechar', kind: 'ghost' }] }), { kind: ['ghost', 'small'], title: 'Detalhes' })));
    });
    dock.append(h('div.dock-row',
      button('Nada', () => { lootSel = items.map(() => false); refresh(); }, { kind: 'ghost' }),
      button('Tudo', () => { lootSel = items.map(() => true); refresh(); }, { kind: 'ghost' }),
      button('Pegar', () => takeLoot(), { kind: 'primary' })));
    hintOnce('itens');
  },
};

function takeLoot() {
  const G = getG();
  const pl = G.pendingLoot;
  const hero = G.hero;
  if (pl && hero) {
    (pl.items || []).forEach((it, i) => { if (lootSel?.[i] !== false) IT.addItem(hero, it); });
    if (pl.coin) hero.coin = (hero.coin || 0) + pl.coin;
    if (pl.ichor) hero.ichor = (hero.ichor || 0) + pl.ichor;
    if (pl.coin) sfx('coin');
    if (pl.ichor) sfx('ichor');
    pl.items = []; pl.coin = 0; pl.ichor = 0;
  }
  finishLoot();
}

function finishLoot() {
  const G = getG();
  lootSel = null;
  const pl = G?.pendingLoot;
  save();
  if (!pl) { go(G?.expedition ? 'map' : 'city', {}, { replace: true }); return; }
  const before = currentScreen();
  flow.lootDone();
  if (G.pendingLoot === pl) G.pendingLoot = null;
  save();
  // nenhum gancho navegou? volta para um lugar seguro
  if (currentScreen() === before && before === 'loot') go(G.expedition ? 'map' : 'city', {}, { replace: true });
}

// =====================================================================================
export default [createScreen, sheetScreen, levelupScreen, mutationScreen, lootScreen];

export function init() {}
