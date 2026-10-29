/**
 * BUFFER DE PIXELS (sem anti-aliasing)
 * ------------------------------------
 * Toda a pixel art do jogo é desenhada aqui, pixel por pixel, com cores exatas.
 * Cada pixel guarda a COR e o ID da PEÇA (pra sombrear e contornar depois).
 */

const cache = new Map<string, number>();

/** Cor "#rrggbb" → inteiro no formato do ImageData (little-endian: AABBGGRR). */
export function rgba(hex: string, a = 255): number {
  const key = hex + a;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let h = hex.replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const n = parseInt(h.slice(0, 6), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const v = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  cache.set(key, v);
  return v;
}

export const CLEAR = 0;

export class PixelBuffer {
  readonly data: Uint32Array;
  readonly part: Int16Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint32Array(w * h);
    this.part = new Int16Array(w * h).fill(-1);
  }

  clear(): void {
    this.data.fill(0);
    this.part.fill(-1);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  get(x: number, y: number): number {
    return this.inside(x, y) ? this.data[y * this.w + x]! : 0;
  }

  partAt(x: number, y: number): number {
    return this.inside(x, y) ? this.part[y * this.w + x]! : -1;
  }

  /** Pinta 1 pixel. `mask` = só pinta se o pixel já for daquela peça. */
  set(x: number, y: number, c: number, part = -2, mask = -1): void {
    x |= 0;
    y |= 0;
    if (!this.inside(x, y)) return;
    const i = y * this.w + x;
    if (mask >= 0 && this.part[i] !== mask) return;
    this.data[i] = c;
    if (part !== -2) this.part[i] = part;
  }

  fillRect(x: number, y: number, w: number, h: number, c: number, part = -2, mask = -1): void {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) for (let xx = Math.round(x); xx < Math.round(x + w); xx++) this.set(xx, yy, c, part, mask);
  }

  /** Polígono (lista x0,y0,x1,y1...) — preenchimento por varredura, amostrando o centro do pixel. */
  fillPoly(pts: ArrayLike<number>, c: number, part = -2, mask = -1): void {
    const n = pts.length / 2;
    if (n < 3) return;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      const y = pts[i * 2 + 1]!;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(this.h - 1, Math.ceil(maxY));
    const xs: number[] = [];
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2]!;
        const ay = pts[i * 2 + 1]!;
        const j = (i + 1) % n;
        const bx = pts[j * 2]!;
        const by = pts[j * 2 + 1]!;
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k]! - 0.5));
        const xb = Math.min(this.w - 1, Math.floor(xs[k + 1]! - 0.5));
        for (let x = xa; x <= xb; x++) this.set(x, y, c, part, mask);
      }
    }
  }

  fillEllipse(cx: number, cy: number, rx: number, ry: number, c: number, part = -2, mask = -1): void {
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) / ry;
      if (Math.abs(dy) > 1) continue;
      const half = rx * Math.sqrt(1 - dy * dy);
      for (let x = Math.ceil(cx - half - 0.5); x <= Math.floor(cx + half - 0.5); x++) this.set(x, y, c, part, mask);
    }
  }

  /** Linha de 1 pixel (Bresenham). */
  line(x0: number, y0: number, x1: number, y1: number, c: number, part = -2, mask = -1): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 512; guard++) {
      this.set(x0, y0, c, part, mask);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Cápsula afunilada de (x0,y0) a (x1,y1) com raios r0 e r1. */
  capsule(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, c: number, part = -2, mask = -1): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    this.fillPoly([x0 + nx * r0, y0 + ny * r0, x1 + nx * r1, y1 + ny * r1, x1 - nx * r1, y1 - ny * r1, x0 - nx * r0, y0 - ny * r0], c, part, mask);
    this.fillEllipse(x0, y0, r0, r0, c, part, mask);
    this.fillEllipse(x1, y1, r1, r1, c, part, mask);
  }

  /** Copia pra um ImageData/canvas. */
  toCanvas(target?: HTMLCanvasElement | OffscreenCanvas): HTMLCanvasElement | OffscreenCanvas {
    const c = target ?? newCanvas(this.w, this.h);
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    const img = g.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.data);
    g.putImageData(img, 0, 0);
    return c;
  }
}

