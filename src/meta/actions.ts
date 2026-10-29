import type { PromoCodeDef } from '../content/types';
import type { Rng } from '../engine/rng';
import {
  applyMatch,
  buyOffer,
  buyPassPremium,
  claimDaily,
  claimEventGifts,
  claimMission,
  claimPass,
  claimRoad,
  dailyOffers,
  EconomyError,
  ensureMissions,
  openChest,
  openDrop,
  redeemCode,
  select,
  selectPet,
  upgrade,
  type MatchSummary,
} from './economy';
import type { Profile } from './profile';

/**
 * AÇÕES DO JOGADOR
 * ----------------
 * Lista única de tudo que muda o perfil. No modo local roda aqui mesmo; no modo
 * online o SERVIDOR roda exatamente estas funções (ninguém edita moeda no cliente).
 * Pra criar uma ação nova: adicione aqui e chame com `run('nome', args)`.
 */

export interface ActionCtx {
  rng: Rng;
  /** códigos extras (criados no Painel do Criador) */
  codes: PromoCodeDef[];
}

export const ACTIONS = {
  openChest: (p: Profile, c: ActionCtx, a: { id: string; paid: boolean }) => openChest(p, a.id, c.rng, a.paid),
  openDrop: (p: Profile, c: ActionCtx) => openDrop(p, c.rng),
  match: (p: Profile, c: ActionCtx, a: MatchSummary) => applyMatch(p, sanitizeMatch(a), c.rng),
  claimMission: (p: Profile, c: ActionCtx, a: { key: string }) => claimMission(p, a.key, c.rng),
  claimDaily: (p: Profile, c: ActionCtx) => claimDaily(p, c.rng),
  claimPass: (p: Profile, c: ActionCtx, a: { tier: number; premium: boolean }) => claimPass(p, a.tier, a.premium, c.rng),
  buyPassPremium: (p: Profile) => buyPassPremium(p),
  claimRoad: (p: Profile, c: ActionCtx, a: { trophies: number }) => claimRoad(p, a.trophies, c.rng),
  eventGifts: (p: Profile, c: ActionCtx) => claimEventGifts(p, c.rng),
  upgrade: (p: Profile, _c: ActionCtx, a: { id: string }) => upgrade(p, a.id),
  select: (p: Profile, _c: ActionCtx, a: { id: string }) => select(p, a.id),
  selectPet: (p: Profile, _c: ActionCtx, a: { id: string | null }) => selectPet(p, a.id),
  redeem: (p: Profile, c: ActionCtx, a: { code: string }) => redeemCode(p, a.code, c.rng, c.codes),
  buyOffer: (p: Profile, c: ActionCtx, a: { offerId: string }) => {
    const offer = dailyOffers().find((o) => o.id === a.offerId);
    if (!offer) throw new EconomyError('Oferta expirou. A loja renova todo dia.');
    return buyOffer(p, offer, c.rng);
  },
  setTitle: (p: Profile, _c: ActionCtx, a: { id: string | null }) => {
    if (a.id && !p.titles[a.id]) throw new EconomyError('Título bloqueado.');
    p.title = a.id;
  },
  tutorialDone: (p: Profile) => {
    p.tutorial = true;
  },
  refresh: (p: Profile) => {
    ensureMissions(p);
  },
} satisfies Record<string, (p: Profile, c: ActionCtx, a: never) => unknown>;

export type ActionName = keyof typeof ACTIONS;
export type ActionArgs<K extends ActionName> = Parameters<(typeof ACTIONS)[K]>[2];
export type ActionResult<K extends ActionName> = ReturnType<(typeof ACTIONS)[K]>;

/** Limites de sanidade pro resultado de partida (o cliente informa as estatísticas). */
function sanitizeMatch(s: MatchSummary): MatchSummary {
  const st = s.stats;
  const cap = (n: number, max: number) => Math.max(0, Math.min(max, Math.floor(Number(n) || 0)));
  return {
    ...s,
    placement: cap(s.placement, 20) || 1,
    players: cap(s.players, 20) || 1,
    stats: {
      kills: cap(st.kills, 150),
      deaths: cap(st.deaths, 150),
      assists: cap(st.assists, 150),
      damage: cap(st.damage, 2_000_000),
      healed: cap(st.healed, 1_000_000),
      skulls: cap(st.skulls, 200),
      supers: cap(st.supers, 200),
      skills: cap(st.skills, 500),
      boxes: cap(st.boxes, 200),
      coins: cap(st.coins, 300),
      streak: cap(st.streak, 150),
      bestStreak: cap(st.bestStreak, 150),
    },
  };
}
