import type { PetDef } from '../content/types';
import { INK, alpha, darken, lighten, shadow } from './color';
import { blob, detail, ellipse, flat, poly, roundRect, volume, type Ctx } from './paint';
import { makeCanvas } from './sprite';

/**
 * ARTE DOS PETS — 20 tipos de corpo, cada um com 2 quadros (asas/patas) e contorno.
 * Espaço de desenho: caixa de -24..24 (centro no meio do corpo).
 */

type Canvas = HTMLCanvasElement | OffscreenCanvas;

function eyes(ctx: Ctx, x: number, y: number, gap: number, r: number, color: string, glow = false): void {
  for (const sx of [-gap / 2, gap / 2]) {
    if (glow) flat(ctx, alpha(color, 0.35), (p) => p.arc(x + sx, y, r * 1.8, 0, Math.PI * 2));
    flat(ctx, glow ? color : '#ffffff', (p) => p.ellipse(x + sx, y, r, r * 1.15, 0, 0, Math.PI * 2));
    if (!glow) {
      flat(ctx, '#140c1c', (p) => p.ellipse(x + sx + r * 0.2, y + r * 0.15, r * 0.6, r * 0.75, 0, 0, Math.PI * 2));
      flat(ctx, '#ffffff', (p) => p.arc(x + sx - r * 0.1, y - r * 0.35, r * 0.28, 0, Math.PI * 2));
    }
  }
}

