import type { CharacterDef, RarityId } from '../types';
import { generateCharacters } from '../generator/characters';
import { RARITY } from '../rarities';
import kaze from './handmade/kaze';
import marreta from './handmade/marreta';
import djkiko from './handmade/djkiko';
import vicen from './handmade/vicen';
import rua from './handmade/rua';
import elite from './handmade/elite';
import boss from './handmade/boss';
// <novo-personagem-import> (o script `npm run novo:personagem` adiciona imports aqui)

/**
 * REGISTRO DE PERSONAGENS
 * -----------------------
 * HANDMADE = feitos à mão (arquivos em ./handmade). GENERATED_COUNT = quantos o gerador cria.
 * Total no jogo = feitos à mão + gerados (passa de 500).
 */
export const HANDMADE: CharacterDef[] = [
  kaze,
  marreta,
  djkiko,
  ...rua,
  ...elite,
  vicen,
  // <novo-personagem-lista>
];

/** Quantidade de personagens gerados automaticamente (aumente pra ter mais; os antigos não mudam). */
export const GENERATED_COUNT = 506;

/** Personagens grátis do início. */
export const STARTERS = ['kaze', 'marreta', 'djkiko'];

/** O personagem CREATORs de assinatura. */
export const VICEN_ID = 'vicen_creator';

export const BOSS = boss;

let all: CharacterDef[] | null = null;
let byId: Map<string, CharacterDef> | null = null;

export function allCharacters(): CharacterDef[] {
  if (!all) {
    const gen = generateCharacters(
      GENERATED_COUNT,
      HANDMADE.map((c) => c.name),
    );
    all = [...HANDMADE, ...gen].filter((c) => c.status !== 'test');
    all.sort((a, b) => RARITY[a.rarity].tier - RARITY[b.rarity].tier || (a.handmade === b.handmade ? 0 : a.handmade ? -1 : 1));
    byId = new Map(all.map((c) => [c.id, c]));
    byId.set(boss.id, boss);
  }
  return all;
}

export function getCharacter(id: string): CharacterDef {
  allCharacters();
  return byId!.get(id) ?? byId!.get('kaze')!;
}

export function hasCharacter(id: string): boolean {
  allCharacters();
  return byId!.has(id);
}

export function charactersByRarity(r: RarityId): CharacterDef[] {
  return allCharacters().filter((c) => c.rarity === r);
}
