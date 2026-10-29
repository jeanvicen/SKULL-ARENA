import { LEAGUES, leagueFor, TROPHY_ROAD } from '../../content/progression';
import { store } from '../../meta/store';
import type { App, Screen } from '../app';
import { btn, coinIcon, h, num, toast, fill } from '../dom';
import { rewardChip, showGains } from '../rewards';

/** ESTRADA DA MORTE (troféus totais) + LIGAS. */
export function roadScreen(app: App): Screen {
  const body = h('div.road');
  const render = () => {
    const p = store.profile!;
    const lg = leagueFor(p.trophies);
    fill(
      body,
      h(
        'div.road-head',
        null,
        h('div.rh-tr', null, coinIcon('trophy'), h('b', null, num(p.trophies)), h('small', null, `recorde ${num(p.bestTrophies)}`)),
        h('div.rh-league', { style: `--lc:${lg.color}` }, h('span', null, lg.icon), h('b', null, `LIGA ${lg.name.toUpperCase()}`)),
      ),
      h(
        'div.leagues',
        null,
        ...LEAGUES.map((l) =>
          h(`div.league${l.id === lg.id ? '.cur' : ''}${p.trophies >= l.min ? '.ok' : ''}`, { style: `--lc:${l.color}` }, h('span', null, l.icon), h('b', null, l.name), h('small', null, num(l.min))),
        ),
      ),
      h(
        'div.road-list',
        null,
        ...TROPHY_ROAD.map((s) => {
          const got = p.road.includes(s.trophies);
          const can = !got && p.bestTrophies >= s.trophies;
          return h(
            `div.road-step${got ? '.got' : ''}${can ? '.can' : ''}${p.bestTrophies < s.trophies ? '.locked' : ''}`,
            null,
            h('div.rs-tr', null, coinIcon('trophy'), num(s.trophies)),
            h('div.rs-rew', null, ...s.rewards.map(rewardChip)),
            can
              ? btn('PEGAR', 'btn-yellow small', async () => {
                  try {
                    const g = await store.run('claimRoad', { trophies: s.trophies });
                    showGains(`${num(s.trophies)} TROFÉUS!`, g);
                  } catch (e) {
                    toast(e instanceof Error ? e.message : String(e), 'err');
                  }
                })
              : got
                ? h('i.check', null, '✔')
                : h('i.lock', null, '🔒'),
          );
        }),
      ),
      h('p.muted.small', null, 'Troféus: ganha vencendo (Guerra de Gangues, Todos contra Todos e eventos). Cada personagem tem seus troféus; a soma é a sua estrada.'),
    );
  };
  render();
  const off = store.on(render);
  const s = app.page('ESTRADA DA MORTE', body, { cls: 'page-road' });
  return { el: s.el, dispose: off };
}
