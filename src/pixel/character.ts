import type { Look, TopStyle, WeaponKind } from '../content/types';
import { mix } from '../art/color';
import type { BoneName, FaceExpr, HandShape, Mat, Pose } from '../art/rig';
import { PixelBuffer, outline, rgba, setGroups, shade } from './buffer';
import { DARK, EYE_WHITE, INK, WHITE, ramp } from './palette';

/**
 * PERSONAGEM EM PIXEL ART 16-BIT (gerado a partir do `look`)
 * -----------------------------------------------------------
 * O esqueleto (art/rig.ts) e as animações (art/anims.ts) dizem ONDE fica cada osso.
 * Este arquivo desenha cada peça como formas de pixel (sem anti-aliasing), depois:
 * sombreia (luz de cima-esquerda), coloca linhas internas e o contorno de 1 pixel.
 *
 * Quadro: 72×84 pixels, pés no ponto (36, 76). Altura do personagem ≈ 54 px.
 * Pra usar um desenho SEU (Piskel/Aseprite) em vez do gerado, veja pixel/sheet.ts.
 */

export const PPU = 0.5; // pixels por unidade do rig
export const FRAME_W = 72;
export const FRAME_H = 84;
export const ORIGIN_X = 36;
export const ORIGIN_Y = 76;
export const HEAD_SCALE = 1.14;

type View = 'front' | 'back';

class Painter {
  readonly buf: PixelBuffer;
  readonly ramps: number[][] = [];
  readonly groups: number[] = [];
  readonly form = new Set<number>();
  readonly noInner = new Set<number>();
  private m: Mat = [1, 0, 0, 1, 0, 0];
  private s = 1;

  constructor(buf: PixelBuffer) {
    this.buf = buf;
  }

  /** nova peça (z sobe a cada chamada); retorna o id */
  part(color: string, group = -1, form = false): number {
    const id = this.ramps.length;
    this.ramps.push(ramp(color));
    this.groups.push(group);
    if (form) this.form.add(id);
    return id;
  }

  base(id: number): number {
    return this.ramps[id]![2]!;
  }

  bone(m: Mat, scale = 1): void {
    this.m = m;
    this.s = scale;
  }

  T(x: number, y: number): [number, number] {
    const m = this.m;
    x *= this.s;
    y *= this.s;
    return [(m[0] * x + m[2] * y + m[4]) * PPU + ORIGIN_X, (m[1] * x + m[3] * y + m[5]) * PPU + ORIGIN_Y];
  }

  /** escala atual em px por unidade local (pra raios) */
  get k(): number {
    return Math.hypot(this.m[0], this.m[1]) * this.s * PPU;
  }

  poly(pts: number[], id: number): void {
    const out: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      const [x, y] = this.T(pts[i]!, pts[i + 1]!);
      out.push(x, y);
    }
    this.buf.fillPoly(out, this.base(id), id);
  }

  ell(cx: number, cy: number, rx: number, ry: number, id: number, n = 20): void {
    const pts: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    }
    this.poly(pts, id);
  }

  cap(x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, id: number): void {
    const [ax, ay] = this.T(x0, y0);
    const [bx, by] = this.T(x1, y1);
    this.buf.capsule(ax, ay, bx, by, (w0 / 2) * this.k, (w1 / 2) * this.k, this.base(id), id);
  }

  /** linha de detalhe (só pinta em cima da peça `mask`) */
  line(x0: number, y0: number, x1: number, y1: number, c: number, mask: number): void {
    const [ax, ay] = this.T(x0, y0);
    const [bx, by] = this.T(x1, y1);
    this.buf.line(ax, ay, bx, by, c, -2, mask);
  }

  dot(x: number, y: number, c: number, mask: number): void {
    const [ax, ay] = this.T(x, y);
    this.buf.set(Math.floor(ax), Math.floor(ay), c, -2, mask);
  }

  /** pixel em coordenada de TELA relativa a um ponto local (pra rostos que não giram) */
  at(x: number, y: number): [number, number] {
    const [ax, ay] = this.T(x, y);
    return [Math.floor(ax), Math.floor(ay)];
  }
}

// ---------------------------------------------------------------------------
// Medidas do corpo
// ---------------------------------------------------------------------------

function torsoHalfWidth(look: Look): number {
  const base = { slim: 11.5, normal: 13, broad: 15, heavy: 16.5 }[look.body];
  const over = ['hoodie', 'oversized_tee', 'puffer', 'varsity', 'trench', 'robe', 'kimono'].includes(look.top.style) ? 2 : 0;
  return base + over + (look.top.style === 'puffer' ? 1.5 : 0);
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
    default:
      return 4;
  }
}

function skinOf(look: Look): string {
  if (look.species === 'skeleton') return '#efe6d2';
  if (look.species === 'robot') return '#a3aec0';
  return look.skin;
}

function sleeve(style: TopStyle): 'long' | 'short' | 'none' | 'wide' {
  if (style === 'oversized_tee' || style === 'ribbed_tee') return 'short';
  if (style === 'tank' || style === 'vest') return 'none';
  if (style === 'kimono' || style === 'robe') return 'wide';
  return 'long';
}

function pantsWidths(look: Look): [number, number, number] {
  const b = { slim: 0, normal: 0.6, broad: 1.2, heavy: 2.2 }[look.body];
  switch (look.pants.style) {
    case 'baggy':
      return [14.5 + b, 15.5 + b, 18.5 + b];
    case 'cargo':
      return [14 + b, 15 + b, 17.5 + b];
    case 'wide_jeans':
      return [13.5 + b, 14.5 + b, 17.5 + b];
    case 'hakama':
      return [16 + b, 18 + b, 21 + b];
    case 'skirt':
      return [9 + b, 8 + b, 7 + b];
    case 'track':
      return [12.5 + b, 11 + b, 10.5 + b];
    case 'shorts':
      return [14 + b, 15 + b, 7 + b];
  }
}

// ---------------------------------------------------------------------------
// RENDER
// ---------------------------------------------------------------------------

export interface RenderOpts {
  view: View;
  /** some com a arma (ex.: personagem no pódio) */
  hideWeapon?: boolean;
}

const shared = new PixelBuffer(FRAME_W, FRAME_H);

