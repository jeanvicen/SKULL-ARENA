import { allCharacters, getCharacter, hasCharacter, VICEN_ID } from '../content/characters';
import { allPets, getPet } from '../content/pets';
import { CHEST, DROP_RARITY, DROP_REWARDS } from '../content/chests';
import { CODES } from '../content/codes';
import { ECONOMY, xpForLevel } from '../content/economy';
import { activeEvents, eventMultiplier, now } from '../content/events';
import { DAILY_COUNT, DAILY_MISSIONS, WEEKLY_COUNT, WEEKLY_MISSIONS } from '../content/missions';
import { MODE } from '../content/modes';
import { PASS_TIERS, passTierFor } from '../content/pass';
import { DAILY_REWARDS, TROPHY_ROAD } from '../content/progression';
import { RARITY, RARITY_ORDER } from '../content/rarities';
import type { CharacterDef, ChestDef, MissionDef, ModeId, PetDef, PromoCodeDef, RarityId, Reward, RoleId } from '../content/types';
import { Rng, hashString } from '../engine/rng';
import type { MatchStats } from '../sim/types';
import { dayKey, weekKey, type MissionState, type Profile } from './profile';

/**
 * ECONOMIA (regras puras)
 * -----------------------
 * Todas as funções recebem o perfil e o ALTERAM (quem chama salva depois).
 * Não usam DOM: rodam igual no navegador, nos testes e no servidor online.
 * Cada função devolve o que o jogador ganhou (`Gain[]`) pra tela animar.
 */

export type Gain =
  | { kind: 'moedas'; amount: number }
  | { kind: 'isvoid'; amount: number }
  | { kind: 'xp'; amount: number }
  | { kind: 'passXp'; amount: number }
  | { kind: 'trophies'; amount: number }
  | { kind: 'character'; id: string; isNew: boolean; dupMoedas: number; dupIsvoid: number }
  | { kind: 'pet'; id: string; isNew: boolean; dupMoedas: number }
  | { kind: 'chest'; id: string; count: number }
  | { kind: 'title'; id: string; text: string }
  | { kind: 'level'; level: number };

export class EconomyError extends Error {}

function fail(msg: string): never {
  throw new EconomyError(msg);
}

// ---------------------------------------------------------------------------
// Moedas / XP / nível
// ---------------------------------------------------------------------------

export function addXp(p: Profile, amount: number, out: Gain[]): void {
  if (amount <= 0) return;
  p.xp += amount;
  out.push({ kind: 'xp', amount });
  while (p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level++;
    out.push({ kind: 'level', level: p.level });
    p.moedas += ECONOMY.levelUpReward.moedas;
    out.push({ kind: 'moedas', amount: ECONOMY.levelUpReward.moedas });
    if (p.level % 5 === 0) {
      p.isvoid += ECONOMY.levelUpReward.isvoidEvery5;
      out.push({ kind: 'isvoid', amount: ECONOMY.levelUpReward.isvoidEvery5 });
    }
  }
}

function giveCharacter(p: Profile, id: string, out: Gain[]): void {
  if (!hasCharacter(id)) return;
  const def = getCharacter(id);
  if (p.chars[id]) {
    const r = RARITY[def.rarity];
    p.moedas += r.duplicateMoedas;
    p.isvoid += r.duplicateIsvoid;
    out.push({ kind: 'character', id, isNew: false, dupMoedas: r.duplicateMoedas, dupIsvoid: r.duplicateIsvoid });
  } else {
    p.chars[id] = { level: 1, trophies: 0, best: 0, at: Date.now() };
    out.push({ kind: 'character', id, isNew: true, dupMoedas: 0, dupIsvoid: 0 });
  }
}

function givePet(p: Profile, id: string, out: Gain[]): void {
  const pet = getPet(id);
  if (!pet) return;
  if (p.pets[id]) {
    const m = ECONOMY.petDuplicateMoedas[pet.rarity];
    p.moedas += m;
    out.push({ kind: 'pet', id, isNew: false, dupMoedas: m });
  } else {
    p.pets[id] = Date.now();
    out.push({ kind: 'pet', id, isNew: true, dupMoedas: 0 });
  }
}

