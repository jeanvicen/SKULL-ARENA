import type { AnimStyle } from '../content/types';
import { CLIPS, aimsWithArm, clipSet, type ClipSet } from './anims';
import { type Clip, type Pose, newPose, newSolved, sample, solve, type BoneName, type Mat } from './rig';

/**
 * ANIMADOR: junta camada base (parado/correndo/vitória) + camada de ação (ataque/dano)
 * + mira do braço + piscar. Um por personagem na tela.
 */

export type BaseState = 'idle' | 'run' | 'victory' | 'defeat' | 'dash' | 'stunned';

export class Animator {
  readonly pose: Pose = newPose();
  readonly solved: Record<BoneName, Mat> = newSolved();
  readonly clips: ClipSet;
  private state: BaseState = 'idle';
  private baseClip: Clip;
  private baseT = Math.random() * 3;
  private action: Clip | null = null;
  private actionT = 0;
  private blinkT = 1 + Math.random() * 3;
  private blinkHold = 0;
  /** -1 = olhando pra esquerda, 1 = direita */
  facing: 1 | -1 = 1;
  view: 'front' | 'back' = 'front';
  /** ângulo local da mira (rad): 0 = frente, negativo = pra cima */
  private aimLocal = 0;
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

  get current(): BaseState {
    return this.state;
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

  /** Direção da mira/movimento na TELA (x, y). Define lado (esq/dir) e frente/costas. */
  lookAt(dx: number, dy: number, aiming: boolean): void {
    if (Math.abs(dx) > 0.08) this.facing = dx >= 0 ? 1 : -1;
    const ang = Math.atan2(dy, Math.abs(dx) < 1e-6 ? 1e-6 : Math.abs(dx));
    this.aimLocal = ang;
    this.aiming = aiming;
    // mirando bem pra cima: mostra as costas
    this.view = dy < 0 && Math.abs(dy) > Math.abs(dx) * 1.3 && aiming ? 'back' : 'front';
  }

  update(dt: number): void {
    const t = dt * this.tempo;
    this.baseT += t;
    this.pose.face = 'neutral';
    this.pose.shapeF = 'fist';
    this.pose.shapeB = 'fist';
    sample(this.baseClip, this.baseT, this.pose);
    const b = this.pose.b;
    // mira do braço (armas de fogo / arco)
    if (this.aiming && aimsWithArm(this.style.attack) && this.state !== 'victory' && this.state !== 'defeat' && this.state !== 'stunned') {
      const deg = (this.aimLocal * 180) / Math.PI;
      const armR = 90 - deg;
      b.uArmF.r = armR;
      b.fArmF.r = 0;
      b.handF.r = 0;
      if (this.style.attack === 'rifle') {
        b.uArmB.r = armR - 14;
        b.fArmB.r = 38;
      } else if (this.style.attack === 'dual') {
        b.uArmB.r = armR - 6;
        b.fArmB.r = 4;
      } else if (this.style.attack === 'bow') {
        b.uArmB.r = armR - 4;
        b.fArmB.r = 110;
      }
      b.head.r = Math.max(-20, Math.min(20, deg * 0.25));
    }
    if (this.action) {
      this.actionT += t;
      if (this.actionT >= this.action.duration) this.action = null;
      else sample(this.action, this.actionT, this.pose, 1, true);
    }
    // piscar
    if (!this.action || this.pose.face === 'neutral') {
      this.blinkT -= dt;
      if (this.blinkT <= 0) {
        this.blinkHold = 0.11;
        this.blinkT = 2 + Math.random() * 3.5;
      }
      if (this.blinkHold > 0) {
        this.blinkHold -= dt;
        if (this.pose.face === 'neutral') this.pose.face = 'blink';
      }
    }
    solve(this.pose, this.solved);
  }
}
