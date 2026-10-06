// Shell do ICOR (área F): título, menu de pausa, configurações, codex, instalação, backup, créditos,
// ciclo de vida do iOS, viewport dinâmica, áudio e atualização segura do service worker.
//
// Exporta:
//   default                     -> telas: title, settings, help, install, backup, credits
//   init()                      -> liga ciclo de vida, áudio, SW (chamado por main.js)
//   openPauseMenu()             -> folha do menu (HUD chama)
//   resumeTarget(G, has)        -> tela onde "Continuar" deve retomar (puro, testável)
//   campaignSummary(G)          -> linhas de resumo da campanha (puro)
//   confirmRisky(text, opts)    -> confirmBox que respeita Configurações → "Confirmar ações perigosas"
//   startNewCampaign()          -> fluxo de Nova campanha (confirma, cria G, vai para 'intro')
//   continueCampaign()          -> retoma a campanha salva na tela certa
//   updateStatus(), applyUpdate(), checkForUpdate()  -> atualização do app
//   applySettings(s)            -> aplica configurações (áudio, vibração, texto, movimento)
import { h, button, section, kv, grid, chip, prose, setHapticsEnabled, haptic } from '../dom.js';
import { go, back, sheet, confirmBox, toastMsg, clearHistory, hasScreen, currentScreen, refresh, layoutEls } from '../app.js';
import { getG, newCampaign } from '../../core/state.js';
import { save, load, hasSave, wipe, exportSave, importSave, loadSettings, saveSettings, loadMeta, saveMeta, DEFAULT_SETTINGS } from '../../core/save.js';
import { on, emit } from '../../core/bus.js';
import { HELP, topicsByGroup, helpBody, resetHints } from '../help.js';
import { initAudio, configureAudio, playAmbient, ambientForScreen, suspendAudio, resumeAudio, unlockAudio, audioState } from '../audio.js';

export const APP_NAME = 'ICOR — O Deus Apodrecido';
const REGION_NAMES = { r1: 'Campos de Cinza', r2: 'Floresta dos Enforcados', r3: 'Catacumbas de Sal', r4: 'Vel-Maren', r5: 'O Cadáver' };
const BACKUP_PREFIX = 'ICOR1:';

// =====================================================================
// Lógica pura (sem DOM) — testada em tests/shell.test.mjs
// =====================================================================

/**
 * Para onde "Continuar" leva. has(id) diz se a tela existe (fallbacks seguros).
 * Ordem: campanha encerrada → herdeiros pendentes → combate → evento → saque → mutação → sem herói → expedição → cidade.
 */
export function resumeTarget(G, has = () => true) {
  if (!G || typeof G !== 'object') return 'title';
  const first = (...ids) => ids.find((id) => id === 'title' || has(id)) || 'title';
  if (G.campaign?.ended) return first('ending', 'title');
  const heirs = G.lineage?.heirs;
  const heroDead = !!G.hero?.dead;
  if (Array.isArray(heirs) && heirs.length && (!G.hero || heroDead)) return first('heirs', 'city');
  if (G.combat) return first('combat', G.expedition ? 'map' : 'city');
  if (G.event) return first('event', G.expedition ? 'map' : 'city');
  if (G.pendingLoot) return first('loot', G.expedition ? 'map' : 'city');
  if (!G.hero || heroDead) {
    if (heroDead && has('heirs')) return 'heirs';
    return first('create', 'intro');
  }
  const h0 = G.hero;
  if (h0.pendingMutation || h0.flags?.mutationPending || (h0.mutationPending || 0) > 0) return first('mutation', G.expedition ? 'map' : 'city');
  if (G.expedition) return first(G.expedition.camping ? 'camp' : 'map', 'map', 'city');
  return first('city');
}

/** Resumo curto da campanha salva (para o título e o menu). */
export function campaignSummary(G) {
  if (!G) return null;
  const t = Number(G.time) || 0;
  const day = Math.floor(t / 24) + 1;
  const hour = t % 24;
  const out = {
    house: G.lineage?.house || 'Casa sem nome',
    gen: G.lineage?.generation || 1,
    day, hour, chaga: Math.round(G.chaga ?? 0),
    hero: null, where: 'Valdrem', ended: !!G.campaign?.ended, dead: (G.lineage?.dead || []).length,
    lastDead: null,
  };
  const ld = (G.lineage?.dead || [])[(G.lineage?.dead || []).length - 1];
  if (ld) out.lastDead = { name: ld.name || 'Sem nome', cause: ld.cause || 'morte', day: ld.day || null, corrupted: !!ld.corrupted };
  if (G.hero) out.hero = { name: G.hero.name || 'Sem nome', level: G.hero.level || 1, bg: G.hero.bg || '' };
  if (G.campaign?.ended) out.where = 'Campanha encerrada';
  else if (G.combat) out.where = 'Em combate';
  else if (G.event) out.where = 'Diante de uma escolha';
  else if (G.expedition) out.where = `No Ermo — ${REGION_NAMES[G.expedition.region] || G.expedition.region || 'desconhecido'}`;
  else if (!G.hero && (G.lineage?.heirs || []).length) out.where = 'Escolhendo herdeiro';
  else if (!G.hero) out.where = 'Sem herdeiro';
  return out;
}

