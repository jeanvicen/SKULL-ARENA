import { describe, expect, it } from 'vitest';
import { Rng } from '../src/engine/rng';
import {
  addXp, applyMatch, buyCharacter, buyChest, buySkin, chestOdds, claimAchievement, claimDailyGift, claimQuest,
  claimTrophyRoad, dailyOffers, openChest, questProgress, refreshQuests, upgradeCharacter, upgradeCost, xpToNext,
} from '../src/systems/economy';
import { migrate, newSave } from '../src/systems/save';
import { db } from './helpers';

describe('save', () => {
  it('conta nova começa com 5 personagens normais, pet, moedas, diamantes e baú', () => {
    const s = newSave(db, 'Jean');
    expect(Object.keys(s.characters)).toHaveLength(5);
    for (const id of Object.keys(s.characters)) expect(db.characters.get(id)!.rarity).toBe('comum');
    expect(s.coins).toBe(db.progression.startingCoins);
    expect(s.gems).toBe(db.progression.startingGems);
    expect(s.chests).toEqual(db.progression.startingChests);
    expect(s.selectedPet).toBe(db.progression.starterPet);
  });

  it('migração preenche campos novos e remove conteúdo que não existe mais', () => {
    const old = { version: 1, player: { name: 'Velho' }, characters: { ossinho: { level: 3 }, personagem_removido: { level: 1 } }, pets: ['pet_fantasma'], selectedCharacter: 'personagem_removido', chests: ['bau_ossos', 'bau_inexistente'] };
    const m = migrate(old, db)!;
    expect(m.version).toBeGreaterThan(1);
    expect(m.characters.ossinho.level).toBe(3);
    expect(m.characters.ossinho.matches).toBe(0);
    expect(m.characters.personagem_removido).toBeUndefined();
    expect(m.selectedCharacter).toBe('ossinho');
    expect(m.pets).toEqual([]);
    expect(m.chests).toEqual(['bau_ossos']);
    expect(m.settings.joystick.deadZone).toBeGreaterThan(0);
  });

  it('save inválido retorna null (não quebra o jogo)', () => {
    expect(migrate(null, db)).toBeNull();
    expect(migrate({ foo: 1 }, db)).toBeNull();
  });
});

describe('progressão', () => {
  it('XP sobe nível e dá recompensas', () => {
    const s = newSave(db, 'A');
    const coins = s.coins;
    const ups = addXp(db, s, xpToNext(db, 1) + xpToNext(db, 2) + 5);
    expect(ups.map((u) => u.level)).toEqual([2, 3]);
    expect(s.level).toBe(3);
    expect(s.xp).toBe(5);
    expect(s.coins).toBe(coins + 2 * db.progression.levelUpReward.coins);
    expect(s.chests).toContain(db.progression.levelUpReward.chest); // nível 3 = múltiplo de chestEvery
  });

  it('upgrade cobra moedas, sobe nível e respeita o máximo', () => {
    const s = newSave(db, 'A');
    s.coins = 1e6;
    const def = db.characters.get('ossinho')!;
    for (let i = 1; i < db.progression.character.maxLevel; i++) expect(upgradeCharacter(db, s, 'ossinho')).toBe(true);
    expect(s.characters.ossinho.level).toBe(db.progression.character.maxLevel);
    expect(upgradeCost(db, def, s.characters.ossinho.level)).toBeNull();
    expect(upgradeCharacter(db, s, 'ossinho')).toBe(false);
  });

  it('partida atualiza estatísticas, moedas e troféus (nunca negativos)', () => {
    const s = newSave(db, 'A');
    const mode = db.modes.get('cacada')!;
    const r = applyMatch(db, s, { mode, mapId: 'catacumbas', characterId: 'ossinho', won: false, placement: 6, players: 6, kills: 0, damage: 100, healing: 0, specials: 0, souls: 0 }, new Rng(1));
    expect(s.trophies).toBe(0);
    expect(r.trophies).toBe(0);
    expect(s.stats.matches).toBe(1);
    const r2 = applyMatch(db, s, { mode, mapId: 'catacumbas', characterId: 'ossinho', won: true, placement: 1, players: 6, kills: 5, damage: 9000, healing: 0, specials: 2, souls: 4 }, new Rng(2));
    expect(r2.trophies).toBe(mode.rewards.trophiesWin);
    expect(s.stats.wins).toBe(1);
    expect(s.stats.kills).toBe(5);
    expect(s.characters.ossinho.wins).toBe(1);
    expect(s.history).toHaveLength(2);
  });
});

