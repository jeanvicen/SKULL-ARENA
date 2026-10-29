import { audio } from '../audio/audio';

/**
 * Ajudantes de interface: criar elementos, avisos (toast), janelas (modal),
 * números formatados. Tudo DOM puro, sem framework — fácil de mexer.
 */

type Attrs = Record<string, string | number | boolean | null | undefined | ((e: Event) => void)>;
type Child = Node | string | number | null | undefined | false | Child[];

/** h('div.classe#id', { onclick: fn, title: 'x' }, filhos...) */
export function h<K extends keyof HTMLElementTagNameMap = 'div'>(sel: string, attrs?: Attrs | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(sel);
  const tag = (m?.[1] || 'div') as K;
  const el = document.createElement(tag);
  for (const part of (m?.[2] ?? '').match(/[.#][\w-]+/g) ?? []) {
    if (part[0] === '.') el.classList.add(part.slice(1));
    else el.id = part.slice(1);
  }
  if (attrs)
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v as EventListener);
      else if (k === 'html') el.innerHTML = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  append(el, children);
  return el;
}

function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
}

/** Troca todo o conteúdo de um elemento (aceita null/false/listas, que são ignorados). */
export function fill(el: Element, ...children: Child[]): void {
  el.replaceChildren();
  append(el, children);
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** 12345 → "12.345" */
export function num(n: number): string {
  return Math.round(n).toLocaleString('pt-BR');
}

/** 12345 → "12,3 mil" */
export function short(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace('.', ',')} mi`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1).replace('.', ',')} mil`;
  return num(n);
}

// ------------------------------------------------------------------ toast

let toastHost: HTMLDivElement | null = null;
export function toast(text: string, kind: 'ok' | 'err' | 'info' = 'info', ms = 2600): void {
  if (!toastHost) {
    toastHost = h('div.toasts');
    document.body.appendChild(toastHost);
  }
  const t = h(`div.toast.${kind}`, null, text);
  toastHost.appendChild(t);
  if (kind === 'err') audio.play('ui_error');
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, ms);
}

/** Roda uma ação e mostra o erro bonitinho se der errado. */
export function attempt<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), 'err');
    return undefined;
  }
}

// ------------------------------------------------------------------ modal

export interface ModalHandle {
  el: HTMLDivElement;
  body: HTMLDivElement;
  close: () => void;
}

export function modal(title: string, content: Node | Node[], opts: { wide?: boolean; onClose?: () => void; cls?: string } = {}): ModalHandle {
  audio.play('ui_open');
  const body = h('div.modal-body');
  for (const c of Array.isArray(content) ? content : [content]) body.appendChild(c);
  const closeBtn = h('button.modal-x', { 'aria-label': 'Fechar' }, '✕');
  const box = h(`div.modal.pixel-panel${opts.wide ? '.wide' : ''}${opts.cls ? `.${opts.cls}` : ''}`, null, h('div.modal-head', null, h('h2', null, title), closeBtn), body);
  const el = h('div.modal-bg', null, box);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    audio.play('ui_back');
    el.classList.remove('show');
    setTimeout(() => el.remove(), 180);
    window.removeEventListener('keydown', onKey);
    opts.onClose?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  closeBtn.addEventListener('click', close);
  el.addEventListener('pointerdown', (e) => {
    if (e.target === el) close();
  });
  window.addEventListener('keydown', onKey);
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  return { el, body, close };
}

export function confirmBox(title: string, text: string, ok = 'CONFIRMAR'): Promise<boolean> {
  return new Promise((res) => {
    let answered = false;
    const yes = h('button.btn.btn-yellow', null, ok);
    const no = h('button.btn.btn-dark', null, 'CANCELAR');
    const m = modal(title, [h('p', null, text), h('div.row.end', null, no, yes)], {
      onClose: () => {
        if (!answered) res(false);
      },
    });
    yes.addEventListener('click', () => {
      answered = true;
      res(true);
      m.close();
    });
    no.addEventListener('click', () => m.close());
  });
}

/** Botão com som de clique. */
export function btn(label: string | Node, cls: string, onClick: (e: MouseEvent) => void, attrs: Attrs = {}): HTMLButtonElement {
  const b = h<'button'>(`button.btn.${cls.split(' ').join('.')}`, attrs, label);
  b.addEventListener('click', (e) => {
    audio.play('ui_click');
    onClick(e);
  });
  return b;
}

/** Ícones das moedas (desenhados em CSS pixel, ver styles). */
export function coinIcon(kind: 'moedas' | 'isvoid' | 'trophy' | 'xp'): HTMLSpanElement {
  return h('span.ico.ico-' + kind, { 'aria-hidden': 'true' });
}

export function currency(kind: 'moedas' | 'isvoid', amount: number): HTMLSpanElement {
  return h('span.cur', null, coinIcon(kind), num(amount));
}
