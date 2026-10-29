import type { Look } from '../content/types';
import { INK } from './color';
import type { Ctx } from './paint';
import { type BoneName, type FaceExpr, type HandShape, type Mat, type Pose, mul, ident } from './rig';
import { paintBackItem, paintForearm, paintHand, paintHoodCollar, paintShin, paintShoe, paintThigh, paintTorso, paintUpperArm, type View } from './parts/body';
import { paintFace, paintHairBack, paintHairFront, paintHead, paintHeadAcc } from './parts/head';
import { paintWeapon } from './parts/weapons';

/**
 * SPRITE DO PERSONAGEM
 * ---------------------
 * Pré-renderiza cada peça (com sombreado) num canvas próprio + a versão "contorno"
 * (silhueta dilatada na cor de tinta). Na hora de desenhar:
 *   passo 1: todos os contornos  → vira UM contorno contínuo em volta do corpo todo
 *   passo 2: todas as peças por cima, na ordem de profundidade
 * Resultado: visual de desenho animado com volume, sem "costuras" nas juntas.
 */

type Canvas = HTMLCanvasElement | OffscreenCanvas;

interface Raster {
  fill: Canvas;
  line: Canvas | null;
  white: Canvas | null;
  /** canto superior esquerdo em unidades do rig */
  ox: number;
  oy: number;
}

interface PartSpec {
  key: string;
  bone: BoneName;
  bounds: [number, number, number, number];
  outline: boolean;
  paint: (ctx: Ctx) => void;
}

/** espessura do contorno em unidades do rig */
const OUTLINE = 1.9;
/** cabeça um pouco maior que o "real" (estilo anime/FNF, lê melhor de longe) */
export const HEAD_SCALE = 1.14;

function scaled(paint: (c: Ctx) => void, k: number): (c: Ctx) => void {
  return (c) => {
    c.save();
    c.scale(k, k);
    paint(c);
    c.restore();
  };
}

export function makeCanvas(w: number, h: number): Canvas {
  w = Math.max(1, Math.ceil(w));
  h = Math.max(1, Math.ceil(h));
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function ctx2d(c: Canvas): Ctx {
  return c.getContext('2d') as Ctx;
}

/** Silhueta dilatada (contorno) na cor `color`, raio `r` px. */
function dilate(src: Canvas, r: number, color: string): Canvas {
  const out = makeCanvas(src.width, src.height);
  const g = ctx2d(out);
  // máscara colorida
  const mask = makeCanvas(src.width, src.height);
  const mg = ctx2d(mask);
  mg.drawImage(src as CanvasImageSource, 0, 0);
  mg.globalCompositeOperation = 'source-in';
  mg.fillStyle = color;
  mg.fillRect(0, 0, mask.width, mask.height);
  const n = Math.max(10, Math.ceil((Math.PI * 2 * r) / 2.2));
  for (const rr of r > 3 ? [r, r * 0.55] : [r]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.drawImage(mask as CanvasImageSource, Math.cos(a) * rr, Math.sin(a) * rr);
    }
  }
  g.drawImage(mask as CanvasImageSource, 0, 0);
  return out;
}

function whiteOf(src: Canvas): Canvas {
  const out = makeCanvas(src.width, src.height);
  const g = ctx2d(out);
  g.drawImage(src as CanvasImageSource, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, out.width, out.height);
  return out;
}

/** Recorta bordas transparentes (economiza memória e desenho). */
function trim(c: Canvas, pad: number): { canvas: Canvas; dx: number; dy: number } {
  const g = ctx2d(c);
  const { width: w, height: h } = c;
  const data = g.getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      if (data[row + x * 4 + 3]! > 2) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { canvas: makeCanvas(1, 1), dx: 0, dy: 0 };
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  const out = makeCanvas(x1 - x0 + 1, y1 - y0 + 1);
  ctx2d(out).drawImage(c as CanvasImageSource, -x0, -y0);
  return { canvas: out, dx: x0, dy: y0 };
}

export interface DrawOpts {
  /** transformação base (câmera × posição × escala × lado) */
  base: Mat;
  view: View;
  /** 0..1 flash branco de dano */
  flash?: number;
  alpha?: number;
  /** contorno colorido (ex.: time) — padrão tinta escura */
  hideWeapon?: boolean;
}

