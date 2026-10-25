import type { ContentDB } from '../content/registry';
import type { CharacterDef, ChestDef, EventDef, ModeDef, RarityId, StatKey } from '../content/types';
import { Rng } from '../engine/rng';
import type { SaveData } from './save';

/**
 * Progressão e economia como funções puras sobre SaveData (testáveis).
 * Sem monetização enganosa: preços e chances vêm dos JSONs e são mostrados na UI.
 */

export function xpToNext(content: ContentDB, level: number): number {
  const c = content.progression.xpCurve;
  return Math.round(c.base * Math.pow(c.growth, level - 1));
}

export interface Reward {
  coins?: number;
  gems?: number;
  xp?: number;
  chest?: string;
  title?: string;
}

export interface LevelUp {
  level: number;
  reward: Reward;
}

export function grant(content: ContentDB, s: SaveData, r: Reward): LevelUp[] {
  if (r.coins) s.coins += r.coins;
  if (r.gems) s.gems += r.gems;
  if (r.chest && content.chests.has(r.chest)) s.chests.push(r.chest);
  if (r.title && !s.titles.includes(r.title)) s.titles.push(r.title);
  return r.xp ? addXp(content, s, r.xp) : [];
}

export function addXp(content: ContentDB, s: SaveData, xp: number): LevelUp[] {
  const ups: LevelUp[] = [];
  const max = content.progression.maxPlayerLevel;
  s.xp += xp;
  while (s.level < max && s.xp >= xpToNext(content, s.level)) {
    s.xp -= xpToNext(content, s.level);
    s.level++;
    s.stats.level = s.level;
    const lr = content.progression.levelUpReward;
    const reward: Reward = { coins: lr.coins, gems: lr.gems };
    if (lr.chestEvery > 0 && s.level % lr.chestEvery === 0) reward.chest = lr.chest;
    grant(content, s, reward);
    ups.push({ level: s.level, reward });
  }
  if (s.level >= max) s.xp = 0;
  return ups;
}

export function canAfford(s: SaveData, price?: { coins?: number; gems?: number }): boolean {
  if (!price) return false;
  return (price.coins ?? 0) <= s.coins && (price.gems ?? 0) <= s.gems;
}

export function pay(s: SaveData, price?: { coins?: number; gems?: number }): boolean {
  if (!price || !canAfford(s, price)) return false;
  s.coins -= price.coins ?? 0;
  s.gems -= price.gems ?? 0;
  return true;
}

export function giveCharacter(s: SaveData, id: string): void {
  if (s.characters[id]) return;
  s.characters[id] = { level: 1, skins: ['default'], skin: 'default', obtainedAt: new Date().toISOString(), matches: 0, wins: 0 };
}

// ─────────────────────────── upgrades ───────────────────────────

export function upgradeCost(content: ContentDB, def: CharacterDef, level: number): number | null {
  const pc = content.progression.character;
  if (level >= pc.maxLevel) return null;
  const base = pc.upgradeCosts[level] ?? pc.upgradeCosts[pc.upgradeCosts.length - 1];
  return Math.round(base * content.rarity(def.rarity).upgradeCostMul);
}

export function upgradeCharacter(content: ContentDB, s: SaveData, id: string): boolean {
  const owned = s.characters[id];
  const def = content.characters.get(id);
  if (!owned || !def) return false;
  const cost = upgradeCost(content, def, owned.level);
  if (cost === null || s.coins < cost) return false;
  s.coins -= cost;
  owned.level++;
  s.stats.upgrades++;
  return true;
}

// ─────────────────────────── baús ───────────────────────────

export type ChestDrop =
  | { kind: 'coins'; amount: number }
  | { kind: 'gems'; amount: number }
  | { kind: 'character'; id: string; rarity: RarityId; duplicate: boolean; coins: number };

/** Probabilidades por raridade de um baú (mostradas na UI — transparência). */
export function chestOdds(content: ContentDB, chest: ChestDef): Array<{ rarity: RarityId; p: number }> {
  const rows = content.sortedRarities().map((r) => ({ rarity: r.id, w: r.chestWeight * (chest.rarityBoost?.[r.id] ?? 1) }));
  const avail = rows.filter((r) => [...content.characters.values()].some((c) => c.rarity === r.rarity && c.obtain.includes('chest')));
  const total = avail.reduce((s, r) => s + r.w, 0) || 1;
  return avail.map((r) => ({ rarity: r.rarity, p: (r.w / total) * chest.characterChance }));
}