/** Desenha um quadro do personagem no buffer (compartilhado) e devolve. */
export function renderCharacter(look: Look, pose: Pose, solved: Record<BoneName, Mat>, o: RenderOpts): PixelBuffer {
  const buf = shared;
  buf.clear();
  const P = new Painter(buf);
  const front = o.view === 'front';
  const sk = skinOf(look);
  const top = look.top;
  const c2 = top.color2 ?? mix(top.color, '#000000', 0.3);
  const sleeveC = top.style === 'varsity' ? c2 : top.color;
  const sl = sleeve(top.style);
  const pantsC = look.pants.color;
  const weaponHidden = o.hideWeapon || look.weapon.kind === 'none';

  // grupos (sem linha interna entre peças do mesmo material)
  const G = { pantsB: 1, pantsF: 2, armB: 3, armF: 4, head: 5, hair: 6, shoeB: 7, shoeF: 8 };

  const S = solved;
  const ids: Record<string, number> = {};
  const drawBack = () => {
    if (!look.acc || (!look.acc.wings && !look.acc.backpack && !look.acc.tail)) return;
    P.bone(S.torso);
    const a = look.acc;
    if (a.wings) {
      const wc = a.wings === 'angel' ? '#f6f3ff' : a.wings === 'bone' ? '#efe6d2' : a.wings === 'void' ? '#3a1a6a' : '#2b1838';
      const id = P.part(wc);
      // asa pontuda com "penas" (aparece atrás dos ombros)
      for (const s of [-1, 1]) P.poly([s * 4, -22, s * 12, -40, s * 20, -46, s * 24, -42, s * 22, -34, s * 26, -30, s * 21, -25, s * 23, -20, s * 16, -17, s * 8, -15], id);
      ids.wings = id;
    }
    if (a.backpack) {
      const id = P.part(a.backpack);
      if (front) P.poly([-17, -26, -8, -26, -8, -7, -17, -7], id);
      else P.poly([-9, -26, 9, -26, 10, -6, -10, -6], id);
      ids.pack = id;
    }
    if (a.tail) {
      P.bone(S.hips);
      const id = P.part(look.species === 'demon' ? sk : look.hair.color);
      P.poly([-6, -2, -14, 0, -21, -6, -26, -13, -24, -15, -18, -9, -12, -4, -5, 2], id);
    }
  };
  const drawHairBack = () => {
    P.bone(S.head, HEAD_SCALE);
    const hoodUp = top.style === 'hoodie' && top.hood === 'up';
    if (hoodUp) {
      ids.hood = P.part(mix(top.color, '#1d1245', 0.08), -1, true);
      P.poly([-17, -10, -18, -26, -8, -37, 6, -37, 16, -29, 18, -16, 15, -2, 4, 3, -10, 2], ids.hood);
      return;
    }
    const h = look.hair;
    if (h.style === 'none' || h.style === 'buzz' || h.style === 'undercut' || h.style === 'mohawk') return;
    const id = P.part(h.color, G.hair, true);
    ids.hairB = id;
    switch (h.style) {
      case 'messy':
        P.poly([-13.5, -4, -18, -10, -14, -14, -19.5, -20, -13, -23, -16, -31, -7, -29.5, -5, -36.5, 1, -31.5, 6.5, -36, 8.5, -30, 15, -32, 13, -24, 16.5, -20, 12, -16, 2, -12, -8, -8], id);
        break;
      case 'spiky':
        P.poly([-14, -6, -19, -14, -14, -16, -21, -25, -12, -26, -15, -37, -5, -31, 0, -42, 4, -32, 12, -39, 11, -28, 18, -28, 14, -18, 4, -14, -8, -10], id);
        break;
      case 'curly':
      case 'afro': {
        const big = h.style === 'afro';
        const cy = big ? -20 : -17;
        const rx = big ? 18 : 14.5;
        const ry = big ? 18 : 14;
        P.ell(0, cy, rx, ry, id);
        for (let i = 0; i < 14; i++) {
          const a = Math.PI * 0.6 + (i / 14) * Math.PI * 1.8;
          P.ell(Math.cos(a) * rx, cy + Math.sin(a) * ry, big ? 5 : 4.2, big ? 5 : 4.2, id, 10);
        }
        break;
      }
      case 'long':
      case 'locs':
        P.poly([-14, -16, -11, -27, 0, -31, 11, -27, 14, -16, 12, 2, 9, 14, -2, 16, -12, 14, -16, 2], id);
        break;
      case 'bob':
        P.poly([-15, -12, -12, -27, 1, -31, 12, -27, 15, -14, 14, -2, 4, -3, -12, -1], id);
        break;
      case 'ponytail':
        P.poly([-13, -18, -10, -28, 2, -31, 12, -26, 13, -16, -2, -14], id);
        P.poly([-12, -24, -19, -20, -21, -6, -17, 6, -15, -6, -12, -16], id);
        break;
      case 'twintails':
        P.poly([-13, -18, -10, -28, 2, -31, 12, -26, 13, -16, -2, -14], id);
        P.poly([-12, -24, -20, -22, -22, -4, -18, 8, -15, -6], id);
        break;
      case 'bun':
        P.poly([-13, -16, -10, -28, 2, -31, 12, -26, 13, -16, -2, -14], id);
        P.ell(-5, -31, 6, 5.4, id);
        break;
    }
  };
  const drawArm = (side: 'F' | 'B') => {
    const isF = side === 'F';
    const g = isF ? G.armF : G.armB;
    const sleeveCol = isF ? sleeveC : mix(sleeveC, '#1d1245', 0.12);
    const skinCol = isF ? sk : mix(sk, '#1d1245', 0.12);
    // braço
    P.bone(S[`uArm${side}`]);
    const puffy = top.style === 'puffer';
    if (sl === 'none' || sl === 'short') {
      const id = P.part(skinCol, g);
      if (look.species === 'skeleton') P.cap(0, 0, 0, 14, 3.4, 3.2, id);
      else P.cap(0, -0.5, 0, 14, 6.6, 6, id);
      if (sl === 'short') {
        const s2 = P.part(sleeveCol, g);
        P.poly([-6.8, -3, 6.6, -3, 7.4, 9.5, -7, 10], s2);
        ids[`sleeve${side}`] = s2;
      }
    } else {
      const w0 = puffy ? 13 : sl === 'wide' ? 12.5 : 11;
      const w1 = puffy ? 12.5 : sl === 'wide' ? 14 : 10;
      const id = P.part(sleeveCol, g);
      P.cap(0, -1, 0, 13.5, w0, w1, id);
      ids[`uarm${side}`] = id;
    }
    // antebraço
    P.bone(S[`fArm${side}`]);
    if (sl === 'none' || sl === 'short') {
      const id = P.part(skinCol, g);
      if (look.species === 'skeleton') P.cap(0, 0, 0, 12.5, 3, 2.8, id);
      else P.cap(0, -0.5, 0, 12.5, 6, 5.4, id);
      ids[`farm${side}`] = id;
      if (isF && look.acc?.watch) ids.watch = id;
    } else {
      const w0 = puffy ? 12.5 : sl === 'wide' ? 14 : 10;
      const w1 = puffy ? 11.5 : sl === 'wide' ? 16 : 9;
      const id = P.part(sleeveCol, g);
      P.cap(0, -1, 0, 11, w0, w1, id);
      ids[`farm${side}`] = id;
      if (sl === 'long') {
        const cuff = P.part(top.style === 'varsity' ? top.color : mix(sleeveCol, '#1d1245', 0.18), g);
        P.poly([-w1 / 2 + 0.4, 9.5, w1 / 2 - 0.4, 9.5, w1 / 2 - 0.6, 13.5, -w1 / 2 + 0.6, 13.5], cuff);
      }
    }
    // arma na mão
    const holds = isF ? !weaponHidden : look.weapon.kind === 'dual_pistols' && !weaponHidden;
    if (holds) {
      P.bone(S[`hand${side}`]);
      drawWeapon(P, look.weapon.kind, isF ? look.weapon.color : mix(look.weapon.color, '#1d1245', 0.15), look.weapon.color2 ?? mix(look.weapon.color, '#000000', 0.35), ids);
    }
    // mão
    P.bone(S[`hand${side}`]);
    const gloves = look.weapon.kind === 'gloves';
    const handC = gloves ? look.weapon.color : skinCol;
    const id = P.part(handC, g);
    const shape: HandShape = holds ? 'fist' : isF ? pose.shapeF : pose.shapeB;
    if (gloves) P.ell(0, 3.5, 5.6, 5.6, id, 14);
    else P.ell(0, 3, 3.8, 3.8, id, 12);
    if (!gloves && (shape === 'peace' || shape === 'point' || shape === 'open')) {
      const fingers = shape === 'peace' ? [-1.2, 1.4] : shape === 'point' ? [0.6] : [-2, 0, 2];
      for (const fx of fingers) P.cap(fx, 5, fx * 1.3, 10.5, 1.9, 1.7, id);
    }
  };
  const drawLeg = (side: 'F' | 'B') => {
    const isF = side === 'F';
    const g = isF ? G.pantsF : G.pantsB;
    const pc = isF ? pantsC : mix(pantsC, '#1d1245', 0.14);
    const [w0, w1, w2] = pantsWidths(look);
    const ps = look.pants.style;
    P.bone(S[`thigh${side}`]);
    let thigh: number;
    if (ps === 'skirt') {
      thigh = P.part(look.pants.color2 ?? '#222228', g);
      P.cap(0, -2, 0, 21, 8.5, 7.6, thigh);
    } else {
      thigh = P.part(pc, g, true);
      P.poly([-w0 / 2, -4, w0 / 2, -4, w1 / 2 + 0.4, 22.5, -w1 / 2 - 0.4, 22.5], thigh);
      if (ps === 'shorts') {
        const leg = P.part(isF ? sk : mix(sk, '#1d1245', 0.12), g);
        P.cap(0, 14, 0, 22, 6.8, 6.4, leg);
      }
    }
    ids[`thigh${side}`] = thigh;
    // tênis (antes da canela pra barra da calça ficar por cima)
    P.bone(S[`foot${side}`], 1);
    drawShoe(P, look, isF, ids, side);
    P.bone(S[`shin${side}`]);
    let shin: number;
    if (ps === 'shorts' || ps === 'skirt') {
      shin = P.part(ps === 'skirt' ? (look.pants.color2 ?? '#222228') : isF ? sk : mix(sk, '#1d1245', 0.12), g);
      P.cap(0, -1, 0, 19, 6.6, 5.6, shin);
      if (ps === 'shorts') {
        const sock = P.part('#f2f2f6', g);
        P.poly([-3.4, 12, 3.4, 12, 3.2, 19, -3.2, 19], sock);
      }
    } else {
      shin = P.part(pc, g, true);
      P.poly([-w1 / 2, -2, w1 / 2, -2, w2 / 2 + 0.6, 12, w2 / 2 + 0.4, 21, 0, 21.8, -w2 / 2 - 0.4, 21.2, -w2 / 2 - 0.6, 12], shin);
    }
    ids[`shin${side}`] = shin;
  };
  const drawTorso = () => {
    P.bone(S.torso);
    const hw = torsoHalfWidth(look);
    const hy = hemY(top.style);
    const id = P.part(top.color, -1, true);
    ids.torso = id;
    const s = top.style;
    const flare = s === 'trench' || s === 'robe' ? 3 : s === 'kimono' ? 1.5 : 0;
    if (s === 'tank') P.poly([-3.5, -29, -hw + 3, -27, -hw + 2, -20, -hw + 1.5, -8, -hw + 2, hy, hw - 2, hy, hw - 1, -8, hw, -18, hw - 2, -26, 4.5, -29], id);
    else if (s === 'puffer') P.poly([-4, -30, -hw + 1.5, -28, -hw, -21, -hw - 0.5, -10, -hw + 1, hy, 0, hy + 1.5, hw - 1, hy, hw + 0.5, -10, hw, -21, hw - 1.5, -28, 5, -30], id);
    else
      P.poly(
        [
          -4,
          -29.5,
          -hw + 2,
          -28,
          -hw,
          -24,
          -hw + 0.4,
          -12,
          -hw + 0.6 - flare,
          hy - 1.5,
          -hw + 2 - flare,
          hy,
          hw - 2 + flare,
          hy,
          hw - 0.4 + flare,
          hy - 1.5,
          hw + 0.4,
          -12,
          hw - 0.2,
          -24,
          hw - 2.4,
          -28,
          4.5,
          -29.5,
        ],
        id,
      );
    // gola / capuz caído
    if (s === 'hoodie' && top.hood !== 'up' && front) {
      ids.collar = P.part(mix(top.color, '#1d1245', 0.06), -1, true);
      P.poly([-10, -28, -7, -33, 0, -34.5, 7.5, -32.5, 9.5, -28, 3, -25.5, -4, -26], ids.collar);
    }
    if (s === 'hoodie' && top.hood !== 'up' && !front) {
      ids.collar = P.part(mix(top.color, '#1d1245', 0.06), -1, true);
      P.poly([-9, -29, 7, -29, 8, -22, 2, -15.5, -5, -16, -10, -22], ids.collar);
    }
    if (s === 'turtleneck_jacket' || s === 'puffer') {
      ids.collar = P.part(mix(top.color, '#1d1245', 0.04));
      P.poly([-6.5, -35, 7.5, -35, 8, -26.5, -7, -26.5], ids.collar);
    }
    if (look.acc?.backpack && front) {
      const strap = P.part(look.acc.backpack);
      P.poly([-7, -29, -4, -29, -5, -8, -8, -8], strap);
      P.poly([7, -29, 10, -28.5, 9.5, -8, 6.5, -8], strap);
      ids.strap = strap;
    }
  };
  const drawHead = () => {
    P.bone(S.head, HEAD_SCALE);
    const id = P.part(skinOf(look), G.head, true);
    ids.head = id;
    switch (look.species) {
      case 'skeleton':
        P.poly([1, -29, 11, -26, 15, -17, 14, -9, 10, -5, 2, -5, -7, -7, -13, -12, -14, -20, -9, -27], id);
        P.poly([1.5, -5.5, 13, -6, 11.5, 0.5, 2.5, 1], id);
        break;
      case 'robot':
        P.poly([-12.5, -21, -10, -28, 11, -28, 14.5, -22, 14.5, -5, 11, -2, -10, -2, -12.5, -6], id);
        break;
      case 'alien':
        P.poly([1, -33, 12, -27, 15, -17, 12, -7, 6, -0.5, 1, 0.5, -5, -3, -11, -9, -14, -18, -10, -29], id);
        break;
      case 'lizard':
        P.poly([0, -28, 10, -25, 17, -15, 17, -8, 9, -2.5, 2, 0.5, -6, -3, -11, -8, -13.5, -16, -10, -25], id);
        break;
      default:
        P.poly([1, -28, 7, -27, 11.5, -23.5, 14, -14, 13, -6.5, 8, -0.5, 3, 1, -5, -2, -11, -7, -13.5, -14, -12.5, -21, -7, -26.5], id);
    }
    // orelha
    if (front && look.species !== 'skeleton' && look.species !== 'robot') {
      const pointy = look.species === 'demon' || look.species === 'vampire' || look.species === 'alien';
      if (pointy) P.poly([-8.5, -16, -4.5, -15, -4.8, -8, -8, -9, -14, -21], id);
      else P.ell(-7.2, -11.8, 2.4, 3.3, id, 10);
    }
    if (front && look.species === 'robot') {
      const ear = P.part('#7f8aa0', G.head);
      P.poly([-9, -18, -4, -18, -4, -9, -9, -9], ear);
    }
  };
  const drawHairFront = () => {
    P.bone(S.head, HEAD_SCALE);
    const h = look.hair;
    const hoodUp = top.style === 'hoodie' && top.hood === 'up';
    const id = P.part(h.style === 'buzz' ? mix(h.color, skinOf(look), 0.35) : h.color, G.hair, true);
    ids.hairF = id;
    if (!front) {
      if (h.style !== 'none' && !hoodUp) P.poly([-14.5, -10, -12, -27, 1, -31, 13, -26, 15, -12, 8, -4, -6, -3], id);
    } else if (!hoodUp) {
      switch (h.style) {
        case 'messy':
          P.poly([-6, -22, -3, -29, 8, -30, 16.5, -24.5, 15.5, -16, 13, -20, 11.5, -10.5, 9.4, -18.5, 6.2, -12.5, 4.6, -19.5, 1.6, -15.5, 0.6, -21.5, -2.6, -18, -4.2, -20.6], id);
          break;
        case 'spiky':
          P.poly([-6, -24, -2, -30, 10, -31, 17, -26, 17, -18, 13.5, -21, 12, -15, 9, -21, 5, -17, 3, -22, -1, -19], id);
          break;
        case 'curly':
        case 'afro': {
          const pts = h.style === 'afro' ? [-6, -30, -1, -33, 5, -33, 10, -30, 14, -25] : [-5, -26, 0, -28.5, 5, -28.6, 10, -26.4, 13.4, -22.4];
          for (let i = 0; i < pts.length; i += 2) P.ell(pts[i]!, pts[i + 1]!, h.style === 'afro' ? 4.6 : 3.8, h.style === 'afro' ? 4.6 : 3.8, id, 10);
          break;
        }
        case 'long':
        case 'bob':
        case 'locs':
          P.poly([-8, -22, -4, -30, 9, -30, 16, -24, 15, -14, 11.5, -19, 6, -21, 1, -20, -3, -16, -6, -10], id);
          break;
        case 'ponytail':
        case 'twintails':
        case 'bun':
          P.poly([-7, -22, -3, -30, 9, -30.5, 15.5, -25, 14.5, -19, 9, -22, 3, -22.5, -2, -19], id);
          break;
        case 'mohawk':
          P.poly([-10, -24, -6, -37, 2, -40, 9, -37, 13, -31, 12, -25], id);
          break;
        case 'undercut':
          P.poly([-4, -26, 2, -32, 12, -31, 19, -25, 16, -20, 10, -24, 3, -23], id);
          break;
        case 'buzz':
          P.poly([-10, -22, -6, -28, 4, -30, 12, -26, 14, -21, 8, -24, 0, -24], id);
          break;
      }
    }
    // capuz levantado: borda em volta do rosto
    if (hoodUp) {
      const rim = P.part(top.color, -1, true);
      ids.hoodRim = rim;
      if (front) P.poly([-14, 0, -16.5, -14, -13, -26, -4, -33.5, 6, -33, 14, -29, 17.5, -21, 17, -14, 14.5, -15, 14, -23, 9, -29.5, 3, -29.4, -5, -27.5, -10, -19, -10, -2], rim);
      else P.poly([-16, -8, -17, -26, -6, -36, 8, -35, 16, -26, 16, -8, 2, 0], rim);
    }
  };
  const drawHeadAcc = () => {
    P.bone(S.head, HEAD_SCALE);
    const a = look.acc ?? {};
    const hoodUp = top.style === 'hoodie' && top.hood === 'up';
    if (a.mask && front) {
      const mc = a.mask === 'skull' ? '#1c1a22' : a.mask === 'gas' ? '#3b4250' : a.mask === 'oni' ? '#c72b3b' : a.mask === 'bandana' ? (a.hatColor ?? '#b3122e') : '#1f1d27';
      const id = P.part(mc);
      ids.mask = id;
      if (a.mask === 'oni') P.poly([-1, -18, 15, -19, 16, -6, 9, 1, 0, -3], id);
      else P.poly([-1.5, -9.5, 8, -10.5, 14.6, -9, 13.5, -3, 8, 1, 1, 0, -2, -4], id);
    }
    if (a.headphones) {
      const id = P.part(a.headphones);
      P.poly([-8, -12, -10, -24, -4, -33, 6, -35, 12, -30, 13, -24, 11, -24, 10, -29, 5, -32, -3, -30, -7, -23, -5.5, -12], id);
      P.ell(-6, -12, 4, 5, id, 12);
    }
    if (!a.hat || hoodUp) return;
    const hc = a.hatColor ?? '#1d1b26';
    const id = P.part(a.hat === 'crown' ? (a.hatColor ?? '#ffd23f') : hc);
    ids.hat = id;
    switch (a.hat) {
      case 'cap_back':
      case 'cap':
        P.poly([-13, -20, -11, -30, 1, -34, 12, -30, 15, -22, 1, -24], id);
        if (a.hat === 'cap') P.poly([10, -23, 23, -21, 22, -18.5, 11, -20], id);
        else P.poly([-12, -23, -22, -18, -21, -15.5, -12, -19.5], id);
        break;
      case 'beanie':
        P.poly([-14, -18, -12, -31, 1, -36, 13, -31, 16, -20, 1, -21], id);
        break;
      case 'bucket':
        P.poly([-11, -22, -9, -32, 2, -34, 12, -31, 14, -22], id);
        P.poly([-18, -18, -13, -24, 2, -25, 17, -24, 21, -17, 2, -19], id);
        break;
      case 'crown':
        P.poly([-9, -27, -10, -38, -5, -32, 0, -40, 5, -32, 10, -38, 9, -27], id);
        break;
      case 'halo': {
        const h2 = P.part('#fff1a8');
        for (let i = 0; i < 16; i++) {
          const ang = (i / 16) * Math.PI * 2;
          P.ell(1 + Math.cos(ang) * 10, -38 + Math.sin(ang) * 2.8, 1.2, 1.2, h2, 6);
        }
        break;
      }
      case 'horns':
        P.poly([-7, -25, -2, -27, -9, -40, -14, -36], id);
        P.poly([6, -27, 11, -25, 15, -38, 9, -40], id);
        break;
      case 'antenna':
        P.cap(-3, -28, -9, -40, 1.6, 1.4, id);
        P.cap(6, -29, 12, -41, 1.6, 1.4, id);
        P.ell(-9, -40, 2.4, 2.4, id, 8);
        P.ell(12, -41, 2.4, 2.4, id, 8);
        break;
      case 'cat_ears':
      case 'hood_ears':
        P.poly([-11, -22, -12, -36, -3, -28], id);
        P.poly([5, -29, 13, -37, 13, -24], id);
        break;
    }
  };

  // ---------------- ordem de pintura ----------------
  if (front) {
    drawBack();
    drawHairBack();
    drawArm('B');
    drawLeg('B');
    drawLeg('F');
    drawTorso();
    drawHead();
    drawHairFront();
    drawHeadAcc();
    drawArm('F');
  } else {
    drawArm('F');
    drawArm('B');
    drawLeg('B');
    drawLeg('F');
    drawTorso();
    drawHead();
    drawHairBack();
    drawHairFront();
    drawHeadAcc();
    drawBack();
  }

  // ---------------- sombreado + detalhes + contorno ----------------
  const groupArr = new Int16Array(P.groups.length);
  P.groups.forEach((g, i) => (groupArr[i] = g));
  setGroups(groupArr);
  shade(buf, P.ramps, { form: P.form });
  setGroups(null);
  details(P, look, pose, front, ids, S);
  outline(buf, INK);
  return buf;
}

