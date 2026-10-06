// Mini-framework de DOM: h() cria elementos com segurança (textContent), mais componentes comuns.
// Todos os componentes são pensados para TOQUE: alvos >= 44px, sem hover.
import { sfx } from '../core/bus.js';

/**
 * h('div.classe#id', {props}, ...filhos)
 * props: class, style (obj|string), on: {click: fn}, data: {k: v}, attrs: {k: v}, html (innerHTML confiável), e qualquer propriedade DOM.
 * filhos: string | number | Node | array | null/false (ignorados)
 */
export function h(sel, props, ...kids) {
  if (props instanceof Node || typeof props === 'string' || typeof props === 'number' || Array.isArray(props)) {
    kids.unshift(props);
    props = null;
  }
  const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(sel) || [];
  const el = document.createElement(m[1] || 'div');
  for (const part of (m[2] || '').match(/[.#][\w-]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1));
    else el.id = part.slice(1);
  }
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') String(v).split(/\s+/).filter(Boolean).forEach((c) => el.classList.add(c));
      else if (k === 'style') { if (typeof v === 'string') el.style.cssText = v; else Object.assign(el.style, v); }
      else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
      else if (k === 'data') for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
      else if (k === 'attrs') for (const [ak, av] of Object.entries(v)) el.setAttribute(ak, av);
      else if (k === 'html') el.innerHTML = v;
      else el[k] = v;
    }
  }
  append(el, kids);
  return el;
}

export function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false || k === true) continue;
    el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}

export function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; }

/** Evita toque duplo acidental (ex.: dois ataques num toque rápido). */
let lastTap = 0;
function guardTap(fn) {
  return (e) => {
    const now = performance.now();
    if (now - lastTap < 180) { e.preventDefault(); return; }
    lastTap = now;
    fn(e);
  };
}

/**
 * Botão padrão.
 * opts: kind ('primary'|'danger'|'ghost'|'blood'|'small'|'wide'), disabled, sub (linha secundária: custo/chance),
 *       why (texto explicando por que está desabilitado — mostrado como sub e ao tocar), icon, badge, sound
 */
export function button(label, onClick, opts = {}) {
  const kinds = [].concat(opts.kind || []).map((k) => `btn-${k}`).join(' ');
  const b = h('button.btn', { class: kinds, type: 'button' },
    opts.icon ? h('span.btn-icon', { attrs: { 'aria-hidden': 'true' } }, opts.icon) : null,
    h('span.btn-body',
      h('span.btn-label', label),
      (opts.sub || (opts.disabled && opts.why)) ? h('span.btn-sub', opts.disabled && opts.why ? opts.why : opts.sub) : null),
    opts.badge != null ? h('span.btn-badge', String(opts.badge)) : null);
  if (opts.disabled) {
    b.classList.add('is-disabled');
    b.setAttribute('aria-disabled', 'true');
    b.addEventListener('click', guardTap(() => {
      sfx('deny');
      if (opts.why) import('./app.js').then((m) => m.toastMsg(opts.why, 'warn'));
    }));
  } else if (onClick) {
    b.addEventListener('click', guardTap((e) => { sfx(opts.sound || 'tap'); onClick(e); }));
  }
  if (opts.title) b.setAttribute('aria-label', opts.title);
  return b;
}

/** Barra de recurso: bar(valor, max, 'hp'|'stam'|'dread'|'corr'|'light'|'xp'|...) */
export function bar(value, max, kind = 'hp', label) {
  const p = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return h('div.bar', { class: `bar-${kind}`, attrs: { role: 'meter', 'aria-valuenow': String(value), 'aria-valuemax': String(max) } },
    h('div.bar-fill', { style: { width: `${p}%` } }),
    h('div.bar-text', label ?? `${Math.round(value)}/${Math.round(max)}`));
}

/** Etiqueta pequena (estado, tag, propriedade). kind: 'bad'|'good'|'warn'|'info'|'rot'|'blood' */
export function chip(text, kind = '', title) {
  const c = h('span.chip', { class: kind ? `chip-${kind}` : '' }, text);
  if (title) c.addEventListener('click', () => import('./app.js').then((m) => m.toastMsg(title, 'info')));
  return c;
}

export function section(title, ...kids) {
  return h('section.panel', title ? h('h3.panel-title', title) : null, ...kids);
}

/** Linha chave/valor */
export function kv(k, v, kind) {
  return h('div.kv', h('span.kv-k', k), h('span.kv-v', { class: kind ? `t-${kind}` : '' }, v));
}

/** Texto narrativo (parágrafos separados por \n\n). */
export function prose(text) {
  return h('div.prose', String(text || '').split(/\n\n+/).map((p) => h('p', p)));
}

/** Grade de botões (2 colunas por padrão). */
export function grid(kids, cols = 2) {
  return h('div.grid', { class: `grid-${cols}` }, kids);
}

/** Abas simples: tabs([{id,label}], activeId, onPick) */
export function tabs(list, active, onPick) {
  return h('div.tabs', { attrs: { role: 'tablist' } }, list.map((t) =>
    h('button.tab', {
      type: 'button', class: t.id === active ? 'is-active' : '',
      attrs: { role: 'tab', 'aria-selected': String(t.id === active) },
      on: { click: guardTap(() => { sfx('tap'); onPick(t.id); }) },
    }, t.label, t.badge ? h('span.tab-badge', String(t.badge)) : null)));
}

/** Vibração curta (onde suportado; iOS Safari ignora silenciosamente). Respeita Configurações → Vibração. */
let hapticsOn = true;
export function setHapticsEnabled(v) { hapticsOn = !!v; }
export function haptic(ms = 12) {
  if (!hapticsOn) return;
  try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms); } catch { /* ignore */ }
}
