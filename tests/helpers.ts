import { loadContent } from '../src/content/load';
import type { MapDef, ModeDef } from '../src/content/types';
import { World, type MatchFighterSpec } from '../src/combat/world';

export const db = loadContent();

/** Mapa vazio para testes isolados de mecânica. */
export function emptyMap(extra: Partial<MapDef> = {}): MapDef {
  return {
    id: 'test_map', name: 'Teste', description: '', theme: 'crypt',
    size: { w: 1200, h: 1200 }, spawns: [{ x: 600, y: 600 }], obstacles: [], modes: ['duelo'],
    bg: '', palette: ['#000', '#111'], ...extra,
  };
}

export function duelMode(): ModeDef {
  return { ...db.modes.get('duelo')!, win: { type: 'last_standing' } };
}

export function makeWorld(fighters: Array<Partial<MatchFighterSpec> & { characterId: string }>, map = emptyMap(), mode = duelMode(), seed = 1): World {
  const specs: MatchFighterSpec[] = fighters.map((f, i) => ({
    name: `F${i}`, team: i, isBot: i > 0, isPlayer: i === 0, level: 1, ...f,
  }));
  const w = new World(db, { mode, map, fighters: specs, seed, countdown: 0 });
  for (const f of w.fighters) f.invuln = 0;
  return w;
}

export function place(w: World, idx: number, x: number, y: number): void {
  const f = w.fighters[idx];
  f.x = f.px = x;
  f.y = f.py = y;
}

export function run(w: World, seconds: number, beforeStep?: () => void): void {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) {
    beforeStep?.();
    w.step(1 / 60);
  }
}
