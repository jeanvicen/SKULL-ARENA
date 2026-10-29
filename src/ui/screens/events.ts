import { activeEvents, timeLeftText, upcomingEvents } from '../../content/events';
import { MODE } from '../../content/modes';
import { DAILY_MISSIONS, WEEKLY_MISSIONS } from '../../content/missions';
import type { MissionDef } from '../../content/types';
import type { MissionState } from '../../meta/profile';
import { store } from '../../meta/store';
import type { App, Screen } from '../app';
import { btn, h, num, toast, fill } from '../dom';
import { rewardChip, showGains } from '../rewards';

/** EVENTOS ativos/próximos + MISSÕES (diárias, semanais e de evento). */
export function eventsScreen(app: App): Screen {
  const body = h('div.events');
  const render = () => {
    const p = store.profile!;
    const evs = activeEvents();
    const soon = upcomingEvents();
    const mission = (def: MissionDef | undefined, st: MissionState, key: string) => {
      if (!def) return null;
      const done = st.progress >= def.target;
      return h(
        `div.mission${st.claimed ? '.claimed' : done ? '.done' : ''}`,
        null,
        h(
          'div.m-txt',
          null,
          h('b', null, def.text),
          h('div.bar', null, h('i', { style: `width:${Math.min(100, (st.progress / def.target) * 100)}%` })),
          h('small', null, `${num(st.progress)} / ${num(def.target)}`),
        ),
        h('div.m-rew', null, ...def.rewards.map(rewardChip)),
        st.claimed
          ? h('i.check', null, '✔')
          : done
            ? btn('PEGAR', 'btn-yellow small', async () => {
                try {
                  const g = await store.run('claimMission', { key });
                  showGains('MISSÃO COMPLETA!', g);
                } catch (e) {
                  toast(e instanceof Error ? e.message : String(e), 'err');
                }
              })
            : null,
      );
    };
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const hLeft = Math.ceil((midnight.getTime() - Date.now()) / 3600000);
    fill(
      body,
      h(
        'section',
        null,
        h('h3', null, '🔥 EVENTOS AGORA'),
        evs.length
          ? h(
              'div.event-list',
              null,
              ...evs.map((e) =>
                h(
                  'div.event-card',
                  { style: `--ec:${e.banner.color};--ec2:${e.banner.color2}` },
                  h('div.ev-emoji', null, e.banner.emoji),
                  h(
                    'div.ev-txt',
                    null,
                    h('b', null, e.name),
                    h('p', null, e.desc),
                    h('small', null, `acaba em ${timeLeftText(e)}`, e.modeId ? ` · modo ${MODE[e.modeId].name} liberado no JOGAR` : ''),
                  ),
                ),
              ),
            )
          : h('p.muted', null, 'Nenhum evento agora.'),
        ...evs
          .filter((e) => e.missions?.length)
          .map((e) =>
            h(
              'div.mission-group',
              null,
              h('h4', null, `Missões · ${e.name}`),
              ...e.missions!.map((m) => mission(m, p.missions.event[`${e.id}:${m.id}`] ?? { id: m.id, progress: 0, claimed: false }, `${e.id}:${m.id}`)),
            ),
          ),
      ),
      h(
        'section',
        null,
        h('h3', null, `📜 MISSÕES DIÁRIAS `, h('small', null, `novas em ${hLeft}h`)),
        ...p.missions.daily.map((st) =>
          mission(
            DAILY_MISSIONS.find((d) => d.id === st.id),
            st,
            st.id,
          ),
        ),
      ),
      h(
        'section',
        null,
        h('h3', null, '🗓️ MISSÕES DA SEMANA'),
        ...p.missions.weekly.map((st) =>
          mission(
            WEEKLY_MISSIONS.find((d) => d.id === st.id),
            st,
            st.id,
          ),
        ),
      ),
      soon.length
        ? h(
            'section',
            null,
            h('h3', null, '⏳ EM BREVE'),
            ...soon.map((e) =>
              h(
                'div.event-card.soon',
                { style: `--ec:${e.banner.color};--ec2:${e.banner.color2}` },
                h('div.ev-emoji', null, e.banner.emoji),
                h('div.ev-txt', null, h('b', null, e.name), h('p', null, e.desc), h('small', null, `começa ${new Date(e.start).toLocaleDateString('pt-BR')}`)),
              ),
            ),
          )
        : null,
    );
  };
  void store.run('refresh').catch(() => {});
  render();
  const off = store.on(render);
  const s = app.page('MISSÕES E EVENTOS', body, { cls: 'page-events' });
  return { el: s.el, dispose: off };
}