export function openChest(content: ContentDB, s: SaveData, chestId: string, rng: Rng, luck = 0): ChestDrop[] {
  const chest = content.chests.get(chestId);
  if (!chest) return [];
  const drops: ChestDrop[] = [];
  let coins = 0;
  let gems = 0;
  const pool = [...content.characters.values()].filter((c) => c.obtain.includes('chest'));
  for (let i = 0; i < chest.rolls; i++) {
    if (rng.chance(Math.min(0.95, chest.characterChance * (1 + luck)))) {
      // Sorteia raridade pelos pesos (com boost do baú), depois o personagem
      const rows = content.sortedRarities().filter((r) => pool.some((c) => c.rarity === r.id));
      const idx = rng.weighted(rows.map((r) => r.chestWeight * (chest.rarityBoost?.[r.id] ?? 1)));
      const rarity = rows[idx];
      const candidates = pool.filter((c) => c.rarity === rarity.id);
      const unowned = candidates.filter((c) => !s.characters[c.id] && !drops.some((d) => d.kind === 'character' && d.id === c.id));
      const pick = unowned.length ? rng.pick(unowned) : rng.pick(candidates);
      const duplicate = !!s.characters[pick.id] || drops.some((d) => d.kind === 'character' && d.id === pick.id);
      const comp = duplicate ? rarity.duplicateCoins : 0;
      if (!duplicate) giveCharacter(s, pick.id);
      else s.coins += comp;
      drops.push({ kind: 'character', id: pick.id, rarity: rarity.id, duplicate, coins: comp });
    } else {
      coins += rng.int(chest.coins[0], chest.coins[1]);
    }
  }
  if (rng.chance(chest.gems.chance)) gems += rng.int(chest.gems.min, chest.gems.max);
  if (coins) {
    s.coins += coins;
    drops.unshift({ kind: 'coins', amount: coins });
  }
  if (gems) {
    s.gems += gems;
    drops.unshift({ kind: 'gems', amount: gems });
  }
  s.stats.chestsOpened++;
  // Ordena para a revelação terminar no item mais raro (clímax)
  const order = (d: ChestDrop) => (d.kind === 'character' ? 10 + content.rarity(d.rarity).order - (d.duplicate ? 5 : 0) : d.kind === 'gems' ? 1 : 0);
  drops.sort((a, b) => order(a) - order(b));
  return drops;
}

// ─────────────────────────── recompensas de partida ───────────────────────────

export interface MatchSummary {
  mode: ModeDef;
  mapId: string;
  characterId: string;
  won: boolean;
  placement: number;
  players: number;
  kills: number;
  damage: number;
  healing: number;
  specials: number;
  souls: number;
}

export interface MatchRewards {
  xp: number;
  coins: number;
  trophies: number;
  bonusChest: string | null;
  levelUps: LevelUp[];
}