/** Texto de backup com prefixo (aceita também o formato cru de exportSave). */
export function wrapBackup(raw) { return raw ? BACKUP_PREFIX + raw : ''; }
export function unwrapBackup(text) {
  let s = String(text || '').replace(/\s+/g, '');
  if (s.startsWith(BACKUP_PREFIX)) s = s.slice(BACKUP_PREFIX.length);
  return s;
}

/** Decide se a atualização deve ser aplicada sozinha (jogador ignorou N vezes). */
export function shouldAutoApply(skips, limit = 3) { return Number(skips || 0) >= limit; }

// =====================================================================
// Configurações
// =====================================================================
const EXTRA_DEFAULTS = { hints: true, textSize: 0, reduceMotion: false, updateSkips: 0 };
export function getSettings() { return { ...DEFAULT_SETTINGS, ...EXTRA_DEFAULTS, ...loadSettings() }; }
export function setSetting(k, v) {
  const s = getSettings();
  s[k] = v;
  saveSettings(s);
  applySettings(s);
  return s;
}

export function applySettings(s = getSettings()) {
  configureAudio({ sound: s.sound, music: s.music, volume: s.volume });
  setHapticsEnabled(s.haptics !== false);
  if (typeof document !== 'undefined') {
    const fs = [16, 17, 19][s.textSize | 0] || 16;
    document.documentElement.style.setProperty('--fs', `${fs}px`);
    document.documentElement.classList.toggle('sh-reduce-motion', !!s.reduceMotion);
  }
}

/** Confirmação para ações arriscadas: se o jogador desligou confirmações, resolve true direto. opts.always força perguntar. */
export function confirmRisky(text, opts = {}) {
  const s = getSettings();
  if (s.confirmDanger === false && !opts.always) return Promise.resolve(true);
  return confirmBox(text, { danger: true, ...opts });
}

// =====================================================================
// Service worker: atualização segura
// =====================================================================
const upd = {
  supported: false, reg: null, ready: false, worker: null, waitingVersion: null, currentVersion: null,
  applying: false, checking: false, error: null, lastCheck: 0, notified: false,
};
let reloading = false;

export function updateStatus() {
  return {
    supported: upd.supported, registered: !!upd.reg, ready: upd.ready, applying: upd.applying, checking: upd.checking,
    current: upd.currentVersion, waiting: upd.waitingVersion, error: upd.error, skips: getSettings().updateSkips || 0,
  };
}

function swAllowed() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  const host = location.hostname;
  return location.protocol === 'https:' || host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function queryVersion(worker, ms = 1500) {
  return new Promise((resolve) => {
    if (!worker) return resolve(null);
    try {
      const ch = new MessageChannel();
      const tm = setTimeout(() => resolve(null), ms);
      ch.port1.onmessage = (e) => { clearTimeout(tm); resolve(e.data?.version || null); };
      worker.postMessage({ type: 'GET_VERSION' }, [ch.port2]);
    } catch { resolve(null); }
  });
}

async function readCurrentVersion() {
  const ctrl = navigator.serviceWorker?.controller;
  let v = await queryVersion(ctrl);
  if (!v) {
    try {
      const r = await fetch('version.txt', { cache: 'no-store' });
      if (r.ok) v = (await r.text()).trim().slice(0, 20);
    } catch { /* offline */ }
  }
  upd.currentVersion = v || (ctrl ? 'desconhecida' : 'dev');
  return upd.currentVersion;
}

function markReady(worker) {
  if (!worker) return;
  upd.ready = true;
  upd.worker = worker;
  queryVersion(worker).then((v) => { upd.waitingVersion = v; if (['title', 'settings'].includes(currentScreen())) refresh(); });
  const scr = currentScreen();
  if (scr === 'title') {
    if (shouldAutoApply(getSettings().updateSkips)) { applyUpdate({ auto: true }); return; }
    refresh();
  } else if (!upd.notified) {
    upd.notified = true;
    toastMsg('Nova versão pronta. Será aplicada no título.', 'info', 4000);
  }
}

function registerSW() {
  if (!swAllowed()) return;
  upd.supported = true;
  navigator.serviceWorker.register('./sw.js', { scope: './' }).then((reg) => {
    upd.reg = reg;
    if (reg.waiting && navigator.serviceWorker.controller) markReady(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) markReady(nw);
      });
    });
    readCurrentVersion();
  }).catch((e) => { upd.error = String(e?.message || e); console.warn('[sw] registro falhou', e); });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (upd.applying && !reloading) { reloading = true; location.reload(); return; }
    readCurrentVersion();
  });
}

/** Busca versão nova agora. Resolve { ready, error }. */
export async function checkForUpdate({ quiet = false } = {}) {
  if (!upd.reg) { if (!quiet) toastMsg(upd.supported ? 'Service worker ainda não registrado.' : 'Atualização offline indisponível neste navegador.', 'warn'); return { ready: false }; }
  upd.checking = true; upd.lastCheck = Date.now();
  try {
    await upd.reg.update();
    // espera um pouco caso esteja baixando
    for (let i = 0; i < 20 && upd.reg.installing; i++) await new Promise((r) => setTimeout(r, 250));
    if (upd.reg.waiting && navigator.serviceWorker.controller && !upd.ready) markReady(upd.reg.waiting);
    if (!quiet) toastMsg(upd.ready ? 'Nova versão pronta.' : 'Você está na versão mais recente.', upd.ready ? 'good' : 'info');
    return { ready: upd.ready };
  } catch (e) {
    upd.error = String(e?.message || e);
    if (!quiet) toastMsg('Sem conexão para buscar atualização.', 'warn');
    return { ready: upd.ready, error: upd.error };
  } finally {
    upd.checking = false;
  }
}

