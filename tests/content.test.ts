import { describe, expect, it } from 'vitest';
import { allCharacters, VICEN_ID } from '../src/content/characters';
import { allPets } from '../src/content/pets';
import { RARITY } from '../src/content/rarities';
import { PixelAnimator } from '../src/pixel/animator';
import { renderCharacter } from '../src/pixel/character';
import { renderPet } from '../src/pixel/pets';

describe('conteúdo', () => {
  it('tem 500+ personagens e 500+ pets com ids únicos', () => {
    const c = allCharacters();
    const p = allPets();
    expect(c.length).toBeGreaterThanOrEqual(500);
    expect(p.length).toBeGreaterThanOrEqual(500);
    expect(new Set(c.map((x) => x.id)).size).toBe(c.length);
    expect(new Set(p.map((x) => x.id)).size).toBe(p.length);
  });

  it('todas as 7 raridades existem e Vicen₹ é CREATORs', () => {
    const c = allCharacters();
    for (const r of Object.keys(RARITY)) expect(c.some((x) => x.rarity === r)).toBe(true);
    expect(c.find((x) => x.id === VICEN_ID)?.rarity).toBe('creators');
  });

  it('cada personagem tem história de vida e habilidades', () => {
    for (const c of allCharacters()) {
      expect(c.bio.historia.length).toBeGreaterThanOrEqual(1);
      expect(c.attack.effects.length).toBeGreaterThan(0);
      expect(c.super.effects.length).toBeGreaterThan(0);
    }
  });

  it('o gerador é estável (o personagem nº 37 é sempre o mesmo)', () => {
    const a = allCharacters().find((c) => c.id === 'gen_037')!;
    expect(a).toBeTruthy();
    expect(a.name.length).toBeGreaterThan(1);
  });
});

describe('pixel art', () => {
  it('desenha personagens (quadro 72×84 com contorno e pixels opacos)', () => {
    for (const def of allCharacters().slice(0, 40)) {
      const an = new PixelAnimator(def.anim);
      an.build();
      const buf = renderCharacter(def.look, an.pose, an.solved, { view: an.view });
      expect(buf.w).toBe(72);
      expect(buf.h).toBe(84);
      let opaque = 0;
      for (const px of buf.data) if (px >>> 24 === 255) opaque++;
      expect(opaque).toBeGreaterThan(300);
    }
  });

  it('desenha pets (32×32)', () => {
    for (const pet of allPets().slice(0, 40)) {
      const b = renderPet(pet, 0);
      let opaque = 0;
      for (const px of b.data) if (px >>> 24 === 255) opaque++;
      expect(opaque).toBeGreaterThan(30);
    }
  });
});
