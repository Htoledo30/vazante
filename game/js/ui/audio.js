// Áudio do ICOR — 100% sintetizado com WebAudio (sem arquivos).
//
// - Só cria o AudioContext depois do primeiro toque (exigência do iOS Safari): unlockAudio().
// - Ouve o barramento: sfx(name) de core/bus.js toca aqui.
// - Respeita configurações: som (efeitos), música (ambiente), volume. configureAudio(settings).
// - Ambiente opcional: drones graves por lugar (título, cidade, ermo, escuridão, combate, chefe, cerco).
// - Suspende quando o app vai para segundo plano e retoma ao voltar (suspendAudio/resumeAudio).
//
// Nada aqui é lógica de jogo; o ruído usa um gerador local (não toca no RNG do save).
import { on } from '../core/bus.js';

let ctx = null;
let master = null, sfxBus = null, ambBus = null, comp = null, verb = null, verbSend = null;
let settings = { sound: true, music: true, volume: 0.7 };
let unlocked = false;
let suspendedByApp = false;
let ambient = null;          // { kind, nodes:[], gain, timers:[] }
let wantedAmbient = null;    // tipo desejado mesmo antes do desbloqueio
const lastPlay = new Map();  // anti-metralhadora por som
let voices = 0;
let vary = 1;                // variação de altura por disparo (evita cansaço em combate)

// ---------- ruído determinístico local ----------
let seed = 0x1c0ffee;
function rnd() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 1e6) / 1e6; }

export const SFX_NAMES = [
  'tap', 'deny', 'hit', 'hit_heavy', 'crit', 'sever', 'block', 'parry', 'miss', 'death', 'enemy_death', 'heal',
  'coin', 'ichor', 'step', 'door', 'fire', 'camp', 'levelup', 'dread', 'corrupt', 'bell', 'siege', 'win', 'lose',
  'scream', 'bone', 'squelch', 'whisper',
];
export const AMBIENT_KINDS = ['title', 'city', 'field', 'dark', 'combat', 'boss', 'siege', 'event', 'corpse'];

export const audioState = () => ({
  supported: typeof window !== 'undefined' && !!(window.AudioContext || window.webkitAudioContext),
  unlocked, running: !!ctx && ctx.state === 'running', ambient: ambient?.kind || null, settings: { ...settings },
});

/** Aplica { sound, music, volume } (volume 0..1). Pode ser chamado antes do desbloqueio. */
export function configureAudio(s = {}) {
  settings = { ...settings, ...pickAudio(s) };
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(clampVol(settings.volume), t, 0.05);
  sfxBus.gain.setTargetAtTime(settings.sound ? 1 : 0, t, 0.03);
  ambBus.gain.setTargetAtTime(settings.music ? 0.55 : 0, t, 0.4);
  if (settings.music && wantedAmbient && !ambient) playAmbient(wantedAmbient);
}
function pickAudio(s) {
  const o = {};
  if ('sound' in s) o.sound = !!s.sound;
  if ('music' in s) o.music = !!s.music;
  if ('volume' in s) o.volume = clampVol(s.volume);
  return o;
}
const clampVol = (v) => Math.max(0, Math.min(1, Number.isFinite(+v) ? +v : 0.7));

