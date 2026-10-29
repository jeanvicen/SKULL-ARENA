#!/usr/bin/env node
/**
 * npm run icons — desenha o ícone do app (caveira pixel art) e gera os PNGs do PWA:
 *   public/icons/icon-192.png, icon-512.png, icon-180.png (iPhone), maskable-512.png, favicon-32.png
 * Sem dependências: desenha numa grade 32×32 e amplia com escala inteira (pixels nítidos).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const N = 32;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const C = {
  bg: hex('#140c22'),
  bg2: hex('#2a1452'),
  ink: hex('#160d22'),
  b0: hex('#fff8ea'),
  b1: hex('#efe6d2'),
  b2: hex('#d6c6a4'),
  b3: hex('#a8936c'),
  pink: hex('#ff3df2'),
  cyan: hex('#3df2ff'),
  dark: hex('#1a0d24'),
  white: hex('#ffffff'),
};

function drawSkull() {
  const g = Array.from({ length: N }, () => new Array(N).fill(null));
  const set = (x, y, c) => {
    if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c;
  };
  const ell = (cx, cy, rx, ry, c) => {
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) set(x, y, c);
      }
  };
  const rect = (x0, y0, w, h, c) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, c);
  };
  // contorno + crânio
  ell(16, 13, 12, 11, C.ink);
  rect(8, 18, 16, 9, C.ink);
  ell(16, 13, 11, 10, C.b1);
  rect(9, 18, 14, 8, C.b1);
  ell(13, 8, 6, 4, C.b0);
  rect(9, 23, 14, 2, C.b2);
  rect(22, 12, 2, 10, C.b2);
  // olhos neon
  for (const [ex, col] of [
    [11, C.pink],
    [21, C.cyan],
  ]) {
    ell(ex, 15, 3.6, 3.4, C.ink);
    ell(ex, 15.2, 2.8, 2.6, C.dark);
    ell(ex, 15.5, 1.4, 1.4, col);
    set(ex - 1, 15, C.white);
  }
  // nariz
  rect(15, 19, 2, 3, C.dark);
  // dentes
  rect(10, 23, 12, 1, C.ink);
  for (let x = 10; x < 22; x += 2) {
    rect(x, 24, 1, 2, C.b0);
    rect(x + 1, 24, 1, 2, C.b3);
  }
  rect(9, 26, 14, 1, C.ink);
  // rachadura
  for (const [x, y] of [
    [19, 4],
    [18, 5],
    [18, 6],
    [19, 7],
    [18, 8],
  ])
    set(x, y, C.b3);
  return g;
}

function render(size, pad, round) {
  const skull = drawSkull();
  const px = new Uint8Array(size * size * 4);
  const scale = Math.floor((size * (1 - pad * 2)) / N);
  const off = Math.floor((size - N * scale) / 2);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      // fundo com degradê radial (em degraus = pixel)
      const d = Math.hypot(x - size / 2, y - size / 2) / (size / 2);
      const t = Math.min(1, Math.floor(d * 6) / 6);
      let c = [Math.round(C.bg2[0] * (1 - t) + C.bg[0] * t), Math.round(C.bg2[1] * (1 - t) + C.bg[1] * t), Math.round(C.bg2[2] * (1 - t) + C.bg[2] * t), 255];
      if (round && d > 0.98) c = [0, 0, 0, 0];
      const sx = Math.floor((x - off) / scale);
      const sy = Math.floor((y - off) / scale);
      if (sx >= 0 && sy >= 0 && sx < N && sy < N && skull[sy][sx]) c = skull[sy][sx];
      px.set(c, (y * size + x) * 4);
    }
  return png(size, size, px);
}

// ---------------------------------------------------------------- PNG mínimo
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const out = join(process.cwd(), 'public', 'icons');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'icon-512.png'), render(512, 0.08, false));
writeFileSync(join(out, 'icon-192.png'), render(192, 0.08, false));
writeFileSync(join(out, 'icon-180.png'), render(180, 0.08, false));
writeFileSync(join(out, 'maskable-512.png'), render(512, 0.2, false));
writeFileSync(join(out, 'favicon-32.png'), render(32, 0, false));
console.log('✔ ícones gerados em public/icons/');
