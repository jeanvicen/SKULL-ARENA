import { mix } from '../art/color';
import { rgba } from './buffer';

/**
 * RAMPAS DE COR (paleta 16-bit)
 * Cada cor base vira 5 tons: [escuro, sombra, base, luz, brilho].
 * Sombras puxam pro roxo-azulado e luzes pro amarelo-creme (hue shifting),
 * truque clássico de pixel art que deixa tudo mais vivo.
 */
const cache = new Map<string, number[]>();

export function ramp(base: string): number[] {
  let r = cache.get(base);
  if (!r) {
    r = [
      rgba(mix(mix(base, '#120a26', 0.55), '#000000', 0.15)),
      rgba(mix(base, '#1d1245', 0.32)),
      rgba(base),
      rgba(mix(base, '#fff3d6', 0.22)),
      rgba(mix(base, '#ffffff', 0.5)),
    ];
    cache.set(base, r);
  }
  return r;
}

/** Ramp em hex (pra UI / partículas). */
export function rampHex(base: string): string[] {
  return [mix(mix(base, '#120a26', 0.55), '#000000', 0.15), mix(base, '#1d1245', 0.32), base, mix(base, '#fff3d6', 0.22), mix(base, '#ffffff', 0.5)];
}

/** Cor da tinta do contorno (preto-roxo, igual em todo o jogo). */
export const INK_HEX = '#160d22';
export const INK = rgba(INK_HEX);
export const WHITE = rgba('#ffffff');
export const EYE_WHITE = rgba('#f6f2ff');
export const DARK = rgba('#1c1028');
