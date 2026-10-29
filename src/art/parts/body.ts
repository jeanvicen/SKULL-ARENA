import type { Look, TopStyle } from '../../content/types';
import { darken, light, lighten, shadow, alpha } from '../color';
import { blob, detail, ellipse, flat, poly, roundRect, taper, volume, type Ctx } from '../paint';
import { paintPrint } from './prints';

/**
 * PEÇAS DO CORPO (roupas streetwear)
 * Cada função desenha UMA peça no espaço local do osso (unidades do rig).
 * Vista 'front' = 3/4 de frente olhando pra direita; 'back' = de costas.
 */

export type View = 'front' | 'back';

export function torsoHalfWidth(look: Look): number {
  const base = { slim: 11.5, normal: 13, broad: 15, heavy: 16.5 }[look.body];
  const over = ['hoodie', 'oversized_tee', 'puffer', 'varsity', 'trench', 'robe', 'kimono'].includes(look.top.style) ? 2 : 0;
  const puff = look.top.style === 'puffer' ? 1.5 : 0;
  return base + over + puff;
}

function hemY(style: TopStyle): number {
  switch (style) {
    case 'trench':
    case 'robe':
      return 13;
    case 'kimono':
      return 8;
    case 'tank':
    case 'ribbed_tee':
      return 1;
    case 'puffer':
      return 3;
    default:
      return 4;
  }
}

/** Silhueta do tronco. */
function torsoPath(look: Look): Path2D {
  const hw = torsoHalfWidth(look);
  const hy = hemY(look.top.style);
  const s = look.top.style;
  if (s === 'tank') {
    return blob([-3.5, -29, -hw + 3, -27, -hw + 2, -20, -hw + 1.5, -8, -hw + 2, hy, hw - 2, hy, hw - 1, -8, hw, -18, hw - 2, -26, 4.5, -29], 0.45);
  }
  if (s === 'puffer') {
    return blob([-4, -30, -hw + 1.5, -28, -hw, -21, -hw - 0.5, -10, -hw + 1, hy, 0, hy + 1.5, hw - 1, hy, hw + 0.5, -10, hw, -21, hw - 1.5, -28, 5, -30], 0.55);
  }
  const flare = s === 'trench' || s === 'robe' ? 3 : s === 'kimono' ? 1.5 : 0;
  return blob(
    [-4, -29, -hw + 2, -27.6, -hw, -23.5, -hw + 0.4, -12, -hw + 0.6 - flare, hy - 1.5, -hw + 2 - flare, hy, hw - 2 + flare, hy, hw - 0.4 + flare, hy - 1.5, hw + 0.4, -12, hw - 0.2, -23.5, hw - 2.4, -27.6, 4.5, -29],
    0.42,
  );
}

