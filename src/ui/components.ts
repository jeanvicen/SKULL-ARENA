import type { CharacterDef, ChestDef, SkinDef } from '../content/types';
import { resolveLook, portraitURL } from '../render/art/skull';
import { darken, lighten } from '../render/art/color';
import { xpToNext } from '../systems/economy';
import type { App, ScreenName } from './app';
import { fmt, h, ICON, svg } from './dom';

export function portraitOf(app: App, def: CharacterDef, skinId = 'default', size = 160): string {
  const skin = skinId !== 'default' ? app.content.skins.get(skinId) ?? null : null;
  return portraitURL(`${def.id}:${skinId}`, resolveLook(def, skin), size);
}

export function menuBg(): HTMLElement {
  // Motivos ornamentais em CSS substituem os emojis de sistema como arte de fundo.
  return h('div', { class: 'menu-bg', 'aria-hidden': 'true' },
    ...Array.from({ length: 6 }, (_, i) => h('div', {
      class: 'floaty rune',
      style: `left:${8 + i * 16}%;top:${10 + ((i * 37) % 70)}%;animation-delay:${-i * 2.3}s;--rune-size:${30 + (i % 3) * 14}px`,
    }, i % 2 ? '✦' : '◇')),
  );
}

export function currencyPill(app: App, kind: 'coins' | 'gems', withPlus = true): HTMLElement {
  const val = h('span', null, fmt(app.save[kind]));
  const pill = h('div', { class: 'pill' }, svg(kind === 'coins' ? ICON.coin : ICON.gem), val,
    withPlus ? h('button', { class: 'plus', 'aria-label': 'Loja', onclick: () => { app.click(); void app.go('shop'); } }, '+') : null);
  app.onChange(() => (val.textContent = fmt(app.save[kind])));
  return pill;
}

export function topbar(app: App, opts: { back?: ScreenName; title?: string } = {}): HTMLElement {
  const s = app.save;
  const bar = h('div', { class: 'topbar' });
  if (opts.back) {
    bar.append(h('button', { class: 'icon-btn', 'aria-label': 'Voltar', onclick: () => { app.click(); void app.go(opts.back!); } }, svg(ICON.back)));
    if (opts.title) bar.append(h('h2', { class: 'stroke', style: 'font-size:24px;margin-left:4px' }, opts.title));
  } else {
    const def = app.content.characters.get(s.selectedCharacter);
    const title = app.content.titles.get(s.player.titleId);
    const xpk = Math.min(1, s.xp / xpToNext(app.content, s.level));
    bar.append(
      h('div', { class: 'player-badge', onclick: () => { app.click(); void app.go('events', { tab: 'perfil' }); } },
        h('div', { class: 'avatar' }, def ? h('img', { src: portraitOf(app, def, s.characters[def.id]?.skin), alt: '' }) : null, h('div', { class: 'lvl-badge' }, String(s.level))),
        h('div', { class: 'player-meta' },
          h('div', { class: 'pname stroke' }, s.player.name),
          h('div', { class: 'ptitle', style: `color:${title?.color ?? '#ccc'}` }, title?.name ?? ''),
          h('div', { class: 'bar xp' }, h('i', { style: `width:${(xpk * 100).toFixed(1)}%` })),
          h('span', { class: 'trophy-mini' }, svg(ICON.trophy), fmt(s.trophies)),
        ),
      ),
    );
  }
  bar.append(h('div', { class: 'spacer' }));
  bar.append(h('div', { class: 'pill trophy', title: 'Troféus' }, svg(ICON.trophy), h('span', { style: 'padding-right:8px' }, fmt(s.trophies))));
  bar.append(currencyPill(app, 'coins'), currencyPill(app, 'gems'));
  return bar;
}

export function rarityTag(app: App, rarityId: CharacterDef['rarity']): HTMLElement {
  const r = app.content.rarity(rarityId);
  return h('span', { class: `rarity-tag${r.glow ? ' glow' : ''}`, style: `--rc:${r.color}` }, r.name);
}

export function charCard(app: App, def: CharacterDef, opts: { selected?: boolean; locked?: boolean; onClick?: () => void; level?: number; skinId?: string } = {}): HTMLElement {
  const r = app.content.rarity(def.rarity);
  const card = h('div', {
    class: `char-card${opts.selected ? ' selected' : ''}${opts.locked ? ' locked' : ''}${r.glow ? ' glow' : ''}${def.rarity === 'creator' ? ' creator' : ''}`,
    style: `--rc:${r.color};--rc2:${r.color2}`,
    onclick: () => { app.click(); opts.onClick?.(); },
    title: def.name,
  },
    h('div', { class: 'inner' },
      h('img', { src: portraitOf(app, def, opts.skinId ?? 'default', 140), alt: def.name, loading: 'lazy' }),
      opts.level ? h('div', { class: 'lvl' }, String(opts.level)) : null,
      opts.locked ? h('div', { style: 'position:absolute;right:4px;top:4px;width:22px;height:22px' }, svg(ICON.lock)) : null,
      h('div', { class: 'name' }, def.name),
    ),
  );
  return card;
}