export function paintPet(ctx: Ctx, pet: PetDef, frame: number): void {
  const [c, c2, c3] = pet.colors;
  const O = { shade: 2, shadeAmt: 0.32, hi: 1, hiAmt: 0.3, line: 0.9 };
  const up = frame === 0;
  switch (pet.body) {
    case 'bat':
    case 'dragon':
    case 'crow':
    case 'owl': {
      const wy = up ? -14 : 2;
      for (const s of [-1, 1]) {
        const w = pet.body === 'crow' || pet.body === 'owl' ? blob([s * 6, -2, s * 22, wy - 4, s * 24, wy + 6, s * 14, 6], 0.5) : poly([s * 6, -4, s * 24, wy - 6, s * 22, wy + 4, s * 18, wy + 2, s * 15, wy + 8, s * 8, 6], 1);
        volume(ctx, w, s < 0 ? shadow(c, 0.15) : c, O);
      }
      const body = ellipse(0, 0, pet.body === 'owl' ? 12 : 10, pet.body === 'owl' ? 13 : 11);
      volume(ctx, body, c, O);
      if (pet.body === 'bat') {
        volume(ctx, poly([-8, -8, -5, -18, -2, -9], 0.5), c, O);
        volume(ctx, poly([8, -8, 5, -18, 2, -9], 0.5), c, O);
        flat(ctx, '#ffffff', (p) => (p.moveTo(-3, 5), p.lineTo(-2, 8), p.lineTo(-1, 5), p.moveTo(1, 5), p.lineTo(2, 8), p.lineTo(3, 5)));
      }
      if (pet.body === 'dragon') {
        volume(ctx, poly([-6, -9, -9, -18, -2, -10], 0.5), c2, O);
        volume(ctx, poly([6, -9, 9, -18, 2, -10], 0.5), c2, O);
        flat(ctx, lighten(c, 0.3), (p) => p.ellipse(0, 5, 6, 4, 0, 0, Math.PI * 2));
      }
      if (pet.body === 'crow' || pet.body === 'owl') volume(ctx, poly([-3, 1, 3, 1, 0, 7], 0.5), c2, O);
      if (pet.body === 'owl') {
        flat(ctx, lighten(c, 0.5), (p) => (p.arc(-5, -4, 5.5, 0, Math.PI * 2), p.arc(5, -4, 5.5, 0, Math.PI * 2)));
        eyes(ctx, 0, -4, 10, 3.4, c3);
        detail(ctx, c3, 1, (p) => (p.rect(-10, -8, 8, 7), p.rect(2, -8, 8, 7)));
      } else eyes(ctx, 0, -3, 8, 2.6, c3, pet.body !== 'crow');
      break;
    }
    case 'cat':
    case 'fox':
    case 'bunny': {
      const tail = pet.body === 'bunny' ? ellipse(-12, 6, 5, 5) : blob([-8, 6, -18, 0, -24, -10, -20, -12, -16, -2, -6, 10], 0.5);
      volume(ctx, tail, pet.body === 'fox' ? c2 : c, O);
      const body = blob([-10, 4, -6, -4, 6, -4, 10, 4, 8, 12, -8, 12], 0.5);
      volume(ctx, body, c, O);
      const head = ellipse(4, -8, 10, 9);
      volume(ctx, head, c, O);
      const ear = pet.body === 'bunny' ? (s: number) => roundRect(s - 2.5, -32, 5, 18, 2.5) : (s: number) => poly([s - 5, -13, s, -24, s + 5, -13], 0.8);
      volume(ctx, ear(-1), c, O);
      volume(ctx, ear(9), c, O);
      if (pet.body === 'fox') flat(ctx, '#ffffff', (p) => p.ellipse(7, -5, 5, 3.5, 0, 0, Math.PI * 2));
      eyes(ctx, 5, -9, 8, 2.4, c3, pet.body === 'cat');
      flat(ctx, c2, (p) => p.arc(11, -6, 1.4, 0, Math.PI * 2));
      const legY = up ? 12 : 13.5;
      flat(ctx, darken(c, 0.2), (p) => (p.rect(-7, 10, 4, legY - 9), p.rect(4, 10, 4, legY - 8)));
      break;
    }
    case 'ghost':
    case 'jelly': {
      const wob = up ? 2 : -2;
      const b = new Path2D();
      b.moveTo(-13, 2);
      b.bezierCurveTo(-14, -20, 14, -20, 13, 2);
      if (pet.body === 'ghost') {
        b.lineTo(13, 12);
        b.quadraticCurveTo(9, 8 + wob, 6, 13);
        b.quadraticCurveTo(3, 8 - wob, 0, 13);
        b.quadraticCurveTo(-3, 8 + wob, -6, 13);
        b.quadraticCurveTo(-9, 8 - wob, -13, 12);
      } else b.quadraticCurveTo(0, 6, -13, 2);
      b.closePath();
      ctx.globalAlpha = 0.92;
      volume(ctx, b, c, O);
      ctx.globalAlpha = 1;
      if (pet.body === 'jelly') for (let i = -2; i <= 2; i++) detail(ctx, alpha(c2, 0.9), 1.6, (p) => (p.moveTo(i * 4, 4), p.quadraticCurveTo(i * 4 + wob, 12, i * 4 - wob, 20)));
      eyes(ctx, 0, -6, 9, 2.8, c3, pet.body === 'ghost');
      flat(ctx, alpha(c2, 0.5), (p) => p.ellipse(0, 0, 3, 1.5, 0, 0, Math.PI * 2));
      break;
    }
    case 'slime':
    case 'frog': {
      const sq = up ? 1 : 1.12;
      const b = blob([-16 * sq, 10, -12, -4 / sq, 0, -12 / sq, 12, -4 / sq, 16 * sq, 10], 0.5);
      volume(ctx, b, c, { ...O, hiAmt: 0.5 });
      if (pet.body === 'frog') {
        volume(ctx, ellipse(-6, -11 / sq, 5, 5), c, O);
        volume(ctx, ellipse(6, -11 / sq, 5, 5), c, O);
        eyes(ctx, 0, -11 / sq, 12, 2.8, c3);
        detail(ctx, darken(c, 0.5), 1, (p) => (p.moveTo(-7, 2), p.quadraticCurveTo(0, 6, 7, 2)));
      } else {
        eyes(ctx, 0, -2, 10, 2.8, c3);
        flat(ctx, alpha('#ffffff', 0.6), (p) => p.ellipse(-8, -6, 3, 2, -0.5, 0, Math.PI * 2));
      }
      break;
    }
    case 'drone':
    case 'robot': {
      if (pet.body === 'drone') {
        for (const s of [-1, 1]) {
          detail(ctx, '#3a3f4d', 2, (p) => (p.moveTo(s * 6, -4), p.lineTo(s * 16, -10)));
          flat(ctx, alpha('#e9e9ef', 0.7), (p) => p.ellipse(s * 16, -11, up ? 9 : 4, 1.6, 0, 0, Math.PI * 2));
        }
        volume(ctx, roundRect(-10, -6, 20, 12, 4), c, O);
        flat(ctx, '#151a26', (p) => p.rect(-6, -3, 12, 5));
        flat(ctx, c3, (p) => (p.arc(-2.5, -0.5, 1.6, 0, Math.PI * 2), p.arc(2.5, -0.5, 1.6, 0, Math.PI * 2)));
        flat(ctx, c2, (p) => p.rect(-2, 6, 4, 4));
      } else {
        volume(ctx, roundRect(-9, -2, 18, 14, 3), c, O);
        volume(ctx, roundRect(-10, -18, 20, 15, 5), lighten(c, 0.1), O);
        flat(ctx, '#151a26', (p) => p.rect(-7, -14, 14, 7));
        flat(ctx, c3, (p) => (p.rect(-5, -12, 3, 3), p.rect(2, -12, 3, 3)));
        detail(ctx, c2, 1.2, (p) => (p.moveTo(0, -18), p.lineTo(0, -24)));
        flat(ctx, c2, (p) => p.arc(0, -25, 2, 0, Math.PI * 2));
        flat(ctx, darken(c, 0.3), (p) => (p.rect(-7, 12, 4, up ? 4 : 2), p.rect(3, 12, 4, up ? 2 : 4)));
      }
      break;
    }
    case 'skull': {
      volume(ctx, blob([0, -16, 12, -10, 13, 0, 7, 6, -7, 6, -13, 0, -12, -10], 0.5), '#efe6d2', O);
      volume(ctx, roundRect(-7, 4, 14, 7, 2), '#e3d8c0', O);
      for (const sx of [-5, 5]) {
        flat(ctx, '#1a0f22', (p) => p.ellipse(sx, -4, 3.6, 4, 0, 0, Math.PI * 2));
        flat(ctx, c2, (p) => p.arc(sx, -4, up ? 1.8 : 1.2, 0, Math.PI * 2));
      }
      for (let x = -5; x <= 5; x += 2.5) detail(ctx, '#7a6a52', 0.6, (p) => (p.moveTo(x, 4), p.lineTo(x, 9)));
      break;
    }
    case 'eye': {
      volume(ctx, ellipse(0, 0, 14, 14), '#f6f2ff', O);
      flat(ctx, c2, (p) => p.arc(2, 1, 8, 0, Math.PI * 2));
      flat(ctx, c, (p) => p.arc(3, 1, 4.5, 0, Math.PI * 2));
      flat(ctx, '#ffffff', (p) => p.arc(-1, -3, 2.2, 0, Math.PI * 2));
      for (let i = 0; i < 5; i++) detail(ctx, alpha('#c0182b', 0.5), 0.6, (p) => (p.moveTo(-13 + i, -4 + i * 2), p.lineTo(-7, -2 + i)));
      detail(ctx, c, 2, (p) => (p.moveTo(-12, -11), p.quadraticCurveTo(0, up ? -20 : -17, 12, -11)));
      break;
    }
    case 'flame': {
      const f = up ? 1 : 1.12;
      volume(ctx, blob([0, -22 * f, 9, -8, 12, 4, 6, 12, -6, 12, -12, 4, -8, -6, -2, -10], 0.5), c, { ...O, hiAmt: 0.5 });
      volume(ctx, blob([0, -12 * f, 6, -2, 4, 8, -4, 8, -6, -2], 0.5), c2, { ...O, line: 0 });
      eyes(ctx, 0, 0, 8, 2.2, '#1a0f12');
      break;
    }
    case 'snake': {
      const w = up ? 3 : -3;
      const body = new Path2D();
      body.moveTo(-18, 8);
      body.bezierCurveTo(-10, -2 + w, -2, 14 - w, 8, 4);
      body.lineTo(8, -2);
      body.bezierCurveTo(-2, 8 - w, -10, -8 + w, -18, 2);
      body.closePath();
      volume(ctx, body, c, O);
      volume(ctx, ellipse(10, -4, 8, 6.5), c, O);
      eyes(ctx, 12, -6, 6, 2, c3, true);
      detail(ctx, '#ff3d6e', 1, (p) => (p.moveTo(17, -2), p.lineTo(22, -1), p.moveTo(22, -1), p.lineTo(24, -3), p.moveTo(22, -1), p.lineTo(24, 1)));
      break;
    }
    case 'spider': {
      for (let i = 0; i < 4; i++) {
        const k = up ? (i % 2 ? 2 : -2) : i % 2 ? -2 : 2;
        detail(ctx, darken(c, 0.2), 2, (p) => (p.moveTo(-4, 0), p.lineTo(-14, -6 + i * 5 + k), p.lineTo(-18, 2 + i * 5)));
        detail(ctx, darken(c, 0.2), 2, (p) => (p.moveTo(4, 0), p.lineTo(14, -6 + i * 5 - k), p.lineTo(18, 2 + i * 5)));
      }
      volume(ctx, ellipse(0, 4, 10, 9), c, O);
      volume(ctx, ellipse(0, -7, 7, 6), c, O);
      flat(ctx, c2, (p) => p.ellipse(0, 6, 4, 3, 0, 0, Math.PI * 2));
      for (const [x, y] of [
        [-3, -8],
        [3, -8],
        [-1.4, -5],
        [1.4, -5],
      ])
        flat(ctx, c3, (p) => p.arc(x!, y!, 1.2, 0, Math.PI * 2));
      break;
    }
    case 'fish': {
      const tw = up ? 4 : -4;
      volume(ctx, poly([-10, 0, -20, -8 + tw, -20, 8 + tw], 1), c2, O);
      volume(ctx, ellipse(0, 0, 13, 9), c, O);
      for (const x of [-4, 2]) detail(ctx, alpha(c2, 0.8), 2, (p) => (p.moveTo(x, -8), p.lineTo(x, 8)));
      eyes(ctx, 7, -2, 0, 2.4, c3);
      detail(ctx, alpha('#9ef0ff', 0.6), 1, (p) => p.arc(16, -8, 2, 0, Math.PI * 2));
      break;
    }
    case 'crystal': {
      const s = up ? 1 : 1.08;
      volume(ctx, poly([0, -22 * s, 10, -6, 6, 12, -6, 12, -10, -6], 0.5), c, { ...O, hiAmt: 0.7 });
      flat(ctx, alpha(c2, 0.7), (p) => (p.moveTo(0, -22 * s), p.lineTo(4, -2), p.lineTo(0, 12), p.lineTo(-4, -2), p.closePath()));
      flat(ctx, alpha('#ffffff', 0.8), (p) => (p.moveTo(-6, -8), p.lineTo(-2, -16), p.lineTo(-1, -8), p.closePath()));
      eyes(ctx, 0, 0, 7, 1.8, c3, true);
      break;
    }
  }
}

