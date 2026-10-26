import { audio } from '../../audio/audio';
import { Rng } from '../../engine/rng';
import { THEMES } from '../../render/art/map';
import { buildMatch, makeRoomCode } from '../../systems/matchmaking';
import type { App, Screen } from '../app';
import { menuBg, notice, portraitOf, topbar } from '../components';
import { h } from '../dom';
import { modeLocked } from './menu';

function difficultyFor(app: App): 'facil' | 'normal' | 'dificil' {
  const d = app.save.settings.botDifficulty;
  if (d !== 'auto') return d;
  // Auto: acompanha a evolução do jogador
  const t = app.save.trophies;
  return t < 40 ? 'facil' : t < 220 ? 'normal' : 'dificil';
}

/**
 * Matchmaking LOCAL (stub honesto): "procura", preenche com BOTS marcados
 * e revela o mapa. Nenhuma pessoa real entra aqui — e a UI diz isso.
 */
export function matchmakingScreen(app: App, params: Record<string, unknown>): Screen {
  const s = app.save;
  const content = app.content;
  const modeId = (params.modeId as string) ?? s.lastMode;
  const owned = s.characters[s.selectedCharacter];
  const setup = buildMatch(content, modeId, {
    name: s.player.name,
    characterId: s.selectedCharacter,
    level: owned?.level ?? 1,
    skinId: owned?.skin ?? 'default',
    petId: s.selectedPet,
  }, {
    mapId: params.mapId as string | undefined,
    difficulty: (params.difficulty as 'facil' | 'normal' | 'dificil' | undefined) ?? difficultyFor(app),
    players: params.players as number | undefined,
  });
  const mode = setup.mode;
  const slots = h('div', { class: 'slots' });
  const title = h('h2', { class: 'stroke', style: 'font-size:30px' }, params.roomCode ? `Sala ${params.roomCode}` : 'Procurando caveiras…');
  const sub = h('div', { class: 'muted', style: 'font-weight:800' }, `${mode.name} · ${mode.subtitle}`);
  const mapBox = h('div');
  const cancelBtn = h('button', { class: 'btn dark small', style: 'margin-top:16px' }, 'Cancelar');
  let cancelled = false;
  cancelBtn.onclick = () => {
    cancelled = true;
    app.click();
    void app.go('menu');
  };
  const el = h('div', { class: 'screen' }, menuBg(), topbar(app),
    h('div', { class: 'mm' },
      h('div', { style: 'width:100%' },
        h('div', { class: 'radar' }, h('div', { class: 'skullc' }, '💀')),
        title, sub,
        h('div', { style: 'max-width:520px;margin:10px auto 0' }, notice(mode.botNotice + ' Matchmaking online real chega com o servidor (Fase 5).')),
        slots, mapBox, cancelBtn,
      ),
    ),
  );

  const diffName = { facil: 'Fácil', normal: 'Normal', dificil: 'Difícil' }[setup.fighters[1]?.difficulty ?? 'normal'];
  const total = setup.fighters.length;
  const visible = setup.fighters.slice(0, Math.min(total, 12));
  let i = 0;
  const tick = () => {
    if (cancelled) return;
    if (i < visible.length) {
      const f = visible[i];
      const def = content.characters.get(f.characterId)!;
      const teamCol = mode.kind === 'team' ? (f.team === 0 ? '#6fc2ff' : '#ff7a8f') : f.isPlayer ? '#3df2c8' : '#ffd6dc';
      slots.append(h('div', { class: 'slot', style: `border-color:${teamCol}66` },
        h('img', { src: portraitOf(app, def, f.skinId ?? 'default', 72), alt: '' }),
        h('div', { style: 'min-width:0' }, h('div', { style: `color:${teamCol};white-space:nowrap;overflow:hidden;text-overflow:ellipsis` }, f.name), h('div', { class: 'small muted' }, def.name)),
        f.isBot ? h('span', { class: 'bot' }, 'BOT') : h('span', { class: 'bot', style: 'background:var(--cyan)' }, 'VOCÊ'),
      ));
      audio.play('click', 0.4);
      i++;
      setTimeout(tick, i === 1 ? 500 : 160 + Math.random() * 180);
    } else {
      if (total > visible.length) slots.append(h('div', { class: 'slot' }, `+${total - visible.length} BOTS`));
      title.textContent = 'Partida encontrada!';
      const T = THEMES[setup.map.theme];
      mapBox.append(h('div', { class: 'panel map-reveal', style: `border-color:${T.accent};background:linear-gradient(135deg, ${T.floorB}, ${T.outside})` },
        h('div', { class: 'display', style: 'font-size:12px;color:var(--ink3)' }, 'ARENA'),
        h('div', { class: 'display stroke', style: 'font-size:26px' }, setup.map.name),
        h('div', { class: 'small', style: 'font-weight:700;color:var(--ink2)' }, setup.map.description),
        h('div', { class: 'small', style: 'margin-top:4px;color:#ffb347;font-weight:800' }, `Bots: ${diffName}`)));
      audio.play('reward', 0.7);
      cancelBtn.remove();
      setTimeout(() => !cancelled && void app.go('game', { setup }, 'none'), 1400);
    }
  };
  setTimeout(tick, 600);
  return { el, back: 'menu', destroy: () => (cancelled = true) };
}

