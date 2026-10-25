import { describe, expect, it } from 'vitest';
import { LocalMatch } from '../src/combat/match';
import { buildMatch } from '../src/systems/matchmaking';
import { db } from './helpers';

/**
 * Partidas headless só de bots: garante que todo modo × mapa termina,
 * sem NaN, e mede o custo da simulação (meta de performance).
 */
function simulate(modeId: string, mapId: string, seed: number) {
  const setup = buildMatch(db, modeId, { name: 'Teste', characterId: 'ossinho', level: 1, skinId: 'default', petId: 'bone_bat' }, { mapId, seed, countdown: 0 });
  // O "jogador" vira bot também para a partida andar sozinha
  setup.fighters[0].isBot = true;
  const match = new LocalMatch(db, setup);
  const limit = (setup.mode.win.timeLimit ?? 300) + 30;
  let steps = 0;
  const t0 = performance.now();
  while (match.world.phase !== 'ended' && match.world.time < limit) {
    match.step(1 / 60);
    match.world.events.length = 0;
    steps++;
  }
  const ms = performance.now() - t0;
  return { world: match.world, steps, msPerStep: ms / steps };
}

describe('partidas headless (bots vs bots)', () => {
  for (const mode of db.modes.values()) {
    for (const map of db.mapsForMode(mode.id)) {
      it(`${mode.id} @ ${map.id} termina e é estável`, () => {
        const { world, msPerStep } = simulate(mode.id, map.id, 1234);
        expect(world.phase).toBe('ended');
        for (const f of world.fighters) {
          expect(Number.isFinite(f.x) && Number.isFinite(f.y)).toBe(true);
          expect(Number.isFinite(f.hp)).toBe(true);
          expect(f.x).toBeGreaterThanOrEqual(0);
          expect(f.y).toBeGreaterThanOrEqual(0);
          expect(f.x).toBeLessThanOrEqual(map.size.w);
          expect(f.y).toBeLessThanOrEqual(map.size.h);
        }
        // Meta: simulação bem abaixo de 1 frame (16,7ms) mesmo com 20 lutadores
        expect(msPerStep).toBeLessThan(4);
      });
    }
  }

  it('bots realmente lutam (causam dano e abatem)', () => {
    const { world } = simulate('cacada', 'catacumbas', 99);
    const totalDamage = world.fighters.reduce((s, f) => s + f.damageDealt, 0);
    const kills = world.fighters.reduce((s, f) => s + f.kills, 0);
    expect(totalDamage).toBeGreaterThan(10000);
    expect(kills).toBeGreaterThan(0);
  });
});
