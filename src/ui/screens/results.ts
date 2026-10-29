import { audio } from '../../audio/audio';
import { RARITY } from '../../content/rarities';
import { leagueFor } from '../../content/progression';
import type { MatchRewards, MatchSummary } from '../../meta/economy';
import { store } from '../../meta/store';
import type { Fighter } from '../../sim/types';
import type { World } from '../../sim/world';
import type { App, Screen } from '../app';
import { btn, coinIcon, esc, h, num, short, toast, fill } from '../dom';
import { CharView } from '../pixelView';
import { gainCard } from '../rewards';

/**
 * RESULTADO DA PARTIDA: vitória/derrota, suas estatísticas, prêmios contando,
 * missões que andaram, placar com todo mundo (BOTs identificados).
 */
export function resultsScreen(app: App, s: MatchSummary, w: World, me: Fighter, again: () => void): Screen {
  const res = s.win === null ? 'draw' : s.win ? 'win' : 'lose';
  const ffa = w.mode.teams === 0;
  const head = ffa ? `${s.placement}º LUGAR` : res === 'win' ? 'VITÓRIA!' : res === 'lose' ? 'DERROTA' : 'EMPATE';
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const scale = Math.max(2, Math.floor((window.innerHeight * dpr * 0.42) / 84));
  const view = new CharView(me.def, scale, { state: res === 'win' || (ffa && s.placement <= 3) ? 'victory' : 'defeat', pet: me.pet });
  view.el.style.width = `${view.el.width / dpr}px`;

  const st = me.stats;
  const statRow = (label: string, v: string | number, best = false) => h(`div.stat${best ? '.best' : ''}`, null, h('span', null, label), h('b', null, typeof v === 'number' ? num(v) : v));
  const stats = h(
    'div.res-stats',
    null,
    statRow('Eliminações', st.kills),
    statRow('Mortes', st.deaths),
    statRow('Assistências', st.assists),
    statRow('Dano', Math.round(st.damage)),
    statRow('Cura', Math.round(st.healed)),
    w.mode.skullPickup ? statRow('Caveiras', st.skulls) : null,
    statRow('Maior sequência', st.bestStreak),
    statRow('Supers', st.supers),
  );

  const rewardsBox = h('div.res-rewards', null, h('div.loading-dots', null, 'calculando prêmios'));
  const missionsBox = h('div.res-missions');
  const dropBox = h('div.res-drop');

  // placar
  const board = h('div.res-board');
  const rows = w.fighters
    .filter((f) => f !== w.boss)
    .slice()
    .sort((a, b) => (ffa ? w.placement(a) - w.placement(b) : a.team - b.team || b.stats.kills - a.stats.kills));
  let lastTeam = -99;
  for (const f of rows) {
    if (!ffa && f.team !== lastTeam) {
      lastTeam = f.team;
      board.appendChild(h(`div.board-team.${f.team === me.team ? 'ally' : 'enemy'}`, null, f.team === me.team ? `SEU TIME · ${w.scores[f.team] ?? 0}` : `INIMIGOS · ${w.scores[f.team] ?? 0}`));
    }
    board.appendChild(
      h(
        `div.board-row${f === me ? '.me' : ''}`,
        { style: `--rc:${RARITY[f.def.rarity].color}` },
        ffa ? h('i', null, `${w.placement(f)}º`) : null,
        h('span.bn', null, f.name, f.isBot ? h('em.bot-tag', null, 'BOT') : null),
        h('span.bc', null, f.def.name),
        h('b', null, `${f.stats.kills}/${f.stats.deaths}`),
        h('small', null, num(Math.round(f.stats.damage))),
      ),
    );
  }

  const el = h(
    `div.screen.results.${res}`,
    null,
    h('div.res-rays'),
    h('h1.res-title', { 'data-text': head }, head),
    h('div.res-sub', null, `${w.mode.icon} ${w.mode.name}`),
    h(
      'div.res-grid',
      null,
      h('div.res-char', null, view.el, h('div.res-name', null, me.def.name)),
      h('div.res-mid', null, stats, rewardsBox, missionsBox, dropBox),
      h('div.res-side', null, h('h3', null, 'PLACAR'), board),
    ),
    h(
      'div.res-actions',
      null,
      btn('MENU', 'btn-dark', () => {
        audio.playMusic('music_menu');
        app.home();
      }),
      btn('JOGAR DE NOVO', 'btn-yellow big', () => again()),
    ),
  );

  // aplica os prêmios (local ou servidor)
  void (async () => {
    let r: MatchRewards;
    try {
      r = await store.run('match', s);
    } catch (e) {
      fill(rewardsBox, h('p.err', null, `Não deu pra salvar o resultado: ${e instanceof Error ? e.message : e}`));
      toast('Erro ao salvar o resultado.', 'err');
      return;
    }
    const cards = h('div.gains.inline');
    const order = r.gains.filter((g) => g.kind !== 'xp');
    order.forEach((g, i) => {
      const c = gainCard(g);
      c.style.animationDelay = `${300 + i * 160}ms`;
      cards.appendChild(c);
      setTimeout(() => audio.play('ui_reward'), 300 + i * 160);
    });
    const p = store.profile!;
    const lg = leagueFor(p.trophies);
    const oldLg = leagueFor(r.oldTrophies);
    fill(
      rewardsBox,
      h('h3', null, 'PRÊMIOS'),
      cards,
      h('div.res-trophies', null, coinIcon('trophy'), `${num(r.oldTrophies)} → `, h('b', null, num(r.newTrophies)), h('span.league', { style: `color:${lg.color}` }, ` ${lg.icon} ${lg.name}`)),
      lg.id !== oldLg.id && r.newTrophies > r.oldTrophies ? h('div.res-league-up', null, `SUBIU PRA LIGA ${lg.name.toUpperCase()}! ${lg.icon}`) : null,
    );
    if (r.missions.length) {
      fill(
        missionsBox,
        h('h3', null, 'MISSÕES'),
        ...r.missions.map((m) =>
          h(
            `div.mission-mini${m.done ? '.done' : ''}`,
            null,
            h('span', null, esc(m.text)),
            h('div.bar', null, h('i', { style: `width:${(m.progress / m.target) * 100}%` })),
            h('b', null, m.done ? 'COMPLETA!' : `${short(m.progress)}/${short(m.target)}`),
          ),
        ),
      );
    }
    if (r.drop) fill(dropBox, h('div.drop-earned', null, '💀 Você ganhou um DROP DA CAVEIRA! Abra no menu.'));
  })();

  return { el };
}