export function applyMatch(content: ContentDB, s: SaveData, m: MatchSummary, rng: Rng): MatchRewards {
  const r = m.mode.rewards;
  const placeFactor = m.players > 2 ? 1 - (m.placement - 1) / (m.players - 1) : m.won ? 1 : 0;
  const xp = Math.round(r.xpBase + (m.won ? r.xpWin : r.xpWin * 0.5 * placeFactor) + m.kills * 6);
  const coins = Math.round(r.coinsBase + (m.won ? r.coinsWin : r.coinsWin * 0.4 * placeFactor) + m.kills * 2);
  let trophies = m.won ? r.trophiesWin : Math.round(r.trophiesLose + (m.players > 2 ? placeFactor * r.trophiesWin * 0.6 : 0));
  if (s.trophies + trophies < 0) trophies = -s.trophies;

  s.coins += coins;
  s.trophies += trophies;
  // estatísticas (alimentam conquistas e missões)
  s.stats.matches++;
  s.stats.botMatches++;
  if (m.won) s.stats.wins++;
  if (m.won && m.mode.kind === 'duel') s.stats.duelWins++;
  if (m.won && m.mode.kind === 'team') s.stats.teamWins++;
  s.stats.kills += m.kills;
  s.stats.damage += Math.round(m.damage);
  s.stats.heals += Math.round(m.healing);
  s.stats.specials += m.specials;
  s.stats.souls += m.souls;
  const owned = s.characters[m.characterId];
  if (owned) {
    owned.matches++;
    if (m.won) owned.wins++;
  }
  // Bônus de sorte por jogar offline contra bots (leve e explícito)
  let bonusChest: string | null = null;
  const luck = m.mode.chestLuck ?? 0;
  if (luck > 0 && rng.chance(m.won ? luck * 2 : luck)) {
    bonusChest = 'bau_ossos';
    s.chests.push(bonusChest);
  }
  const levelUps = addXp(content, s, xp);
  s.history.unshift({ date: new Date().toISOString(), mode: m.mode.id, map: m.mapId, character: m.characterId, placement: m.placement, won: m.won, kills: m.kills, damage: Math.round(m.damage) });
  s.history.length = Math.min(s.history.length, 20);
  return { xp, coins, trophies, bonusChest, levelUps };
}

// ─────────────────────────── missões, conquistas, troféus ───────────────────────────

export function periodKey(kind: EventDef['kind'], date: Date, ev?: EventDef): string {
  if (kind === 'daily') return date.toISOString().slice(0, 10);
  if (kind === 'weekly') {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = (d.getUTCDay() + 6) % 7; // segunda = 0
    d.setUTCDate(d.getUTCDate() - day);
    return 'w' + d.toISOString().slice(0, 10);
  }
  return `s:${ev?.id}:${ev?.start}`;
}

export function eventActive(ev: EventDef, date: Date): boolean {
  if (ev.kind !== 'seasonal') return true;
  const d = date.toISOString().slice(0, 10);
  return (!ev.start || d >= ev.start) && (!ev.end || d <= ev.end);
}

/** Garante que cada evento tem um período atual; reseta progresso quando vira o dia/semana. */
export function refreshQuests(content: ContentDB, s: SaveData, date = new Date()): void {
  for (const ev of content.events) {
    if (!eventActive(ev, date)) continue;
    const key = periodKey(ev.kind, date, ev);
    const cur = s.quests[ev.id];
    if (!cur || cur.key !== key) {
      const base: Partial<Record<StatKey, number>> = {};
      for (const q of ev.quests) base[q.stat] = s.stats[q.stat];
      s.quests[ev.id] = { key, base, claimed: [] };
    }
  }
}

export function questProgress(s: SaveData, evId: string, stat: StatKey): number {
  const p = s.quests[evId];
  if (!p) return 0;
  return Math.max(0, s.stats[stat] - (p.base[stat] ?? 0));
}

export function claimQuest(content: ContentDB, s: SaveData, evId: string, questId: string): Reward | null {
  const ev = content.events.find((e) => e.id === evId);
  const q = ev?.quests.find((x) => x.id === questId);
  const p = s.quests[evId];
  if (!ev || !q || !p || p.claimed.includes(questId)) return null;
  if (questProgress(s, evId, q.stat) < q.target) return null;
  p.claimed.push(questId);
  grant(content, s, q.reward);
  return q.reward;
}

export function achievementProgress(s: SaveData, stat: StatKey): number {
  return s.stats[stat] ?? 0;
}

export function claimAchievement(content: ContentDB, s: SaveData, id: string): Reward | null {
  const a = content.achievements.find((x) => x.id === id);
  if (!a || s.achievementsClaimed.includes(id) || achievementProgress(s, a.stat) < a.target) return null;
  s.achievementsClaimed.push(id);
  grant(content, s, a.reward);
  return a.reward;
}

export function claimTrophyRoad(content: ContentDB, s: SaveData, index: number): Reward | null {
  const step = content.progression.trophyRoad[index];
  if (!step || s.trophyRoadClaimed.includes(index) || s.trophies < step.trophies) return null;
  s.trophyRoadClaimed.push(index);
  grant(content, s, step.reward);
  return step.reward;
}

