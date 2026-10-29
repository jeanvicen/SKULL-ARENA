import { superRateFor } from '../abilities';
import type { AbilityDef, BaseStats, CharacterDef } from '../types';

/**
 * Ajudante pra criar personagem: preenche o que faltar com valores padrão.
 * `superRate` é calculado sozinho a partir do dano do ataque básico (super enche
 * com ~4,5 acertos). Se quiser outro ritmo, passe `stats.superRate`.
 */
export type CharacterInput = Omit<CharacterDef, 'stats'> & { stats: Partial<BaseStats> & Pick<BaseStats, 'hp'> };

export function defineCharacter(c: CharacterInput): CharacterDef {
  const dmg = attackDamage(c.attack);
  return {
    handmade: true,
    status: 'live',
    ...c,
    stats: {
      speed: 255,
      ammo: 3,
      reload: 1.4,
      superRate: superRateFor(dmg),
      ...c.stats,
    },
  };
}

/** Dano total de um uso do ataque (soma de todos os projéteis/golpes). */
export function attackDamage(ab: AbilityDef): number {
  let total = 0;
  for (const e of ab.effects) {
    if (e.kind === 'projectile') {
      const n = (e.count ?? 1) * (e.burst ?? 1);
      // leques: em média ~60% dos projéteis acertam
      total += e.proj.damage * (n > 3 ? n * 0.6 : n) + (e.proj.explode?.damage ?? 0) * 0.5;
    } else if (e.kind === 'melee') total += e.damage;
    else if (e.kind === 'aoe') total += e.damage ?? 0;
  }
  return Math.max(200, total);
}