const tmpA: Mat = ident();
const tmpB: Mat = ident();

export class CharacterSprite {
  private readonly raster = new Map<string, Raster>();
  private readonly specsFront: PartSpec[];
  private readonly specsBack: PartSpec[];

  constructor(
    readonly look: Look,
    /** pixels por unidade do rig */
    readonly ppu: number,
  ) {
    this.specsFront = this.buildSpecs('front');
    this.specsBack = this.buildSpecs('back');
  }

  private buildSpecs(view: View): PartSpec[] {
    const L = this.look;
    const dual = L.weapon.kind === 'dual_pistols';
    const hasWeapon = L.weapon.kind !== 'none' && L.weapon.kind !== 'gloves';
    const S = (key: string, bone: BoneName, bounds: PartSpec['bounds'], paint: (c: Ctx) => void, outline = true): PartSpec =>
      bone === 'head'
        ? { key: `${view}:${key}`, bone, bounds: bounds.map((v) => v * HEAD_SCALE) as PartSpec['bounds'], outline, paint: scaled(paint, HEAD_SCALE) }
        : { key: `${view}:${key}`, bone, bounds, outline, paint };
    const backItem = S('backItem', 'torso', [-34, -46, 34, 10], (c) => paintBackItem(c, L, view));
    const armB = [
      S('uArmB', 'uArmB', [-10, -5, 10, 18], (c) => paintUpperArm(c, L, false)),
      S('fArmB', 'fArmB', [-11, -4, 11, 17], (c) => paintForearm(c, L, false)),
      ...(dual ? [S('weaponB', 'handB', [-34, -22, 36, 42], (c) => paintWeapon(c, L, true))] : []),
      S('handB', 'handB', [-10, -5, 12, 20], () => {}),
    ];
    const armF = [
      S('uArmF', 'uArmF', [-10, -5, 10, 18], (c) => paintUpperArm(c, L, true)),
      S('fArmF', 'fArmF', [-11, -4, 11, 17], (c) => paintForearm(c, L, true)),
      ...(hasWeapon ? [S('weapon', 'handF', [-34, -22, 36, 42], (c) => paintWeapon(c, L))] : []),
      S('handF', 'handF', [-10, -5, 12, 20], () => {}),
    ];
    const legB = [
      S('thighB', 'thighB', [-15, -8, 15, 26], (c) => paintThigh(c, L, false)),
      S('footB', 'footB', [-14, -14, 25, 10], (c) => paintShoe(c, L, false)),
      S('shinB', 'shinB', [-15, -5, 15, 28], (c) => paintShin(c, L, false)),
    ];
    const legF = [
      S('thighF', 'thighF', [-15, -8, 15, 26], (c) => paintThigh(c, L, true)),
      S('footF', 'footF', [-14, -14, 25, 10], (c) => paintShoe(c, L, true)),
      S('shinF', 'shinF', [-15, -5, 15, 28], (c) => paintShin(c, L, true)),
    ];
    const torso = S('torso', 'torso', [-28, -42, 28, 26], (c) => paintTorso(c, L, view));
    const collar = S('collar', 'torso', [-16, -40, 16, -20], (c) => paintHoodCollar(c, L, view));
    const head = S('head', 'head', [-22, -38, 24, 10], (c) => paintHead(c, L, view));
    const hairBack = S('hairBack', 'head', [-28, -50, 26, 24], (c) => paintHairBack(c, L, view));
    const hairFront = S('hairFront', 'head', [-20, -48, 26, -2], (c) => paintHairFront(c, L, view));
    const headAcc = S('headAcc', 'head', [-28, -50, 30, 8], (c) => paintHeadAcc(c, L, view));
    if (view === 'front') {
      return [backItem, hairBack, ...armB, ...legB, ...legF, torso, collar, head, S('face', 'head', [-8, -26, 22, 6], () => {}, false), hairFront, headAcc, ...armF];
    }
    return [...armF, ...armB, ...legB, ...legF, torso, collar, head, hairBack, hairFront, headAcc, backItem];
  }