/** Salva e aplica a versão nova (só chame em lugar seguro: título). */
export function applyUpdate({ auto = false } = {}) {
  if (!upd.ready || upd.applying) return false;
  const w = upd.reg?.waiting || upd.worker;
  if (!w) { upd.ready = false; return false; }
  try { if (getG()) save(); } catch { /* ignore */ }
  const s = getSettings(); s.updateSkips = 0; saveSettings(s);
  upd.applying = true;
  toastMsg(auto ? 'Atualizando automaticamente… seu progresso foi salvo.' : 'Atualizando… seu progresso foi salvo.', 'info', 5000);
  try { w.postMessage({ type: 'SKIP_WAITING' }); } catch { /* ignore */ }
  setTimeout(() => { if (!reloading) { reloading = true; location.reload(); } }, 4000);
  return true;
}

/** Leva o jogador ao título (salvando) e aplica lá. */
function goTitleAndApply() {
  try { if (getG()) save(); } catch { /* ignore */ }
  clearHistory();
  go('title', { applyUpdate: true }, { replace: true });
}

// =====================================================================
// Fluxos de campanha
// =====================================================================
function canContinue(G) { return !!G && hasSave(); }

/** Jogador entrou no jogo com atualização pendente: conta um adiamento. */
function countUpdateSkip() {
  if (!upd.ready || upd.applying) return;
  const s = getSettings(); s.updateSkips = (s.updateSkips || 0) + 1; saveSettings(s);
}

export function continueCampaign() {
  let G = getG();
  if (!G) G = load();
  if (!G) { toastMsg('Nenhuma campanha salva.', 'warn'); return false; }
  const target = resumeTarget(G, hasScreen);
  if (target === 'title') { toastMsg('Não há para onde voltar. Comece uma nova campanha.', 'warn'); return false; }
  countUpdateSkip();
  clearHistory();
  go(target, {}, { replace: true });
  return true;
}

export async function startNewCampaign() {
  const G = getG();
  if (hasSave() && G && !G.campaign?.ended) {
    const gen = G.lineage?.generation || 1;
    const ok = await confirmBox(
      prose(`Começar de novo APAGA a campanha atual: ${G.lineage?.house || 'sua casa'}, ${gen} geração(ões), mapa, facções e Chaga. Não há volta.\n\nDica: faça um Backup antes.`),
      { title: 'Nova campanha', yes: 'Apagar e começar', no: 'Manter', danger: true });
    if (!ok) return false;
  }
  const meta = loadMeta();
  meta.campaigns = (meta.campaigns || 0) + 1;
  saveMeta(meta);
  newCampaign({});
  save();
  countUpdateSkip();
  clearHistory();
  const next = ['intro', 'create'].find(hasScreen);
  if (!next) { toastMsg('A introdução ainda não está disponível.', 'warn'); refresh(); return true; }
  go(next, {}, { replace: true });
  return true;
}

function saveAndQuit() {
  const ok = getG() ? save() : true;
  if (!ok) toastMsg('Atenção: não foi possível salvar.', 'bad', 5000);
  clearHistory();
  go('title', {}, { replace: true });
}

