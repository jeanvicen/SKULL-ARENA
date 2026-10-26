import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/content/load';
import { CHARACTER_DIRECTION, resolveLook } from '../src/render/art/skull';

describe('redesign visual dos personagens', () => {
  const db = loadContent();

  it('atribui silhueta e assinatura de movimento a todos os personagens atuais', () => {
    const ids = [...db.characters.keys()].sort();
    expect(Object.keys(CHARACTER_DIRECTION).sort()).toEqual(ids);
    for (const def of db.characters.values()) {
      const look = resolveLook(def);
      expect(look.art.streetwear, def.id).toBeTruthy();
      expect(look.art.motion, def.id).toBeTruthy();
    }
  });

  it('preserva traços de identidade e mantém as paletas de skins', () => {
    for (const def of db.characters.values()) {
      const look = resolveLook(def);
      expect(look.art.skull).toBe(def.art.skull);
      expect(look.art.eyes).toBe(def.art.eyes);
      expect(look.art.jaw).toBe(def.art.jaw);
      expect(look.art.headwear).toBe(def.art.headwear);
      expect(look.art.weapon).toBe(def.art.weapon);
      expect(look.primary).toBe(def.palette[0]);
      expect(look.dark).toBe(def.palette[1]);
      expect(look.accent).toBe(def.palette[2]);
    }
  });
});