/** Cria/retoma o contexto. Chame dentro de um gesto do usuário. */
export function unlockAudio() {
  if (typeof window === 'undefined') return false;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  if (!ctx) {
    try {
      // iOS 17+: respeitar a chave de silêncio (som de jogo, não de mídia)
      try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch { /* ignore */ }
      ctx = new AC({ latencyHint: 'interactive' });
    } catch { try { ctx = new AC(); } catch { return false; } }
    master = ctx.createGain();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.connect(master);
    // "reverb" barato: atraso com realimentação filtrada (cripta)
    verbSend = ctx.createGain(); verbSend.gain.value = 0.22;
    const d1 = ctx.createDelay(1); d1.delayTime.value = 0.13;
    const d2 = ctx.createDelay(1); d2.delayTime.value = 0.21;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    verbSend.connect(d1); d1.connect(lp); lp.connect(d2); d2.connect(fb); fb.connect(d1);
    verb = ctx.createGain(); verb.gain.value = 0.6; lp.connect(verb); verb.connect(master);
    master.gain.value = 0; sfxBus.gain.value = 0; ambBus.gain.value = 0;
    configureAudio({});
    // buffer silencioso destrava o iOS antigo
    try { const b = ctx.createBuffer(1, 1, 22050); const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch { /* ignore */ }
  }
  if (ctx.state !== 'running' && !suspendedByApp) ctx.resume().catch(() => {});
  unlocked = true;
  if (wantedAmbient && !ambient) playAmbient(wantedAmbient);
  return true;
}

export function suspendAudio() {
  suspendedByApp = true;
  if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
}
export function resumeAudio() {
  suspendedByApp = false;
  if (ctx && ctx.state !== 'running' && unlocked) ctx.resume().catch(() => {});
}

// ---------- blocos de síntese ----------
let noiseBuf = null, brownBuf = null;
function makeNoise(sec, brown) {
  const len = Math.floor(ctx.sampleRate * sec);
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = rnd() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return b;
}
const white = () => (noiseBuf ||= makeNoise(2, false));
const brown = () => (brownBuf ||= makeNoise(4, true));

function env(g, t, a, peak, dur, curve = 'exp') {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + a + dur);
  else g.gain.linearRampToValueAtTime(0.0001, t + a + dur);
}

/** Oscilador com envelope. o: { f, to, dur, type, vol, delay, attack, wet, detune } */
function tone(o) {
  const t = ctx.currentTime + (o.delay || 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f * vary, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to * vary), t + (o.slide ?? o.dur));
  if (o.detune) osc.detune.value = o.detune;
  env(g, t, o.attack ?? 0.005, o.vol ?? 0.2, o.dur);
  osc.connect(g); g.connect(sfxBus);
  if (o.wet) { const s = ctx.createGain(); s.gain.value = o.wet; g.connect(s); s.connect(verbSend); }
  osc.start(t); osc.stop(t + (o.attack ?? 0.005) + o.dur + 0.05);
  track(osc);
}

/** Ruído filtrado. o: { dur, vol, f, q, type, delay, attack, to, brown, wet } */
function noise(o) {
  const t = ctx.currentTime + (o.delay || 0);
  const s = ctx.createBufferSource();
  s.buffer = o.brown ? brown() : white();
  const f = ctx.createBiquadFilter();
  f.type = o.type || 'bandpass';
  f.frequency.setValueAtTime((o.f || 1000) * vary, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.to * vary), t + o.dur);
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  env(g, t, o.attack ?? 0.002, o.vol ?? 0.2, o.dur);
  s.connect(f); f.connect(g); g.connect(sfxBus);
  if (o.wet) { const w = ctx.createGain(); w.gain.value = o.wet; g.connect(w); w.connect(verbSend); }
  s.start(t, rnd() * 1.2); s.stop(t + (o.attack ?? 0.002) + o.dur + 0.05);
  track(s);
}

/** Estalos curtos aleatórios (ossos, fogo). */
function crackle(n, spread, o = {}) {
  for (let i = 0; i < n; i++) noise({ dur: 0.012 + rnd() * 0.02, vol: (o.vol ?? 0.3) * (0.5 + rnd() * 0.5), f: (o.f ?? 2500) * (0.7 + rnd() * 0.8), q: o.q ?? 4, delay: (o.delay || 0) + rnd() * spread });
}

function track(node) {
  voices++;
  node.onended = () => { voices = Math.max(0, voices - 1); };
}

