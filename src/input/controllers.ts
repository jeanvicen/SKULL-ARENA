import type { Fighter } from '../combat/state';
import type { Camera } from '../render/camera';
import { clamp } from '../engine/math';

/** Contrato comum: cada perfil escreve a intenção do jogador no FighterInput. */
export interface PlayerController {
  update(dt: number, f: Fighter, camera: Camera): void;
  /** Botão de especial pressionado (mostra a prévia de mira). */
  readonly specialHeld: boolean;
  /** Joystick/mouse ativo (mostra o cone de ataque). */
  readonly aiming: boolean;
  destroy(): void;
}

export interface TouchSettings {
  deadZone: number;
  radius: number;
  smoothing: number;
  floating: boolean;
}

/**
 * Joystick virtual ANDA = MIRA = ATACA + botão de especial (multi-toque).
 *  - Base visível + indicador móvel; dead zone ajustável; normalização; suavização.
 *  - Soltar o joystick = para de andar e de atacar.
 *  - Especial: dispara ao SOLTAR dentro do botão (segurar mostra a prévia; arrastar
 *    para longe cancela) → não dispara sem querer durante o movimento.
 */
export class TouchController implements PlayerController {
  private moveId = -1;
  private aimId = -1;
  private specId = -1;
  private moveBaseX = 0;
  private moveBaseY = 0;
  private aimBaseX = 0;
  private aimBaseY = 0;
  private moveRestX = 0;
  private moveRestY = 0;
  private aimRestX = 0;
  private aimRestY = 0;
  private moveRawX = 0;
  private moveRawY = 0;
  private aimRawX = 0;
  private aimRawY = 0;
  private moveOutX = 0;
  private moveOutY = 0;
  private aimOutX = 0;
  private aimOutY = 0;
  private moving = false;
  private aimingNow = false;
  private specialQueued = false;
  private specHeld = false;
  private specStartX = 0;
  private specStartY = 0;
  private readonly cleanup: Array<() => void> = [];

