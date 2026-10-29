import type { ModeId, RarityId } from './types';

/**
 * ECONOMIA — todos os números de recompensa num lugar só.
 * Quer o jogo mais "generoso"? Aumente aqui. Nada disso usa dinheiro real.
 *
 *  • Moedas da Morte  → moeda principal (partidas, missões, baús, loja).
 *  • Isvoid           → moeda rara (repetidos, passe, estrada, eventos, códigos).
 */
export const ECONOMY = {
  /** perfil novo começa com: */
  start: { moedas: 500, isvoid: 20 },

  /** Moedas da Morte por partida */
  match: {
    win: 40,
    lose: 18,
    draw: 25,
    perKill: 2,
    perSkull: 1,
    /** cada moedinha pega no chão */
    perCoin: 1,
    /** teto por partida (sem contar evento/pet) */
    max: 120,
    /** FFA: moedas extras por colocação (1º, 2º, 3º…) */
    ffaPlace: [30, 20, 14, 8, 4, 0, 0, 0, 0, 0],
  },

  /** XP da conta por partida */
  xp: { win: 30, lose: 15, perKill: 3 },
  /** XP do Skull Pass por partida */
  passXp: { win: 60, lose: 30, draw: 40 },

  /** Troféus por partida (vitória/derrota), por faixa de troféus do personagem */
  trophies: {
    bands: [
      { upTo: 100, win: 10, lose: 0 },
      { upTo: 300, win: 9, lose: -2 },
      { upTo: 600, win: 8, lose: -4 },
      { upTo: 1000, win: 7, lose: -6 },
      { upTo: Infinity, win: 6, lose: -7 },
    ],
    /** FFA: troféus por colocação (1º..10º) */
    ffa: [12, 9, 7, 5, 3, 1, 0, -2, -4, -6],
  },

  /** Nível do personagem: custo em Moedas pra ir do nível N pro N+1 (índice = N) */
  upgradeCost: [0, 40, 80, 140, 220, 340, 500, 720, 1000, 1400],
  maxLevel: 10,

  /** XP da conta pra cada nível: base + nível * passo */
  accountLevel: { base: 120, step: 40 },
  /** presente a cada nível novo da conta */
  levelUpReward: { moedas: 60, isvoidEvery5: 15 },

  /** Drop da Caveira: quantos por dia (ganha 1 a cada vitória) */
  dropsPerDay: 5,

  /** Skull Pass premium: liberado com Isvoid ganho jogando (sem dinheiro real) */
  passPremiumIsvoid: 250,

  /** Repetido: quantas Moedas vale um pet repetido, por raridade */
  petDuplicateMoedas: { comum: 20, incomum: 40, raro: 80, extremo: 150, epico: 300, god: 600, creators: 2000 } satisfies Record<RarityId, number>,

  /** Preço de pet na loja (Moedas), por raridade */
  petShopPrice: { comum: 250, incomum: 600, raro: 1200, extremo: 2400, epico: 5000, god: 11000, creators: 0 } satisfies Record<RarityId, number>,

  /** modos que contam troféus (os outros só dão moedas/xp) */
  rankedModes: ['guerra', 'ffa', 'meteoro', 'so_super'] as ModeId[],
} as const;

/** XP necessário pra passar do nível `lvl` pro próximo. */
export function xpForLevel(lvl: number): number {
  return ECONOMY.accountLevel.base + (lvl - 1) * ECONOMY.accountLevel.step;
}
