/**
 * Dois PERFIS DE INPUT selecionados em runtime e trocáveis:
 *  - touch:   dispositivos de toque em qualquer orientação. Controles separados para mover, mirar/atacar e especial.
 *  - desktop: WASD/setas movem, MOUSE mira (mira separada do movimento), clique ataca,
 *             botão direito / Espaço / E usa o especial.
 * Em modo "auto", o jogo troca sozinho ao detectar toque ou teclado/mouse.
 */
export type InputProfileKind = 'touch' | 'desktop';
export type InputPreference = 'auto' | InputProfileKind;

export function detectProfile(): InputProfileKind {
  const mm = (q: string) => typeof matchMedia === 'function' && matchMedia(q).matches;
  const fine = mm('(pointer: fine)');
  const hover = mm('(hover: hover)');
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (fine && hover && (!touch || window.innerWidth >= 1024)) return 'desktop';
  return 'touch';
}

type Listener = (p: InputProfileKind) => void;

class InputProfileManager {
  private current: InputProfileKind = 'touch';
  private pref: InputPreference = 'auto';
  private listeners = new Set<Listener>();

  init(pref: InputPreference): void {
    this.pref = pref;
    this.current = pref === 'auto' ? detectProfile() : pref;
    window.addEventListener('touchstart', () => this.hint('touch'), { passive: true, capture: true });
    window.addEventListener('keydown', (e) => {
      const typing = e.target instanceof HTMLInputElement;
      if (!typing && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) this.hint('desktop');
    }, { capture: true });
    window.addEventListener('pointermove', (e) => {
      const mouseCapable = typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
      if (e.pointerType === 'mouse' && mouseCapable && (Math.abs(e.movementX) + Math.abs(e.movementY) > 6)) this.hint('desktop');
    }, { passive: true, capture: true });
  }

  private hint(p: InputProfileKind): void {
    if (this.pref !== 'auto' || p === this.current) return;
    this.current = p;
    for (const l of this.listeners) l(p);
  }

  setPreference(pref: InputPreference): void {
    this.pref = pref;
    const next = pref === 'auto' ? detectProfile() : pref;
    if (next !== this.current) {
      this.current = next;
      for (const l of this.listeners) l(next);
    }
  }

  get profile(): InputProfileKind {
    return this.current;
  }

  onChange(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

export const inputProfile = new InputProfileManager();
