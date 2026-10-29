/**
 * Primitivas de desenho "pixel perfeito" num canvas 2D comum (coordenadas inteiras,
 * sem anti-aliasing): retângulos, círculos, anéis, linhas e polígonos por varredura.
 * Usadas pelo mapa, efeitos e HUD em pixel art.
 */

type G = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function pixRect(g: G, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Círculo/elipse cheio (spans horizontais). */
export function pixEllipse(g: G, cx: number, cy: number, rx: number, ry: number, c: string): void {
  g.fillStyle = c;
  const y0 = Math.floor(cy - ry);
  const y1 = Math.ceil(cy + ry);
  for (let y = y0; y <= y1; y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const half = rx * Math.sqrt(1 - dy * dy);
    const xa = Math.ceil(cx - half - 0.5);
    const xb = Math.floor(cx + half - 0.5);
    if (xb >= xa) g.fillRect(xa, y, xb - xa + 1, 1);
  }
}

/** Anel (contorno de elipse) com espessura `t` pixels. */
export function pixRing(g: G, cx: number, cy: number, rx: number, ry: number, t: number, c: string): void {
  g.fillStyle = c;
  const y0 = Math.floor(cy - ry);
  const y1 = Math.ceil(cy + ry);
  const irx = Math.max(0, rx - t);
  const iry = Math.max(0, ry - t);
  for (let y = y0; y <= y1; y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const half = rx * Math.sqrt(1 - dy * dy);
    const xa = Math.ceil(cx - half - 0.5);
    const xb = Math.floor(cx + half - 0.5);
    const idy = iry > 0 ? (y + 0.5 - cy) / iry : 2;
    if (Math.abs(idy) >= 1) {
      if (xb >= xa) g.fillRect(xa, y, xb - xa + 1, 1);
      continue;
    }
    const ih = irx * Math.sqrt(1 - idy * idy);
    const ia = Math.ceil(cx - ih - 0.5);
    const ib = Math.floor(cx + ih - 0.5);
    if (ia > xa) g.fillRect(xa, y, ia - xa, 1);
    if (xb > ib) g.fillRect(ib + 1, y, xb - ib, 1);
  }
}

/** Linha de 1 pixel (ou `w` pixels). */
export function pixLine(g: G, x0: number, y0: number, x1: number, y1: number, c: string, w = 1): void {
  g.fillStyle = c;
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const off = Math.floor(w / 2);
  for (let i = 0; i < 2000; i++) {
    g.fillRect(x0 - off, y0 - off, w, w);
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

/** Polígono cheio por varredura. */
export function pixPoly(g: G, pts: number[], c: string): void {
  g.fillStyle = c;
  const n = pts.length / 2;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    minY = Math.min(minY, pts[i * 2 + 1]!);
    maxY = Math.max(maxY, pts[i * 2 + 1]!);
  }
  const xs: number[] = [];
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
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
      const xa = Math.ceil(xs[k]! - 0.5);
      const xb = Math.floor(xs[k + 1]! - 0.5);
      if (xb >= xa) g.fillRect(xa, y, xb - xa + 1, 1);
    }
  }
}

/** Padrão xadrez (dither) dentro de um retângulo — textura retrô. */
export function pixDither(g: G, x: number, y: number, w: number, h: number, c: string, phase = 0): void {
  g.fillStyle = c;
  for (let yy = 0; yy < h; yy++) for (let xx = (yy + phase) & 1; xx < w; xx += 2) g.fillRect(x + xx, y + yy, 1, 1);
}
