import { audio } from '../../audio/audio';
import { LocalMatch } from '../../combat/match';
import type { MatchSetup } from '../../combat/world';
import { GameLoop } from '../../engine/loop';
import { Rng } from '../../engine/rng';
import { DesktopController, TouchController, type PlayerController } from '../../input/controllers';
import { inputProfile } from '../../input/profile';
import { FxDirector } from '../../render/fx';
import { GameRenderer } from '../../render/renderer';
import { applyMatch, type MatchSummary } from '../../systems/economy';
import { BotBrain } from '../../entities/bot';
import type { App, Screen } from '../app';
import { portraitOf } from '../components';
import { ABILITY_ICON, h, ICON, svg } from '../dom';

/**
 * Tela da partida: canvas da arena + HUD + controles.
 * Layout touch em retrato: arena acima dos controles. Em paisagem, controles
 * compactos sobre as bordas da arena. Desktop mantém WASD + mouse em tela cheia.
 */
export function gameScreen(app: App, params: Record<string, unknown>): Screen {
  const setup = params.setup as MatchSetup;
  const content = app.content;
  const settings = app.save.settings;
  const match = new LocalMatch(content, setup);
  const world = match.world;
  const player = world.player!;
  const mode = setup.mode;

  // ───────── DOM ─────────
  const root = h('div', { class: 'game' });
  const arena = h('div', { class: 'arena' });
  const canvas = h('canvas', { class: 'view' });
  arena.append(canvas);

  const timerEl = h('span', { class: 'timer' }, '0:00');
  const statusEl = h('span', null, '');
  const hudTop = h('div', { class: 'hud-top' }, h('div', { class: 'hud-status stroke' }, timerEl, h('i', { class: 'sep' }), statusEl));
  const pauseBtn = h('button', { class: 'icon-btn hud-pause', 'aria-label': 'Pausar', onclick: () => openPause() }, svg(ICON.pause));
  const killfeed = h('div', { class: 'killfeed' });
  const announce = h('div', { class: 'announce stroke' });
  const fpsEl = h('div', { class: 'fps' });
  if (!settings.showFps) fpsEl.style.display = 'none';
  const botBanner = h('div', { class: 'bot-banner' },
    h('div', { class: 'notice' }, svg(ICON.info), h('div', null, h('b', null, 'OFFLINE · '), mode.botNotice)));
  setTimeout(() => (botBanner.style.opacity = '0'), 5200);
  arena.append(hudTop, pauseBtn, killfeed, announce, fpsEl, botBanner);

  // Painel de controles
  const rarity = content.rarity(player.def.rarity);
  const hpFill = h('i', { style: 'width:100%' });
  const hpText = h('span', null, '');
  const soulsEl = h('div', { class: 'souls' });
  const pcard = h('div', { class: 'pcard', style: `--rc:${rarity.color}` },
    h('div', { class: 'row' },
      h('div', { class: 'pimg' }, h('img', { src: portraitOf(app, player.def, player.skinId, 96), alt: '' })),
      h('div', { style: 'min-width:0' }, h('div', { class: 'pn stroke' }, player.name), h('div', { class: 'small muted', style: 'font-weight:800' }, player.def.name)),
    ),
    h('div', { class: 'bar hp' }, hpFill, hpText),
    soulsEl,
  );
  const joyBase = h('div', { class: 'joy-base' });
  const joyKnob = h('div', { class: 'joy-knob' }, svg(ICON.skull));
  const joyzone = h('div', { class: 'joyzone' }, joyBase, joyKnob);
  const ab = player.ability;
  const specialBtn = h('button', { class: 'special-btn', style: `--ab:${ab.vfx.color}`, 'aria-label': `Especial: ${ab.name}` },
    h('div', { class: 'core' }, svg(ABILITY_ICON[ab.type] ?? ABILITY_ICON.aoe_burst)));
  const specialKey = h('div', { class: 'special-key' }, 'ESPAÇO · BOTÃO DIREITO');
  const specialWrap = h('div', { class: 'special-wrap' }, specialBtn, h('div', { class: 'special-name stroke' }, ab.name), specialKey);
  const controls = h('div', { class: 'controls' }, pcard, joyzone, specialWrap);
  const deskHint = h('div', { class: 'desk-hint' },
    h('kbd', null, 'WASD'), ' mover · ', h('kbd', null, 'Mouse'), ' mirar · ', h('kbd', null, 'Clique'), settings.autoFire ? ' (auto-tiro ligado)' : ' atacar', ' · ', h('kbd', null, 'Espaço'), ' especial · ', h('kbd', null, 'Esc'), ' pausa');
  root.append(arena, controls, deskHint);

  // ───────── Render / FX / loop ─────────
  const renderer = new GameRenderer(canvas, content);
  let controller: PlayerController;
  const fx = new FxDirector(renderer, audio, null);
  fx.haptics = settings.haptics;
  fx.shakeScale = settings.screenShake;
  let ended = false;
  let endT = 0;
  let prepared = false;
  let lastReady = player.specialCd <= 0;
  let paused = false;

  // Autopiloto (?autopilot=1): o jogador é controlado pela IA — usado em testes e2e/demonstração.
  const autopilot = new URLSearchParams(location.search).has('autopilot') ? new BotBrain(world, player, new Rng(7)) : null;
  const loop = new GameLoop({
    update: (dt) => {
      if (autopilot) autopilot.update(dt);
      else controller.update(dt, player, renderer.camera);
      match.step(dt);
    },
    render: (alpha, frameDt) => frame(alpha, frameDt),
  });
  fx.loop = loop;

  function makeController(): void {
    controller?.destroy();
    const desktop = inputProfile.profile === 'desktop';
    root.classList.toggle('desktop', desktop);
    root.classList.toggle('touch-landscape', !desktop && window.innerWidth > window.innerHeight);
    deskHint.style.display = desktop ? '' : 'none';
    specialKey.style.display = desktop ? '' : 'none';
    if (desktop) {
      controller = new DesktopController(canvas, { autoFire: settings.autoFire, aimMode: settings.aimMode }, () => audio.unlock());
      specialBtn.onclick = () => {
        player.input.special = true;
        player.input.specialAimX = Math.cos(player.facing);
        player.input.specialAimY = Math.sin(player.facing);
      };
    } else {
      specialBtn.onclick = null;
      controller = new TouchController(joyzone, joyBase, joyKnob, specialBtn, {
        deadZone: settings.joystick.deadZone, radius: settings.joystick.radius, smoothing: settings.joystick.smoothing, floating: settings.joystick.floating,
      }, () => audio.unlock());
    }
    layout();
  }

  function layout(): void {
    const W = window.innerWidth, H = window.innerHeight;
    const desktop = inputProfile.profile === 'desktop';
    const touchLandscape = !desktop && W > H;
    root.classList.toggle('touch-landscape', touchLandscape);
    const qDpr = settings.quality === 'alta' ? 2 : settings.quality === 'media' ? 1.5 : 1;
    const dpr = Math.min(window.devicePixelRatio || 1, qDpr);
    let arenaH: number;
    if (desktop || touchLandscape) {
      arenaH = H;
      controls.style.height = '';
    } else {
      const ch = Math.round(Math.max(168, Math.min(250, H * 0.27)));
      controls.style.height = `${ch}px`;
      arenaH = H - ch;
    }
    arena.style.height = `${arenaH}px`;
    renderer.resize(W, arenaH, dpr);
    if (desktop) renderer.camera.setViewport(0, 0, W, arenaH, Math.max(1000, W / (H / 1050)), 1050);
    else if (touchLandscape) {
      // Enquadra a largura real da arena (não a amplia até revelar exterior).
      // A altura visível deriva da proporção do viewport e mantém a transformação
      // mundo/tela da câmera, logo joystick e mira continuam alinhados.
      const viewWorldW = world.map.size.w;
      const viewWorldH = viewWorldW * arenaH / W;
      renderer.camera.setViewport(0, 0, W, arenaH, viewWorldW, viewWorldH);
    } else renderer.camera.setViewport(0, 0, W, arenaH, 600, 760);
    if (!prepared) {
      renderer.prepare(world, settings.quality);
      renderer.camera.snap(player.x, player.y);
      renderer.camera.clampTo(world.map.size.w, world.map.size.h);
      prepared = true;
    }
  }

  const offProfile = inputProfile.onChange(() => makeController());
  makeController();
  const onResize = () => layout();
  window.addEventListener('resize', onResize);
  const onVis = () => {
    if (document.hidden) {
      if (!paused && !ended) openPause();
      audio.suspend();
    } else {
      audio.resume();
    }
  };
  document.addEventListener('visibilitychange', onVis);
  audio.playMusic('battle');

  // ───────── HUD ─────────
  let lastTimer = '';
  let lastStatus = '';
  let fpsAcc = 0;
  function updateHud(dt: number): void {
    const limit = mode.win.timeLimit;
    const t = limit ? Math.max(0, limit - world.time) : world.time;
    const timer = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    if (timer !== lastTimer) {
      timerEl.textContent = timer;
      timerEl.style.color = limit && t < 20 ? '#ff7a8f' : '';
      lastTimer = timer;
    }
    let status = '';
    if (mode.kind === 'team') {
      const a = world.teamKills.get(player.team) ?? 0;
      const b = [...world.teamKills.entries()].filter(([k]) => k !== player.team).reduce((s, [, v]) => s + v, 0);
      status = `${a}|${b}`;
      if (status !== lastStatus) {
        statusEl.innerHTML = '';
        statusEl.append(h('span', { class: 'team-score' }, h('span', { class: 'a' }, `AZUL ${a}`), ' × ', h('span', { class: 'b' }, `${b} VERMELHO`), h('span', { class: 'muted small' }, ` /${mode.win.target}`)));
      }
    } else {
      status = mode.kind === 'duel' ? '1 v 1' : `☠ ${world.aliveCount()} vivos`;
      if (status !== lastStatus) statusEl.textContent = status;
    }
    lastStatus = status;

    const k = Math.max(0, player.hp / player.maxHp);
    hpFill.style.width = `${(k * 100).toFixed(1)}%`;
    hpText.textContent = player.alive ? `${Math.ceil(player.hp)}` : player.respawnT > 0 ? `Renascendo ${Math.ceil(player.respawnT)}` : 'Derrubado';
    soulsEl.textContent = mode.souls ? `◆ ${player.souls} alma${player.souls === 1 ? '' : 's'}${player.souls ? ` · +${Math.round(player.souls * content.control.souls.damageBonus * 100)}%` : ''}` : '';

    const charge = player.specialMax > 0 ? 1 - player.specialCd / player.specialMax : 1;
    specialBtn.style.setProperty('--charge', String(Math.max(0, Math.min(1, charge))));
    const ready = player.specialCd <= 0 && player.alive;
    specialBtn.classList.toggle('ready', ready);
    if (ready && !lastReady) {
      specialBtn.classList.remove('just-ready');
      void specialBtn.offsetWidth;
      specialBtn.classList.add('just-ready');
    }
    lastReady = ready;

    // feed
    const now = performance.now();
    const feed = fx.killFeed.filter((e) => now - e.t < 4500).slice(-3);
    if (killfeed.childElementCount !== feed.length || killfeed.dataset.k !== String(feed[feed.length - 1]?.t ?? '')) {
      killfeed.innerHTML = '';
      for (const e of feed) killfeed.append(h('div', { class: `kf${e.mine ? ' mine' : ''}` }, e.killer, h('span', { class: 'x' }, '☠'), e.victim));
      killfeed.dataset.k = String(feed[feed.length - 1]?.t ?? '');
    }
    while (fx.announcements.length) {
      const a = fx.announcements.shift()!;
      const el = h('div', { class: `a ${a.kind}` }, a.text);
      announce.innerHTML = '';
      announce.append(el);
    }
    if (settings.showFps) {
      fpsAcc += dt;
      if (fpsAcc > 0.5) {
        fpsAcc = 0;
        const s = loop.stats;
        fpsEl.textContent = `${s.fps} fps  sim ${s.updateMs.toFixed(2)}ms  draw ${s.renderMs.toFixed(2)}ms\nentidades ${world.fighters.length}  tiros ${world.projectiles.count}  partículas ${renderer.particles.pool.count}`;
      }
    }
  }

  function frame(alpha: number, dt: number): void {
    fx.process(world, player);
    fx.update(world, dt, settings.quality);
    const cam = renderer.camera;
    const tx = player.alive ? player.x : cam.x, ty = player.alive ? player.y : cam.y;
    cam.follow(tx, ty, player.facing, player.moving, world.map.size.w, world.map.size.h, dt, inputProfile.profile === 'desktop' ? 0.5 : 0.56);
    renderer.render(world, alpha, dt, player, {
      specialPreview: controller.specialHeld && player.specialCd <= 0,
      showAimCone: settings.aimCone && controller.aiming,
      quality: settings.quality,
      showFps: settings.showFps,
    });
    updateHud(dt);
    checkEnd(dt);
  }

  // ───────── Fim de partida ─────────
  function checkEnd(dt: number): void {
    if (ended) {
      endT += dt;
      if (endT > 2.2) finish();
      return;
    }
    const playerOut = !player.alive && player.respawnT <= 0 && mode.win.type === 'last_standing';
    if (world.phase === 'ended' || playerOut) {
      ended = true;
      endT = 0;
      loop.timeScale = 0.35; // câmera lenta no lance final
      const won = world.phase === 'ended' ? world.winnerTeam === player.team : false;
      const text = won ? 'VITÓRIA!' : playerOut ? `${player.placement}º LUGAR` : world.winnerTeam === -1 ? 'EMPATE' : 'DERROTA';
      announce.innerHTML = '';
      announce.append(h('div', { class: `a ${won ? 'kill' : 'warn'}`, style: 'font-size:56px;animation-duration:2.4s' }, text));
      audio.play(won ? 'victory' : 'defeat', 1);
    }
  }

  let finished = false;
  function finish(): void {
    if (finished) return;
    finished = true;
    loop.stop();
    const won = world.phase === 'ended' && world.winnerTeam === player.team;
    const players = setup.fighters.length;
    let placement = player.placement || (won ? 1 : players);
    if (mode.kind === 'team') placement = won ? 1 : 2;
    const summary: MatchSummary = {
      mode, mapId: world.map.id, characterId: player.def.id, won, placement, players: mode.kind === 'team' ? 2 : players,
      kills: player.kills, damage: player.damageDealt, healing: player.healingDone, specials: player.specialsUsed, souls: player.soulsCollected,
    };
    const rewards = applyMatch(content, app.save, summary, new Rng(setup.seed ^ 0xabc));
    app.persist(true);
    void app.go('results', { summary, rewards, draw: world.winnerTeam === -1 && world.phase === 'ended' }, 'iris');
  }

  // ───────── Pausa ─────────
  let closePause: (() => void) | null = null;
  function openPause(): void {
    if (paused || ended) return;
    paused = true;
    loop.pause();
    audio.play('back', 0.6);
    closePause = app.modal((close) =>
      h('div', { class: 'panel modal' },
        h('h2', { class: 'stroke' }, 'PAUSA'),
        h('p', { style: 'text-align:center;font-weight:700;color:var(--ink2);margin:0 0 6px' }, `${mode.name} · ${world.map.name}`),
        h('div', { class: 'notice info' }, svg(ICON.info), h('div', null, 'Partida offline contra bots: a pausa congela a arena inteira.')),
        h('div', { class: 'actions' },
          h('button', { class: 'btn green', onclick: () => { close(); resume(); } }, 'Continuar'),
          h('button', { class: `btn dark`, onclick: () => { settings.aimCone = !settings.aimCone; app.persist(); app.toast(settings.aimCone ? 'Cone de ataque visível' : 'Cone de ataque oculto'); } }, 'Mostrar/ocultar cone de ataque'),
          h('button', { class: `btn dark`, onclick: () => { audio.muted = !audio.muted; settings.muted = audio.muted; audio.applyVolumes(); app.persist(); app.toast(audio.muted ? 'Som desligado' : 'Som ligado'); } }, 'Som liga/desliga'),
          h('button', { class: 'btn red', onclick: () => { close(); forfeit(); } }, 'Desistir da partida'),
        ),
      ), { dismissable: false });
  }
  function resume(): void {
    paused = false;
    closePause = null;
    loop.resume();
  }
  function forfeit(): void {
    world.forfeit(player);
    paused = false;
    loop.resume();
  }

  loop.start();

  return {
    el: root,
    onKey: (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!paused) openPause();
      }
    },
    destroy: () => {
      loop.stop();
      controller.destroy();
      offProfile();
      closePause?.();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}
