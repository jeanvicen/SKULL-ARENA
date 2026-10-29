import { allCharacters } from '../content/characters';
import { RARITY } from '../content/rarities';
import type { CharacterDef, ModeDef, PetDef } from '../content/types';
import type { Rng } from '../engine/rng';
import type { RosterEntry } from '../sim/world';

/**
 * MONTAGEM DO ELENCO DA PARTIDA (usado no modo local E no servidor online)
 *  • humanos: todos no MESMO time nos modos de equipe (é assim que "jogar com amigos" funciona)
 *  • o resto das vagas vira BOT (sempre marcado como BOT no jogo)
 *  • os times ficam com o mesmo número de lutadores
 */

export const BOT_NAMES = [
  'Rato',
  'Zica',
  'Mago22',
  'Pivete',
  'Neném',
  'Cabeça',
  'Lagartixa',
  'Sombra',
  'Trovão',
  'Faísca',
  'Bigode',
  'Formiga',
  'Doidão',
  'Pancada',
  'Goiaba',
  'Tchuco',
  'Biscoito',
  'Brisa',
  'Caveirinha',
  'Dentinho',
  'Gelinho',
  'Chumbinho',
  'Marola',
  'Pirata',
  'Corvo',
  'Bala',
  'Fumaça',
  'Pixel',
  'Tampinha',
  'Japa',
  'Teco',
  'Vovó',
  'Rodinha',
  'Cobra',
  'Pé de Pano',
  'Nuvem',
  'Cometa',
  'Grilo',
  'Ventania',
  'Carrapato',
];

export interface HumanSlot {
  name: string;
  def: CharacterDef;
  pet: PetDef | null;
  level: number;
  /** jogador deste aparelho (câmera/HUD) */
  isLocal?: boolean;
}

export function buildRoster(mode: ModeDef, rng: Rng, humans: HumanSlot[], opts: { partyNames?: string[] } = {}): { roster: RosterEntry[]; boss: boolean } {
  const boss = !!mode.modifiers?.boss;
  const total = boss ? mode.players - 1 : mode.players;
  const roster: RosterEntry[] = humans.slice(0, total).map((hm) => ({ name: hm.name, def: hm.def, team: 0, isBot: false, isLocal: !!hm.isLocal, pet: hm.pet, level: hm.level }));
  const names = rng.shuffle(BOT_NAMES.filter((n) => !humans.some((hm) => hm.name === n)));
  const pool = allCharacters();
  // bots usam mais personagens comuns/raros (os muito raros aparecem pouco)
  const weights = pool.map((c) => [10, 8, 6, 3, 1.6, 0.6, 0.15][RARITY[c.rarity].tier] ?? 1);
  const party = [...(opts.partyNames ?? [])];
  const avgLevel = Math.round(humans.reduce((s, hm) => s + hm.level, 0) / Math.max(1, humans.length));
  const count = [roster.length, 0];
  let n = 0;
  while (roster.length < total) {
    // equipes: completa o time com menos gente (o seu time primeiro com os amigos)
    const team = boss ? 0 : mode.teams === 2 ? (count[0]! <= count[1]! ? 0 : 1) : roster.length;
    if (mode.teams === 2 || boss) count[team]!++;
    const def = rng.weighted(pool, weights);
    const friend = team === 0 && party.length ? party.shift() : undefined;
    roster.push({ name: friend ?? names[n++ % names.length]!, def, team, isBot: true, level: rng.int(1, Math.max(1, Math.min(10, avgLevel + 1))), pet: null });
  }
  return { roster, boss };
}
