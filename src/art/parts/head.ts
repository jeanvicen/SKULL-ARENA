import type { Look } from '../../content/types';
import type { FaceExpr } from '../rig';
import { alpha, darken, light, lighten, shadow, mix } from '../color';
import { blob, detail, ellipse, flat, poly, roundRect, volume, type Ctx } from '../paint';
import type { View } from './body';

/**
 * CABEÇA, CABELO, ROSTO E ACESSÓRIOS
 * Espaço local do osso "head": pivô no pescoço; centro da cabeça ≈ (1.5, -13).
 * Rosto olhando pra direita (3/4): olho da frente em x≈8.5, olho de trás em x≈1.5.
 */

const OPT = { shade: 2.6, shadeAmt: 0.3, hi: 1.4, hiAmt: 0.22, line: 0.8 };

export function headPath(look: Look): Path2D {
  switch (look.species) {
    case 'skeleton':
      return blob([1, -29, 11, -26, 15, -17, 14, -9, 10, -5, 2, -5, -7, -7, -13, -12, -14, -20, -9, -27], 0.5);
    case 'robot':
      return roundRect(-12.5, -28, 27, 26, [7, 8, 6, 6]);
    case 'alien':
      return blob([1, -33, 12, -27, 15, -17, 12, -7, 6, -0.5, 1, 0.5, -5, -3, -11, -9, -14, -18, -10, -29], 0.5);
    case 'lizard':
      return blob([0, -28, 10, -25, 17, -15, 17, -8, 9, -2.5, 2, 0.5, -6, -3, -11, -8, -13.5, -16, -10, -25], 0.5);
    default:
      return blob([1, -28, 11.5, -23.5, 14, -14, 13, -6.5, 8, -0.5, 3, 1, -5, -2, -11, -7, -13.5, -14, -10.5, -24], 0.48);
  }
}

function skinOf(look: Look): string {
  if (look.species === 'skeleton') return '#efe6d2';
  if (look.species === 'robot') return '#a3aec0';
  return look.skin;
}

