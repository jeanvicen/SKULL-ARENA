import { describe, expect, it } from 'vitest';
import { VICEN_ID } from '../src/content/characters';
import { CHEST } from '../src/content/chests';
import { ECONOMY } from '../src/content/economy';
import { PASS_TIERS } from '../src/content/pass';
import { Rng } from '../src/engine/rng';
import { applyMatch, claimDaily, claimMission, claimPass, dailyOffers, buyOffer, EconomyError, ensureMissions, openChest, openDrop, redeemCode, upgrade } from '../src/meta/economy';
import { newProfile } from '../src/meta/profile';
import type { MatchStats } from '../src/sim/types';

const stats = (o: Partial<MatchStats> = {}): MatchStats => ({
  kills: 5,
  deaths: 2,
  assists: 1,
  damage: 12000,
  healed: 0,
  skulls: 6,
  supers: 2,
  skills: 3,
  boxes: 1,
  coins: 3,
  streak: 0,
  bestStreak: 3,
  ...o,
});
const AT = new Date('2026-10-29T15:00:00-03:00');

describe('economia', () => {
  it('perfil novo tem os 3 iniciais e moedas de começo', () => {
    const p = newProfile('t', 'Teste');
    expect(Object.keys(p.chars)).toEqual(['kaze', 'marreta', 'djkiko']);
    expect(p.moedas).toBe(ECONOMY.start.moedas);
  });

  it('baú cobra o preço e dá prêmios', () => {
    const p = newProfile('t', 'Teste');
    p.moedas = 10_000;
    const before = p.moedas;
    const r = openChest(p, 'bau_caveira', new Rng(1), true);
    expect(r.cards.length).toBeGreaterThanOrEqual(1);
    expect(p.moedas).toBeLessThan(before + 1000);
    expect(p.stats.chestsOpened).toBe(1);
  });

  it('sem moedas o baú não abre e nada muda', () => {
    const p = newProfile('t', 'Teste');
    p.moedas = 10;
    expect(() => openChest(p, 'bau_mega', new Rng(1), true)).toThrow(EconomyError);
  });

  it('Vicen₹: ~1% no Drop do Vazio e garantia em 100 aberturas', () => {
    let hits = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const p = newProfile('t', 'T');
      p.isvoid = 1000;
      if (openChest(p, 'bau_vazio', new Rng(i + 1), true).vicen) hits++;
    }
    const rate = hits / N;
    expect(rate).toBeGreaterThan(0.005);
    expect(rate).toBeLessThan(0.02);
    // garantia
    const p = newProfile('t', 'T');
    p.isvoid = 1_000_000;
    let got = false;
    for (let i = 0; i < CHEST.bau_vazio!.pity!.after; i++) if (openChest(p, 'bau_vazio', new Rng(777 + i * 13), true).vicen) got = true;
    expect(got).toBe(true);
    expect(p.chars[VICEN_ID]).toBeTruthy();
  });

  it('código de prêmio só vale uma vez por conta', () => {
    const p = newProfile('t', 'T');
    const g = redeemCode(p, 'bemvindo', new Rng(1), [], AT);
    expect(g.some((x) => x.kind === 'moedas')).toBe(true);
    expect(() => redeemCode(p, 'BEMVINDO', new Rng(1), [], AT)).toThrow(/já usou/);
    expect(() => redeemCode(p, 'NAOEXISTE', new Rng(1), [], AT)).toThrow(/inválido/);
  });

  it('prêmio diário: 1 por dia e sequência avança', () => {
    const p = newProfile('t', 'T');
    claimDaily(p, new Rng(1), AT);
    expect(() => claimDaily(p, new Rng(1), AT)).toThrow();
    claimDaily(p, new Rng(1), new Date('2026-10-30T10:00:00-03:00'));
    expect(p.daily.streak).toBe(2);
    claimDaily(p, new Rng(1), new Date('2026-11-05T10:00:00-03:00'));
    expect(p.daily.streak).toBe(1);
  });

  it('partida dá moedas, troféus, xp do passe e anda missões', () => {
    const p = newProfile('t', 'T');
    ensureMissions(p, AT);
    const r = applyMatch(p, { mode: 'guerra', map: 'necropolis', charId: 'kaze', win: true, placement: 1, players: 20, stats: stats() }, new Rng(1), AT);
    expect(r.moedas).toBeGreaterThan(0);
    expect(r.trophies).toBeGreaterThan(0);
    expect(p.chars.kaze!.trophies).toBe(r.trophies);
    expect(p.pass.xp).toBeGreaterThan(0);
    expect(r.drop).toBe(true);
    expect(p.drops.pending).toBe(1);
    expect(p.history).toHaveLength(1);
    const d = openDrop(p, new Rng(5));
    expect(d.gains.length).toBeGreaterThan(0);
  });

  it('sair da partida não dá prêmio', () => {
    const p = newProfile('t', 'T');
    const r = applyMatch(p, { mode: 'guerra', map: 'necropolis', charId: 'kaze', win: false, placement: 2, players: 20, stats: stats(), quit: true }, new Rng(1), AT);
    expect(r.moedas).toBe(0);
    expect(p.stats.matches).toBe(0);
  });

  it('missão completa pode ser resgatada uma vez', () => {
    const p = newProfile('t', 'T');
    ensureMissions(p, AT);
    const m = p.missions.daily[0]!;
    m.progress = 999_999;
    const g = claimMission(p, m.id, new Rng(1));
    expect(g.length).toBeGreaterThan(0);
    expect(() => claimMission(p, m.id, new Rng(1))).toThrow();
  });

  it('subir de nível cobra moedas e para no máximo', () => {
    const p = newProfile('t', 'T');
    p.moedas = 1_000_000;
    for (let i = 1; i < ECONOMY.maxLevel; i++) upgrade(p, 'kaze');
    expect(p.chars.kaze!.level).toBe(ECONOMY.maxLevel);
    expect(() => upgrade(p, 'kaze')).toThrow(/máximo/);
  });

  it('passe: nível bloqueado não resgata; premium precisa liberar', () => {
    const p = newProfile('t', 'T');
    expect(() => claimPass(p, 1, false, new Rng(1))).toThrow();
    p.pass.xp = PASS_TIERS[0]!.xp;
    claimPass(p, 1, false, new Rng(1));
    expect(() => claimPass(p, 1, true, new Rng(1))).toThrow(/Premium/);
  });

  it('loja do dia: mesmas ofertas pra todo mundo e compra 1x', () => {
    const a = dailyOffers(AT);
    const b = dailyOffers(AT);
    expect(a.map((o) => o.id)).toEqual(b.map((o) => o.id));
    const p = newProfile('t', 'T');
    p.moedas = 1_000_000;
    p.isvoid = 10_000;
    const offer = a.find((o) => o.kind === 'isvoidPack')!;
    buyOffer(p, offer, new Rng(1), AT);
    expect(() => buyOffer(p, offer, new Rng(1), AT)).toThrow(/Já comprado/);
  });
});