export function priceLabel(price?: { coins?: number; gems?: number }): HTMLElement {
  if (!price) return h('span', null, '—');
  if (price.gems) return h('span', { class: 'price' }, svg(ICON.gem), fmt(price.gems));
  return h('span', { class: 'price' }, svg(ICON.coin), fmt(price.coins ?? 0));
}

export function notice(text: string | Node, kind: 'warn' | 'info' = 'warn'): HTMLElement {
  return h('div', { class: `notice ${kind === 'info' ? 'info' : ''}` }, svg(kind === 'info' ? ICON.info : ICON.warn), h('div', null, text));
}

export function skinName(app: App, skin: SkinDef): string {
  const tier = { padrao: '', rara: 'Rara', epica: 'Épica', lendaria: 'LENDÁRIA' }[skin.tier];
  void app;
  return tier ? `${skin.name} · ${tier}` : skin.name;
}

/** Desenho procedural de baú (cards da loja/baús e abertura). */
export function drawChest(c: CanvasRenderingContext2D, chest: ChestDef, w: number, h: number, open = 0, shake = 0, t = 0): void {
  c.save();
  c.clearRect(0, 0, w, h);
  c.translate(w / 2 + Math.sin(t * 60) * shake * 6, h * 0.62);
  const s = Math.min(w, h) / 100;
  c.scale(s, s);
  // brilho
  const g = c.createRadialGradient(0, -10, 4, 0, -10, 60);
  g.addColorStop(0, chest.color + 'aa');
  g.addColorStop(1, chest.color + '00');
  c.fillStyle = g;
  c.fillRect(-70, -80, 140, 140);
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.beginPath();
  c.ellipse(0, 30, 40, 8, 0, 0, Math.PI * 2);
  c.fill();
  c.lineJoin = 'round';
  // corpo
  const body = c.createLinearGradient(0, -6, 0, 30);
  body.addColorStop(0, lighten(chest.color2, 0.2));
  body.addColorStop(1, darken(chest.color2, 0.3));
  c.fillStyle = body;
  c.strokeStyle = darken(chest.color2, 0.7);
  c.lineWidth = 3;
  c.beginPath();
  c.roundRect(-36, -4, 72, 34, 6);
  c.fill();
  c.stroke();
  // Face lateral sombreada e filete superior para volume em escala pequena.
  c.fillStyle = darken(chest.color2, 0.45);
  c.beginPath();
  c.moveTo(28, -1); c.lineTo(36, -4); c.lineTo(36, 30); c.lineTo(28, 27);
  c.closePath(); c.fill();
  c.strokeStyle = lighten(chest.color, 0.28); c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(-32, 1); c.lineTo(27, 1); c.stroke();
  // faixas
  c.fillStyle = chest.color;
  c.fillRect(-26, -4, 8, 34);
  c.fillRect(18, -4, 8, 34);
  c.strokeRect(-26, -4, 8, 34);
  c.strokeRect(18, -4, 8, 34);
  // interior brilhando quando abre
  if (open > 0) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    const ig = c.createRadialGradient(0, -6, 2, 0, -6, 50 * open);
    ig.addColorStop(0, '#ffffff');
    ig.addColorStop(0.4, chest.color);
    ig.addColorStop(1, chest.color + '00');
    c.fillStyle = ig;
    c.beginPath();
    c.arc(0, -6, 60 * open, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  // tampa
  c.save();
  c.translate(0, -4);
  c.rotate(-open * 0.9);
  c.translate(0, 4);
  const lid = c.createLinearGradient(0, -34, 0, -4);
  lid.addColorStop(0, lighten(chest.color2, 0.35));
  lid.addColorStop(1, chest.color2);
  c.fillStyle = lid;
  c.beginPath();
  c.moveTo(-38, -4);
  c.quadraticCurveTo(-38, -34, 0, -36);
  c.quadraticCurveTo(38, -34, 38, -4);
  c.closePath();
  c.fill();
  c.stroke();
  c.fillStyle = chest.color;
  c.fillRect(-26, -32, 8, 28);
  c.fillRect(18, -32, 8, 28);
  // Rebites e dobradiça, mantendo a tampa articulada no eixo traseiro.
  c.fillStyle = lighten(chest.color, 0.45);
  for (const x of [-31, 31]) {
    c.beginPath(); c.arc(x, -8, 1.6, 0, Math.PI * 2); c.fill();
  }
  c.strokeStyle = darken(chest.color2, 0.55); c.lineWidth = 2;
  c.beginPath(); c.moveTo(-24, -4); c.lineTo(24, -4); c.stroke();
  // fechadura de caveira
  c.fillStyle = '#ffd84a';
  c.beginPath();
  c.roundRect(-9, -12, 18, 18, 4);
  c.fill();
  c.stroke();
  c.fillStyle = '#3a1f00';
  c.beginPath();
  c.arc(-3.5, -4, 2.2, 0, Math.PI * 2);
  c.arc(3.5, -4, 2.2, 0, Math.PI * 2);
  c.fill();
  c.restore();
  // brilho especular
  c.strokeStyle = 'rgba(255,255,255,0.35)';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(-30, 4);
  c.lineTo(-30, 22);
  c.stroke();
  c.restore();
}
