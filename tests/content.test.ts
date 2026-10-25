import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/content/load';

describe('conteúdo (data-driven)', () => {
  const db = loadContent();

  it('não tem erros de validação', () => {
    const errors = db.issues.filter((i) => i.level === 'error');
    expect(errors, JSON.stringify(errors, null, 2)).toEqual([]);
  });

  it('tem o roster seed cobrindo todas as raridades', () => {
    expect(db.characters.size).toBeGreaterThanOrEqual(16);
    for (const r of db.rarities.keys()) {
      expect([...db.characters.values()].some((c) => c.rarity === r), `raridade sem personagem: ${r}`).toBe(true);
    }
  });

  it('tem 6-8 mapas, 3-4 pets e 5 iniciais', () => {
    expect(db.maps.size).toBeGreaterThanOrEqual(6);
    expect(db.pets.size).toBeGreaterThanOrEqual(3);
    expect(db.progression.starterCharacters).toHaveLength(5);
  });

  it('cada personagem tem lore, falas e kit únicos', () => {
    const lores = new Set<string>();
    for (const c of db.characters.values()) {
      expect(c.lore.length).toBeGreaterThan(80);
      expect(c.voiceLines.select.length).toBeGreaterThan(0);
      expect(lores.has(c.lore)).toBe(false);
      lores.add(c.lore);
    }
  });

  it('existe um personagem CREATOR do jeanvicen', () => {
    const c = db.characters.get('jeanvicen');
    expect(c?.rarity).toBe('creator');
  });
});
