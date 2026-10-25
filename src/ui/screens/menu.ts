import { audio } from '../../audio/audio';
import type { ModeDef } from '../../content/types';
import { eventActive, pendingClaims } from '../../systems/economy';
import type { App, Screen } from '../app';
import { menuBg, notice, rarityTag, topbar } from '../components';
import { h, ICON, MODE_ICON, svg } from '../dom';
import { Showcase } from '../showcase';

export function modeLocked(app: App, m: ModeDef): boolean {
  return (m.unlockLevel ?? 1) > app.save.level;
}

export function openModePicker(app: App, onPick: (id: string) => void): void {
  app.modal((close) => {
    const list = h('div', { class: 'list' });
    for (const m of app.content.modes.values()) {
      const locked = modeLocked(app, m);
      list.append(h('button', {
        class: `mode-opt${m.id === app.save.lastMode ? ' on' : ''}${locked ? ' locked' : ''}`,
        onclick: () => {
          if (locked) {
            app.toast(`Desbloqueia no nível ${m.unlockLevel}`, 'bad');
            return;
          }
          app.click();
          close();
          onPick(m.id);
        },
      },
        h('div', { class: 'mi' }, svg(locked ? ICON.lock : MODE_ICON[m.icon] ?? ICON.skull)),
        h('div', { style: 'min-width:0' },
          h('div', { class: 'mt stroke' }, m.name, locked ? h('span', { class: 'chip', style: 'margin-left:6px;font-size:11px' }, `Nível ${m.unlockLevel}`) : null),
          h('div', { class: 'md' }, m.description),
          h('div', { class: 'md', style: 'color:#ffb347;margin-top:2px' }, m.botNotice),
        ),
      ));
    }
    list.append(h('button', { class: 'mode-opt', onclick: () => { app.click(); close(); void app.go('rooms'); } },
      h('div', { class: 'mi' }, svg(ICON.door)),
      h('div', null, h('div', { class: 'mt stroke' }, 'Salas privadas'), h('div', { class: 'md' }, 'Crie uma sala com código e configure a partida. Entrar na sala de amigos requer servidor (Fase 5).')),
    ));
    return h('div', { class: 'panel modal' }, h('h2', { class: 'stroke' }, 'Modos de jogo'), list,
      h('div', { class: 'actions' }, h('button', { class: 'btn dark', onclick: close }, 'Fechar')));
  });
}

