import { audio } from '../../audio/audio';
import type { MatchRewards, MatchSummary } from '../../systems/economy';
import { xpToNext } from '../../systems/economy';
import type { App, Screen } from '../app';
import { menuBg, notice } from '../components';
import { fmt, h, ICON, svg } from '../dom';
import { Showcase } from '../showcase';

function countUp(el: HTMLElement, to: number, prefix = '', ms = 900): void {
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / ms);
    const v = Math.round(to * (1 - Math.pow(1 - k, 3)));
    el.textContent = `${prefix}${fmt(v)}`;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function resultsScreen(app: App, params: Record<string, unknown>): Screen {
  const sum = params.summary as MatchSummary;
  const rew = params.rewards as MatchRewards;
  const draw = !!params.draw;
  const content = app.content;
  const s = app.save;
  const def = content.characters.get(sum.characterId)!;
  const owned = s.characters[def.id];
  audio.playMusic('menu');

  const cv = h('canvas', { class: 'result-hero' });
  const show = new Showcase(cv);
  show.mode = sum.won ? 'victory' : 'defeat';
  show.set(def, owned?.skin && owned.skin !== 'default' ? content.skins.get(owned.skin) ?? null : null, content.rarity(def.rarity).color);
  show.start();

  const lines = sum.won ? def.voiceLines.victory : def.voiceLines.defeat;
  const line = lines[Math.floor(Math.random() * lines.length)];
  const title = draw ? 'EMPATE' : sum.won ? 'VITÓRIA!' : sum.mode.kind === 'ffa' ? `${sum.placement}º LUGAR` : 'DERROTA';
  const place = sum.mode.kind === 'ffa' ? `${sum.placement}º de ${sum.players} · ${sum.mode.name}` : sum.mode.name;

  const xpN = h('div', { class: 'n' }, '0');
  const coinN = h('div', { class: 'n' }, '0');
  const trN = h('div', { class: 'n' }, '0');
  const xpFill = h('i', { style: 'width:0%' });
  setTimeout(() => {
    countUp(xpN, rew.xp, '+');
    countUp(coinN, rew.coins, '+');
    trN.textContent = `${rew.trophies >= 0 ? '+' : ''}${rew.trophies}`;
    xpFill.style.width = `${Math.min(100, (s.xp / xpToNext(content, s.level)) * 100)}%`;
    audio.play('coin', 0.7);
  }, 500);

  const levelUps = rew.levelUps;
  const el = h('div', { class: 'screen' }, menuBg(),
    h('div', { class: 'results' },
      h('div', { class: `result-title stroke ${sum.won ? 'win' : 'lose'}` }, title),
      h('div', { class: 'placement' }, place),
      h('div', { style: 'position:relative' }, cv, h('div', { class: 'voice-bubble', style: 'top:-6px;left:50%;right:auto;transform:translateX(-50%);white-space:nowrap' }, `“${line}”`)),
      h('div', { class: 'stats-row' },
        h('div', null, String(sum.kills), h('small', null, 'Abates')),
        h('div', null, fmt(sum.damage), h('small', null, 'Dano')),
        h('div', null, fmt(sum.healing), h('small', null, 'Cura')),
        h('div', null, String(sum.specials), h('small', null, 'Especiais')),
      ),
      h('div', { class: 'reward-row' },
        h('div', { class: 'reward', style: 'animation-delay:.2s' }, svg(ICON.star), xpN, h('div', { class: 'l' }, 'XP')),
        h('div', { class: 'reward', style: 'animation-delay:.3s' }, svg(ICON.coin), coinN, h('div', { class: 'l' }, 'Moedas')),
        h('div', { class: 'reward', style: 'animation-delay:.4s' }, svg(ICON.trophy), trN, h('div', { class: 'l' }, 'Troféus')),
      ),
      h('div', { style: 'width:min(420px,100%)' },
        h('div', { class: 'display', style: 'display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px' }, h('span', null, `Nível ${s.level}`), h('span', { class: 'muted' }, `${fmt(s.xp)}/${fmt(xpToNext(content, s.level))} XP`)),
        h('div', { class: 'bar xp' }, xpFill)),
      rew.bonusChest ? h('div', { style: 'width:min(420px,100%)' }, notice(`Sorte de partida offline: você ganhou um ${content.chests.get(rew.bonusChest)?.name}!`, 'info')) : null,
      h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:10px;width:min(420px,100%);margin-top:6px' },
        h('button', { class: 'btn dark', onclick: () => { app.click(); void app.go('menu'); } }, 'Menu'),
        h('button', { class: 'btn pink', onclick: () => { app.click(); void app.go('select', { prematch: true, modeId: sum.mode.id }); } }, 'Jogar de novo'),
      ),
      h('div', { class: 'small muted', style: 'text-align:center;max-width:420px;font-weight:700' }, 'Partida offline contra bots. Recompensas salvas neste aparelho.'),
    ),
  );

  if (levelUps.length) {
    setTimeout(() => {
      audio.play('level_up');
      const last = levelUps[levelUps.length - 1];
      app.modal((close) => h('div', { class: 'panel modal', style: 'text-align:center' },
        h('div', { style: 'font-size:64px;animation:bob 1.2s infinite' }, '⭐'),
        h('h2', { class: 'stroke' }, `NÍVEL ${last.level}!`),
        h('p', { style: 'font-weight:800;color:var(--ink2)' }, 'Recompensas:',
          ...levelUps.map((l) => h('div', null, `+${l.reward.coins ?? 0} moedas · +${l.reward.gems ?? 0} diamantes${l.reward.chest ? ` · ${content.chests.get(l.reward.chest)?.name}` : ''}`))),
        h('div', { class: 'actions' }, h('button', { class: 'btn gold', onclick: close }, 'Uhuul!'))));
    }, 1400);
  }
  audio.play(sum.won ? 'victory' : 'defeat', 0.6);
  return { el, back: 'menu', destroy: () => show.stop(), onKey: (e) => { if (e.key === 'Enter') void app.go('select', { prematch: true, modeId: sum.mode.id }); } };
}
