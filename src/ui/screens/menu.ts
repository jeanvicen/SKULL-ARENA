import { audio } from '../../audio/audio';
import { getCharacter } from '../../content/characters';
import { CHEST } from '../../content/chests';
import { xpForLevel } from '../../content/economy';
import { activeEvents } from '../../content/events';
import { mapsForMode } from '../../content/maps';
import { MODE } from '../../content/modes';
import { getPet } from '../../content/pets';
import { passTierFor } from '../../content/pass';
import { leagueFor, TROPHY_ROAD } from '../../content/progression';
import { RARITY, ROLES } from '../../content/rarities';
import { dailyStatus } from '../../meta/economy';
import { store } from '../../meta/store';
import { net } from '../../net/online';
import type { App, Screen } from '../app';
import { wallet } from '../app';
import { btn, coinIcon, esc, h, modal, num, toast, fill } from '../dom';
import { availableModes, getChoice, setChoice, startMatch } from '../play';
import { CharView } from '../pixelView';
import { rewardChip, showGains } from '../rewards';
import { openChestFlow, openDropFlow } from './chestOpen';
import { characterScreen } from './character';
import { collectionScreen } from './collection';
import { eventsScreen } from './events';
import { passScreen } from './pass';
import { petsScreen } from './pets';
import { profileModal } from './profile';
import { roadScreen } from './road';
import { settingsScreen } from './settings';
import { shopScreen } from './shop';
import { socialScreen } from './social';
import { studioScreen } from './studio';

/**
 * MENU PRINCIPAL (lobby)
 *  esquerda: navegação · centro: seu personagem animado · direita: JOGAR + modo
 *  embaixo: Estrada da Morte
 */