// =====================================================================
// Menu de pausa
// =====================================================================
let pauseOpen = null;
let lastSavedAt = 0;
export function savedAgo(now = Date.now(), at = lastSavedAt) {
  if (!at) return null;
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 5) return 'agora';
  if (s < 60) return `há ${s}s`;
  const m = Math.round(s / 60);
  return m < 60 ? `há ${m} min` : `há ${Math.round(m / 60)} h`;
}
function soundToggle() {
  const s = getSettings();
  const all = s.sound !== false && s.music !== false;
  const label = all ? 'Som e ambiente: ligados' : s.sound !== false ? 'Ambiente desligado' : 'Som desligado';
  const b = button(label, () => {
    const cur = getSettings();
    // ciclo: tudo ligado -> sem ambiente -> mudo -> tudo ligado
    const next = cur.sound !== false && cur.music !== false ? { sound: true, music: false }
      : cur.sound !== false ? { sound: false, music: false } : { sound: true, music: true };
    setSetting('sound', next.sound); setSetting('music', next.music);
    unlockAudio();
    const fresh = soundToggle();
    b.replaceWith(fresh);
  }, { kind: ['ghost', 'wide', 'left'], sub: 'toque para alternar', icon: all ? '♪' : '✕' });
  return b;
}
export function openPauseMenu() {
  try { pauseOpen?.close(); } catch { /* ignore */ }
  const G = getG();
  const sum = campaignSummary(G);
  const item = (label, sub, fn, kind = 'ghost', icon) => button(label, () => { pauseOpen?.close(); fn(); }, { kind: [kind, 'wide', 'left'], sub, icon });
  const body = () => h('div.sh-pause',
    sum ? h('div.sh-pause-status',
      h('div.sh-pause-house', sum.house, sum.gen > 1 ? h('span.muted', ` · ${sum.gen}ª geração`) : null),
      h('div.small.muted', `Dia ${sum.day}, ${String(sum.hour).padStart(2, '0')}h · Chaga ${sum.chaga} · ${sum.where}`),
      h('div.small.sh-saved', savedAgo() ? `✓ Salvo ${savedAgo()}` : '✓ Salvamento automático ativo')) : null,
    upd.ready ? h('div.sh-update-note', h('b', 'Nova versão pronta. '), 'Será aplicada quando você voltar ao título.') : null,
    h('div.stack',
      item('Continuar', null, () => {}, 'primary', '▶'),
      hasScreen('journal') && G ? item('Diário', 'o que sua casa viveu', () => go('journal'), 'ghost', '✎') : null,
      hasScreen('factions') && G ? item('Facções', 'reputação e missões', () => go('factions'), 'ghost', '⚖') : null,
      hasScreen('sheet') && G?.hero ? item('Ficha do personagem', null, () => go('sheet'), 'ghost', '☉') : null,
      item('Como jogar', 'codex de regras', () => go('help'), 'ghost', '?'),
      item('Configurações', 'som, vibração, atualização', () => go('settings'), 'ghost', '⚙'),
      soundToggle(),
      item(upd.ready ? 'Salvar, sair e atualizar' : 'Salvar e sair para o título', 'o progresso fica salvo', upd.ready ? goTitleAndApply : saveAndQuit, 'blood', '⏏'),
    ));
  pauseOpen = sheet({ title: 'Menu', body, cls: 'sh-pause-sheet', onClose: () => { pauseOpen = null; } });
  return pauseOpen;
}

// =====================================================================
// Telas
// =====================================================================
const TAGLINES = [
  'O sangue do deus ainda escorre.',
  'A Chaga não dorme. Nem você deveria.',
  'Todo frasco tem um preço. Alguns cobram a alma.',
  'Seus mortos esperam no Ermo. Com fome.',
  'Valdrem tem muros. O Ermo tem paciência.',
  'Beba. Apodreça. Sobreviva.',
  'Herdeiros não choram. Herdeiros recolhem o corpo.',
];
function tagline() { const d = new Date(); return TAGLINES[(d.getDate() + d.getMonth() * 31) % TAGLINES.length]; }

function logo() {
  return h('div.sh-logo', { attrs: { role: 'img', 'aria-label': 'ICOR — O Deus Apodrecido' } },
    h('div.sh-logo-mark', h('span.sh-drop', { attrs: { 'aria-hidden': 'true' } })),
    h('div.sh-logo-word', 'ICOR'),
    h('div.sh-logo-rule', h('span'), h('em', 'o deus apodrecido'), h('span')),
  );
}

function isStandalone() {
  try {
    return !!(navigator.standalone || window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: fullscreen)').matches);
  } catch { return false; }
}
function platform() {
  const ua = navigator.userAgent || '';
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const otherIOSBrowser = iOS && /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
  return { iOS, safari: iOS && !otherIOSBrowser, otherIOSBrowser, android: /Android/.test(ua) };
}

let deferredInstall = null; // beforeinstallprompt (Android/desktop)

const titleScreen = {
  id: 'title', hud: false,
  onEnter(params) {
    const s = getSettings();
    if (upd.ready && (params?.applyUpdate || shouldAutoApply(s.updateSkips))) setTimeout(() => applyUpdate({ auto: !params?.applyUpdate }), 300);
  },

  render({ main, dock }) {
    const G = getG();
    const sum = campaignSummary(G);
    const cont = canContinue(G);
    const meta = loadMeta();
    main.append(h('div.sh-title',
      logo(),
      h('p.sh-tagline', tagline()),
      upd.ready ? h('div.sh-update',
        h('div', h('b', 'Nova versão pronta'), upd.waitingVersion ? h('span.mono.small', ` (${upd.waitingVersion})`) : null),
        h('div.small.muted', `Seu progresso é salvo antes. ${Math.max(0, 3 - (getSettings().updateSkips || 0))} adiamento(s) restante(s).`),
        button('Atualizar agora', () => applyUpdate(), { kind: ['primary', 'small'] })) : null,
      cont && sum ? h('div.sh-save',
        h('div.sh-save-house', sum.house, sum.gen > 1 ? h('span.muted.small', ` · ${sum.gen}ª geração`) : null),
        sum.hero ? h('div.sh-save-hero', `${sum.hero.name}, nível ${sum.hero.level}`) : h('div.sh-save-hero.muted', sum.ended ? 'Fim.' : 'Ninguém vivo para carregar o nome.'),
        h('div.sh-save-meta',
          chip(`Dia ${sum.day}`, 'info'),
          chip(`Chaga ${sum.chaga}`, sum.chaga >= 75 ? 'bad' : sum.chaga >= 50 ? 'warn' : 'rot'),
          sum.dead ? chip(`${sum.dead} morto(s)`, 'blood') : null),
        h('div.small.muted', sum.where),
        sum.lastDead ? h('div.sh-save-dead', `† ${sum.lastDead.name} — ${sum.lastDead.cause}${sum.lastDead.day ? `, dia ${sum.lastDead.day}` : ''}`) : null) : null,
      h('div.sh-menu', grid([
        button('Como jogar', () => go('help'), { icon: '?', sub: 'regras e codex' }),
        button('Configurações', () => go('settings'), { icon: '⚙', sub: 'som, toque, versão' }),
        button(isStandalone() ? 'Modo app ativo' : 'Instalar no iPhone', () => go('install'), { icon: '⬇', sub: isStandalone() ? 'tela cheia, offline' : 'tela cheia e offline' }),
        button('Backup', () => go('backup'), { icon: '⛁', sub: 'exportar / importar' }),
      ], 2)),
      h('div.sh-foot',
        meta.campaigns ? h('span', `${meta.campaigns} campanha(s) iniciada(s)`) : h('span', 'Conteúdo adulto: violência explícita e horror.'),
        button('Créditos', () => go('credits'), { kind: ['ghost', 'small'] })),
    ));
    if (cont && sum) {
      dock.append(button(sum.ended ? 'Ver o fim' : 'Continuar', () => continueCampaign(), {
        kind: ['primary', 'wide'], sub: sum.hero ? `${sum.hero.name} · Dia ${sum.day} · ${sum.where}` : sum.where,
      }));
      dock.append(button('Nova campanha', () => startNewCampaign(), { kind: ['ghost', 'wide'], sub: 'apaga a campanha atual' }));
    } else {
      dock.append(button('Nova campanha', () => startNewCampaign(), { kind: ['blood', 'wide'], sub: 'uma casa decadente, um deus morto' }));
    }
  },
};

