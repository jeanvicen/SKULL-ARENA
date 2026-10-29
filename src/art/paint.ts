import { INK, light, shadow, darken, alpha } from './color';

/**
 * PINTURA COM VOLUME (2.5D)
 * Cada peça é um Path2D pintado em 4 camadas:
 *   1. cor base
 *   2. faixa de sombra (lado oposto à luz, que vem de cima-esquerda)
 *   3. faixa de luz (borda de cima-esquerda)
 *   4. gradiente suave + linha interna fina
 * O CONTORNO GROSSO de fora não é desenhado aqui: ele é gerado depois, em volta da
 * silhueta inteira do personagem (ver sprite.ts), igual desenho de FNF.
 */

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface VolumeOpts {
  /** deslocamento da sombra (unidades do rig) */
  shade?: number;
  /** força da sombra 0..1 */
  shadeAmt?: number;
  /** deslocamento da luz */
  hi?: number;
  /** força da luz 0..1 (0 = sem luz) */
  hiAmt?: number;
  /** espessura da linha interna (0 = sem) */
  line?: number;
  lineColor?: string;
  /** gradiente vertical sutil */
  grad?: boolean;
  /** direção da sombra (padrão: pra baixo-direita) */
  dir?: [number, number];
}

const BIG = 1e4;

export function volume(ctx: Ctx, path: Path2D, base: string, o: VolumeOpts = {}): void {
  const shade = o.shade ?? 3;
  const shadeAmt = o.shadeAmt ?? 0.34;
  const hi = o.hi ?? 1.6;
  const hiAmt = o.hiAmt ?? 0.28;
  const [dx, dy] = o.dir ?? [0.75, 0.66];
  ctx.fillStyle = base;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  if (o.grad !== false) {
    const g = ctx.createLinearGradient(0, -40, 0, 40);
    g.addColorStop(0, 'rgba(255,255,255,0.07)');
    g.addColorStop(1, 'rgba(20,0,40,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(-BIG, -BIG, 2 * BIG, 2 * BIG);
  }
  if (shadeAmt > 0) {
    const p = new Path2D();
    p.rect(-BIG, -BIG, 2 * BIG, 2 * BIG);
    p.addPath(path, new DOMMatrix().translate(-dx * shade, -dy * shade));
    ctx.fillStyle = shadow(base, shadeAmt);
    ctx.fill(p, 'evenodd');
  }
  if (hiAmt > 0) {
    const p = new Path2D();
    p.rect(-BIG, -BIG, 2 * BIG, 2 * BIG);
    p.addPath(path, new DOMMatrix().translate(dx * hi, dy * hi));
    ctx.fillStyle = alpha(light(base, 0.55), hiAmt);
    ctx.fill(p, 'evenodd');
  }
  ctx.restore();
  const line = o.line ?? 0.9;
  if (line > 0) {
    ctx.lineWidth = line;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = o.lineColor ?? darken(shadow(base, 0.5), 0.35);
    ctx.stroke(path);
  }
}

/** Linha de detalhe (dobra de roupa, costura...). */
export function detail(ctx: Ctx, color: string, width: number, draw: (p: Path2D) => void, dash?: number[]): void {
  const p = new Path2D();
  draw(p);
  ctx.save();
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  if (dash) ctx.setLineDash(dash);
  ctx.stroke(p);
  ctx.restore();
}

/** Preenchimento simples (sem volume). */
export function flat(ctx: Ctx, color: string, draw: (p: Path2D) => void): void {
  const p = new Path2D();
  draw(p);
  ctx.fillStyle = color;
  ctx.fill(p);
}

/** Path de "cápsula" afunilada: segmento de (0,y0) até (0,y1) com larguras w0 e w1. */
export function taper(y0: number, y1: number, w0: number, w1: number, round = true): Path2D {
  const p = new Path2D();
  const h0 = w0 / 2;
  const h1 = w1 / 2;
  p.moveTo(-h0, y0);
  p.lineTo(-h1, y1);
  if (round) p.arc(0, y1, h1, Math.PI, 0, true);
  else p.lineTo(h1, y1);
  p.lineTo(h0, y0);
  if (round) p.arc(0, y0, h0, 0, Math.PI, true);
  p.closePath();
  return p;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, rot = 0): Path2D {
  const p = new Path2D();
  p.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  return p;
}

export function roundRect(x: number, y: number, w: number, h: number, r: number | number[]): Path2D {
  const p = new Path2D();
  p.roundRect(x, y, w, h, r);
  return p;
}

/** Polígono a partir de lista de pontos [x0,y0,x1,y1,...] com cantos arredondados opcionais. */
export function poly(pts: number[], radius = 0): Path2D {
  const p = new Path2D();
  const n = pts.length / 2;
  if (radius <= 0) {
    p.moveTo(pts[0]!, pts[1]!);
    for (let i = 1; i < n; i++) p.lineTo(pts[i * 2]!, pts[i * 2 + 1]!);
    p.closePath();
    return p;
  }
  const px = (i: number) => pts[((i + n) % n) * 2]!;
  const py = (i: number) => pts[((i + n) % n) * 2 + 1]!;
  p.moveTo((px(-1) + px(0)) / 2, (py(-1) + py(0)) / 2);
  for (let i = 0; i < n; i++) p.arcTo(px(i), py(i), (px(i) + px(i + 1)) / 2, (py(i) + py(i + 1)) / 2, radius);
  p.closePath();
  return p;
}

/** Curva suave fechada passando pelos pontos (Catmull-Rom → Bézier). */
export function blob(pts: number[], tension = 0.5): Path2D {
  const p = new Path2D();
  const n = pts.length / 2;
  const X = (i: number) => pts[((i + n) % n) * 2]!;
  const Y = (i: number) => pts[((i + n) % n) * 2 + 1]!;
  p.moveTo(X(0), Y(0));
  for (let i = 0; i < n; i++) {
    const c1x = X(i) + ((X(i + 1) - X(i - 1)) * tension) / 3;
    const c1y = Y(i) + ((Y(i + 1) - Y(i - 1)) * tension) / 3;
    const c2x = X(i + 1) - ((X(i + 2) - X(i)) * tension) / 3;
    const c2y = Y(i + 1) - ((Y(i + 2) - Y(i)) * tension) / 3;
    p.bezierCurveTo(c1x, c1y, c2x, c2y, X(i + 1), Y(i + 1));
  }
  p.closePath();
  return p;
}

export { INK };
