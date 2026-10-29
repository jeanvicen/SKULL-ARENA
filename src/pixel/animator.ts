import type { AnimStyle } from '../content/types';
import { CLIPS, aimsWithArm, clipSet, type ClipName, type ClipSet } from '../art/anims';
import { type Clip, type Pose, newPose, newSolved, sample, solve, type BoneName, type Mat } from '../art/rig';

/**
 * ANIMADOR PIXEL (quadros fixos, estilo 16-bit)
 * As animações por quadros-chave (art/anims.ts) são tocadas em "passos" (8–16 fps),
 * como nos jogos de pixel. Cada combinação (animação, quadro, vista, mira) vira uma
 * CHAVE: o desenho só é feito na 1ª vez e depois sai do cache.
 */

export type BaseState = 'idle' | 'run' | 'victory' | 'defeat' | 'dash' | 'stunned';

/** quadros por segundo de cada estado (pixel art "pula" de quadro em quadro) */
export const FPS: Record<BaseState | 'action', number> = { idle: 8, run: 12, victory: 8, defeat: 6, dash: 10, stunned: 8, action: 16 };

const clipName = new Map<Clip, string>();
for (const [k, v] of Object.entries(CLIPS)) clipName.set(v, k);

export class PixelAnimator {
  readonly pose: Pose = newPose();
  readonly solved: Record<BoneName, Mat> = newSolved();
  readonly clips: ClipSet;
  state: BaseState = 'idle';
  private baseClip: Clip;
  baseT = Math.random() * 2;
  action: Clip | null = null;
  actionT = 0;
  private blinkT = 1 + Math.random() * 3;
  private blinkHold = 0;
  facing: 1 | -1 = 1;
  view: 'front' | 'back' = 'front';
  private aimDeg = 0;
  aiming = false;
  readonly tempo: number;

  constructor(readonly style: AnimStyle) {
    this.clips = clipSet(style);
    this.baseClip = this.clips.idle;
    this.tempo = style.tempo ?? 1;
  }

  setState(s: BaseState): void {
    if (s === this.state) return;
    this.state = s;
    this.baseClip = s === 'idle' ? this.clips.idle : s === 'run' ? this.clips.run : s === 'victory' ? this.clips.victory : s === 'defeat' ? CLIPS.defeat : s === 'dash' ? CLIPS.dash : CLIPS.stunned;
    this.baseT = 0;
  }

  play(clip: Clip): void {
    this.action = clip;
    this.actionT = 0;
  }

  playAttack(): void {
    this.play(this.clips.attack);
  }

  playHit(): void {
    if (!this.action || this.action === CLIPS.hit) this.play(CLIPS.hit);
  }

  playNamed(n: ClipName): void {
    this.play(CLIPS[n]);
  }

  /** direção (tela) da mira/movimento */
  lookAt(dx: number, dy: number, aiming: boolean): void {
    if (Math.abs(dx) > 0.08) this.facing = dx >= 0 ? 1 : -1;
    this.aimDeg = (Math.atan2(dy, Math.max(1e-6, Math.abs(dx))) * 180) / Math.PI;
    this.aiming = aiming;
    this.view = dy < 0 && Math.abs(dy) > Math.abs(dx) * 1.3 && aiming ? 'back' : 'front';
  }

  update(dt: number): void {
    const t = dt * this.tempo;
    this.baseT += t;
    if (this.action) {
      this.actionT += t;
      if (this.actionT >= this.action.duration) this.action = null;
    }
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blinkHold = 0.12;
      this.blinkT = 2 + Math.random() * 3.5;
    }
    if (this.blinkHold > 0) this.blinkHold -= dt;
  }

  private armAim(): boolean {
    return this.aiming && aimsWithArm(this.style.attack) && this.state !== 'victory' && this.state !== 'defeat' && this.state !== 'stunned';
  }

  /** chave única do quadro atual (sem desenhar nada) */
  key(): string {
    const fps = FPS[this.state];
    const nB = Math.max(1, Math.round(this.baseClip.duration * fps));
    const fb = Math.floor((this.baseT % this.baseClip.duration) * fps) % nB;
    let k = `${this.state}${fb}`;
    if (this.action) k += `|${clipName.get(this.action) ?? 'a'}${Math.floor(this.actionT * FPS.action)}`;
    if (this.armAim()) k += `|a${Math.round(this.aimDeg / 22.5)}`;
    k += this.view === 'back' ? '|b' : '';
    if (this.blinkHold > 0 && !this.action) k += '|z';
    return k;
  }

  /** monta a pose do quadro atual (só quando o cache não tem) */
  build(): void {
    const fps = FPS[this.state];
    const qb = Math.floor(this.baseT * fps) / fps;
    const p = this.pose;
    p.face = 'neutral';
    p.shapeF = 'fist';
    p.shapeB = 'fist';
    sample(this.baseClip, qb, p);
    const b = p.b;
    if (this.armAim()) {
      const deg = Math.round(this.aimDeg / 22.5) * 22.5;
      const armR = 90 - deg;
      b.uArmF.r = armR;
      b.fArmF.r = 0;
      b.handF.r = 0;
      const atk = this.style.attack;
      if (atk === 'rifle') {
        b.uArmB.r = armR - 14;
        b.fArmB.r = 38;
      } else if (atk === 'dual') {
        b.uArmB.r = armR - 6;
        b.fArmB.r = 4;
      } else if (atk === 'bow') {
        b.uArmB.r = armR - 4;
        b.fArmB.r = 110;
      }
      b.head.r = Math.max(-20, Math.min(20, deg * 0.25));
    }
    if (this.action) {
      const qa = Math.floor(this.actionT * FPS.action) / FPS.action;
      sample(this.action, qa, p, 1, true);
    }
    if (this.blinkHold > 0 && !this.action && p.face === 'neutral') p.face = 'blink';
    solve(p, this.solved);
  }
}
