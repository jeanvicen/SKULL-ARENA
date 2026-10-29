/**
 * ESQUELETO (RIG) DOS PERSONAGENS
 * --------------------------------
 * Todo personagem tem a mesma altura de jogo: 100 unidades (pés em y=0, topo da cabeça ≈ -108).
 * Ossos (pai → filho):
 *
 *   root ─ hips ─ torso ─ head
 *                   ├─ uArmF ─ fArmF ─ handF     (braço da FRENTE: o que segura a arma)
 *                   └─ uArmB ─ fArmB ─ handB     (braço de TRÁS)
 *              ├─ thighF ─ shinF ─ footF         (perna da frente)
 *              └─ thighB ─ shinB ─ footB         (perna de trás)
 *
 * Convenção de rotação (em graus) pra ficar fácil animar à mão:
 *   r POSITIVO = gira PRA FRENTE (pra onde o personagem olha).
 *   - braço r: 0 = pendurado, 90 = apontando pra frente, 180 = pra cima.
 *   - antebraço r: positivo dobra o cotovelo pra frente.
 *   - coxa r: positivo levanta o joelho pra frente.  canela r: NEGATIVO dobra o joelho.
 *   - tronco/cabeça r: positivo inclina pra frente.
 *   x/y = deslocamento extra (unidades), sx/sy = escala (respirar, esmagar/esticar).
 */

export const BONES = [
  'root',
  'hips',
  'torso',
  'head',
  'uArmF',
  'fArmF',
  'handF',
  'uArmB',
  'fArmB',
  'handB',
  'thighF',
  'shinF',
  'footF',
  'thighB',
  'shinB',
  'footB',
] as const;

export type BoneName = (typeof BONES)[number];

export interface BoneT {
  r: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
}

export type HandShape = 'fist' | 'open' | 'peace' | 'point' | 'grip';
export type FaceExpr = 'neutral' | 'blink' | 'shout' | 'hurt' | 'happy' | 'smug' | 'sad' | 'focus';

export interface Pose {
  b: Record<BoneName, BoneT>;
  shapeF: HandShape;
  shapeB: HandShape;
  face: FaceExpr;
}

interface BoneInfo {
  parent: BoneName | null;
  /** ponto de encaixe no espaço do pai */
  px: number;
  py: number;
  /** +1 = osso que aponta pra cima (tronco/cabeça), -1 = aponta pra baixo (membros) */
  dir: 1 | -1;
}

export const RIG: Record<BoneName, BoneInfo> = {
  root: { parent: null, px: 0, py: 0, dir: 1 },
  hips: { parent: 'root', px: 0, py: -44, dir: 1 },
  torso: { parent: 'hips', px: 0, py: 0, dir: 1 },
  head: { parent: 'torso', px: 1, py: -29, dir: 1 },
  uArmF: { parent: 'torso', px: 4.5, py: -25, dir: -1 },
  fArmF: { parent: 'uArmF', px: 0, py: 14, dir: -1 },
  handF: { parent: 'fArmF', px: 0, py: 13, dir: -1 },
  uArmB: { parent: 'torso', px: -5.5, py: -25, dir: -1 },
  fArmB: { parent: 'uArmB', px: 0, py: 14, dir: -1 },
  handB: { parent: 'fArmB', px: 0, py: 13, dir: -1 },
  thighF: { parent: 'hips', px: 3.5, py: 0, dir: -1 },
  shinF: { parent: 'thighF', px: 0, py: 20, dir: -1 },
  footF: { parent: 'shinF', px: 0, py: 20, dir: -1 },
  thighB: { parent: 'hips', px: -3.5, py: 0, dir: -1 },
  shinB: { parent: 'thighB', px: 0, py: 20, dir: -1 },
  footB: { parent: 'shinB', px: 0, py: 20, dir: -1 },
};

export function restBone(): BoneT {
  return { r: 0, x: 0, y: 0, sx: 1, sy: 1 };
}

export function newPose(): Pose {
  const b = {} as Record<BoneName, BoneT>;
  for (const n of BONES) b[n] = restBone();
  return { b, shapeF: 'fist', shapeB: 'fist', face: 'neutral' };
}

export function copyPose(src: Pose, dst: Pose): Pose {
  for (const n of BONES) Object.assign(dst.b[n], src.b[n]);
  dst.shapeF = src.shapeF;
  dst.shapeB = src.shapeB;
  dst.face = src.face;
  return dst;
}

// ---------------------------------------------------------------------------
// Matrizes 2D (a b c d e f) sem alocar DOMMatrix por frame
// ---------------------------------------------------------------------------

export type Mat = [number, number, number, number, number, number];

export const ident = (): Mat => [1, 0, 0, 1, 0, 0];

