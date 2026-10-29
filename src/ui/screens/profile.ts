import { getCharacter } from '../../content/characters';
import { MODE } from '../../content/modes';
import { leagueFor } from '../../content/progression';
import { store } from '../../meta/store';
import type { App } from '../app';
import { btn, coinIcon, h, modal, num, toast } from '../dom';

/** PERFIL: estatísticas da vida, título, histórico de partidas, sua TAG. */
export function profileModal(app: App): void {
  const p = store.profile!;
  const lg = leagueFor(p.trophies);
  const L = p.stats;
  const stat = (k: string, v: number | string) => h('div.stat', null, h('span', null, k), h('b', null, typeof v === 'number' ? num(v) : v));
  const titleSel = h<'select'>('select.inp', null, h('option', { value: '' }, '— sem título —'), ...Object.entries(p.titles).map(([id, t]) => h('option', { value: id }, t)));
  titleSel.value = p.title ?? '';
  titleSel.addEventListener('change', async () => {
    try {
      await store.run('setTitle', { id: titleSel.value || null });
      toast('Título trocado!', 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    }
  });
  modal(
    'PERFIL',
    [
      h(
        'div.profile',
        null,
        h(
          'div.pf-head',
          null,
          h('div.pf-lvl', null, String(p.level)),
          h('div', null, h('h2', null, p.name), h('div.pf-tag', null, `#${p.tag}`, h('small', null, ' (sua TAG pra adicionar amigos)'))),
          h('div.pf-league', { style: `color:${lg.color}` }, `${lg.icon} ${lg.name}`),
        ),
        h('label', null, 'Título', titleSel),
        h(
          'div.pf-stats',
          null,
          stat('Troféus', p.trophies),
          stat('Recorde', p.bestTrophies),
          stat('Partidas', L.matches),
          stat('Vitórias', L.wins),
          stat('Eliminações', L.kills),
          stat('Mortes', L.deaths),
          stat('Dano total', L.damage),
          stat('Cura total', L.healed),
          stat('Caveiras', L.skulls),
          stat('Maior sequência', L.bestStreak),
          stat('Baús abertos', L.chestsOpened),
          stat('Personagens', Object.keys(p.chars).length),
          stat('Pets', Object.keys(p.pets).length),
        ),
        h('h3', null, 'ÚLTIMAS PARTIDAS'),
        p.history.length
          ? h(
              'div.history',
              null,
              ...p.history.map((m) =>
                h(
                  `div.hist-row.${m.result}`,
                  null,
                  h('b', null, m.result === 'win' ? 'V' : m.result === 'lose' ? 'D' : 'E'),
                  h('span', null, `${MODE[m.mode]?.icon ?? ''} ${MODE[m.mode]?.name ?? m.mode}`),
                  h('span', null, getCharacter(m.char).name),
                  h('span', null, `${m.kills}/${m.deaths}`),
                  h('span', null, coinIcon('trophy'), `${m.trophies > 0 ? '+' : ''}${m.trophies}`),
                  h('small', null, new Date(m.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })),
                ),
              ),
            )
          : h('p.muted', null, 'Nenhuma partida ainda. Bora jogar!'),
        h(
          'div.row.end',
          null,
          btn('SAIR DA CONTA', 'btn-red small', () => {
            store.logout();
            location.reload();
          }),
        ),
      ),
    ],
    { wide: true },
  );
  void app;
}
