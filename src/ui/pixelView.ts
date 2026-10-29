import type { ClipName } from '../art/anims';
import type { CharacterDef, PetDef } from '../content/types';
import type { BaseState } from '../pixel/animator';
import { petFrame } from '../pixel/pets';
import { CharSprite, FRAME_H, FRAME_W, ORIGIN_X, ORIGIN_Y, portrait } from '../pixel/sprite';

/**
 * VISUALIZADORES PIXEL pras telas (menu, coleção, detalhes, estúdio).
 * Um único requestAnimationFrame anima todos; quando o elemento sai da tela
 * ele para sozinho.
 */

type Tickable = { tick: (dt: number, t: number) => void; el: HTMLElement };
const live = new Set<Tickable>();
let raf = 0;
let last = 0;
let time = 0;

function loop(now: number): void {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000 || 0));
  last = now;
  time += dt;
  for (const v of live) {
    if (!v.el.isConnected) {
      live.delete(v);
      continue;
    }
    v.tick(dt, time);
  }
  raf = live.size ? requestAnimationFrame(loop) : 0;
}

function register(v: Tickable): void {
  live.add(v);
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
}

/** Personagem animado num canvas com escala inteira (pixels nítidos). */
export class CharView {
  readonly el: HTMLCanvasElement;
  readonly sprite: CharSprite;
  private g: CanvasRenderingContext2D;
  private idleT = 0;
  private aimT = 0;
  /** faz gestos sozinho de vez em quando (menu) */
  showOff = false;
  /** pet do lado */
  pet: PetDef | null = null;
  private petX = 0;

  constructor(
    def: CharacterDef,
    readonly scale: number,
    opts: { state?: BaseState; pet?: PetDef | null; showOff?: boolean; extraW?: number } = {},
  ) {
    this.sprite = new CharSprite(def);
    this.pet = opts.pet ?? null;
    this.showOff = !!opts.showOff;
    const extra = opts.extraW ?? (this.pet ? 40 : 0);
    this.el = document.createElement('canvas');
    this.el.className = 'pix-canvas';
    this.el.width = (FRAME_W + extra) * scale;
    this.el.height = FRAME_H * scale;
    this.g = this.el.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
    this.petX = FRAME_W + extra / 2 - 6;
    this.sprite.setState(opts.state ?? 'idle');
    this.sprite.anim.lookAt(1, 0.2, false);
    register({ el: this.el, tick: (dt, t) => this.tick(dt, t) });
  }

  setState(s: BaseState): void {
    this.sprite.setState(s);
  }

  play(kind: 'attack' | 'cast' | 'hit' | ClipName): void {
    this.sprite.playAction(kind);
  }

  private tick(dt: number, t: number): void {
    const sp = this.sprite;
    if (this.showOff) {
      this.idleT += dt;
      this.aimT += dt;
      if (this.idleT > 6 + Math.random() * 4) {
        this.idleT = 0;
        sp.playAction(Math.random() < 0.5 ? 'attack' : 'cast');
      }
      // olha pros lados devagar
      const a = Math.sin(this.aimT * 0.4) * 0.9;
      sp.anim.lookAt(Math.cos(a), Math.sin(a) * 0.5, false);
    }
    sp.update(dt);
    const g = this.g;
    const s = this.scale;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.el.width, this.el.height);
    // sombra
    g.fillStyle = 'rgba(8,4,18,0.45)';
    for (let i = -12; i <= 12; i++) {
      const hh = Math.round(Math.sqrt(1 - (i / 13) ** 2) * 3);
      g.fillRect((ORIGIN_X + i) * s, (ORIGIN_Y - hh + 1) * s, s, hh * 2 * s);
    }
    const fr = sp.frame();
    g.setTransform(sp.facing * s, 0, 0, s, ORIGIN_X * s, ORIGIN_Y * s);
    g.drawImage(fr as CanvasImageSource, -ORIGIN_X, -ORIGIN_Y);
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (this.pet) {
      const fly = this.pet.motion === 'flap' || this.pet.motion === 'float' || this.pet.motion === 'orbit';
      const bob = Math.round(Math.sin(t * 3) * 2);
      const pf = petFrame(this.pet, t);
      g.setTransform(-s, 0, 0, s, (this.petX + 16) * s, (ORIGIN_Y - (fly ? 40 : 30) + bob) * s);
      g.drawImage(pf as CanvasImageSource, 0, 0);
      g.setTransform(1, 0, 0, 1, 0, 0);
    }
  }
}

/** Pet animado. */
export class PetView {
  readonly el: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  constructor(
    readonly pet: PetDef,
    readonly scale: number,
  ) {
    this.el = document.createElement('canvas');
    this.el.className = 'pix-canvas';
    this.el.width = 32 * scale;
    this.el.height = 36 * scale;
    this.g = this.el.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
    register({ el: this.el, tick: (_dt, t) => this.tick(t) });
  }
  private tick(t: number): void {
    const g = this.g;
    const s = this.scale;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.el.width, this.el.height);
    const fly = this.pet.motion === 'flap' || this.pet.motion === 'float' || this.pet.motion === 'orbit';
    g.fillStyle = 'rgba(8,4,18,0.4)';
    g.fillRect(9 * s, 33 * s, 14 * s, 2 * s);
    const bob = fly ? Math.round(Math.sin(t * 3) * 1.5) : 0;
    g.setTransform(s, 0, 0, s, 0, (bob + (fly ? 0 : 2)) * s);
    g.drawImage(petFrame(this.pet, t) as CanvasImageSource, 0, 0);
  }
}

/** Retrato parado (pra cards da coleção) — reaproveita o cache de quadros. */
export function portraitCanvas(def: CharacterDef, scale = 2): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.className = 'pix-canvas';
  // recorta a parte de cima (cabeça + tronco)
  const cropH = 64;
  c.width = FRAME_W * scale;
  c.height = cropH * scale;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(portrait(def) as CanvasImageSource, 0, 6, FRAME_W, cropH, 0, 0, FRAME_W * scale, cropH * scale);
  return c;
}

/** Pet parado (cards). */
export function petIcon(pet: PetDef, scale = 2): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.className = 'pix-canvas';
  c.width = 32 * scale;
  c.height = 32 * scale;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(petFrame(pet, 0) as CanvasImageSource, 0, 0, 32 * scale, 32 * scale);
  return c;
}
