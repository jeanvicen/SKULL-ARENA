/** Utilidades de cor: sombras puxadas pro roxo/azul e luzes puxadas pro quente (visual mais "pintado"). */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

const cache = new Map<string, RGB>();

export function hexToRgb(hex: string): RGB {
  const hit = cache.get(hex);
  if (hit) return hit;
  let h = hex.replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const n = parseInt(h.slice(0, 6), 16);
  const rgb = { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  cache.set(hex, rgb);
  return rgb;
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (x: number) =>
    Math.max(0, Math.min(255, Math.round(x)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t });
}

/** Sombra: escurece e puxa pro roxo-azulado (cel shading bonito). */
export function shadow(hex: string, amount = 0.32): string {
  return mix(hex, '#1b1240', amount);
}

/** Luz: clareia puxando pro creme quente. */
export function light(hex: string, amount = 0.3): string {
  return mix(hex, '#fff6e0', amount);
}

export function darken(hex: string, amount = 0.3): string {
  return mix(hex, '#000000', amount);
}

export function lighten(hex: string, amount = 0.3): string {
  return mix(hex, '#ffffff', amount);
}

export function alpha(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Luminância relativa (0..1) — pra decidir texto claro/escuro. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function hsl(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex({ r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 });
}

/** Cor do contorno de todos os personagens (preto arroxeado, estilo FNF). */
export const INK = '#120a1c';