export function pendingClaims(content: ContentDB, s: SaveData, date = new Date()): number {
  let n = 0;
  for (const a of content.achievements) if (!s.achievementsClaimed.includes(a.id) && achievementProgress(s, a.stat) >= a.target) n++;
  content.progression.trophyRoad.forEach((st, i) => {
    if (!s.trophyRoadClaimed.includes(i) && s.trophies >= st.trophies) n++;
  });
  for (const ev of content.events) {
    if (!eventActive(ev, date)) continue;
    for (const q of ev.quests) if (!s.quests[ev.id]?.claimed.includes(q.id) && questProgress(s, ev.id, q.stat) >= q.target) n++;
  }
  return n;
}

// ─────────────────────────── loja ───────────────────────────

export interface ShopOffer {
  kind: 'character' | 'skin' | 'pet';
  id: string;
  /** Para skins: personagem que recebe a skin. */
  characterId?: string;
  price: { coins?: number; gems?: number };
}

/** Vitrine diária determinística (mesma para o dia inteiro), só com itens que o jogador não tem. */
export function dailyOffers(content: ContentDB, s: SaveData, date = new Date()): ShopOffer[] {
  const key = date.toISOString().slice(0, 10);
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rng = new Rng(h);
  const offers: ShopOffer[] = [];
  const chars = rng.shuffle([...content.characters.values()].filter((c) => !s.characters[c.id] && c.obtain.includes('shop') && content.rarity(c.rarity).shopPrice));
  for (const c of chars.slice(0, 2)) offers.push({ kind: 'character', id: c.id, price: content.rarity(c.rarity).shopPrice! });
  const skinPairs: ShopOffer[] = [];
  for (const charId of Object.keys(s.characters)) {
    for (const sk of content.skinsFor(charId)) {
      if (sk.price && !s.characters[charId].skins.includes(sk.id)) skinPairs.push({ kind: 'skin', id: sk.id, characterId: charId, price: sk.price });
    }
  }
  // prioriza lendárias na vitrine
  rng.shuffle(skinPairs).sort((a, b) => (content.skins.get(b.id)?.tier === 'lendaria' ? 1 : 0) - (content.skins.get(a.id)?.tier === 'lendaria' ? 1 : 0));
  offers.push(...skinPairs.slice(0, 2));
  return offers.slice(0, content.shop.featuredSlots);
}

export function claimDailyGift(content: ContentDB, s: SaveData, date = new Date()): Reward | null {
  const key = date.toISOString().slice(0, 10);
  if (s.lastDailyGift === key) return null;
  s.lastDailyGift = key;
  const r = { coins: content.shop.dailyFreeCoins, gems: content.shop.dailyFreeGems };
  grant(content, s, r);
  return r;
}

export function buySkin(content: ContentDB, s: SaveData, characterId: string, skinId: string): boolean {
  const owned = s.characters[characterId];
  const skin = content.skins.get(skinId);
  if (!owned || !skin || owned.skins.includes(skinId)) return false;
  if (skin.characterId && skin.characterId !== characterId) return false;
  if (!content.skinsFor(characterId).some((x) => x.id === skinId)) return false;
  if (!pay(s, skin.price)) return false;
  owned.skins.push(skinId);
  return true;
}

export function buyCharacter(content: ContentDB, s: SaveData, id: string): boolean {
  const def = content.characters.get(id);
  if (!def || s.characters[id]) return false;
  const price = content.rarity(def.rarity).shopPrice;
  if (!price || !def.obtain.includes('shop')) return false;
  if (!pay(s, price)) return false;
  giveCharacter(s, id);
  return true;
}

export function buyPet(content: ContentDB, s: SaveData, id: string): boolean {
  const pet = content.pets.get(id);
  if (!pet || s.pets.includes(id) || !pet.price) return false;
  if (!pay(s, pet.price)) return false;
  s.pets.push(id);
  return true;
}

export function buyChest(content: ContentDB, s: SaveData, id: string): boolean {
  const chest = content.chests.get(id);
  if (!chest || !pay(s, chest.price)) return false;
  s.chests.push(id);
  return true;
}
