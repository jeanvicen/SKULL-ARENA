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
  private joyId = -1;
  private specId = -1;
  private baseX = 0;
  private baseY = 0;
  private restX = 0;
  private restY = 0;
  private rawX = 0;
  private rawY = 0;
  private outX = 0;
  private outY = 0;
  private active = false;
  private specialQueued = false;
  private specHeld = false;
  private specStartX = 0;
  private specStartY = 0;
  private readonly cleanup: Array<() => void> = [];

  constructor(
    private readonly zone: HTMLElement,
    private readonly base: HTMLElement,
    private readonly knob: HTMLElement,
    private readonly specialBtn: HTMLElement,
    private settings: TouchSettings,
    private readonly onSpecialPress?: () => void,
  ) {
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, ev: K, fn: (e: HTMLElementEventMap[K]) => void) => {
      el.addEventListener(ev, fn as EventListener, { passive: false });
      this.cleanup.push(() => el.removeEventListener(ev, fn as EventListener));
    };
    on(zone, 'pointerdown', (e) => this.joyDown(e));
    on(specialBtn, 'pointerdown', (e) => this.specDown(e));
    on(window, 'pointermove', (e) => this.move(e));
    on(window, 'pointerup', (e) => this.up(e));
    on(window, 'pointercancel', (e) => this.up(e, true));
    this.layoutRest();
    const ro = new ResizeObserver(() => this.layoutRest());
    ro.observe(zone);
    this.cleanup.push(() => ro.disconnect());
  }

  setSettings(s: TouchSettings): void {
    this.settings = s;
    this.layoutRest();
  }

  get specialHeld(): boolean {
    return this.specHeld;
  }
  get aiming(): boolean {
    return this.active;
  }

  private layoutRest(): void {
    const r = this.zone.getBoundingClientRect();
    this.restX = r.width / 2;
    this.restY = r.height / 2;
    const size = this.settings.radius * 2;
    this.base.style.width = this.base.style.height = `${size}px`;
    this.knob.style.width = this.knob.style.height = `${Math.round(size * 0.46)}px`;
    if (!this.active) this.placeBase(this.restX, this.restY);
  }

  private placeBase(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
    this.base.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    this.knob.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  }

  private joyDown(e: PointerEvent): void {
    if (this.joyId !== -1) return;
    e.preventDefault();
    this.joyId = e.pointerId;
    const r = this.zone.getBoundingClientRect();
    const lx = e.clientX - r.left, ly = e.clientY - r.top;
    if (this.settings.floating) {
      const R = this.settings.radius;
      this.placeBase(clamp(lx, R * 0.6, r.width - R * 0.6), clamp(ly, R * 0.6, r.height - R * 0.6));
    }
    this.active = true;
    this.base.classList.add('active');
    this.updateRaw(lx, ly);
  }

  private specDown(e: PointerEvent): void {
    if (this.specId !== -1) return;
    e.preventDefault();
    e.stopPropagation();
    this.specId = e.pointerId;
    this.specHeld = true;
    this.specStartX = e.clientX;
    this.specStartY = e.clientY;
    this.specialBtn.classList.add('pressed');
    this.onSpecialPress?.();
  }

  private move(e: PointerEvent): void {
    if (e.pointerId === this.joyId) {
      e.preventDefault();
      const r = this.zone.getBoundingClientRect();
      this.updateRaw(e.clientX - r.left, e.clientY - r.top);
    } else if (e.pointerId === this.specId) {
      const br = this.specialBtn.getBoundingClientRect();
      const far = Math.hypot(e.clientX - this.specStartX, e.clientY - this.specStartY) > br.width * 1.2;
      this.specialBtn.classList.toggle('cancel', far);
    }
  }

  private up(e: PointerEvent, cancel = false): void {
    if (e.pointerId === this.joyId) {
      this.joyId = -1;
      this.active = false;
      this.rawX = this.rawY = 0;
      this.base.classList.remove('active');
      this.placeBase(this.settings.floating ? this.restX : this.baseX, this.settings.floating ? this.restY : this.baseY);
    } else if (e.pointerId === this.specId) {
      const br = this.specialBtn.getBoundingClientRect();
      const far = Math.hypot(e.clientX - this.specStartX, e.clientY - this.specStartY) > br.width * 1.2;
      if (!cancel && !far) this.specialQueued = true;
      this.specId = -1;
      this.specHeld = false;
      this.specialBtn.classList.remove('pressed', 'cancel');
    }
  }

  private updateRaw(lx: number, ly: number): void {
    const R = this.settings.radius;
    let dx = lx - this.baseX, dy = ly - this.baseY;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    this.knob.style.transform = `translate(${this.baseX + dx}px, ${this.baseY + dy}px) translate(-50%, -50%)`;
    const mag = Math.min(1, d / R);
    const dz = this.settings.deadZone;
    if (mag < dz || d < 1) {
      this.rawX = this.rawY = 0;
      return;
    }
    // Remapeia: além da dead zone a velocidade cresce rápido e satura em 75% do curso
    const m = Math.min(1, (mag - dz) / (0.75 - dz));
    this.rawX = (dx / d) * m;
    this.rawY = (dy / d) * m;
  }

  update(dt: number, f: Fighter): void {
    // Suavização exponencial curta (tira tremido do dedo sem atrasar a resposta)
    const tau = 0.012 + this.settings.smoothing * 0.05;
    const k = 1 - Math.exp(-dt / tau);
    this.outX += (this.rawX - this.outX) * k;
    this.outY += (this.rawY - this.outY) * k;
    if (!this.active) {
      this.outX = this.outY = 0;
    }
    const inp = f.input;
    inp.moveX = this.outX;
    inp.moveY = this.outY;
    inp.aimX = inp.aimY = undefined;
    // Joystick ativo (além da dead zone) = intenção de atacar na direção do movimento
    inp.attackHeld = this.active && (this.rawX !== 0 || this.rawY !== 0);
    if (this.specialQueued) {
      this.specialQueued = false;
      inp.special = true;
      inp.specialAimX = Math.cos(f.facing);
      inp.specialAimY = Math.sin(f.facing);
    }
  }

  destroy(): void {
    for (const c of this.cleanup) c();
  }
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