  constructor(
    private readonly moveZone: HTMLElement,
    private readonly moveBase: HTMLElement,
    private readonly moveKnob: HTMLElement,
    private readonly aimZone: HTMLElement,
    private readonly aimBase: HTMLElement,
    private readonly aimKnob: HTMLElement,
    private readonly specialBtn: HTMLElement,
    private settings: TouchSettings,
    private readonly onSpecialPress?: () => void,
  ) {
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, ev: K, fn: (e: HTMLElementEventMap[K]) => void) => {
      el.addEventListener(ev, fn as EventListener, { passive: false });
      this.cleanup.push(() => el.removeEventListener(ev, fn as EventListener));
    };
    on(moveZone, 'pointerdown', (e) => this.stickDown(e, 'move'));
    on(aimZone, 'pointerdown', (e) => this.stickDown(e, 'aim'));
    on(specialBtn, 'pointerdown', (e) => this.specDown(e));
    on(window, 'pointermove', (e) => this.move(e));
    on(window, 'pointerup', (e) => this.up(e));
    on(window, 'pointercancel', (e) => this.up(e, true));
    this.layoutRest();
    const ro = new ResizeObserver(() => this.layoutRest());
    ro.observe(moveZone);
    ro.observe(aimZone);
    this.cleanup.push(() => ro.disconnect());
  }

  setSettings(s: TouchSettings): void {
    this.settings = s;
    this.layoutRest();
  }

  get specialHeld(): boolean { return this.specHeld; }
  get aiming(): boolean { return this.aimingNow; }

  private layoutRest(): void {
    const size = this.settings.radius * 2;
    for (const [zone, base, knob, which] of [
      [this.moveZone, this.moveBase, this.moveKnob, 'move'],
      [this.aimZone, this.aimBase, this.aimKnob, 'aim'],
    ] as const) {
      const r = zone.getBoundingClientRect();
      const x = r.width / 2, y = r.height / 2;
      base.style.width = base.style.height = `${size}px`;
      knob.style.width = knob.style.height = `${Math.round(size * 0.46)}px`;
      if (which === 'move') { this.moveRestX = this.moveBaseX = x; this.moveRestY = this.moveBaseY = y; if (!this.moving) this.place(base, knob, x, y, 0, 0); }
      else { this.aimRestX = this.aimBaseX = x; this.aimRestY = this.aimBaseY = y; if (!this.aimingNow) this.place(base, knob, x, y, 0, 0); }
    }
  }

  private place(base: HTMLElement, knob: HTMLElement, x: number, y: number, dx: number, dy: number): void {
    base.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    knob.style.transform = `translate(${x + dx}px, ${y + dy}px) translate(-50%, -50%)`;
  }

  private stickDown(e: PointerEvent, kind: 'move' | 'aim'): void {
    if ((kind === 'move' && this.moveId !== -1) || (kind === 'aim' && this.aimId !== -1)) return;
    e.preventDefault();
    const zone = kind === 'move' ? this.moveZone : this.aimZone;
    const base = kind === 'move' ? this.moveBase : this.aimBase;
    const knob = kind === 'move' ? this.moveKnob : this.aimKnob;
    const r = zone.getBoundingClientRect();
    const lx = e.clientX - r.left, ly = e.clientY - r.top;
    if (kind === 'move') {
      this.moveId = e.pointerId;
      if (this.settings.floating) { this.moveBaseX = clamp(lx, this.settings.radius * .65, r.width - this.settings.radius * .65); this.moveBaseY = clamp(ly, this.settings.radius * .65, r.height - this.settings.radius * .65); this.place(base, knob, this.moveBaseX, this.moveBaseY, 0, 0); }
      this.moving = true;
      base.classList.add('active');
    } else {
      this.aimId = e.pointerId;
      if (this.settings.floating) { this.aimBaseX = clamp(lx, this.settings.radius * .65, r.width - this.settings.radius * .65); this.aimBaseY = clamp(ly, this.settings.radius * .65, r.height - this.settings.radius * .65); this.place(base, knob, this.aimBaseX, this.aimBaseY, 0, 0); }
      this.aimingNow = true;
      base.classList.add('active');
    }
    this.updateStick(kind, lx, ly);
  }

  private specDown(e: PointerEvent): void {
    if (this.specId !== -1) return;
    e.preventDefault(); e.stopPropagation();
    this.specId = e.pointerId; this.specHeld = true;
    this.specStartX = e.clientX; this.specStartY = e.clientY;
    this.specialBtn.classList.add('pressed');
    this.onSpecialPress?.();
  }

  private move(e: PointerEvent): void {
    if (e.pointerId === this.moveId) {
      e.preventDefault(); const r = this.moveZone.getBoundingClientRect();
      this.updateStick('move', e.clientX - r.left, e.clientY - r.top);
    } else if (e.pointerId === this.aimId) {
      e.preventDefault(); const r = this.aimZone.getBoundingClientRect();
      this.updateStick('aim', e.clientX - r.left, e.clientY - r.top);
    } else if (e.pointerId === this.specId) {
      const r = this.specialBtn.getBoundingClientRect();
      this.specialBtn.classList.toggle('cancel', Math.hypot(e.clientX - this.specStartX, e.clientY - this.specStartY) > r.width * 1.2);
    }
  }

  private up(e: PointerEvent, cancel = false): void {
    if (e.pointerId === this.moveId) {
      this.moveId = -1; this.moving = false; this.moveRawX = this.moveRawY = 0; this.moveBase.classList.remove('active');
      this.place(this.moveBase, this.moveKnob, this.moveRestX, this.moveRestY, 0, 0);
    } else if (e.pointerId === this.aimId) {
      this.aimId = -1; this.aimingNow = false; this.aimRawX = this.aimRawY = 0; this.aimBase.classList.remove('active');
      this.place(this.aimBase, this.aimKnob, this.aimRestX, this.aimRestY, 0, 0);
    } else if (e.pointerId === this.specId) {
      const r = this.specialBtn.getBoundingClientRect();
      const far = Math.hypot(e.clientX - this.specStartX, e.clientY - this.specStartY) > r.width * 1.2;
      if (!cancel && !far) this.specialQueued = true;
      this.specId = -1; this.specHeld = false; this.specialBtn.classList.remove('pressed', 'cancel');
    }
  }

  private updateStick(kind: 'move' | 'aim', lx: number, ly: number): void {
    const zone = kind === 'move' ? this.moveZone : this.aimZone;
    const base = kind === 'move' ? this.moveBase : this.aimBase;
    const knob = kind === 'move' ? this.moveKnob : this.aimKnob;
    let bx = kind === 'move' ? this.moveBaseX : this.aimBaseX;
    let by = kind === 'move' ? this.moveBaseY : this.aimBaseY;
    const r = this.settings.radius;
        let dx = lx - bx, dy = ly - by;
    const d = Math.hypot(dx, dy);
    if (d > r) { dx = dx / d * r; dy = dy / d * r; }
    this.place(base, knob, bx, by, dx, dy);
    const mag = Math.min(1, d / r), dz = this.settings.deadZone;
    const m = mag < dz || d < 1 ? 0 : Math.min(1, (mag - dz) / (0.75 - dz));
    const x = m ? dx / (d || 1) * m : 0, y = m ? dy / (d || 1) * m : 0;
    if (kind === 'move') { this.moveRawX = x; this.moveRawY = y; }
    else { this.aimRawX = x; this.aimRawY = y; }
  }

  update(dt: number, f: Fighter): void {
    const tau = 0.012 + this.settings.smoothing * 0.05;
    const k = 1 - Math.exp(-dt / tau);
    this.moveOutX += (this.moveRawX - this.moveOutX) * k; this.moveOutY += (this.moveRawY - this.moveOutY) * k;
    this.aimOutX += (this.aimRawX - this.aimOutX) * k; this.aimOutY += (this.aimRawY - this.aimOutY) * k;
    if (!this.moving) this.moveOutX = this.moveOutY = 0;
    if (!this.aimingNow) this.aimOutX = this.aimOutY = 0;
    const inp = f.input;
    inp.moveX = this.moveOutX; inp.moveY = this.moveOutY;
    const aiming = Math.hypot(this.aimOutX, this.aimOutY) > 0.08;
    if (aiming) { inp.aimX = this.aimOutX; inp.aimY = this.aimOutY; }
    else { inp.aimX = inp.aimY = undefined; }
    inp.attackHeld = aiming;
    if (this.specialQueued) {
      this.specialQueued = false;
      inp.special = true;
      inp.specialAimX = aiming ? this.aimOutX : Math.cos(f.facing);
      inp.specialAimY = aiming ? this.aimOutY : Math.sin(f.facing);
    }
  }

  destroy(): void { for (const c of this.cleanup) c(); }
}

