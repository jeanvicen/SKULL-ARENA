import { allCharacters } from '../../content/characters';
import { RARITIES, RARITY, ROLES } from '../../content/rarities';
import type { CharacterDef, RarityId, RoleId } from '../../content/types';
import { store } from '../../meta/store';
import type { App, Screen } from '../app';
import { btn, coinIcon, h, num, fill } from '../dom';
import { portraitCanvas } from '../pixelView';
import { characterScreen } from './character';

/**
 * COLEÇÃO DE PERSONAGENS (500+)
 * Filtros por raridade/função, busca, "só os meus", ordenação.
 * Os retratos são desenhados só quando o card aparece na tela (rápido no celular).
 */

interface Filter {
  rarity: RarityId | 'all';
  role: RoleId | 'all';
  owned: 'all' | 'mine' | 'locked';
  q: string;
  sort: 'rarity' | 'trophies' | 'name' | 'level';
}

let last: Filter = { rarity: 'all', role: 'all', owned: 'all', q: '', sort: 'rarity' };

export function collectionScreen(app: App): Screen {
  const f: Filter = { ...last };
  const grid = h('div.char-grid');
  const count = h('span.count');
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        io.unobserve(el);
        const def = byId.get(el.dataset.id!);
        if (def) el.querySelector('.cc-art')!.appendChild(portraitCanvas(def, 2));
      }
    },
    { rootMargin: '200px' },
  );
  const all = allCharacters();
  const byId = new Map(all.map((c) => [c.id, c]));

  const card = (c: CharacterDef) => {
    const p = store.profile!;
    const oc = p.chars[c.id];
    const r = RARITY[c.rarity];
    const el = h(
      `button.char-card${oc ? '' : '.locked'}${p.selected === c.id ? '.selected' : ''}`,
      { 'data-id': c.id, style: `--rc:${r.color};--rc2:${r.color2}`, title: `${c.name} — ${r.name}` },
      h('div.cc-art'),
      h('div.cc-rar', null, r.badge),
      oc ? h('div.cc-lvl', null, `NV${oc.level}`) : h('div.cc-lock', null, '🔒'),
      h('div.cc-name', null, c.name),
      h(
        'div.cc-foot',
        null,
        h('span', null, ROLES[c.role].icon),
        oc ? h('span.cc-tr', null, coinIcon('trophy'), num(oc.trophies)) : h('span.cc-how', null, c.unlock.kind === 'trophyRoad' ? `🛣️ ${c.unlock.trophies}` : c.unlock.kind === 'chest' ? 'baú' : ''),
      ),
    );
    el.addEventListener('click', () => {
      last = { ...f };
      app.show(characterScreen(app, c.id, () => app.show(collectionScreen(app))));
    });
    io.observe(el);
    return el;
  };

  const render = () => {
    const p = store.profile!;
    const q = f.q.trim().toLowerCase();
    let list = all.filter(
      (c) =>
        (f.rarity === 'all' || c.rarity === f.rarity) &&
        (f.role === 'all' || c.role === f.role) &&
        (f.owned === 'all' || (f.owned === 'mine') === !!p.chars[c.id]) &&
        (!q || c.name.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)),
    );
    list = list.slice().sort((a, b) => {
      if (f.sort === 'name') return a.name.localeCompare(b.name);
      if (f.sort === 'trophies') return (p.chars[b.id]?.trophies ?? -1) - (p.chars[a.id]?.trophies ?? -1);
      if (f.sort === 'level') return (p.chars[b.id]?.level ?? 0) - (p.chars[a.id]?.level ?? 0);
      // raridade: os seus primeiro dentro de cada raridade
      return RARITY[a.rarity].tier - RARITY[b.rarity].tier || (p.chars[b.id] ? 1 : 0) - (p.chars[a.id] ? 1 : 0);
    });
    count.textContent = `${list.length} · você tem ${Object.keys(p.chars).length}/${all.length}`;
    io.disconnect();
    fill(grid, ...list.map(card));
  };

  const search = h<'input'>('input.inp.search', { type: 'search', placeholder: '🔎 Buscar nome…', value: f.q });
  search.addEventListener('input', () => {
    f.q = search.value;
    render();
  });
  const chips = h('div.filter-row');
  const renderChips = () => {
    fill(
      chips,
      ...(['all', ...RARITIES.map((r) => r.id)] as Array<RarityId | 'all'>).map((id) =>
        btn(
          id === 'all' ? 'Todas' : RARITY[id].name,
          `chip${f.rarity === id ? ' active' : ''}`,
          () => {
            f.rarity = id;
            renderChips();
            render();
          },
          id === 'all' ? {} : { style: `--rc:${RARITY[id].color}` },
        ),
      ),
    );
  };
  const roleSel = h<'select'>('select.inp', null, h('option', { value: 'all' }, 'Todas as funções'), ...Object.values(ROLES).map((r) => h('option', { value: r.id }, `${r.icon} ${r.name}`)));
  roleSel.value = f.role;
  roleSel.addEventListener('change', () => {
    f.role = roleSel.value as Filter['role'];
    render();
  });
  const ownSel = h<'select'>('select.inp', null, h('option', { value: 'all' }, 'Todos'), h('option', { value: 'mine' }, 'Só os meus'), h('option', { value: 'locked' }, 'Bloqueados'));
  ownSel.value = f.owned;
  ownSel.addEventListener('change', () => {
    f.owned = ownSel.value as Filter['owned'];
    render();
  });
  const sortSel = h<'select'>(
    'select.inp',
    null,
    h('option', { value: 'rarity' }, 'Ordem: raridade'),
    h('option', { value: 'trophies' }, 'Ordem: troféus'),
    h('option', { value: 'level' }, 'Ordem: nível'),
    h('option', { value: 'name' }, 'Ordem: nome'),
  );
  sortSel.value = f.sort;
  sortSel.addEventListener('change', () => {
    f.sort = sortSel.value as Filter['sort'];
    render();
  });

  renderChips();
  render();
  const body = h('div.collection', null, h('div.coll-tools', null, search, roleSel, ownSel, sortSel, count), chips, grid);
  const s = app.page('PERSONAGENS', body, { cls: 'page-collection' });
  return { el: s.el, dispose: () => io.disconnect() };
}