  private rasterize(spec: PartSpec, paint: (c: Ctx) => void, outline: boolean): Raster {
    const ppu = this.ppu;
    const pad = OUTLINE + 1;
    const [x0, y0, x1, y1] = spec.bounds;
    const w = (x1 - x0 + pad * 2) * ppu;
    const h = (y1 - y0 + pad * 2) * ppu;
    const c = makeCanvas(w, h);
    const g = ctx2d(c);
    g.setTransform(ppu, 0, 0, ppu, (-x0 + pad) * ppu, (-y0 + pad) * ppu);
    paint(g);
    const padPx = Math.ceil(OUTLINE * ppu) + 2;
    const t = trim(c, padPx);
    const ox = x0 - pad + t.dx / ppu;
    const oy = y0 - pad + t.dy / ppu;
    const line = outline ? dilate(t.canvas, OUTLINE * ppu, INK) : null;
    return { fill: t.canvas, line, white: null, ox, oy };
  }

  private get(spec: PartSpec, pose: Pose): Raster {
    let key = spec.key;
    let paint = spec.paint;
    const L = this.look;
    if (spec.key.endsWith(':face')) {
      const expr: FaceExpr = pose.face;
      key = `${spec.key}:${expr}`;
      paint = scaled((c) => paintFace(c, L, expr), HEAD_SCALE);
    } else if (spec.key.endsWith(':handF') || spec.key.endsWith(':handB')) {
      const front = spec.key.endsWith('F');
      let shape: HandShape = front ? pose.shapeF : pose.shapeB;
      const holds = front ? L.weapon.kind !== 'none' && L.weapon.kind !== 'gloves' : L.weapon.kind === 'dual_pistols';
      if (holds && shape !== 'fist') shape = 'fist';
      key = `${spec.key}:${shape}`;
      paint = (c) => paintHand(c, L, front, shape);
    }
    let r = this.raster.get(key);
    if (!r) {
      r = this.rasterize(spec, paint, spec.outline);
      this.raster.set(key, r);
    }
    return r;
  }

  /** Pré-aquece as peças mais usadas (evita engasgo no 1º frame). */
  warm(pose: Pose): void {
    for (const s of this.specsFront) this.get(s, pose);
    for (const s of this.specsBack) this.get(s, pose);
  }

  draw(ctx: CanvasRenderingContext2D, pose: Pose, solved: Record<BoneName, Mat>, o: DrawOpts): void {
    const specs = o.view === 'front' ? this.specsFront : this.specsBack;
    const inv = 1 / this.ppu;
    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = prevAlpha * (o.alpha ?? 1);
    for (let pass = 0; pass < 2; pass++) {
      for (const s of specs) {
        if (o.hideWeapon && (s.key.endsWith('weapon') || s.key.endsWith('weaponB'))) continue;
        const r = this.get(s, pose);
        const img = pass === 0 ? r.line : r.fill;
        if (!img) continue;
        mul(o.base, solved[s.bone], tmpA);
        tmpB[0] = inv;
        tmpB[1] = 0;
        tmpB[2] = 0;
        tmpB[3] = inv;
        tmpB[4] = r.ox;
        tmpB[5] = r.oy;
        mul(tmpA, tmpB, tmpA);
        ctx.setTransform(tmpA[0], tmpA[1], tmpA[2], tmpA[3], tmpA[4], tmpA[5]);
        ctx.drawImage(img as CanvasImageSource, 0, 0);
      }
    }
    if (o.flash && o.flash > 0.01) {
      ctx.globalAlpha = prevAlpha * Math.min(1, o.flash) * (o.alpha ?? 1);
      for (const s of specs) {
        const r = this.get(s, pose);
        if (!r.white) r.white = whiteOf(r.line ?? r.fill);
        mul(o.base, solved[s.bone], tmpA);
        tmpB[0] = inv;
        tmpB[1] = 0;
        tmpB[2] = 0;
        tmpB[3] = inv;
        tmpB[4] = r.ox;
        tmpB[5] = r.oy;
        mul(tmpA, tmpB, tmpA);
        ctx.setTransform(tmpA[0], tmpA[1], tmpA[2], tmpA[3], tmpA[4], tmpA[5]);
        ctx.drawImage(r.white as CanvasImageSource, 0, 0);
      }
    }
    ctx.globalAlpha = prevAlpha;
  }

  /** Libera a memória das peças. */
  dispose(): void {
    this.raster.clear();
  }
}

export type { View };