export interface DesktopSettings {
  autoFire: boolean;
  /** 'mouse' = mira com o mouse; 'move' = modo clássico (mira = movimento, igual ao touch). */
  aimMode: 'mouse' | 'move';
}

/** Perfil desktop: WASD/setas + mouse. */
export class DesktopController implements PlayerController {
  private keys = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private hasMouse = false;
  private lmb = false;
  private specHeld = false;
  private specialQueued = false;
  private readonly cleanup: Array<() => void> = [];

  constructor(target: HTMLElement, private settings: DesktopSettings, private readonly onSpecialPress?: () => void) {
    const on = <K extends keyof WindowEventMap>(el: Window | HTMLElement, ev: K, fn: (e: WindowEventMap[K]) => void) => {
      el.addEventListener(ev, fn as EventListener);
      this.cleanup.push(() => el.removeEventListener(ev, fn as EventListener));
    };
    on(window, 'keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'KeyQ') {
        e.preventDefault();
        this.specHeld = true;
        this.onSpecialPress?.();
      }
    });
    on(window, 'keyup', (e) => {
      this.keys.delete(e.code);
      if ((e.code === 'Space' || e.code === 'KeyE' || e.code === 'KeyQ') && this.specHeld) {
        this.specHeld = false;
        this.specialQueued = true;
      }
    });
    on(window, 'blur', () => {
      this.keys.clear();
      this.lmb = false;
      this.specHeld = false;
    });
    on(target, 'mousemove', (e) => {
      const r = target.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
      this.hasMouse = true;
    });
    on(target, 'mousedown', (e) => {
      if (e.button === 0) this.lmb = true;
      if (e.button === 2) {
        this.specHeld = true;
        this.onSpecialPress?.();
      }
    });
    on(window, 'mouseup', (e) => {
      if (e.button === 0) this.lmb = false;
      if (e.button === 2 && this.specHeld) {
        this.specHeld = false;
        this.specialQueued = true;
      }
    });
    on(target, 'contextmenu', (e) => e.preventDefault());
  }

  setSettings(s: DesktopSettings): void {
    this.settings = s;
  }

  get specialHeld(): boolean {
    return this.specHeld;
  }
  get aiming(): boolean {
    return true;
  }

  update(_dt: number, f: Fighter, camera: Camera): void {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    const l = Math.hypot(x, y);
    const inp = f.input;
    inp.moveX = l ? x / l : 0;
    inp.moveY = l ? y / l : 0;
    if (this.settings.aimMode === 'mouse' && this.hasMouse) {
      const w = camera.screenToWorld(this.mouseX, this.mouseY);
      const ax = w.x - f.x, ay = w.y - (f.y - 18);
      const al = Math.hypot(ax, ay) || 1;
      inp.aimX = ax / al;
      inp.aimY = ay / al;
      inp.attackHeld = this.settings.autoFire || this.lmb;
    } else {
      inp.aimX = inp.aimY = undefined;
      inp.attackHeld = l > 0 || this.lmb;
    }
    if (this.specialQueued) {
      this.specialQueued = false;
      inp.special = true;
      inp.specialAimX = inp.aimX ?? Math.cos(f.facing);
      inp.specialAimY = inp.aimY ?? Math.sin(f.facing);
    }
  }

  destroy(): void {
    for (const c of this.cleanup) c();
  }
}
