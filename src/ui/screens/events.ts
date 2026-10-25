import { audio } from '../../audio/audio';
import type { EventDef } from '../../content/types';
import {
  achievementProgress, claimAchievement, claimQuest, claimTrophyRoad, eventActive, questProgress, refreshQuests, type Reward,
} from '../../systems/economy';
import type { App, Screen } from '../app';
import { menuBg, portraitOf, topbar } from '../components';
import { fmt, h, ICON, svg } from '../dom';

function rewardText(app: App, r: Reward): string {
  const parts: string[] = [];
  if (r.coins) parts.push(`${fmt(r.coins)} moedas`);
  if (r.gems) parts.push(`${fmt(r.gems)} diamantes`);
  if (r.xp) parts.push(`${fmt(r.xp)} XP`);
  if (r.chest) parts.push(app.content.chests.get(r.chest)?.name ?? r.chest);
  if (r.title) parts.push(`título “${app.content.titles.get(r.title)?.name ?? r.title}”`);
  return parts.join(' + ');
}

function timeLeft(ev: EventDef): string {
  const now = new Date();
  if (ev.kind === 'daily') {
    const end = new Date(now);
    end.setHours(24, 0, 0, 0);
    const hh = Math.floor((end.getTime() - now.getTime()) / 3.6e6);
    return `renova em ${hh}h`;
  }
  if (ev.kind === 'weekly') {
    const d = (8 - now.getDay()) % 7 || 7;
    return `renova em ${d} dia${d > 1 ? 's' : ''}`;
  }
  return ev.end ? `até ${ev.end.split('-').reverse().join('/')}` : '';
}

