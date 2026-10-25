// Física leve top-down: círculos (corpos/tiros) contra retângulos alinhados (obstáculos).
// Determinística e previsível — nada de engine pesada.

export interface Rect { x: number; y: number; w: number; h: number }

export interface CircleHit {
  /** Normal de saída (unitária) e penetração. */
  nx: number;
  ny: number;
  depth: number;
}

const _hit: CircleHit = { nx: 0, ny: 0, depth: 0 };

/** Testa círculo vs retângulo. Retorna objeto reutilizado (não guarde a referência) ou null. */
export function circleRect(cx: number, cy: number, r: number, rc: Rect): CircleHit | null {
  const qx = cx < rc.x ? rc.x : cx > rc.x + rc.w ? rc.x + rc.w : cx;
  const qy = cy < rc.y ? rc.y : cy > rc.y + rc.h ? rc.y + rc.h : cy;
  const dx = cx - qx, dy = cy - qy;
  const d2 = dx * dx + dy * dy;
  if (d2 > r * r) return null;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    _hit.nx = dx / d;
    _hit.ny = dy / d;
    _hit.depth = r - d;
    return _hit;
  }
  // Centro dentro do retângulo: empurra pelo eixo de menor penetração
  const left = cx - rc.x, right = rc.x + rc.w - cx, top = cy - rc.y, bottom = rc.y + rc.h - cy;
  const m = Math.min(left, right, top, bottom);
  if (m === left) { _hit.nx = -1; _hit.ny = 0; _hit.depth = left + r; }
  else if (m === right) { _hit.nx = 1; _hit.ny = 0; _hit.depth = right + r; }
  else if (m === top) { _hit.nx = 0; _hit.ny = -1; _hit.depth = top + r; }
  else { _hit.nx = 0; _hit.ny = 1; _hit.depth = bottom + r; }
  return _hit;
}

export function circleCircle(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const dx = bx - ax, dy = by - ay, rr = ar + br;
  return dx * dx + dy * dy <= rr * rr;
}

export function pointInRect(x: number, y: number, r: Rect): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/**
 * Segmento (x0,y0)->(x1,y1) contra retângulo expandido por `pad`.
 * Retorna fração t (0..1) do primeiro contato, ou -1. (Slab method.)
 */
export function segmentRect(x0: number, y0: number, x1: number, y1: number, rc: Rect, pad = 0): number {
  const dx = x1 - x0, dy = y1 - y0;
  let tmin = 0, tmax = 1;
  const minX = rc.x - pad, maxX = rc.x + rc.w + pad, minY = rc.y - pad, maxY = rc.y + rc.h + pad;
  if (Math.abs(dx) < 1e-9) {
    if (x0 < minX || x0 > maxX) return -1;
  } else {
    let t1 = (minX - x0) / dx, t2 = (maxX - x0) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  if (Math.abs(dy) < 1e-9) {
    if (y0 < minY || y0 > maxY) return -1;
  } else {
    let t1 = (minY - y0) / dy, t2 = (maxY - y0) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return -1;
  }
  return tmin;
}

/** Normal da face de um retângulo atingida por um ponto que acabou de entrar (para ricochete). */
export function rectNormalAt(px: number, py: number, vx: number, vy: number, rc: Rect, pad: number): { nx: number; ny: number } {
  // Compara a penetração em cada eixo levando em conta a direção da velocidade
  const minX = rc.x - pad, maxX = rc.x + rc.w + pad, minY = rc.y - pad, maxY = rc.y + rc.h + pad;
  const penX = vx > 0 ? px - minX : maxX - px;
  const penY = vy > 0 ? py - minY : maxY - py;
  if (penX < penY) return { nx: vx > 0 ? -1 : 1, ny: 0 };
  return { nx: 0, ny: vy > 0 ? -1 : 1 };
}

/** Distância de um ponto a um segmento (para feixes). */
export function pointSegmentDist(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0, dy = y1 - y0;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - x0) * dx + (py - y0) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = x0 + dx * t - px, qy = y0 + dy * t - py;
  return Math.sqrt(qx * qx + qy * qy);
}