export function paintTorso(ctx: Ctx, look: Look, view: View): void {
  const t = look.top;
  const s = t.style;
  const hw = torsoHalfWidth(look);
  const hy = hemY(s);
  const c = t.color;
  const c2 = t.color2 ?? shadow(c, 0.25);
  const path = torsoPath(look);

  // mochila (alças por cima do tronco)
  volume(ctx, path, c, { shade: 4.2, shadeAmt: 0.36, hi: 2, hiAmt: s === 'puffer' ? 0.45 : 0.25 });

  ctx.save();
  ctx.clip(path);

  switch (s) {
    case 'hoodie': {
      // barra canelada
      flat(ctx, shadow(c, 0.16), (p) => p.rect(-hw - 4, hy - 3.6, hw * 2 + 8, 5));
      for (let x = -hw; x < hw; x += 1.6) detail(ctx, alpha(darken(c, 0.4), 0.35), 0.35, (p) => (p.moveTo(x, hy - 3.4), p.lineTo(x, hy + 1)));
      if (view === 'front') {
        // bolso canguru
        const pocket = poly([-6, -11, 10, -11, 12, -2.5, -8, -2.5], 2);
        volume(ctx, pocket, shadow(c, 0.08), { shade: 1.2, shadeAmt: 0.25, hi: 0.8, hiAmt: 0.15, line: 0.7 });
        detail(ctx, alpha(darken(c, 0.45), 0.6), 0.6, (p) => (p.moveTo(-6.6, -9.5), p.quadraticCurveTo(-8, -6, -7.6, -3.5)));
        detail(ctx, alpha(darken(c, 0.45), 0.6), 0.6, (p) => (p.moveTo(10.4, -9.5), p.quadraticCurveTo(12, -6, 11.6, -3.5)));
        // cordões
        const sc = t.color2 ?? lighten(c, 0.55);
        detail(ctx, sc, 0.9, (p) => (p.moveTo(-0.5, -27.5), p.quadraticCurveTo(-1.2, -22, -0.6, -17.5)));
        detail(ctx, sc, 0.9, (p) => (p.moveTo(4.6, -27.5), p.quadraticCurveTo(5.6, -21, 5.2, -15.8)));
        flat(ctx, light(sc, 0.2), (p) => (p.rect(-1.3, -18.5, 1.4, 2.4), p.rect(4.4, -16.8, 1.4, 2.4)));
      } else {
        // capuz caído nas costas
        const hood = blob([-9, -29, 7, -29, 8, -22, 2, -15.5, -5, -16, -10, -22], 0.6);
        volume(ctx, hood, shadow(c, 0.06), { shade: 1.5, shadeAmt: 0.3, hi: 1, hiAmt: 0.2, line: 0.8 });
        detail(ctx, alpha(darken(c, 0.5), 0.5), 0.6, (p) => (p.moveTo(-6, -26), p.quadraticCurveTo(-1, -19, 5, -26)));
      }
      folds(ctx, c, hw, hy);
      break;
    }
    case 'oversized_tee':
    case 'ribbed_tee': {
      if (s === 'ribbed_tee') for (let x = -hw; x < hw; x += 1.25) detail(ctx, alpha(darken(c, 0.5), 0.28), 0.35, (p) => (p.moveTo(x, -30), p.lineTo(x + 0.4, hy + 2)));
      // gola
      if (view === 'front') {
        detail(ctx, shadow(c, 0.35), 1.6, (p) => (p.moveTo(-3.5, -28.8), p.quadraticCurveTo(1.5, -24.5, 5, -28.6)));
      }
      flat(ctx, alpha(shadow(c, 0.3), 0.5), (p) => p.rect(-hw - 2, hy - 1.4, hw * 2 + 4, 2));
      folds(ctx, c, hw, hy);
      break;
    }
    case 'puffer': {
      for (let y = -24; y < hy; y += 5.2) {
        detail(ctx, alpha(darken(c, 0.45), 0.75), 0.75, (p) => (p.moveTo(-hw - 2, y), p.quadraticCurveTo(0, y + 1.6, hw + 2, y)));
        detail(ctx, alpha(lighten(c, 0.6), 0.3), 1.2, (p) => (p.moveTo(-hw * 0.6, y + 2.4), p.quadraticCurveTo(0, y + 3.4, hw * 0.4, y + 2.6)));
      }
      if (view === 'front') {
        detail(ctx, darken(c, 0.45), 0.8, (p) => (p.moveTo(2.5, -29), p.lineTo(3, hy + 1)));
        flat(ctx, '#d8d8e0', (p) => p.rect(2.1, -27, 1.3, 2.6));
      }
      // gola alta
      const collar = roundRect(-6, -33, 13, 6, 2.5);
      volume(ctx, collar, shadow(c, 0.05), { shade: 1, shadeAmt: 0.25, hiAmt: 0.3, line: 0.7 });
      break;
    }
    case 'turtleneck_jacket':
    case 'tracksuit': {
      if (view === 'front') {
        detail(ctx, darken(c, 0.5), 0.7, (p) => (p.moveTo(2.6, -29), p.lineTo(2.8, hy + 1)));
        for (let y = -27; y < hy; y += 1.2) detail(ctx, alpha('#e9e9ef', 0.55), 0.3, (p) => (p.moveTo(2.1, y), p.lineTo(3.3, y)));
        flat(ctx, '#e5e5ee', (p) => p.rect(2.1, -22, 1.6, 3.2));
      }
      if (s === 'tracksuit') {
        detail(ctx, c2, 1.6, (p) => (p.moveTo(-hw + 1.2, -26), p.lineTo(-hw + 1.6, hy)));
        detail(ctx, c2, 1.6, (p) => (p.moveTo(hw - 1.2, -26), p.lineTo(hw - 1.6, hy)));
      }
      flat(ctx, shadow(c, 0.18), (p) => p.rect(-hw - 2, hy - 3, hw * 2 + 4, 4));
      for (let x = -hw; x < hw; x += 1.5) detail(ctx, alpha(darken(c, 0.4), 0.3), 0.3, (p) => (p.moveTo(x, hy - 3), p.lineTo(x, hy + 1)));
      folds(ctx, c, hw, hy);
      break;
    }
    case 'varsity': {
      // corpo em c, mangas em c2 (nas peças de braço); botões e listras
      if (view === 'front') {
        for (let y = -24; y < hy - 2; y += 5) flat(ctx, lighten(c2, 0.4), (p) => p.arc(3, y, 0.9, 0, Math.PI * 2));
        detail(ctx, alpha(darken(c, 0.4), 0.5), 0.6, (p) => (p.moveTo(2.6, -28), p.lineTo(2.6, hy)));
      }
      flat(ctx, c2, (p) => p.rect(-hw - 2, hy - 3.2, hw * 2 + 4, 3.6));
      detail(ctx, lighten(c2, 0.5), 0.8, (p) => (p.moveTo(-hw, hy - 2), p.lineTo(hw, hy - 2)));
      folds(ctx, c, hw, hy);
      break;
    }
    case 'trench':
    case 'robe': {
      if (view === 'front') {
        const lapel = poly([-2, -28.5, 4.5, -28.5, 7.5, -16, 3, -10], 1);
        volume(ctx, lapel, shadow(c, 0.12), { shade: 1, shadeAmt: 0.2, line: 0.6 });
        detail(ctx, alpha(darken(c, 0.5), 0.7), 0.7, (p) => (p.moveTo(3, -10), p.lineTo(4, hy)));
      }
      if (s === 'trench') flat(ctx, c2, (p) => p.rect(-hw - 2, -6, hw * 2 + 4, 2.6));
      folds(ctx, c, hw, hy);
      break;
    }
    case 'kimono': {
      if (view === 'front') {
        detail(ctx, c2, 2.2, (p) => (p.moveTo(-3, -29), p.lineTo(7, -10)));
        detail(ctx, c2, 2.2, (p) => (p.moveTo(6, -29), p.lineTo(2, -20)));
      }
      flat(ctx, c2, (p) => p.rect(-hw - 2, -9, hw * 2 + 4, 4.5));
      folds(ctx, c, hw, hy);
      break;
    }
    case 'vest': {
      flat(ctx, alpha(darken(c, 0.4), 0.6), (p) => (p.moveTo(-hw, -12), p.lineTo(hw, -12)));
      if (view === 'front') detail(ctx, darken(c, 0.5), 0.8, (p) => (p.moveTo(2.6, -28), p.lineTo(2.6, hy)));
      break;
    }
    case 'tank': {
      if (view === 'front') detail(ctx, shadow(c, 0.4), 1.2, (p) => (p.moveTo(-2.5, -28.8), p.quadraticCurveTo(1.5, -22, 5, -28.6)));
      break;
    }
  }

  // estampa no peito (frente) ou nas costas
  if (t.print && t.print !== 'none') {
    const big = view === 'back';
    paintPrint(ctx, t.print, big ? -1 : 3.2, big ? -16 : -19, big ? 8 : 5.4, t.color2 ?? lighten(c, 0.7), t.text);
  }

  // mochila: alças
  if (look.acc?.backpack && view === 'front') {
    const bc = look.acc.backpack;
    volume(ctx, poly([-7, -29, -4, -29, -5, -8, -8, -8], 1), bc, { shade: 0.8, shadeAmt: 0.3, line: 0.6 });
    volume(ctx, poly([7, -29, 10, -28.5, 9.5, -8, 6.5, -8], 1), bc, { shade: 0.8, shadeAmt: 0.3, line: 0.6 });
    flat(ctx, '#d6d6de', (p) => (p.rect(-7.4, -16, 3.6, 1.6), p.rect(6.6, -16, 3.6, 1.6)));
  }
  // corrente de pescoço
  if (look.acc?.chain && view === 'front') {
    detail(ctx, look.acc.chain, 1.1, (p) => (p.moveTo(-3.5, -28.5), p.quadraticCurveTo(1, -19, 6, -28.4)), [1.2, 0.6]);
    const pend = ellipse(1.6, -20.4, 1.8, 2.2);
    volume(ctx, pend, look.acc.chain, { shade: 0.6, shadeAmt: 0.35, hiAmt: 0.6, line: 0.4 });
  }
  ctx.restore();

  // pescoço visível (tops sem gola alta)
  if (s !== 'puffer' && s !== 'turtleneck_jacket' && view === 'front') {
    const neck = poly([-3, -30.5, 4.4, -30.5, 4, -28, -2.6, -28], 0.6);
    volume(ctx, neck, shadow(look.skin, 0.25), { shade: 0.6, shadeAmt: 0.2, hiAmt: 0, line: 0 });
  }
  if (s === 'turtleneck_jacket') {
    // gola alta que cobre o queixo (ref. 2)
    const collar = poly([-6.5, -35, 7.5, -35, 8, -26.5, -7, -26.5], 2.4);
    volume(ctx, collar, shadow(c, 0.04), { shade: 1.4, shadeAmt: 0.3, hiAmt: 0.25, line: 0.7 });
    detail(ctx, alpha(darken(c, 0.5), 0.7), 0.6, (p) => (p.moveTo(2.6, -35), p.lineTo(2.6, -27)));
  }
}

