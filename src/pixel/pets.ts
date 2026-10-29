import type { PetDef } from '../content/types';
import { mix } from '../art/color';
import { PixelBuffer, newCanvas, outline, rgba, shade } from './buffer';
import { DARK, EYE_WHITE, INK, WHITE, ramp } from './palette';

type Canvas = HTMLCanvasElement | OffscreenCanvas;

/**
 * PETS EM PIXEL ART — quadro 32×32 (centro do corpo em 16,17), 4 quadros de animação.
 * Cada tipo de corpo é desenhado com formas simples + sombreado + contorno.
 * Pet com `sheet: 'sprites/pets/meu-pet.png'` usa SEU desenho (4 quadros 32×32 lado a lado).
 */

export const PET_SIZE = 32;
const CX = 16;
const CY = 17;

class P2 {
  ramps: number[][] = [];
  form = new Set<number>();
  constructor(readonly b: PixelBuffer) {}
  part(c: string, form = true): number {
    this.ramps.push(ramp(c));
    if (form) this.form.add(this.ramps.length - 1);
    return this.ramps.length - 1;
  }
  base(id: number): number {
    return this.ramps[id]![2]!;
  }
  poly(pts: number[], id: number): void {
    this.b.fillPoly(
      pts.map((v, i) => (i % 2 ? v + CY : v + CX)),
      this.base(id),
      id,
    );
  }
  ell(x: number, y: number, rx: number, ry: number, id: number): void {
    this.b.fillEllipse(x + CX, y + CY, rx, ry, this.base(id), id);
  }
  px(x: number, y: number, c: number): void {
    this.b.set(Math.round(x + CX), Math.round(y + CY), c);
  }
}

function eyes(p: P2, x: number, y: number, gap: number, color: string, glow = false, big = false): void {
  for (const sx of gap ? [-gap / 2, gap / 2] : [0]) {
    if (glow) {
      p.px(x + sx, y, rgba(color));
      p.px(x + sx, y - 1, rgba(mix(color, '#ffffff', 0.5)));
    } else {
      p.px(x + sx, y, EYE_WHITE);
      p.px(x + sx + 1, y, DARK);
      if (big) {
        p.px(x + sx, y + 1, EYE_WHITE);
        p.px(x + sx + 1, y + 1, DARK);
        p.px(x + sx, y - 1, WHITE);
      }
    }
  }
}