// ---------- configurações ----------
function toggleRow(label, desc, key, s, extra) {
  const isOn = s[key] !== false && !!s[key];
  return h('div.sh-set-row',
    h('div.sh-set-text', h('div.sh-set-label', label), desc ? h('div.small.muted', desc) : null),
    button(isOn ? 'Ligado' : 'Desligado', () => { setSetting(key, !isOn); extra?.(!isOn); refresh(); },
      { kind: ['small', isOn ? 'primary' : 'ghost'], title: `${label}: ${isOn ? 'ligado' : 'desligado'}` }));
}

const settingsScreen = {
  id: 'settings', hud: false,
  render({ main, dock }) {
    const s = getSettings();
    const vol = Math.round((s.volume ?? 0.7) * 100);
    const au = audioState();
    const st = updateStatus();
    const G = getG();
    main.append(h('h1.sh-h1', 'Configurações'));
    main.append(section('Som',
      toggleRow('Efeitos sonoros', 'golpes, ossos, sinos', 'sound', s),
      toggleRow('Ambiente', 'drone grave por lugar', 'music', s),
      h('div.sh-set-row',
        h('div.sh-set-text', h('div.sh-set-label', 'Volume'), h('div.small.muted', au.supported ? 'toque em Testar para ouvir' : 'áudio não suportado aqui')),
        h('div.sh-stepper',
          button('−', () => { setSetting('volume', Math.max(0, (vol - 10) / 100)); refresh(); }, { kind: ['small', 'ghost'], disabled: vol <= 0, why: 'Volume já está no mínimo.', title: 'Diminuir volume' }),
          h('span.sh-stepper-val.mono', `${vol}%`),
          button('+', () => { setSetting('volume', Math.min(1, (vol + 10) / 100)); refresh(); }, { kind: ['small', 'ghost'], disabled: vol >= 100, why: 'Volume já está no máximo.', title: 'Aumentar volume' }))),
      h('div.row', button('Testar som', () => { unlockAudio(); emit('sfx', 'bell'); setTimeout(() => emit('sfx', 'bone'), 500); }, { kind: ['small', 'ghost'], sound: 'tap' }),
        h('span.small.muted', 'No iPhone, a chave de silêncio também muta o jogo.')),
    ));
    main.append(section('Toque e leitura',
      toggleRow('Vibração', 'onde o aparelho permitir (o iPhone não vibra por páginas web)', 'haptics', s, (v) => { if (v) haptic(20); }),
      toggleRow('Confirmar ações perigosas', 'pergunta antes de fugir, amputar, beber Icor…', 'confirmDanger', s),
      toggleRow('Dicas de primeira vez', 'explicações curtas ao ver algo novo', 'hints', s),
      h('div.sh-set-row',
        h('div.sh-set-text', h('div.sh-set-label', 'Tamanho do texto')),
        h('div.sh-seg', ['Normal', 'Grande', 'Enorme'].map((l, i) => button(l, () => { setSetting('textSize', i); refresh(); }, { kind: ['small', (s.textSize | 0) === i ? 'primary' : 'ghost'] })))),
      toggleRow('Reduzir movimento', 'menos tremores e animações', 'reduceMotion', s),
      h('div.row', button('Rever todas as dicas', () => { resetHints(); applySettings(); toastMsg('As dicas voltarão a aparecer.', 'good'); refresh(); }, { kind: ['small', 'ghost'] })),
    ));
    main.append(section('Versão',
      kv('Versão instalada', st.current || (st.supported ? '…' : 'sem modo offline')),
      st.ready ? kv('Nova versão', st.waiting || 'pronta', 'good') : null,
      kv('Modo offline', st.registered ? 'ativo' : (st.supported ? 'iniciando' : 'indisponível'), st.registered ? 'good' : 'warn'),
      kv('Modo app', isStandalone() ? 'sim' : 'não (navegador)', isStandalone() ? 'good' : ''),
      h('div.row.row-wrap',
        button(st.checking ? 'Buscando…' : 'Buscar atualização', async () => { await checkForUpdate(); refresh(); }, { kind: ['small', 'ghost'], disabled: !st.registered || st.checking, why: st.supported ? 'Aguarde o modo offline iniciar.' : 'Este navegador não permite atualização offline.' }),
        st.ready ? button('Salvar e atualizar', () => goTitleAndApply(), { kind: ['small', 'primary'] }) : null),
    ));
    const storageInfo = h('div.small.muted', '…');
    estimateStorage().then((t) => { storageInfo.textContent = t; });
    main.append(section('Armazenamento',
      h('p.small', 'O jogo salva sozinho neste aparelho a cada ação. Instalado na Tela de Início, o iPhone não apaga os dados por falta de uso.'),
      storageInfo,
      h('div.row.row-wrap',
        button('Proteger dados', async () => { const ok = await requestPersist(); toastMsg(ok ? 'Armazenamento protegido.' : 'O navegador não garantiu proteção. Faça backups.', ok ? 'good' : 'warn'); }, { kind: ['small', 'ghost'] }),
        button('Backup', () => go('backup'), { kind: ['small', 'ghost'] })),
    ));
    main.append(section('Zona de perigo',
      h('p.small.muted', 'Apagar a campanha remove casa, herdeiros, mapa e progresso deste aparelho.'),
      button('Apagar campanha', async () => {
        const a = await confirmBox('Apagar a campanha salva? A casa, os herdeiros e o mapa serão perdidos.', { title: 'Apagar campanha', yes: 'Apagar', danger: true });
        if (!a) return;
        const b = await confirmBox('Última chance. Isto NÃO pode ser desfeito.', { title: 'Tem certeza?', yes: 'Apagar para sempre', no: 'Não', danger: true });
        if (!b) return;
        wipe();
        emit('sfx', 'bell');
        toastMsg('Campanha apagada.', 'warn');
        clearHistory();
        go('title', {}, { replace: true });
      }, { kind: ['danger', 'wide'], disabled: !hasSave() && !G, why: 'Não há campanha salva.' }),
    ));
    dock.append(button('Voltar', () => back('title'), { kind: ['ghost', 'wide'] }));
  },
};

