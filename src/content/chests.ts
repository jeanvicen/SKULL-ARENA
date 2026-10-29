import type { ChestDef, RarityId } from './types';

/**
 * BAÚS
 * ----
 * Cada baú tem `rolls` cartas. Em CADA carta o jogo sorteia, em ordem:
 *   1) personagem por raridade (characterOdds)  2) pet por raridade (petOdds)
 *   3) se nada saiu → pacote de Moedas da Morte.
 * `vicenOdds` = chance do Vicen₹ por ABERTURA (antes das cartas).
 * `pity` = garantia: depois de N aberturas sem a raridade, a próxima garante.
 *
 * As chances aparecem pro jogador no botão "Chances" de cada baú (transparência).
 * Quer mudar? Edite os números. A soma de characterOdds + petOdds deve ficar ≤ 1.
 */
export const CHESTS: ChestDef[] = [
  {
    id: 'bau_osso',
    name: 'Baú de Osso',
    desc: 'O baú do dia a dia. Moedas e chance de personagens comuns e incomuns.',
    color: '#c9b48a',
    glow: '#fff3d6',
    tier: 1,
    price: { currency: 'moedas', amount: 150 },
    rolls: 2,
    moedas: [30, 70],
    characterOdds: { comum: 0.22, incomum: 0.1, raro: 0.035, extremo: 0.01, epico: 0.003, god: 0.0008 },
    petOdds: { comum: 0.14, incomum: 0.07, raro: 0.025, extremo: 0.008, epico: 0.002, god: 0.0005 },
  },
  {
    id: 'bau_caveira',
    name: 'Baú da Caveira',
    desc: 'Mais cartas e chances melhores. O favorito da quebrada.',
    color: '#8a4bff',
    glow: '#e2c6ff',
    tier: 2,
    price: { currency: 'moedas', amount: 600 },
    rolls: 4,
    moedas: [80, 160],
    characterOdds: { comum: 0.2, incomum: 0.14, raro: 0.07, extremo: 0.03, epico: 0.012, god: 0.004, creators: 0.0008 },
    petOdds: { comum: 0.12, incomum: 0.09, raro: 0.05, extremo: 0.02, epico: 0.008, god: 0.002, creators: 0.0003 },
    pity: { rarity: 'epico', after: 25 },
  },
  {
    id: 'bau_mega',
    name: 'Mega Baú Neon',
    desc: '8 cartas, chance real de GOD. Pra quem guardou moeda.',
    color: '#ff3d8a',
    glow: '#ffc2dc',
    tier: 3,
    price: { currency: 'moedas', amount: 1800 },
    rolls: 8,
    moedas: [200, 380],
    characterOdds: { comum: 0.16, incomum: 0.14, raro: 0.1, extremo: 0.05, epico: 0.022, god: 0.008, creators: 0.0015 },
    petOdds: { comum: 0.1, incomum: 0.08, raro: 0.06, extremo: 0.03, epico: 0.012, god: 0.004, creators: 0.0006 },
    pity: { rarity: 'god', after: 30 },
  },
  {
    id: 'bau_vazio',
    name: 'Drop do Vazio',
    desc: 'Baú de Isvoid. 1% de chance do VICEN₹ em toda abertura — e garantia depois de 100.',
    color: '#141026',
    glow: '#ff3df2',
    tier: 5,
    price: { currency: 'isvoid', amount: 120 },
    rolls: 5,
    moedas: [100, 200],
    isvoid: [0, 6],
    characterOdds: { raro: 0.16, extremo: 0.12, epico: 0.07, god: 0.025, creators: 0.004 },
    petOdds: { raro: 0.12, extremo: 0.08, epico: 0.05, god: 0.018, creators: 0.003 },
    vicenOdds: 0.01,
    pity: { rarity: 'creators', after: 100 },
  },
  {
    id: 'bau_evento_halloween',
    name: 'Abóbora Maldita',
    desc: 'Só no evento Noite das Caveiras. Personagem em destaque com chance em dobro.',
    color: '#ff7a1a',
    glow: '#ffd23f',
    tier: 4,
    price: { currency: 'moedas', amount: 900 },
    rolls: 5,
    moedas: [120, 240],
    characterOdds: { incomum: 0.14, raro: 0.1, extremo: 0.05, epico: 0.02, god: 0.006, creators: 0.001 },
    petOdds: { incomum: 0.1, raro: 0.06, extremo: 0.03, epico: 0.012, god: 0.004 },
  },
  {
    // recompensa (não é vendido): sai da Estrada da Morte, passe e missões
    id: 'bau_premio',
    name: 'Baú de Prêmio',
    desc: 'Prêmio de missão, passe ou estrada.',
    color: '#3db8ff',
    glow: '#c6ecff',
    tier: 2,
    rolls: 3,
    moedas: [60, 120],
    characterOdds: { comum: 0.2, incomum: 0.14, raro: 0.07, extremo: 0.03, epico: 0.012, god: 0.004, creators: 0.0008 },
    petOdds: { comum: 0.12, incomum: 0.09, raro: 0.05, extremo: 0.02, epico: 0.008, god: 0.002 },
  },
];

