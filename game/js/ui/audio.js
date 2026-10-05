// Áudio sintetizado com WebAudio (sem arquivos). Só inicia após um toque do jogador
// (exigência do Safari) e respeita os controles de som.
let ctx = null;
let master = null, sfxBus = null, musicBus = null;
let ambient = null;
let settings = { sound: true, music: true, vol: 0.8 };

export function configureAudio(s) {
  settings = { ...settings, ...s };
  if (!ctx) return;
  master.gain.value = settings.vol;
  sfxBus.gain.value = settings.sound ? 1 : 0;
  musicBus.gain.value = settings.music ? 0.55 : 0;
}

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { return; }
    master = ctx.createGain(); master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(master);
    configureAudio({});
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function suspendAudio() { if (ctx && ctx.state === 'running') ctx.suspend().catch(() => {}); }
export function resumeAudio() { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }

function noiseBuffer(sec = 1, brown = false) {
  const len = Math.floor(ctx.sampleRate * sec);
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
  }
  return b;
}
let nb = null;

function tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sfxBus);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(dur, vol = 0.3, freq = 800, q = 1, type = 'bandpass', delay = 0) {
  if (!nb) nb = noiseBuffer(1.5);
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = nb;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxBus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

const SFX = {
  tap: () => tone(660, 0.05, 'triangle', 0.08),
  move: () => noise(0.12, 0.08, 500, 0.8),
  hit: () => { noise(0.1, 0.25, 1500, 1.2); tone(140, 0.12, 'square', 0.12, -60); },
  bump: () => { tone(90, 0.18, 'sine', 0.35, -40); noise(0.12, 0.2, 300, 1); },
  throw: () => noise(0.18, 0.15, 2400, 2, 'highpass'),
  pull: () => { tone(220, 0.2, 'sawtooth', 0.08, 180); },
  boom: () => { noise(0.5, 0.5, 200, 0.7, 'lowpass'); tone(60, 0.4, 'sine', 0.4, -30); },
  fire: () => noise(0.4, 0.2, 900, 0.5),
  zap: () => { tone(880, 0.08, 'square', 0.1, 600); tone(1200, 0.12, 'square', 0.06, -500, 0.05); },
  bell: () => { tone(392, 1.2, 'sine', 0.25); tone(784, 0.9, 'sine', 0.12); tone(1180, 0.6, 'sine', 0.06); },
  wave: () => noise(0.9, 0.25, 600, 0.4, 'lowpass'),
  ebb: () => noise(0.7, 0.18, 1200, 0.4, 'bandpass'),
  coin: () => { tone(988, 0.08, 'triangle', 0.12); tone(1319, 0.14, 'triangle', 0.12, 0, 0.07); },
  heal: () => { tone(523, 0.15, 'sine', 0.12); tone(784, 0.25, 'sine', 0.1, 0, 0.1); },
  hurt: () => { tone(200, 0.2, 'sawtooth', 0.15, -120); noise(0.15, 0.2, 900, 1); },
  death: () => { tone(300, 0.4, 'triangle', 0.15, -220); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, 0, i * 0.09)); },
  lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'triangle', 0.12, 0, i * 0.15)); },
  level: () => { [523, 784, 1047, 1568].forEach((f, i) => tone(f, 0.3, 'sine', 0.1, 0, i * 0.08)); },
  note: () => { tone(740, 0.3, 'sine', 0.12); tone(1110, 0.25, 'sine', 0.05, 0, 0.05); },
  flash: () => { noise(0.25, 0.2, 4000, 0.5, 'highpass'); tone(1600, 0.2, 'sine', 0.08, -800); },
  splash: () => noise(0.35, 0.22, 900, 0.6),
  enemy: () => tone(180, 0.12, 'triangle', 0.08),
  error: () => tone(160, 0.15, 'square', 0.08),
  page: () => noise(0.12, 0.06, 3000, 0.7),
};

export function sfx(name) {
  if (!ctx || !settings.sound || ctx.state !== 'running') return;
  const f = SFX[name];
  if (f) try { f(); } catch (e) { /* ignora */ }
}

// Ambiente: mar (ruído marrom com ondulação) + acorde lento por distrito.
const CHORDS = {
  0: [130.8, 196, 261.6], // vila
  1: [110, 164.8, 220],
  2: [123.5, 185, 246.9],
  3: [98, 146.8, 196, 293.7],
  4: [87.3, 130.8, 174.6, 207.7],
};

export function playAmbient(key = 0) {
  if (!ctx) return;
  if (ambient && ambient.key === key) return;
  stopAmbient();
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(0.5, t + 2);
  out.connect(musicBus);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(4, true);
  src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
  const wg = ctx.createGain(); wg.gain.value = 0.25;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
  const lfoG = ctx.createGain(); lfoG.gain.value = 0.18;
  lfo.connect(lfoG); lfoG.connect(wg.gain);
  src.connect(lp); lp.connect(wg); wg.connect(out);
  src.start(); lfo.start();
  const oscs = [];
  for (const f of CHORDS[key] || CHORDS[0]) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = 0.025;
    const l2 = ctx.createOscillator(); l2.frequency.value = 0.05 + Math.random() * 0.07;
    const l2g = ctx.createGain(); l2g.gain.value = 0.02;
    l2.connect(l2g); l2g.connect(g.gain);
    o.connect(g); g.connect(out); o.start(); l2.start();
    oscs.push(o, l2);
  }
  ambient = { key, out, nodes: [src, lfo, ...oscs] };
}

export function stopAmbient() {
  if (!ambient || !ctx) return;
  const a = ambient; ambient = null;
  const t = ctx.currentTime;
  try {
    a.out.gain.cancelScheduledValues(t);
    a.out.gain.setValueAtTime(a.out.gain.value, t);
    a.out.gain.exponentialRampToValueAtTime(0.0001, t + 1);
  } catch (e) { /* */ }
  setTimeout(() => { for (const n of a.nodes) try { n.stop(); } catch (e) { /* */ } try { a.out.disconnect(); } catch (e) { /* */ } }, 1200);
}

export function vibrate(ms = 15) {
  try { if (navigator.vibrate && settings.sound) navigator.vibrate(ms); } catch (e) { /* */ }
}
