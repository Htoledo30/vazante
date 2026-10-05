// Gera os ícones PNG do app (sem dependências): arpão dourado sobre o mar ao entardecer.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// Cena em coordenadas normalizadas 0..1; retorna cor RGB.
function scene(u, v, safe) {
  // céu → mar
  const sky1 = hex('#0b1622'), sky2 = hex('#1f4a6e'), sun = hex('#e8c170');
  let col = mix(sky1, sky2, Math.min(1, v * 1.4));
  // sol
  const dx = u - 0.5, dy = v - 0.56;
  const ds = Math.sqrt(dx * dx + dy * dy);
  if (ds < 0.2) col = mix(col, sun, Math.min(1, (0.2 - ds) * 12));
  else if (ds < 0.34) col = mix(col, sun, (0.34 - ds) * 0.9);
  // mar com ondas
  const waveY = 0.6 + Math.sin(u * 18) * 0.012;
  if (v > waveY) {
    const deep = hex('#123553'), lite = hex('#2f8fbf');
    col = mix(lite, deep, Math.min(1, (v - waveY) * 2.4));
    if (Math.abs(Math.sin((v - waveY) * 60 + Math.sin(u * 9) * 1.5)) < 0.12 && v < 0.92) col = mix(col, hex('#9fe8ff'), 0.5);
  }
  // torres afogadas
  const tower = (x0, x1, top) => u > x0 && u < x1 && v > top && v < 0.66;
  if (tower(0.18, 0.24, 0.42) || tower(0.76, 0.81, 0.38) || tower(0.3, 0.34, 0.5) || tower(0.66, 0.7, 0.48)) col = mix(col, hex('#0e2235'), 0.85);
  // arpão (diagonal) — haste
  const ax = 0.27, ay = 0.82, bx = 0.73, by = 0.2;
  const vx = bx - ax, vy = by - ay;
  const t = ((u - ax) * vx + (v - ay) * vy) / (vx * vx + vy * vy);
  const px = ax + t * vx, py = ay + t * vy;
  const d = Math.hypot(u - px, v - py);
  if (t > 0 && t < 0.86 && d < 0.022) col = mix(hex('#8c5d1d'), hex('#d39a3e'), d < 0.012 ? 1 : 0.4);
  // ponta
  if (t >= 0.84 && t < 1.03) {
    const w = (1.03 - t) * 0.42;
    if (d < w) col = mix(hex('#f4d35e'), hex('#fff6c0'), d < w * 0.4 ? 0.7 : 0);
  }
  // farpa
  const bxp = ax + 0.8 * vx, byp = ay + 0.8 * vy;
  const db = Math.hypot(u - (bxp + 0.06), v - (byp + 0.05));
  if (db < 0.028 && t > 0.7 && t < 0.86) col = hex('#f4d35e');
  // moldura segura (maskable): nada a fazer, a cena preenche tudo
  void safe;
  return col;
}

function render(size, safe = false) {
  const buf = Buffer.alloc(size * size * 4);
  const ss = 3;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      let u = (x + (sx + 0.5) / ss) / size, v = (y + (sy + 0.5) / ss) / size;
      if (safe) { u = 0.5 + (u - 0.5) * 1.25; v = 0.5 + (v - 0.5) * 1.25; }
      const c = scene(u, v, safe);
      r += c[0]; g += c[1]; b += c[2];
    }
    const i = (y * size + x) * 4;
    buf[i] = r / (ss * ss); buf[i + 1] = g / (ss * ss); buf[i + 2] = b / (ss * ss); buf[i + 3] = 255;
  }
  return png(size, size, buf);
}

const out = process.argv[2] || 'game/icons';
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/icon-512.png`, render(512));
writeFileSync(`${out}/icon-192.png`, render(192));
writeFileSync(`${out}/apple-touch-icon.png`, render(180));
writeFileSync(`${out}/icon-maskable-512.png`, render(512, true));
console.log('ícones gerados em', out);
