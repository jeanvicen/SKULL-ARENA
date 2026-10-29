import type { ProjLook } from '../content/types';
import { mix } from '../art/color';
import { PixelBuffer, outline, rgba, shade } from '../pixel/buffer';
import { INK, ramp } from '../pixel/palette';

type Canvas = HTMLCanvasElement | OffscreenCanvas;

/**
 * PROJÉTEIS EM PIXEL ART — sprites gerados por formato/cor/direção (16 direções),
 * com sombreado e contorno, e guardados em cache.
 */
const cache = new Map<string, Canvas>();
export const PROJ_SPR = 28;

export function projSprite(look: ProjLook, radiusWorld: number, angle: number, frame = 0): Canvas {
  const dirs = 16;
  const rot = look.spin || look.shape === 'skull' || look.shape === 'note' || look.shape === 'orb' || look.shape === 'bubble' || look.shape === 'coin';
  const bucket = rot ? 0 : ((Math.round((angle / (Math.PI * 2)) * dirs) % dirs) + dirs) % dirs;
  const s = Math.max(2, Math.min(9, Math.round((Math.max(7, radiusWorld) * (look.size ?? 1)) / 2.4)));
  const key = `${look.shape}|${look.color}|${look.color2 ?? ''}|${s}|${bucket}|${frame}`;
  let c = cache.get(key);
  if (!c) {
    c = render(look, s, (bucket / dirs) * Math.PI * 2, frame).toCanvas();
    cache.set(key, c);
  }
  return c;
}

function render(look: ProjLook, s: number, a: number, frame: number): PixelBuffer {
  const N = PROJ_SPR;
  const b = new PixelBuffer(N, N);
  const C = N / 2;
  const ramps: number[][] = [];
  const P = (color: string) => {
    ramps.push(ramp(color));
    return ramps.length - 1;
  };
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  /** gira pontos locais (x pra frente) */
  const R = (pts: number[]) => {
    const out: number[] = [];
    for (let i = 0; i < pts.length; i += 2) out.push(C + pts[i]! * ca - pts[i + 1]! * sa, C + pts[i]! * sa + pts[i + 1]! * ca);
    return out;
  };
  const c = look.color;
  const c2 = look.color2 ?? mix(c, '#ffffff', 0.5);
  const poly = (pts: number[], id: number) => b.fillPoly(R(pts), ramps[id]![2]!, id);
  switch (look.shape) {
    case 'bullet': {
      const id = P(c);
      poly([-s * 1.3, -s * 0.5, s * 0.8, -s * 0.5, s * 1.4, 0, s * 0.8, s * 0.5, -s * 1.3, s * 0.5], id);
      break;
    }
    case 'bolt':
    case 'arrow': {
      const id = P(c);
      poly([-s * 2, -s * 0.3, s * 1, -s * 0.3, s * 1, s * 0.3, -s * 2, s * 0.3], id);
      const tip = P(look.shape === 'arrow' ? c2 : '#ffffff');
      poly([s * 0.8, -s * 0.7, s * 2, 0, s * 0.8, s * 0.7], tip);
      break;
    }
    case 'orb':
    case 'bubble': {
      const id = P(c);
      b.fillEllipse(C, C, s, s, ramps[id]![2]!, id);
      break;
    }
    case 'skull': {
      const id = P(c);
      b.fillEllipse(C, C - 1, s, s * 0.9, ramps[id]![2]!, id);
      b.fillRect(C - s * 0.55, C + s * 0.4, s * 1.1, s * 0.6, ramps[id]![2]!, id);
      break;
    }
    case 'note': {
      const id = P(c);
      b.fillEllipse(C - 1, C + s * 0.5, s * 0.6, s * 0.45, ramps[id]![2]!, id);
      b.fillRect(C - 1 + s * 0.4, C - s, Math.max(1, s * 0.3), s * 1.5, ramps[id]![2]!, id);
      b.fillRect(C - 1 + s * 0.4, C - s, s * 0.7, Math.max(1, s * 0.3), ramps[id]![2]!, id);
      break;
    }
    case 'wave': {
      const id = P(c);
      for (let i = 0; i < 3; i++) {
        for (let k = -4; k <= 4; k++) {
          const ang = (k / 4) * 0.9;
          const r = s * 1.3;
          const px = -i * s * 0.6 + Math.cos(ang) * r;
          const py = Math.sin(ang) * r;
          b.fillRect(C + px * ca - py * sa - 0.5, C + px * sa + py * ca - 0.5, 1.5, 1.5, ramps[id]![2 + (i === 0 ? 1 : 0)]!, id);
        }
      }
      break;
    }
    case 'blade':
    case 'shard': {
      const id = P(c);
      poly([s * 1.7, 0, -s * 0.3, -s * 0.8, -s * 1.1, 0, -s * 0.3, s * 0.8], id);
      break;
    }
    case 'fire':
    case 'spray': {
      const o = P(mix(c, '#1d1245', 0.1));
      b.fillEllipse(C, C, s * 1.2, s * 0.9, ramps[o]![2]!, o);
      const i2 = P(mix(c, '#fff3d6', 0.5));
      b.fillEllipse(C + ca * s * 0.3, C + sa * s * 0.3, s * 0.6, s * 0.5, ramps[i2]![2]!, i2);
      break;
    }
    case 'coin': {
      const id = P(c);
      const w = [1, 0.7, 0.25, 0.7][frame % 4]!;
      b.fillEllipse(C, C, Math.max(1, s * w), s, ramps[id]![2]!, id);
      break;
    }
    case 'glyph': {
      const id = P(c);
      poly([-s, -s, s, -s, s, s, -s, s], id);
      break;
    }
    case 'rock': {
      const id = P(c);
      poly([-s, -s * 0.2, -s * 0.3, -s, s * 0.7, -s * 0.7, s, s * 0.4, 0, s, -s * 0.8, s * 0.6], id);
      break;
    }
    case 'card': {
      const id = P('#f7f4ec');
      poly([-s * 0.7, -s, s * 0.7, -s, s * 0.7, s, -s * 0.7, s], id);
      break;
    }
  }
  shade(b, ramps, {});
  // detalhes
  const set = (x: number, y: number, col: number) => b.set(Math.round(x), Math.round(y), col);
  if (look.shape === 'skull') {
    const d = rgba(mix(c, '#000000', 0.8));
    set(C - s * 0.4, C - 1, d);
    set(C + s * 0.4, C - 1, d);
    set(C, C + s * 0.3, d);
  } else if (look.shape === 'orb' || look.shape === 'bubble') set(C - s * 0.4, C - s * 0.4, rgba('#ffffff'));
  else if (look.shape === 'card') set(C, C, rgba(c));
  else if (look.shape === 'glyph') {
    for (let k = -s + 1; k < s; k++) {
      set(C + k, C, rgba(c2));
      set(C, C + k, rgba(c2));
    }
  } else if (look.shape === 'coin') set(C, C, rgba(c2));
  outline(b, INK);
  return b;
}
