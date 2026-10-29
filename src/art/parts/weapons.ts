import type { Look, WeaponKind } from '../../content/types';
import { alpha, darken, lighten, shadow } from '../color';
import { blob, detail, ellipse, flat, poly, roundRect, volume, type Ctx } from '../paint';

/**
 * ARMAS — desenhadas no espaço do osso da MÃO.
 * Eixo +y = continuação do braço (pra onde a arma aponta). Eixo +x = "em cima" da arma
 * quando o braço aponta pra frente. A mão (punho) cobre a empunhadura em y≈0..6.
 */

const O = { shade: 1.2, shadeAmt: 0.32, hi: 0.7, hiAmt: 0.35, line: 0.7 };
const METAL = '#3a3f4d';

function gunBody(ctx: Ctx, c: string, c2: string, len: number, thick: number): void {
  // empunhadura (escondida pela mão) + ferrolho + cano
  volume(ctx, roundRect(-2.2, 0.5, 4.2, 5.4, 1), darken(c2, 0.2), O);
  volume(ctx, roundRect(0.8, -2, thick, len, [1.4, 1.4, 0.8, 0.8]), c, O);
  flat(ctx, alpha(lighten(c, 0.6), 0.45), (p) => p.rect(thick - 0.2, 0, 0.8, len - 4));
  volume(ctx, roundRect(1.5, len - 2.6, thick - 1.4, 3.2, 0.6), METAL, O);
  for (let y = 1; y < len * 0.45; y += 1.3) detail(ctx, alpha(darken(c, 0.6), 0.6), 0.35, (p) => (p.moveTo(1.2, y), p.lineTo(thick + 0.4, y)));
}

export function paintWeapon(ctx: Ctx, look: Look, back = false): void {
  const w = look.weapon;
  const c = back ? shadow(w.color, 0.12) : w.color;
  const c2 = w.color2 ?? darken(w.color, 0.35);
  paintWeaponKind(ctx, w.kind, c, c2);
}

