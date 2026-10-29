import { audio } from '../../audio/audio';
import { getCharacter } from '../../content/characters';
import { CHEST, chestOddsTable, SHOP_CHESTS } from '../../content/chests';
import { activeEvents } from '../../content/events';
import { getPet } from '../../content/pets';
import { RARITY, ROLES } from '../../content/rarities';
import type { ChestDef } from '../../content/types';
import { dailyOffers, type ShopOffer } from '../../meta/economy';
import { dayKey } from '../../meta/profile';
import { store } from '../../meta/store';
import type { App, Screen } from '../app';
import { btn, coinIcon, h, modal, num, toast, fill } from '../dom';
import { petIcon, portraitCanvas } from '../pixelView';
import { showGains } from '../rewards';
import { openChestFlow } from './chestOpen';

/**
 * LOJA: baús (com botão CHANCES mostrando as probabilidades), baús guardados,
 * ofertas do dia (renovam à meia-noite) e troca de moedas por Isvoid.
 * Sem dinheiro real: tudo com moedas ganhas jogando.
 */
export function shopScreen(app: App): Screen {
  const body = h('div.shop');
  const render = () => {
    const p = store.profile!;
    const evChests = activeEvents()
      .map((e) => e.chestId)
      .filter((x): x is string => !!x && !!CHEST[x]);
    const chestIds = [...evChests, ...SHOP_CHESTS];
    const offers = dailyOffers();
    const bought = p.bought.day === dayKey(new Date()) ? p.bought.ids : [];
    const saved = Object.entries(p.chests).filter(([, n]) => n > 0);
    fill(
      body,
      saved.length
        ? h(
            'section.shop-sec',
            null,
            h('h3', null, '📦 SEUS BAÚS'),
            h(
              'div.shop-row',
              null,
              ...saved.map(([id, n]) => {
                const c = CHEST[id]!;
                return chestTile(
                  c,
                  h('b', null, `${n}× guardado`),
                  btn('ABRIR', 'btn-yellow small', () => openChestFlow(app, id, false, () => app.show(shopScreen(app)))),
                );
              }),
            ),
          )
        : null,
      h(
        'section.shop-sec',
        null,
        h('h3', null, '🎁 BAÚS'),
        h(
          'div.shop-row',
          null,
          ...chestIds.map((id) => {
            const c = CHEST[id]!;
            const pr = c.price!;
            return chestTile(
              c,
              btn('CHANCES', 'btn-dark tiny', () => oddsModal(c)),
              btn(h('span', null, coinIcon(pr.currency), num(pr.amount)), 'btn-yellow small', () => openChestFlow(app, id, true, () => app.show(shopScreen(app)))),
            );
          }),
        ),
      ),
      h('section.shop-sec', null, h('h3', null, '⭐ OFERTAS DO DIA ', h('small', null, 'renovam à meia-noite')), h('div.shop-row', null, ...offers.map((o) => offerTile(o, bought.includes(o.id))))),
      h('p.muted.small.center', null, 'SKULL ARENA não vende nada por dinheiro real. Moedas da Morte e Isvoid se ganham jogando.'),
    );
  };

  const offerTile = (o: ShopOffer, done: boolean) => {
    const p = store.profile!;
    let art: HTMLElement;
    let title = '';
    let sub = '';
    let rc = '#ffffff';
    if (o.kind === 'character') {
      const c = getCharacter(o.ref);
      art = portraitCanvas(c, 2);
      title = c.name;
      sub = `${RARITY[c.rarity].name} · ${ROLES[c.role].name}`;
      rc = RARITY[c.rarity].color;
    } else if (o.kind === 'pet') {
      const pet = getPet(o.ref)!;
      art = petIcon(pet, 3);
      title = pet.name;
      sub = `Pet ${RARITY[pet.rarity].name}`;
      rc = RARITY[pet.rarity].color;
    } else {
      art = h('div.big-ico', null, coinIcon('isvoid'));
      title = `${o.amount} Isvoid`;
      sub = 'Troca de moedas';
      rc = '#ff3df2';
    }
    const owned = (o.kind === 'character' && p.chars[o.ref]) || (o.kind === 'pet' && p.pets[o.ref]);
    return h(
      `div.offer${done || owned ? '.done' : ''}`,
      { style: `--rc:${rc}` },
      o.off ? h('div.off', null, `-${o.off}%`) : null,
      h('div.offer-art', null, art),
      h('b', null, title),
      h('small', null, sub),
      done || owned
        ? h('div.done-tag', null, owned ? 'JÁ TEM' : 'COMPRADO')
        : btn(h('span', null, coinIcon(o.currency), num(o.price)), 'btn-yellow small', async () => {
            try {
              const g = await store.run('buyOffer', { offerId: o.id });
              audio.play('ui_buy');
              showGains('COMPRADO!', g);
            } catch (e) {
              toast(e instanceof Error ? e.message : String(e), 'err');
            }
          }),
    );
  };

  render();
  const off = store.on(render);
  const s = app.page('LOJA', body, { cls: 'page-shop' });
  return { el: s.el, dispose: off };
}

function chestTile(c: ChestDef, ...actions: HTMLElement[]): HTMLElement {
  return h('div.chest-tile', { style: `--cc:${c.color};--cg:${c.glow}` }, h('div.chest-mini.big'), h('b', null, c.name), h('small', null, c.desc), h('div.row.center', null, ...actions));
}

export function oddsModal(c: ChestDef): void {
  const rows = chestOddsTable(c);
  const t = h(
    'table.odds',
    null,
    h('tr', null, h('th', null, 'Prêmio (por carta)'), h('th', null, 'Chance')),
    ...rows.map((r) =>
      h(
        'tr',
        null,
        h('td', null, r.label, r.rarity ? h('b', { style: `color:${RARITY[r.rarity].color}` }, ` ${RARITY[r.rarity].name}`) : null),
        h('td', null, `${r.pct < 0.1 ? r.pct.toFixed(3) : r.pct.toFixed(2)}%`),
      ),
    ),
  );
  modal(
    `CHANCES · ${c.name}`,
    [
      h('p', null, `${c.rolls} cartas por baú + ${c.moedas[0]}–${c.moedas[1]} Moedas da Morte garantidas.`),
      c.vicenOdds ? h('p.vicen-odds', null, `VICEN₹ (CREATORs): ${(c.vicenOdds * 100).toFixed(1)}% por abertura.`) : null,
      c.pity
        ? h('p', null, `Garantia: depois de ${c.pity.after} aberturas sem ${RARITY[c.pity.rarity].name}${c.vicenOdds && c.pity.rarity === 'creators' ? ' (Vicen₹)' : ''}, a próxima garante.`)
        : null,
      t,
      h('p.muted.small', null, 'Personagem repetido vira Moedas da Morte (e Isvoid nas raridades altas). Personagens que você ainda não tem têm 4× mais peso no sorteio.'),
    ].filter(Boolean) as HTMLElement[],
  );
}