export function renderPet(pet: PetDef, frame: number): PixelBuffer {
  const b = new PixelBuffer(PET_SIZE, PET_SIZE);
  const p = new P2(b);
  const [c, c2, c3] = pet.colors;
  const up = frame % 2 === 0;
  const bob = frame === 1 || frame === 2 ? -1 : 0;
  switch (pet.body) {
    case 'bat':
    case 'dragon':
    case 'crow':
    case 'owl': {
      const wy = up ? -7 : 1;
      const wing = p.part(mix(c, '#1d1245', 0.12));
      for (const s of [-1, 1]) {
        if (pet.body === 'crow' || pet.body === 'owl') p.poly([s * 3, -1 + bob, s * 11, wy - 2 + bob, s * 12, wy + 3 + bob, s * 6, 4 + bob], wing);
        else p.poly([s * 3, -2 + bob, s * 12, wy - 3 + bob, s * 11, wy + 2 + bob, s * 9, wy + 1 + bob, s * 7, wy + 4 + bob, s * 4, 3 + bob], wing);
      }
      const body = p.part(c);
      p.ell(0, bob, pet.body === 'owl' ? 6 : 5, pet.body === 'owl' ? 6.5 : 5.5, body);
      if (pet.body === 'bat') {
        p.poly([-4, -4 + bob, -3, -9 + bob, -1, -4 + bob], body);
        p.poly([4, -4 + bob, 3, -9 + bob, 1, -4 + bob], body);
      }
      if (pet.body === 'dragon') {
        const horn = p.part(c2);
        p.poly([-3, -4 + bob, -5, -9 + bob, -1, -5 + bob], horn);
        p.poly([3, -4 + bob, 5, -9 + bob, 1, -5 + bob], horn);
      }
      if (pet.body === 'crow' || pet.body === 'owl') {
        const beak = p.part(c2, false);
        p.poly([-1, 1 + bob, 2, 1 + bob, 0.5, 4 + bob], beak);
      }
      const r = shadeAndBase(p);
      eyes(p, -1, -1 + bob, pet.body === 'owl' ? 5 : 4, c3, pet.body !== 'crow' && pet.body !== 'owl', pet.body === 'owl');
      return r;
    }
    case 'cat':
    case 'fox':
    case 'bunny': {
      const tail = p.part(pet.body === 'fox' ? c2 : c);
      if (pet.body === 'bunny') p.ell(-7, 4, 2.5, 2.5, tail);
      else p.poly([-5, 4, -10, 0 + (up ? 0 : 1), -12, -6, -10, -6, -8, -1, -3, 6], tail);
      const body = p.part(c);
      const hop = pet.motion === 'hop' && !up ? -2 : 0;
      p.poly([-6, 3 + hop, -3, -2 + hop, 4, -2 + hop, 6, 3 + hop, 5, 7 + hop, -5, 7 + hop], body);
      p.ell(2, -5 + hop, 5.2, 4.6, body);
      if (pet.body === 'bunny') {
        p.poly([-1, -8 + hop, 1, -8 + hop, 1, -16 + hop, -1, -16 + hop], body);
        p.poly([3, -8 + hop, 5, -8 + hop, 5.5, -15 + hop, 3.5, -15 + hop], body);
      } else {
        p.poly([-2, -7 + hop, 0, -12 + hop, 2, -8 + hop], body);
        p.poly([3, -8 + hop, 6, -12 + hop, 7, -6 + hop], body);
      }
      const leg = p.part(mix(c, '#1d1245', 0.2), false);
      p.poly([-4, 6 + hop, -2, 6 + hop, -2, 9, -4, 9], leg);
      p.poly([2, 6 + hop, 4, 6 + hop, 4, 9, 2, 9], leg);
      const r = shadeAndBase(p);
      if (pet.body === 'fox') {
        p.px(4, -3 + hop, WHITE);
        p.px(5, -3 + hop, WHITE);
      }
      eyes(p, 2, -6 + hop, 4, c3, pet.body === 'cat');
      p.px(6, -4 + hop, rgba(c2));
      return r;
    }
    case 'ghost':
    case 'jelly': {
      const body = p.part(c);
      const w = up ? 1 : -1;
      if (pet.body === 'ghost')
        p.poly([-7, 2 + bob, -7, -5 + bob, -4, -9 + bob, 4, -9 + bob, 7, -5 + bob, 7, 6 + bob, 5, 4 + w + bob, 3, 7 + bob, 0, 4 - w + bob, -3, 7 + bob, -5, 4 + w + bob, -7, 6 + bob], body);
      else {
        p.poly([-7, 1 + bob, -6, -5 + bob, -3, -8 + bob, 3, -8 + bob, 6, -5 + bob, 7, 1 + bob], body);
        const t = p.part(c2, false);
        for (let i = -2; i <= 2; i++) p.poly([i * 2.5 - 0.6, 1 + bob, i * 2.5 + 0.6, 1 + bob, i * 2.5 + 0.6 + w, 9 + bob, i * 2.5 - 0.6 + w, 9 + bob], t);
      }
      const r = shadeAndBase(p);
      eyes(p, -0.5, -3 + bob, 4, c3, pet.body === 'ghost');
      return r;
    }
    case 'slime':
    case 'frog': {
      const sq = up ? 0 : 1;
      const body = p.part(c);
      p.poly([-8 - sq, 7, -6, -1 + sq, -3, -5 + sq, 3, -5 + sq, 6, -1 + sq, 8 + sq, 7], body);
      if (pet.body === 'frog') {
        p.ell(-3, -5 + sq, 2.5, 2.5, body);
        p.ell(3, -5 + sq, 2.5, 2.5, body);
      }
      const r = shadeAndBase(p);
      if (pet.body === 'frog') eyes(p, -0.5, -5 + sq, 6, c3, false, true);
      else {
        eyes(p, -0.5, 0 + sq, 5, c3, false, true);
        p.px(-5, -2 + sq, WHITE);
      }
      return r;
    }
    case 'drone':
    case 'robot': {
      if (pet.body === 'drone') {
        const arm = p.part('#3a3f4d', false);
        for (const s of [-1, 1]) {
          p.poly([s * 3, -2 + bob, s * 9, -5 + bob, s * 9, -4 + bob, s * 3, -1 + bob], arm);
          const blade = p.part('#e9e9ef', false);
          p.poly([s * 9 - (up ? 5 : 2), -6 + bob, s * 9 + (up ? 5 : 2), -6 + bob, s * 9 + (up ? 5 : 2), -5 + bob, s * 9 - (up ? 5 : 2), -5 + bob], blade);
        }
        const body = p.part(c);
        p.poly([-5, -3 + bob, 5, -3 + bob, 5, 3 + bob, -5, 3 + bob], body);
        const r = shadeAndBase(p);
        for (let x = -3; x <= 3; x++) p.px(x, -1 + bob, rgba('#151a26'));
        p.px(-1, -1 + bob, rgba(c3));
        p.px(2, -1 + bob, rgba(c3));
        return r;
      }
      const body = p.part(c);
      p.poly([-5, -1, 5, -1, 5, 6, -5, 6], body);
      const head = p.part(mix(c, '#ffffff', 0.12));
      p.poly([-5, -10 + bob, 5, -10 + bob, 5, -2 + bob, -5, -2 + bob], head);
      const ant = p.part(c2, false);
      p.poly([-0.5, -14 + bob, 0.5, -14 + bob, 0.5, -10 + bob, -0.5, -10 + bob], ant);
      const r = shadeAndBase(p);
      for (let x = -3; x <= 3; x++) for (let y = -8; y <= -5; y++) p.px(x, y + bob, rgba('#151a26'));
      p.px(-2, -7 + bob, rgba(c3));
      p.px(2, -7 + bob, rgba(c3));
      p.px(0, -15 + bob, rgba(c2));
      return r;
    }
    case 'skull': {
      const bone = p.part('#efe6d2');
      p.ell(0, -2 + bob, 7, 6.5, bone);
      p.poly([-4, 2 + bob, 4, 2 + bob, 4, 6 + bob, -4, 6 + bob], bone);
      const r = shadeAndBase(p);
      for (const sx of [-3, 2]) {
        for (let dy = -1; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) p.px(sx + dx, -2 + dy + bob, DARK);
        p.px(sx + 1, -2 + bob, rgba(c2));
      }
      for (let x = -3; x <= 3; x += 2) p.px(x, 4 + bob, DARK);
      return r;
    }
    case 'eye': {
      const ball = p.part('#f6f2ff');
      p.ell(0, bob, 7, 7, ball);
      const r = shadeAndBase(p);
      b.fillEllipse(CX + 1, CY + bob + 1, 4, 4, rgba(c2));
      b.fillEllipse(CX + 1.5, CY + bob + 1, 2, 2, rgba(c));
      p.px(-1, -2 + bob, WHITE);
      for (let x = -6; x <= 6; x++) if (Math.abs(x) < 6) p.px(x, (up ? -7 : -6) + bob, rgba(c));
      return r;
    }
    case 'flame': {
      const f = up ? 0 : 1;
      const outer = p.part(c);
      p.poly([0, -11 - f, 5, -4, 6, 2, 3, 6, -3, 6, -6, 2, -4, -3, -1, -5], outer);
      const inner = p.part(c2, false);
      p.poly([0, -6 - f, 3, -1, 2, 4, -2, 4, -3, -1], inner);
      const r = shadeAndBase(p);
      p.px(-1, 0, DARK);
      p.px(2, 0, DARK);
      return r;
    }
    case 'snake': {
      const w = up ? 1 : -1;
      const body = p.part(c);
      p.poly([-10, 5, -6, 1 + w, -2, 6 - w, 3, 2, 4, -1, -1, 3 - w, -5, -2 + w, -10, 2], body);
      p.ell(5, -2, 4, 3.4, body);
      const r = shadeAndBase(p);
      p.px(6, -3, rgba(c3));
      p.px(9, -1, rgba('#ff3d6e'));
      p.px(10, -1, rgba('#ff3d6e'));
      return r;
    }
    case 'spider': {
      const leg = p.part(mix(c, '#1d1245', 0.2), false);
      for (let i = 0; i < 4; i++) {
        const k = (i + frame) % 2 ? 1 : -1;
        p.poly([-2, 0, -7, -3 + i * 2.5 + k, -9, 1 + i * 2.5, -8, 1 + i * 2.5, -6, -2 + i * 2.5 + k, -2, 1], leg);
        p.poly([2, 0, 7, -3 + i * 2.5 - k, 9, 1 + i * 2.5, 8, 1 + i * 2.5, 6, -2 + i * 2.5 - k, 2, 1], leg);
      }
      const body = p.part(c);
      p.ell(0, 2, 5, 4.6, body);
      p.ell(0, -4, 3.6, 3, body);
      const r = shadeAndBase(p);
      p.px(-1, -4, rgba(c3));
      p.px(1, -4, rgba(c3));
      p.px(0, 3, rgba(c2));
      return r;
    }
    case 'fish': {
      const tw = up ? 2 : -2;
      const tail = p.part(c2);
      p.poly([-5, 0, -10, -4 + tw, -10, 4 + tw], tail);
      const body = p.part(c);
      p.ell(0, 0, 6.5, 4.6, body);
      const r = shadeAndBase(p);
      for (let y = -3; y <= 3; y++) p.px(-2, y, rgba(c2));
      eyes(p, 3, -1, 0, c3);
      return r;
    }
    case 'crystal': {
      const s = up ? 0 : 1;
      const cr = p.part(c);
      p.poly([0, -11 - s, 5, -3, 3, 6, -3, 6, -5, -3], cr);
      const r = shadeAndBase(p);
      for (let y = -9; y <= 5; y++) p.px(0, y, rgba(c2));
      p.px(-2, -4, WHITE);
      p.px(-1, 0, rgba(c3));
      p.px(1, 0, rgba(c3));
      return r;
    }
  }
  return shadeAndBase(p);
}