export function paintWeaponKind(ctx: Ctx, kind: WeaponKind, c: string, c2: string): void {
  switch (kind) {
    case 'pistol':
    case 'dual_pistols':
      gunBody(ctx, c, c2, 15, 4.4);
      break;
    case 'shotgun': {
      volume(ctx, poly([-1.5, -12, 3, -12, 2.6, 2, -2.6, 1], 1), c2, O); // coronha
      volume(ctx, roundRect(-1.4, 0, 5.8, 10, 1), c, O);
      volume(ctx, roundRect(1, 8, 3.4, 18, 0.8), METAL, O);
      volume(ctx, roundRect(-1.6, 12, 3.2, 8, 1), c2, O); // bomba
      for (let y = 13; y < 20; y += 1.5) detail(ctx, alpha('#000', 0.35), 0.4, (p) => (p.moveTo(-1.6, y), p.lineTo(1.6, y)));
      break;
    }
    case 'rifle': {
      volume(ctx, poly([-2, -12, 3.5, -12, 3.5, 2, -1.5, 1.5], 1), c2, O);
      volume(ctx, roundRect(-1.2, -1, 6.4, 16, 1.2), c, O);
      volume(ctx, roundRect(-4.5, 6, 3.6, 6, 0.8), METAL, O); // pente
      volume(ctx, roundRect(1.6, 14, 2.6, 12, 0.6), METAL, O);
      detail(ctx, alpha(lighten(c, 0.6), 0.5), 0.8, (p) => (p.moveTo(4.8, 0), p.lineTo(4.8, 13)));
      break;
    }
    case 'sniper': {
      volume(ctx, poly([-2, -14, 3.5, -14, 3.5, 2, -1.5, 1.5], 1), c2, O);
      volume(ctx, roundRect(-1, -1, 5.6, 14, 1.2), c, O);
      volume(ctx, roundRect(1.6, 12, 2.4, 22, 0.6), METAL, O);
      volume(ctx, roundRect(5.2, 0, 3.2, 11, 1.4), '#1d2029', O); // luneta
      flat(ctx, '#58d8ff', (p) => p.rect(5.6, 10.4, 2.4, 0.8));
      break;
    }
    case 'launcher': {
      volume(ctx, roundRect(-4, -10, 10, 34, 3), c, O);
      volume(ctx, roundRect(-4.6, 20, 11.2, 5, 2), c2, O);
      flat(ctx, '#120a1c', (p) => p.ellipse(1, 24.6, 4.2, 1.4, 0, 0, Math.PI * 2));
      flat(ctx, alpha('#ffffff', 0.25), (p) => p.rect(4, -8, 1, 28));
      detail(ctx, '#ffd23f', 1.1, (p) => (p.moveTo(-4, 4), p.lineTo(6, 4), p.moveTo(-4, 6.4), p.lineTo(6, 6.4)));
      break;
    }
    case 'bat': {
      const bat = poly([-1.3, -2, 1.3, -2, 2.6, 12, 3, 26, -3, 26, -2.6, 12], 2);
      volume(ctx, bat, c, O);
      for (let y = -1; y < 6; y += 1.4) detail(ctx, alpha(c2, 0.9), 1, (p) => (p.moveTo(-1.6, y), p.lineTo(1.6, y + 0.6)));
      for (const [x, y] of [
        [3, 18],
        [-3, 21],
        [3.2, 23],
      ])
        detail(ctx, '#c9ccd6', 0.8, (p) => (p.moveTo(x! * 0.8, y!), p.lineTo(x! * 1.5, y! - 1)));
      break;
    }
    case 'hammer': {
      volume(ctx, roundRect(-1.2, -8, 2.4, 30, 1), c2, O);
      const head = roundRect(-7, 18, 14, 9, 2);
      volume(ctx, head, c, { ...O, shade: 2 });
      flat(ctx, alpha('#ffffff', 0.3), (p) => p.rect(-6, 19, 12, 1.2));
      detail(ctx, alpha('#000', 0.4), 0.6, (p) => (p.moveTo(-4, 18), p.lineTo(-4, 27), p.moveTo(4, 18), p.lineTo(4, 27)));
      break;
    }
    case 'axe': {
      volume(ctx, roundRect(-1.1, -6, 2.2, 28, 1), c2, O);
      const blade = blob([1, 14, 9, 11, 12, 18, 9, 25, 1, 22], 0.5);
      volume(ctx, blade, c, { ...O, hiAmt: 0.5 });
      detail(ctx, alpha('#ffffff', 0.6), 0.8, (p) => (p.moveTo(10, 12.5), p.quadraticCurveTo(12.5, 18, 9.6, 23.6)));
      break;
    }
    case 'katana': {
      volume(ctx, roundRect(-1.2, -6, 2.4, 8, 0.8), c2, O);
      volume(ctx, ellipse(0, 2.5, 3.6, 1.3), '#c9a24a', O);
      const blade = poly([-1, 3.5, 1.3, 3.5, 1.8, 30, 0, 33, -1, 30], 0.4);
      volume(ctx, blade, c, { ...O, hiAmt: 0.6 });
      detail(ctx, alpha('#ffffff', 0.75), 0.5, (p) => (p.moveTo(0.6, 5), p.lineTo(1.1, 30)));
      break;
    }
    case 'scythe': {
      volume(ctx, roundRect(-1.1, -14, 2.2, 44, 1), c2, O);
      const blade = blob([0, 26, 8, 22, 22, 24, 30, 32, 18, 28, 8, 30, 1, 31], 0.4);
      volume(ctx, blade, c, { ...O, hiAmt: 0.55 });
      detail(ctx, alpha('#ffffff', 0.6), 0.6, (p) => (p.moveTo(9, 23), p.quadraticCurveTo(21, 24, 28, 30.5)));
      break;
    }
    case 'boombox': {
      detail(ctx, '#2a2a33', 1.4, (p) => (p.moveTo(-6, 4), p.lineTo(-6, 7), p.moveTo(6, 4), p.lineTo(6, 7), p.moveTo(-6, 4), p.lineTo(6, 4)));
      const box = roundRect(-11, 6, 22, 14, 2.5);
      volume(ctx, box, c, { ...O, shade: 2 });
      for (const x of [-5.6, 5.6]) {
        volume(ctx, ellipse(x, 13.2, 4.4, 4.4), '#1b1a22', { ...O, hiAmt: 0.2 });
        flat(ctx, c2, (p) => p.arc(x, 13.2, 1.8, 0, Math.PI * 2));
        detail(ctx, alpha('#ffffff', 0.25), 0.4, (p) => p.arc(x, 13.2, 3.2, 3.6, 5.4));
      }
      flat(ctx, '#58ffd0', (p) => p.rect(-2, 7.4, 4, 2));
      break;
    }
    case 'spray': {
      const can = roundRect(-2.6, 0, 5.2, 13, 2);
      volume(ctx, can, c, O);
      volume(ctx, roundRect(-1.6, 12, 3.2, 2.4, 0.8), '#e9e9ef', O);
      flat(ctx, c2, (p) => p.rect(-2.6, 4, 5.2, 4));
      break;
    }
    case 'guitar': {
      volume(ctx, roundRect(-1.2, -14, 2.4, 22, 0.8), c2, O);
      volume(ctx, roundRect(-2.2, -18, 4.4, 5, 1), darken(c2, 0.3), O);
      const body = blob([0, 7, 7, 9, 8, 15, 5, 19, 8, 24, 3, 28, -5, 27, -8, 21, -5, 16, -7, 10], 0.5);
      volume(ctx, body, c, { ...O, shade: 2 });
      flat(ctx, '#120a1c', (p) => p.ellipse(0, 18, 2, 2, 0, 0, Math.PI * 2));
      detail(ctx, alpha('#fff', 0.7), 0.25, (p) => (p.moveTo(-0.6, -16), p.lineTo(-0.6, 24), p.moveTo(0.6, -16), p.lineTo(0.6, 24)));
      break;
    }
    case 'staff': {
      volume(ctx, roundRect(-1.1, -14, 2.2, 40, 1), c2, O);
      flat(ctx, alpha(c, 0.35), (p) => p.arc(0, 29, 6.5, 0, Math.PI * 2));
      volume(ctx, ellipse(0, 29, 4, 4), c, { ...O, hiAmt: 0.7 });
      detail(ctx, c2, 1, (p) => (p.moveTo(-3, 24), p.quadraticCurveTo(0, 21, 3, 24)));
      break;
    }
    case 'orb': {
      flat(ctx, alpha(c, 0.3), (p) => p.arc(0, 12, 7, 0, Math.PI * 2));
      volume(ctx, ellipse(0, 12, 4.6, 4.6), c, { ...O, hiAmt: 0.7 });
      detail(ctx, alpha(c2, 0.9), 0.6, (p) => p.ellipse(0, 12, 7.5, 2.2, 0.4, 0, Math.PI * 2));
      break;
    }
    case 'cards': {
      for (let i = -2; i <= 2; i++) {
        ctx.save();
        ctx.translate(0, 4);
        ctx.rotate(i * 0.22);
        const card = roundRect(-2.4, 0, 4.8, 8, 0.8);
        volume(ctx, card, i === 0 ? c : '#f7f4ec', { ...O, hiAmt: 0.2 });
        flat(ctx, i % 2 ? '#e0213a' : '#1a1020', (p) => p.arc(0, 5, 0.9, 0, Math.PI * 2));
        ctx.restore();
      }
      break;
    }
    case 'chain': {
      for (let i = 0; i < 9; i++) {
        const y = 4 + i * 2.6;
        const x = Math.sin(i * 0.7) * 1.4;
        detail(ctx, i % 2 ? c : lighten(c, 0.2), 0.9, (p) => p.ellipse(x, y, i % 2 ? 0.6 : 1.3, 1.6, 0, 0, Math.PI * 2));
      }
      volume(ctx, poly([-2, 27, 2, 27, 0, 32], 0.4), c2, O);
      break;
    }
    case 'bow': {
      detail(ctx, c, 2.2, (p) => (p.moveTo(-14, 2), p.quadraticCurveTo(0, 16, 14, 2)));
      detail(ctx, alpha('#ffffff', 0.8), 0.4, (p) => (p.moveTo(-14, 2), p.lineTo(14, 2)));
      volume(ctx, roundRect(-1.6, 6, 3.2, 4, 1), c2, O);
      break;
    }
    case 'crossbow': {
      volume(ctx, roundRect(-1.5, -6, 3.4, 22, 1), c2, O);
      detail(ctx, c, 2, (p) => (p.moveTo(-11, 12), p.quadraticCurveTo(0, 18, 11, 12)));
      detail(ctx, alpha('#fff', 0.8), 0.4, (p) => (p.moveTo(-11, 12), p.lineTo(0, 6), p.lineTo(11, 12)));
      break;
    }
    case 'book': {
      const b = roundRect(-6, 2, 12, 15, 1.2);
      volume(ctx, b, c, { ...O, shade: 1.6 });
      flat(ctx, '#f2ead6', (p) => p.rect(-5.4, 14.8, 10.8, 1.6));
      detail(ctx, c2, 0.9, (p) => (p.arc(0, 9, 3, 0, Math.PI * 2), p.moveTo(0, 6), p.lineTo(0, 12)));
      break;
    }
    case 'skateboard': {
      const deck = roundRect(-3.4, -6, 6.8, 30, 3.4);
      volume(ctx, deck, c, O);
      flat(ctx, c2, (p) => p.rect(-3.4, 6, 6.8, 4));
      for (const y of [-2, 20]) volume(ctx, roundRect(-5, y, 10, 2.6, 1.2), '#f2f2f2', O);
      break;
    }
    case 'claws': {
      for (const x of [-2.2, 0, 2.2]) volume(ctx, poly([x - 0.7, 5, x + 0.7, 5, x + 0.3, 17, x, 19], 0.3), c, { ...O, hiAmt: 0.6 });
      break;
    }
    case 'flamethrower': {
      volume(ctx, roundRect(-2, -2, 6, 14, 1.6), c, O);
      volume(ctx, roundRect(-0.6, 11, 3.6, 9, 1), METAL, O);
      flat(ctx, '#ff8a3d', (p) => p.arc(1.2, 21, 1.2, 0, Math.PI * 2));
      detail(ctx, c2, 1.4, (p) => (p.moveTo(-2, 4), p.quadraticCurveTo(-8, 0, -10, -8)));
      break;
    }
    case 'yoyo': {
      detail(ctx, alpha('#fff', 0.85), 0.4, (p) => (p.moveTo(0, 4), p.lineTo(0, 16)));
      volume(ctx, ellipse(0, 18, 4, 4), c, O);
      flat(ctx, c2, (p) => p.arc(0, 18, 1.4, 0, Math.PI * 2));
      break;
    }
    case 'umbrella': {
      volume(ctx, roundRect(-0.9, -6, 1.8, 30, 0.8), '#2b2832', O);
      volume(ctx, poly([-3.6, 6, 3.6, 6, 1.5, 26, -1.5, 26], 1), c, O);
      detail(ctx, alpha(darken(c, 0.4), 0.7), 0.5, (p) => (p.moveTo(-1.5, 7), p.lineTo(-0.5, 25), p.moveTo(1.5, 7), p.lineTo(0.5, 25)));
      break;
    }
    case 'mic': {
      volume(ctx, roundRect(-1.4, 0, 2.8, 12, 1), '#2b2832', O);
      volume(ctx, ellipse(0, 13.5, 3, 3.4), '#c9ccd6', { ...O, hiAmt: 0.5 });
      for (let i = -2; i <= 2; i++) detail(ctx, alpha('#000', 0.35), 0.3, (p) => (p.moveTo(-2.6, 13.5 + i), p.lineTo(2.6, 13.5 + i)));
      break;
    }
    case 'wrench': {
      volume(ctx, roundRect(-1.4, -2, 2.8, 22, 1), c, { ...O, hiAmt: 0.5 });
      const head = blob([-4.6, 18, 4.6, 18, 5, 24, 2, 25, 1.6, 21.4, -1.6, 21.4, -2, 25, -5, 24], 0.3);
      volume(ctx, head, c, { ...O, hiAmt: 0.5 });
      break;
    }
    case 'gloves':
    case 'none':
    default:
      break;
  }
}

/** Ponta da arma (de onde sai o tiro), no espaço da mão. */
export function muzzleOffset(kind: WeaponKind): [number, number] {
  switch (kind) {
    case 'pistol':
    case 'dual_pistols':
      return [3, 15];
    case 'shotgun':
      return [2.6, 26];
    case 'rifle':
      return [2.8, 26];
    case 'sniper':
      return [2.8, 34];
    case 'launcher':
      return [1, 25];
    case 'staff':
      return [0, 29];
    case 'spray':
      return [0, 15];
    case 'flamethrower':
      return [1.2, 21];
    case 'orb':
      return [0, 12];
    case 'boombox':
      return [0, 13];
    case 'bow':
    case 'crossbow':
      return [0, 10];
    default:
      return [0, 14];
  }
}