// ---------------------------------------------------------------------------
// Tênis
// ---------------------------------------------------------------------------

function drawShoe(P: Painter, look: Look, front: boolean, ids: Record<string, number>, side: string): void {
  const sh = look.shoes;
  const g = side === 'F' ? 8 : 7;
  const c = front ? sh.color : mix(sh.color, '#1d1245', 0.12);
  const k = 1.3;
  const T = (pts: number[]) => pts.map((v, i) => (i % 2 === 0 ? v * k : (v - 4.6) * k + 4.6));
  if (sh.style === 'slides') {
    const sock = P.part('#f0f0f4', g);
    P.poly(T([-5, -4, 9, -4, 9, 2, -5, 2]), sock);
    const s = P.part(sh.sole ?? '#f4f2ec', g);
    P.poly(T([-6, 1.8, 12, 1.8, 12, 4.4, -6, 4.4]), s);
    const st = P.part(c, g);
    P.poly(T([-1, -2.5, 9, -2.5, 9, 2, -1, 2]), st);
    return;
  }
  const solH = sh.style === 'chunky' ? 4.6 : sh.style === 'boots' ? 3.4 : 3;
  const upperTop = sh.style === 'hightop' || sh.style === 'boots' ? -8 : -4.5;
  const up = P.part(c, g);
  P.poly(T([-6.6, 4.6 - solH, -6.8, upperTop + 1.5, -5, upperTop, -2, upperTop - 0.2, 3, upperTop + 0.6, 8, -2.4, 12, -0.4, 15, 1, 14.6, 4.6 - solH]), up);
  const sole = P.part(sh.sole ?? '#f4f2ec', g);
  P.poly(T([-7.6, 4.4 - solH, 13, 4.4 - solH, 15.6, 2, 14.6, 4.6, -6, 4.6, -8, 2.6]), sole);
  ids[`shoe${side}`] = up;
  ids[`sole${side}`] = sole;
}

