// Pequenos utilitários de DOM: criação de elementos, folhas (bottom sheets), diálogos e avisos.
import { sfx } from './audio.js';

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') {
        const ev = k.slice(2).toLowerCase();
        if (ev === 'tap') el.addEventListener('click', (e) => { sfx('tap'); v(e); });
        else el.addEventListener(ev, v);
      } else if (k === 'disabled') { if (v) el.setAttribute('disabled', ''); }
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  add(el, children);
  return el;
}

function add(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) add(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

let toastTimer = null;
export function toast(msg, ms = 2200, cls = '') {
  document.querySelectorAll('.toast:not(.update)').forEach((t) => t.remove());
  const t = h('div', { class: 'toast ' + cls, role: 'status' }, msg);
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
  return t;
}

const stack = [];
export function openSheet({ title, body, onClose, wide = false, centered = false }) {
  const ov = h('div', { class: 'overlay' + (centered ? ' centered' : '') });
  const close = () => {
    ov.remove();
    const i = stack.indexOf(close);
    if (i >= 0) stack.splice(i, 1);
    if (onClose) onClose();
  };
  const content = typeof body === 'function' ? body(close) : body;
  const sh = centered
    ? h('div', { class: 'dialog' }, title ? h('h2', null, title) : null, content)
    : h('div', { class: 'sheet' },
      h('div', { class: 'sh-head' }, h('h2', null, title || ''), h('button', { class: 'btn icon ghost', 'aria-label': 'Fechar', onTap: close }, '✕')),
      h('div', { class: 'scroll' }, content));
  ov.appendChild(sh);
  ov.addEventListener('click', (e) => { if (e.target === ov && !centered) close(); });
  document.body.appendChild(ov);
  stack.push(close);
  return close;
}

export function closeAllSheets() { while (stack.length) stack[stack.length - 1](); }
export function sheetOpen() { return stack.length > 0; }

export function confirmBox(text, okText = 'Confirmar', danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const close = openSheet({
      centered: true,
      body: (cl) => h('div', null,
        h('p', null, text),
        h('div', { class: 'row', style: { marginTop: '14px' } },
          h('button', { class: 'btn ghost', style: { flex: 1 }, onTap: () => { done = true; cl(); resolve(false); } }, 'Cancelar'),
          h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), style: { flex: 1 }, onTap: () => { done = true; cl(); resolve(true); } }, okText))),
      onClose: () => { if (!done) resolve(false); },
    });
    void close;
  });
}

export function alertBox(title, text, okText = 'Ok') {
  return new Promise((resolve) => {
    openSheet({
      centered: true, title,
      body: (cl) => h('div', null,
        ...(Array.isArray(text) ? text : [text]).map((t) => (t instanceof Node ? t : h('p', null, t))),
        h('button', { class: 'btn primary block', style: { marginTop: '14px' }, onTap: () => { cl(); } }, okText)),
      onClose: resolve,
    });
  });
}
