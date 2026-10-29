import type { PassTier, Reward } from './types';

/**
 * SKULL PASS (passe de temporada)
 * -------------------------------
 * 50 níveis. Trilha GRÁTIS pra todo mundo e trilha PREMIUM liberada com Isvoid
 * ganho jogando (ECONOMY.passPremiumIsvoid) — sem dinheiro real.
 * XP do passe vem das partidas, missões e Drops.
 *
 * Pra mudar um prêmio específico, edite OVERRIDES (nível → prêmios).
 */
export const SEASON = {
  id: 's1',
  name: 'Temporada 1 · Noite Neon',
  end: '2027-01-31T23:59:59-03:00',
  tiers: 50,
  /** xp por nível (cresce devagar) */
  xpPerTier: (tier: number) => 120 + tier * 12,
};

const OVERRIDES: Record<number, { free?: Reward[]; premium?: Reward[] }> = {
  1: { free: [{ kind: 'moedas', amount: 100 }], premium: [{ kind: 'pet', id: 'pet_cranio' }] },
  10: { free: [{ kind: 'chest', id: 'bau_caveira' }], premium: [{ kind: 'randomCharacter', rarity: 'epico' }] },
  20: { free: [{ kind: 'isvoid', amount: 30 }], premium: [{ kind: 'chest', id: 'bau_mega', count: 2 }] },
  25: { free: [{ kind: 'randomCharacter', rarity: 'raro' }], premium: [{ kind: 'title', id: 'neon', text: 'Rei do Neon' }] },
  30: { free: [{ kind: 'chest', id: 'bau_mega' }], premium: [{ kind: 'randomCharacter', rarity: 'god' }] },
  40: { free: [{ kind: 'isvoid', amount: 50 }], premium: [{ kind: 'chest', id: 'bau_vazio', count: 2 }] },
  50: {
    free: [
      { kind: 'randomCharacter', rarity: 'epico' },
      { kind: 'title', id: 's1', text: 'Veterano S1' },
    ],
    premium: [
      { kind: 'pet', id: 'pet_dragao' },
      { kind: 'isvoid', amount: 150 },
    ],
  },
};

function defaultTier(t: number): { free: Reward[]; premium: Reward[] } {
  if (t % 5 === 0)
    return {
      free: [{ kind: 'chest', id: 'bau_premio' }],
      premium: [
        { kind: 'isvoid', amount: 20 },
        { kind: 'moedas', amount: 300 },
      ],
    };
  if (t % 3 === 0) return { free: [{ kind: 'isvoid', amount: 5 }], premium: [{ kind: 'randomPet', rarity: t > 30 ? 'epico' : t > 15 ? 'extremo' : 'raro' }] };
  return { free: [{ kind: 'moedas', amount: 60 + t * 4 }], premium: [{ kind: 'moedas', amount: 150 + t * 8 }] };
}

/** Lista final dos níveis (xp acumulado pra liberar cada um). */
export const PASS_TIERS: PassTier[] = (() => {
  const out: PassTier[] = [];
  let acc = 0;
  for (let t = 1; t <= SEASON.tiers; t++) {
    acc += SEASON.xpPerTier(t);
    const d = defaultTier(t);
    const o = OVERRIDES[t];
    out.push({ xp: acc, free: o?.free ?? d.free, premium: o?.premium ?? d.premium });
  }
  return out;
})();

/** Nível atual do passe (0 = nenhum) pra um xp. */
export function passTierFor(xp: number): number {
  let n = 0;
  for (const t of PASS_TIERS) if (xp >= t.xp) n++;
  return n;
}