// ---------- biblioteca ----------
const SFX = {
  tap: () => { noise({ dur: 0.03, vol: 0.09, f: 2200, q: 2 }); tone({ f: 320, dur: 0.04, type: 'triangle', vol: 0.05 }); },
  deny: () => { tone({ f: 140, dur: 0.12, type: 'square', vol: 0.06 }); tone({ f: 120, dur: 0.14, type: 'square', vol: 0.05, delay: 0.09 }); },
  // soco seco: baque grave + estalo de couro
  hit: () => { tone({ f: 110, to: 50, dur: 0.12, type: 'sine', vol: 0.5 }); noise({ dur: 0.07, vol: 0.35, f: 1400, q: 1.2 }); noise({ dur: 0.05, vol: 0.12, f: 4000, q: 1, type: 'highpass' }); },
  hit_heavy: () => {
    tone({ f: 80, to: 32, dur: 0.3, type: 'sine', vol: 0.7 });
    noise({ dur: 0.18, vol: 0.45, f: 700, q: 0.8, to: 200 });
    crackle(3, 0.06, { vol: 0.2, f: 1800 });
  },
  crit: () => {
    tone({ f: 70, to: 30, dur: 0.4, type: 'sine', vol: 0.7 });
    noise({ dur: 0.25, vol: 0.5, f: 1200, q: 0.7, to: 300, wet: 0.4 });
    noise({ dur: 0.35, vol: 0.18, f: 500, q: 3, delay: 0.05, brown: true });
    tone({ f: 1900, to: 1200, dur: 0.18, type: 'sawtooth', vol: 0.04, delay: 0.01 });
  },
  // decepar: lâmina que corta + osso + jorro
  sever: () => {
    noise({ dur: 0.09, vol: 0.4, f: 5200, q: 1.5, to: 2500, type: 'bandpass' });
    crackle(5, 0.07, { vol: 0.35, f: 2200, delay: 0.04 });
    noise({ dur: 0.45, vol: 0.28, f: 900, q: 2.5, to: 320, delay: 0.08 });
    tone({ f: 90, to: 40, dur: 0.25, vol: 0.35, delay: 0.05 });
  },
  block: () => { tone({ f: 420, to: 380, dur: 0.18, type: 'triangle', vol: 0.18, wet: 0.2 }); noise({ dur: 0.08, vol: 0.3, f: 900, q: 1 }); tone({ f: 70, dur: 0.12, vol: 0.4 }); },
  // aparar: aço contra aço, metálico e brilhante
  parry: () => {
    [1840, 2630, 3310].forEach((f, i) => tone({ f, to: f * 0.985, dur: 0.5 - i * 0.1, type: 'sine', vol: 0.09, wet: 0.5 }));
    noise({ dur: 0.05, vol: 0.35, f: 6000, q: 2 });
  },
  miss: () => noise({ dur: 0.22, vol: 0.18, f: 600, to: 2600, q: 1.5 }),
  death: () => {
    tone({ f: 220, to: 55, dur: 1.6, type: 'sawtooth', vol: 0.08, wet: 0.5 });
    tone({ f: 55, to: 30, dur: 1.8, type: 'sine', vol: 0.5 });
    noise({ dur: 1.2, vol: 0.2, f: 400, q: 0.6, to: 80, brown: true });
    SFX.bell(0.6);
  },
  enemy_death: () => { tone({ f: 160, to: 45, dur: 0.5, type: 'triangle', vol: 0.18 }); noise({ dur: 0.35, vol: 0.25, f: 500, q: 1, to: 150, brown: true }); noise({ dur: 0.2, vol: 0.15, f: 900, q: 3, delay: 0.25 }); },
  heal: () => { tone({ f: 330, dur: 0.35, vol: 0.09, attack: 0.04, wet: 0.4 }); tone({ f: 495, dur: 0.45, vol: 0.07, attack: 0.06, delay: 0.08, wet: 0.4 }); noise({ dur: 0.3, vol: 0.05, f: 3000, q: 0.5, attack: 0.05 }); },
  coin: () => { tone({ f: 2093, dur: 0.12, type: 'triangle', vol: 0.08 }); tone({ f: 2637, dur: 0.18, type: 'triangle', vol: 0.07, delay: 0.06 }); noise({ dur: 0.03, vol: 0.1, f: 7000, q: 2 }); },
  // icor: gole espesso e um brilho doentio
  ichor: () => {
    for (let i = 0; i < 3; i++) tone({ f: 180 + i * 40, to: 420 + i * 60, dur: 0.09, type: 'sine', vol: 0.18, delay: i * 0.11 });
    tone({ f: 740, dur: 0.9, type: 'sine', vol: 0.05, attack: 0.2, delay: 0.25, wet: 0.6, detune: 25 });
    tone({ f: 1108, dur: 0.8, type: 'sine', vol: 0.03, attack: 0.25, delay: 0.3, wet: 0.6, detune: -30 });
  },
  step: () => { noise({ dur: 0.06, vol: 0.2, f: 300, q: 0.8, brown: true }); noise({ dur: 0.05, vol: 0.12, f: 260, q: 0.8, brown: true, delay: 0.32 }); },
  door: () => {
    tone({ f: 90, to: 140, dur: 0.6, type: 'sawtooth', vol: 0.04 });
    noise({ dur: 0.6, vol: 0.12, f: 700, q: 9, to: 1100 });
    tone({ f: 60, dur: 0.3, vol: 0.5, delay: 0.62 }); noise({ dur: 0.15, vol: 0.3, f: 400, q: 1, delay: 0.62 });
  },
  fire: () => { noise({ dur: 0.8, vol: 0.18, f: 600, q: 0.6, attack: 0.1, brown: true }); crackle(10, 0.8, { vol: 0.18, f: 3000 }); },
  camp: () => { noise({ dur: 1.4, vol: 0.12, f: 500, q: 0.5, attack: 0.3, brown: true }); crackle(14, 1.4, { vol: 0.12, f: 2600 }); tone({ f: 98, dur: 1.4, vol: 0.06, attack: 0.4 }); },
  levelup: () => {
    [130.8, 155.6, 196, 261.6].forEach((f, i) => tone({ f, dur: 1.2, type: 'sawtooth', vol: 0.05, attack: 0.15, delay: i * 0.12, wet: 0.5 }));
    SFX.ichor();
  },
  // pavor: batida de coração + agudo dissonante
  dread: () => {
    tone({ f: 55, to: 40, dur: 0.18, vol: 0.55 }); tone({ f: 55, to: 40, dur: 0.18, vol: 0.4, delay: 0.24 });
    tone({ f: 1567, dur: 1.2, type: 'sine', vol: 0.025, attack: 0.5, wet: 0.5 }); tone({ f: 1661, dur: 1.2, type: 'sine', vol: 0.025, attack: 0.5, wet: 0.5 });
  },
  corrupt: () => {
    tone({ f: 110, to: 82, dur: 1.4, type: 'sawtooth', vol: 0.07, attack: 0.3, detune: 18, wet: 0.4 });
    tone({ f: 116.5, to: 87, dur: 1.4, type: 'sawtooth', vol: 0.07, attack: 0.3, detune: -18 });
    noise({ dur: 1.1, vol: 0.12, f: 300, q: 6, to: 1200, attack: 0.3 });
    SFX.squelch(0.5);
  },
  bell: (delay = 0) => {
    // sino rachado de Valdrem: parciais inarmônicos
    const base = 196;
    [[1, 0.25, 3.5], [2.01, 0.12, 2.6], [2.76, 0.1, 2], [5.43, 0.05, 1.2], [0.5, 0.15, 4]].forEach(([m, v, d]) =>
      tone({ f: base * m, dur: d, vol: v, attack: 0.004, delay, wet: 0.6, detune: m === 2.01 ? 12 : 0 }));
    noise({ dur: 0.05, vol: 0.2, f: 3000, q: 1, delay });
  },
  siege: () => {
    // tambor de guerra + trompa grave
    for (let i = 0; i < 4; i++) { tone({ f: 70, to: 45, dur: 0.25, vol: 0.6, delay: i * 0.38 }); noise({ dur: 0.12, vol: 0.25, f: 250, q: 0.8, delay: i * 0.38, brown: true }); }
    tone({ f: 87, dur: 1.6, type: 'sawtooth', vol: 0.07, attack: 0.25, delay: 0.2, wet: 0.5 });
    tone({ f: 130.8, dur: 1.5, type: 'sawtooth', vol: 0.04, attack: 0.3, delay: 0.3, wet: 0.5 });
  },
  win: () => {
    [98, 146.8, 196].forEach((f, i) => tone({ f, dur: 1.6, type: 'sawtooth', vol: 0.05, attack: 0.08, delay: i * 0.05, wet: 0.5 }));
    tone({ f: 70, dur: 0.4, vol: 0.5 });
  },
  lose: () => {
    [196, 185, 155.6, 98].forEach((f, i) => tone({ f, dur: 0.9, type: 'triangle', vol: 0.08, delay: i * 0.32, wet: 0.5 }));
    tone({ f: 49, dur: 2.2, vol: 0.4, delay: 1 });
  },
  // grito: ruído formântico subindo e quebrando
  scream: () => {
    tone({ f: 620, to: 980, dur: 0.5, slide: 0.25, type: 'sawtooth', vol: 0.06, attack: 0.03, wet: 0.5 });
    tone({ f: 640, to: 400, dur: 0.6, slide: 0.6, type: 'sawtooth', vol: 0.04, attack: 0.2, delay: 0.3 });
    noise({ dur: 0.7, vol: 0.25, f: 1400, q: 5, to: 900, attack: 0.03 });
    noise({ dur: 0.7, vol: 0.18, f: 2600, q: 6, to: 1800, attack: 0.03 });
  },
  // osso quebrando
  bone: () => { noise({ dur: 0.02, vol: 0.6, f: 3200, q: 3 }); crackle(6, 0.05, { vol: 0.45, f: 1800, q: 6 }); tone({ f: 140, to: 60, dur: 0.1, vol: 0.35 }); },
  // sangue / carne molhada
  squelch: (delay = 0) => {
    noise({ dur: 0.18, vol: 0.32, f: 420, q: 6, to: 900, delay });
    noise({ dur: 0.22, vol: 0.22, f: 900, q: 8, to: 300, delay: delay + 0.12 });
    tone({ f: 200, to: 90, dur: 0.15, vol: 0.12, delay });
  },
  // sussurros: ruído com formantes vagando, estéreo-ish via atraso
  whisper: () => {
    for (let i = 0; i < 5; i++) {
      const f = 1600 + rnd() * 2200;
      noise({ dur: 0.18 + rnd() * 0.3, vol: 0.06 + rnd() * 0.05, f, q: 9 + rnd() * 6, to: f * (0.7 + rnd() * 0.6), delay: i * 0.17 + rnd() * 0.1, attack: 0.05, wet: 0.8 });
    }
  },
};
// apelidos tolerantes (outras áreas podem usar nomes próximos)
const ALIAS = { blood: 'squelch', gore: 'squelch', hurt: 'hit', kill: 'enemy_death', level: 'levelup', torch: 'fire', gold: 'coin', error: 'deny', break: 'bone', drink: 'ichor', pray: 'bell', horror: 'dread', flee: 'step', move: 'step' };
const NO_VARY = new Set(['bell', 'levelup', 'win', 'lose', 'death', 'siege', 'ichor', 'coin', 'heal']);
const COOLDOWN = { tap: 40, step: 120, whisper: 400, bell: 300, siege: 1200, camp: 900 };

