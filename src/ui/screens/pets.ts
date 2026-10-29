import { audio } from '../../audio/audio';
import { allPets, BODY_PT, describeBonus } from '../../content/pets';
import { RARITIES, RARITY } from '../../content/rarities';
import type { PetDef, RarityId } from '../../content/types';
import { store } from '../../meta/store';
import type { App, Screen } from '../app';
import { btn, h, modal, toast, fill } from '../dom';
import { petIcon, PetView } from '../pixelView';

/** PETS (500+): grade com filtro, busca e detalhes com o pet animado. */
export function petsScreen(app: App): Screen {
  const pets = allPets();
  const grid = h('div.pet-grid');
  const count = h('span.count');
  let rarity: RarityId | 'all' = 'all';
  let mine = false;
  let q = '';
  const io = new IntersectionObserver(
    (es) => {
      for (const e of es) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const pet = pets.find((x) => x.id === (e.target as HTMLElement).dataset.id);
        if (pet) e.target.querySelector('.pc-art')!.appendChild(petIcon(pet, 2));
      }
    },
    { rootMargin: '200px' },
  );

  const open = (pet: PetDef) => {
    const p = store.profile!;
    const r = RARITY[pet.rarity];
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const v = new PetView(pet, Math.max(3, Math.floor((150 * dpr) / 36)));
    v.el.style.width = `${v.el.width / dpr}px`;
    const owned = !!p.pets[pet.id];
    const sel = p.selectedPet === pet.id;
    const m = modal(pet.name, [
      h(
        'div.pet-detail',
        { style: `--rc:${r.color};--rc2:${r.color2}` },
        h('div.pd-stage', null, v.el),
        h(
          'div.pd-info',
          null,
          h('span.tag', { style: `background:${r.color};color:#160d22` }, `${r.name} · ${BODY_PT[pet.body]}`),
          h('p', null, pet.desc),
          h('h4', null, 'BÔNUS'),
          h('ul.bonus', null, ...describeBonus(pet.bonus).map((b) => h('li', null, b))),
          owned
            ? sel
              ? btn('TIRAR PET', 'btn-dark', async () => {
                  await choose(null);
                  m.close();
                })
              : btn('USAR ESTE PET', 'btn-yellow', async () => {
                  await choose(pet.id);
                  m.close();
                })
            : h('div.unlock-how', null, '🔒 Sai nos baús, Drops, Passe e loja diária'),
        ),
      ),
    ]);
  };
  const choose = async (id: string | null) => {
    try {
      await store.run('selectPet', { id });
      audio.play('ui_buy');
      toast(id ? 'Pet escolhido! Ele te segue nas partidas.' : 'Sem pet.', 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    }
  };

  const render = () => {
    const p = store.profile!;
    const ql = q.trim().toLowerCase();
    const list = pets
      .filter((x) => (rarity === 'all' || x.rarity === rarity) && (!mine || p.pets[x.id]) && (!ql || x.name.toLowerCase().includes(ql) || BODY_PT[x.body].toLowerCase().includes(ql)))
      .sort((a, b) => (p.pets[b.id] ? 1 : 0) - (p.pets[a.id] ? 1 : 0) || RARITY[a.rarity].tier - RARITY[b.rarity].tier);
    count.textContent = `${list.length} · você tem ${Object.keys(p.pets).length}/${pets.length}`;
    io.disconnect();
    fill(
      grid,
      ...list.map((pet) => {
        const r = RARITY[pet.rarity];
        const own = !!p.pets[pet.id];
        const el = h(
          `button.pet-card${own ? '' : '.locked'}${p.selectedPet === pet.id ? '.selected' : ''}`,
          { 'data-id': pet.id, style: `--rc:${r.color};--rc2:${r.color2}` },
          h('div.pc-art'),
          h('div.cc-rar', null, r.badge),
          own ? null : h('div.cc-lock', null, '🔒'),
          h('div.cc-name', null, pet.name),
        );
        el.addEventListener('click', () => open(pet));
        io.observe(el);
        return el;
      }),
    );
  };

  const chips = h('div.filter-row');
  const renderChips = () =>
    fill(
      chips,
      ...(['all', ...RARITIES.map((r) => r.id)] as Array<RarityId | 'all'>).map((id) =>
        btn(
          id === 'all' ? 'Todas' : RARITY[id].name,
          `chip${rarity === id ? ' active' : ''}`,
          () => {
            rarity = id;
            renderChips();
            render();
          },
          id === 'all' ? {} : { style: `--rc:${RARITY[id].color}` },
        ),
      ),
      btn(mine ? '✔ Só os meus' : 'Só os meus', `chip${mine ? ' active' : ''}`, () => {
        mine = !mine;
        renderChips();
        render();
      }),
    );
  const search = h<'input'>('input.inp.search', { type: 'search', placeholder: '🔎 Buscar pet…' });
  search.addEventListener('input', () => {
    q = search.value;
    render();
  });
  renderChips();
  render();
  const off = store.on(render);
  const s = app.page('PETS', h('div.collection', null, h('div.coll-tools', null, search, count), chips, grid));
  return {
    el: s.el,
    dispose: () => {
      off();
      io.disconnect();
    },
  };
}