/** Eventos (diário/semanal/sazonal), trilha de troféus, conquistas e perfil/títulos. */
export function eventsScreen(app: App, params: Record<string, unknown>): Screen {
  const s = app.save;
  const content = app.content;
  refreshQuests(content, s);
  let tab = (params.tab as string) ?? 'missoes';
  const tabs = h('div', { class: 'seg', style: 'margin:0 12px 6px;justify-content:flex-start' });
  const body = h('div', { class: 'scroll' });

  const claimFx = (r: Reward | null) => {
    if (!r) return;
    audio.play('reward');
    app.toast(`Recebido: ${rewardText(app, r)}`, 'gold', 2600);
    app.persist();
    render();
  };

  const render = () => {
    tabs.innerHTML = '';
    for (const [id, label] of [['missoes', 'Missões'], ['trofeus', 'Troféus'], ['conquistas', 'Conquistas'], ['perfil', 'Perfil']]) {
      tabs.append(h('button', { class: tab === id ? 'on' : '', onclick: () => { app.click(); tab = id; render(); } }, label));
    }
    body.innerHTML = '';
    if (tab === 'missoes') {
      for (const ev of content.events) {
        if (!eventActive(ev, new Date())) continue;
        if (ev.kind === 'seasonal') {
          body.append(h('div', { class: 'season-hero', style: 'margin-top:6px' },
            h('div', { style: 'position:absolute;right:-10px;top:-14px;font-size:90px;opacity:.35' }, '🎃'),
            h('div', { class: 'chip', style: 'background:rgba(0,0,0,.3)' }, 'EVENTO SAZONAL · ' + timeLeft(ev)),
            h('h3', { class: 'stroke', style: 'margin-top:6px' }, ev.name), h('p', null, ev.description)));
        } else {
          body.append(h('div', { class: 'section-title' }, ev.name, h('small', null, timeLeft(ev))));
        }
        const list = h('div', { class: 'list', style: ev.kind === 'seasonal' ? 'margin-top:8px' : '' });
        for (const q of ev.quests) {
          const prog = Math.min(q.target, questProgress(s, ev.id, q.stat));
          const done = prog >= q.target;
          const claimed = s.quests[ev.id]?.claimed.includes(q.id);
          list.append(h('div', { class: `quest${done ? ' done' : ''}${claimed ? ' claimed' : ''}` },
            h('div', null, h('div', { class: 'qt' }, q.text), h('div', { class: 'qr' }, rewardText(app, q.reward))),
            claimed ? h('span', { class: 'chip', style: 'color:var(--green)' }, '✓ Pego')
              : h('button', { class: `btn small ${done ? 'green' : 'dark disabled'}`, disabled: !done, onclick: () => claimFx(claimQuest(content, s, ev.id, q.id)) }, done ? 'Pegar' : `${fmt(prog)}/${fmt(q.target)}`),
            h('div', { class: 'bar' }, h('i', { style: `width:${(prog / q.target) * 100}%` }))));
        }
        body.append(list);
      }
    } else if (tab === 'trofeus') {
      body.append(h('div', { class: 'panel', style: 'padding:14px;display:flex;align-items:center;gap:12px;margin-top:6px' },
        h('div', { style: 'width:56px;height:56px' }, svg(ICON.trophy)),
        h('div', null, h('div', { class: 'display stroke', style: 'font-size:32px' }, fmt(s.trophies)), h('div', { class: 'small muted', style: 'font-weight:800' }, 'Troféus: suba vencendo (offline conta, mas ranked real só com servidor)'))));
      body.append(h('div', { class: 'section-title' }, 'Trilha de troféus'));
      const road = h('div', { class: 'road' });
      content.progression.trophyRoad.forEach((st, i) => {
        const reached = s.trophies >= st.trophies;
        const claimed = s.trophyRoadClaimed.includes(i);
        road.append(h('div', { class: `road-step${reached ? ' reached' : ''}${claimed ? ' claimed' : ''}` },
          h('div', { class: 'rt' }, `🏆 ${st.trophies}`),
          h('div', { class: 'small', style: 'font-weight:800;min-height:46px;margin:6px 0' }, rewardText(app, st.reward)),
          claimed ? h('span', { class: 'chip' }, '✓') : h('button', { class: `btn small ${reached ? 'gold' : 'dark disabled'}`, disabled: !reached, onclick: () => claimFx(claimTrophyRoad(content, s, i)) }, reached ? 'Pegar' : '🔒')));
      });
      body.append(road);
    } else if (tab === 'conquistas') {
      const list = h('div', { class: 'list', style: 'margin-top:6px' });
      for (const a of content.achievements) {
        const prog = Math.min(a.target, achievementProgress(s, a.stat));
        const done = prog >= a.target;
        const claimed = s.achievementsClaimed.includes(a.id);
        list.append(h('div', { class: `quest${done ? ' done' : ''}${claimed ? ' claimed' : ''}` },
          h('div', { style: 'display:flex;gap:10px;align-items:center' }, h('div', { style: 'width:36px;height:36px;flex:none' }, svg(ICON.medal)),
            h('div', null, h('div', { class: 'qt' }, a.name), h('div', { class: 'small muted', style: 'font-weight:700' }, a.description), h('div', { class: 'qr' }, rewardText(app, a.reward)))),
          claimed ? h('span', { class: 'chip', style: 'color:var(--green)' }, '✓') : h('button', { class: `btn small ${done ? 'green' : 'dark disabled'}`, disabled: !done, onclick: () => claimFx(claimAchievement(content, s, a.id)) }, done ? 'Pegar' : `${fmt(prog)}/${fmt(a.target)}`),
          h('div', { class: 'bar violet' }, h('i', { style: `width:${(prog / a.target) * 100}%` }))));
      }
      body.append(list);
    } else {
      // Perfil: títulos + estatísticas + histórico
      const def = content.characters.get(s.selectedCharacter);
      body.append(h('div', { class: 'panel', style: 'padding:14px;display:flex;gap:12px;align-items:center;margin-top:6px' },
        def ? h('img', { src: portraitOf(app, def, s.characters[def.id]?.skin), style: 'width:72px;height:72px' }) : null,
        h('div', { style: 'flex:1;min-width:0' },
          h('div', { class: 'display stroke', style: 'font-size:24px' }, s.player.name),
          h('div', { class: 'small', style: `font-weight:800;color:${content.titles.get(s.player.titleId)?.color}` }, content.titles.get(s.player.titleId)?.name ?? ''),
          h('div', { class: 'small muted', style: 'font-weight:800' }, `Nível ${s.level} · conta local desde ${new Date(s.createdAt).toLocaleDateString('pt-BR')}`)),
        h('button', { class: 'btn small dark', onclick: () => renameModal() }, 'Renomear')));
      body.append(h('div', { class: 'section-title' }, 'Títulos', h('small', null, 'toque para usar')));
      const tl = h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px' });
      for (const t of content.titles.values()) {
        const has = s.titles.includes(t.id);
        tl.append(h('button', { class: 'chip', style: `cursor:pointer;color:${has ? t.color : 'var(--ink3)'};border-color:${s.player.titleId === t.id ? t.color : 'rgba(255,255,255,.12)'};opacity:${has ? 1 : 0.5}`, title: t.unlock,
          onclick: () => { if (!has) { app.toast(`Como ganhar: ${t.unlock}`); return; } s.player.titleId = t.id; app.persist(); render(); } }, has ? t.name : `🔒 ${t.name}`));
      }
      body.append(tl);
      body.append(h('div', { class: 'section-title' }, 'Estatísticas'));
      const st = s.stats;
      const rows: Array<[string, number]> = [['Partidas', st.matches], ['Vitórias', st.wins], ['Abates', st.kills], ['Dano causado', st.damage], ['Cura', st.heals], ['Especiais', st.specials], ['Almas', st.souls], ['Baús abertos', st.chestsOpened]];
      body.append(h('div', { class: 'stats-row', style: 'grid-template-columns:repeat(2,1fr);width:100%' }, ...rows.map(([l, v]) => h('div', null, fmt(v), h('small', null, l)))));
      body.append(h('div', { class: 'section-title' }, 'Últimas partidas'));
      if (!s.history.length) body.append(h('div', { class: 'muted small' }, 'Nenhuma partida ainda.'));
      for (const m of s.history.slice(0, 8)) {
        const d = content.characters.get(m.character);
        body.append(h('div', { class: 'quest', style: 'grid-template-columns:auto 1fr auto;margin-bottom:6px' },
          d ? h('img', { src: portraitOf(app, d), style: 'width:40px;height:40px' }) : h('span'),
          h('div', null, h('div', { class: 'qt' }, `${content.modes.get(m.mode)?.name ?? m.mode} · ${content.maps.get(m.map)?.name ?? m.map}`), h('div', { class: 'small muted', style: 'font-weight:700' }, `${m.kills} abates · ${fmt(m.damage)} dano`)),
          h('span', { class: 'chip', style: `color:${m.won ? 'var(--gold)' : 'var(--ink3)'}` }, m.won ? 'VITÓRIA' : `${m.placement}º`)));
      }
    }
  };

  const renameModal = () => {
    app.modal((close) => {
      const input = h('input', { class: 'text-in', maxlength: '16', value: s.player.name }) as HTMLInputElement;
      return h('div', { class: 'panel modal' }, h('h2', { class: 'stroke' }, 'Novo nome'), input,
        h('div', { class: 'actions' }, h('button', { class: 'btn green', onclick: () => { const n = input.value.trim(); if (n) { s.player.name = n.slice(0, 16); app.persist(); close(); void app.go('events', { tab: 'perfil' }, 'none'); } } }, 'Salvar'), h('button', { class: 'btn dark', onclick: close }, 'Cancelar')));
    });
  };

  render();
  app.persist();
  const el = h('div', { class: 'screen' }, menuBg(), topbar(app, { back: 'menu', title: 'Eventos' }), tabs, body);
  return { el, back: 'menu' };
}
