// Salvamento no dispositivo (localStorage) com backup e verificação.
// Salve em pontos de controle (save()) — NÃO dependa só de fechar a página.
import { getG, setG, SAVE_VERSION } from './state.js';
import { emit } from './bus.js';

const KEY = 'icor.save.v1';
const BAK = 'icor.save.v1.bak';
const META = 'icor.meta';
const SETTINGS = 'icor.settings';

function checksum(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

function storage() {
  try { const s = window.localStorage; s.setItem('__t', '1'); s.removeItem('__t'); return s; }
  catch { return null; }
}

let memoryFallback = {};
const st = () => storage() || {
  getItem: (k) => memoryFallback[k] ?? null,
  setItem: (k, v) => { memoryFallback[k] = String(v); },
  removeItem: (k) => { delete memoryFallback[k]; },
};

let lastError = null;
export const saveError = () => lastError;

/** Grava o estado atual. Retorna true/false. */
export function save() {
  const G = getG();
  if (!G) return false;
  try {
    const body = JSON.stringify(G);
    const wrapped = JSON.stringify({ v: SAVE_VERSION, at: Date.now(), sum: checksum(body), body });
    const s = st();
    const prev = s.getItem(KEY);
    if (prev) s.setItem(BAK, prev);
    s.setItem(KEY, wrapped);
    lastError = null;
    emit('saved');
    return true;
  } catch (e) {
    lastError = e;
    console.error('Falha ao salvar', e);
    emit('toast', { text: 'Não foi possível salvar (armazenamento cheio ou bloqueado).', kind: 'bad' });
    return false;
  }
}

function parse(raw) {
  if (!raw) return null;
  try {
    const w = JSON.parse(raw);
    if (!w || typeof w.body !== 'string') return null;
    if (checksum(w.body) !== w.sum) return null;
    const g = JSON.parse(w.body);
    return migrate(g);
  } catch { return null; }
}

/** Migrações de versões antigas do save. */
function migrate(g) {
  if (!g || typeof g !== 'object') return null;
  // v1 é a primeira versão; futuras migrações entram aqui.
  return g;
}

/** Carrega o save (ou o backup, se o principal estiver corrompido). Define G. */
export function load() {
  const s = st();
  const g = parse(s.getItem(KEY)) || parse(s.getItem(BAK));
  if (g) setG(g);
  return g;
}

export function hasSave() {
  const s = st();
  return !!(parse(s.getItem(KEY)) || parse(s.getItem(BAK)));
}

export function wipe() {
  const s = st();
  s.removeItem(KEY); s.removeItem(BAK);
  setG(null);
}

/** Texto para copiar (backup manual). */
export function exportSave() {
  const G = getG();
  if (!G) return '';
  const json = JSON.stringify(G);
  return btoa(unescape(encodeURIComponent(json)));
}

export function importSave(text) {
  try {
    const json = decodeURIComponent(escape(atob(String(text).trim())));
    const g = migrate(JSON.parse(json));
    if (!g || !g.v || !g.city) throw new Error('save inválido');
    setG(g);
    save();
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

// ----- meta (entre campanhas) e configurações -----
function readJSON(key, def) {
  try { const v = st().getItem(key); return v ? { ...def, ...JSON.parse(v) } : { ...def }; }
  catch { return { ...def }; }
}
function writeJSON(key, val) { try { st().setItem(key, JSON.stringify(val)); } catch { /* ignore */ } }

export const DEFAULT_META = { campaigns: 0, endings: {}, unlocks: {}, bestDay: 0 };
export const loadMeta = () => readJSON(META, DEFAULT_META);
export const saveMeta = (m) => writeJSON(META, m);

export const DEFAULT_SETTINGS = { sound: true, music: true, volume: 0.7, textSpeed: 1, haptics: true, confirmDanger: true, seenHelp: {} };
export const loadSettings = () => readJSON(SETTINGS, DEFAULT_SETTINGS);
export const saveSettings = (s) => writeJSON(SETTINGS, s);