function folds(ctx: Ctx, c: string, hw: number, hy: number): void {
  const col = alpha(darken(shadow(c, 0.4), 0.2), 0.55);
  detail(ctx, col, 0.6, (p) => (p.moveTo(-hw + 2, -21), p.quadraticCurveTo(-hw + 5, -17, -hw + 4, -12)));
  detail(ctx, col, 0.6, (p) => (p.moveTo(hw - 2, -22), p.quadraticCurveTo(hw - 5, -18, hw - 6, -14)));
  detail(ctx, col, 0.5, (p) => (p.moveTo(-hw + 3, hy - 6), p.quadraticCurveTo(-2, hy - 4, -4, hy - 1.5)));
  detail(ctx, alpha(lighten(c, 0.6), 0.22), 1, (p) => (p.moveTo(-hw + 3, -25), p.quadraticCurveTo(-2, -27, 2, -26.5)));
}

/** Capuz caído em volta do pescoço (fica atrás da cabeça, por cima do tronco). */
export function paintHoodCollar(ctx: Ctx, look: Look, view: View): void {
  const c = look.top.color;
  if (look.top.style !== 'hoodie' || look.top.hood === 'up') return;
  if (view === 'front') {
    const p = blob([-10, -28, -7, -33, 0, -34.5, 7.5, -32.5, 9.5, -28, 3, -25.5, -4, -26], 0.55);
    volume(ctx, p, shadow(c, 0.05), { shade: 1.4, shadeAmt: 0.32, hi: 1, hiAmt: 0.22, line: 0.8 });
    detail(ctx, alpha(darken(c, 0.5), 0.65), 0.7, (p2) => (p2.moveTo(-6.5, -29.5), p2.quadraticCurveTo(1, -27, 7, -29.8)));
  }
}