/** Base da cabeça (formato da espécie + orelha + detalhes fixos). */
export function paintHead(ctx: Ctx, look: Look, view: View): void {
  const skin = skinOf(look);
  const path = headPath(look);
  const ghost = look.species === 'ghost';
  if (ghost) ctx.globalAlpha = 0.9;
  volume(ctx, path, skin, OPT);
  ctx.save();
  ctx.clip(path);
  // sombra do cabelo/testa no topo da cabeça
  flat(ctx, alpha(shadow(skin, 0.5), 0.18), (p) => p.ellipse(0, -27, 16, 6, 0, 0, Math.PI * 2));
  if (look.species === 'void') {
    for (let i = 0; i < 14; i++) flat(ctx, alpha('#e6d6ff', 0.6 + (i % 3) * 0.1), (p) => p.arc(-12 + ((i * 37) % 26), -27 + ((i * 53) % 26), 0.35 + (i % 3) * 0.2, 0, Math.PI * 2));
  }
  if (look.species === 'lizard') {
    for (let i = 0; i < 10; i++) detail(ctx, alpha(darken(skin, 0.4), 0.45), 0.5, (p) => p.arc(-10 + (i % 5) * 4, -24 + Math.floor(i / 5) * 6, 1.6, 0, Math.PI));
  }
  if (look.species === 'zombie') {
    detail(ctx, alpha(darken(skin, 0.6), 0.8), 0.6, (p) => (p.moveTo(-6, -22), p.lineTo(4, -19)));
    for (let x = -5; x < 4; x += 2) detail(ctx, alpha(darken(skin, 0.6), 0.8), 0.5, (p) => (p.moveTo(x, -22), p.lineTo(x + 0.6, -18.6)));
  }
  if (look.species === 'robot') {
    flat(ctx, alpha('#ffffff', 0.2), (p) => p.rect(-12, -27, 26, 3));
    detail(ctx, alpha('#1f2533', 0.6), 0.6, (p) => (p.moveTo(-12.5, -6), p.lineTo(14.5, -6)));
    for (const [x, y] of [
      [-10, -25],
      [-10, -5],
    ])
      flat(ctx, '#5d6678', (p) => p.arc(x!, y!, 0.9, 0, Math.PI * 2));
  }
  ctx.restore();

  if (view === 'back') {
    if (ghost) ctx.globalAlpha = 1;
    return;
  }
  // orelha (lado de trás do rosto)
  if (look.species === 'robot') {
    const ear = roundRect(-8, -18, 5, 9, 1.6);
    volume(ctx, ear, '#7f8aa0', { ...OPT, line: 0.7 });
    flat(ctx, '#ff3b5c', (p) => p.arc(-5.5, -13.5, 1, 0, Math.PI * 2));
  } else if (look.species !== 'skeleton') {
    const pointy = look.species === 'demon' || look.species === 'vampire' || look.species === 'alien';
    const ear = pointy ? poly([-8.5, -16, -4.5, -15, -4.8, -8, -8, -9, -14, -21], 1) : ellipse(-7.2, -11.8, 2.3, 3.3);
    volume(ctx, ear, skin, { shade: 0.8, shadeAmt: 0.3, hiAmt: 0.15, line: 0.7 });
    if (!pointy) flat(ctx, alpha(shadow(skin, 0.45), 0.55), (p) => p.ellipse(-6.8, -11.6, 1.1, 2, 0, 0, Math.PI * 2));
    if (!pointy) detail(ctx, alpha(darken(skin, 0.5), 0.6), 0.5, (p) => (p.moveTo(-7.6, -13.8), p.quadraticCurveTo(-6.2, -12, -7.4, -10)));
    if (look.face?.piercings) for (let i = 0; i < look.face.piercings; i++) flat(ctx, '#d9dbe4', (p) => p.arc(-8.6 + i * 0.4, -9.4 + i * 1.6, 0.55, 0, Math.PI * 2));
  }
  if (look.species === 'skeleton') {
    // maçã do rosto + mandíbula
    detail(ctx, alpha('#8d7f66', 0.7), 0.6, (p) => (p.moveTo(3, -7), p.quadraticCurveTo(8, -9, 13, -8)));
  }
  if (ghost) ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Rosto (expressões) — só na vista de frente
// ---------------------------------------------------------------------------

export function paintFace(ctx: Ctx, look: Look, expr: FaceExpr): void {
  const sp = look.species;
  if (sp === 'skeleton') return paintSkullFace(ctx, look, expr);
  if (sp === 'robot') return paintRobotFace(ctx, look, expr);
  const skin = look.skin;
  const ink = darken(shadow(skin, 0.7), 0.55);
  const eyeC = look.eyes.color;
  const style = look.eyes.style;
  const closed = expr === 'blink' || expr === 'happy' || style === 'closed';
  const squint = expr === 'hurt';
  const shout = expr === 'shout';

  // bochecha / sardas / pintura
  if (look.face?.blush || expr === 'happy') flat(ctx, alpha('#ff6f91', 0.32), (p) => (p.ellipse(10, -6.5, 2.6, 1.3, 0, 0, Math.PI * 2), p.ellipse(-0.5, -6.5, 1.6, 1.1, 0, 0, Math.PI * 2)));
  if (look.face?.freckles) for (let i = 0; i < 5; i++) flat(ctx, alpha(darken(skin, 0.4), 0.6), (p) => p.arc(7 + (i % 3) * 1.6, -8 + Math.floor(i / 3) * 1.2, 0.3, 0, Math.PI * 2));
  if (look.face?.paint) {
    detail(ctx, look.face.paint, 1.2, (p) => (p.moveTo(9, -10), p.lineTo(9.6, -5.5)));
    detail(ctx, look.face.paint, 1.2, (p) => (p.moveTo(11, -10), p.lineTo(11.6, -6)));
  }
  if (look.face?.scar) detail(ctx, alpha(mix(skin, '#8a2d3c', 0.6), 0.9), 0.7, (p) => (p.moveTo(6.5, -18), p.lineTo(10.5, -8.5)));
  if (look.face?.bandaid) {
    const b = roundRect(9, -9, 5, 2.4, 1);
    volume(ctx, b, '#f2c7a0', { shade: 0.5, shadeAmt: 0.2, line: 0.4 });
  }
  if (look.face?.tattoo) {
    ctx.save();
    ctx.font = '700 2.6px sans-serif';
    ctx.fillStyle = alpha(look.face.tattoo === '₹' ? '#ffd23f' : '#1a1020', 0.8);
    ctx.fillText(look.face.tattoo, 10.5, -3.2);
    ctx.restore();
  }

  // olhos
  const eyes: Array<[number, number, number]> = style === 'cyclops' ? [[6, -12.5, 1.5]] : [
    [8.6, -12, 1],
    [1.8, -12, 0.78],
  ];
  for (const [ex, ey, sc] of eyes) {
    ctx.save();
    ctx.translate(ex, ey);
    ctx.scale(sc, 1);
    if (closed) {
      detail(ctx, ink, 1, (p) => (expr === 'happy' ? (p.moveTo(-2.4, 0.6), p.quadraticCurveTo(0, -2, 2.4, 0.6)) : (p.moveTo(-2.4, 0), p.quadraticCurveTo(0, 1.2, 2.4, 0))));
    } else if (squint) {
      detail(ctx, ink, 0.9, (p) => (p.moveTo(-2.2, -1.4), p.lineTo(1.6, 0), p.lineTo(-2.2, 1.2)));
    } else if (style === 'glow' || style === 'hollow') {
      flat(ctx, alpha(eyeC, 0.35), (p) => p.ellipse(0, 0, 3.4, 3, 0, 0, Math.PI * 2));
      flat(ctx, style === 'hollow' ? '#120a1c' : eyeC, (p) => p.ellipse(0, 0, 2.2, 2.6, 0, 0, Math.PI * 2));
      if (style === 'hollow') flat(ctx, eyeC, (p) => p.arc(0.3, 0, 0.9, 0, Math.PI * 2));
      flat(ctx, '#ffffff', (p) => p.arc(-0.6, -0.9, 0.5, 0, Math.PI * 2));
    } else {
      const big = style === 'round' || style === 'wide';
      const h = big ? 3.4 : 2.6;
      const w = big ? 2.5 : 2.4;
      const white = ellipse(0, 0, w, h);
      flat(ctx, style === 'wide' ? '#ffffff' : '#fbf8ff', (p) => p.addPath(white));
      // íris
      const ir = style === 'wide' ? 1 : big ? 2 : 1.75;
      const irisY = style === 'sleepy' || style === 'lazy' ? 0.6 : 0.2;
      flat(ctx, eyeC, (p) => p.ellipse(0.5, irisY, ir, ir * 1.15, 0, 0, Math.PI * 2));
      flat(ctx, darken(eyeC, 0.6), (p) => p.ellipse(0.6, irisY, ir * 0.5, ir * 0.62, 0, 0, Math.PI * 2));
      if (sp === 'feline' || sp === 'lizard') flat(ctx, '#0b0610', (p) => p.ellipse(0.6, irisY, 0.35, ir, 0, 0, Math.PI * 2));
      flat(ctx, '#ffffff', (p) => (p.arc(-0.3, irisY - 0.9, 0.6, 0, Math.PI * 2), p.arc(1.2, irisY + 0.8, 0.3, 0, Math.PI * 2)));
      // pálpebra de cima (grossa, estilo anime)
      const lidDrop = style === 'sleepy' || expr === 'smug' ? 1.2 : style === 'lazy' ? 0.9 : style === 'sharp' || expr === 'focus' ? 0.6 : 0;
      ctx.save();
      ctx.clip(white);
      if (lidDrop > 0) flat(ctx, shadow(skin, 0.1), (p) => p.rect(-4, -h - 1, 8, lidDrop + 1.2));
      ctx.restore();
      detail(ctx, ink, style === 'sharp' ? 1.3 : 1.1, (p) => {
        const y = -h + lidDrop;
        p.moveTo(-w - 0.6, y + (style === 'sharp' ? 0.8 : 0.4));
        p.quadraticCurveTo(0, y - 0.8, w + 0.8, y + (style === 'sharp' ? -0.2 : 0.3));
      });
      detail(ctx, alpha(ink, 0.5), 0.5, (p) => (p.moveTo(-w + 0.4, h - 0.3), p.quadraticCurveTo(0, h + 0.4, w - 0.2, h - 0.4)));
    }
    ctx.restore();
  }

  // sobrancelhas
  const brows = look.brows ?? 'flat';
  if (brows !== 'none') {
    const ang = shout || brows === 'angry' || expr === 'focus' ? 1 : brows === 'sad' || expr === 'sad' ? -1 : brows === 'raised' ? -0.4 : 0;
    const bc = look.hair.style === 'none' || look.species === 'demon' ? darken(skin, 0.5) : darken(look.hair.color, 0.15);
    detail(ctx, bc, 1.3, (p) => (p.moveTo(6.2, -16.6 - ang * 0.8), p.lineTo(11, -16.4 + ang * 0.9)));
    detail(ctx, bc, 1.1, (p) => (p.moveTo(0, -16.2 + ang * 0.6), p.lineTo(3.4, -16.6 - ang * 0.6)));
  }

  // nariz
  if (sp === 'feline') {
    flat(ctx, '#ff8fb0', (p) => (p.moveTo(11.2, -9), p.lineTo(13, -9), p.lineTo(12.1, -7.8), p.closePath()));
    for (const dy of [-1, 0.5]) detail(ctx, alpha('#ffffff', 0.8), 0.35, (p) => (p.moveTo(12, -7.5 + dy), p.lineTo(17, -8.5 + dy * 1.6)));
  } else if (sp === 'lizard') {
    flat(ctx, darken(skin, 0.5), (p) => (p.arc(15, -10, 0.5, 0, Math.PI * 2), p.arc(13.6, -10.2, 0.4, 0, Math.PI * 2)));
  } else if (sp !== 'alien' && sp !== 'ghost') {
    detail(ctx, alpha(darken(skin, 0.45), 0.8), 0.7, (p) => (p.moveTo(12, -11), p.quadraticCurveTo(13.4, -8.6, 11.8, -8.2)));
  }

  // boca
  const mouth = look.mouth ?? 'neutral';
  const mx = 7.6;
  const my = -4.6;
  if (shout) {
    const m = blob([mx - 2.8, my - 0.8, mx + 2.6, my - 1, mx + 2.2, my + 2.2, mx - 1.4, my + 2.6], 0.6);
    flat(ctx, '#3a0d1e', (p) => p.addPath(m));
    flat(ctx, '#ff6f8a', (p) => p.ellipse(mx, my + 1.6, 1.6, 0.9, 0, 0, Math.PI * 2));
    flat(ctx, '#ffffff', (p) => p.rect(mx - 2, my - 0.8, 4, 0.8));
  } else if (expr === 'hurt' || expr === 'sad' || mouth === 'frown') {
    detail(ctx, ink, 0.9, (p) => (p.moveTo(mx - 2.4, my + 1), p.quadraticCurveTo(mx, my - 0.8, mx + 2.2, my + 1)));
  } else if (expr === 'happy' || mouth === 'open') {
    const m = blob([mx - 2.6, my - 0.6, mx + 2.8, my - 0.8, mx, my + 2.4], 0.5);
    flat(ctx, '#3a0d1e', (p) => p.addPath(m));
    flat(ctx, '#ff7a93', (p) => p.ellipse(mx + 0.2, my + 1.1, 1.3, 0.6, 0, 0, Math.PI * 2));
  } else if (mouth === 'teeth') {
    const m = roundRect(mx - 2.8, my - 1, 5.6, 2.4, 1);
    flat(ctx, '#ffffff', (p) => p.addPath(m));
    detail(ctx, ink, 0.5, (p) => (p.moveTo(mx - 2.8, my + 0.2), p.lineTo(mx + 2.8, my + 0.2)));
    detail(ctx, ink, 0.7, (p) => p.addPath(m));
  } else if (mouth === 'fangs') {
    detail(ctx, ink, 0.9, (p) => (p.moveTo(mx - 2.4, my), p.lineTo(mx + 2.4, my - 0.4)));
    flat(ctx, '#ffffff', (p) => (p.moveTo(mx - 1.4, my - 0.1), p.lineTo(mx - 0.6, my - 0.2), p.lineTo(mx - 1, my + 1.6), p.closePath(), p.moveTo(mx + 1, my - 0.3), p.lineTo(mx + 1.8, my - 0.4), p.lineTo(mx + 1.4, my + 1.4), p.closePath()));
  } else if (mouth === 'stitch') {
    detail(ctx, ink, 0.8, (p) => (p.moveTo(mx - 3, my), p.lineTo(mx + 3, my - 0.3)));
    for (let x = -2; x <= 2; x += 1.3) detail(ctx, ink, 0.5, (p) => (p.moveTo(mx + x, my - 1), p.lineTo(mx + x, my + 0.9)));
  } else if (mouth === 'smirk' || expr === 'smug') {
    detail(ctx, ink, 0.9, (p) => (p.moveTo(mx - 2, my + 0.4), p.quadraticCurveTo(mx + 0.6, my + 1.2, mx + 2.6, my - 0.8)));
  } else {
    detail(ctx, ink, 0.9, (p) => (p.moveTo(mx - 1.8, my + 0.2), p.lineTo(mx + 1.8, my)));
  }
}

function paintSkullFace(ctx: Ctx, look: Look, expr: FaceExpr): void {
  const eyeC = look.eyes.color;
  const socket = '#1a0f22';
  const closed = expr === 'blink';
  for (const [x, s] of [
    [8.4, 1],
    [1.6, 0.78],
  ] as const) {
    ctx.save();
    ctx.translate(x, -13);
    ctx.scale(s, 1);
    flat(ctx, socket, (p) => p.addPath(blob([-3, -2.8, 3, -3.4, 3.4, 1.5, 0, 3.2, -3.2, 1.6], 0.6)));
    if (!closed) {
      flat(ctx, alpha(eyeC, 0.35), (p) => p.arc(0.4, 0, 2.2, 0, Math.PI * 2));
      flat(ctx, expr === 'hurt' ? '#ffffff' : eyeC, (p) => p.arc(0.4, 0, expr === 'shout' ? 1.5 : 1.05, 0, Math.PI * 2));
    } else detail(ctx, eyeC, 0.6, (p) => (p.moveTo(-1.6, 0), p.lineTo(2, 0)));
    ctx.restore();
  }
  // nariz
  flat(ctx, socket, (p) => (p.moveTo(12, -9.6), p.lineTo(10.6, -6.8), p.lineTo(12.8, -7), p.closePath()));
  // dentes / mandíbula
  const open = expr === 'shout' || expr === 'happy' ? 2.6 : expr === 'hurt' ? 1.2 : 0;
  if (open > 0) flat(ctx, socket, (p) => p.rect(2.5, -4.6, 9.5, open + 0.6));
  const jaw = poly([1.5, -4.6 + open, 13, -5 + open, 11.5, 0 + open, 2.5, 0.6 + open], 1.4);
  volume(ctx, jaw, '#e9dfc9', { shade: 1, shadeAmt: 0.28, hiAmt: 0.2, line: 0.7 });
  for (let x = 3; x < 12; x += 1.7) {
    detail(ctx, alpha('#5e4f3a', 0.9), 0.4, (p) => (p.moveTo(x, -4.6 + open), p.lineTo(x, -2.6 + open)));
    detail(ctx, alpha('#5e4f3a', 0.9), 0.4, (p) => (p.moveTo(x, -6.6), p.lineTo(x, -4.6)));
  }
  detail(ctx, alpha('#5e4f3a', 0.9), 0.5, (p) => (p.moveTo(2.2, -6.6), p.lineTo(12.8, -6.8)));
  // rachadura
  detail(ctx, alpha('#5e4f3a', 0.8), 0.5, (p) => (p.moveTo(-2, -27), p.lineTo(0, -23), p.lineTo(-1.5, -21), p.lineTo(0.5, -18)));
}

function paintRobotFace(ctx: Ctx, look: Look, expr: FaceExpr): void {
  const visor = roundRect(-1.5, -18.5, 16, 10, 3.4);
  volume(ctx, visor, '#151a26', { shade: 1, shadeAmt: 0.2, hi: 0.8, hiAmt: 0.25, line: 0.7, lineColor: '#0a0d14' });
  const c = look.eyes.color;
  ctx.save();
  ctx.clip(visor);
  flat(ctx, alpha(c, 0.12), (p) => p.rect(-2, -19, 17, 11));
  const glow = (draw: (p: Path2D) => void) => {
    detail(ctx, alpha(c, 0.35), 2.4, draw);
    detail(ctx, c, 1, draw);
  };
  if (expr === 'blink') glow((p) => (p.moveTo(2, -13.5), p.lineTo(5, -13.5), p.moveTo(8, -13.5), p.lineTo(12, -13.5)));
  else if (expr === 'happy') glow((p) => (p.moveTo(2, -12.5), p.lineTo(3.6, -15), p.lineTo(5.2, -12.5), p.moveTo(8, -12.5), p.lineTo(10, -15), p.lineTo(12, -12.5)));
  else if (expr === 'shout' || expr === 'focus') glow((p) => (p.moveTo(2, -15.5), p.lineTo(5.4, -13.5), p.moveTo(12, -15.5), p.lineTo(8.4, -13.5)));
  else if (expr === 'hurt') glow((p) => (p.moveTo(2, -15), p.lineTo(5, -12), p.moveTo(5, -15), p.lineTo(2, -12), p.moveTo(9, -15), p.lineTo(12, -12), p.moveTo(12, -15), p.lineTo(9, -12)));
  else {
    flat(ctx, alpha(c, 0.4), (p) => (p.ellipse(3.6, -13.5, 2.6, 2.6, 0, 0, Math.PI * 2), p.ellipse(10, -13.5, 2.6, 2.6, 0, 0, Math.PI * 2)));
    flat(ctx, c, (p) => (p.ellipse(3.6, -13.5, 1.4, 1.8, 0, 0, Math.PI * 2), p.ellipse(10, -13.5, 1.4, 1.8, 0, 0, Math.PI * 2)));
  }
  flat(ctx, alpha('#ffffff', 0.18), (p) => (p.moveTo(-1, -18), p.lineTo(5, -18), p.lineTo(1, -9), p.lineTo(-1, -9), p.closePath()));
  ctx.restore();
  // grade da boca
  for (let i = 0; i < 4; i++) detail(ctx, '#5b6476', 0.7, (p) => (p.moveTo(5 + i * 2, -6), p.lineTo(5 + i * 2, -3.6)));
}

// ---------------------------------------------------------------------------
// Cabelo
// ---------------------------------------------------------------------------

function hairVolume(ctx: Ctx, p: Path2D, c: string): void {
  volume(ctx, p, c, { shade: 2.2, shadeAmt: 0.36, hi: 1.2, hiAmt: 0.3, line: 0.8 });
}

/** Mecha brilhante (luz no cabelo estilo anime). */
function hairShine(ctx: Ctx, c: string, x: number, y: number, w: number): void {
  detail(ctx, alpha(lighten(c, 0.7), 0.45), 1.1, (p) => (p.moveTo(x, y), p.quadraticCurveTo(x + w / 2, y - 1.4, x + w, y)));
}

/** Camada de trás do cabelo (atrás da cabeça). */
export function paintHairBack(ctx: Ctx, look: Look, view: View): void {
  const h = look.hair;
  const c = h.color;
  if (look.top.style === 'hoodie' && look.top.hood === 'up') {
    const hood = blob([-17, -10, -18, -26, -8, -37, 6, -37, 16, -29, 18, -16, 15, -2, 4, 3, -10, 2], 0.5);
    volume(ctx, hood, shadow(look.top.color, 0.08), { shade: 2.4, shadeAmt: 0.34, hi: 1.2, hiAmt: 0.2, line: 0.8 });
    return;
  }
  switch (h.style) {
    case 'messy':
    case 'spiky': {
      const spikes =
        h.style === 'spiky'
          ? [-14, -6, -19, -14, -14, -16, -21, -25, -12, -26, -15, -37, -5, -31, 0, -42, 4, -32, 12, -39, 11, -28, 18, -28, 14, -18, 4, -14, -8, -10]
          : [-13.5, -4, -18, -10, -14, -14, -19.5, -20, -13, -23, -16, -31, -7, -29.5, -5, -36.5, 1, -31.5, 6.5, -36, 8.5, -30, 15, -32, 13, -24, 16.5, -20, 12, -16, 2, -12, -8, -8];
      hairVolume(ctx, poly(spikes, 1.2), c);
      break;
    }
    case 'curly':
    case 'afro': {
      const big = h.style === 'afro';
      const p = new Path2D();
      const R = big ? 4.6 : 3.9;
      const cx = 0;
      const cy = big ? -20 : -17;
      const rx = big ? 18 : 14.5;
      const ry = big ? 18 : 14;
      for (let i = 0; i < 22; i++) {
        const a = Math.PI * 0.55 + (i / 22) * Math.PI * 1.9;
        p.moveTo(cx + Math.cos(a) * rx + R, cy + Math.sin(a) * ry);
        p.arc(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, R + (i % 3) * 0.4, 0, Math.PI * 2);
      }
      p.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      hairVolume(ctx, p, c);
      break;
    }
    case 'long':
    case 'locs': {
      const p = blob([-14, -16, -11, -27, 0, -31, 11, -27, 14, -16, 12, 2, 9, 14, -2, 16, -12, 14, -16, 2], 0.5);
      hairVolume(ctx, p, c);
      if (h.style === 'locs') for (let x = -12; x <= 10; x += 3) detail(ctx, alpha(darken(c, 0.5), 0.8), 0.7, (pp) => (pp.moveTo(x, -10), pp.lineTo(x + 0.6, 14)));
      break;
    }
    case 'bob': {
      hairVolume(ctx, blob([-15, -12, -12, -27, 1, -31, 12, -27, 15, -14, 14, -2, 4, -3, -12, -1], 0.5), c);
      break;
    }
    case 'ponytail': {
      hairVolume(ctx, blob([-13, -18, -10, -28, 2, -31, 12, -26, 13, -16, -2, -14], 0.5), c);
      hairVolume(ctx, blob([-12, -24, -19, -20, -21, -6, -17, 6, -15, -6, -12, -16], 0.5), c);
      break;
    }
    case 'twintails': {
      hairVolume(ctx, blob([-13, -18, -10, -28, 2, -31, 12, -26, 13, -16, -2, -14], 0.5), c);
      hairVolume(ctx, blob([-12, -24, -20, -22, -22, -4, -18, 8, -15, -6], 0.5), h.color2 ?? c);
      break;
    }
    case 'bun': {
      hairVolume(ctx, blob([-13, -16, -10, -28, 2, -31, 12, -26, 13, -16, -2, -14], 0.5), c);
      hairVolume(ctx, ellipse(-5, -31, 6, 5.4), c);
      break;
    }
    case 'mohawk': {
      hairVolume(ctx, blob([-12, -24, -6, -40, 2, -42, 9, -36, 6, -26, -4, -22], 0.4), c);
      break;
    }
    case 'undercut': {
      hairVolume(ctx, blob([-12, -20, -10, -29, 2, -33, 13, -29, 15, -22, 4, -22], 0.5), c);
      break;
    }
    case 'buzz':
    case 'none':
    default:
      break;
  }
  void view;
}

/** Camada da frente do cabelo (franja por cima do rosto). */
export function paintHairFront(ctx: Ctx, look: Look, view: View): void {
  const h = look.hair;
  const c = h.color;
  const hoodUp = look.top.style === 'hoodie' && look.top.hood === 'up';
  if (view === 'back') {
    // nuca: cabelo cobrindo a parte de trás da cabeça
    if (h.style === 'none' || hoodUp) return;
    const cap = h.style === 'buzz' ? blob([-13, -14, -11, -26, 1, -29.5, 12, -25, 14, -14, 7, -6, -5, -5], 0.5) : blob([-14.5, -10, -12, -27, 1, -31, 13, -26, 15, -12, 8, -4, -6, -3], 0.5);
    hairVolume(ctx, cap, h.style === 'buzz' ? mix(c, look.skin, 0.35) : c);
    hairShine(ctx, c, -6, -24, 9);
    return;
  }
  switch (h.style) {
    case 'messy': {
      // franja bagunçada caindo por cima de um olho (ref. 1)
      const p = poly([-6, -22, -3, -29, 8, -30, 16.5, -24.5, 15.5, -16, 13, -20, 11.5, -10.5, 9.4, -18.5, 6.2, -12.5, 4.6, -19.5, 1.6, -15.5, 0.6, -21.5, -2.6, -18, -4.2, -20.6], 0.9);
      hairVolume(ctx, p, c);
      hairShine(ctx, c, 2, -26, 9);
      break;
    }
    case 'spiky': {
      const p = poly([-6, -24, -2, -30, 10, -31, 17, -26, 17, -18, 13.5, -21, 12, -15, 9, -21, 5, -17, 3, -22, -1, -19], 0.8);
      hairVolume(ctx, p, c);
      hairShine(ctx, c, 1, -27, 10);
      break;
    }
    case 'curly':
    case 'afro': {
      const p = new Path2D();
      const pts = h.style === 'afro' ? [-6, -30, -1, -33, 5, -33, 10, -30, 14, -25] : [-5, -26, 0, -28.5, 5, -28.6, 10, -26.4, 13.4, -22.4];
      for (let i = 0; i < pts.length; i += 2) {
        p.moveTo(pts[i]! + 4, pts[i + 1]!);
        p.arc(pts[i]!, pts[i + 1]!, h.style === 'afro' ? 4.6 : 3.6, 0, Math.PI * 2);
      }
      hairVolume(ctx, p, c);
      for (let i = 0; i < pts.length; i += 2) detail(ctx, alpha(darken(c, 0.5), 0.6), 0.5, (pp) => pp.arc(pts[i]!, pts[i + 1]!, 1.6, 0.4, 2.6));
      hairShine(ctx, c, 0, -29, 8);
      break;
    }
    case 'long':
    case 'bob':
    case 'locs': {
      const p = poly([-8, -22, -4, -30, 9, -30, 16, -24, 15, -14, 11.5, -19, 6, -21, 1, -20, -3, -16, -6, -10], 1.2);
      hairVolume(ctx, p, c);
      hairShine(ctx, c, 0, -27, 11);
      break;
    }
    case 'ponytail':
    case 'twintails':
    case 'bun': {
      const p = poly([-7, -22, -3, -30, 9, -30.5, 15.5, -25, 14.5, -19, 9, -22, 3, -22.5, -2, -19], 1.2);
      hairVolume(ctx, p, c);
      hairShine(ctx, c, 1, -27.5, 10);
      break;
    }
    case 'mohawk': {
      const p = poly([0, -27, 4, -37, 9, -38, 13, -33, 12, -25], 1);
      hairVolume(ctx, p, c);
      for (let i = 0; i < 6; i++) flat(ctx, alpha(darken(c, 0.2), 0.6), (pp) => pp.arc(-6 + i * 1.6, -21 + (i % 2), 0.4, 0, Math.PI * 2));
      break;
    }
    case 'undercut': {
      const p = poly([-4, -26, 2, -32, 12, -31, 19, -25, 16, -20, 10, -24, 3, -23], 1.2);
      hairVolume(ctx, p, c);
      hairShine(ctx, c, 3, -29, 10);
      break;
    }
    case 'buzz': {
      const p = blob([-10, -22, -6, -28, 4, -30, 12, -26, 14, -21, 8, -24, 0, -24], 0.5);
      hairVolume(ctx, p, mix(c, look.skin, 0.3));
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Acessórios da cabeça (óculos, máscara, chapéu...)
// ---------------------------------------------------------------------------

export function paintHeadAcc(ctx: Ctx, look: Look, view: View): void {
  const a = look.acc ?? {};
  const hoodUp = look.top.style === 'hoodie' && look.top.hood === 'up';
  if (view === 'front') {
    if (a.mask) paintMask(ctx, look, a.mask);
    if (a.glasses) paintGlasses(ctx, a.glasses);
    if (a.earbuds && look.species !== 'skeleton') {
      volume(ctx, roundRect(-8.4, -13.4, 2.8, 3.4, 1.3), '#f7f7fb', { shade: 0.5, shadeAmt: 0.25, hiAmt: 0.4, line: 0.5 });
      flat(ctx, '#f7f7fb', (p) => p.rect(-7.6, -10.4, 1.2, 2.6));
    }
  }
  if (hoodUp) {
    // borda do capuz emoldurando o rosto
    const c = look.top.color;
    const rim = new Path2D();
    rim.moveTo(-14, 0);
    rim.bezierCurveTo(-17, -20, -8, -34, 6, -33);
    rim.bezierCurveTo(14, -32, 18, -24, 17, -14);
    rim.lineTo(14.5, -15);
    rim.bezierCurveTo(14, -24, 9, -29.5, 3, -29.4);
    rim.bezierCurveTo(-6, -29, -11, -18, -10, -2);
    rim.closePath();
    if (view === 'front') volume(ctx, rim, c, { shade: 1.4, shadeAmt: 0.3, hi: 1, hiAmt: 0.22, line: 0.8 });
    else {
      const back = blob([-16, -8, -17, -26, -6, -36, 8, -35, 16, -26, 16, -8, 2, 0], 0.5);
      volume(ctx, back, c, { shade: 2, shadeAmt: 0.32, hi: 1.2, hiAmt: 0.2, line: 0.8 });
      detail(ctx, alpha(darken(c, 0.5), 0.6), 0.7, (p) => (p.moveTo(0, -34), p.quadraticCurveTo(-2, -18, 0, -4)));
    }
  }
  if (a.headphones) {
    const hc = a.headphones;
    detail(ctx, darken(hc, 0.25), 2.4, (p) => (p.moveTo(-6, -12), p.bezierCurveTo(-10, -34, 12, -38, 13, -24)));
    volume(ctx, ellipse(-5.5, -12, 4, 5), hc, { shade: 1, shadeAmt: 0.3, hiAmt: 0.35, line: 0.7 });
    flat(ctx, alpha('#ffffff', 0.35), (p) => p.ellipse(-6.4, -13.6, 1.4, 1.8, 0, 0, Math.PI * 2));
  }
  if (!a.hat || hoodUp) return;
  const hc = a.hatColor ?? '#1d1b26';
  switch (a.hat) {
    case 'cap_back':
    case 'cap': {
      const dome = blob([-13, -20, -11, -30, 1, -34, 12, -30, 15, -22, 1, -24], 0.5);
      volume(ctx, dome, hc, { shade: 1.8, shadeAmt: 0.32, hi: 1, hiAmt: 0.25, line: 0.8 });
      const brim = a.hat === 'cap' ? poly([10, -23, 23, -21, 22, -18.5, 11, -20], 1.4) : poly([-12, -23, -22, -18, -21, -15.5, -12, -19.5], 1.4);
      volume(ctx, brim, shadow(hc, 0.1), { shade: 0.8, shadeAmt: 0.3, line: 0.7 });
      if (a.hat === 'cap_back') {
        flat(ctx, lighten(hc, 0.5), (p) => p.rect(-1, -28, 6, 1));
        flat(ctx, alpha('#000000', 0.3), (p) => p.ellipse(-4, -23, 4, 1.4, 0, 0, Math.PI * 2));
      }
      flat(ctx, lighten(hc, 0.6), (p) => p.arc(1, -33.4, 0.9, 0, Math.PI * 2));
      break;
    }
    case 'beanie': {
      const b = blob([-14, -18, -12, -31, 1, -36, 13, -31, 16, -20, 1, -21], 0.5);
      volume(ctx, b, hc, { shade: 1.8, shadeAmt: 0.32, hiAmt: 0.2, line: 0.8 });
      const fold = poly([-14.5, -23, 16.2, -24, 16.4, -18.4, -14, -17.4], 2);
      volume(ctx, fold, shadow(hc, 0.1), { shade: 0.8, shadeAmt: 0.25, line: 0.7 });
      for (let x = -12; x < 16; x += 1.6) detail(ctx, alpha(darken(hc, 0.5), 0.5), 0.4, (p) => (p.moveTo(x, -23), p.lineTo(x, -18)));
      break;
    }
    case 'bucket': {
      const top = blob([-11, -22, -9, -32, 2, -34, 12, -31, 14, -22], 0.5);
      volume(ctx, top, hc, { shade: 1.6, shadeAmt: 0.3, hiAmt: 0.2, line: 0.8 });
      const brim = blob([-18, -18, -13, -24, 2, -25, 17, -24, 21, -17, 2, -19], 0.5);
      volume(ctx, brim, shadow(hc, 0.06), { shade: 1, shadeAmt: 0.3, line: 0.8 });
      break;
    }
    case 'crown': {
      const cr = poly([-9, -27, -10, -38, -5, -32, 0, -40, 5, -32, 10, -38, 9, -27], 0.6);
      volume(ctx, cr, a.hatColor ?? '#ffd23f', { shade: 1, shadeAmt: 0.35, hi: 0.7, hiAmt: 0.6, line: 0.7 });
      flat(ctx, '#ff3d6e', (p) => p.arc(0, -31, 1.4, 0, Math.PI * 2));
      flat(ctx, '#3df2ff', (p) => (p.arc(-6, -30, 1, 0, Math.PI * 2), p.arc(6, -30, 1, 0, Math.PI * 2)));
      break;
    }
    case 'halo': {
      detail(ctx, alpha(a.hatColor ?? '#fff1a8', 0.4), 3.2, (p) => p.ellipse(1, -38, 10, 2.8, 0, 0, Math.PI * 2));
      detail(ctx, a.hatColor ?? '#fff1a8', 1.3, (p) => p.ellipse(1, -38, 10, 2.8, 0, 0, Math.PI * 2));
      break;
    }
    case 'horns': {
      const hcol = a.hatColor ?? '#2a1d22';
      volume(ctx, poly([-7, -25, -2, -27, -9, -40, -14, -36], 2), hcol, { shade: 1, shadeAmt: 0.35, hiAmt: 0.3, line: 0.7 });
      volume(ctx, poly([6, -27, 11, -25, 15, -38, 9, -40], 2), lighten(hcol, 0.1), { shade: 1, shadeAmt: 0.35, hiAmt: 0.3, line: 0.7 });
      break;
    }
    case 'antenna': {
      detail(ctx, a.hatColor ?? '#9ef08a', 0.9, (p) => (p.moveTo(-3, -28), p.quadraticCurveTo(-7, -36, -9, -40), p.moveTo(6, -29), p.quadraticCurveTo(9, -37, 12, -41)));
      flat(ctx, alpha(a.hatColor ?? '#9ef08a', 0.4), (p) => (p.arc(-9, -40, 2.8, 0, Math.PI * 2), p.arc(12, -41, 2.8, 0, Math.PI * 2)));
      flat(ctx, a.hatColor ?? '#9ef08a', (p) => (p.arc(-9, -40, 1.6, 0, Math.PI * 2), p.arc(12, -41, 1.6, 0, Math.PI * 2)));
      break;
    }
    case 'cat_ears':
    case 'hood_ears': {
      const ec = a.hat === 'cat_ears' ? look.hair.color : (a.hatColor ?? look.top.color);
      volume(ctx, poly([-11, -22, -12, -36, -3, -28], 1.2), ec, { shade: 1, shadeAmt: 0.3, hiAmt: 0.2, line: 0.7 });
      volume(ctx, poly([5, -29, 13, -37, 13, -24], 1.2), ec, { shade: 1, shadeAmt: 0.3, hiAmt: 0.2, line: 0.7 });
      flat(ctx, '#ff9db8', (p) => (p.moveTo(-10, -25), p.lineTo(-10.6, -32.5), p.lineTo(-5, -28), p.closePath(), p.moveTo(7, -29), p.lineTo(12, -34), p.lineTo(12, -26), p.closePath()));
      break;
    }
  }
}

function paintGlasses(ctx: Ctx, kind: NonNullable<NonNullable<Look['acc']>['glasses']>): void {
  if (kind === 'visor') {
    const v = poly([-1, -16, 16.5, -16.5, 16, -10.5, -0.5, -10], 1.6);
    volume(ctx, v, '#25d6ff', { shade: 0.8, shadeAmt: 0.35, hi: 0.6, hiAmt: 0.6, line: 0.8, lineColor: '#0b3442' });
    flat(ctx, alpha('#ffffff', 0.5), (p) => p.rect(1, -15, 10, 1));
    return;
  }
  if (kind === 'goggles') {
    detail(ctx, '#3a2a1c', 1.6, (p) => (p.moveTo(-12, -21), p.quadraticCurveTo(2, -25, 15, -22)));
    for (const x of [3, 10]) {
      volume(ctx, ellipse(x, -22.5, 3.4, 2.8), '#f0a64a', { shade: 0.6, shadeAmt: 0.3, hi: 0.6, hiAmt: 0.6, line: 0.8, lineColor: '#3a2a1c' });
    }
    return;
  }
  const dark = kind === 'shades';
  const frame = dark ? '#111018' : '#c9ccd6';
  const lens = (cx: number, w: number) => (kind === 'round' ? ellipse(cx, -12.2, w / 2, 3) : roundRect(cx - w / 2, -14.8, w, 5.4, kind === 'shades' ? 1.4 : 0.8));
  for (const [cx, w] of [
    [8.6, 6.6],
    [1.4, 4.2],
  ] as const) {
    const l = lens(cx, w);
    if (dark) {
      flat(ctx, '#151320', (p) => p.addPath(l));
      flat(ctx, alpha('#9b8cff', 0.4), (p) => (p.moveTo(cx - w / 2 + 0.6, -14), p.lineTo(cx - w / 2 + 2.4, -14), p.lineTo(cx - w / 2 + 1, -10.4), p.closePath()));
    } else flat(ctx, alpha('#cfe8ff', 0.18), (p) => p.addPath(l));
    detail(ctx, frame, 0.75, (p) => p.addPath(l));
  }
  detail(ctx, frame, 0.7, (p) => (p.moveTo(3.5, -12.6), p.lineTo(5.3, -12.6), p.moveTo(12, -12.6), p.lineTo(13.4, -12)));
  detail(ctx, frame, 0.7, (p) => (p.moveTo(-0.7, -12.6), p.lineTo(-4.5, -12)));
}

function paintMask(ctx: Ctx, look: Look, kind: NonNullable<NonNullable<Look['acc']>['mask']>): void {
  const base = kind === 'skull' ? '#1c1a22' : kind === 'gas' ? '#3b4250' : kind === 'oni' ? '#c72b3b' : kind === 'bandana' ? (look.acc?.hatColor ?? '#b3122e') : '#1f1d27';
  const m = kind === 'oni' ? blob([-1, -18, 15, -19, 16, -6, 9, 1, 0, -3], 0.5) : blob([-1.5, -9.5, 8, -10.5, 14.6, -9, 13.5, -3, 8, 1, 1, 0, -2, -4], 0.5);
  volume(ctx, m, base, { shade: 1.2, shadeAmt: 0.3, hi: 0.8, hiAmt: 0.22, line: 0.8 });
  ctx.save();
  ctx.clip(m);
  if (kind === 'skull') {
    for (let x = 1; x < 14; x += 1.7) detail(ctx, '#e9e2d0', 0.9, (p) => (p.moveTo(x, -5.5), p.lineTo(x, -2)));
    detail(ctx, '#e9e2d0', 0.6, (p) => (p.moveTo(0, -5.6), p.lineTo(14, -5.6)));
  } else if (kind === 'gas') {
    volume(ctx, ellipse(10, -4, 3.4, 3.4), '#596274', { shade: 0.6, shadeAmt: 0.3, line: 0.6 });
    for (let i = 0; i < 3; i++) detail(ctx, '#2b313d', 0.5, (p) => p.arc(10, -4, 0.8 + i * 0.9, 0, Math.PI * 2));
  } else if (kind === 'oni') {
    flat(ctx, '#ffffff', (p) => (p.moveTo(4, -3), p.lineTo(6, 1), p.lineTo(8, -3), p.moveTo(9, -3), p.lineTo(11, 0.5), p.lineTo(12.5, -3)));
    flat(ctx, '#1a0f14', (p) => (p.ellipse(9, -13, 2.4, 1.6, 0, 0, Math.PI * 2), p.ellipse(2, -13, 1.8, 1.4, 0, 0, Math.PI * 2)));
  } else {
    detail(ctx, alpha(darken(base, 0.5), 0.6), 0.5, (p) => (p.moveTo(0, -6), p.quadraticCurveTo(7, -4, 14, -6.4)));
  }
  ctx.restore();
  if (kind !== 'oni') detail(ctx, darken(base, 0.4), 0.8, (p) => (p.moveTo(-2, -7), p.lineTo(-5.5, -11)));
  void light;
}
