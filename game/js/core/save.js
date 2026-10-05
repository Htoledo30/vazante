// Salvamento local (localStorage) com cópia de segurança e exportação/importação.
// O jogo salva a cada ação relevante — não depende do fechamento da página.
const KEY = 'vazante.save.v1';
const BAK = 'vazante.save.v1.bak';
const SETTINGS = 'vazante.settings.v1';
export const SAVE_VERSION = 1;

let lastError = null;
export const saveError = () => lastError;

function storage() {
  try { return window.localStorage; } catch (e) { return null; }
}

function stripTransient(run) {
  if (!run) return run;
  if (run.combat) return { ...run, combat: { ...run.combat, ev: [] } };
  return run;
}

export function saveGame(meta, run) {
  const ls = storage();
  if (!ls) { lastError = 'Armazenamento indisponível'; return false; }
  const data = JSON.stringify({ v: SAVE_VERSION, savedAt: Date.now(), meta, run: stripTransient(run) });
  try {
    const old = ls.getItem(KEY);
    if (old) ls.setItem(BAK, old);
    ls.setItem(KEY, data);
    lastError = null;
    return true;
  } catch (e) {
    lastError = 'Não foi possível salvar (armazenamento cheio?)';
    try { ls.removeItem(BAK); ls.setItem(KEY, data); lastError = null; return true; } catch (e2) { /* */ }
    return false;
  }
}

function parse(str) {
  if (!str) return null;
  try {
    const d = JSON.parse(str);
    if (!d || typeof d !== 'object' || !d.meta) return null;
    return d;
  } catch (e) { return null; }
}

export function loadGame() {
  const ls = storage();
  if (!ls) return null;
  const main = parse(ls.getItem(KEY));
  if (main) return main;
  const bak = parse(ls.getItem(BAK));
  if (bak) { bak.recovered = true; return bak; }
  return null;
}

export function hasSave() {
  const ls = storage();
  return !!(ls && (ls.getItem(KEY) || ls.getItem(BAK)));
}

export function wipeSave() {
  const ls = storage();
  if (!ls) return;
  ls.removeItem(KEY); ls.removeItem(BAK);
}

export function exportSave(meta, run) {
  const json = JSON.stringify({ v: SAVE_VERSION, savedAt: Date.now(), meta, run: stripTransient(run) });
  return 'VZ1:' + btoa(unescape(encodeURIComponent(json)));
}

export function importSave(text) {
  const t = (text || '').trim();
  if (!t.startsWith('VZ1:')) throw new Error('Código de save inválido.');
  const json = decodeURIComponent(escape(atob(t.slice(4))));
  const d = parse(json);
  if (!d) throw new Error('Save corrompido.');
  return d;
}

export function loadSettings() {
  const ls = storage();
  const def = { sound: true, music: true, vol: 0.8, speed: 1, confirmEnd: true, hints: true, haptics: true };
  if (!ls) return def;
  try { return { ...def, ...(JSON.parse(ls.getItem(SETTINGS) || '{}')) }; } catch (e) { return def; }
}

export function saveSettings(s) {
  const ls = storage();
  if (!ls) return;
  try { ls.setItem(SETTINGS, JSON.stringify(s)); } catch (e) { /* */ }
}
