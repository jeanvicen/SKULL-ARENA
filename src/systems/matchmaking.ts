import type { ContentDB } from '../content/registry';
import type { MapDef, ModeDef } from '../content/types';
import type { MatchFighterSpec, MatchSetup } from '../combat/world';
import { Rng } from '../engine/rng';

/**
 * Matchmaking LOCAL (stub honesto). Preenche as vagas com BOTS claramente
 * marcados. Quando o servidor existir (Fase 5), este módulo é substituído por
 * net/contract.ts → MatchmakingService.
 */
export const BOT_NAMES = [
  'Caveirão', 'Tíbia', 'Crânius', 'Fêmur', 'Mandíbula', 'Vértebra', 'Clavícula', 'Ossada', 'Rótula', 'Esterno',
  'Costelinha', 'Patela', 'Úmero', 'Rádio', 'Ulna', 'Sacro', 'Cóccix', 'Falange', 'Escápula', 'Atlas',
  'Calcanhar', 'Maxilar', 'Omoplata', 'Pelve', 'Tarso',
];

export interface PlayerPick {
  name: string;
  characterId: string;
  level: number;
  skinId: string;
  petId: string | null;
}

export interface MatchOptions {
  mapId?: string;
  difficulty?: 'facil' | 'normal' | 'dificil';
  seed?: number;
  /** Para salas: número de bots configurado. */
  players?: number;
  countdown?: number;
}

export function pickMap(content: ContentDB, mode: ModeDef, rng: Rng, mapId?: string): MapDef {
  if (mapId) {
    const m = content.maps.get(mapId);
    if (m && m.modes.includes(mode.id)) return m;
  }
  const pool = content.mapsForMode(mode.id);
  if (!pool.length) throw new Error(`Sem mapas para o modo ${mode.id}`);
  return rng.pick(pool);
}

export function buildMatch(content: ContentDB, modeId: string, player: PlayerPick, opts: MatchOptions = {}): MatchSetup {
  const mode = content.modes.get(modeId);
  if (!mode) throw new Error(`Modo desconhecido: ${modeId}`);
  const seed = opts.seed ?? ((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  const rng = new Rng(seed);
  const map = pickMap(content, mode, rng, opts.mapId);
  const total = Math.max(2, Math.min(opts.players ?? mode.players, mode.kind === 'team' ? mode.players : map.spawns.length));
  const difficulty = opts.difficulty ?? 'normal';

  const roster = [...content.characters.values()].filter((c) => c.id !== player.characterId);
  const names = rng.shuffle([...BOT_NAMES]);
  const fighters: MatchFighterSpec[] = [
    { characterId: player.characterId, name: player.name, team: 0, isBot: false, isPlayer: true, level: player.level, skinId: player.skinId, petId: player.petId },
  ];
  for (let i = 1; i < total; i++) {
    const def = rng.pick(roster.length ? roster : [...content.characters.values()]);
    const team = mode.kind === 'team' ? (i < (mode.teamSize ?? 3) ? 0 : 1) : i;
    const lvl = Math.max(1, Math.min(content.progression.character.maxLevel, player.level + rng.int(-1, 1)));
    fighters.push({
      characterId: def.id,
      name: names[(i - 1) % names.length],
      team,
      isBot: true,
      level: lvl,
      skinId: 'default',
      petId: null,
      difficulty,
    });
  }
  return { mode, map, fighters, seed, countdown: opts.countdown ?? 3 };
}

/** Código de sala (6 chars, sem ambíguos). Só local até existir servidor. */
export function makeRoomCode(rng: Rng): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += abc[Math.floor(rng.next() * abc.length)];
  return s;
}
