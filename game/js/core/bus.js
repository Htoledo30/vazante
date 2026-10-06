// Barramento de eventos mínimo (desacopla lógica e interface).
// Eventos conhecidos:
//   'render'            -> a UI deve redesenhar a tela atual
//   'toast'  {text, kind}  -> mensagem rápida ('info'|'good'|'bad'|'warn')
//   'sfx'    name       -> efeito sonoro (ver ui/audio.js)
//   'log'    {text, kind} -> linha no diário/registro da expedição
//   'saved'             -> save gravado
const handlers = new Map();

export function on(evt, fn) {
  if (!handlers.has(evt)) handlers.set(evt, new Set());
  handlers.get(evt).add(fn);
  return () => handlers.get(evt)?.delete(fn);
}

export function emit(evt, data) {
  const set = handlers.get(evt);
  if (!set) return;
  for (const fn of [...set]) {
    try { fn(data); } catch (e) { console.error(`[bus:${evt}]`, e); }
  }
}

export const toast = (text, kind = 'info') => emit('toast', { text, kind });
export const sfx = (name) => emit('sfx', name);
