import type { App } from '../app';
import { menuBg, topbar } from '../components';
import { h } from '../dom';

// Provisório: substituído pelas telas completas (loja, baús, eventos, social, config, créditos).
export function registerExtraScreens(app: App): void {
  for (const name of ['shop', 'chests', 'events', 'social', 'settings', 'credits'] as const) {
    app.register(name, (a) => ({ el: h('div', { class: 'screen' }, menuBg(), topbar(a, { back: 'menu', title: name })), back: 'menu' }));
  }
}