/** Salas privadas: configurar e jogar local; entrar por código requer servidor. */
export function roomsScreen(app: App): Screen {
  const s = app.save;
  const content = app.content;
  const code = makeRoomCode(new Rng(Date.now() >>> 0));
  let modeId = s.lastMode;
  let mapId: string | null = null;
  let difficulty: 'facil' | 'normal' | 'dificil' = 'normal';
  let players = content.modes.get(modeId)?.players ?? 6;
  const box = h('div');
  const render = () => {
    const mode = content.modes.get(modeId)!;
    const maps = content.mapsForMode(modeId);
    if (mapId && !maps.some((m) => m.id === mapId)) mapId = null;
    const maxP = mode.kind === 'team' ? mode.players : Math.min(...maps.map((m) => m.spawns.length));
    players = Math.max(2, Math.min(players, maxP));
    const seg = <T extends string>(opts: Array<[T, string]>, cur: T, set: (v: T) => void) =>
      h('div', { class: 'seg' }, ...opts.map(([v, l]) => h('button', { class: v === cur ? 'on' : '', onclick: () => { app.click(); set(v); render(); } }, l)));
    box.innerHTML = '';
    box.append(
      h('div', { class: 'panel', style: 'padding:14px;text-align:center;margin-bottom:12px' },
        h('div', { class: 'display muted', style: 'font-size:12px' }, 'CÓDIGO DA SALA'),
        h('div', { class: 'display stroke', style: 'font-size:40px;letter-spacing:6px;color:var(--gold)' }, code),
        h('div', { style: 'margin-top:8px' }, notice('Sala LOCAL: por enquanto só você + bots. Compartilhar este código para amigos entrarem requer o servidor (Fase 5).')),
      ),
      h('div', { class: 'setting' }, h('label', null, 'Modo'), seg([...content.modes.values()].filter((m) => !modeLocked(app, m)).map((m) => [m.id, m.name] as [string, string]), modeId, (v) => { modeId = v; players = content.modes.get(v)!.players; })),
      h('div', { class: 'setting' }, h('label', null, 'Arena'), seg<string>([['__rand', 'Aleatória'], ...maps.map((m) => [m.id, m.name] as [string, string])], mapId ?? '__rand', (v) => (mapId = v === '__rand' ? null : v))),
      mode.kind === 'team' ? '' : h('div', { class: 'setting' }, h('label', null, `Lutadores: ${players}`, h('small', null, `máximo ${maxP} nesta configuração`)),
        h('input', { type: 'range', min: '2', max: String(maxP), value: String(players), oninput: (e: Event) => { players = Number((e.target as HTMLInputElement).value); render(); } })),
      h('div', { class: 'setting' }, h('label', null, 'Bots'), seg([['facil', 'Fácil'], ['normal', 'Normal'], ['dificil', 'Difícil']], difficulty, (v) => (difficulty = v))),
      h('div', { style: 'display:grid;gap:10px;margin-top:12px' },
        h('button', { class: 'btn pink big', onclick: () => { app.click(); s.lastMode = modeId; app.persist(); void app.go('select', { prematch: true, modeId, matchOpts: { mapId: mapId ?? undefined, difficulty, players, roomCode: code } }); } }, 'COMEÇAR'),
        h('button', { class: 'btn dark', onclick: () => app.modal((close) => h('div', { class: 'panel modal' }, h('h2', { class: 'stroke' }, 'Entrar por código'),
          h('input', { class: 'text-in', placeholder: 'EX: K7P2QZ', maxlength: '6' }),
          h('div', { style: 'margin-top:10px' }, notice('Entrar na sala de outra pessoa requer servidor online (Fase 5). Este botão ainda não conecta a ninguém — sem fingimento.')),
          h('div', { class: 'actions' }, h('button', { class: 'btn dark', onclick: close }, 'Entendi')))) }, 'Entrar com código'),
      ),
    );
  };
  render();
  const el = h('div', { class: 'screen' }, menuBg(), topbar(app, { back: 'menu', title: 'Salas' }), h('div', { class: 'scroll' }, box));
  return { el, back: 'menu' };
}
