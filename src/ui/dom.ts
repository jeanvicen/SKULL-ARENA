/** Mini helper de DOM (sem framework — rápido e leve no celular). */
type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; style?: string; html?: string };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k === 'html') el.innerHTML = String(v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k === 'dataset' && typeof v === 'object') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function svg(markup: string, cls = ''): HTMLElement {
  const span = document.createElement('span');
  span.style.display = 'contents';
  span.innerHTML = markup.replace('<svg', `<svg class="${cls}" aria-hidden="true"`);
  return span;
}

export const fmt = (n: number): string => Math.round(n).toLocaleString('pt-BR');

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Ícones cartoon (SVG inline, multicoloridos). */
export const ICON = {
  coin: `<svg viewBox="0 0 32 32"><circle cx="16" cy="17" r="13" fill="#b06a00"/><circle cx="16" cy="15" r="13" fill="#ffc21a"/><circle cx="16" cy="15" r="9.5" fill="#ffdb5c" stroke="#e09b1a" stroke-width="2"/><path d="M11 14.5a5 5 0 0 1 10 0c0 2-1 3-2 3.6V20h-6v-1.9c-1-.6-2-1.6-2-3.6z" fill="#b06a00"/><circle cx="14" cy="14.5" r="1.4" fill="#ffdb5c"/><circle cx="18" cy="14.5" r="1.4" fill="#ffdb5c"/><path d="M8 9a10 10 0 0 1 6-3" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/></svg>`,
  gem: `<svg viewBox="0 0 32 32"><path d="M16 29 3 12l5-7h16l5 7z" fill="#0aa3c2"/><path d="M16 27 4 12l4.5-6h15L28 12z" fill="#3df2ff"/><path d="M4 12h24L16 27z" fill="#14c9e6"/><path d="M8.5 6 12 12l4-6 4 6 3.5-6" fill="none" stroke="#bffaff" stroke-width="1.5"/><path d="M12 12l4 15 4-15" fill="none" stroke="#0b8aa6" stroke-width="1.2"/><path d="M9 8l2 3" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`,
  trophy: `<svg viewBox="0 0 32 32"><path d="M8 4h16v8a8 8 0 0 1-16 0z" fill="#ffc21a" stroke="#8a5a00" stroke-width="2"/><path d="M8 7H4v2a5 5 0 0 0 5 5M24 7h4v2a5 5 0 0 1-5 5" fill="none" stroke="#8a5a00" stroke-width="2"/><path d="M13 20h6v4h-6z" fill="#e09b1a"/><rect x="9" y="24" width="14" height="5" rx="2" fill="#7a3fff" stroke="#3a1480" stroke-width="2"/><circle cx="13.5" cy="10" r="1.6" fill="#8a5a00"/><circle cx="18.5" cy="10" r="1.6" fill="#8a5a00"/><path d="M11 6l2 2" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/></svg>`,
  chest: `<svg viewBox="0 0 32 32"><rect x="4" y="13" width="24" height="14" rx="3" fill="#9b6a3a" stroke="#3a1f0c" stroke-width="2"/><path d="M4 14a12 8 0 0 1 24 0z" fill="#b87a40" stroke="#3a1f0c" stroke-width="2"/><rect x="13" y="12" width="6" height="8" rx="1.5" fill="#ffc21a" stroke="#6b3f00" stroke-width="1.5"/><path d="M4 18h24" stroke="#3a1f0c" stroke-width="2"/><circle cx="16" cy="16" r="1.3" fill="#3a1f0c"/></svg>`,
  shop: `<svg viewBox="0 0 32 32"><path d="M5 12h22l-2 15H7z" fill="#ff2d95" stroke="#6b0040" stroke-width="2"/><path d="M11 12V9a5 5 0 0 1 10 0v3" fill="none" stroke="#fff" stroke-width="2.5"/><circle cx="12.5" cy="18" r="1.6" fill="#fff"/><circle cx="19.5" cy="18" r="1.6" fill="#fff"/><path d="M12 22.5q4 3 8 0" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`,
  cards: `<svg viewBox="0 0 32 32"><rect x="4" y="7" width="15" height="20" rx="3" fill="#5a2fb0" stroke="#22104a" stroke-width="2" transform="rotate(-10 11 17)"/><rect x="13" y="5" width="15" height="20" rx="3" fill="#9d5cff" stroke="#22104a" stroke-width="2"/><circle cx="20.5" cy="13" r="4.5" fill="#f3ead8"/><circle cx="19" cy="13" r="1.2" fill="#22104a"/><circle cx="22" cy="13" r="1.2" fill="#22104a"/><rect x="18" y="17" width="5" height="2.5" rx="1" fill="#f3ead8"/></svg>`,
  events: `<svg viewBox="0 0 32 32"><rect x="4" y="7" width="24" height="21" rx="4" fill="#ff9a2e" stroke="#6b2a00" stroke-width="2"/><rect x="4" y="7" width="24" height="7" rx="3" fill="#ff5a1f"/><path d="M10 4v6M22 4v6" stroke="#6b2a00" stroke-width="2.5" stroke-linecap="round"/><path d="M16 15.5l1.8 3.6 4 .6-2.9 2.8.7 4L16 24.6l-3.6 1.9.7-4-2.9-2.8 4-.6z" fill="#fff3a6"/></svg>`,
  social: `<svg viewBox="0 0 32 32"><circle cx="11" cy="12" r="5.5" fill="#3df2ff" stroke="#05475a" stroke-width="2"/><circle cx="22" cy="13" r="4.5" fill="#9d5cff" stroke="#22104a" stroke-width="2"/><path d="M2.5 27a8.5 8 0 0 1 17 0z" fill="#3df2ff" stroke="#05475a" stroke-width="2"/><path d="M16 27a7 7 0 0 1 14 0z" fill="#9d5cff" stroke="#22104a" stroke-width="2"/></svg>`,
  gear: `<svg viewBox="0 0 32 32"><path d="M14 3h4l.8 3.4 2.6 1.1 3-1.8 2.8 2.8-1.8 3 1.1 2.6L29 14v4l-3.4.8-1.1 2.6 1.8 3-2.8 2.8-3-1.8-2.6 1.1L18 29h-4l-.8-3.4-2.6-1.1-3 1.8-2.8-2.8 1.8-3-1.1-2.6L3 18v-4l3.4-.8 1.1-2.6-1.8-3 2.8-2.8 3 1.8 2.6-1.1z" fill="#b9a8d6" stroke="#2a1450" stroke-width="2"/><circle cx="16" cy="16" r="4.5" fill="#2a1450"/></svg>`,
  play: `<svg viewBox="0 0 32 32"><path d="M9 5l18 11L9 27z" fill="#fff"/></svg>`,
  back: `<svg viewBox="0 0 32 32"><path d="M20 5 9 16l11 11" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  close: `<svg viewBox="0 0 32 32"><path d="M8 8l16 16M24 8 8 24" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>`,
  pause: `<svg viewBox="0 0 32 32"><rect x="8" y="6" width="6" height="20" rx="2" fill="#fff"/><rect x="18" y="6" width="6" height="20" rx="2" fill="#fff"/></svg>`,
  lock: `<svg viewBox="0 0 32 32"><rect x="6" y="14" width="20" height="14" rx="3" fill="#b9a8d6" stroke="#2a1450" stroke-width="2"/><path d="M10 14v-3a6 6 0 0 1 12 0v3" fill="none" stroke="#b9a8d6" stroke-width="3.5"/><circle cx="16" cy="21" r="2.4" fill="#2a1450"/></svg>`,
  info: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="3"/><path d="M16 14v9" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><circle cx="16" cy="9.5" r="2.2" fill="currentColor"/></svg>`,
  warn: `<svg viewBox="0 0 32 32"><path d="M16 3 30 28H2z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M16 12v8" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><circle cx="16" cy="24" r="2" fill="currentColor"/></svg>`,
  skull: `<svg viewBox="0 0 32 32"><path d="M16 3C9 3 4.5 8 4.5 14c0 4 2 6.5 4.5 8v4h14v-4c2.5-1.5 4.5-4 4.5-8C27.5 8 23 3 16 3z" fill="#f3ead8" stroke="#2a1450" stroke-width="2"/><ellipse cx="11.2" cy="15" rx="3.2" ry="3.6" fill="#2a1450"/><ellipse cx="20.8" cy="15" rx="3.2" ry="3.6" fill="#2a1450"/><path d="M16 18.5l-1.6 2.8h3.2z" fill="#2a1450"/><path d="M12 26v-3M16 26v-3M20 26v-3" stroke="#2a1450" stroke-width="1.8"/></svg>`,
  swords: `<svg viewBox="0 0 32 32"><path d="M5 5l15 15M27 5 12 20" stroke="#dfe6f5" stroke-width="3.5" stroke-linecap="round"/><path d="M18 22l4 4M14 22l-4 4M21 18l4 0M11 18H7" stroke="#ffc21a" stroke-width="3.5" stroke-linecap="round"/></svg>`,
  team: `<svg viewBox="0 0 32 32"><circle cx="9" cy="11" r="4" fill="#6fc2ff"/><circle cx="16" cy="9" r="4.5" fill="#6fc2ff"/><circle cx="23" cy="11" r="4" fill="#6fc2ff"/><path d="M2 25a7 6 0 0 1 14 0zM16 25a7 6 0 0 1 14 0z" fill="#4fa3e0"/><path d="M8 25a8 7 0 0 1 16 0z" fill="#6fc2ff"/></svg>`,
  crown: `<svg viewBox="0 0 32 32"><path d="M4 24 3 9l7 6 6-9 6 9 7-6-1 15z" fill="#ffc21a" stroke="#8a5a00" stroke-width="2" stroke-linejoin="round"/><rect x="4" y="24" width="24" height="4" rx="1.5" fill="#e09b1a" stroke="#8a5a00" stroke-width="2"/><circle cx="16" cy="18" r="2.2" fill="#ff2d95"/></svg>`,
  door: `<svg viewBox="0 0 32 32"><rect x="7" y="4" width="18" height="25" rx="3" fill="#9d5cff" stroke="#22104a" stroke-width="2"/><circle cx="20.5" cy="17" r="1.8" fill="#ffc21a"/><path d="M11 9h10M11 13h10" stroke="#22104a" stroke-width="2"/></svg>`,
  star: `<svg viewBox="0 0 32 32"><path d="M16 3l3.9 8 8.8 1.2-6.4 6.1 1.6 8.7L16 22.8 8.1 27l1.6-8.7-6.4-6.1 8.8-1.2z" fill="#ffd84a" stroke="#8a5a00" stroke-width="2" stroke-linejoin="round"/></svg>`,
  check: `<svg viewBox="0 0 32 32"><path d="M6 17l7 7 13-15" fill="none" stroke="#5cff9d" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  gift: `<svg viewBox="0 0 32 32"><rect x="4" y="12" width="24" height="16" rx="3" fill="#ff2d95" stroke="#6b0040" stroke-width="2"/><rect x="3" y="9" width="26" height="6" rx="2" fill="#ff5fb0" stroke="#6b0040" stroke-width="2"/><path d="M16 9v19" stroke="#ffd84a" stroke-width="4"/><path d="M16 9c-3-6-9-4-6 0M16 9c3-6 9-4 6 0" fill="none" stroke="#ffd84a" stroke-width="2.5"/></svg>`,
  medal: `<svg viewBox="0 0 32 32"><path d="M10 3h4l3 9h-4zM22 3h-4l-3 9h4z" fill="#ff2d95"/><circle cx="16" cy="20" r="9" fill="#ffc21a" stroke="#8a5a00" stroke-width="2"/><path d="M16 15l1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5z" fill="#fff3a6"/></svg>`,
};

/** Ícone por tipo de especial (para o botão do HUD e fichas). */
export const ABILITY_ICON: Record<string, string> = {
  dash: `<svg viewBox="0 0 32 32"><path d="M4 10h12M2 16h16M4 22h12" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/><path d="M16 6l12 10-12 10z" fill="#fff"/></svg>`,
  aoe_burst: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="6" fill="#fff"/><path d="M16 2v6M16 24v6M2 16h6M24 16h6M6 6l4 4M22 22l4 4M26 6l-4 4M6 26l4-4" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`,
  shield: `<svg viewBox="0 0 32 32"><path d="M16 3l11 4v8c0 7-5 12-11 14C10 27 5 22 5 15V7z" fill="#fff"/><path d="M16 8v16M10 14h12" stroke="#5a2fb0" stroke-width="3"/></svg>`,
  heal: `<svg viewBox="0 0 32 32"><path d="M12 4h8v8h8v8h-8v8h-8v-8H4v-8h8z" fill="#fff"/></svg>`,
  summon: `<svg viewBox="0 0 32 32"><circle cx="9" cy="12" r="5" fill="#fff"/><circle cx="23" cy="12" r="5" fill="#fff"/><circle cx="16" cy="19" r="6" fill="#fff"/><circle cx="14" cy="18.5" r="1.4" fill="#2a1450"/><circle cx="18" cy="18.5" r="1.4" fill="#2a1450"/></svg>`,
  buff: `<svg viewBox="0 0 32 32"><path d="M18 2 6 18h8l-2 12 12-16h-8z" fill="#fff"/></svg>`,
  debuff: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="none" stroke="#fff" stroke-width="3"/><circle cx="16" cy="16" r="6" fill="none" stroke="#fff" stroke-width="3"/><circle cx="16" cy="16" r="2" fill="#fff"/></svg>`,
  teleport: `<svg viewBox="0 0 32 32"><path d="M16 2l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="#fff"/></svg>`,
  trap: `<svg viewBox="0 0 32 32"><ellipse cx="16" cy="22" rx="12" ry="6" fill="#fff" opacity=".5"/><path d="M8 22l3-12 3 10 2-14 2 14 3-10 3 12" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></svg>`,
  beam: `<svg viewBox="0 0 32 32"><circle cx="7" cy="16" r="5" fill="#fff"/><rect x="10" y="12" width="20" height="8" rx="4" fill="#fff" opacity=".85"/></svg>`,
  transform: `<svg viewBox="0 0 32 32"><path d="M16 2l4 9 10 1-7.5 6.5L25 28l-9-5-9 5 2.5-9.5L2 12l10-1z" fill="#fff"/></svg>`,
  multi_shot: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="4" fill="#fff"/><circle cx="16" cy="5" r="3" fill="#fff"/><circle cx="16" cy="27" r="3" fill="#fff"/><circle cx="5" cy="16" r="3" fill="#fff"/><circle cx="27" cy="16" r="3" fill="#fff"/><circle cx="16" cy="16" r="11" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="4 4"/></svg>`,
  zone: `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="#fff" opacity=".35"/><circle cx="16" cy="16" r="12" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="5 4"/><circle cx="12" cy="14" r="2.5" fill="#fff"/><circle cx="19" cy="18" r="3" fill="#fff"/></svg>`,
  pull: `<svg viewBox="0 0 32 32"><path d="M16 16m-11 0a11 11 0 1 0 22 0a11 11 0 1 0-22 0" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="3 4"/><path d="M4 16h7M28 16h-7M16 4v7M16 28v-7" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="16" cy="16" r="3.5" fill="#fff"/></svg>`,
};

export const MODE_ICON: Record<string, string> = {
  skull: ICON.skull,
  swords: ICON.swords,
  team: ICON.team,
  crown: ICON.crown,
  door: ICON.door,
};
