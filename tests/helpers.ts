import { allCharacters, getCharacter } from '../src/content/characters';
import { MODE } from '../src/content/modes';
import { getMap } from '../src/content/maps';
import type { ModeId } from '../src/content/types';
import { BotDirector } from '../src/sim/bots';
import type { FighterInput } from '../src/sim/types';
import { World, type RosterEntry } from '../src/sim/world';
import { Rng } from '../src/engine/rng';

/** Monta uma partida só de bots e roda até o fim (ou `maxSeconds`). */
export function runBotMatch(opts: { mode: ModeId; map: string; seed: number; maxSeconds?: number; ids?: string[]; difficulty?: number }) {
  const mode = MODE[opts.mode];
  const rng = new Rng(opts.seed);
  const pool = allCharacters();
  const roster: RosterEntry[] = [];
  for (let i = 0; i < mode.players; i++) {
    const def = opts.ids?.[i] ? getCharacter(opts.ids[i]!) : rng.pick(pool);
    roster.push({ name: `BOT ${i}`, def, team: mode.teams === 2 ? i % 2 : i, isBot: true, level: 1 });
  }
  const world = new World({ map: getMap(opts.map), mode, seed: opts.seed, roster, skipCountdown: true });
  const bots = new BotDirector(world, opts.difficulty ?? 0.6, opts.seed);
  const inputs: Array<FighterInput | undefined> = [];
  const maxSteps = (opts.maxSeconds ?? mode.duration + 5) * 60;
  let events = 0;
  for (let s = 0; s < maxSteps && !world.over; s++) {
    bots.fill(inputs, 1 / 60);
    events += world.step(inputs).length;
  }
  return { world, events };
}