/** Toca um efeito. Ignora silenciosamente se o áudio não estiver pronto ou o som estiver desligado. */
export function playSfx(name) {
  if (!ctx || !settings.sound || ctx.state !== 'running') return false;
  const id = SFX[name] ? name : ALIAS[name];
  const fn = SFX[id];
  if (!fn) return false;
  const now = performance.now();
  if (now - (lastPlay.get(id) || 0) < (COOLDOWN[id] ?? 35)) return false;
  if (voices > 90) return false; // proteção contra sobrecarga (combate frenético)
  lastPlay.set(id, now);
  // sons musicais (sino, nível, vitória) não variam; impactos variam ±6%
  vary = NO_VARY.has(id) ? 1 : 0.94 + rnd() * 0.12;
  try { fn(); } catch { /* nunca quebra o jogo por causa de som */ }
  vary = 1;
  return true;
}

// ---------- ambiente ----------
const AMB = {
  // [frequências do drone, filtro, ruído (vento/chuva), pulso (bpm|0), sussurros?]
  title: { notes: [36.7, 55, 82.4], cutoff: 260, wind: 0.05, pulse: 0, whisper: 0.08, bellEvery: 23 },
  city: { notes: [49, 73.4, 98], cutoff: 340, wind: 0.04, pulse: 0, whisper: 0, bellEvery: 41 },
  field: { notes: [41.2, 61.7, 87.3], cutoff: 300, wind: 0.09, pulse: 0, whisper: 0.03 },
  dark: { notes: [32.7, 49, 69.3], cutoff: 200, wind: 0.05, pulse: 0, whisper: 0.12 },
  event: { notes: [43.7, 65.4, 92.5], cutoff: 280, wind: 0.05, pulse: 0, whisper: 0.05 },
  combat: { notes: [41.2, 43.7, 61.7], cutoff: 380, wind: 0.03, pulse: 92, whisper: 0 },
  boss: { notes: [32.7, 34.6, 49], cutoff: 420, wind: 0.04, pulse: 116, whisper: 0.06 },
  siege: { notes: [36.7, 55, 58.3], cutoff: 400, wind: 0.06, pulse: 104, whisper: 0 },
  corpse: { notes: [29.1, 43.7, 46.2], cutoff: 240, wind: 0.02, pulse: 54, whisper: 0.15 },
};