function shadeAndBase(p: P2): PixelBuffer {
  shade(p.b, p.ramps, { form: p.form });
  outline(p.b, INK);
  return p.b;
}

const cache = new Map<string, Canvas[]>();
const sheetCache = new Map<string, HTMLImageElement | null>();

/** Os 4 quadros do pet (canvas 32×32). */
export function petFrames(pet: PetDef): Canvas[] {
  let f = cache.get(pet.id);
  if (!f) {
    f = [0, 1, 2, 3].map((i) => renderPet(pet, i).toCanvas());
    cache.set(pet.id, f);
  }
  if (pet.sheet) {
    let img = sheetCache.get(pet.sheet);
    if (img === undefined && typeof Image !== 'undefined') {
      sheetCache.set(pet.sheet, null);
      const im = new Image();
      im.onload = () => {
        sheetCache.set(pet.sheet!, im);
        cache.set(
          pet.id,
          [0, 1, 2, 3].map((i) => {
            const c = newCanvas(PET_SIZE, PET_SIZE);
            const g = c.getContext('2d') as CanvasRenderingContext2D;
            g.drawImage(im, i * PET_SIZE, 0, PET_SIZE, PET_SIZE, 0, 0, PET_SIZE, PET_SIZE);
            return c;
          }),
        );
      };
      im.src = pet.sheet;
      img = null;
    }
  }
  return f;
}

/** Quadro do pet no tempo `t` (anima mais rápido se bate asa). */
export function petFrame(pet: PetDef, t: number): Canvas {
  const fps = pet.motion === 'flap' ? 10 : pet.motion === 'hop' || pet.motion === 'bounce' ? 6 : 4;
  return petFrames(pet)[((Math.floor(t * fps) % 4) + 4) % 4]!;
}
