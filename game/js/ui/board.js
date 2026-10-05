// Renderização do tabuleiro em canvas + animação dos eventos do combate.
import { spriteCanvas } from './sprites.js';
import { REG } from '../combat/registry.js';
import { threatMap, attackOf } from '../combat/attacks.js';
import { DIRS } from '../core/util.js';
import { sfx, vibrate } from './audio.js';

const PALETTES = {
  0: ['#5a4a33', '#8a7350', '#b39a6e'],
  1: ['#2e2a25', '#4d4740', '#706659'],
  2: ['#2c2639', '#4b4163', '#6c5d86'],
  3: ['#262a30', '#4b525b', '#767e8a'],
  4: ['#1b2130', '#333d52', '#4f5c78'],
};

const FX_COL = {
  harpoon: '#ffd76a', proj: '#ffffff', bottle: '#b58a3a', torch: '#ff8a3d', note: '#9fe8ff', spark: '#ffcf4a', zap: '#fff27a',
  light: '#fff6c0', bolt: '#d0d0d0', cannon: '#222', spore: '#9be35a', ink: '#3a1f55', wave: '#5ec8ff', lob: '#cccccc',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class BoardView {
  constructor(canvas) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.T = 48;
    this.c = null;
    this.disp = new Map();
    this.fx = [];
    this.floats = [];
    this.overlay = {};
    this.dTide = 0;
    this.shakeUntil = 0; this.shakeMag = 0;
    this.playing = false;
    this.speed = 1;
    this.raf = null;
    this.hlAttacker = null;
    this.ghostTide = null;
  }

  resize(T) {
    this.T = T;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.cv.width = Math.round(7 * T * dpr);
    this.cv.height = Math.round(8 * T * dpr);
    this.cv.style.width = 7 * T + 'px';
    this.cv.style.height = 8 * T + 'px';
  }

  setState(c, resync = true) {
    this.c = c;
    if (resync) this.sync();
  }

  sync() {
    const c = this.c;
    if (!c) return;
    const seen = new Set();
    for (const u of c.units) {
      if (u.hp <= 0) continue;
      seen.add(u.id);
      const d = this.disp.get(u.id) || {};
      Object.assign(d, {
        id: u.id, x: u.x, y: u.y, hp: u.hp, maxHp: u.maxHp, side: u.side, def: u.def, alpha: 1, dead: false, anim: null,
        sprite: u.side === 'player' ? u.sprite : u.def === 'captive' ? 'captive' : (REG.enemies[u.def] && REG.enemies[u.def].sprite) || u.def,
        boss: (u.tags || []).includes('boss'), elite: !!(REG.enemies[u.def] && REG.enemies[u.def].elite),
      });
      this.disp.set(u.id, d);
    }
    for (const id of [...this.disp.keys()]) if (!seen.has(id)) this.disp.delete(id);
    this.dTide = c.tide;
  }

  setOverlay(o) { this.overlay = o || {}; }

  tileAtPoint(px, py) {
    const x = Math.floor(px / this.T), y = Math.floor(py / this.T);
    if (x < 0 || y < 0 || x >= 7 || y >= 8) return null;
    return { x, y };
  }

  start() {
    if (this.raf) return;
    let last = 0;
    const loop = (t) => {
      this.raf = requestAnimationFrame(loop);
      if (t - last < 30 && !this.playing) return;
      last = t;
      this.draw(t);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; }

  // ---------- animação de eventos ----------
  async play(events, ui) {
    if (!events || !events.length) { this.sync(); return; }
    this.playing = true;
    const sp = this.speed || 1;
    const W = (ms) => sleep(ms / sp);
    for (const e of events) {
      const d = e.id != null ? this.disp.get(e.id) : null;
      switch (e.t) {
        case 'move': {
          if (!d || !e.path || e.path.length < 2) break;
          const per = e.push ? 150 : e.charge ? 70 : e.jump || e.dive ? 220 : 105;
          const dur = per * (e.push || e.jump || e.dive ? 1 : e.path.length - 1);
          d.anim = { path: e.path, t0: performance.now(), dur: dur / sp, jump: e.jump || e.dive };
          if (!e.push) sfx('move');
          await W(dur);
          const last = e.path[e.path.length - 1];
          d.x = last.x; d.y = last.y; d.anim = null;
          break;
        }
        case 'tp': if (d) { this.addFx('puff', { x: d.x, y: d.y, col: '#b8e0ff' }); d.x = e.x; d.y = e.y; this.addFx('puff', { x: e.x, y: e.y, col: '#b8e0ff' }); await W(160); } break;
        case 'attack': {
          this.hlAttacker = e.id;
          sfx('enemy');
          if (ui && e.name) ui.flashInfo(`⚔ ${e.name}`);
          await W(230);
          break;
        }
        case 'dmg': {
          if (d) { d.hp = Math.max(0, d.hp - e.n); d.flash = performance.now(); }
          this.float(e.x, e.y, '-' + e.n, e.el === 'fire' ? '#ff9a4d' : e.el === 'shock' ? '#fff27a' : e.el === 'water' ? '#7fd8ff' : e.el === 'pure' ? '#d9a6ff' : '#ff6b6b', e.n >= 4);
          if (d && d.side === 'player') { sfx('hurt'); vibrate(25); this.shake(5); } else sfx('hit');
          await W(120);
          break;
        }
        case 'heal': if (d) d.hp = Math.min(d.maxHp, d.hp + e.n); this.float(e.x, e.y, '+' + e.n, '#7fd36a'); sfx('heal'); await W(90); break;
        case 'block': if (d) this.float(d.x, d.y, '🛡' + e.n, '#9fd3ff'); await W(80); break;
        case 'text': this.float(e.x, e.y, e.s, e.col || '#fff'); await W(60); break;
        case 'death': {
          if (d) {
            d.dead = true;
            d.deathT = performance.now();
            if (!e.flee) { sfx('death'); this.addFx('puff', { x: e.x, y: e.y, col: d.side === 'player' ? '#ff6b6b' : '#cfd8e3' }); }
          }
          await W(e.flee ? 60 : 240);
          break;
        }
        case 'spawn': {
          const u = this.c.units.find((q) => q.id === e.id);
          if (u) {
            this.disp.set(u.id, { id: u.id, x: e.x, y: e.y, hp: u.hp, maxHp: u.maxHp, side: u.side, def: u.def, alpha: 1, spawnT: performance.now(), sprite: (REG.enemies[u.def] || {}).sprite || u.def, boss: false });
            this.addFx('puff', { x: e.x, y: e.y, col: '#9be7ff' });
          }
          await W(200);
          break;
        }
        case 'tide': {
          const from = e.from, to = e.to;
          const t0 = performance.now();
          this.tideAnim = { from, to, t0, dur: 480 / sp };
          sfx(to > from ? 'wave' : 'ebb');
          if (ui) ui.flashInfo(to > from ? `🌊 A maré sobe para ${to}` : `🏝 A maré baixa para ${to}`);
          await W(500);
          this.tideAnim = null;
          this.dTide = to;
          break;
        }
        case 'fx': await this.playFx(e, W); break;
        case 'cancel': if (d) this.float(d.x, d.y, '✕', '#ffe066', true); await W(120); break;
        case 'status': await W(25); break;
        case 'sfx': sfx(e.k); break;
        case 'shake': this.shake(e.n || 4); break;
        case 'banner': if (ui) ui.banner(e.s); await W(700); break;
        case 'skill': case 'item': await W(40); break;
        default: break;
      }
    }
    this.hlAttacker = null;
    await W(80);
    this.playing = false;
    this.sync();
  }

  async playFx(e, W) {
    const k = e.k;
    if (e.from && e.to && ['harpoon', 'proj', 'bottle', 'torch', 'note', 'spark', 'zap', 'light', 'bolt', 'cannon', 'lob', 'spore', 'ink', 'wave'].includes(k)) {
      const arc = ['bottle', 'torch', 'lob', 'cannon', 'spore', 'ink'].includes(k);
      this.addFx('proj', { from: e.from, to: e.to, col: FX_COL[k] || '#fff', arc, dur: 200 / this.speed, thick: k === 'light' || k === 'zap' });
      if (k === 'zap') sfx('zap');
      else if (k === 'harpoon') sfx('throw');
      else if (k === 'note') sfx('note');
      await W(200);
      if (['bottle', 'torch', 'cannon', 'ink', 'spore'].includes(k)) this.addFx('burst', { x: e.to.x, y: e.to.y, col: FX_COL[k], r: 0.6 });
      return;
    }
    switch (k) {
      case 'beam': this.addFx('beam', { tiles: e.tiles || [], col: e.wave ? '#5ec8ff' : '#fff2a0', dur: 280 / this.speed }); await W(240); break;
      case 'shock': this.addFx('beam', { tiles: e.tiles || [], col: '#fff27a', dur: 320 / this.speed }); sfx('zap'); vibrate(15); await W(260); break;
      case 'boom': this.addFx('burst', { x: e.x, y: e.y, col: '#ff8a3d', r: 1.5 }); this.shake(7); vibrate(30); await W(260); break;
      case 'fire': this.addFx('burst', { x: e.x, y: e.y, col: '#ff7a3d', r: 0.6 }); await W(60); break;
      case 'steam': case 'steamBig': this.addFx('puff', { x: e.x, y: e.y, col: '#e6f2ff', r: e.r || 0.6 }); await W(80); break;
      case 'splash': this.addFx('ring', { x: e.x, y: e.y, col: '#8fd8ff', r: 0.8 }); sfx('splash'); await W(120); break;
      case 'sink': this.addFx('ring', { x: e.x, y: e.y, col: '#5ec8ff', r: 1 }); sfx('splash'); await W(200); break;
      case 'fall': this.addFx('ring', { x: e.x, y: e.y, col: '#000', r: 0.8 }); await W(200); break;
      case 'bump': this.addFx('star', { x: e.x, y: e.y, col: '#ffe9a0' }); sfx('bump'); this.shake(3); await W(70); break;
      case 'shatter': this.addFx('burst', { x: e.x, y: e.y, col: '#e0e0e0', r: 0.6 }); await W(80); break;
      case 'coral': this.addFx('burst', { x: e.x, y: e.y, col: '#ee7fb0', r: 0.6 }); await W(70); break;
      case 'rise': this.addFx('puff', { x: e.x, y: e.y, col: '#e8dcc0' }); await W(100); break;
      case 'ring': this.addFx('ring', { x: e.x, y: e.y, col: '#ffe066', r: (e.r || 1) + 0.5 }); sfx('bell'); await W(260); break;
      case 'flash': this.addFx('ring', { x: e.x, y: e.y, col: e.col || '#fffbe0', r: (e.r || 1) + 0.5, fill: true }); sfx('flash'); await W(220); break;
      case 'slash': this.addFx('slash', { x: e.x, y: e.y }); await W(90); break;
      case 'spin': this.addFx('ring', { x: e.x, y: e.y, col: '#ffd76a', r: 1.4 }); await W(160); break;
      case 'net': this.addFx('burst', { x: e.x, y: e.y, col: '#d8c8a0', r: 1.2 }); await W(120); break;
      case 'whirl': this.addFx('ring', { x: e.x, y: e.y, col: '#5ec8ff', r: 1.5 }); await W(200); break;
      case 'song': this.addFx('ring', { x: e.x, y: e.y, col: '#9fe8ff', r: 2 }); sfx('note'); await W(200); break;
      case 'current': this.addFx('current', { dir: e.dir }); await W(300); break;
      case 'poison': this.addFx('puff', { x: e.x, y: e.y, col: '#9be35a', r: 1.2 }); await W(120); break;
      case 'buff': this.addFx('ring', { x: e.x, y: e.y, col: '#9fd3ff', r: 0.7 }); await W(100); break;
      case 'thrust': await W(80); break;
      case 'slam': this.addFx('ring', { x: e.x, y: e.y, col: '#ffffff', r: (e.r || 1) + 0.4 }); this.shake(4); await W(160); break;
      default: await W(60);
    }
  }

  addFx(kind, data) { this.fx.push({ kind, t0: performance.now(), dur: data.dur || 380 / this.speed, ...data }); }
  float(x, y, text, col, big = false) { this.floats.push({ x, y, text, col, t0: performance.now(), big }); }
  shake(m) { this.shakeUntil = performance.now() + 200; this.shakeMag = m; }

  // ---------- desenho ----------
  draw(now = performance.now()) {
    const c = this.c;
    const g = this.g;
    if (!c) return;
    const T = this.T;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    let sx = 0, sy = 0;
    if (now < this.shakeUntil) { sx = (Math.random() - 0.5) * this.shakeMag; sy = (Math.random() - 0.5) * this.shakeMag; }
    g.save();
    g.translate(sx, sy);
    g.clearRect(-10, -10, 7 * T + 20, 8 * T + 20);
    let tide = this.dTide;
    if (this.tideAnim) {
      const k = Math.min(1, (now - this.tideAnim.t0) / this.tideAnim.dur);
      tide = this.tideAnim.from + (this.tideAnim.to - this.tideAnim.from) * k;
    }
    const pal = PALETTES[c.tutorial ? 0 : c.district] || PALETTES[1];
    const ov = this.overlay;
    // 1. chão
    for (let y = 0; y < 8; y++) for (let x = 0; x < 7; x++) this.drawTile(g, c, x, y, pal, now);
    // 2. água
    for (let y = 0; y < 8; y++) for (let x = 0; x < 7; x++) this.drawWater(g, c, x, y, tide, now);
    if (this.ghostTide != null) this.drawGhostTide(g, c, this.ghostTide);
    // 3. objetos e saque
    for (let y = 0; y < 8; y++) for (let x = 0; x < 7; x++) this.drawObjects(g, c, x, y, now);
    // 4. destaques
    const threats = this.playing ? null : threatMap(c);
    if (threats && ov.showThreat !== false) this.drawThreats(g, c, threats, ov.selected);
    for (const s of c.incoming || []) this.drawIcon(g, s.x, s.y, '⚠', 0.45, 0.5, 0.5, 'rgba(255,200,60,0.25)');
    if (ov.reach && !this.playing) for (const n of ov.reach) {
      g.fillStyle = 'rgba(90,180,255,0.22)';
      g.fillRect(n.x * T + 2, n.y * T + 2, T - 4, T - 4);
      g.fillStyle = 'rgba(160,220,255,0.75)';
      g.beginPath(); g.arc(n.x * T + T / 2, n.y * T + T / 2, T * 0.06, 0, 7); g.fill();
    }
    if (ov.targets && !this.playing) for (const t of ov.targets) {
      const sel = ov.tgt && ov.tgt.x === t.x && ov.tgt.y === t.y;
      g.strokeStyle = sel ? '#ffffff' : 'rgba(255,215,106,0.9)';
      g.lineWidth = sel ? 3 : 2;
      g.fillStyle = sel ? 'rgba(255,215,106,0.35)' : 'rgba(255,215,106,0.14)';
      g.fillRect(t.x * T + 3, t.y * T + 3, T - 6, T - 6);
      g.strokeRect(t.x * T + 3, t.y * T + 3, T - 6, T - 6);
    }
    // 5. unidades
    const list = [...this.disp.values()].sort((a, b) => a.y - b.y);
    for (const d of list) this.drawUnit(g, c, d, now, tide);
    // 6. prévia
    if (ov.preview && !this.playing) this.drawPreview(g, c, ov.preview);
    // 7. efeitos
    this.drawFx(g, now);
    g.restore();
  }

  drawTile(g, c, x, y, pal, now) {
    const T = this.T;
    const t = c.tiles[y * 7 + x];
    const px = x * T, py = y * T;
    if (t.t === 'wall') {
      g.fillStyle = '#151a22'; g.fillRect(px, py, T, T);
      g.fillStyle = '#2a3240'; g.fillRect(px + 2, py + 2, T - 4, T * 0.62);
      g.fillStyle = '#39445a'; g.fillRect(px + 2, py + 2, T - 4, 3);
      return;
    }
    const e = Math.max(0, Math.min(2, t.e));
    g.fillStyle = pal[e] || pal[2];
    if (t.e >= 3) g.fillStyle = '#8a8070';
    g.fillRect(px, py, T, T);
    // textura sutil
    g.fillStyle = 'rgba(255,255,255,0.04)';
    if ((x + y) % 2 === 0) g.fillRect(px, py, T, T);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
    g.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
    // degrau para o vizinho de baixo mais baixo
    const below = y < 7 ? c.tiles[(y + 1) * 7 + x] : null;
    if (below && below.t !== 'wall' && below.e < t.e) {
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(px, py + T - T * 0.1 * (t.e - below.e), T, T * 0.1 * (t.e - below.e));
    }
    if (e === 2) { g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(px, py, T, 2); }
    // pontinhos de elevação
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < e; i++) g.fillRect(px + 3 + i * 4, py + 3, 2, 2);
    if (t.t === 'pit') {
      g.fillStyle = '#05080c';
      g.beginPath(); g.ellipse(px + T / 2, py + T / 2, T * 0.38, T * 0.32, 0, 0, 7); g.fill();
      g.strokeStyle = '#3a4a5a'; g.lineWidth = 2;
      g.beginPath(); g.arc(px + T / 2, py + T / 2, T * 0.2, now / 300, now / 300 + 4); g.stroke();
      for (let i = -1; i <= 1; i++) { g.fillStyle = '#556677'; g.fillRect(px + T / 2 + i * T * 0.15 - 1, py + T * 0.25, 2, T * 0.5); }
    }
    if (t.t === 'kelp') {
      g.strokeStyle = '#3f9a4f'; g.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const bx = px + T * (0.2 + i * 0.2);
        g.beginPath(); g.moveTo(bx, py + T * 0.9);
        g.quadraticCurveTo(bx + Math.sin(now / 500 + i) * T * 0.12, py + T * 0.5, bx + Math.sin(now / 400 + i) * T * 0.08, py + T * 0.15);
        g.stroke();
      }
    }
    if (t.oil) {
      g.fillStyle = 'rgba(30,18,10,0.55)';
      g.beginPath(); g.ellipse(px + T / 2, py + T / 2, T * 0.42, T * 0.34, 0, 0, 7); g.fill();
      g.strokeStyle = `hsla(${(now / 20 + x * 40) % 360},70%,60%,0.35)`; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(px + T / 2, py + T / 2, T * 0.3, T * 0.22, 0.4, 0, 4); g.stroke();
    }
    if (t.t === 'coral') {
      const col = t.hp <= 1 ? '#b9607f' : '#ee7fb0';
      g.strokeStyle = col; g.lineWidth = Math.max(2, T * 0.07); g.lineCap = 'round';
      const cx = px + T / 2, by = py + T * 0.88;
      const br = [[0, -0.6], [-0.25, -0.45], [0.25, -0.5], [-0.35, -0.2], [0.35, -0.25]];
      for (const [dx, dy] of br) { g.beginPath(); g.moveTo(cx, by); g.lineTo(cx + dx * T, by + dy * T); g.stroke(); }
      g.fillStyle = '#ffd0e4';
      for (const [dx, dy] of br) { g.beginPath(); g.arc(cx + dx * T, by + dy * T, T * 0.05, 0, 7); g.fill(); }
    }
  }

  drawWater(g, c, x, y, tide, now) {
    const T = this.T;
    const t = c.tiles[y * 7 + x];
    if (t.t === 'wall' || t.t === 'pit') return;
    const dep = tide + (t.tm || 0) - t.e;
    if (dep <= 0) {
      if (t.fire > 0) this.drawFire(g, x, y, now);
      if (t.ink > 0) { g.fillStyle = 'rgba(30,10,45,0.75)'; g.fillRect(x * T, y * T, T, T); }
      return;
    }
    const a = Math.min(1, dep);
    const deep = dep >= 2 ? 1 : Math.max(0, dep - 1);
    g.fillStyle = `rgba(${Math.round(60 - 40 * deep)},${Math.round(150 - 80 * deep)},${Math.round(200 - 70 * deep)},${0.42 * a + 0.33 * deep})`;
    g.fillRect(x * T, y * T, T, T);
    // ondinhas
    g.strokeStyle = `rgba(200,240,255,${0.18 + 0.1 * deep})`; g.lineWidth = 1;
    const ph = now / 600 + x * 0.7 + y * 1.3;
    for (let i = 0; i < 2; i++) {
      const yy = y * T + T * (0.3 + i * 0.4) + Math.sin(ph + i) * 2;
      g.beginPath();
      g.moveTo(x * T + T * 0.15, yy);
      g.quadraticCurveTo(x * T + T * 0.5, yy - 3, x * T + T * 0.85, yy);
      g.stroke();
    }
    if (deep >= 1) { g.fillStyle = 'rgba(5,20,45,0.25)'; g.fillRect(x * T, y * T, T, T); }
    if (t.fire > 0) this.drawFire(g, x, y, now);
    if (t.ink > 0) { g.fillStyle = 'rgba(30,10,45,0.75)'; g.fillRect(x * T, y * T, T, T); }
  }

  drawGhostTide(g, c, level) {
    const T = this.T;
    g.save();
    g.setLineDash([4, 3]);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 7; x++) {
      const t = c.tiles[y * 7 + x];
      if (t.t === 'wall' || t.t === 'pit') continue;
      const dep = level - t.e;
      if (dep <= 0) continue;
      g.fillStyle = dep >= 2 ? 'rgba(20,60,140,0.45)' : 'rgba(80,170,230,0.3)';
      g.fillRect(x * T + 1, y * T + 1, T - 2, T - 2);
      g.strokeStyle = dep >= 2 ? '#7fb8ff' : '#bfe8ff';
      g.strokeRect(x * T + 2, y * T + 2, T - 4, T - 4);
    }
    g.restore();
  }

  drawFire(g, x, y, now) {
    const T = this.T;
    const px = x * T, py = y * T;
    for (let i = 0; i < 4; i++) {
      const f = Math.sin(now / 90 + i * 1.7 + x) * 0.5 + 0.5;
      const hgt = T * (0.35 + 0.25 * f);
      const bx = px + T * (0.2 + i * 0.2);
      g.fillStyle = i % 2 ? 'rgba(255,120,40,0.85)' : 'rgba(255,210,80,0.85)';
      g.beginPath();
      g.moveTo(bx - T * 0.09, py + T * 0.9);
      g.quadraticCurveTo(bx, py + T * 0.9 - hgt * 1.2, bx + T * 0.09, py + T * 0.9);
      g.fill();
    }
  }

  drawObjects(g, c, x, y, now) {
    const T = this.T;
    const t = c.tiles[y * 7 + x];
    if (t.obj) {
      const name = t.obj.k === 'bell' ? 'bell' : t.obj.k;
      const s = t.obj.big ? 0.95 : 0.75;
      this.blit(g, name, x, y, s);
      if (t.obj.hp != null && t.obj.k !== 'barrel') this.pips(g, x * T + T * 0.15, y * T + T * 0.9, t.obj.hp, t.obj.hp, '#c0c0c0', T * 0.7);
      if (t.obj.big) { g.strokeStyle = 'rgba(255,224,102,0.6)'; g.lineWidth = 2; g.strokeRect(x * T + 2, y * T + 2, T - 4, T - 4); }
    }
    if (t.loot) {
      const name = t.loot.k === 'chest' ? 'chest' : t.loot.k === 'memory' ? 'memory' : 'pearl';
      const bob = Math.sin(now / 300 + x) * T * 0.03;
      this.blit(g, name, x, y + bob / T, 0.7);
    }
    const h = this.c.units.find((u) => u.side === 'player');
    if (h && h.cs && h.cs.harpoon && h.cs.harpoon.x === x && h.cs.harpoon.y === y && !h.cs.harpoon.unit) {
      this.blit(g, 'harpoon', x, y, 0.8);
      g.strokeStyle = 'rgba(255,215,106,0.8)'; g.lineWidth = 2;
      g.beginPath(); g.arc(x * T + T / 2, y * T + T / 2, T * 0.42, 0, 7); g.stroke();
    }
  }

  blit(g, name, x, y, scale = 0.8, alpha = 1) {
    const T = this.T;
    const sp = spriteCanvas(name);
    const sz = T * scale;
    g.save();
    g.globalAlpha = alpha;
    g.imageSmoothingEnabled = false;
    g.drawImage(sp, x * T + (T - sz) / 2, y * T + (T - sz) / 2, sz, sz);
    g.restore();
  }

  pips(g, x, y, hp, max, col, w) {
    if (max <= 10) {
      const n = max;
      const pw = Math.max(2, (w - (n - 1)) / n);
      for (let i = 0; i < n; i++) {
        g.fillStyle = i < hp ? col : 'rgba(0,0,0,0.55)';
        g.fillRect(x + i * (pw + 1), y, pw, 4);
      }
    } else {
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x, y, w, 4);
      g.fillStyle = col; g.fillRect(x, y, w * Math.max(0, hp) / max, 4);
    }
  }

  unitPos(d, now) {
    if (d.anim) {
      const k = Math.min(1, (now - d.anim.t0) / d.anim.dur);
      const p = d.anim.path;
      const seg = (p.length - 1) * k;
      const i = Math.min(p.length - 2, Math.floor(seg));
      const f = seg - i;
      let x = p[i].x + (p[i + 1].x - p[i].x) * f;
      let y = p[i].y + (p[i + 1].y - p[i].y) * f;
      if (d.anim.jump) y -= Math.sin(k * Math.PI) * 0.6;
      return { x, y };
    }
    return { x: d.x, y: d.y };
  }

  drawUnit(g, c, d, now, tide) {
    const T = this.T;
    const u = c.units.find((q) => q.id === d.id);
    let alpha = 1;
    if (d.dead) { alpha = Math.max(0, 1 - (now - d.deathT) / 260); if (alpha <= 0) { this.disp.delete(d.id); return; } }
    if (d.spawnT) alpha = Math.min(1, (now - d.spawnT) / 250);
    const p = this.unitPos(d, now);
    const t = c.tiles[Math.round(p.y) * 7 + Math.round(p.x)];
    const dep = t ? tide + (t.tm || 0) - t.e : 0;
    const flying = u && (u.tags || []).includes('flying');
    const sub = u && u.st && u.st.sub;
    const bob = flying ? Math.sin(now / 250 + d.id) * T * 0.05 - T * 0.06 : dep > 0 ? Math.sin(now / 400 + d.id) * T * 0.02 : 0;
    const cx = p.x * T + T / 2, cy = p.y * T + T / 2 + bob;
    // anel de equipe
    g.save();
    g.globalAlpha = alpha;
    const ring = d.side === 'player' ? '#ffd76a' : d.side === 'ally' ? '#7fd36a' : d.boss ? '#ff4040' : d.elite ? '#ff9a3d' : '#e85d5d';
    g.strokeStyle = ring; g.lineWidth = d.boss ? 3 : 2;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(p.x * T + T / 2, p.y * T + T * 0.8, T * 0.34, T * 0.12, 0, 0, 7); g.fill(); g.stroke();
    if (this.hlAttacker === d.id) {
      g.strokeStyle = '#fff'; g.lineWidth = 3;
      g.beginPath(); g.arc(cx, cy, T * 0.46, 0, 7); g.stroke();
    }
    if (this.overlay.selected === d.id) {
      g.strokeStyle = '#9fe8ff'; g.lineWidth = 2; g.setLineDash([4, 3]);
      g.strokeRect(p.x * T + 2, p.y * T + 2, T - 4, T - 4); g.setLineDash([]);
    }
    // sprite
    const scale = d.boss ? 1.0 : d.elite ? 0.9 : 0.78;
    const sz = T * scale;
    const sp = spriteCanvas(d.sprite || 'captive');
    g.imageSmoothingEnabled = false;
    if (sub) g.globalAlpha = alpha * 0.35;
    const flashOn = d.flash && now - d.flash < 160;
    g.drawImage(sp, cx - sz / 2, cy - sz / 2 - T * 0.06, sz, sz);
    if (flashOn) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.6; g.drawImage(spriteCanvas(d.sprite || 'captive', '#ffffff'), cx - sz / 2, cy - sz / 2 - T * 0.06, sz, sz); g.globalCompositeOperation = 'source-over'; }
    g.globalAlpha = alpha;
    // parte submersa
    if (dep > 0 && !flying && !sub) {
      const cover = dep >= 2 ? 0.45 : 0.25;
      g.fillStyle = dep >= 2 ? 'rgba(20,70,130,0.55)' : 'rgba(60,150,200,0.45)';
      g.fillRect(p.x * T + 3, p.y * T + T * (1 - cover) - 2, T - 6, T * cover);
    }
    // vida
    if (u || d.dead) {
      const hp = d.hp, max = d.maxHp;
      const col = d.side === 'player' ? '#7fd36a' : d.side === 'ally' ? '#7fd36a' : '#ff5a5a';
      this.pips(g, p.x * T + T * 0.12, p.y * T + T - 7, hp, max, col, T * 0.76);
      if ((max > 10 || d.boss) && d.side !== 'player') {
        g.font = `bold ${Math.round(T * 0.22)}px sans-serif`;
        g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3; g.textAlign = 'right';
        g.strokeText(hp, p.x * T + T - 3, p.y * T + T - 9); g.fillText(hp, p.x * T + T - 3, p.y * T + T - 9);
      }
    }
    // estados
    if (u && u.st) {
      const icons = [];
      for (const s of Object.keys(u.st)) {
        if (s === 'wet' && Object.keys(u.st).length > 2) continue;
        const sd = REG.statuses[s];
        if (sd) icons.push(sd.icon + (['shield', 'poison'].includes(s) && u.st[s] > 1 ? u.st[s] : ''));
      }
      if (u.side === 'player' && u.cs && u.cs.pressure) icons.push('⏬' + u.cs.pressure);
      g.font = `${Math.round(T * 0.2)}px sans-serif`; g.textAlign = 'right';
      icons.slice(0, 3).forEach((ic, i) => g.fillText(ic, p.x * T + T - 1, p.y * T + T * 0.22 + i * T * 0.21));
      // ordem da intenção
      if (u.side === 'enemy' && u.intent && !(this.isInked(c, u))) {
        const r = T * 0.15;
        g.fillStyle = u.intent.windup > 0 ? '#ff9a3d' : '#c0392b';
        g.beginPath(); g.arc(p.x * T + r + 1, p.y * T + r + 1, r, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.font = `bold ${Math.round(T * 0.2)}px sans-serif`; g.textAlign = 'center';
        g.fillText(u.intent.order, p.x * T + r + 1, p.y * T + r + 1 + T * 0.07);
      } else if (u.side === 'enemy' && this.isInked(c, u)) {
        g.fillStyle = '#b48cff'; g.font = `bold ${Math.round(T * 0.26)}px sans-serif`; g.textAlign = 'left';
        g.fillText('?', p.x * T + 3, p.y * T + T * 0.28);
      }
      if (u.side === 'player' && u.cs && u.cs.harpoon && u.cs.harpoon.unit) {
        const v = c.units.find((q) => q.id === u.cs.harpoon.unit && q.hp > 0);
        const vd = v && this.disp.get(v.id);
        if (vd) {
          const vp = this.unitPos(vd, now);
          g.strokeStyle = 'rgba(255,215,106,0.7)'; g.lineWidth = 1.5; g.setLineDash([3, 3]);
          g.beginPath(); g.moveTo(cx, cy); g.lineTo(vp.x * T + T / 2, vp.y * T + T / 2); g.stroke(); g.setLineDash([]);
        }
      }
    }
    g.restore();
  }

  isInked(c, u) {
    const t = c.tiles[u.y * 7 + u.x];
    return t && t.ink > 0;
  }

  drawThreats(g, c, threats, selected) {
    const T = this.T;
    for (const [k, e] of threats) {
      const [x, y] = k.split(',').map(Number);
      const t = c.tiles[y * 7 + x];
      if (t.ink > 0) continue;
      const from = e.from.map((id) => c.units.find((u) => u.id === id)).filter(Boolean);
      if (from.some((u) => this.isInked(c, u))) continue;
      const dim = selected && !e.from.includes(selected);
      const px = x * T, py = y * T;
      if (e.path && !e.dmg) {
        g.fillStyle = dim ? 'rgba(255,90,90,0.15)' : 'rgba(255,90,90,0.5)';
        g.beginPath(); g.arc(px + T / 2, py + T / 2, T * 0.07, 0, 7); g.fill();
        continue;
      }
      if (e.spawn) {
        g.fillStyle = 'rgba(255,160,60,0.22)'; g.fillRect(px + 2, py + 2, T - 4, T - 4);
        this.drawIcon(g, x, y, '🥚', 0.32, 0.5, 0.55);
        continue;
      }
      const a = dim ? 0.12 : Math.min(0.55, 0.22 + e.dmg * 0.07);
      g.fillStyle = e.windup ? `rgba(255,150,40,${a})` : `rgba(230,40,40,${a})`;
      g.fillRect(px + 1, py + 1, T - 2, T - 2);
      g.strokeStyle = dim ? 'rgba(255,80,80,0.25)' : (e.windup ? 'rgba(255,170,60,0.9)' : 'rgba(255,90,90,0.9)');
      g.lineWidth = 2;
      if (e.windup) g.setLineDash([5, 4]);
      g.strokeRect(px + 2, py + 2, T - 4, T - 4);
      g.setLineDash([]);
      if (e.dmg > 0 && !dim) {
        const fs = Math.round(T * 0.22);
        g.font = `bold ${fs}px sans-serif`; g.textAlign = 'center';
        const label = '⚔' + e.dmg;
        const tw = g.measureText(label).width + 8;
        g.fillStyle = e.windup ? 'rgba(150,80,10,0.92)' : 'rgba(120,10,10,0.92)';
        g.fillRect(px + T / 2 - tw / 2, py + 2, tw, fs + 4);
        g.fillStyle = '#fff';
        g.fillText(label, px + T / 2, py + fs + 1);
      }
      if (e.push.length && !dim) {
        const d = DIRS[e.push[0]];
        g.strokeStyle = '#fff'; g.lineWidth = 2.5;
        const cx = px + T / 2, cy = py + T / 2;
        const ex = cx + d.x * T * 0.38, ey = cy + d.y * T * 0.38;
        g.beginPath(); g.moveTo(cx + d.x * T * 0.1, cy + d.y * T * 0.1); g.lineTo(ex, ey); g.stroke();
        g.beginPath();
        g.moveTo(ex, ey);
        g.lineTo(ex - d.x * 6 - d.y * 5, ey - d.y * 6 - d.x * 5);
        g.moveTo(ex, ey);
        g.lineTo(ex - d.x * 6 + d.y * 5, ey - d.y * 6 + d.x * 5);
        g.stroke();
      }
    }
  }

  drawIcon(g, x, y, ic, size, ax = 0.5, ay = 0.5, bg = null) {
    const T = this.T;
    if (bg) { g.fillStyle = bg; g.fillRect(x * T + 2, y * T + 2, T - 4, T - 4); }
    g.font = `${Math.round(T * size)}px sans-serif`; g.textAlign = 'center';
    g.fillText(ic, x * T + T * ax, y * T + T * ay + T * size * 0.35);
  }

  drawPreview(g, c, pv) {
    const T = this.T;
    for (const t of pv.tiles || []) {
      if (t.fire) this.drawIcon(g, t.x, t.y, '🔥', 0.3, 0.8, 0.25);
      if (t.oil && !t.fire) this.drawIcon(g, t.x, t.y, '🛢', 0.26, 0.8, 0.25);
      if (t.t === 'coral') this.drawIcon(g, t.x, t.y, '🪸', 0.3, 0.8, 0.25);
    }
    for (const u of pv.units) {
      if (u.spawn) continue;
      const moved = u.nx !== u.x || u.ny !== u.y;
      if (moved) {
        const d = this.disp.get(u.id);
        if (d) {
          g.save(); g.globalAlpha = 0.45;
          const sz = T * 0.7;
          g.imageSmoothingEnabled = false;
          g.drawImage(spriteCanvas(d.sprite || 'captive'), u.nx * T + (T - sz) / 2, u.ny * T + (T - sz) / 2, sz, sz);
          g.restore();
        }
        g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.setLineDash([4, 3]);
        g.beginPath(); g.moveTo(u.x * T + T / 2, u.y * T + T / 2); g.lineTo(u.nx * T + T / 2, u.ny * T + T / 2); g.stroke(); g.setLineDash([]);
      }
      const tx = moved ? u.nx : u.x, ty = moved ? u.ny : u.y;
      if (u.dead) {
        this.drawIcon(g, tx, ty, '💀', 0.42, 0.5, 0.5, 'rgba(0,0,0,0.25)');
      } else if (u.dmg > 0) {
        g.font = `bold ${Math.round(T * 0.3)}px sans-serif`; g.textAlign = 'center';
        g.fillStyle = u.side === 'player' ? '#ff9a9a' : '#ffe066'; g.strokeStyle = '#000'; g.lineWidth = 4;
        g.strokeText('-' + u.dmg, tx * T + T / 2, ty * T + T * 0.36); g.fillText('-' + u.dmg, tx * T + T / 2, ty * T + T * 0.36);
      }
      if (u.st && u.st.length && !u.dead) {
        const icons = u.st.map((s) => (REG.statuses[s] ? REG.statuses[s].icon : '')).join('');
        g.font = `${Math.round(T * 0.2)}px sans-serif`; g.textAlign = 'center';
        g.fillText(icons, tx * T + T / 2, ty * T + T * 0.95);
      }
    }
  }

  drawFx(g, now) {
    const T = this.T;
    this.fx = this.fx.filter((f) => now - f.t0 < f.dur);
    for (const f of this.fx) {
      const k = (now - f.t0) / f.dur;
      g.save();
      switch (f.kind) {
        case 'proj': {
          const x = f.from.x + (f.to.x - f.from.x) * k, y = f.from.y + (f.to.y - f.from.y) * k - (f.arc ? Math.sin(k * Math.PI) * 1.2 : 0);
          g.fillStyle = f.col;
          g.beginPath(); g.arc(x * T + T / 2, y * T + T / 2, T * (f.thick ? 0.14 : 0.1), 0, 7); g.fill();
          if (f.thick || !f.arc) {
            g.strokeStyle = f.col; g.globalAlpha = 0.5; g.lineWidth = f.thick ? 4 : 2;
            g.beginPath(); g.moveTo(f.from.x * T + T / 2, f.from.y * T + T / 2); g.lineTo(x * T + T / 2, y * T + T / 2); g.stroke();
          }
          break;
        }
        case 'beam':
          g.globalAlpha = 1 - k;
          g.fillStyle = f.col;
          for (const t of f.tiles) g.fillRect(t.x * T + 4, t.y * T + 4, T - 8, T - 8);
          break;
        case 'burst':
          g.globalAlpha = 1 - k;
          g.fillStyle = f.col;
          g.beginPath(); g.arc(f.x * T + T / 2, f.y * T + T / 2, T * (f.r || 1) * (0.3 + 0.7 * k), 0, 7); g.fill();
          break;
        case 'ring':
          g.globalAlpha = 1 - k;
          g.strokeStyle = f.col; g.lineWidth = 3;
          if (f.fill) { g.fillStyle = f.col; g.globalAlpha = (1 - k) * 0.5; }
          g.beginPath(); g.arc(f.x * T + T / 2, f.y * T + T / 2, T * (f.r || 1) * k, 0, 7);
          if (f.fill) g.fill(); else g.stroke();
          break;
        case 'puff':
          g.globalAlpha = (1 - k) * 0.8;
          g.fillStyle = f.col;
          for (let i = 0; i < 5; i++) {
            const a = i * 1.26 + f.t0;
            g.beginPath(); g.arc(f.x * T + T / 2 + Math.cos(a) * T * 0.3 * k, f.y * T + T / 2 + Math.sin(a) * T * 0.3 * k - k * T * 0.2, T * 0.13 * (f.r || 1), 0, 7); g.fill();
          }
          break;
        case 'star':
          g.globalAlpha = 1 - k; g.fillStyle = f.col;
          g.font = `${Math.round(T * 0.5)}px sans-serif`; g.textAlign = 'center';
          g.fillText('💥', f.x * T + T / 2, f.y * T + T * 0.65);
          break;
        case 'slash':
          g.globalAlpha = 1 - k; g.strokeStyle = '#fff'; g.lineWidth = 3;
          g.beginPath(); g.moveTo(f.x * T + T * 0.2, f.y * T + T * 0.2); g.lineTo(f.x * T + T * (0.2 + 0.6 * Math.min(1, k * 2)), f.y * T + T * (0.2 + 0.6 * Math.min(1, k * 2))); g.stroke();
          break;
        case 'current': {
          const d = DIRS[f.dir];
          g.globalAlpha = 0.6 * (1 - k); g.strokeStyle = '#9fe8ff'; g.lineWidth = 2;
          for (let i = 0; i < 6; i++) {
            const bx = (i * 1.3 + 0.5) % 7, by = (i * 2.1 + 0.5) % 8;
            const sx = bx * T + d.x * k * T * 2, sy = by * T + d.y * k * T * 2;
            g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + d.x * T * 0.6, sy + d.y * T * 0.6); g.stroke();
          }
          break;
        }
        default: break;
      }
      g.restore();
    }
    // textos flutuantes
    this.floats = this.floats.filter((f) => now - f.t0 < 900);
    for (const f of this.floats) {
      const k = (now - f.t0) / 900;
      g.save();
      g.globalAlpha = 1 - k * k;
      g.font = `bold ${Math.round(T * (f.big ? 0.4 : 0.3))}px sans-serif`;
      g.textAlign = 'center';
      g.strokeStyle = '#000'; g.lineWidth = 4;
      const x = f.x * T + T / 2, y = f.y * T + T * 0.3 - k * T * 0.6;
      g.strokeText(f.text, x, y); g.fillStyle = f.col; g.fillText(f.text, x, y);
      g.restore();
    }
  }
}