async function estimateStorage() {
  try {
    const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    const used = est?.usage != null ? `${(est.usage / 1024).toFixed(0)} KB usados` : 'uso desconhecido';
    return `${used} · ${persisted ? 'protegido contra limpeza' : 'não protegido'}`;
  } catch { return 'informação indisponível'; }
}
async function requestPersist() {
  try { return navigator.storage?.persist ? await navigator.storage.persist() : false; } catch { return false; }
}

// ---------- codex ----------
const helpScreen = {
  id: 'help', hud: false,
  render({ main, dock, params }) {
    const topic = params?.topic && HELP[params.topic] ? params.topic : null;
    if (topic) {
      const t = HELP[topic];
      main.append(h('div.sh-codex-head', h('div.small.muted', 'Codex'), h('h1.sh-h1', t.title)));
      main.append(h('div.panel.sh-codex-topic', helpBody(topic)));
      if (t.see?.length) {
        main.append(section('Veja também', grid(t.see.filter((s) => HELP[s]).map((s) => button(HELP[s].title, () => go('help', { topic: s }, { replace: true }), { kind: ['ghost'] })), 2)));
      }
      dock.append(h('div.dock-row',
        button('Tópicos', () => go('help', {}, { replace: true }), { kind: ['ghost'], icon: '☰' }),
        button('Voltar', () => back('title'), { kind: ['primary'] })));
      return;
    }
    main.append(h('h1.sh-h1', 'Como jogar'));
    main.append(h('p.sh-lead', 'Regras curtas. Toque num tópico. Durante o jogo, os botões "?" abrem o tópico certo.'));
    main.append(button('Início rápido', () => go('help', { topic: 'inicio' }, { replace: true }), { kind: ['blood', 'wide'], sub: 'o essencial em 30 segundos' }));
    for (const g of topicsByGroup()) {
      const list = g.topics.filter((t) => t !== 'inicio');
      if (!list.length) continue;
      main.append(section(g.label, grid(list.map((t) => button(HELP[t].title, () => go('help', { topic: t }, { replace: true }), { kind: ['ghost'] })), 2)));
    }
    dock.append(button('Voltar', () => back('title'), { kind: ['ghost', 'wide'] }));
  },
};

