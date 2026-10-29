import { audio } from '../audio/audio';
import { leagueFor } from '../content/progression';
import { store } from '../meta/store';
import { btn, coinIcon, h, num, fill } from './dom';

/**
 * APP — troca de telas.
 * Cada tela é uma função que devolve { el, dispose? }. `app.show()` coloca na
 * frente com transição; `app.page()` cria uma tela padrão com barra de cima
 * (voltar, título, moedas).
 */

export interface Screen {
  el: HTMLElement;
  dispose?: () => void;
}

export class App {
  readonly host: HTMLElement;
  private current: Screen | null = null;
  /** função que reabre o menu (registrada pelo main.ts) */
  home: () => void = () => {};

  constructor(host: HTMLElement) {
    this.host = host;
  }

  show(s: Screen): void {
    const old = this.current;
    this.current = s;
    s.el.classList.add('enter');
    this.host.appendChild(s.el);
    requestAnimationFrame(() => s.el.classList.remove('enter'));
    if (old) {
      old.dispose?.();
      old.el.classList.add('leave');
      setTimeout(() => old.el.remove(), 220);
    }
  }

  /** Tela padrão: barra de cima com voltar + título + moedas; `body` é o conteúdo. */
  page(title: string, body: HTMLElement, opts: { onBack?: () => void; cls?: string; extra?: HTMLElement } = {}): Screen {
    const bar = h(
      'div.topbar',
      null,
      btn(
        '◀',
        'btn-back',
        () => {
          audio.play('ui_back');
          (opts.onBack ?? this.home)();
        },
        { 'aria-label': 'Voltar' },
      ),
      h('h1.page-title', null, title),
      opts.extra ?? null,
      wallet(),
    );
    const el = h(`div.screen.page${opts.cls ? `.${opts.cls}` : ''}`, null, bar, h('div.page-body', null, body));
    return { el };
  }
}

/** Moedas + Isvoid + troféus (se atualiza sozinho quando o perfil muda). */
export function wallet(): HTMLElement {
  const el = h('div.wallet');
  let seen = false;
  const render = () => {
    // saiu da tela? para de escutar
    if (el.isConnected) seen = true;
    else if (seen) return off();
    const p = store.profile;
    if (!p) return;
    const lg = leagueFor(p.trophies);
    fill(
      el,
      h('span.pill.trophy', { title: `Liga ${lg.name}` }, coinIcon('trophy'), num(p.trophies)),
      h('span.pill.moedas', { title: 'Moedas da Morte' }, coinIcon('moedas'), num(p.moedas)),
      h('span.pill.isvoid', { title: 'Isvoid (moeda rara)' }, coinIcon('isvoid'), num(p.isvoid)),
    );
  };
  const off = store.on(render);
  render();
  return el;
}