/** Sprite pronto do pet (2 quadros com contorno) em escala de tela. */
export class PetSprite {
  readonly frames: Canvas[] = [];
  readonly size: number;

  constructor(
    readonly pet: PetDef,
    readonly ppu: number,
  ) {
    const S = 60;
    this.size = S;
    for (let f = 0; f < 2; f++) {
      const c = makeCanvas(S * ppu, S * ppu);
      const g = c.getContext('2d') as Ctx;
      g.setTransform(ppu, 0, 0, ppu, (S / 2) * ppu, (S / 2) * ppu);
      paintPet(g, pet, f);
      // contorno
      const out = makeCanvas(c.width, c.height);
      const o = out.getContext('2d') as Ctx;
      const mask = makeCanvas(c.width, c.height);
      const m = mask.getContext('2d') as Ctx;
      m.drawImage(c as CanvasImageSource, 0, 0);
      m.globalCompositeOperation = 'source-in';
      m.fillStyle = INK;
      m.fillRect(0, 0, mask.width, mask.height);
      const r = 1.6 * ppu;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        o.drawImage(mask as CanvasImageSource, Math.cos(a) * r, Math.sin(a) * r);
      }
      o.drawImage(c as CanvasImageSource, 0, 0);
      this.frames.push(out);
    }
  }

  /** Desenha centralizado em (x,y) de tela (px de dispositivo). */
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, flip: boolean, scale = 1): void {
    const flap = this.pet.motion === 'flap' || this.pet.motion === 'hop' || this.pet.motion === 'slither' || this.pet.motion === 'bounce';
    const f = flap ? Math.floor(t * (this.pet.motion === 'flap' ? 8 : 4)) % 2 : Math.floor(t * 2) % 2;
    const img = this.frames[f]!;
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.setTransform(flip ? -1 : 1, 0, 0, 1, x, y);
    ctx.drawImage(img as CanvasImageSource, -w / 2, -h / 2, w, h);
  }
}