export function menuScreen(app: App): Screen {
  const s = app.save;
  const content = app.content;
  if (!content.modes.has(s.lastMode)) s.lastMode = 'cacada';
  const def = content.characters.get(s.selectedCharacter) ?? content.characters.get(content.progression.starterCharacters[0])!;
  const owned = s.characters[def.id];
  const rarity = content.rarity(def.rarity);
  audio.playMusic('menu');

  // Herói animado
  const heroCanvas = h('canvas');
  const show = new Showcase(heroCanvas);
  show.set(def, owned?.skin && owned.skin !== 'default' ? content.skins.get(owned.skin) ?? null : null, rarity.color);
  show.start();
  const bubble = h('div', { class: 'voice-bubble', style: 'top:12%;left:50%;right:auto;transform:translateX(-50%);max-width:80%;display:none' });
  const sayLine = () => {
    const lines = def.voiceLines.select;
    bubble.textContent = `“${lines[Math.floor(Math.random() * lines.length)]}”`;
    bubble.style.display = 'block';
    bubble.style.animation = 'none';
    void bubble.offsetWidth;
    bubble.style.animation = '';
    show.poke();
    audio.play('click', 0.4);
    clearTimeout(bubbleT);
    bubbleT = window.setTimeout(() => (bubble.style.display = 'none'), 2600);
  };
  let bubbleT = 0;
  heroCanvas.addEventListener('click', sayLine);
  const hero = h('div', { class: 'hero' },
    heroCanvas,
    bubble,
    h('div', { class: 'plate' },
      h('div', { class: 'cname stroke' }, def.name),
      h('div', { class: 'ctitle' }, rarityTag(app, def.rarity), ` · Nível ${owned?.level ?? 1} · ${def.title}`),
    ),
    h('button', { class: 'btn small dark switch', onclick: () => { app.click(); void app.go('collection'); } }, 'Trocar'),
  );

  // Trilhos laterais
  const pending = pendingClaims(content, s);
  const leftRail = h('div', { class: 'side-rail' },
    h('div', { class: 'rail-btn' }, h('button', { class: 'icon-btn', 'aria-label': 'Eventos', onclick: () => { app.click(); void app.go('events'); } }, svg(ICON.events), pending ? h('span', { class: 'badge' }, String(pending)) : null), 'Eventos'),
    h('div', { class: 'rail-btn' }, h('button', { class: 'icon-btn', 'aria-label': 'Trilha de troféus', onclick: () => { app.click(); void app.go('events', { tab: 'trofeus' }); } }, svg(ICON.trophy)), 'Troféus'),
  );
  const rightRail = h('div', { class: 'side-rail right' },
    h('div', { class: 'rail-btn' }, h('button', { class: 'icon-btn', 'aria-label': 'Configurações', onclick: () => { app.click(); void app.go('settings'); } }, svg(ICON.gear)), 'Config'),
    h('div', { class: 'rail-btn' }, h('button', { class: 'icon-btn', 'aria-label': 'Salas', onclick: () => { app.click(); void app.go('rooms'); } }, svg(ICON.door)), 'Salas'),
  );
  hero.append(leftRail, rightRail);

  // Banner de evento sazonal ativo
  const season = content.events.find((e) => e.kind === 'seasonal' && eventActive(e, new Date()));
  const banner = season
    ? h('div', { class: 'event-banner', onclick: () => { app.click(); void app.go('events'); } },
        h('span', { class: 'em' }, '🎃'),
        h('div', { style: 'flex:1;min-width:0' }, `${season.name} — evento ativo!`, h('small', null, `Até ${season.end?.split('-').reverse().join('/')} · recompensas e título exclusivo`)),
        svg(ICON.play),
      )
    : null;

  // Modo + JOGAR
  const mode = content.modes.get(s.lastMode)!;
  const modeCard = h('button', { class: 'mode-card', onclick: () => { app.click(); openModePicker(app, (id) => { s.lastMode = id; app.persist(); void app.go('menu', {}, 'none'); }); } },
    h('div', { class: 'mi' }, svg(MODE_ICON[mode.icon] ?? ICON.skull)),
    h('div', { style: 'min-width:0' }, h('div', { class: 'mt stroke' }, mode.name), h('div', { class: 'ms' }, `${mode.subtitle} · trocar modo`)),
  );
  const play = () => {
    audio.unlock();
    audio.play('click', 0.9);
    if (modeLocked(app, mode)) {
      app.toast(`Desbloqueia no nível ${mode.unlockLevel}`, 'bad');
      return;
    }
    void app.go('select', { prematch: true, modeId: mode.id });
  };
  const playBtn = h('button', { class: 'btn pink big play-btn' }, 'JOGAR', h('span', { class: 'kbd-hint' }, 'Enter'));
  playBtn.addEventListener('click', play);
  const playZone = h('div', { class: 'play-zone' }, modeCard, playBtn);

  const nav = h('div', { class: `bottom-nav${app.isDesktop ? ' desk' : ''}` });
  const navItems: Array<[string, string, () => void, number?]> = [
    ['Loja', ICON.shop, () => app.go('shop')],
    ['Coleção', ICON.cards, () => app.go('collection')],
    ['Baús', ICON.chest, () => app.go('chests'), s.chests.length],
    ['Eventos', ICON.events, () => app.go('events'), pending],
    ['Social', ICON.social, () => app.go('social')],
  ];
  navItems.forEach(([label, icon, fn, badge], i) => {
    nav.append(h('button', { class: 'nav-btn', onclick: () => { app.click(); void fn(); } },
      h('span', { class: 'nb' }, svg(icon)), label, h('span', { class: 'kbd-hint' }, String(i + 1)),
      badge ? h('span', { class: 'badge', style: 'right:12%' }, String(badge)) : null));
  });

  const main = h('div', { class: `menu-main${app.isDesktop ? ' desk desk-center' : ''}` });
  if (app.isDesktop) {
    main.append(hero, h('div', { class: 'right-col' }, banner ?? '', h('div', { class: 'panel', style: 'padding:14px' },
      h('div', { class: 'display', style: 'font-size:14px;color:var(--ink3);margin-bottom:8px' }, 'PARTIDA RÁPIDA'), playZone,
      h('div', { style: 'margin-top:10px' }, notice('Offline contra BOTS (marcados como BOT). Multiplayer online requer servidor — Fase 5.', 'info')))));
  } else {
    main.append(hero, banner ?? '', playZone);
  }

  const el = h('div', { class: 'screen' }, menuBg(), topbar(app), main, nav);
  return {
    el,
    destroy: () => show.stop(),
    onKey: (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        play();
      }
      const n = Number(e.key);
      if (n >= 1 && n <= navItems.length) {
        app.click();
        void navItems[n - 1][2]();
      }
      if (e.key.toLowerCase() === 'm') openModePicker(app, (id) => { s.lastMode = id; app.persist(); void app.go('menu', {}, 'none'); });
    },
  };
}
