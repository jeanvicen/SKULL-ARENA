import { LocalMatch } from '../../src/combat/match';
import type { ContentDB } from '../../src/content/registry';
import type { MatchSetup } from '../../src/combat/world';

/**
 * Matriz de balanceamento 1v1: cada personagem enfrenta todos os outros
 * (bots iguais, mesmo nível) em vários mapas/sementes. Uso em desenvolvimento.
 */
export function duelMatrix(db: ContentDB, seeds = 4, maps = ['catacumbas', 'cemiterio', 'templo_dourado']) {
  const ids = [...db.characters.keys()];
  const wins: Record<string, number> = {};
  const games: Record<string, number> = {};
  const mode = { ...db.modes.get('duelo')!, win: { type: 'last_standing' as const, timeLimit: 90 } };
  for (const a of ids) for (const b of ids) {
    if (a >= b) continue;
    for (const mapId of maps) for (let s = 0; s < seeds; s++) {
      const map = db.maps.get(mapId)!;
      const setup: MatchSetup = {
        mode, map, seed: (s + 1) * 7919 + a.length * 31 + b.length, countdown: 0,
        fighters: [
          { characterId: a, name: a, team: 0, isBot: true, level: 1, difficulty: 'normal' },
          { characterId: b, name: b, team: 1, isBot: true, level: 1, difficulty: 'normal' },
        ],
      };
      // alterna lados para eliminar vantagem de spawn
      if (s % 2) setup.fighters.reverse();
      const m = new LocalMatch(db, setup);
      while (m.world.phase !== 'ended' && m.world.time < 100) { m.step(1 / 60); m.world.events.length = 0; }
      const w = m.world.fighters.find((f) => f.team === m.world.winnerTeam && !f.isMinion);
      games[a] = (games[a] ?? 0) + 1;
      games[b] = (games[b] ?? 0) + 1;
      if (w) wins[w.def.id] = (wins[w.def.id] ?? 0) + 1;
      else { wins[a] = (wins[a] ?? 0) + 0.5; wins[b] = (wins[b] ?? 0) + 0.5; }
    }
  }
  return ids.map((id) => ({ id, rate: (wins[id] ?? 0) / games[id] })).sort((x, y) => y.rate - x.rate);
}
