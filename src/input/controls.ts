import type { AbilityDef, CharacterDef } from '../content/types';
import { clamp, len } from '../engine/math';
import type { FighterInput } from '../sim/types';

/**
 * CONTROLES
 * ---------
 * Celular (paisagem):
 *   • Esquerda: joystick que nasce onde o dedão encosta → ANDAR.
 *   • Direita: joystick de ATAQUE. Arrasta = mira (mostra a linha), solta = atira.
 *     Toque rápido = mira automática no inimigo mais perto.
 *   • SUPER (amarelo) e HABILIDADES (azuis): mesmo esquema — arrasta pra mirar, solta pra usar.
 * PC: WASD/setas anda · mouse mira · clique atira (segura = rajada) · Q/E/R habilidades · Espaço super.
 */

export interface ControlSettings {
  /** 0.8..1.3 */
  size: number;
  /** 0.3..1 */
  opacity: number;
  /** inverte lados (canhoto) */
  swap: boolean;
  /** vibração */
  vibrate: boolean;
}

export const DEFAULT_CONTROLS: ControlSettings = { size: 1, opacity: 0.85, swap: false, vibrate: true };

interface Stick {
  id: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
  t0: number;
  /** -1 = movimento, 0 = ataque, 1..3 habilidades, 4 = super */
  slot: number;
}

interface Btn {
  el: HTMLDivElement;
  cd: HTMLDivElement;
  label: HTMLSpanElement;
  slot: number;
  cx: number;
  cy: number;
  r: number;
  ability: AbilityDef;
}