describe('baús (loot table por raridade)', () => {
  it('as chances mostradas na UI somam no máximo a chance de personagem', () => {
    for (const chest of db.chests.values()) {
      const total = chestOdds(db, chest).reduce((a, r) => a + r.p, 0);
      expect(total).toBeCloseTo(chest.characterChance, 5);
    }
  });

  it('abrir dá recompensas válidas, personagens novos entram no inventário e repetidos viram moedas', () => {
    const s = newSave(db, 'A');
    const rng = new Rng(123);
    let gotChar = false, gotDup = false;
    for (let i = 0; i < 200; i++) {
      const coinsBefore = s.coins;
      const drops = openChest(db, s, 'bau_lendario', rng);
      expect(drops.length).toBeGreaterThan(0);
      for (const d of drops) {
        if (d.kind === 'character') {
          expect(db.characters.has(d.id)).toBe(true);
          expect(s.characters[d.id]).toBeDefined();
          if (d.duplicate) {
            gotDup = true;
            expect(d.coins).toBe(db.rarity(d.rarity).duplicateCoins);
          } else gotChar = true;
        }
      }
      expect(s.coins).toBeGreaterThanOrEqual(coinsBefore);
    }
    expect(gotChar && gotDup).toBe(true);
    expect(s.stats.chestsOpened).toBe(200);
  });

  it('é determinístico com a mesma semente', () => {
    const a = newSave(db, 'A'), b = newSave(db, 'B');
    expect(openChest(db, a, 'bau_sombrio', new Rng(9))).toEqual(openChest(db, b, 'bau_sombrio', new Rng(9)));
  });

  it('raridade alta é rara de verdade (distribuição respeita os pesos)', () => {
    const s = newSave(db, 'A');
    const rng = new Rng(77);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 3000; i++) {
      for (const d of openChest(db, s, 'bau_ossos', rng)) if (d.kind === 'character') counts[d.rarity] = (counts[d.rarity] ?? 0) + 1;
    }
    expect((counts.incomum ?? 0)).toBeGreaterThan((counts.extrema_rara ?? 0) * 2);
    expect((counts.creator ?? 0)).toBeLessThan((counts.raro ?? 1));
  });
});

describe('loja', () => {
  it('não compra sem saldo', () => {
    const s = newSave(db, 'A');
    s.coins = 0;
    s.gems = 0;
    expect(buyChest(db, s, 'bau_ossos')).toBe(false);
    expect(buyCharacter(db, s, 'arqueira')).toBe(false);
    expect(buySkin(db, s, 'ossinho', 'golden')).toBe(false);
  });

  it('compra e entrega', () => {
    const s = newSave(db, 'A');
    s.coins = 1e5;
    s.gems = 1e5;
    expect(buyCharacter(db, s, 'arqueira')).toBe(true);
    expect(s.characters.arqueira).toBeDefined();
    expect(buySkin(db, s, 'ossinho', 'ossinho_sideral')).toBe(true);
    expect(buySkin(db, s, 'rachada', 'ossinho_sideral')).toBe(false); // lendária exclusiva de outro personagem
    expect(buyCharacter(db, s, 'jeanvicen')).toBe(false); // CREATOR não é vendido
  });

  it('presente diário só uma vez por dia; vitrine estável no mesmo dia', () => {
    const s = newSave(db, 'A');
    const d = new Date('2026-10-25T12:00:00Z');
    expect(claimDailyGift(db, s, d)).not.toBeNull();
    expect(claimDailyGift(db, s, d)).toBeNull();
    expect(claimDailyGift(db, s, new Date('2026-10-26T12:00:00Z'))).not.toBeNull();
    expect(dailyOffers(db, s, d)).toEqual(dailyOffers(db, s, d));
  });
});

describe('missões, conquistas e troféus', () => {
  it('missão diária conta só o progresso do dia e reseta no dia seguinte', () => {
    const s = newSave(db, 'A');
    s.stats.matches = 10;
    const d1 = new Date('2026-10-25T10:00:00Z');
    refreshQuests(db, s, d1);
    expect(questProgress(s, 'diario', 'matches')).toBe(0);
    expect(claimQuest(db, s, 'diario', 'd_partidas')).toBeNull();
    s.stats.matches += 3;
    expect(questProgress(s, 'diario', 'matches')).toBe(3);
    expect(claimQuest(db, s, 'diario', 'd_partidas')).not.toBeNull();
    expect(claimQuest(db, s, 'diario', 'd_partidas')).toBeNull();
    refreshQuests(db, s, new Date('2026-10-26T10:00:00Z'));
    expect(questProgress(s, 'diario', 'matches')).toBe(0);
    expect(s.quests.diario.claimed).toEqual([]);
  });

  it('evento sazonal só existe dentro da janela', () => {
    const s = newSave(db, 'A');
    refreshQuests(db, s, new Date('2026-12-25T10:00:00Z'));
    expect(s.quests.noite_das_caveiras).toBeUndefined();
    refreshQuests(db, s, new Date('2026-10-30T10:00:00Z'));
    expect(s.quests.noite_das_caveiras).toBeDefined();
  });

  it('conquista e trilha de troféus só pagam quando atingidas, uma vez', () => {
    const s = newSave(db, 'A');
    expect(claimAchievement(db, s, 'primeira_partida')).toBeNull();
    s.stats.matches = 1;
    expect(claimAchievement(db, s, 'primeira_partida')).not.toBeNull();
    expect(claimAchievement(db, s, 'primeira_partida')).toBeNull();
    expect(claimTrophyRoad(db, s, 0)).toBeNull();
    s.trophies = 25;
    expect(claimTrophyRoad(db, s, 0)).not.toBeNull();
    expect(claimTrophyRoad(db, s, 0)).toBeNull();
  });
});
