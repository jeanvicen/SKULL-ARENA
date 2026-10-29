import type { LeagueDef, Reward, TrophyRoadStep } from './types';

/**
 * ESTRADA DA MORTE (caminho de troféus), LIGAS e PRÊMIO DIÁRIO.
 * Edite as listas abaixo à vontade — a tela lê direto daqui.
 */

/** Recompensas por troféus TOTAIS da conta. */
export const TROPHY_ROAD: TrophyRoadStep[] = [
  { trophies: 10, rewards: [{ kind: 'moedas', amount: 100 }] },
  { trophies: 30, rewards: [{ kind: 'chest', id: 'bau_osso' }] },
  { trophies: 60, rewards: [{ kind: 'character', id: 'pixa' }] },
  { trophies: 100, rewards: [{ kind: 'isvoid', amount: 15 }] },
  { trophies: 150, rewards: [{ kind: 'character', id: 'ossinho' }] },
  { trophies: 220, rewards: [{ kind: 'chest', id: 'bau_caveira' }] },
  { trophies: 300, rewards: [{ kind: 'randomPet', rarity: 'raro' }] },
  { trophies: 400, rewards: [{ kind: 'moedas', amount: 600 }] },
  { trophies: 500, rewards: [{ kind: 'randomCharacter', rarity: 'raro' }] },
  { trophies: 650, rewards: [{ kind: 'isvoid', amount: 30 }] },
  { trophies: 800, rewards: [{ kind: 'chest', id: 'bau_mega' }] },
  { trophies: 1000, rewards: [{ kind: 'randomCharacter', rarity: 'extremo' }] },
  { trophies: 1250, rewards: [{ kind: 'isvoid', amount: 50 }] },
  { trophies: 1500, rewards: [{ kind: 'randomPet', rarity: 'epico' }] },
  { trophies: 1800, rewards: [{ kind: 'chest', id: 'bau_mega', count: 2 }] },
  { trophies: 2200, rewards: [{ kind: 'randomCharacter', rarity: 'epico' }] },
  { trophies: 2700, rewards: [{ kind: 'isvoid', amount: 80 }] },
  { trophies: 3300, rewards: [{ kind: 'chest', id: 'bau_vazio' }] },
  { trophies: 4000, rewards: [{ kind: 'randomCharacter', rarity: 'god' }] },
  {
    trophies: 5000,
    rewards: [
      { kind: 'title', id: 'lenda', text: 'Lenda da Arena' },
      { kind: 'isvoid', amount: 150 },
    ],
  },
];

export const LEAGUES: LeagueDef[] = [
  { id: 'osso', name: 'Osso', min: 0, color: '#c9b48a', icon: '🦴' },
  { id: 'ferro', name: 'Ferro', min: 150, color: '#9aa4b2', icon: '⛓️' },
  { id: 'bronze', name: 'Bronze', min: 400, color: '#d08a4a', icon: '🥉' },
  { id: 'prata', name: 'Prata', min: 800, color: '#d8e0ea', icon: '🥈' },
  { id: 'ouro', name: 'Ouro', min: 1400, color: '#ffd23f', icon: '🥇' },
  { id: 'diamante', name: 'Diamante', min: 2200, color: '#5de2ff', icon: '💎' },
  { id: 'mitico', name: 'Mítico', min: 3200, color: '#ff4fb4', icon: '🔮' },
  { id: 'lendario', name: 'Lendário', min: 4500, color: '#ff8a3d', icon: '👑' },
  { id: 'vazio', name: 'Vazio', min: 6000, color: '#ff3df2', icon: '₹' },
];

export function leagueFor(trophies: number): LeagueDef {
  let l = LEAGUES[0]!;
  for (const x of LEAGUES) if (trophies >= x.min) l = x;
  return l;
}

/** Prêmio diário (7 dias seguidos; no 8º volta pro dia 1). */
export const DAILY_REWARDS: Reward[][] = [
  [{ kind: 'moedas', amount: 100 }],
  [
    { kind: 'moedas', amount: 150 },
    { kind: 'passXp', amount: 50 },
  ],
  [{ kind: 'chest', id: 'bau_osso' }],
  [{ kind: 'moedas', amount: 250 }],
  [{ kind: 'isvoid', amount: 10 }],
  [{ kind: 'chest', id: 'bau_caveira' }],
  [
    { kind: 'isvoid', amount: 25 },
    { kind: 'randomPet', rarity: 'raro' },
  ],
];
