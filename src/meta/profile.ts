import { ECONOMY } from '../content/economy';
import { STARTERS } from '../content/characters';
import { STARTER_PET } from '../content/pets';
import { SEASON } from '../content/pass';
import type { ModeId } from '../content/types';

/**
 * PERFIL DO JOGADOR — tudo que é salvo da conta.
 * É só um objeto JSON: fica no localStorage (modo local) ou no servidor (online).
 * Se mudar o formato, aumente PROFILE_VERSION e trate em `migrate()`.
 */
export const PROFILE_VERSION = 1;

export interface OwnedChar {
  level: number;
  trophies: number;
  best: number;
  /** quando ganhou (ms) */
  at: number;
}

export interface MissionState {
  id: string;
  progress: number;
  claimed: boolean;
}

export interface MatchRecord {
  at: number;
  mode: ModeId;
  map: string;
  char: string;
  result: 'win' | 'lose' | 'draw';
  placement: number;
  kills: number;
  deaths: number;
  trophies: number;
  moedas: number;
}

export interface LifeStats {
  matches: number;
  wins: number;
  kills: number;
  deaths: number;
  damage: number;
  healed: number;
  skulls: number;
  supers: number;
  bestStreak: number;
  chestsOpened: number;
}

export interface Profile {
  v: number;
  id: string;
  name: string;
  /** #ABCD (pra adicionar amigo) */
  tag: string;
  createdAt: number;
  moedas: number;
  isvoid: number;
  xp: number;
  level: number;
  trophies: number;
  bestTrophies: number;
  selected: string;
  selectedPet: string | null;
  chars: Record<string, OwnedChar>;
  pets: Record<string, number>;
  title: string | null;
  titles: Record<string, string>;
  pass: { season: string; xp: number; premium: boolean; free: number[]; prem: number[] };
  /** marcos da Estrada da Morte já resgatados (troféus) */
  road: number[];
  daily: { last: string | null; streak: number };
  missions: { day: string; daily: MissionState[]; week: string; weekly: MissionState[]; event: Record<string, MissionState> };
  /** código → vezes usado */
  codes: Record<string, number>;
  /** presentes de evento já recebidos */
  gifts: string[];
  /** contadores de garantia por baú */
  pity: Record<string, number>;
  drops: { day: string; count: number; pending: number };
  /** baús ganhos e ainda não abertos */
  chests: Record<string, number>;
  stats: LifeStats;
  history: MatchRecord[];
  /** ofertas da loja já compradas hoje (id da oferta) */
  bought: { day: string; ids: string[] };
  /** já viu o tutorial rápido */
  tutorial: boolean;
}

function randomTag(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

export function newProfile(id: string, name: string): Profile {
  const now = Date.now();
  const chars: Record<string, OwnedChar> = {};
  for (const s of STARTERS) chars[s] = { level: 1, trophies: 0, best: 0, at: now };
  return {
    v: PROFILE_VERSION,
    id,
    name,
    tag: randomTag(),
    createdAt: now,
    moedas: ECONOMY.start.moedas,
    isvoid: ECONOMY.start.isvoid,
    xp: 0,
    level: 1,
    trophies: 0,
    bestTrophies: 0,
    selected: STARTERS[0]!,
    selectedPet: STARTER_PET,
    chars,
    pets: { [STARTER_PET]: now },
    title: null,
    titles: {},
    pass: { season: SEASON.id, xp: 0, premium: false, free: [], prem: [] },
    road: [],
    daily: { last: null, streak: 0 },
    missions: { day: '', daily: [], week: '', weekly: [], event: {} },
    codes: {},
    gifts: [],
    pity: {},
    drops: { day: '', count: 0, pending: 0 },
    chests: {},
    stats: { matches: 0, wins: 0, kills: 0, deaths: 0, damage: 0, healed: 0, skulls: 0, supers: 0, bestStreak: 0, chestsOpened: 0 },
    history: [],
    bought: { day: '', ids: [] },
    tutorial: false,
  };
}

/** Atualiza perfis salvos em versões antigas (campos novos ganham valor padrão). */
export function migrate(raw: unknown): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<Profile>;
  if (!p.id || !p.name) return null;
  const base = newProfile(p.id, p.name);
  const out = { ...base, ...p } as Profile;
  out.stats = { ...base.stats, ...(p.stats ?? {}) };
  out.missions = { ...base.missions, ...(p.missions ?? {}) };
  out.drops = { ...base.drops, ...(p.drops ?? {}) };
  out.bought = { ...base.bought, ...(p.bought ?? {}) };
  if (!out.pass || out.pass.season !== SEASON.id) out.pass = { ...base.pass };
  // garante os iniciais
  for (const s of STARTERS) if (!out.chars[s]) out.chars[s] = { level: 1, trophies: 0, best: 0, at: Date.now() };
  if (!out.chars[out.selected]) out.selected = STARTERS[0]!;
  if (out.selectedPet && !out.pets[out.selectedPet]) out.selectedPet = null;
  out.v = PROFILE_VERSION;
  return out;
}

/** Dia local no formato AAAA-MM-DD (chave das diárias). */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Semana (segunda-feira da semana) AAAA-MM-DD. */
export function weekKey(d: Date): string {
  const x = new Date(d);
  const wd = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - wd);
  return dayKey(x);
}
