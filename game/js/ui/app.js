// Shell da interface: roteador de telas, HUD, dock inferior, modais, folhas, toasts.
//
// Layout (index.html -> #app):
//   <header.hud>   status do herói/tempo (renderizado por setHud(fn))
//   <main.screen>  conteúdo rolável da tela atual
//   <footer.dock>  ações principais ao alcance do polegar (preenchido pela tela via ctx.dock)
//
// Contrato de tela (ui/screens/*.js):
//   export default {
//     id: 'city',
//     hud: true,                 // mostrar HUD? (padrão true)
//     render(ctx) {...},         // ctx = { main, dock, params, refresh }
//     onEnter(params) {...},     // opcional
//     onExit() {...},            // opcional
//   }
// As telas redesenham do zero a cada render (simples e robusto). Use refresh() após mudar o estado.
import { h, clear, button } from './dom.js';
import { on, emit } from '../core/bus.js';

const screens = new Map();
let cur = null;        // { def, params }
let hudFn = null;
let els = null;
const stack = [];      // histórico simples para back()

export function registerScreen(def) { screens.set(def.id, def); }
export function hasScreen(id) { return screens.has(id); }
export const currentScreen = () => cur?.def.id;
export const currentParams = () => cur?.params;

export function mount(root) {
  clear(root);
  els = {
    root,
    hud: h('header.hud'),
    main: h('main.screen', { attrs: { tabindex: '-1' } }),
    dock: h('footer.dock'),
    layer: h('div.layer'),
    toasts: h('div.toasts', { attrs: { 'aria-live': 'polite' } }),
  };
  root.append(els.hud, els.main, els.dock, els.layer, els.toasts);
  on('render', () => refresh());
  on('toast', ({ text, kind }) => toastMsg(text, kind));
}

/** Define a função que desenha o HUD: fn(hudEl, screenId). */
export function setHud(fn) { hudFn = fn; }

/** Vai para outra tela. opts.replace = não empilhar no histórico. */
export function go(id, params = {}, opts = {}) {
  const def = screens.get(id);
  if (!def) { console.error('Tela inexistente:', id); toastMsg(`Tela indisponível: ${id}`, 'bad'); return; }
  if (cur) {
    try { cur.def.onExit?.(); } catch (e) { console.error(e); }
    if (!opts.replace) stack.push({ id: cur.def.id, params: cur.params });
    if (stack.length > 30) stack.shift();
  }
  closeAllLayers();
  cur = { def, params };
  try { def.onEnter?.(params); } catch (e) { reportError(e); }
  refresh({ scrollTop: true });
}

export function back(fallback = 'title') {
  const prev = stack.pop();
  if (prev) {
    // onExit da tela atual precisa rodar também ao voltar (antes cur=null o pulava)
    try { cur?.def.onExit?.(); } catch (e) { console.error(e); }
    cur = null;
    go(prev.id, prev.params, { replace: true });
  }
  else go(fallback, {}, { replace: true });
}

export function clearHistory() { stack.length = 0; }

/** Redesenha a tela atual preservando a rolagem (salvo opts.scrollTop). */
export function refresh(opts = {}) {
  if (!cur || !els) return;
  const top = opts.scrollTop ? 0 : els.main.scrollTop;
  const showHud = cur.def.hud !== false;
  els.hud.hidden = !showHud;
  els.root.classList.toggle('no-hud', !showHud);
  els.root.dataset.screen = cur.def.id;
  clear(els.main);
  clear(els.dock);
  try {
    if (showHud && hudFn) { clear(els.hud); hudFn(els.hud, cur.def.id); }
    cur.def.render({ main: els.main, dock: els.dock, params: cur.params, refresh });
  } catch (e) {
    reportError(e);
  }
  els.dock.hidden = !els.dock.firstChild;
  els.root.classList.toggle('has-dock', !!els.dock.firstChild);
  els.main.scrollTop = top;
}

export function scrollToBottom() { if (els) els.main.scrollTop = els.main.scrollHeight; }

// ---------------- camadas: modal / folha ----------------
let layers = [];

function closeAllLayers() { for (const l of [...layers]) l.close(); }

/**
 * modal({ title, body, buttons: [{label, kind, sub, onClick, keepOpen, disabled, why}], dismissable=true, cls })
 * body: Node | string | () => Node   — retorna { close, el, update(body) }
 */
export function modal({ title, body, buttons = [], dismissable = true, cls = '', sheet = false, onClose } = {}) {
  const box = h('div.modal', { class: `${sheet ? 'is-sheet' : ''} ${cls}`, attrs: { role: 'dialog', 'aria-modal': 'true' } });
  const back = h('div.modal-back', box);
  const content = h('div.modal-body');
  let closed = false;
  const api = {
    el: box,
    close() {
      if (closed) return;
      closed = true;
      back.classList.add('is-closing');
      setTimeout(() => back.remove(), 140);
      layers = layers.filter((l) => l !== api);
      try { onClose?.(); } catch (e) { console.error(e); }
    },
    update(b) { clear(content); content.append(typeof b === 'function' ? b() : (b instanceof Node ? b : h('div.prose', h('p', String(b ?? ''))))); },
  };
  if (title) box.append(h('div.modal-head', h('h2.modal-title', title),
    dismissable ? button('✕', () => api.close(), { kind: ['ghost', 'icon'], title: 'Fechar' }) : null));
  box.append(content);
  api.update(body);
  if (buttons.length) {
    box.append(h('div.modal-actions', buttons.map((b) => button(b.label, () => {
      if (!b.keepOpen) api.close();
      b.onClick?.();
    }, { kind: b.kind, sub: b.sub, disabled: b.disabled, why: b.why }))));
  }
  if (dismissable) back.addEventListener('click', (e) => { if (e.target === back) api.close(); });
  els.layer.append(back);
  layers.push(api);
  return api;
}

/** Folha inferior (ideal para listas de ações/detalhes). Mesmo contrato do modal. */
export const sheet = (o) => modal({ ...o, sheet: true });

/** Confirmação: resolve true/false. */
export function confirmBox(text, { title = 'Confirmar', yes = 'Sim', no = 'Cancelar', danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    modal({
      title, body: text,
      onClose: () => { if (!answered) resolve(false); },
      buttons: [
        { label: no, kind: 'ghost', onClick: () => { answered = true; resolve(false); } },
        { label: yes, kind: danger ? 'danger' : 'primary', onClick: () => { answered = true; resolve(true); } },
      ],
    });
  });
}

/** Mensagem rápida. kind: info|good|bad|warn */
export function toastMsg(text, kind = 'info', ms = 2600) {
  if (!els) return;
  const t = h('div.toast', { class: `toast-${kind}` }, text);
  els.toasts.append(t);
  while (els.toasts.children.length > 3) els.toasts.firstChild.remove();
  setTimeout(() => t.classList.add('is-out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

/** Erros não devem travar o jogo: mostra aviso e mantém o jogador num lugar seguro. */
export function reportError(e) {
  console.error(e);
  emit('error', e);
  if (!els) return;
  toastMsg(`Erro: ${e?.message || e}`, 'bad', 5000);
}

export const layoutEls = () => els;