export const CHEST: Record<string, ChestDef> = Object.fromEntries(CHESTS.map((c) => [c.id, c]));

/** baús que aparecem na loja sempre */
export const SHOP_CHESTS = ['bau_osso', 'bau_caveira', 'bau_mega', 'bau_vazio'];

/** Tabela "Chances" (porcentagem por carta) pra mostrar ao jogador. */
export function chestOddsTable(c: ChestDef): Array<{ label: string; rarity?: RarityId; pct: number }> {
  const rows: Array<{ label: string; rarity?: RarityId; pct: number }> = [];
  for (const [r, p] of Object.entries(c.characterOdds)) rows.push({ label: 'Personagem', rarity: r as RarityId, pct: (p ?? 0) * 100 });
  for (const [r, p] of Object.entries(c.petOdds)) rows.push({ label: 'Pet', rarity: r as RarityId, pct: (p ?? 0) * 100 });
  const used = rows.reduce((s, r) => s + r.pct, 0);
  rows.push({ label: 'Moedas da Morte', pct: Math.max(0, 100 - used) });
  return rows;
}

/**
 * DROP DA CAVEIRA — prêmio rápido ganho nas vitórias (até ECONOMY.dropsPerDay por dia).
 * A raridade do drop "sobe" na animação; cada raridade tem uma lista de prêmios possíveis.
 */
export const DROP_RARITY: Array<{ id: RarityId; chance: number }> = [
  { id: 'comum', chance: 0.5 },
  { id: 'incomum', chance: 0.28 },
  { id: 'raro', chance: 0.14 },
  { id: 'extremo', chance: 0.05 },
  { id: 'epico', chance: 0.025 },
  { id: 'god', chance: 0.005 },
];

export const DROP_REWARDS: Record<RarityId, Array<{ w: number; r: import('./types').Reward }>> = {
  comum: [
    { w: 6, r: { kind: 'moedas', amount: 30 } },
    { w: 3, r: { kind: 'passXp', amount: 40 } },
    { w: 1, r: { kind: 'xp', amount: 40 } },
  ],
  incomum: [
    { w: 6, r: { kind: 'moedas', amount: 70 } },
    { w: 3, r: { kind: 'passXp', amount: 90 } },
    { w: 1, r: { kind: 'isvoid', amount: 3 } },
  ],
  raro: [
    { w: 5, r: { kind: 'moedas', amount: 160 } },
    { w: 3, r: { kind: 'isvoid', amount: 6 } },
    { w: 2, r: { kind: 'randomPet', rarity: 'raro' } },
  ],
  extremo: [
    { w: 5, r: { kind: 'moedas', amount: 350 } },
    { w: 3, r: { kind: 'isvoid', amount: 14 } },
    { w: 2, r: { kind: 'randomCharacter', rarity: 'raro' } },
  ],
  epico: [
    { w: 4, r: { kind: 'chest', id: 'bau_mega' } },
    { w: 3, r: { kind: 'isvoid', amount: 30 } },
    { w: 3, r: { kind: 'randomCharacter', rarity: 'extremo' } },
  ],
  god: [
    { w: 5, r: { kind: 'randomCharacter', rarity: 'epico' } },
    { w: 3, r: { kind: 'isvoid', amount: 80 } },
    { w: 2, r: { kind: 'randomCharacter', rarity: 'god' } },
  ],
  creators: [{ w: 1, r: { kind: 'isvoid', amount: 200 } }],
};