export function newCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  w = Math.max(1, Math.ceil(w));
  h = Math.max(1, Math.ceil(h));
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Sombreamento estilo pixel art 16-bit, a partir do ID das peças:
 *  • borda de baixo/direita da peça → sombra (luz vem de cima-esquerda)
 *  • borda de cima/esquerda → luz
 *  • metade "de trás" das peças grandes → sombra suave (volume)
 *  • onde uma peça encosta numa peça que está ATRÁS → linha interna escura (sel-out)
 * `ramps[part]` = [escuro, sombra, base, luz, brilho]
 */
export function shade(buf: PixelBuffer, ramps: Array<number[] | null>, opts: { form?: Set<number>; noInner?: Set<number>; flat?: Set<number> } = {}): void {
  const { w, h, part, data } = buf;
  const n = ramps.length;
  // centro e tamanho de cada peça (pro sombreado de volume)
  const sx = new Float64Array(n);
  const sy = new Float64Array(n);
  const cnt = new Float64Array(n);
  const minX = new Float64Array(n).fill(1e9);
  const maxX = new Float64Array(n).fill(-1e9);
  const minY = new Float64Array(n).fill(1e9);
  const maxY = new Float64Array(n).fill(-1e9);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = part[y * w + x]!;
      if (p < 0 || p >= n) continue;
      sx[p]! += x;
      sy[p]! += y;
      cnt[p]!++;
      if (x < minX[p]!) minX[p] = x;
      if (x > maxX[p]!) maxX[p] = x;
      if (y < minY[p]!) minY[p] = y;
      if (y > maxY[p]!) maxY[p] = y;
    }
  const out = new Uint32Array(data);
  const P = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : part[y * w + x]!);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const p = part[i]!;
      if (p < 0 || p >= n) continue;
      const r = ramps[p];
      if (!r || opts.flat?.has(p)) continue;
      // se o pixel não é a cor base da peça (detalhe já pintado), não mexe
      if (data[i] !== r[2]) continue;
      let c = r[2]!;
      const cx = sx[p]! / Math.max(1, cnt[p]!);
      const cy = sy[p]! / Math.max(1, cnt[p]!);
      const ext = Math.max(2, Math.max(maxX[p]! - minX[p]!, maxY[p]! - minY[p]!) * 0.5);
      if (opts.form?.has(p)) {
        const d = ((x - cx) * 0.6 + (y - cy) * 0.8) / ext;
        if (d > 0.42) c = r[1]!;
      }
      const right = P(x + 1, y) !== p;
      const down = P(x, y + 1) !== p;
      const diag = P(x + 1, y + 1) !== p;
      const left = P(x - 1, y) !== p;
      const up = P(x, y - 1) !== p;
      if (right || down || diag) c = r[1]!;
      else if (up || left) c = r[3]!;
      // linha interna: encosta numa peça que está atrás (ID menor)
      if (!opts.noInner?.has(p)) {
        for (const [ox, oy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const q = P(x + ox!, y + oy!);
          if (q >= 0 && q < p && !sameGroup(p, q)) {
            c = r[0]!;
            break;
          }
        }
      }
      out[i] = c;
    }
  }
  data.set(out);
}

/** peças que não precisam de linha entre si (mesmo "material") */
let groups: Int16Array | null = null;
export function setGroups(g: Int16Array | null): void {
  groups = g;
}
function sameGroup(a: number, b: number): boolean {
  return !!groups && groups[a]! >= 0 && groups[a] === groups[b];
}

/** Contorno externo de 1 pixel em volta de tudo que é opaco. */
export function outline(buf: PixelBuffer, ink: number): void {
  const { w, h, data } = buf;
  const src = new Uint32Array(data);
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x]! >>> 24 > 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (opaque(x, y)) continue;
      if (opaque(x + 1, y) || opaque(x - 1, y) || opaque(x, y + 1) || opaque(x, y - 1)) data[y * w + x] = ink;
    }
}
