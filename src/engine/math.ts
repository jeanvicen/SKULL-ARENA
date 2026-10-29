/** Matemática básica de vetores e utilidades numéricas (sem alocação quando possível). */

export interface Vec {
  x: number;
  y: number;
}

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const v = (x = 0, y = 0): Vec => ({ x, y });
export const clamp = (n: number, a: number, b: number): number => (n < a ? a : n > b ? b : n);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const invLerp = (a: number, b: number, n: number): number => (b === a ? 0 : (n - a) / (b - a));
export const len = (x: number, y: number): number => Math.sqrt(x * x + y * y);
export const dist = (a: Vec, b: Vec): number => len(b.x - a.x, b.y - a.y);
export const dist2 = (a: Vec, b: Vec): number => (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
export const angleTo = (a: Vec, b: Vec): number => Math.atan2(b.y - a.y, b.x - a.x);
export const smoothstep = (t: number): number => t * t * (3 - 2 * t);
export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};
export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

/** Diferença angular normalizada em [-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Interpola ângulos pelo caminho mais curto. */
export function lerpAngle(a: number, b: number, t: number): number {
  return a + angleDiff(a, b) * t;
}

export function normalize(x: number, y: number): Vec {
  const l = Math.sqrt(x * x + y * y);
  return l > 1e-9 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
}

/** Distância de ponto a segmento AB (ao quadrado). */
export function pointSegDist2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const l2 = abx * abx + aby * aby;
  let t = l2 > 0 ? ((px - ax) * abx + (py - ay) * aby) / l2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + abx * t - px;
  const cy = ay + aby * t - py;
  return cx * cx + cy * cy;
}

/** Círculo × retângulo alinhado: devolve o vetor de empurrão (ou null). */
export function circleRectPush(cx: number, cy: number, r: number, rx: number, ry: number, rw: number, rh: number): Vec | null {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx;
  const dy = cy - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    return { x: (dx / d) * (r - d), y: (dy / d) * (r - d) };
  }
  // centro dentro do retângulo: sai pelo lado mais próximo
  const left = cx - rx;
  const right = rx + rw - cx;
  const top = cy - ry;
  const bottom = ry + rh - cy;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: -(left + r), y: 0 };
  if (m === right) return { x: right + r, y: 0 };
  if (m === top) return { x: 0, y: -(top + r) };
  return { x: 0, y: bottom + r };
}

export function rotate(x: number, y: number, a: number): Vec {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
}

export function approach(cur: number, target: number, step: number): number {
  return cur < target ? Math.min(cur + step, target) : Math.max(cur - step, target);
}

/** Amortecimento exponencial independente de framerate. */
export function damp(a: number, b: number, lambda: number, dt: number): number {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}

export function fmtTime(s: number): string {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}K`;
  return n.toLocaleString('pt-BR');
}
