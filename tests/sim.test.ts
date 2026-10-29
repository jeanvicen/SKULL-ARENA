import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/content/maps';
import { runBotMatch } from './helpers';

describe('simulação', () => {
  it('Guerra de Gangues 10 vs 10 com BOTs termina com vencedor', () => {
    const { world } = runBotMatch({ mode: 'guerra', map: 'necropolis', seed: 11 });
    expect(world.over).toBe(true);
    expect(world.winner).toBeGreaterThanOrEqual(-1);
    expect(world.fighters).toHaveLength(20);
    const kills = world.fighters.reduce((s, f) => s + f.stats.kills, 0);
    expect(kills).toBeGreaterThan(10);
  });

  it('Todos contra Todos termina e dá colocações únicas', () => {
    const { world } = runBotMatch({ mode: 'ffa', map: 'beco13', seed: 5 });
    expect(world.over).toBe(true);
    const places = world.fighters.map((f) => world.placement(f)).sort((a, b) => a - b);
    expect(places).toEqual(world.fighters.map((_, i) => i + 1));
  });

  it('é determinística: mesma semente = mesmo resultado', () => {
    const a = runBotMatch({ mode: 'guerra', map: 'fabrica', seed: 99, maxSeconds: 40 });
    const b = runBotMatch({ mode: 'guerra', map: 'fabrica', seed: 99, maxSeconds: 40 });
    expect(a.world.scores).toEqual(b.world.scores);
    expect(a.world.fighters.map((f) => [Math.round(f.x), Math.round(f.y), f.hp])).toEqual(b.world.fighters.map((f) => [Math.round(f.x), Math.round(f.y), f.hp]));
  });

  it('roda em todos os mapas sem quebrar', () => {
    for (const m of MAPS) {
      const r = runBotMatch({ mode: m.modes[0]!, map: m.id, seed: 3, maxSeconds: 20 });
      expect(r.events).toBeGreaterThan(0);
    }
  });

  it('paredes destrutíveis quebram durante a partida', () => {
    const { world } = runBotMatch({ mode: 'guerra', map: 'necropolis', seed: 21, maxSeconds: 120 });
    expect(world.map.version).toBeGreaterThan(0);
  });
});