export function menuScreen(app: App): Screen {
  const stage = h('div.stage');
  const charInfo = h('div.char-info');
  const leftNav = h('nav.side-nav');
  const rightCol = h('div.right-col');
  const roadBar = h('div.road-bar');
  const profileChip = h('button.profile-chip');
  let view: CharView | null = null;
  let shownChar = '';
  let shownPet: string | null | undefined;

  const nav = (label: string, icon: string, open: () => void, badge?: number | string) =>
    btn(h('span.nav-in', null, h('span.nav-ico', null, icon), h('span.nav-lbl', null, label), badge ? h('i.badge', null, String(badge)) : null), 'nav-btn', open);

  const renderStage = () => {
    const p = store.profile!;
    if (shownChar === p.selected && shownPet === p.selectedPet && view) return;
    shownChar = p.selected;
    shownPet = p.selectedPet;
    const def = getCharacter(p.selected);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const avail = Math.min(window.innerHeight * 0.62, window.innerWidth * 0.36);
    const scale = Math.max(2, Math.floor((avail * dpr) / 84));
    view = new CharView(def, scale, { pet: getPet(p.selectedPet), showOff: true, extraW: 44 });
    view.el.style.width = `${view.el.width / dpr}px`;
    view.el.addEventListener('click', () => {
      audio.play('ui_click');
      view?.play(Math.random() < 0.5 ? 'attack' : 'cast');
    });
    fill(stage, h('div.stage-glow', { style: `--rc:${RARITY[def.rarity].color}` }), h('div.stage-floor'), view.el);
  };

  const renderInfo = () => {
    const p = store.profile!;
    const def = getCharacter(p.selected);
    const r = RARITY[def.rarity];
    const oc = p.chars[def.id];
    fill(
      charInfo,
      h('div.ci-name', { style: `--rc:${r.color};--rc2:${r.color2}` }, h('span.rar-badge', { title: r.name }, r.badge), def.name),
      h('div.ci-sub', null, `${ROLES[def.role].icon} ${ROLES[def.role].name} · ${def.title}`),
      h('div.ci-meta', null, h('span.lvl', null, `NV ${oc?.level ?? 1}`), h('span.tr', null, coinIcon('trophy'), num(oc?.trophies ?? 0))),
      btn('TROCAR', 'btn-dark small', () => app.show(collectionScreen(app))),
    );
  };

  const renderSides = () => {
    const p = store.profile!;
    const lg = leagueFor(p.trophies);
    const need = xpForLevel(p.level);
    fill(
      profileChip,
      h('span.pc-lvl', null, String(p.level)),
      h('span.pc-txt', null, h('b', null, p.name), h('small', null, p.title && p.titles[p.title] ? p.titles[p.title] : `${lg.icon} ${lg.name}`)),
      h('span.pc-xp', null, h('i', { style: `width:${Math.min(100, (p.xp / need) * 100)}%` })),
    );
    const chestCount = Object.values(p.chests).reduce((a, b) => a + b, 0);
    const missionsReady = [...p.missions.daily, ...p.missions.weekly].filter((m) => !m.claimed).length;
    const passReady = passTierFor(p.pass.xp) - p.pass.free.length;
    fill(
      leftNav,
      nav('LOJA', '🛒', () => app.show(shopScreen(app)), chestCount || undefined),
      nav('PERSONAGENS', '💀', () => app.show(collectionScreen(app)), Object.keys(p.chars).length),
      nav('PETS', '🐾', () => app.show(petsScreen(app))),
      nav('SKULL PASS', '🎟️', () => app.show(passScreen(app)), passReady > 0 ? passReady : undefined),
      nav('MISSÕES', '📜', () => app.show(eventsScreen(app)), missionsReady || undefined),
      nav('SOCIAL', '👥', () => app.show(socialScreen(app)), net.requests.length || undefined),
      nav('ESTÚDIO', '🎨', () => app.show(studioScreen(app))),
    );
    // coluna da direita
    const ds = dailyStatus(p);
    const choice = getChoice();
    const mode = MODE[choice.mode];
    const evs = activeEvents();
    fill(
      rightCol,
      h(
        'div.quick',
        null,
        ds.canClaim ? btn(h('span', null, '🎁 ', h('b', null, `PRÊMIO DIÁRIO`), h('small', null, `dia ${ds.day}`)), 'chip-btn glow', () => claimDaily()) : null,
        p.drops.pending > 0
          ? btn(h('span', null, '💀 ', h('b', null, 'DROP DA CAVEIRA'), h('small', null, `${p.drops.pending} pra abrir`)), 'chip-btn glow pink', () => openDropFlow(app, () => app.home()))
          : null,
        chestCount ? btn(h('span', null, '📦 ', h('b', null, 'BAÚS'), h('small', null, `${chestCount} guardado${chestCount > 1 ? 's' : ''}`)), 'chip-btn', () => chestsModal()) : null,
        ...evs
          .slice(0, 2)
          .map((e) =>
            btn(h('span', null, `${e.banner.emoji} `, h('b', null, e.name)), 'chip-btn event', () => app.show(eventsScreen(app)), { style: `--ec:${e.banner.color};--ec2:${e.banner.color2}` }),
          ),
      ),
      h(
        'div.play-box',
        null,
        btn(h('span.play-in', null, 'JOGAR'), 'btn-play', () => startMatch(app, getChoice())),
        btn(
          h(
            'span.mode-in',
            null,
            h('span.mode-ico', null, mode.icon),
            h(
              'span',
              null,
              h('b', null, mode.name),
              h('small', null, `${mode.short} · ${choice.map === 'random' ? 'mapa aleatório' : (mapsForMode(mode.id).find((m) => m.id === choice.map)?.name ?? 'mapa aleatório')}`),
            ),
          ),
          'btn-mode',
          () => modeChooser(),
        ),
      ),
    );
    // estrada da morte
    const next = TROPHY_ROAD.find((s) => !p.road.includes(s.trophies));
    const prevT = [...TROPHY_ROAD].reverse().find((s) => s.trophies <= p.bestTrophies)?.trophies ?? 0;
    const claimable = TROPHY_ROAD.filter((s) => s.trophies <= p.bestTrophies && !p.road.includes(s.trophies)).length;
    fill(
      roadBar,
      btn(
        h(
          'span.road-in',
          null,
          h('span.road-lbl', null, '🛣️ ESTRADA DA MORTE'),
          h('span.road-track', null, h('i', { style: `width:${next ? Math.min(100, ((p.bestTrophies - prevT) / Math.max(1, next.trophies - prevT)) * 100) : 100}%` })),
          next ? h('span.road-next', null, coinIcon('trophy'), `${num(next.trophies)}: `, rewardChip(next.rewards[0]!)) : h('span.road-next', null, 'Estrada completa!'),
          claimable ? h('i.badge', null, String(claimable)) : null,
          h('span.road-league', { style: `color:${lg.color}` }, `${lg.icon} ${lg.name}`),
        ),
        'road-btn',
        () => app.show(roadScreen(app)),
      ),
    );
  };

  const claimDaily = async () => {
    try {
      const g = await store.run('claimDaily');
      showGains('PRÊMIO DIÁRIO', g);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err');
    }
  };

  const chestsModal = () => {
    const p = store.profile!;
    const list = h('div.chest-list');
    const m = modal('SEUS BAÚS', list);
    for (const [id, n] of Object.entries(p.chests)) {
      const c = CHEST[id];
      if (!c) continue;
      list.appendChild(
        h(
          'div.chest-row',
          { style: `--cc:${c.color};--cg:${c.glow}` },
          h('div.chest-mini'),
          h('div', null, h('b', null, `${n}× ${c.name}`), h('small', null, c.desc)),
          btn('ABRIR', 'btn-yellow small', () => {
            m.close();
            openChestFlow(app, id, false, () => app.home());
          }),
        ),
      );
    }
  };

  const modeChooser = () => {
    const body = h('div.mode-chooser');
    const m = modal('TIPO DE PARTIDA', body, { wide: true, onClose: () => renderSides() });
    const render = () => {
      const c = getChoice();
      const modes = availableModes();
      const maps = mapsForMode(c.mode);
      fill(
        body,
        h(
          'div.mode-grid',
          null,
          ...modes.map((md) => {
            const ev = activeEvents().find((e) => e.modeId === md.id);
            return btn(
              h(
                'span.mc-in',
                null,
                h('span.mc-ico', null, md.icon),
                h('b', null, md.name),
                h('small', null, md.short),
                h('span.mc-desc', null, md.desc),
                ev ? h('em.mc-ev', null, `EVENTO: ${ev.name}`) : null,
              ),
              `mode-card${c.mode === md.id ? ' active' : ''}`,
              () => {
                setChoice({ mode: md.id, map: 'random' });
                render();
              },
            );
          }),
          btn(
            h(
              'span.mc-in',
              null,
              h('span.mc-ico', null, '👥'),
              h('b', null, 'Jogar com Amigos'),
              h('small', null, 'Sala · mesmo time'),
              h('span.mc-desc', null, 'Crie uma sala e chame amigos pro SEU time. Online precisa de servidor; no modo local seus amigos entram como BOTs com o nome deles.'),
            ),
            'mode-card friends',
            () => {
              m.close();
              app.show(socialScreen(app, 'sala'));
            },
          ),
        ),
        h('h3', null, 'MAPA'),
        h(
          'div.map-row',
          null,
          btn('🎲 Aleatório', `chip${c.map === 'random' ? ' active' : ''}`, () => {
            setChoice({ ...c, map: 'random' });
            render();
          }),
          ...maps.map((mp) =>
            btn(`${mp.name}`, `chip${c.map === mp.id ? ' active' : ''}`, () => {
              setChoice({ ...c, map: mp.id });
              render();
            }),
          ),
        ),
        h(
          'div.row.end',
          null,
          btn('PRONTO', 'btn-yellow', () => m.close()),
        ),
      );
    };
    render();
  };

  const render = () => {
    if (!store.profile) return;
    renderStage();
    renderInfo();
    renderSides();
  };
  render();
  const off = store.on(render);

  const el = h(
    'div.screen.menu',
    null,
    h('div.menu-bg'),
    h(
      'header.menu-top',
      null,
      profileChip,
      h('div.menu-logo', null, 'SKULL ARENA'),
      wallet(),
      btn('⚙', 'btn-icon', () => app.show(settingsScreen(app)), { 'aria-label': 'Configurações' }),
    ),
    leftNav,
    h('main.menu-center', null, stage, charInfo),
    rightCol,
    roadBar,
    !store.online ? h('div.local-badge', { title: 'Sem servidor: tudo salvo neste aparelho. Configure em ⚙ → Servidor.' }, '📱 MODO LOCAL') : null,
  );
  profileChip.addEventListener('click', () => {
    audio.play('ui_click');
    profileModal(app);
  });
  stage.addEventListener('dblclick', () => app.show(characterScreen(app, store.profile!.selected)));

  // ao entrar: missões do dia + presentes de evento
  void (async () => {
    try {
      await store.run('refresh');
      const gifts = await store.run('eventGifts');
      for (const g of gifts) showGains(`PRESENTE: ${esc(g.event)}`, g.gains);
      if (!gifts.length && dailyStatus(store.profile!).canClaim && !sessionStorage.getItem('skull.dailyShown')) {
        sessionStorage.setItem('skull.dailyShown', '1');
        setTimeout(() => void claimDaily(), 600);
      }
    } catch {
      /* offline/servidor: tenta de novo depois */
    }
  })();
  audio.playMusic('music_menu');
  const onResize = () => {
    shownChar = '';
    renderStage();
  };
  window.addEventListener('resize', onResize);

  return {
    el,
    dispose: () => {
      off();
      window.removeEventListener('resize', onResize);
    },
  };
}