/** Personagens que podem sair em baú, por raridade. */
function chestPool(r: RarityId): CharacterDef[] {
  return allCharacters().filter((c) => c.rarity === r && c.unlock.kind === 'chest' && c.id !== VICEN_ID);
}
function petPool(r: RarityId): PetDef[] {
  return allPets().filter((x) => x.rarity === r && x.unlock.kind === 'chest');
}

/** Sorteia um personagem da raridade (prefere os que você ainda não tem). */
function rollCharacter(p: Profile, r: RarityId, rng: Rng, featured?: string): string | null {
  const pool = chestPool(r);
  if (!pool.length) return null;
  const weights = pool.map((c) => (p.chars[c.id] ? 1 : 4) * (c.id === featured ? 2 : 1));
  return rng.weighted(pool, weights).id;
}
function rollPet(p: Profile, r: RarityId, rng: Rng): string | null {
  const pool = petPool(r);
  if (!pool.length) return null;
  return rng.weighted(
    pool,
    pool.map((x) => (p.pets[x.id] ? 1 : 4)),
  ).id;
}

/** Aplica uma lista de prêmios. */
export function grant(p: Profile, rewards: Reward[], rng: Rng, out: Gain[] = []): Gain[] {
  for (const r of rewards) {
    switch (r.kind) {
      case 'moedas':
        p.moedas += r.amount;
        out.push({ kind: 'moedas', amount: r.amount });
        break;
      case 'isvoid':
        p.isvoid += r.amount;
        out.push({ kind: 'isvoid', amount: r.amount });
        break;
      case 'xp':
        addXp(p, r.amount, out);
        break;
      case 'passXp':
        p.pass.xp += r.amount;
        out.push({ kind: 'passXp', amount: r.amount });
        break;
      case 'trophies':
        p.trophies += r.amount;
        p.bestTrophies = Math.max(p.bestTrophies, p.trophies);
        out.push({ kind: 'trophies', amount: r.amount });
        break;
      case 'character':
        giveCharacter(p, r.id, out);
        break;
      case 'pet':
        givePet(p, r.id, out);
        break;
      case 'chest': {
        const n = r.count ?? 1;
        p.chests[r.id] = (p.chests[r.id] ?? 0) + n;
        out.push({ kind: 'chest', id: r.id, count: n });
        break;
      }
      case 'skin':
        // skins: reservado (personagem ganha variação de cor) — por enquanto vira moedas
        p.moedas += 200;
        out.push({ kind: 'moedas', amount: 200 });
        break;
      case 'randomCharacter': {
        const id = rollCharacter(p, r.rarity, rng);
        if (id) giveCharacter(p, id, out);
        break;
      }
      case 'randomPet': {
        const id = rollPet(p, r.rarity, rng);
        if (id) givePet(p, id, out);
        break;
      }
      case 'title':
        p.titles[r.id] = r.text;
        if (!p.title) p.title = r.id;
        out.push({ kind: 'title', id: r.id, text: r.text });
        break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Baús
// ---------------------------------------------------------------------------

export interface ChestCard {
  kind: 'moedas' | 'isvoid' | 'character' | 'pet';
  rarity: RarityId;
  id?: string;
  amount?: number;
  isNew?: boolean;
  dupMoedas?: number;
  dupIsvoid?: number;
}

export interface ChestOpen {
  chest: ChestDef;
  cards: ChestCard[];
  gains: Gain[];
  /** maior raridade que saiu (pra animação: brilho/tremida) */
  best: RarityId;
  vicen: boolean;
}

function tierOf(r: RarityId): number {
  return RARITY[r].tier;
}

/**
 * Abre um baú. `paid`: true = cobra o preço; false = usa um baú guardado (p.chests).
 */
export function openChest(p: Profile, chestId: string, rng: Rng, paid: boolean): ChestOpen {
  const c = CHEST[chestId] ?? fail('Baú não existe.');
  if (paid) {
    if (!c.price) fail('Esse baú não é vendido.');
    if (c.price.currency === 'moedas') {
      if (p.moedas < c.price.amount) fail('Moedas da Morte insuficientes.');
      p.moedas -= c.price.amount;
    } else {
      if (p.isvoid < c.price.amount) fail('Isvoid insuficiente.');
      p.isvoid -= c.price.amount;
    }
  } else {
    if (!p.chests[chestId]) fail('Você não tem esse baú.');
    p.chests[chestId]!--;
    if (p.chests[chestId] === 0) delete p.chests[chestId];
  }
  const featured = activeEvents(now()).find((e) => e.featuredCharacter)?.featuredCharacter;
  const cards: ChestCard[] = [];
  const gains: Gain[] = [];
  let best: RarityId = 'comum';
  let vicen = false;
  const pityKey = chestId;
  const pityCount = (p.pity[pityKey] ?? 0) + 1;
  let pityHit = false;

  // 1) Vicen₹ (chance por abertura + garantia)
  if (c.vicenOdds) {
    const forced = c.pity?.rarity === 'creators' && pityCount >= c.pity.after;
    const chance = c.vicenOdds * (featured === VICEN_ID ? 2 : 1);
    if (forced || rng.next() < chance) {
      vicen = true;
      pityHit = true;
      const g: Gain[] = [];
      giveCharacter(p, VICEN_ID, g);
      const gc = g[0] as Extract<Gain, { kind: 'character' }>;
      cards.push({ kind: 'character', rarity: 'creators', id: VICEN_ID, isNew: gc.isNew, dupMoedas: gc.dupMoedas, dupIsvoid: gc.dupIsvoid });
      gains.push(...g);
      best = 'creators';
    }
  }

  // 2) cartas
  let moedas = rng.int(c.moedas[0], c.moedas[1]);
  const order = [...RARITY_ORDER].reverse();
  for (let i = 0; i < c.rolls; i++) {
    let got = false;
    // garantia (pity) que não é do Vicen: força a primeira carta
    const forceR = !pityHit && c.pity && c.pity.rarity !== 'creators' && pityCount >= c.pity.after && i === 0 ? c.pity.rarity : null;
    let roll = rng.next();
    for (const r of order) {
      const pc = forceR ? (r === forceR ? 1 : 0) : (c.characterOdds[r] ?? 0);
      if (roll < pc) {
        const id = rollCharacter(p, r, rng, featured);
        if (id) {
          const g: Gain[] = [];
          giveCharacter(p, id, g);
          const gc = g[0] as Extract<Gain, { kind: 'character' }>;
          cards.push({ kind: 'character', rarity: r, id, isNew: gc.isNew, dupMoedas: gc.dupMoedas, dupIsvoid: gc.dupIsvoid });
          gains.push(...g);
          if (tierOf(r) > tierOf(best)) best = r;
          got = true;
        }
        break;
      }
      roll -= pc;
    }
    if (got) continue;
    for (const r of order) {
      const pp = c.petOdds[r] ?? 0;
      if (roll < pp) {
        const id = rollPet(p, r, rng);
        if (id) {
          const g: Gain[] = [];
          givePet(p, id, g);
          const gp = g[0] as Extract<Gain, { kind: 'pet' }>;
          cards.push({ kind: 'pet', rarity: r, id, isNew: gp.isNew, dupMoedas: gp.dupMoedas });
          gains.push(...g);
          if (tierOf(r) > tierOf(best)) best = r;
          got = true;
        }
        break;
      }
      roll -= pp;
    }
    if (!got) moedas += Math.round(c.moedas[0] / 3);
  }
  // pity: zera quando saiu a raridade garantida (ou maior)
  if (c.pity && (pityHit || tierOf(best) >= tierOf(c.pity.rarity))) p.pity[pityKey] = 0;
  else p.pity[pityKey] = pityCount;

  p.moedas += moedas;
  cards.unshift({ kind: 'moedas', rarity: 'comum', amount: moedas });
  gains.push({ kind: 'moedas', amount: moedas });
  if (c.isvoid) {
    const iv = rng.int(c.isvoid[0], c.isvoid[1]);
    if (iv > 0) {
      p.isvoid += iv;
      cards.splice(1, 0, { kind: 'isvoid', rarity: 'raro', amount: iv });
      gains.push({ kind: 'isvoid', amount: iv });
    }
  }
  p.stats.chestsOpened++;
  // cartas raras por último (suspense)
  const head = cards.filter((x) => x.kind === 'moedas' || x.kind === 'isvoid');
  const rest = cards.filter((x) => x.kind !== 'moedas' && x.kind !== 'isvoid').sort((a, b) => tierOf(a.rarity) - tierOf(b.rarity));
  return { chest: c, cards: [...head, ...rest], gains, best, vicen };
}

// ---------------------------------------------------------------------------
// Drop da Caveira
// ---------------------------------------------------------------------------

export interface DropOpen {
  /** raridades que a animação mostra subindo (a última é a final) */
  steps: RarityId[];
  rarity: RarityId;
  gains: Gain[];
}

export function openDrop(p: Profile, rng: Rng): DropOpen {
  if (p.drops.pending <= 0) fail('Sem Drops da Caveira.');
  p.drops.pending--;
  let roll = rng.next();
  let rarity: RarityId = 'comum';
  for (const d of [...DROP_RARITY].reverse()) {
    if (roll < d.chance) {
      rarity = d.id;
      break;
    }
    roll -= d.chance;
  }
  const steps: RarityId[] = [];
  for (const r of RARITY_ORDER) {
    steps.push(r);
    if (r === rarity) break;
  }
  const pool = DROP_REWARDS[rarity];
  const pick = rng.weighted(
    pool,
    pool.map((x) => x.w),
  );
  const gains = grant(p, [pick.r], rng);
  return { steps, rarity, gains };
}

// ---------------------------------------------------------------------------
// Fim de partida
// ---------------------------------------------------------------------------

export interface MatchSummary {
  mode: ModeId;
  map: string;
  charId: string;
  /** null = empate */
  win: boolean | null;
  /** FFA: 1..N; equipes: 1 vence, 2 perde */
  placement: number;
  players: number;
  stats: MatchStats;
  /** saiu antes do fim (sem prêmio) */
  quit?: boolean;
}

export interface MatchRewards {
  gains: Gain[];
  moedas: number;
  trophies: number;
  xp: number;
  passXp: number;
  drop: boolean;
  /** missões que andaram (id → progresso novo) */
  missions: Array<{ id: string; text: string; progress: number; target: number; done: boolean }>;
  oldTrophies: number;
  newTrophies: number;
}

function trophyDelta(p: Profile, s: MatchSummary): number {
  const mode = MODE[s.mode];
  if (!mode?.trophies || !(ECONOMY.rankedModes as readonly string[]).includes(s.mode) || s.quit) return 0;
  const cur = p.chars[s.charId]?.trophies ?? 0;
  if (mode.teams === 0) {
    const scale = s.players / 10;
    const idx = Math.min(ECONOMY.trophies.ffa.length - 1, Math.floor((s.placement - 1) / Math.max(0.1, scale)));
    let d = ECONOMY.trophies.ffa[idx] ?? 0;
    if (cur < 100 && d < 0) d = 0;
    return d;
  }
  const band = ECONOMY.trophies.bands.find((b) => cur < b.upTo)!;
  if (s.win === null) return 0;
  return s.win ? band.win : band.lose;
}

export function applyMatch(p: Profile, s: MatchSummary, rng: Rng, at: Date = now()): MatchRewards {
  ensureMissions(p, at);
  const E = ECONOMY.match;
  const st = s.stats;
  const oldTrophies = p.trophies;
  const gains: Gain[] = [];
  let moedas = 0;
  let xp = 0;
  let passXp = 0;
  let trophies = 0;
  let drop = false;
  if (!s.quit) {
    const res = s.win === null ? 'draw' : s.win ? 'win' : 'lose';
    moedas = E[res] + st.kills * E.perKill + st.skulls * E.perSkull + st.coins * E.perCoin;
    if (MODE[s.mode]?.teams === 0) moedas += E.ffaPlace[Math.min(E.ffaPlace.length - 1, s.placement - 1)] ?? 0;
    moedas = Math.min(E.max, moedas);
    const pet = getPet(p.selectedPet);
    if (pet?.bonus.coinBonus) moedas = Math.round(moedas * (1 + pet.bonus.coinBonus));
    moedas = Math.round(moedas * eventMultiplier('moedas', at));
    xp = Math.round(((s.win ? ECONOMY.xp.win : ECONOMY.xp.lose) + st.kills * ECONOMY.xp.perKill) * eventMultiplier('xp', at));
    passXp = Math.round(ECONOMY.passXp[res] * eventMultiplier('passXp', at));
    trophies = trophyDelta(p, s);
    if (trophies > 0) trophies = Math.round(trophies * eventMultiplier('trophies', at));
    // troféus: por personagem e total da conta
    const oc = p.chars[s.charId];
    if (oc) {
      const before = oc.trophies;
      oc.trophies = Math.max(0, oc.trophies + trophies);
      oc.best = Math.max(oc.best, oc.trophies);
      trophies = oc.trophies - before;
    }
    p.trophies = Math.max(0, p.trophies + trophies);
    p.bestTrophies = Math.max(p.bestTrophies, p.trophies);
    p.moedas += moedas;
    p.pass.xp += passXp;
    gains.push({ kind: 'moedas', amount: moedas });
    if (trophies) gains.push({ kind: 'trophies', amount: trophies });
    gains.push({ kind: 'passXp', amount: passXp });
    addXp(p, xp, gains);
    // Drop da Caveira por vitória (ou top 3 no FFA)
    const day = dayKey(at);
    if (p.drops.day !== day) p.drops = { day, count: 0, pending: p.drops.pending };
    const earned = s.win === true || (MODE[s.mode]?.teams === 0 && s.placement <= 3);
    if (earned && p.drops.count < ECONOMY.dropsPerDay) {
      p.drops.count++;
      p.drops.pending++;
      drop = true;
    }
    // estatísticas da vida
    const L = p.stats;
    L.matches++;
    if (s.win) L.wins++;
    L.kills += st.kills;
    L.deaths += st.deaths;
    L.damage += Math.round(st.damage);
    L.healed += Math.round(st.healed);
    L.skulls += st.skulls;
    L.supers += st.supers;
    L.bestStreak = Math.max(L.bestStreak, st.bestStreak);
    p.history.unshift({
      at: at.getTime(),
      mode: s.mode,
      map: s.map,
      char: s.charId,
      result: res,
      placement: s.placement,
      kills: st.kills,
      deaths: st.deaths,
      trophies,
      moedas,
    });
    p.history.length = Math.min(p.history.length, 25);
  }
  const missions = s.quit ? [] : progressMissions(p, s, at);
  return { gains, moedas, trophies, xp, passXp, drop, missions, oldTrophies, newTrophies: p.trophies };
}

// ---------------------------------------------------------------------------
// Missões
// ---------------------------------------------------------------------------

function pickSeeded<T>(arr: readonly T[], n: number, seed: string): T[] {
  const rng = new Rng(hashString(seed));
  return rng.shuffle([...arr]).slice(0, n);
}

/** Garante as missões do dia/semana (sorteio igual pra todo mundo no mesmo dia). */
export function ensureMissions(p: Profile, at: Date = now()): void {
  const day = dayKey(at);
  if (p.missions.day !== day) {
    p.missions.day = day;
    p.missions.daily = pickSeeded(DAILY_MISSIONS, DAILY_COUNT, `d:${day}`).map((m) => ({ id: m.id, progress: 0, claimed: false }));
  }
  const week = weekKey(at);
  if (p.missions.week !== week) {
    p.missions.week = week;
    p.missions.weekly = pickSeeded(WEEKLY_MISSIONS, WEEKLY_COUNT, `w:${week}`).map((m) => ({ id: m.id, progress: 0, claimed: false }));
  }
  for (const e of activeEvents(at)) for (const m of e.missions ?? []) if (!p.missions.event[`${e.id}:${m.id}`]) p.missions.event[`${e.id}:${m.id}`] = { id: m.id, progress: 0, claimed: false };
}

export function missionDef(id: string): MissionDef | undefined {
  const m = DAILY_MISSIONS.find((x) => x.id === id) ?? WEEKLY_MISSIONS.find((x) => x.id === id);
  if (m) return m;
  for (const e of activeEvents()) for (const x of e.missions ?? []) if (x.id === id) return x;
  return undefined;
}

function missionGain(m: MissionDef, s: MatchSummary, role: RoleId): number {
  const st = s.stats;
  switch (m.goal) {
    case 'play':
      return 1;
    case 'win':
      return s.win ? 1 : 0;
    case 'kills':
      return st.kills;
    case 'damage':
      return Math.round(st.damage);
    case 'heal':
      return Math.round(st.healed);
    case 'skulls':
      return st.skulls;
    case 'supers':
      return st.supers;
    case 'skills':
      return st.skills;
    case 'boxes':
      return st.boxes;
    case 'playRole':
      return role === m.role ? 1 : 0;
    case 'winMode':
      return s.win && s.mode === m.mode ? 1 : 0;
    case 'top3':
      return MODE[s.mode]?.teams === 0 && s.placement <= 3 ? 1 : 0;
  }
}

function progressMissions(p: Profile, s: MatchSummary, at: Date): MatchRewards['missions'] {
  const role = getCharacter(s.charId).role;
  const out: MatchRewards['missions'] = [];
  const bump = (ms: MissionState, def: MissionDef | undefined) => {
    if (!def || ms.claimed || ms.progress >= def.target) return;
    const g = missionGain(def, s, role);
    if (g <= 0) return;
    ms.progress = Math.min(def.target, ms.progress + g);
    out.push({ id: def.id, text: def.text, progress: ms.progress, target: def.target, done: ms.progress >= def.target });
  };
  for (const ms of p.missions.daily)
    bump(
      ms,
      DAILY_MISSIONS.find((x) => x.id === ms.id),
    );
  for (const ms of p.missions.weekly)
    bump(
      ms,
      WEEKLY_MISSIONS.find((x) => x.id === ms.id),
    );
  for (const e of activeEvents(at))
    for (const m of e.missions ?? []) {
      const ms = p.missions.event[`${e.id}:${m.id}`];
      if (ms) bump(ms, m);
    }
  return out;
}

export function claimMission(p: Profile, key: string, rng: Rng): Gain[] {
  const ms = p.missions.daily.find((x) => x.id === key) ?? p.missions.weekly.find((x) => x.id === key) ?? p.missions.event[key];
  if (!ms) fail('Missão não encontrada.');
  const def = missionDef(ms.id);
  if (!def) fail('Missão expirou.');
  if (ms.claimed) fail('Já resgatada.');
  if (ms.progress < def.target) fail('Missão ainda não completa.');
  ms.claimed = true;
  return grant(p, def.rewards, rng);
}

// ---------------------------------------------------------------------------
// Diário, passe, estrada, presentes de evento
// ---------------------------------------------------------------------------

export function dailyStatus(p: Profile, at: Date = now()): { canClaim: boolean; day: number } {
  const today = dayKey(at);
  if (p.daily.last === today) return { canClaim: false, day: ((p.daily.streak - 1) % DAILY_REWARDS.length) + 1 };
  const y = new Date(at);
  y.setDate(y.getDate() - 1);
  const cont = p.daily.last === dayKey(y);
  const streak = cont ? p.daily.streak + 1 : 1;
  return { canClaim: true, day: ((streak - 1) % DAILY_REWARDS.length) + 1 };
}

export function claimDaily(p: Profile, rng: Rng, at: Date = now()): Gain[] {
  const st = dailyStatus(p, at);
  if (!st.canClaim) fail('Volte amanhã!');
  const y = new Date(at);
  y.setDate(y.getDate() - 1);
  p.daily.streak = p.daily.last === dayKey(y) ? p.daily.streak + 1 : 1;
  p.daily.last = dayKey(at);
  return grant(p, DAILY_REWARDS[st.day - 1]!, rng);
}

export function claimPass(p: Profile, tier: number, premium: boolean, rng: Rng): Gain[] {
  const t = PASS_TIERS[tier - 1] ?? fail('Nível inválido.');
  if (passTierFor(p.pass.xp) < tier) fail('Nível do passe ainda bloqueado.');
  const list = premium ? p.pass.prem : p.pass.free;
  if (premium && !p.pass.premium) fail('Libere o Skull Pass Premium primeiro.');
  if (list.includes(tier)) fail('Já resgatado.');
  list.push(tier);
  return grant(p, premium ? t.premium : t.free, rng);
}

export function buyPassPremium(p: Profile): void {
  if (p.pass.premium) fail('Você já tem o Premium.');
  if (p.isvoid < ECONOMY.passPremiumIsvoid) fail(`Precisa de ${ECONOMY.passPremiumIsvoid} Isvoid.`);
  p.isvoid -= ECONOMY.passPremiumIsvoid;
  p.pass.premium = true;
}

export function claimRoad(p: Profile, trophies: number, rng: Rng): Gain[] {
  const step = TROPHY_ROAD.find((s) => s.trophies === trophies) ?? fail('Marco inválido.');
  if (p.bestTrophies < trophies) fail('Ainda não chegou lá.');
  if (p.road.includes(trophies)) fail('Já resgatado.');
  p.road.push(trophies);
  return grant(p, step.rewards, rng);
}

/** Presentes de login dos eventos ativos (1x por conta). */
export function claimEventGifts(p: Profile, rng: Rng, at: Date = now()): Array<{ event: string; gains: Gain[] }> {
  const out: Array<{ event: string; gains: Gain[] }> = [];
  for (const e of activeEvents(at)) {
    if (!e.loginGift || p.gifts.includes(e.id)) continue;
    p.gifts.push(e.id);
    out.push({ event: e.name, gains: grant(p, e.loginGift, rng) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Personagens: subir de nível, escolher
// ---------------------------------------------------------------------------

export function upgradeCost(level: number): number | null {
  if (level >= ECONOMY.maxLevel) return null;
  return ECONOMY.upgradeCost[level] ?? null;
}

export function upgrade(p: Profile, id: string): number {
  const oc = p.chars[id] ?? fail('Você não tem esse personagem.');
  const cost = upgradeCost(oc.level) ?? fail('Nível máximo!');
  if (p.moedas < cost) fail('Moedas da Morte insuficientes.');
  p.moedas -= cost;
  oc.level++;
  return oc.level;
}

export function select(p: Profile, id: string): void {
  if (!p.chars[id]) fail('Personagem bloqueado.');
  p.selected = id;
}

export function selectPet(p: Profile, id: string | null): void {
  if (id && !p.pets[id]) fail('Pet bloqueado.');
  p.selectedPet = id;
}

// ---------------------------------------------------------------------------
// Códigos
// ---------------------------------------------------------------------------

export function normCode(c: string): string {
  return c.trim().toUpperCase().replace(/\s+/g, '');
}

export function findCode(code: string, extra: PromoCodeDef[] = []): PromoCodeDef | undefined {
  const k = normCode(code);
  return [...extra, ...CODES].find((c) => normCode(c.code) === k);
}

export function redeemCode(p: Profile, code: string, rng: Rng, extra: PromoCodeDef[] = [], at: Date = now()): Gain[] {
  const k = normCode(code);
  if (!k) fail('Digite um código.');
  const c = findCode(k, extra) ?? fail('Código inválido.');
  if (c.active === false) fail('Esse código foi desativado.');
  const t = at.getTime();
  if (c.validFrom && t < Date.parse(c.validFrom)) fail('Esse código ainda não começou a valer.');
  if (c.validUntil && t > Date.parse(c.validUntil)) fail('Esse código expirou.');
  const used = p.codes[k] ?? 0;
  if (used >= (c.perAccount ?? 1)) fail('Você já usou esse código.');
  p.codes[k] = used + 1;
  return grant(p, c.rewards, rng);
}

// ---------------------------------------------------------------------------
// Loja
// ---------------------------------------------------------------------------

export interface ShopOffer {
  id: string;
  kind: 'character' | 'pet' | 'chest' | 'isvoidPack';
  ref: string;
  price: number;
  currency: 'moedas' | 'isvoid';
  /** desconto em % (só visual) */
  off?: number;
  amount?: number;
}

/** Ofertas do dia (iguais pra todo mundo no mesmo dia). */
export function dailyOffers(at: Date = now()): ShopOffer[] {
  const day = dayKey(at);
  const rng = new Rng(hashString(`shop:${day}`));
  const offers: ShopOffer[] = [];
  const tiers: RarityId[] = ['incomum', 'raro', 'extremo', 'epico'];
  for (const r of tiers) {
    const pool = chestPool(r);
    if (!pool.length) continue;
    const c = rng.pick(pool);
    const off = rng.chance(0.4) ? rng.pick([10, 20, 30]) : 0;
    offers.push({ id: `d:${day}:c:${c.id}`, kind: 'character', ref: c.id, price: Math.round((RARITY[r].shopPrice * (100 - off)) / 100), currency: 'moedas', off: off || undefined });
  }
  for (const r of ['raro', 'extremo'] as RarityId[]) {
    const pool = petPool(r);
    if (!pool.length) continue;
    const pet = rng.pick(pool);
    offers.push({ id: `d:${day}:p:${pet.id}`, kind: 'pet', ref: pet.id, price: ECONOMY.petShopPrice[r], currency: 'moedas' });
  }
  // uma oferta GOD por Isvoid
  const gods = chestPool('god');
  if (gods.length) {
    const g = rng.pick(gods);
    offers.push({ id: `d:${day}:c:${g.id}`, kind: 'character', ref: g.id, price: 600, currency: 'isvoid' });
  }
  // troca de moedas por Isvoid (1x por dia)
  offers.push({ id: `d:${day}:iv`, kind: 'isvoidPack', ref: 'isvoid', amount: 15, price: 1500, currency: 'moedas' });
  return offers;
}

export function buyOffer(p: Profile, offer: ShopOffer, rng: Rng, at: Date = now()): Gain[] {
  const day = dayKey(at);
  if (p.bought.day !== day) p.bought = { day, ids: [] };
  if (p.bought.ids.includes(offer.id)) fail('Já comprado hoje.');
  if (offer.kind === 'character' && p.chars[offer.ref]) fail('Você já tem esse personagem.');
  if (offer.kind === 'pet' && p.pets[offer.ref]) fail('Você já tem esse pet.');
  if (offer.currency === 'moedas') {
    if (p.moedas < offer.price) fail('Moedas da Morte insuficientes.');
    p.moedas -= offer.price;
  } else {
    if (p.isvoid < offer.price) fail('Isvoid insuficiente.');
    p.isvoid -= offer.price;
  }
  p.bought.ids.push(offer.id);
  if (offer.kind === 'character') return grant(p, [{ kind: 'character', id: offer.ref }], rng);
  if (offer.kind === 'pet') return grant(p, [{ kind: 'pet', id: offer.ref }], rng);
  if (offer.kind === 'isvoidPack') return grant(p, [{ kind: 'isvoid', amount: offer.amount ?? 0 }], rng);
  return grant(p, [{ kind: 'chest', id: offer.ref }], rng);
}

/** Texto curto de um prêmio (pra listas). */
export function rewardText(r: Reward): string {
  switch (r.kind) {
    case 'moedas':
      return `${r.amount} Moedas da Morte`;
    case 'isvoid':
      return `${r.amount} Isvoid`;
    case 'xp':
      return `${r.amount} XP`;
    case 'passXp':
      return `${r.amount} XP do Passe`;
    case 'trophies':
      return `${r.amount} troféus`;
    case 'character':
      return getCharacter(r.id).name;
    case 'pet':
      return getPet(r.id)?.name ?? 'Pet';
    case 'chest':
      return `${r.count && r.count > 1 ? `${r.count}× ` : ''}${CHEST[r.id]?.name ?? 'Baú'}`;
    case 'skin':
      return 'Visual';
    case 'randomCharacter':
      return `Personagem ${RARITY[r.rarity].name}`;
    case 'randomPet':
      return `Pet ${RARITY[r.rarity].name}`;
    case 'title':
      return `Título "${r.text}"`;
  }
}