/** out = A × B */
export function mul(A: Mat, B: Mat, out: Mat): Mat {
  const a = A[0] * B[0] + A[2] * B[1];
  const b = A[1] * B[0] + A[3] * B[1];
  const c = A[0] * B[2] + A[2] * B[3];
  const d = A[1] * B[2] + A[3] * B[3];
  const e = A[0] * B[4] + A[2] * B[5] + A[4];
  const f = A[1] * B[4] + A[3] * B[5] + A[5];
  out[0] = a;
  out[1] = b;
  out[2] = c;
  out[3] = d;
  out[4] = e;
  out[5] = f;
  return out;
}

const DEG = Math.PI / 180;
const tmp: Mat = ident();

/** Calcula a matriz de mundo de cada osso (espaço do personagem, olhando pra direita). */
export function solve(pose: Pose, out: Record<BoneName, Mat>): void {
  for (const n of BONES) {
    const info = RIG[n];
    const t = pose.b[n];
    const th = t.r * DEG * info.dir;
    const c = Math.cos(th);
    const s = Math.sin(th);
    tmp[0] = c * t.sx;
    tmp[1] = s * t.sx;
    tmp[2] = -s * t.sy;
    tmp[3] = c * t.sy;
    tmp[4] = info.px + t.x;
    tmp[5] = info.py + t.y;
    const m = out[n] ?? (out[n] = ident());
    if (info.parent) mul(out[info.parent], tmp, m);
    else {
      m[0] = tmp[0];
      m[1] = tmp[1];
      m[2] = tmp[2];
      m[3] = tmp[3];
      m[4] = tmp[4];
      m[5] = tmp[5];
    }
  }
}

export function newSolved(): Record<BoneName, Mat> {
  const o = {} as Record<BoneName, Mat>;
  for (const n of BONES) o[n] = ident();
  return o;
}

// ---------------------------------------------------------------------------
// Clipes de animação (quadros-chave)
// ---------------------------------------------------------------------------

export type Ease = 'linear' | 'in' | 'out' | 'inout' | 'back' | 'step';

export type PoseKey = Partial<Record<BoneName, Partial<BoneT>>>;

export interface Key extends PoseKey {
  /** tempo em segundos */
  t: number;
  /** curva até o PRÓXIMO quadro */
  ease?: Ease;
  face?: FaceExpr;
  /** formato da mão da frente/de trás a partir deste quadro */
  shapeF?: HandShape;
  shapeB?: HandShape;
}

export interface Clip {
  duration: number;
  loop: boolean;
  keys: Key[];
  /** ossos afetados quando o clipe é usado por cima de outro (camada de ação) */
  mask?: BoneName[];
}

function ease(e: Ease | undefined, t: number): number {
  switch (e) {
    case 'in':
      return t * t;
    case 'out':
      return 1 - (1 - t) * (1 - t);
    case 'inout':
      return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
    case 'back': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
    }
    case 'step':
      return 0;
    default:
      return t;
  }
}

const PROPS = ['r', 'x', 'y', 'sx', 'sy'] as const;

/** Amostra um clipe no tempo `time` e escreve em `out` (só os ossos citados nos quadros mudam). */
export function sample(clip: Clip, time: number, out: Pose, weight = 1, onlyMask = false): void {
  const keys = clip.keys;
  if (keys.length === 0) return;
  let t = time;
  if (clip.loop) t = ((t % clip.duration) + clip.duration) % clip.duration;
  else t = Math.min(Math.max(t, 0), clip.duration);
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1]!.t <= t) i++;
  const k0 = keys[i]!;
  const k1 = i < keys.length - 1 ? keys[i + 1]! : clip.loop ? keys[0]! : k0;
  const t0 = k0.t;
  const t1 = k1 === k0 ? t0 + 1 : k1.t <= t0 ? clip.duration : k1.t;
  const u = t1 > t0 ? ease(k0.ease, (t - t0) / (t1 - t0)) : 0;
  const bones = onlyMask && clip.mask ? clip.mask : BONES;
  for (const n of bones) {
    const a = k0[n];
    const b = k1[n];
    if (!a && !b && !clip.mask) {
      // osso não citado: volta pro repouso (só quando é a camada base)
      if (weight >= 1) Object.assign(out.b[n], restBone());
      continue;
    }
    if (!a && !b) continue;
    const dst = out.b[n];
    for (const p of PROPS) {
      const def = p === 'sx' || p === 'sy' ? 1 : 0;
      const va = a?.[p] ?? def;
      const vb = b?.[p] ?? def;
      const val = va + (vb - va) * u;
      dst[p] = weight >= 1 ? val : dst[p] + (val - dst[p]) * weight;
    }
  }
  if (weight >= 0.5) {
    if (k0.face) out.face = k0.face;
    if (k0.shapeF) out.shapeF = k0.shapeF;
    if (k0.shapeB) out.shapeB = k0.shapeB;
  }
}