// ---------------------------------------------------------------------------
// Armas (no espaço da mão; +y = pra onde aponta, +x = "em cima")
// ---------------------------------------------------------------------------

function drawWeapon(P: Painter, kind: WeaponKind, c: string, c2: string, ids: Record<string, number>): void {
  const metal = '#3a3f4d';
  const W = () => P.part(c);
  const W2 = () => P.part(c2);
  const M = () => P.part(metal);
  switch (kind) {
    case 'pistol':
    case 'dual_pistols': {
      const g = W2();
      P.poly([-2.4, 0.5, 2, 0.5, 2, 6, -2.4, 6], g);
      const b = W();
      P.poly([0.6, -2, 5.4, -2, 5.4, 14, 0.6, 14], b);
      ids.wpn = b;
      break;
    }
    case 'shotgun': {
      P.poly([-1.5, -12, 3, -12, 2.6, 2, -2.6, 1], W2());
      const b = W();
      P.poly([-1.6, 0, 4.4, 0, 4.4, 10, -1.6, 10], b);
      P.poly([0.8, 8, 4.6, 8, 4.6, 26, 0.8, 26], M());
      P.poly([-1.8, 12, 1.4, 12, 1.4, 20, -1.8, 20], W2());
      ids.wpn = b;
      break;
    }
    case 'rifle':
    case 'sniper': {
      P.poly([-2, -13, 3.5, -13, 3.5, 2, -1.5, 1.5], W2());
      const b = W();
      P.poly([-1.2, -1, 5.2, -1, 5.2, 15, -1.2, 15], b);
      P.poly([1.6, 14, 4.2, 14, 4.2, kind === 'sniper' ? 34 : 26, 1.6, kind === 'sniper' ? 34 : 26], M());
      if (kind === 'sniper') P.poly([5.2, 0, 8.6, 0, 8.6, 11, 5.2, 11], M());
      else P.poly([-4.6, 6, -1, 6, -1, 12, -4.6, 12], M());
      ids.wpn = b;
      break;
    }
    case 'launcher': {
      const b = W();
      P.poly([-4.4, -10, 6.4, -10, 6.4, 24, -4.4, 24], b);
      P.poly([-5, 20, 7, 20, 7, 25.5, -5, 25.5], W2());
      ids.wpn = b;
      break;
    }
    case 'bat':
      ids.wpn = W();
      P.poly([-1.4, -2, 1.4, -2, 2.8, 12, 3.2, 26, -3.2, 26, -2.8, 12], ids.wpn);
      P.poly([-1.6, -1.5, 1.6, -1.5, 1.8, 5, -1.8, 5], W2());
      break;
    case 'hammer':
      P.cap(0, -8, 0, 22, 2.6, 2.6, W2());
      ids.wpn = W();
      P.poly([-7.5, 17.5, 7.5, 17.5, 7.5, 27.5, -7.5, 27.5], ids.wpn);
      break;
    case 'axe':
      P.cap(0, -6, 0, 22, 2.4, 2.4, W2());
      ids.wpn = W();
      P.poly([1, 13, 9, 10, 12.5, 18, 9, 26, 1, 22], ids.wpn);
      break;
    case 'katana':
      P.poly([-1.3, -6, 1.3, -6, 1.3, 2, -1.3, 2], W2());
      P.poly([-3.6, 1.4, 3.6, 1.4, 3.6, 3.6, -3.6, 3.6], P.part('#c9a24a'));
      ids.wpn = W();
      P.poly([-1.1, 3.5, 1.5, 3.5, 2, 30, 0, 33.5, -1.1, 30], ids.wpn);
      break;
    case 'scythe':
      P.cap(0, -14, 0, 30, 2.4, 2.4, W2());
      ids.wpn = W();
      P.poly([0, 26, 8, 21.5, 22, 23.5, 31, 32, 18, 28, 8, 30.5, 1, 31], ids.wpn);
      break;
    case 'boombox': {
      const h = M();
      P.poly([-6.5, 3.5, 6.5, 3.5, 6.5, 6.5, -6.5, 6.5], h);
      ids.wpn = W();
      P.poly([-11.5, 6, 11.5, 6, 11.5, 20.5, -11.5, 20.5], ids.wpn);
      const sp = P.part('#1b1a22');
      P.ell(-5.6, 13.2, 4.4, 4.4, sp, 12);
      P.ell(5.6, 13.2, 4.4, 4.4, sp, 12);
      ids.speaker = sp;
      break;
    }
    case 'spray':
      ids.wpn = W();
      P.poly([-2.8, 0, 2.8, 0, 2.8, 13, -2.8, 13], ids.wpn);
      P.poly([-1.6, 12, 1.6, 12, 1.6, 15, -1.6, 15], P.part('#e9e9ef'));
      break;
    case 'guitar':
      P.poly([-1.3, -14, 1.3, -14, 1.3, 8, -1.3, 8], W2());
      ids.wpn = W();
      P.poly([0, 7, 7, 9, 8, 15, 5, 19, 8, 24, 3, 28, -5, 27, -8, 21, -5, 16, -7, 10], ids.wpn);
      break;
    case 'staff':
      P.cap(0, -14, 0, 26, 2.4, 2.4, W2());
      ids.wpn = W();
      P.ell(0, 29, 4.4, 4.4, ids.wpn, 12);
      break;
    case 'orb':
      ids.wpn = W();
      P.ell(0, 12, 4.8, 4.8, ids.wpn, 14);
      break;
    case 'cards':
      ids.wpn = P.part('#f7f4ec');
      P.poly([-5, 3, 5, 3, 7, 12, -7, 12], ids.wpn);
      break;
    case 'chain':
      ids.wpn = W();
      for (let i = 0; i < 8; i++) P.ell(Math.sin(i * 0.7) * 1.4, 4 + i * 3, 1.4, 1.6, ids.wpn, 8);
      break;
    case 'bow':
    case 'crossbow':
      ids.wpn = W();
      for (let i = -6; i <= 6; i++) {
        const x = i * 2.3;
        P.ell(x, 2 + Math.cos((i / 6) * 1.2) * 12 - 9, 1.3, 1.3, ids.wpn, 6);
      }
      if (kind === 'crossbow') P.poly([-1.5, -6, 1.9, -6, 1.9, 16, -1.5, 16], W2());
      break;
    case 'book':
      ids.wpn = W();
      P.poly([-6, 2, 6, 2, 6, 17, -6, 17], ids.wpn);
      P.poly([-5.4, 14.8, 5.4, 14.8, 5.4, 16.4, -5.4, 16.4], P.part('#f2ead6'));
      break;
    case 'skateboard':
      ids.wpn = W();
      P.poly([-3.4, -6, 3.4, -6, 3.4, 24, -3.4, 24], ids.wpn);
      break;
    case 'claws':
      ids.wpn = W();
      for (const x of [-2.2, 0, 2.2]) P.poly([x - 0.7, 5, x + 0.7, 5, x + 0.3, 17, x, 19], ids.wpn);
      break;
    case 'flamethrower':
      ids.wpn = W();
      P.poly([-2, -2, 4, -2, 4, 12, -2, 12], ids.wpn);
      P.poly([-0.6, 11, 3, 11, 3, 20, -0.6, 20], M());
      break;
    case 'yoyo':
      ids.wpn = W();
      P.ell(0, 18, 4, 4, ids.wpn, 12);
      break;
    case 'umbrella':
      P.cap(0, -6, 0, 24, 1.8, 1.8, P.part('#2b2832'));
      ids.wpn = W();
      P.poly([-3.6, 6, 3.6, 6, 1.5, 26, -1.5, 26], ids.wpn);
      break;
    case 'mic':
      P.poly([-1.4, 0, 1.4, 0, 1.4, 12, -1.4, 12], P.part('#2b2832'));
      ids.wpn = P.part('#c9ccd6');
      P.ell(0, 13.5, 3, 3.4, ids.wpn, 10);
      break;
    case 'wrench':
      ids.wpn = W();
      P.poly([-1.4, -2, 1.4, -2, 1.4, 20, -1.4, 20], ids.wpn);
      P.poly([-4.6, 18, 4.6, 18, 5, 24, 2, 25, 1.6, 21.4, -1.6, 21.4, -2, 25, -5, 24], ids.wpn);
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// DETALHES (rosto, estampas, costuras, cadarços...) — por cima do sombreado
// ---------------------------------------------------------------------------

function details(P: Painter, look: Look, pose: Pose, front: boolean, ids: Record<string, number>, S: Record<BoneName, Mat>): void {
  const top = look.top;
  const tid = ids.torso!;
  const R = (id: number | undefined) => (id === undefined ? null : P.ramps[id]!);
  const tr = R(tid)!;
  // ---- tronco
  P.bone(S.torso);
  const hw = torsoHalfWidth(look);
  const hy = hemY(top.style);
  const light2 = rgba(top.color2 ?? mix(top.color, '#ffffff', 0.55));
  switch (top.style) {
    case 'hoodie':
      P.line(-hw, hy - 2.5, hw, hy - 2.5, tr[1]!, tid);
      if (front) {
        P.line(-5.5, -10.5, 9.5, -10.5, tr[1]!, tid);
        P.line(-6.5, -10.5, -7.5, -3, tr[1]!, tid);
        P.line(10.5, -10.5, 11.5, -3, tr[1]!, tid);
        P.line(-0.5, -27.5, -0.8, -18, light2, tid);
        P.line(4.6, -27.5, 5.2, -16, light2, tid);
      }
      break;
    case 'oversized_tee':
    case 'ribbed_tee':
      if (top.style === 'ribbed_tee') for (let x = -hw + 2; x < hw; x += 4) P.line(x, -26, x + 0.4, hy, tr[1]!, tid);
      break;
    case 'puffer':
      for (let y = -23; y < hy; y += 5.2) P.line(-hw, y, hw, y + 0.6, tr[1]!, tid);
      if (front) P.line(2.6, -26, 2.8, hy, tr[0]!, tid);
      break;
    case 'turtleneck_jacket':
    case 'tracksuit':
      if (front) P.line(2.6, -27, 2.8, hy, rgba('#e9e9ef'), tid);
      if (top.style === 'tracksuit') {
        P.line(-hw + 1.4, -24, -hw + 1.6, hy, light2, tid);
        P.line(hw - 1.4, -24, hw - 1.6, hy, light2, tid);
      }
      P.line(-hw, hy - 2.5, hw, hy - 2.5, tr[1]!, tid);
      break;
    case 'varsity':
      if (front) for (let y = -23; y < hy - 2; y += 5) P.dot(3, y, light2, tid);
      P.line(-hw, hy - 1.8, hw, hy - 1.8, light2, tid);
      break;
    case 'trench':
    case 'robe':
      if (front) {
        P.line(-2, -28, 3, -10, tr[1]!, tid);
        P.line(4.5, -28, 7.5, -16, tr[1]!, tid);
        P.line(3, -10, 4, hy, tr[1]!, tid);
      }
      if (top.style === 'trench') P.line(-hw - 1, -5, hw + 1, -5, light2, tid);
      break;
    case 'kimono':
      if (front) {
        P.line(-3, -29, 7, -10, light2, tid);
        P.line(6, -29, 2, -20, light2, tid);
      }
      P.line(-hw - 1, -7, hw + 1, -7, light2, tid);
      P.line(-hw - 1, -8, hw + 1, -8, light2, tid);
      break;
    default:
      break;
  }
  // estampa no peito
  if (top.print && top.print !== 'none') {
    const [cx, cy] = front ? P.at(3, -19) : P.at(-1, -15);
    printPattern(P, top.print, cx, cy, light2, tid, top.text);
  }
  // corrente de pescoço
  if (look.acc?.chain && front) {
    const cc = rgba(look.acc.chain);
    P.line(-3.5, -28.5, 1, -21, cc, tid);
    P.line(1, -21, 6, -28.4, cc, tid);
    const [px, py] = P.at(1.4, -20);
    P.buf.set(px, py, cc);
    P.buf.set(px, py + 1, cc);
  }
  // ---- calças: dobras, bolsos, costuras
  for (const side of ['F', 'B'] as const) {
    const th = ids[`thigh${side}`];
    const sh = ids[`shin${side}`];
    const ps = look.pants.style;
    if (th !== undefined && ps !== 'skirt') {
      const r = P.ramps[th]!;
      P.bone(S[`thigh${side}`]);
      const [w0] = pantsWidths(look);
      P.line(-w0 / 2 + 2, 6, w0 / 2 - 2, 14, r[1]!, th);
      if (ps === 'cargo' && side === 'F') {
        P.line(-w0 / 2 + 1.5, 7, -w0 / 2 + 8, 7, r[0]!, th);
        P.line(-w0 / 2 + 8, 7, -w0 / 2 + 8, 15, r[0]!, th);
        P.line(-w0 / 2 + 1.5, 15, -w0 / 2 + 8, 15, r[0]!, th);
      }
      if (ps === 'wide_jeans') P.line(w0 / 2 - 1.5, -2, w0 / 2 - 1.2, 21, rgba('#f2d68a'), th);
      if (ps === 'track') P.line(w0 / 2 - 1.2, -2, w0 / 2 - 1, 21, rgba(look.pants.color2 ?? '#ffffff'), th);
    }
    if (sh !== undefined && ps !== 'shorts' && ps !== 'skirt') {
      const r = P.ramps[sh]!;
      P.bone(S[`shin${side}`]);
      const [, , w2] = pantsWidths(look);
      // pilha de dobras na barra (calça larga)
      P.line(-w2 / 2, 11, w2 / 2 - 2, 9, r[1]!, sh);
      P.line(-w2 / 2 + 1, 16, w2 / 2, 14, r[1]!, sh);
      if (ps === 'track') P.line(w2 / 2 - 1.2, -2, w2 / 2 - 1, 20, rgba(look.pants.color2 ?? '#ffffff'), sh);
      if (ps === 'wide_jeans') P.line(w2 / 2 - 1.4, -2, w2 / 2 - 1, 20, rgba('#f2d68a'), sh);
    }
    // tênis: cadarço e listra
    const up = ids[`shoe${side}`];
    if (up !== undefined && look.shoes.style !== 'slides') {
      P.bone(S[`foot${side}`]);
      const k = 1.3;
      const Y = (v: number) => (v - 4.6) * k + 4.6;
      const acc = rgba(look.shoes.accent ?? '#16141c');
      if (look.shoes.style !== 'boots') P.line(-4 * k, Y(1.5), 9 * k, Y(-0.4), acc, up);
      const lace = rgba(look.shoes.style === 'boots' ? '#d8c9a8' : '#ffffff');
      const top2 = look.shoes.style === 'hightop' || look.shoes.style === 'boots' ? -7 : -3.5;
      for (let i = 0; i < 3; i++) P.dot((1.5 + i * 2.6) * k, Y(top2 + i * 1.1), lace, up);
    }
  }
  // brilho no cabelo (faixa clara estilo anime)
  if (front && ids.hairF !== undefined && look.hair.style !== 'none' && look.hair.style !== 'buzz') {
    P.bone(S.head, HEAD_SCALE);
    const hr = P.ramps[ids.hairF]!;
    P.line(0, -27, 5, -28, hr[4]!, ids.hairF);
  }
  // relógio
  if (ids.watch !== undefined) {
    P.bone(S.fArmF);
    P.line(-3, 10, 3, 10, rgba('#c9ccd6'), ids.watch);
    P.line(-3, 11, 3, 11, rgba('#c9ccd6'), ids.watch);
  }
  // detalhes da arma
  if (ids.wpn !== undefined) {
    const r = P.ramps[ids.wpn]!;
    P.bone(S.handF);
    const k = look.weapon.kind;
    if (k === 'boombox' && ids.speaker !== undefined) {
      P.dot(-5.6, 13.2, rgba(look.weapon.color2 ?? '#58ffd0'), ids.speaker);
      P.dot(5.6, 13.2, rgba(look.weapon.color2 ?? '#58ffd0'), ids.speaker);
    } else if (k === 'katana') P.line(0.6, 5, 1.2, 30, r[4]!, ids.wpn);
    else if (k === 'cards') P.dot(0, 7, rgba('#e0213a'), ids.wpn);
    else if (k === 'orb' || k === 'staff') {
      const [ox, oy] = P.at(k === 'orb' ? -1 : -1, k === 'orb' ? 10.5 : 27.5);
      P.buf.set(ox, oy, WHITE);
    }
  }
  // ---- rosto
  if (front) face(P, look, pose.face, ids, S);
  else if (look.species === 'skeleton' || look.species === 'robot') {
    /* nada nas costas */
  }
}

/** Pequenos desenhos de estampa (5×5 pixels). */
function printPattern(P: Painter, kind: string, cx: number, cy: number, c: number, mask: number, text?: string): void {
  const pats: Record<string, string[]> = {
    skull: [' ### ', '#####', '# # #', ' ### ', ' # # '],
    star: ['  #  ', ' ### ', '#####', ' # # ', '#   #'],
    heart: [' # # ', '#####', '#####', ' ### ', '  #  '],
    flame: ['  #  ', ' ##  ', ' ### ', '#####', ' ### '],
    cross: ['  #  ', '#####', '  #  ', '  #  ', '  #  '],
    bolt: ['  ## ', ' ##  ', '#### ', '  ## ', ' #   '],
    eye: [' ### ', '#   #', '# # #', '#   #', ' ### '],
    rune: ['#####', '#  ##', '# # #', '##  #', '#####'],
    stripe: ['#####', '     ', '#####', '     ', '#####'],
    text: text === '₹' ? [' ### ', '#### ', ' ### ', '##   ', '# #  '] : ['## ##', '#   #', '#####', '#   #', '## ##'],
  };
  const p = pats[kind];
  if (!p) return;
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (p[y]![x] === '#') P.buf.set(cx - 2 + x, cy - 2 + y, c, -2, mask);
}

function face(P: Painter, look: Look, expr: FaceExpr, ids: Record<string, number>, S: Record<BoneName, Mat>): void {
  const head = ids.head;
  if (head === undefined) return;
  P.bone(S.head, HEAD_SCALE);
  const hr = P.ramps[head]!;
  const buf = P.buf;
  const sp = look.species;
  const [ex, ey] = P.at(8.6, -12.5); // olho da frente
  const [fx, fy] = P.at(2, -12.5); // olho de trás
  const [mx, my] = P.at(7.8, -4.8); // boca
  const set = (x: number, y: number, c: number) => buf.set(x, y, c, -2, head);
  const eyeC = rgba(look.eyes.color);
  const eyeD = rgba(mix(look.eyes.color, '#000000', 0.55));
  if (sp === 'skeleton') {
    for (const [x, y, s] of [
      [ex, ey, 1],
      [fx, fy, 0],
    ] as const) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= s; dx++) set(x + dx, y + dy, DARK);
      if (expr !== 'blink') set(x, y, expr === 'hurt' ? WHITE : eyeC);
    }
    set(ex + 2, ey + 3, DARK);
    for (let x = fx; x <= ex + 3; x++) set(x, my, x % 2 ? DARK : hr[1]!);
    if (expr === 'shout' || expr === 'happy') for (let x = fx; x <= ex + 2; x++) set(x, my + 1, DARK);
    return;
  }
  if (sp === 'robot') {
    for (let y = ey - 2; y <= ey + 2; y++) for (let x = fx - 2; x <= ex + 3; x++) set(x, y, rgba('#151a26'));
    const glow = eyeC;
    if (expr === 'blink') {
      for (let x = fx - 1; x <= fx + 1; x++) set(x, ey, glow);
      for (let x = ex; x <= ex + 2; x++) set(x, ey, glow);
    } else if (expr === 'happy') {
      (set(fx - 1, ey + 1, glow), set(fx, ey, glow), set(fx + 1, ey + 1, glow));
      (set(ex, ey + 1, glow), set(ex + 1, ey, glow), set(ex + 2, ey + 1, glow));
    } else if (expr === 'hurt') {
      (set(fx - 1, ey - 1, glow), set(fx, ey, glow), set(fx + 1, ey + 1, glow), set(fx + 1, ey - 1, glow), set(fx - 1, ey + 1, glow));
      (set(ex, ey - 1, glow), set(ex + 1, ey, glow), set(ex + 2, ey + 1, glow), set(ex + 2, ey - 1, glow), set(ex, ey + 1, glow));
    } else {
      for (const x of [fx, ex + 1]) {
        set(x, ey, glow);
        set(x, ey - 1, glow);
        if (expr === 'shout' || expr === 'focus') set(x + 1, ey - 1, glow);
      }
    }
    for (let i = 0; i < 3; i++) set(mx - 1 + i * 2, my, rgba('#5b6476'));
    return;
  }
  const ink = rgba(mix(mix(look.skin, '#000000', 0.6), '#2a0a2a', 0.3));
  const style = look.eyes.style;
  // olhos
  const drawEye = (x: number, y: number, near: boolean) => {
    const w = near ? 2 : 1;
    if (expr === 'blink' || style === 'closed') {
      for (let dx = -1; dx < w + (near ? 1 : 0); dx++) set(x + dx, y + 1, ink);
      return;
    }
    if (expr === 'happy') {
      set(x - 1, y + 1, ink);
      set(x, y, ink);
      if (near) set(x + 1, y + 1, ink);
      return;
    }
    if (expr === 'hurt') {
      (set(x - 1, y - 1, ink), set(x, y, ink), set(x - 1, y + 1, ink));
      if (near) set(x + 1, y, ink);
      return;
    }
    if (style === 'glow' || style === 'hollow') {
      if (style === 'hollow') for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= w; dx++) set(x + dx, y + dy, DARK);
      set(x, y, eyeC);
      if (near) set(x + 1, y, eyeC);
      set(x, y - 1, style === 'glow' ? rgba(mix(look.eyes.color, '#ffffff', 0.5)) : DARK);
      return;
    }
    const big = style === 'round' || style === 'wide' || style === 'cyclops';
    // branco do olho
    for (let dy = big ? -1 : 0; dy <= 1; dy++) for (let dx = 0; dx < w; dx++) set(x + dx, y + dy, EYE_WHITE);
    // íris/pupila
    if (style === 'wide') set(x + (near ? 1 : 0), y, ink);
    else {
      set(x + (near ? 1 : 0), y, eyeD);
      set(x + (near ? 1 : 0), y + 1, eyeC);
      if (near) set(x, y + 1, eyeC);
    }
    if (big && near) set(x, y - 1, WHITE);
    // pálpebra (sobrancelha do olho)
    const lid = style === 'sleepy' || expr === 'smug' || (style === 'lazy' && near);
    const sharp = style === 'sharp' || expr === 'focus' || expr === 'shout';
    const ly = big ? y - 2 : y - 1;
    for (let dx = -1; dx < w + 1; dx++) set(x + dx, lid ? y : ly + (sharp && dx === w ? 1 : 0), ink);
  };
  if (style === 'cyclops') drawEye(Math.round((ex + fx) / 2), ey, true);
  else {
    drawEye(fx, fy, false);
    drawEye(ex, ey, true);
  }
  // sobrancelhas
  const brows = look.brows ?? 'flat';
  if (brows !== 'none') {
    const ang = expr === 'shout' || brows === 'angry' || expr === 'focus' ? 1 : brows === 'sad' || expr === 'sad' ? -1 : 0;
    const by = ey - 3;
    const bc = rgba(look.hair.style === 'none' ? mix(look.skin, '#000000', 0.5) : mix(look.hair.color, '#000000', 0.1));
    set(ex - 1, by - (ang < 0 ? 1 : 0), bc);
    set(ex, by, bc);
    set(ex + 1, by + (ang > 0 ? 1 : 0) - (ang < 0 ? 0 : 0), bc);
    set(fx, by + (ang < 0 ? 1 : 0), bc);
  }
  // bochecha
  if (look.face?.blush || expr === 'happy') set(ex + 2, ey + 3, rgba(mix(look.skin, '#ff6f91', 0.45)));
  if (look.face?.freckles) {
    set(ex - 1, ey + 3, hr[1]!);
    set(ex + 1, ey + 3, hr[1]!);
  }
  if (look.face?.scar) {
    set(ex + 1, ey - 3, rgba('#8a2d3c'));
    set(ex + 2, ey - 2, rgba('#8a2d3c'));
    set(ex + 2, ey + 2, rgba('#8a2d3c'));
  }
  if (look.face?.paint) {
    set(ex + 1, ey + 3, rgba(look.face.paint));
    set(ex + 2, ey + 3, rgba(look.face.paint));
  }
  if (look.face?.tattoo) set(ex + 3, my - 1, rgba(look.face.tattoo === '₹' ? '#ffd23f' : '#1a1020'));
  // nariz
  if (sp !== 'alien' && sp !== 'ghost') set(ex + 3, ey + 2, hr[1]!);
  if (sp === 'feline') set(ex + 3, ey + 3, rgba('#ff8fb0'));
  // boca
  const mouth = look.mouth ?? 'neutral';
  if (ids.mask === undefined) {
    if (expr === 'shout') {
      (set(mx - 1, my, DARK), set(mx, my, DARK), set(mx - 1, my + 1, DARK), set(mx, my + 1, rgba('#ff6f8a')));
    } else if (expr === 'happy' || mouth === 'open') {
      (set(mx - 1, my, DARK), set(mx, my, DARK), set(mx + 1, my, DARK), set(mx, my + 1, rgba('#ff6f8a')));
    } else if (expr === 'hurt' || expr === 'sad' || mouth === 'frown') {
      (set(mx - 1, my + 1, ink), set(mx, my, ink), set(mx + 1, my + 1, ink));
    } else if (mouth === 'teeth') {
      (set(mx - 1, my, WHITE), set(mx, my, WHITE), set(mx + 1, my, WHITE), set(mx - 1, my + 1, ink), set(mx, my + 1, ink), set(mx + 1, my + 1, ink));
    } else if (mouth === 'fangs') {
      (set(mx - 1, my, ink), set(mx, my, ink), set(mx + 1, my, ink), set(mx - 1, my + 1, WHITE), set(mx + 1, my + 1, WHITE));
    } else if (mouth === 'stitch') {
      for (let x = -1; x <= 2; x++) set(mx + x, my, ink);
      (set(mx, my - 1, ink), set(mx, my + 1, ink));
    } else if (mouth === 'smirk' || expr === 'smug') {
      (set(mx - 1, my, ink), set(mx, my, ink), set(mx + 1, my - 1, ink));
    } else {
      (set(mx - 1, my, ink), set(mx, my, ink));
    }
  }
  // acessórios de rosto
  const a = look.acc ?? {};
  if (a.glasses) {
    const dark = a.glasses === 'shades';
    const gc = rgba(dark ? '#111018' : a.glasses === 'visor' ? '#25d6ff' : a.glasses === 'goggles' ? '#e0902a' : '#8e97ab');
    const put = (x: number, y: number, c = gc) => buf.set(x, y, c);
    if (a.glasses === 'shades' || a.glasses === 'visor') {
      // lente escura contínua com brilhinho
      for (let x = fx - 1; x <= ex + 2; x++) {
        put(x, ey - 1);
        put(x, ey);
      }
      put(ex + 1, ey - 1, rgba(dark ? '#7a6cff' : '#d6faff'));
    } else if (a.glasses === 'goggles') {
      for (let x = fx - 1; x <= ex + 2; x++) put(x, ey - 4);
      (put(fx, ey - 5), put(ex, ey - 5), put(ex + 1, ey - 5));
    } else {
      // armação fina (meio-aro): barra em cima, ponte e cantos
      for (let x = ex - 1; x <= ex + 2; x++) put(x, ey - 2);
      (put(ex + 2, ey - 1), put(ex + 2, ey), put(ex - 1, ey + 1), put(ex + 2, ey + 1));
      for (let x = fx; x <= fx + 1; x++) put(x, ey - 2);
      put(fx + 2, ey - 1);
      put(fx - 1, ey - 1);
    }
  }
  if (a.earbuds) {
    const [ox, oy] = P.at(-7.4, -11.6);
    buf.set(ox, oy, WHITE);
    buf.set(ox + 1, oy, WHITE);
    buf.set(ox, oy + 1, WHITE);
  }
  if (ids.mask !== undefined && a.mask === 'skull') {
    for (let x = fx; x <= ex + 2; x += 2) buf.set(x, my, rgba('#e9e2d0'), -2, ids.mask);
  }
}

// (re-export pra quem precisa da tinta)
export { INK };