// ---------- instalação ----------
const installScreen = {
  id: 'install', hud: false,
  render({ main, dock }) {
    const p = platform();
    const sa = isStandalone();
    main.append(h('h1.sh-h1', 'Instalar no iPhone'));
    if (sa) {
      main.append(h('div.panel.sh-installed', h('div.sh-installed-mark', '✓'), h('div', h('b', 'Você já está no modo app.'), h('div.small.muted', 'Tela cheia, funciona offline, e o iPhone não apaga seu progresso por falta de uso.'))));
    } else {
      if (p.otherIOSBrowser) main.append(h('div.panel.sh-warn', h('b', 'Abra no Safari. '), 'No iPhone, só o Safari instala apps da web de forma confiável. Copie o endereço e cole no Safari.'));
      main.append(h('p.sh-lead', 'Instalado, o ICOR abre em tela cheia, sem barra do navegador, e funciona sem internet.'));
      const steps = [
        ['1', 'Abra no Safari', 'Este mesmo endereço, no Safari do iPhone.'],
        ['2', 'Toque em Compartilhar', h('span', 'O quadrado com a seta para cima ', h('span.sh-glyph', '⬆︎'), ' na barra inferior (ou superior).')],
        ['3', 'Adicionar à Tela de Início', 'Role a lista de ações para baixo até achar. Se não aparecer, toque em "Editar Ações".'],
        ['4', 'Mantenha "Abrir como App da Web"', 'Deixe a opção ligada (iOS 17+). Toque em Adicionar.'],
        ['5', 'Abra pelo ícone', 'O olho dourado na sua Tela de Início. Sempre jogue por ele: é lá que o progresso fica.'],
      ];
      main.append(h('ol.sh-steps', steps.map(([n, title, desc]) => h('li.sh-step', h('span.sh-step-n', n), h('div', h('div.sh-step-title', title), h('div.small.muted', desc))))));
      main.append(h('div.panel.small',
        h('b', 'Atenção: '), 'o Safari e o app instalado guardam saves separados. Se já jogou no navegador, use ',
        h('b', 'Backup → Exportar'), ' aqui e ', h('b', 'Importar'), ' dentro do app.'));
      if (deferredInstall) {
        main.append(button('Instalar agora', async () => {
          try { deferredInstall.prompt(); await deferredInstall.userChoice; } catch { /* ignore */ }
          deferredInstall = null; refresh();
        }, { kind: ['primary', 'wide'], sub: 'este navegador permite instalar direto' }));
      }
    }
    dock.append(button('Voltar', () => back('title'), { kind: ['ghost', 'wide'] }));
  },
};

