// Gera os ícones PNG do ICOR sem dependências (PNG RGBA via zlib).
// Arte: o Olho do deus — uma gota de Icor dourada com pupila em fenda, sangrando
// sobre um fundo negro com brasa de sangue. Supersampling 3x3 para bordas limpas.
// Uso: node tools/gen-icons.mjs [pasta=game/icons]
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// ---------------- PNG ----------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) crc = CRC_TABLE[(crc ^ buf[n]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePNG(w, h, rgba) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0; // filtro: nenhum
    rgba.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------- cor ----------------
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const mix = (a, b, t) => { t = Math.max(0, Math.min(1, t)); return a.map((v, i) => v + (b[i] - v) * t); };
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// ruído de valor determinístico (textura de pedra/carne no fundo)
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(u, v) {
  const x = Math.floor(u), y = Math.floor(v), fx = u - x, fy = v - y;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x, y), b = hash2(x + 1, y), c = hash2(x, y + 1), d = hash2(x + 1, y + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const fbm = (u, v) => vnoise(u, v) * 0.55 + vnoise(u * 2.1, v * 2.1) * 0.3 + vnoise(u * 4.3, v * 4.3) * 0.15;

// ---------------- forma: gota (círculo + cone tangente) ----------------
const DROP = { cx: 0.5, cy: 0.585, r: 0.215, tipY: 0.12 };
/** distância assinada aproximada até a gota (negativa = dentro) */
function dropSDF(u, v) {
  const { cx, cy, r, tipY } = DROP;
  const dc = Math.hypot(u - cx, v - cy) - r;
  // cone: da ponta até o ponto de tangência
  const L = cy - tipY;
  const sinA = r / L;                 // meio-ângulo do cone
  const cosA = Math.sqrt(1 - sinA * sinA);
  const qx = Math.abs(u - cx), qy = v - tipY; // coords relativas à ponta (y para baixo)
  // limite do cone: até a altura de tangência
  const tY = L * cosA * cosA;
  let dcone;
  if (qy < 0) dcone = Math.hypot(qx, qy);
  else if (qy > tY) dcone = 1;
  else dcone = qx * cosA - qy * sinA;
  return Math.min(dc, dcone);
}

/** Pinta a cena em (u,v) normalizado 0..1. Retorna [r,g,b]. */
function scene(u, v) {
  // fundo: negro com brasa de sangue atrás da gota e vinheta
  const dx = u - 0.5, dy = v - 0.55;
  const rr = Math.hypot(dx, dy);
  let col = mix(hex('#4d0b0d'), hex('#0a0606'), smooth(0.05, 0.62, rr));
  const tex = fbm(u * 9, v * 9);
  col = mix(col, hex('#000000'), (tex - 0.45) * 0.55);
  // veias escuras (rachaduras de carne seca)
  const vein = Math.abs(Math.sin(u * 23 + fbm(u * 3, v * 3) * 6) * Math.sin(v * 17 + fbm(v * 4, u * 4) * 5));
  if (vein < 0.05 && rr > 0.28) col = mix(col, hex('#1a0203'), 0.6);
  // halo dourado doentio
  const sd = dropSDF(u, v);
  if (sd > 0) col = mix(col, hex('#8a5a12'), Math.max(0, 0.38 - sd * 6) * (0.7 + 0.3 * tex));

  // escorridos sob a gota (o deus sangra)
  const drips = [[0.43, 0.8, 0.93, 0.016], [0.56, 0.79, 0.88, 0.012], [0.5, 0.8, 0.97, 0.02]];
  for (const [x, y0, y1, w] of drips) {
    const t = (v - y0) / (y1 - y0);
    if (t > 0 && t < 1) {
      const ww = w * (1 - t * 0.55);
      if (Math.abs(u - x) < ww) col = mix(hex('#b8860f'), hex('#5e3b06'), t);
    }
    const db = Math.hypot(u - x, v - y1);
    if (db < w * 1.25) col = mix(hex('#d8a52a'), hex('#6e4508'), db / (w * 1.25));
  }

  if (sd <= 0) {
    // corpo da gota: ouro com luz de cima-esquerda, borda escurecida
    const lx = (u - (DROP.cx - 0.08)), ly = (v - (DROP.cy - 0.12));
    const light = 1 - Math.min(1, Math.hypot(lx, ly) / 0.38);
    col = mix(hex('#5c3a05'), hex('#e7b93a'), 0.25 + light * 0.85);
    col = mix(col, hex('#3a2203'), smooth(-0.03, 0, sd) * 0.8);
    // veios internos de icor
    const swirl = fbm(u * 7 + 3, v * 7);
    col = mix(col, hex('#fff1b0'), Math.max(0, swirl - 0.62) * 1.6);

    // olho: íris e pupila em fenda
    const ex = u - DROP.cx, ey = v - DROP.cy;
    const er = Math.hypot(ex, ey * 0.92);
    if (er < 0.125) {
      const ring = smooth(0.125, 0.105, er);
      const iris = mix(hex('#7a1206'), hex('#f2c94c'), 0.35 + 0.65 * (er / 0.125));
      const fib = 0.75 + 0.25 * Math.sin(Math.atan2(ey, ex) * 28 + fbm(u * 20, v * 20) * 3);
      col = mix(col, iris.map((c) => c * fib), ring);
      if (er > 0.112) col = mix(col, hex('#2a0703'), 0.65);
      // pupila vertical
      const pw = 0.024 * Math.sqrt(Math.max(0, 1 - (ey / 0.105) ** 2));
      if (Math.abs(ex) < pw && Math.abs(ey) < 0.105) col = hex('#090202');
      else if (Math.abs(ex) < pw + 0.006 && Math.abs(ey) < 0.11) col = mix(col, hex('#3d0805'), 0.7);
    }
    // brilho especular
    const hx = (u - (DROP.cx - 0.085)) / 0.045, hy = (v - (DROP.cy - 0.115)) / 0.075;
    const hl = hx * hx + hy * hy;
    if (hl < 1) col = mix(col, hex('#fffbe6'), (1 - hl) * 0.85);
  }
  return col;
}

export function renderIcon(size, { maskable = false } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const ss = 3;
  // maskable: a arte cabe na zona segura (círculo de 80%)
  const k = maskable ? 1.28 : 1.06;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
      const u0 = (x + (sx + 0.5) / ss) / size, v0 = (y + (sy + 0.5) / ss) / size;
      const u = 0.5 + (u0 - 0.5) * k, v = 0.5 + (v0 - 0.5) * k;
      const c = scene(u, v);
      r += c[0]; g += c[1]; b += c[2];
    }
    const i = (y * size + x) * 4;
    const n = ss * ss;
    buf[i] = Math.round(r / n); buf[i + 1] = Math.round(g / n); buf[i + 2] = Math.round(b / n); buf[i + 3] = 255;
  }
  return encodePNG(size, size, buf);
}

export const ICON_FILES = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, false],
  ['favicon-32.png', 32, false],
];

export function genIcons(out = 'game/icons') {
  mkdirSync(out, { recursive: true });
  for (const [name, size, maskable] of ICON_FILES) writeFileSync(`${out}/${name}`, renderIcon(size, { maskable }));
  return ICON_FILES.map((f) => f[0]);
}

if (process.argv[1] && /gen-icons\.mjs$/.test(process.argv[1])) {
  const out = process.argv[2] || 'game/icons';
  const files = genIcons(out);
  console.log(`ícones gerados em ${out}: ${files.join(', ')}`);
}