/** Liga o ambiente de um tipo (troca com fade). null/'' desliga. */
export function playAmbient(kind) {
  wantedAmbient = kind || null;
  if (!kind) { stopAmbient(); return; }
  if (!ctx || !settings.music || ctx.state === 'closed') return;
  if (ambient && ambient.kind === kind) return;
  stopAmbient();
  const p = AMB[kind] || AMB.field;
  const t = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(1, t + 2.5);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = p.cutoff; lp.Q.value = 0.7;
  lp.connect(g); g.connect(ambBus);
  const nodes = [];
  const timers = [];
  // drone: dentes-de-serra levemente desafinados + LFO no filtro (respiração)
  p.notes.forEach((f, i) => {
    for (const det of [-7, 6]) {
      const o = ctx.createOscillator(); o.type = i === 0 ? 'sine' : 'sawtooth'; o.frequency.value = f; o.detune.value = det + i * 2;
      const og = ctx.createGain(); og.gain.value = i === 0 ? 0.22 : 0.06 / (i + 0.5);
      o.connect(og); og.connect(lp); o.start(t); nodes.push(o);
    }
  });
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lfoG = ctx.createGain(); lfoG.gain.value = p.cutoff * 0.45;
  lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start(t); nodes.push(lfo);
  // vento
  if (p.wind) {
    const s = ctx.createBufferSource(); s.buffer = brown(); s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6;
    const wl = ctx.createOscillator(); wl.frequency.value = 0.05; const wlg = ctx.createGain(); wlg.gain.value = 260;
    wl.connect(wlg); wlg.connect(f.frequency); wl.start(t);
    const sg = ctx.createGain(); sg.gain.value = p.wind * 2.2;
    s.connect(f); f.connect(sg); sg.connect(g); s.start(t); nodes.push(s, wl);
  }
  ambient = { kind, gain: g, nodes, timers };
  // pulso (coração/tambor) e eventos esparsos — agendados em intervalos
  if (p.pulse) {
    const ms = 60000 / p.pulse;
    let beat = 0;
    timers.push(setInterval(() => {
      if (!ctx || ctx.state !== 'running' || !settings.music) return;
      const tt = ctx.currentTime;
      const o = ctx.createOscillator(); const og = ctx.createGain();
      o.frequency.setValueAtTime(beat % 2 ? 52 : 58, tt); o.frequency.exponentialRampToValueAtTime(34, tt + 0.2);
      env(og, tt, 0.004, beat % 2 ? 0.22 : 0.32, 0.22);
      o.connect(og); og.connect(g); o.start(tt); o.stop(tt + 0.3);
      beat++;
    }, ms));
  }
  if (p.whisper) {
    timers.push(setInterval(() => {
      if (!ctx || ctx.state !== 'running' || !settings.music || rnd() > p.whisper * 4) return;
      const f = 1500 + rnd() * 2000;
      const tt = ctx.currentTime;
      const s = ctx.createBufferSource(); s.buffer = white();
      const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.setValueAtTime(f, tt); bf.frequency.exponentialRampToValueAtTime(f * 0.6, tt + 1.2); bf.Q.value = 12;
      const sg = ctx.createGain(); env(sg, tt, 0.3, 0.05, 1.1, 'lin');
      s.connect(bf); bf.connect(sg); sg.connect(g); sg.connect(verbSend); s.start(tt, rnd()); s.stop(tt + 1.6);
    }, 3100));
  }
  if (p.bellEvery) {
    timers.push(setInterval(() => {
      if (!ctx || ctx.state !== 'running' || !settings.music) return;
      const tt = ctx.currentTime;
      [[98, 0.05, 5], [197.5, 0.025, 3.5], [270, 0.02, 2.5]].forEach(([f, v, d]) => {
        const o = ctx.createOscillator(); const og = ctx.createGain(); o.frequency.value = f;
        env(og, tt, 0.004, v, d); o.connect(og); og.connect(g); og.connect(verbSend); o.start(tt); o.stop(tt + d + 0.1);
      });
    }, p.bellEvery * 1000));
  }
}

