import { audio } from '../audio/audio';
import { getCharacter } from '../content/characters';
import { CHEST } from '../content/chests';
import { getPet } from '../content/pets';
import { RARITY } from '../content/rarities';
import type { Reward } from '../content/types';
import type { Gain } from '../meta/economy';
import { rewardText } from '../meta/economy';
import { btn, coinIcon, h, modal, num } from './dom';
import { petIcon, portraitCanvas } from './pixelView';

/** Um "card" visual de um ganho (moedas, personagem, pet, baú...). */
export function gainCard(g: Gain): HTMLElement {
  switch (g.kind) {
    case 'moedas':
    case 'isvoid':
      return h(`div.gain.${g.kind}`, null, h('div.gain-ico', null, coinIcon(g.kind)), h('b', null, `+${num(g.amount)}`), h('small', null, g.kind === 'moedas' ? 'Moedas da Morte' : 'Isvoid'));
    case 'xp':
      return h('div.gain.xp', null, h('div.gain-ico', null, coinIcon('xp')), h('b', null, `+${num(g.amount)}`), h('small', null, 'XP'));
    case 'passXp':
      return h('div.gain.passxp', null, h('div.gain-ico', null, '💀'), h('b', null, `+${num(g.amount)}`), h('small', null, 'XP do Passe'));
    case 'trophies':
      return h(`div.gain.trophies${g.amount < 0 ? '.neg' : ''}`, null, h('div.gain-ico', null, coinIcon('trophy')), h('b', null, `${g.amount > 0 ? '+' : ''}${g.amount}`), h('small', null, 'Troféus'));
    case 'character': {
      const c = getCharacter(g.id);
      const r = RARITY[c.rarity];
      return h(
        'div.gain.char',
        { style: `--rc:${r.color};--rc2:${r.color2}` },
        h('div.gain-portrait', null, portraitCanvas(c, 2)),
        h('b', null, c.name),
        h('small', null, g.isNew ? `NOVO! · ${r.name}` : `Repetido → +${num(g.dupMoedas)} moedas${g.dupIsvoid ? ` +${g.dupIsvoid} Isvoid` : ''}`),
      );
    }
    case 'pet': {
      const p = getPet(g.id);
      if (!p) return h('div');
      const r = RARITY[p.rarity];
      return h(
        'div.gain.pet',
        { style: `--rc:${r.color};--rc2:${r.color2}` },
        h('div.gain-portrait', null, petIcon(p, 2)),
        h('b', null, p.name),
        h('small', null, g.isNew ? `NOVO PET! · ${r.name}` : `Repetido → +${num(g.dupMoedas)} moedas`),
      );
    }
    case 'chest':
      return h(
        'div.gain.chest',
        { style: `--rc:${CHEST[g.id]?.color ?? '#fff'}` },
        h('div.gain-ico', null, '🎁'),
        h('b', null, `${g.count}× ${CHEST[g.id]?.name ?? 'Baú'}`),
        h('small', null, 'guardado em Baús'),
      );
    case 'title':
      return h('div.gain.title', null, h('div.gain-ico', null, '🏷️'), h('b', null, `"${g.text}"`), h('small', null, 'Título novo'));
    case 'level':
      return h('div.gain.level', null, h('div.gain-ico', null, '⬆️'), h('b', null, `Nível ${g.level}`), h('small', null, 'Subiu de nível!'));
  }
}

/** Junta ganhos repetidos (várias moedas viram uma só). */
export function mergeGains(gains: Gain[]): Gain[] {
  const out: Gain[] = [];
  const sum: Partial<Record<'moedas' | 'isvoid' | 'xp' | 'passXp' | 'trophies', number>> = {};
  for (const g of gains) {
    if (g.kind === 'moedas' || g.kind === 'isvoid' || g.kind === 'xp' || g.kind === 'passXp' || g.kind === 'trophies') sum[g.kind] = (sum[g.kind] ?? 0) + g.amount;
    else out.push(g);
  }
  const head: Gain[] = [];
  for (const k of ['moedas', 'isvoid', 'trophies', 'xp', 'passXp'] as const) if (sum[k]) head.push({ kind: k, amount: sum[k]! });
  return [...head, ...out];
}

/** Janela "Você ganhou!" */
export function showGains(title: string, gains: Gain[], onClose?: () => void): void {
  const list = mergeGains(gains);
  if (!list.length) return onClose?.();
  audio.play(list.some((g) => g.kind === 'character' || g.kind === 'pet') ? 'rare_reveal' : 'ui_reward');
  const grid = h('div.gains');
  list.forEach((g, i) => {
    const c = gainCard(g);
    c.style.animationDelay = `${i * 90}ms`;
    grid.appendChild(c);
  });
  const m = modal(
    title,
    [
      grid,
      h(
        'div.row.center',
        null,
        btn('BELEZA!', 'btn-yellow', () => m.close()),
      ),
    ],
    { onClose, cls: 'gains-modal' },
  );
}

/** Linha de prêmio (texto + ícone) pra listas de passe/estrada/missões. */
export function rewardChip(r: Reward): HTMLElement {
  let ico: Node | string = '🎁';
  if (r.kind === 'moedas') ico = coinIcon('moedas');
  else if (r.kind === 'isvoid') ico = coinIcon('isvoid');
  else if (r.kind === 'xp') ico = coinIcon('xp');
  else if (r.kind === 'passXp') ico = '💀';
  else if (r.kind === 'trophies') ico = coinIcon('trophy');
  else if (r.kind === 'character') ico = portraitCanvas(getCharacter(r.id), 1);
  else if (r.kind === 'pet') {
    const p = getPet(r.id);
    if (p) ico = petIcon(p, 1);
  } else if (r.kind === 'randomCharacter' || r.kind === 'randomPet') ico = h('span.rar-dot', { style: `--rc:${RARITY[r.rarity].color}` }, r.kind === 'randomPet' ? '🐾' : '?');
  else if (r.kind === 'title') ico = '🏷️';
  return h('span.reward-chip', null, h('span.rc-ico', null, ico), h('span', null, rewardText(r)));
}