// ---------- backup ----------
const backupScreen = {
  id: 'backup', hud: false,
  render({ main, dock }) {
    const G = getG();
    const raw = G ? exportSave() : '';
    const text = wrapBackup(raw);
    main.append(h('h1.sh-h1', 'Backup'));
    main.append(h('p.sh-lead', 'O save fica só neste aparelho. Copie o texto abaixo e guarde (Notas, e-mail). Para restaurar, cole e importe.'));
    const out = h('textarea.sh-code', { readOnly: true, rows: 4, value: text || '', attrs: { 'aria-label': 'Texto do backup', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off' } });
    const sum = campaignSummary(G);
    main.append(section('Exportar',
      G ? h('div.small.muted', `${sum.house} · Dia ${sum.day} · ${(text.length / 1024).toFixed(1)} KB`) : h('div.small.muted', 'Nenhuma campanha carregada.'),
      G ? out : null,
      h('div.row.row-wrap',
        button('Copiar', async () => {
          if (G) save();
          const ok = await copyText(text, out);
          toastMsg(ok ? 'Backup copiado. Cole num lugar seguro.' : 'Selecione o texto e copie manualmente.', ok ? 'good' : 'warn');
        }, { kind: ['primary'], disabled: !G, why: 'Nenhuma campanha para exportar.' }),
        typeof navigator !== 'undefined' && navigator.share ? button('Compartilhar', async () => {
          try { await navigator.share({ title: 'Backup ICOR', text }); } catch { /* cancelado */ }
        }, { kind: ['ghost'], disabled: !G, why: 'Nenhuma campanha para exportar.' }) : null),
    ));
    const inp = h('textarea.sh-code', { rows: 4, placeholder: 'Cole aqui o texto do backup (começa com ICOR1:)', attrs: { 'aria-label': 'Colar backup', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off' } });
    main.append(section('Importar',
      h('div.small.muted', 'Substitui a campanha atual deste aparelho.'),
      inp,
      h('div.row.row-wrap',
        button('Colar', async () => {
          try { inp.value = await navigator.clipboard.readText(); } catch { toastMsg('Toque e segure no campo para colar.', 'info'); inp.focus(); }
        }, { kind: ['ghost'] }),
        button('Importar', async () => {
          const val = unwrapBackup(inp.value);
          if (val.length < 20) { toastMsg('Cole o texto completo do backup.', 'warn'); return; }
          if (getG() && hasSave()) {
            const ok = await confirmBox('Importar substitui a campanha atual deste aparelho. Continuar?', { title: 'Importar backup', yes: 'Substituir', danger: true });
            if (!ok) return;
          }
          if (importSave(val)) {
            emit('sfx', 'bell');
            toastMsg('Backup restaurado.', 'good');
            clearHistory();
            go('title', {}, { replace: true });
          } else {
            emit('sfx', 'deny');
            toastMsg('Texto inválido ou incompleto. Nada foi alterado.', 'bad', 4000);
          }
        }, { kind: ['blood'] })),
    ));
    dock.append(button('Voltar', () => back('title'), { kind: ['ghost', 'wide'] }));
  },
};

async function copyText(text, el) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* tenta seleção */ }
  try {
    el.focus(); el.select(); el.setSelectionRange(0, text.length);
    return document.execCommand && document.execCommand('copy');
  } catch { return false; }
}

// ---------- créditos ----------
const creditsScreen = {
  id: 'credits', hud: false,
  render({ main, dock }) {
    main.append(h('div.sh-credits',
      logo(),
      h('div.prose',
        h('p', 'Um deus caiu. Nós comemos o que escorreu dele.'),
        h('p', h('b', 'Feito para '), 'Henrique, que pediu um RPG de verdade.'),
        h('p', h('b', 'Design, código e texto: '), 'Claude (Anthropic).'),
        h('p', h('b', 'Som: '), 'sintetizado em tempo real. Nenhuma gravação.'),
        h('p', h('b', 'Tecnologia: '), 'JavaScript puro, sem bibliotecas. Funciona offline.'),
        h('p.muted.small', 'Contém violência explícita, mutilação, horror corporal e fanatismo religioso. Ficção.'))));
    dock.append(button('Voltar', () => back('title'), { kind: ['ghost', 'wide'] }));
  },
};

export default [titleScreen, settingsScreen, helpScreen, installScreen, backupScreen, creditsScreen];

// =====================================================================
// Ciclo de vida, viewport, gestos
// =====================================================================
function safeSave() { try { if (getG()) save(); } catch (e) { console.error(e); } }

function isTextInput(el) {
  return !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !/^(button|checkbox|radio|range|submit)$/i.test(el.type)));
}

function updateViewport() {
  const de = document.documentElement;
  const vv = window.visualViewport;
  const ih = window.innerHeight;
  const vh = vv ? vv.height : ih;
  de.style.setProperty('--vh', `${(ih * 0.01).toFixed(2)}px`);
  de.style.setProperty('--app-h', `${Math.round(vh)}px`);
  const kb = vv ? Math.max(0, ih - vv.height - vv.offsetTop) : 0;
  de.style.setProperty('--kb', `${Math.round(kb)}px`);
  const app = document.getElementById('app');
  if (app) app.classList.toggle('sh-kb-open', kb > 100 && isTextInput(document.activeElement));
}

let lifecycleWired = false;
function wireLifecycle() {
  if (lifecycleWired) return;
  lifecycleWired = true;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      safeSave();
      suspendAudio();
    } else {
      resumeAudio();
      updateViewport();
      refresh();
      if (upd.reg && Date.now() - upd.lastCheck > 30 * 60 * 1000) checkForUpdate({ quiet: true });
    }
  });
  window.addEventListener('pagehide', safeSave);
  window.addEventListener('beforeunload', safeSave);
  window.addEventListener('pageshow', (e) => { if (e.persisted) { updateViewport(); refresh(); } });
  window.addEventListener('resize', updateViewport);
  window.addEventListener('orientationchange', () => setTimeout(updateViewport, 250));
  window.visualViewport?.addEventListener('resize', updateViewport);
  window.visualViewport?.addEventListener('scroll', updateViewport);
  // teclado virtual: ao focar, rola o campo para a vista; ao sair, desfaz o deslocamento do iOS
  document.addEventListener('focusin', (e) => {
    if (!isTextInput(e.target)) return;
    setTimeout(() => { updateViewport(); try { e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { /* ignore */ } }, 300);
  });
  document.addEventListener('focusout', () => setTimeout(() => { updateViewport(); if (!isTextInput(document.activeElement)) window.scrollTo(0, 0); }, 80));
  // sem zoom por gesto / duplo toque (o CSS já usa touch-action: manipulation)
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', (e) => { if (!isTextInput(e.target)) e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', (e) => { if (!isTextInput(e.target)) e.preventDefault(); });
  // erros de armazenamento cheio: lembrar do backup
  on('error', () => { /* app.js já mostra o toast */ });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; if (currentScreen() === 'install') refresh(); });
}

/** Ambiente sonoro segue a tela atual (observa #app[data-screen]). */
function wireAmbient() {
  const root = layoutEls()?.root || document.getElementById('app');
  if (!root || typeof MutationObserver === 'undefined') return;
  let last = null;
  const sync = () => {
    const id = root.dataset.screen;
    const kind = ambientForScreen(id, getG());
    if (kind !== last) { last = kind; playAmbient(kind); }
  };
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-screen'] });
  on('render', () => setTimeout(sync, 0));
}

/** Vibração curta em golpes fortes (Android; iOS ignora). */
function wireHaptics() {
  const strong = { hit_heavy: 25, crit: 35, sever: 40, bone: 20, death: 80, siege: 30 };
  on('sfx', (name) => { if (strong[name]) haptic(strong[name]); });
}

let initialized = false;
export function init() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  const s = getSettings();
  applySettings(s);
  initAudio({ sound: s.sound, music: s.music, volume: s.volume });
  wireLifecycle();
  updateViewport();
  wireAmbient();
  wireHaptics();
  on('saved', () => { lastSavedAt = Date.now(); });
  registerSW();
  // API de depuração/testes (somente leitura + navegação). Não use em código de jogo.
  window.__ICOR__ = {
    getG, go, back, hasScreen, currentScreen, save, load, hasSave,
    resumeTarget: () => resumeTarget(getG(), hasScreen),
    update: updateStatus, audio: audioState,
    checkUpdate: () => checkForUpdate({ quiet: true }),
    openPauseMenu,
  };
}
