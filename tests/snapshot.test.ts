import { describe, expect, it } from 'vitest';
import { getMap } from '../src/content/maps';
import { MODE } from '../src/content/modes';
import { Rng } from '../src/engine/rng';
import { buildRoster } from '../src/game/roster';
import { getCharacter } from '../src/content/characters';
import { SnapDecoder, SnapEncoder } from '../src/net/snapshot';
import { BotDirector } from '../src/sim/bots';
import type { FighterInput, GameEvent } from '../src/sim/types';
import { World } from '../src/sim/world';

describe('rede: snapshots', () => {
  it('o mundo espelho do cliente fica igual ao do servidor', () => {
    const mode = MODE.guerra;
    const map = getMap('necropolis');
    const seed = 1234;
    const mk = () => {
      const { roster } = buildRoster(mode, new Rng(seed), [{ name: 'Humano', def: getCharacter('kaze'), pet: null, level: 1 }]);
      return new World({ map, mode, seed, roster });
    };
    const server = mk();
    const client = mk();
    const bots = new BotDirector(server, 0.7, 9);
    const enc = new SnapEncoder(server);
    const dec = new SnapDecoder(client);
    const inputs: Array<FighterInput | undefined> = [];
    let events: GameEvent[] = [];
    let shoots = 0;
    for (let i = 0; i < 60 * 25; i++) {
      bots.fill(inputs, 1 / 60);
      events.push(...server.step(inputs));
      if (i % 3 === 0) {
        const snap = JSON.parse(JSON.stringify(enc.encode(events)));
        events = [];
        const out = dec.apply(snap);
        shoots += out.filter((e) => e.type === 'shoot').length;
        for (const e of out) if (e.type === 'shoot') expect(e.ability.effects).toBeDefined();
      }
    }
    // foto final (o servidor andou alguns passos depois da última)
    dec.apply(JSON.parse(JSON.stringify(enc.encode(events))));
    expect(shoots).toBeGreaterThan(0);
    server.fighters.forEach((f, i) => {
      const c = client.fighters[i]!;
      expect(Math.abs(c.x - f.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(c.y - f.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(c.hp - f.hp)).toBeLessThanOrEqual(1);
      expect(c.alive).toBe(f.alive);
      expect(c.stats.kills).toBe(f.stats.kills);
    });
    expect(client.scores).toEqual(server.scores);
    expect(Array.from(client.map.tiles)).toEqual(Array.from(server.map.tiles));
    expect(client.projectiles.length).toBe(server.projectiles.filter((p) => p.alive).length);
  });
});