// ---------------------------------------------------------------------------
// Braços
// ---------------------------------------------------------------------------

type SleeveKind = 'long' | 'short' | 'none' | 'wide';

function sleeveKind(s: TopStyle): SleeveKind {
  if (s === 'oversized_tee' || s === 'ribbed_tee') return 'short';
  if (s === 'tank' || s === 'vest') return 'none';
  if (s === 'kimono' || s === 'robe') return 'wide';
  return 'long';
}

function sleeveColor(look: Look): string {
  return look.top.style === 'varsity' ? (look.top.color2 ?? look.top.color) : look.top.color;
}

export function armSkin(look: Look): string {
  if (look.species === 'skeleton') return '#efe6d2';
  if (look.species === 'robot') return '#9aa6b8';
  return look.skin;
}

export function paintUpperArm(ctx: Ctx, look: Look, front: boolean): void {
  const kind = sleeveKind(look.top.style);
  const c = sleeveColor(look);
  const tint = front ? c : shadow(c, 0.12);
  const skin = front ? armSkin(look) : shadow(armSkin(look), 0.12);
  const puffy = look.top.style === 'puffer';
  if (kind === 'none') {
    limbSkin(ctx, look, skin, 6.6, 6, 15);
    return;
  }
  if (kind === 'short') {
    limbSkin(ctx, look, skin, 6.4, 6, 15);
    const sl = poly([-6.4, -3, 6.2, -3, 7.2, 9.5, -6.6, 10], 2);
    volume(ctx, sl, tint, { shade: 2, shadeAmt: 0.3, hiAmt: 0.2, line: 0.8 });
    detail(ctx, alpha(darken(c, 0.5), 0.5), 0.6, (p) => (p.moveTo(-5.4, 7), p.quadraticCurveTo(-2, 4, 1, 6)));
    return;
  }
  const w0 = puffy ? 13 : kind === 'wide' ? 12.5 : 11;
  const w1 = puffy ? 12.5 : kind === 'wide' ? 14 : 10;
  const p = taper(-1, 13.5, w0, w1);
  volume(ctx, p, tint, { shade: 2.4, shadeAmt: 0.32, hi: 1.2, hiAmt: puffy ? 0.4 : 0.2, line: 0.8 });
  if (puffy) for (let y = 3; y < 14; y += 4.5) detail(ctx, alpha(darken(c, 0.45), 0.7), 0.7, (pp) => (pp.moveTo(-w0 / 2, y), pp.quadraticCurveTo(0, y + 1.4, w0 / 2, y)));
  else {
    detail(ctx, alpha(darken(shadow(c, 0.4), 0.2), 0.5), 0.55, (pp) => (pp.moveTo(-3.5, 2), pp.quadraticCurveTo(-1, 6, -3, 10)));
    detail(ctx, alpha(darken(shadow(c, 0.4), 0.2), 0.5), 0.55, (pp) => (pp.moveTo(2.5, 8), pp.quadraticCurveTo(4, 11, 2, 13)));
  }
  if (look.top.style === 'tracksuit' && look.top.color2) detail(ctx, look.top.color2, 1.3, (pp) => (pp.moveTo(w0 / 2 - 1.5, -1), pp.lineTo(w1 / 2 - 1.5, 13)));
}

export function paintForearm(ctx: Ctx, look: Look, front: boolean): void {
  const kind = sleeveKind(look.top.style);
  const c = sleeveColor(look);
  const tint = front ? c : shadow(c, 0.12);
  const skin = front ? armSkin(look) : shadow(armSkin(look), 0.12);
  if (kind === 'none' || kind === 'short') {
    limbSkin(ctx, look, skin, 6, 5.4, 13.5);
    if (look.acc?.watch && front) {
      const w = roundRect(-3.6, 9.2, 7.2, 3, 1);
      volume(ctx, w, '#c9ccd6', { shade: 0.6, shadeAmt: 0.3, hiAmt: 0.5, line: 0.5 });
      flat(ctx, '#2a2f3a', (p) => p.rect(-1.4, 9.6, 2.8, 2.2));
    }
    return;
  }
  const puffy = look.top.style === 'puffer';
  const w0 = puffy ? 12.5 : kind === 'wide' ? 14 : 10;
  const w1 = puffy ? 11.5 : kind === 'wide' ? 16 : 9;
  const p = taper(-1, 11, w0, w1);
  volume(ctx, p, tint, { shade: 2.2, shadeAmt: 0.32, hi: 1.2, hiAmt: puffy ? 0.4 : 0.2, line: 0.8 });
  if (kind === 'wide') return;
  // punho canelado
  const cuff = roundRect(-w1 / 2 + 0.6, 9.5, w1 - 1.2, 4, 1.4);
  const cuffC = look.top.style === 'varsity' ? (look.top.color ?? c) : shadow(tint, 0.14);
  volume(ctx, cuff, cuffC, { shade: 0.8, shadeAmt: 0.28, hiAmt: 0.15, line: 0.7 });
  ctx.save();
  ctx.clip(cuff);
  for (let x = -6; x < 6; x += 1.2) detail(ctx, alpha(darken(c, 0.5), 0.35), 0.3, (pp) => (pp.moveTo(x, 9), pp.lineTo(x, 14)));
  ctx.restore();
  if (puffy) detail(ctx, alpha(darken(c, 0.45), 0.7), 0.7, (pp) => (pp.moveTo(-w0 / 2, 4.5), pp.quadraticCurveTo(0, 6, w0 / 2, 4.5)));
}