export class Controls {
  readonly root: HTMLDivElement;
  private moveBase: HTMLDivElement;
  private moveKnob: HTMLDivElement;
  private aimKnob: HTMLDivElement;
  private atkBtn: Btn;
  private buttons: Btn[] = [];
  private sticks = new Map<number, Stick>();
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, down: false, t0: 0, inside: false };
  private latchedFire = false;
  private latchedAuto = false;
  private latchedSkill = -1;
  private lastAim = { x: 1, y: 0, d: 1 };
  private keyAim: number | null = null;
  usingMouse = false;
  /** posição do jogador na tela (px CSS) — pra mira com mouse */
  playerScreen: () => { x: number; y: number } = () => ({ x: innerWidth / 2, y: innerHeight / 2 });
  /** preview atual (pro renderer) */
  preview: { ability: AbilityDef; kind: 'attack' | 'skill' | 'super'; ax: number; ay: number; ad: number } | null = null;
  enabled = true;
  private holdFireT = 0;

  constructor(
    host: HTMLElement,
    private readonly def: CharacterDef,
    private settings: ControlSettings,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'controls';
    this.root.style.setProperty('--ctl-size', String(settings.size));
    this.root.style.setProperty('--ctl-opacity', String(settings.opacity));
    host.appendChild(this.root);
    this.moveBase = div('stick-base move');
    this.moveKnob = div('stick-knob');
    this.moveBase.appendChild(this.moveKnob);
    this.root.appendChild(this.moveBase);
    this.atkBtn = this.makeButton(0, def.attack, 'atk');
    this.aimKnob = div('stick-knob aim');
    this.atkBtn.el.appendChild(this.aimKnob);
    def.skills.forEach((s, i) => this.buttons.push(this.makeButton(i + 1, s, 'skill')));
    this.buttons.push(this.makeButton(4, def.super, 'super'));
    this.layout();
    this.bind();
  }

  private makeButton(slot: number, ab: AbilityDef, cls: string): Btn {
    const el = div(`cbtn ${cls}`);
    const cd = div('cd');
    const label = document.createElement('span');
    label.className = 'ic';
    label.textContent = slot === 0 ? '' : ab.icon;
    el.append(cd, label);
    if (slot >= 1 && slot <= 3) {
      const k = document.createElement('i');
      k.className = 'key';
      k.textContent = ['Q', 'E', 'R'][slot - 1]!;
      el.appendChild(k);
    }
    if (slot === 4) {
      const k = document.createElement('i');
      k.className = 'key';
      k.textContent = 'ESPAÇO';
      el.appendChild(k);
    }
    this.root.appendChild(el);
    return { el, cd, label, slot, cx: 0, cy: 0, r: 40, ability: ab };
  }

  /** Posiciona botões conforme o tamanho da tela. */
  layout(): void {
    const W = this.root.clientWidth || innerWidth;
    const H = this.root.clientHeight || innerHeight;
    const s = this.settings.size * clamp(Math.min(W, H) / 400, 0.75, 1.25);
    const sw = this.settings.swap;
    const X = (x: number) => (sw ? x : W - x);
    const place = (b: Btn, x: number, y: number, r: number) => {
      b.cx = X(x);
      b.cy = H - y;
      b.r = r;
      b.el.style.left = `${b.cx - r}px`;
      b.el.style.top = `${b.cy - r}px`;
      b.el.style.width = b.el.style.height = `${r * 2}px`;
    };
    place(this.atkBtn, 112 * s, 104 * s, 62 * s);
    const n = this.buttons.length - 1; // sem o super
    const superBtn = this.buttons[this.buttons.length - 1]!;
    place(superBtn, 210 * s, 196 * s, 40 * s);
    const arc: Array<[number, number]> = [
      [230 * s, 70 * s],
      [112 * s, 222 * s],
      [292 * s, 140 * s],
    ];
    for (let i = 0; i < n; i++) place(this.buttons[i]!, arc[i]![0], arc[i]![1], 33 * s);
    this.moveBase.style.width = this.moveBase.style.height = `${130 * s}px`;
    this.moveKnob.style.width = this.moveKnob.style.height = `${58 * s}px`;
    this.aimKnob.style.width = this.aimKnob.style.height = `${50 * s}px`;
    if (!this.sticks.size) this.resetMoveBase();
  }

  private resetMoveBase(): void {
    const W = this.root.clientWidth || innerWidth;
    const H = this.root.clientHeight || innerHeight;
    const s = this.settings.size * clamp(Math.min(W, H) / 400, 0.75, 1.25);
    const x = this.settings.swap ? W - 120 * s : 120 * s;
    this.moveBase.style.left = `${x - 65 * s}px`;
    this.moveBase.style.top = `${H - 115 * s - 65 * s}px`;
    this.moveBase.classList.remove('active');
    this.moveKnob.style.transform = 'translate(-50%, -50%)';
  }

  private bind(): void {
    const r = this.root;
    r.addEventListener('pointerdown', this.onDown, { passive: false });
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    r.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', this.onResize);
  }

  private onResize = () => this.layout();

  dispose(): void {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
    this.root.remove();
  }

  private onBlur = () => {
    this.keys.clear();
    this.sticks.clear();
    this.mouse.down = false;
    this.preview = null;
    this.resetMoveBase();
  };

  private local(e: PointerEvent): { x: number; y: number } {
    const b = this.root.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  }

  private hitButton(x: number, y: number): Btn | null {
    const all = [this.atkBtn, ...this.buttons];
    let best: Btn | null = null;
    let bd = Infinity;
    for (const b of all) {
      const d = len(x - b.cx, y - b.cy);
      const reach = b.slot === 0 ? b.r * 1.55 : b.r * 1.25;
      if (d < reach && d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  private onDown = (e: PointerEvent) => {
    if (!this.enabled) return;
    if (e.pointerType === 'mouse') {
      this.usingMouse = true;
      const p = this.local(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      if (e.button === 0) {
        this.mouse.down = true;
        this.mouse.t0 = performance.now();
        this.holdFireT = 0;
      } else if (e.button === 2) {
        this.latchedSkill = 3;
      }
      e.preventDefault();
      return;
    }
    e.preventDefault();
    this.usingMouse = false;
    const p = this.local(e);
    const W = this.root.clientWidth;
    const btn = this.hitButton(p.x, p.y);
    if (btn) {
      if (btn.slot >= 1 && btn.slot <= 4 && btn.el.classList.contains('locked')) return;
      this.sticks.set(e.pointerId, { id: e.pointerId, ox: btn.cx, oy: btn.cy, x: p.x, y: p.y, t0: performance.now(), slot: btn.slot });
      btn.el.classList.add('pressed');
      return;
    }
    const leftSide = this.settings.swap ? p.x > W * 0.55 : p.x < W * 0.55;
    if (leftSide && ![...this.sticks.values()].some((s) => s.slot === -1)) {
      this.sticks.set(e.pointerId, { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y, t0: performance.now(), slot: -1 });
      const sz = this.moveBase.offsetWidth;
      this.moveBase.style.left = `${p.x - sz / 2}px`;
      this.moveBase.style.top = `${p.y - sz / 2}px`;
      this.moveBase.classList.add('active');
    }
  };

  private onMove = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      const p = this.local(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.usingMouse = true;
      return;
    }
    const s = this.sticks.get(e.pointerId);
    if (!s) return;
    e.preventDefault();
    const p = this.local(e);
    s.x = p.x;
    s.y = p.y;
    const max = s.slot === -1 ? this.moveBase.offsetWidth * 0.42 : 70;
    const dx = s.x - s.ox;
    const dy = s.y - s.oy;
    const d = len(dx, dy);
    const k = d > max ? max / d : 1;
    if (s.slot === -1) this.moveKnob.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
    else if (s.slot === 0) this.aimKnob.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') {
      if (e.button === 0 && this.mouse.down) {
        this.mouse.down = false;
        this.latchedFire = true;
        this.latchedAuto = false;
      }
      return;
    }
    const s = this.sticks.get(e.pointerId);
    if (!s) return;
    this.sticks.delete(e.pointerId);
    if (s.slot === -1) {
      this.resetMoveBase();
      return;
    }
    const all = [this.atkBtn, ...this.buttons];
    const b = all.find((x) => x.slot === s.slot);
    b?.el.classList.remove('pressed');
    if (s.slot === 0) this.aimKnob.style.transform = 'translate(-50%, -50%)';
    const dx = s.x - s.ox;
    const dy = s.y - s.oy;
    const d = len(dx, dy);
    const tap = d < 18;
    const cancel = !tap && b && d < b.r * 0.35 && performance.now() - s.t0 > 350;
    if (cancel) {
      this.preview = null;
      return;
    }
    if (!tap) this.lastAim = { x: dx / d, y: dy / d, d: clamp(d / 80, 0.1, 1) };
    if (s.slot === 0) {
      this.latchedFire = true;
      this.latchedAuto = tap;
    } else {
      this.latchedSkill = s.slot === 4 ? 3 : s.slot - 1;
      this.latchedAuto = tap;
    }
    this.preview = null;
  };

  private onKey = (e: KeyboardEvent) => {
    if (!this.enabled) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'q', 'e', 'r', 'f'].includes(k)) e.preventDefault();
    if (this.keys.has(k)) return;
    this.keys.add(k);
    if (k === 'q' || k === 'e' || k === 'r' || k === 'f') this.keyAim = k === 'f' ? 3 : ['q', 'e', 'r'].indexOf(k);
    if (k === ' ') this.keyAim = 3;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    this.keys.delete(k);
    if ((k === 'q' || k === 'e' || k === 'r' || k === 'f' || k === ' ') && this.keyAim !== null) {
      const want = k === ' ' || k === 'f' ? 3 : ['q', 'e', 'r'].indexOf(k);
      if (want === this.keyAim) {
        this.latchedSkill = want;
        this.latchedAuto = !this.usingMouse;
        this.keyAim = null;
      }
    }
  };

  /** Lê o estado e monta a entrada da simulação (consome os gatilhos). */
  read(dt: number): FighterInput {
    const inp: FighterInput = { mx: 0, my: 0, ax: this.lastAim.x, ay: this.lastAim.y, ad: this.lastAim.d, fire: false, auto: false, skill: -1, aiming: false };
    // movimento
    for (const s of this.sticks.values()) {
      if (s.slot !== -1) continue;
      const max = this.moveBase.offsetWidth * 0.42 || 55;
      const dx = s.x - s.ox;
      const dy = s.y - s.oy;
      const d = len(dx, dy);
      if (d > 6) {
        const m = Math.min(1, d / max);
        inp.mx = (dx / d) * m;
        inp.my = (dy / d) * m;
      }
    }
    let kx = 0;
    let ky = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) kx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) kx += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) ky -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) ky += 1;
    if (kx || ky) {
      const d = len(kx, ky);
      inp.mx = kx / d;
      inp.my = ky / d;
    }
    // mira (sticks de ataque/habilidade)
    this.preview = null;
    for (const s of this.sticks.values()) {
      if (s.slot < 0) continue;
      const dx = s.x - s.ox;
      const dy = s.y - s.oy;
      const d = len(dx, dy);
      if (d > 14) {
        inp.ax = dx / d;
        inp.ay = dy / d;
        inp.ad = clamp(d / 80, 0.1, 1);
        inp.aiming = true;
        const ab = s.slot === 0 ? this.def.attack : s.slot === 4 ? this.def.super : this.def.skills[s.slot - 1]!;
        this.preview = { ability: ab, kind: s.slot === 0 ? 'attack' : s.slot === 4 ? 'super' : 'skill', ax: inp.ax, ay: inp.ay, ad: inp.ad };
      }
    }
    // mouse
    if (this.usingMouse) {
      const p = this.playerScreen();
      const dx = this.mouse.x - p.x;
      const dy = this.mouse.y - p.y;
      const d = len(dx, dy);
      if (d > 4) {
        inp.ax = dx / d;
        inp.ay = dy / d;
        inp.ad = clamp(d / 260, 0.1, 1);
        this.lastAim = { x: inp.ax, y: inp.ay, d: inp.ad };
      }
      if (this.mouse.down || this.keyAim !== null) {
        inp.aiming = true;
        const ab = this.keyAim === null ? this.def.attack : this.keyAim === 3 ? this.def.super : this.def.skills[this.keyAim];
        if (ab) this.preview = { ability: ab, kind: this.keyAim === null ? 'attack' : this.keyAim === 3 ? 'super' : 'skill', ax: inp.ax, ay: inp.ay, ad: inp.ad };
      }
      // segurar o clique = atirar de novo a cada 0,35 s
      if (this.mouse.down) {
        this.holdFireT += dt;
        if (this.holdFireT > 0.35) {
          this.holdFireT = 0.12;
          inp.fire = true;
        }
      }
    } else if (this.keyAim !== null) {
      inp.aiming = true;
    }
    if (this.latchedFire) {
      inp.fire = true;
      inp.auto = this.latchedAuto;
      this.latchedFire = false;
    }
    if (this.latchedSkill >= 0) {
      inp.skill = this.latchedSkill;
      inp.auto = inp.auto || this.latchedAuto;
      this.latchedSkill = -1;
    }
    if (!this.enabled) {
      inp.mx = inp.my = 0;
      inp.fire = false;
      inp.skill = -1;
    }
    return inp;
  }

  /** Atualiza recargas/estado dos botões (chamado pelo HUD a cada frame). */
  updateButtons(cds: number[], superCharge: number, ammo: number, maxAmmo: number, silenced: boolean): void {
    this.def.skills.forEach((s, i) => {
      const b = this.buttons[i]!;
      const cd = cds[i] ?? 0;
      const frac = clamp(cd / (s.cooldown ?? 8), 0, 1);
      b.cd.style.background = frac > 0 ? `conic-gradient(rgba(10,4,20,0.78) ${frac * 360}deg, transparent 0)` : 'transparent';
      b.el.classList.toggle('ready', frac <= 0 && !silenced);
      b.el.dataset.cd = frac > 0 ? String(Math.ceil(cd)) : '';
    });
    const sb = this.buttons[this.buttons.length - 1]!;
    sb.cd.style.background = superCharge < 1 ? `conic-gradient(transparent ${superCharge * 360}deg, rgba(10,4,20,0.72) 0)` : 'transparent';
    sb.el.classList.toggle('ready', superCharge >= 1 && !silenced);
    this.atkBtn.el.classList.toggle('empty', ammo < 1);
    this.atkBtn.el.style.setProperty('--ammo', String(clamp(ammo / maxAmmo, 0, 1)));
  }
}

function div(cls: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = cls;
  return d;
}