export function stopAmbient() {
  if (!ambient) return;
  const a = ambient;
  ambient = null;
  a.timers.forEach(clearInterval);
  if (!ctx) return;
  const t = ctx.currentTime;
  try { a.gain.gain.cancelScheduledValues(t); a.gain.gain.setValueAtTime(a.gain.gain.value, t); a.gain.gain.linearRampToValueAtTime(0.0001, t + 1.2); } catch { /* ignore */ }
  setTimeout(() => { a.nodes.forEach((n) => { try { n.stop(); } catch { /* ignore */ } }); try { a.gain.disconnect(); } catch { /* ignore */ } }, 1400);
}

/** Escolhe o ambiente para uma tela (o shell chama quando a tela muda). */
export function ambientForScreen(screenId, G) {
  if (!screenId) return null;
  if (screenId === 'title' || screenId === 'credits' || screenId === 'intro') return 'title';
  if (screenId === 'ending') return 'corpse';
  if (screenId === 'combat') {
    const c = G?.combat;
    if (c?.context?.source === 'siege') return 'siege';
    if (c?.context?.boss) return 'boss';
    return 'combat';
  }
  if (screenId === 'event') return G?.expedition ? 'dark' : 'event';
  if (G?.expedition) {
    if (G.expedition.region === 'r5') return 'corpse';
    const dark = (G.expedition.light ?? 1) <= 0;
    const h = (G.time ?? 8) % 24;
    return dark || h >= 20 || h < 6 ? 'dark' : 'field';
  }
  if (G?.hero || G?.campaign) return 'city';
  return 'title';
}

let wired = false;
/** Liga o áudio ao barramento e ao primeiro toque. Idempotente. */
export function initAudio(initialSettings) {
  if (initialSettings) configureAudio(initialSettings);
  if (wired || typeof window === 'undefined') return;
  wired = true;
  on('sfx', (name) => playSfx(name));
  const unlock = () => { unlockAudio(); };
  for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) window.addEventListener(ev, unlock, { capture: true, passive: true });
}
