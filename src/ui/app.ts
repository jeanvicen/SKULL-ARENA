import { audio } from '../audio/audio';
import type { ContentDB } from '../content/registry';
import { inputProfile } from '../input/profile';
import type { SaveData } from '../systems/save';
import { SaveStore } from '../systems/save';
import { h, ICON, svg } from './dom';

export type ScreenName =
  | 'loading' | 'login' | 'menu' | 'select' | 'matchmaking' | 'game' | 'results'
  | 'collection' | 'shop' | 'chests' | 'events' | 'social' | 'settings' | 'credits' | 'rooms';

export interface Screen {
  el: HTMLElement;
  destroy?(): void;
  onKey?(e: KeyboardEvent): void;
  /** Tela para onde Esc/voltar leva. */
  back?: ScreenName;
}

export type ScreenFactory = (app: App, params: Record<string, unknown>) => Screen;
export type Transition = 'iris' | 'slash' | 'none';

/**
 * Casca da aplicação: troca de telas com transições animadas, toasts, modais e
 * persistência. A UI de menu nunca toca na simulação de combate diretamente.
 */
export class App {
  save!: SaveData;
  readonly store = new SaveStore();
  readonly layer: HTMLElement;
  private readonly trans: HTMLElement;
  private readonly toasts: HTMLElement;
  private current: { name: ScreenName; screen: Screen } | null = null;
  private factories = new Map<ScreenName, ScreenFactory>();
  private busy = false;
  private onChangeCbs = new Set<() => void>();

  constructor(readonly root: HTMLElement, readonly content: ContentDB) {
    root.innerHTML = '';
    this.layer = h('div', { style: 'position:absolute;inset:0' });
    this.trans = h('div', { class: 'transition' });
    this.toasts = h('div', { class: 'toasts' });
    // O jogo adapta-se à orientação disponível; não bloqueia a partida com um aviso.
    root.append(this.layer, this.trans, this.toasts);
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  register(name: ScreenName, f: ScreenFactory): void {
    this.factories.set(name, f);
  }

  get screenName(): ScreenName | null {
    return this.current?.name ?? null;
  }

  get isDesktop(): boolean {
    return inputProfile.profile === 'desktop';
  }

  /** Avisa a tela aberta que moedas/estado mudaram (atualiza topbar etc.). */
  changed(): void {
    for (const cb of this.onChangeCbs) cb();
  }
  /** Assinatura com escopo de tela: é limpa automaticamente ao trocar de tela. */
  onChange(cb: () => void): () => void {
    this.onChangeCbs.add(cb);
    return () => this.onChangeCbs.delete(cb);
  }

  persist(immediate = false): void {
    this.store.save(this.save, immediate);
    this.changed();
  }

  async go(name: ScreenName, params: Record<string, unknown> = {}, transition: Transition = 'slash'): Promise<void> {
    const f = this.factories.get(name);
    if (!f || this.busy) return;
    this.busy = true;
    try {
      if (this.current && transition !== 'none') await this.cover(transition);
      this.current?.screen.destroy?.();
      this.onChangeCbs.clear();
      this.layer.innerHTML = '';
      const screen = f(this, params);
      screen.el.classList.add('screen-enter');
      this.layer.append(screen.el);
      this.current = { name, screen };
      if (transition !== 'none') await this.reveal(transition);
    } finally {
      this.busy = false;
    }
  }

  private cover(kind: Transition): Promise<void> {
    this.trans.innerHTML = '';
    if (kind === 'iris') {
      const iris = h('div', { class: 'iris' });
      iris.append(svg(ICON.skull, 'tskull'));
      this.trans.append(iris);
    } else {
      this.trans.append(h('div', { class: 'slash' }));
    }
    this.trans.className = 'transition cover';
    return new Promise((r) => setTimeout(r, kind === 'iris' ? 300 : 260));
  }

  private reveal(kind: Transition): Promise<void> {
    this.trans.className = 'transition reveal';
    return new Promise((r) =>
      setTimeout(() => {
        this.trans.className = 'transition';
        this.trans.innerHTML = '';
        r();
      }, kind === 'iris' ? 380 : 320),
    );
  }

  toast(text: string, kind: 'info' | 'good' | 'bad' | 'gold' = 'info', ms = 2200): void {
    const t = h('div', { class: `toast ${kind}` }, text);
    this.toasts.append(t);
    setTimeout(() => {
      t.style.transition = 'opacity 300ms, transform 300ms';
      t.style.opacity = '0';
      t.style.transform = 'translateY(-10px)';
      setTimeout(() => t.remove(), 320);
    }, ms);
  }

  /** Modal genérico. Retorna função para fechar. */
  modal(build: (close: () => void) => HTMLElement, opts: { dismissable?: boolean } = {}): () => void {
    const overlay = h('div', { class: 'overlay' });
    const close = () => {
      overlay.style.transition = 'opacity 160ms';
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 170);
      document.removeEventListener('keydown', esc, true);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && opts.dismissable !== false) {
        e.stopPropagation();
        close();
      }
    };
    overlay.addEventListener('pointerdown', (e) => {
      if (e.target === overlay && opts.dismissable !== false) close();
    });
    document.addEventListener('keydown', esc, true);
    overlay.append(build(close));
    this.root.append(overlay);
    return close;
  }

  confirm(title: string, text: string, okLabel = 'Confirmar', danger = false): Promise<boolean> {
    return new Promise((resolve) => {
      this.modal((close) =>
        h('div', { class: 'panel modal' },
          h('h2', { class: 'stroke' }, title),
          h('p', { style: 'text-align:center;font-weight:700;color:var(--ink2)' }, text),
          h('div', { class: 'actions' },
            h('button', { class: `btn ${danger ? 'red' : 'green'}`, onclick: () => { close(); resolve(true); } }, okLabel),
            h('button', { class: 'btn dark', onclick: () => { close(); resolve(false); } }, 'Cancelar'),
          ),
        ),
      );
    });
  }

  click(): void {
    audio.unlock();
    audio.play('click', 0.7);
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.current) return;
    if (document.querySelector('.overlay')) return;
    this.current.screen.onKey?.(e);
    if (e.defaultPrevented) return;
    if (e.key === 'Escape' && this.current.screen.back) {
      e.preventDefault();
      audio.play('back', 0.6);
      void this.go(this.current.screen.back);
    }
  }
}
