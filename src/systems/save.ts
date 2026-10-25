import type { ContentDB } from '../content/registry';
import type { StatKey } from '../content/types';

/**
 * SAVE LOCAL (offline). Honestidade: o cliente controla estes dados, então
 * nada aqui é "seguro". Quando o online entrar (Fase 5), itens valiosos e
 * ranked migram para o servidor autoritativo (ver src/net/contract.ts).
 */
export const SAVE_KEY = 'skull-arena-save';
export const SAVE_VERSION = 2;

export interface Settings {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  haptics: boolean;
  quality: 'alta' | 'media' | 'baixa';
  showFps: boolean;
  input: 'auto' | 'touch' | 'desktop';
  joystick: { deadZone: number; radius: number; floating: boolean; smoothing: number };
  aimCone: boolean;
  autoFire: boolean;
  aimMode: 'mouse' | 'move';
  botDifficulty: 'auto' | 'facil' | 'normal' | 'dificil';
  screenShake: number;
}

export interface OwnedCharacter {
  level: number;
  skins: string[];
  skin: string;
  obtainedAt: string;
  matches: number;
  wins: number;
}

export interface QuestPeriod {
  key: string;
  base: Partial<Record<StatKey, number>>;
  claimed: string[];
}

export interface MatchRecord {
  date: string;
  mode: string;
  map: string;
  character: string;
  placement: number;
  won: boolean;
  kills: number;
  damage: number;
}

export interface SaveData {
  version: number;
  createdAt: string;
  player: { name: string; account: 'local'; titleId: string };
  level: number;
  xp: number;
  coins: number;
  gems: number;
  trophies: number;
  characters: Record<string, OwnedCharacter>;
  selectedCharacter: string;
  pets: string[];
  selectedPet: string | null;
  chests: string[];
  titles: string[];
  stats: Record<StatKey, number>;
  achievementsClaimed: string[];
  trophyRoadClaimed: number[];
  quests: Record<string, QuestPeriod>;
  lastDailyGift: string | null;
  lastMode: string;
  settings: Settings;
  history: MatchRecord[];
  seenIntro: boolean;
}

export const STAT_KEYS: StatKey[] = ['matches', 'wins', 'kills', 'damage', 'specials', 'chestsOpened', 'souls', 'heals', 'botMatches', 'duelWins', 'teamWins', 'upgrades', 'level'];

export function defaultSettings(): Settings {
  return {
    musicVolume: 0.45,
    sfxVolume: 0.8,
    muted: false,
    haptics: true,
    quality: 'alta',
    showFps: false,
    input: 'auto',
    joystick: { deadZone: 0.16, radius: 64, floating: true, smoothing: 0.35 },
    aimCone: true,
    autoFire: false,
    aimMode: 'mouse',
    botDifficulty: 'auto',
    screenShake: 1,
  };
}

export function newSave(content: ContentDB, name: string): SaveData {
  const p = content.progression;
  const now = new Date().toISOString();
  const characters: Record<string, OwnedCharacter> = {};
  for (const id of p.starterCharacters) characters[id] = { level: 1, skins: ['default'], skin: 'default', obtainedAt: now, matches: 0, wins: 0 };
  const stats = Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as Record<StatKey, number>;
  stats.level = 1;
  return {
    version: SAVE_VERSION,
    createdAt: now,
    player: { name: name.trim().slice(0, 16) || 'Caveira', account: 'local', titleId: 'novato' },
    level: 1,
    xp: 0,
    coins: p.startingCoins,
    gems: p.startingGems,
    trophies: 0,
    characters,
    selectedCharacter: p.starterCharacters[0],
    pets: p.starterPet ? [p.starterPet] : [],
    selectedPet: p.starterPet,
    chests: [...p.startingChests],
    titles: ['novato'],
    stats,
    achievementsClaimed: [],
    trophyRoadClaimed: [],
    quests: {},
    lastDailyGift: null,
    lastMode: 'cacada',
    settings: defaultSettings(),
    history: [],
    seenIntro: false,
  };
}

/** Migrações de versão — nunca perde progresso do jogador. */
export function migrate(raw: unknown, content: ContentDB): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<SaveData> & { version?: number };
  if (typeof s.version !== 'number' || !s.player || !s.characters) return null;
  const base = newSave(content, s.player.name ?? 'Caveira');
  const merged: SaveData = {
    ...base,
    ...s,
    settings: { ...base.settings, ...(s.settings ?? {}), joystick: { ...base.settings.joystick, ...(s.settings?.joystick ?? {}) } },
    stats: { ...base.stats, ...(s.stats ?? {}) },
    version: SAVE_VERSION,
  } as SaveData;
  // v1 → v2: personagens ganharam contadores de partidas
  for (const id of Object.keys(merged.characters)) {
    const c = merged.characters[id] as Partial<OwnedCharacter>;
    merged.characters[id] = {
      level: c.level ?? 1,
      skins: c.skins ?? ['default'],
      skin: c.skin ?? 'default',
      obtainedAt: c.obtainedAt ?? base.createdAt,
      matches: c.matches ?? 0,
      wins: c.wins ?? 0,
    };
  }
  // Remove referências a conteúdo que não existe mais (sem quebrar)
  for (const id of Object.keys(merged.characters)) if (!content.characters.has(id)) delete merged.characters[id];
  if (!merged.characters[merged.selectedCharacter]) merged.selectedCharacter = Object.keys(merged.characters)[0] ?? content.progression.starterCharacters[0];
  if (!Object.keys(merged.characters).length) merged.characters = base.characters;
  merged.pets = merged.pets.filter((p) => content.pets.has(p));
  if (merged.selectedPet && !merged.pets.includes(merged.selectedPet)) merged.selectedPet = merged.pets[0] ?? null;
  merged.chests = merged.chests.filter((c) => content.chests.has(c));
  if (!content.modes.has(merged.lastMode)) merged.lastMode = 'cacada';
  return merged;
}

/** Armazenamento com fallback em memória (aba anônima / storage bloqueado). */
export class SaveStore {
  private mem: string | null = null;
  persistent = true;
  private timer = 0;

  load(content: ContentDB): SaveData | null {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch {
      this.persistent = false;
      raw = this.mem;
    }
    if (!raw) return null;
    try {
      return migrate(JSON.parse(raw), content);
    } catch {
      return null;
    }
  }

  save(data: SaveData, immediate = false): void {
    const write = () => {
      const raw = JSON.stringify(data);
      try {
        localStorage.setItem(SAVE_KEY, raw);
        this.persistent = true;
      } catch {
        this.persistent = false;
        this.mem = raw;
      }
    };
    clearTimeout(this.timer);
    if (immediate) write();
    else this.timer = window.setTimeout(write, 250);
  }

  wipe(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      this.mem = null;
    }
  }
}