function limbSkin(ctx: Ctx, look: Look, skin: string, w0: number, w1: number, h: number): void {
  if (look.species === 'skeleton') {
    const bone = taper(0, h - 1, 3.2, 3);
    volume(ctx, bone, skin, { shade: 0.8, shadeAmt: 0.3, hiAmt: 0.3, line: 0.6 });
    return;
  }
  const p = taper(-0.5, h - 1, w0, w1);
  volume(ctx, p, skin, { shade: 1.6, shadeAmt: 0.3, hi: 0.8, hiAmt: 0.22, line: 0.6 });
  if (look.species === 'robot') detail(ctx, alpha('#1d2230', 0.6), 0.5, (pp) => (pp.moveTo(-w0 / 2, h / 2), pp.lineTo(w0 / 2, h / 2)));
}

/** Mão: punho, aberta, paz, apontando ou segurando. */
export function paintHand(ctx: Ctx, look: Look, front: boolean, shape: string): void {
  const gloves = look.weapon.kind === 'gloves';
  const skin = gloves ? look.weapon.color : front ? armSkin(look) : shadow(armSkin(look), 0.12);
  const skel = look.species === 'skeleton';
  const s = gloves ? 1.45 : 1;
  ctx.save();
  ctx.scale(s, s);
  const opt = { shade: 1, shadeAmt: 0.3, hi: 0.6, hiAmt: 0.25, line: 0.7 };
  if (shape === 'open' || shape === 'peace' || shape === 'point') {
    const palm = roundRect(-3.2, 0, 6.4, 5.6, 2.2);
    if (shape === 'open') {
      for (let i = 0; i < 4; i++) {
        const f = taper(4.5, 9.5 - Math.abs(i - 1.5) * 0.6, 1.7, 1.5);
        ctx.save();
        ctx.translate(-2.4 + i * 1.6, 0);
        ctx.rotate((i - 1.5) * 0.12);
        volume(ctx, f, skin, opt);
        ctx.restore();
      }
    } else {
      const fingers = shape === 'peace' ? [-1, 1.2] : [0.6];
      for (const fx of fingers) {
        const f = taper(4, 11, 1.8, 1.6);
        ctx.save();
        ctx.translate(fx, 0);
        ctx.rotate(fx * 0.18);
        volume(ctx, f, skin, opt);
        ctx.restore();
      }
    }
    volume(ctx, palm, skin, opt);
    const thumb = taper(1, 5, 2, 1.8);
    ctx.save();
    ctx.translate(3, 1.5);
    ctx.rotate(-0.7);
    volume(ctx, thumb, skin, opt);
    ctx.restore();
  } else {
    // punho / segurando
    const fist = roundRect(-3.6, -0.5, 7.4, 7, 2.8);
    volume(ctx, fist, skin, opt);
    if (!gloves) {
      const knuckle = alpha(darken(shadow(skin, 0.4), 0.2), skel ? 0.9 : 0.5);
      for (let i = 0; i < 3; i++) detail(ctx, knuckle, 0.45, (p) => (p.moveTo(0.6 + i * 0.1, 1.6 + i * 1.6), p.lineTo(3.4, 1.4 + i * 1.6)));
      const thumb = roundRect(-4, 1, 3.2, 4.6, 1.4);
      volume(ctx, thumb, skin, opt);
    } else {
      detail(ctx, alpha('#ffffff', 0.4), 0.8, (p) => (p.moveTo(-2, 1), p.quadraticCurveTo(0, 0, 2, 1)));
      flat(ctx, look.weapon.color2 ?? '#f2f2f2', (p) => p.rect(-3.6, -1.6, 7.4, 2));
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Pernas (calças largas com dobras)
// ---------------------------------------------------------------------------

function pantsWidth(look: Look): [number, number, number] {
  const b = { slim: 0, normal: 0.6, broad: 1.2, heavy: 2.2 }[look.body];
  switch (look.pants.style) {
    case 'baggy':
      return [14.5 + b, 15.5 + b, 18 + b];
    case 'cargo':
      return [14 + b, 15 + b, 17 + b];
    case 'wide_jeans':
      return [13.5 + b, 14.5 + b, 17 + b];
    case 'hakama':
      return [16 + b, 18 + b, 21 + b];
    case 'skirt':
      return [9 + b, 8 + b, 7 + b];
    case 'track':
      return [12.5 + b, 11 + b, 10 + b];
    case 'shorts':
      return [14 + b, 15 + b, 7 + b];
  }
}

export function paintThigh(ctx: Ctx, look: Look, front: boolean): void {
  const ps = look.pants.style;
  const c = front ? look.pants.color : shadow(look.pants.color, 0.14);
  const [w0, w1] = pantsWidth(look);
  if (ps === 'skirt') {
    // meia-calça/legging
    const leg = taper(-2, 21, 8.5, 7.6);
    volume(ctx, leg, look.pants.color2 ?? '#222', { shade: 1.4, shadeAmt: 0.3, hiAmt: 0.25, line: 0.6 });
    return;
  }
  const p = poly([-w0 / 2, -4, w0 / 2, -4, w1 / 2 + 0.4, 22.5, -w1 / 2 - 0.4, 22.5], 3);
  volume(ctx, p, c, { shade: 3, shadeAmt: 0.34, hi: 1.4, hiAmt: 0.2, line: 0.8 });
  ctx.save();
  ctx.clip(p);
  const fold = alpha(darken(shadow(c, 0.45), 0.25), 0.6);
  detail(ctx, fold, 0.7, (pp) => (pp.moveTo(-w0 / 2 + 2, 6), pp.quadraticCurveTo(0, 10, w0 / 2 - 1, 16)));
  detail(ctx, fold, 0.6, (pp) => (pp.moveTo(-w0 / 2 + 3, 15), pp.quadraticCurveTo(-1, 17.5, 2, 21)));
  detail(ctx, alpha(lighten(c, 0.5), 0.25), 1.3, (pp) => (pp.moveTo(w0 / 2 - 3, -1), pp.quadraticCurveTo(w0 / 2 - 2, 8, w1 / 2 - 2.5, 18)));
  if (ps === 'cargo') {
    const pk = roundRect(-w0 / 2 + 1.2, 7, 7.8, 8.6, 1.2);
    volume(ctx, pk, shadow(c, 0.06), { shade: 0.9, shadeAmt: 0.25, hiAmt: 0.15, line: 0.6 });
    flat(ctx, shadow(c, 0.2), (pp) => pp.rect(-w0 / 2 + 1.2, 7, 7.8, 2.4));
    flat(ctx, '#c9c9d4', (pp) => pp.arc(-w0 / 2 + 5.1, 8.2, 0.6, 0, Math.PI * 2));
  }
  if (ps === 'wide_jeans') {
    detail(ctx, alpha('#f2d68a', 0.6), 0.45, (pp) => (pp.moveTo(w0 / 2 - 1.4, -3), pp.lineTo(w1 / 2 - 1.2, 22)), [1, 0.8]);
    detail(ctx, alpha('#ffffff', 0.18), 3, (pp) => (pp.moveTo(1, 2), pp.lineTo(1.5, 14)));
  }
  if (ps === 'track') detail(ctx, look.pants.color2 ?? '#ffffff', 1.4, (pp) => (pp.moveTo(w0 / 2 - 1.2, -3), pp.lineTo(w1 / 2 - 1, 22)));
  if (ps === 'hakama') for (let x = -6; x <= 6; x += 3) detail(ctx, fold, 0.6, (pp) => (pp.moveTo(x, -3), pp.lineTo(x * 1.2, 22)));
  ctx.restore();
  if (ps === 'shorts') {
    const leg = taper(14, 22, 6.8, 6.4);
    volume(ctx, leg, armSkin(look), { shade: 1.2, shadeAmt: 0.28, hiAmt: 0.2, line: 0.6 });
    const hem = roundRect(-w1 / 2 - 0.6, 12, w1 + 1.2, 3.4, 1.2);
    volume(ctx, hem, shadow(c, 0.1), { shade: 0.8, shadeAmt: 0.25, line: 0.6 });
  }
}

export function paintShin(ctx: Ctx, look: Look, front: boolean): void {
  const ps = look.pants.style;
  const c = front ? look.pants.color : shadow(look.pants.color, 0.14);
  const [, w1, w2] = pantsWidth(look);
  if (ps === 'shorts' || ps === 'skirt') {
    const skin = ps === 'skirt' ? (look.pants.color2 ?? '#222') : armSkin(look);
    const leg = taper(-1, 19, 6.6, 5.6);
    volume(ctx, leg, skin, { shade: 1.2, shadeAmt: 0.28, hiAmt: 0.2, line: 0.6 });
    if (ps === 'shorts') {
      const sock = roundRect(-3.4, 12, 6.8, 7, 1.5);
      volume(ctx, sock, '#f4f4f7', { shade: 0.8, shadeAmt: 0.25, line: 0.5 });
      flat(ctx, look.pants.color2 ?? '#e23b3b', (p) => (p.rect(-3.4, 13, 6.8, 0.8), p.rect(-3.4, 14.4, 6.8, 0.8)));
    }
    return;
  }
  // calça empilhada no tênis: barra larga e ondulada
  const bottom = 21;
  const p = new Path2D();
  p.moveTo(-w1 / 2, -2);
  p.lineTo(w1 / 2, -2);
  p.quadraticCurveTo(w2 / 2 + 0.6, 10, w2 / 2 + 0.4, bottom - 1.5);
  p.quadraticCurveTo(w2 / 4, bottom + 0.6, 0, bottom - 0.8);
  p.quadraticCurveTo(-w2 / 4, bottom + 1.2, -w2 / 2 - 0.4, bottom - 1);
  p.quadraticCurveTo(-w2 / 2 - 0.6, 10, -w1 / 2, -2);
  p.closePath();
  volume(ctx, p, c, { shade: 3, shadeAmt: 0.34, hi: 1.4, hiAmt: 0.2, line: 0.8 });
  ctx.save();
  ctx.clip(p);
  const fold = alpha(darken(shadow(c, 0.45), 0.25), 0.65);
  // dobras empilhadas na barra (o "stack" das calças largas)
  for (let i = 0; i < 3; i++) {
    const y = 9 + i * 3.2;
    detail(ctx, fold, 0.7, (pp) => (pp.moveTo(-w2 / 2, y + 1.5), pp.quadraticCurveTo(-1, y - 1.5 + i, w2 / 2, y + 2)));
  }
  detail(ctx, fold, 0.6, (pp) => (pp.moveTo(w1 / 2 - 2, 0), pp.quadraticCurveTo(1, 5, -2, 11)));
  detail(ctx, alpha(lighten(c, 0.5), 0.22), 1.4, (pp) => (pp.moveTo(w1 / 2 - 2.6, 1), pp.quadraticCurveTo(w2 / 2 - 2, 8, w2 / 2 - 3, 13)));
  if (ps === 'wide_jeans') detail(ctx, alpha('#f2d68a', 0.6), 0.45, (pp) => (pp.moveTo(w1 / 2 - 1.2, -2), pp.lineTo(w2 / 2 - 1, bottom - 1)), [1, 0.8]);
  if (ps === 'track') detail(ctx, look.pants.color2 ?? '#ffffff', 1.4, (pp) => (pp.moveTo(w1 / 2 - 1, -2), pp.lineTo(w2 / 2 - 1, bottom)));
  if (ps === 'cargo') {
    detail(ctx, darken(c, 0.45), 1.6, (pp) => (pp.moveTo(-w2 / 2, 17), pp.lineTo(w2 / 2, 18.2)));
    flat(ctx, '#bfc3cf', (pp) => pp.rect(w2 / 2 - 3, 16.6, 2, 2));
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Tênis (vista lateral, bico pra frente = +x)
// ---------------------------------------------------------------------------

export function paintShoe(ctx: Ctx, look: Look, front: boolean): void {
  const sh = look.shoes;
  const c = front ? sh.color : shadow(sh.color, 0.12);
  const sole = sh.sole ?? '#f4f2ec';
  const acc = sh.accent ?? '#16141c';
  const opt = { shade: 1.2, shadeAmt: 0.3, hi: 0.8, hiAmt: 0.3, line: 0.8 };
  if (sh.style === 'slides') {
    const sock = roundRect(-5, -4, 14, 6, 3);
    volume(ctx, sock, '#f0f0f4', opt);
    const s = roundRect(-6, 1.8, 18, 2.6, 1.2);
    volume(ctx, s, sole, opt);
    const strap = roundRect(-1, -2.5, 10, 4.4, 2);
    volume(ctx, strap, c, opt);
    return;
  }
  // tênis grandão (estilo das referências): escala a partir do calcanhar no chão
  ctx.save();
  ctx.translate(0, 4.6);
  ctx.scale(1.32, 1.32);
  ctx.translate(0, -4.6);
  paintShoeInner(ctx, sh, c, sole, acc, opt);
  ctx.restore();
}

function paintShoeInner(ctx: Ctx, sh: Look['shoes'], c: string, sole: string, acc: string, opt: { shade: number; shadeAmt: number; hi: number; hiAmt: number; line: number }): void {
  const chunky = sh.style === 'chunky';
  const solH = chunky ? 4.6 : sh.style === 'boots' ? 3.4 : 3;
  const upperTop = sh.style === 'hightop' || sh.style === 'boots' ? -8 : -4.5;
  // sola
  const solePath = new Path2D();
  solePath.moveTo(-7, 4.4 - solH);
  solePath.lineTo(12.5, 4.4 - solH);
  solePath.quadraticCurveTo(15.6, 4.4 - solH, 15.2, 2);
  solePath.quadraticCurveTo(14.6, 4.6, 11, 4.6);
  solePath.lineTo(-6, 4.6);
  solePath.quadraticCurveTo(-8.2, 4.6, -7.8, 2);
  solePath.closePath();
  // cabedal
  const up = new Path2D();
  up.moveTo(-6.6, 4.6 - solH);
  up.lineTo(-6.8, upperTop + 1.5);
  up.quadraticCurveTo(-6, upperTop, -2, upperTop - 0.2);
  up.lineTo(3, upperTop + 0.6);
  up.quadraticCurveTo(8, -2.6 + (upperTop < -5 ? 1.5 : 0), 12, -0.4);
  up.quadraticCurveTo(15, 0.8, 14.6, 4.4 - solH);
  up.closePath();
  volume(ctx, up, c, opt);
  ctx.save();
  ctx.clip(up);
  // biqueira
  flat(ctx, shadow(c, 0.08), (p) => p.ellipse(13, 0.6, 4.4, 3.4, 0, 0, Math.PI * 2));
  // listra lateral (sem logo de marca real)
  if (sh.style !== 'boots') {
    detail(ctx, acc, 1.6, (p) => (p.moveTo(-4, 1.8 - solH * 0.2), p.quadraticCurveTo(3, 0, 9.5, -0.6)));
    detail(ctx, alpha('#ffffff', 0.35), 0.5, (p) => (p.moveTo(-4, 1.2 - solH * 0.2), p.quadraticCurveTo(3, -0.6, 9.5, -1.2)));
  }
  if (sh.style === 'hightop') {
    flat(ctx, acc, (p) => p.arc(-3.3, -4.6, 1.8, 0, Math.PI * 2));
    flat(ctx, lighten(acc, 0.85), (p) => p.arc(-3.3, -4.6, 0.8, 0, Math.PI * 2));
  }
  // cadarços
  for (let i = 0; i < 4; i++) {
    const x = 1 + i * 2.4;
    const y = upperTop + 1.4 + i * (sh.style === 'hightop' ? 1.2 : 0.9);
    detail(ctx, sh.style === 'boots' ? '#d8c9a8' : '#fbfbff', 0.8, (p) => (p.moveTo(x - 1, y), p.lineTo(x + 1.2, y + 1)));
  }
  ctx.restore();
  volume(ctx, solePath, sole, { shade: 0.8, shadeAmt: 0.22, hi: 0.5, hiAmt: 0.3, line: 0.7 });
  if (chunky) detail(ctx, alpha(darken(sole, 0.35), 0.8), 0.5, (p) => (p.moveTo(-6.6, 2.6), p.lineTo(14.4, 2.6)));
  detail(ctx, alpha(darken(sole, 0.5), 0.6), 0.4, (p) => {
    for (let x = -5; x < 13; x += 2.2) (p.moveTo(x, 3.6), p.lineTo(x + 0.8, 4.4));
  });
}

/** Mochila / asas / cauda (atrás do corpo). */
export function paintBackItem(ctx: Ctx, look: Look, view: View): void {
  const a = look.acc;
  if (!a) return;
  if (a.wings) {
    const wc = a.wings === 'angel' ? '#f6f3ff' : a.wings === 'bone' ? '#efe6d2' : a.wings === 'void' ? '#2a1450' : '#2b1838';
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      const w = blob([2, -24, 14, -40, 26, -38, 30, -28, 24, -22, 26, -14, 18, -12, 8, -16], 0.5);
      volume(ctx, w, side < 0 ? shadow(wc, 0.15) : wc, { shade: 2, shadeAmt: 0.3, hiAmt: 0.25, line: 0.8 });
      if (a.wings !== 'angel') detail(ctx, alpha(darken(wc, 0.5), 0.7), 0.7, (p) => (p.moveTo(6, -22), p.lineTo(25, -34), p.moveTo(9, -19), p.lineTo(26, -25), p.moveTo(10, -16), p.lineTo(19, -13)));
      if (a.wings === 'void') detail(ctx, alpha('#b77bff', 0.7), 1.2, (p) => (p.moveTo(14, -38), p.quadraticCurveTo(28, -32, 24, -22)));
      ctx.restore();
    }
  }
  if (a.backpack && view === 'back') {
    const bp = roundRect(-9, -26, 18, 20, 4);
    volume(ctx, bp, a.backpack, { shade: 2, shadeAmt: 0.3, hiAmt: 0.2, line: 0.8 });
    const pocket = roundRect(-6, -14, 12, 7, 2);
    volume(ctx, pocket, shadow(a.backpack, 0.1), { shade: 1, shadeAmt: 0.25, line: 0.6 });
    detail(ctx, '#cfd2dc', 0.8, (p) => (p.moveTo(-6, -14), p.lineTo(6, -14)));
  }
  if (a.backpack && view === 'front') {
    const bp = roundRect(-16, -26, 9, 19, 3);
    volume(ctx, bp, shadow(a.backpack, 0.15), { shade: 1.4, shadeAmt: 0.3, line: 0.7 });
  }
  if (a.tail) {
    const tc = look.species === 'demon' ? look.skin : look.hair.color;
    const tail = new Path2D();
    tail.moveTo(-6, -2);
    tail.bezierCurveTo(-18, 0, -20, -14, -26, -12);
    tail.lineTo(-25, -9.5);
    tail.bezierCurveTo(-20, -10, -17, 4, -5, 1.5);
    tail.closePath();
    volume(ctx, tail, tc, { shade: 0.8, shadeAmt: 0.3, hiAmt: 0.2, line: 0.7 });
    if (look.species === 'demon') volume(ctx, poly([-27, -15, -23, -13, -26, -8], 0.5), tc, { line: 0.6 });
  }
}

