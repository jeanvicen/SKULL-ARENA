import type { MissionDef } from './types';

/**
 * MISSÕES
 * -------
 * Todo dia o jogo sorteia 3 missões DIÁRIAS desta lista (o sorteio é o mesmo pra
 * todo mundo no mesmo dia). Toda semana, 3 SEMANAIS.
 * Objetivos (goal): play, win, kills, damage, heal, skulls, supers, skills,
 * boxes (caixas quebradas), playRole (com `role`), winMode (com `mode`), top3 (FFA).
 */
export const DAILY_MISSIONS: MissionDef[] = [
  {
    id: 'd_play3',
    text: 'Jogue 3 partidas',
    goal: 'play',
    target: 3,
    rewards: [
      { kind: 'moedas', amount: 80 },
      { kind: 'passXp', amount: 60 },
    ],
  },
  {
    id: 'd_win2',
    text: 'Vença 2 partidas',
    goal: 'win',
    target: 2,
    rewards: [
      { kind: 'moedas', amount: 120 },
      { kind: 'passXp', amount: 80 },
    ],
  },
  {
    id: 'd_kills10',
    text: 'Elimine 10 inimigos',
    goal: 'kills',
    target: 10,
    rewards: [
      { kind: 'moedas', amount: 100 },
      { kind: 'passXp', amount: 70 },
    ],
  },
  {
    id: 'd_dmg20k',
    text: 'Cause 20.000 de dano',
    goal: 'damage',
    target: 20000,
    rewards: [
      { kind: 'moedas', amount: 100 },
      { kind: 'passXp', amount: 70 },
    ],
  },
  {
    id: 'd_heal5k',
    text: 'Cure 5.000 de vida',
    goal: 'heal',
    target: 5000,
    rewards: [
      { kind: 'moedas', amount: 90 },
      { kind: 'passXp', amount: 60 },
    ],
  },
  {
    id: 'd_skulls15',
    text: 'Pegue 15 caveiras na Guerra de Gangues',
    goal: 'skulls',
    target: 15,
    rewards: [
      { kind: 'moedas', amount: 110 },
      { kind: 'passXp', amount: 70 },
    ],
  },
  {
    id: 'd_supers5',
    text: 'Use o SUPER 5 vezes',
    goal: 'supers',
    target: 5,
    rewards: [
      { kind: 'moedas', amount: 90 },
      { kind: 'passXp', amount: 60 },
    ],
  },
  {
    id: 'd_skills10',
    text: 'Use habilidades 10 vezes',
    goal: 'skills',
    target: 10,
    rewards: [
      { kind: 'moedas', amount: 80 },
      { kind: 'passXp', amount: 60 },
    ],
  },
  {
    id: 'd_boxes6',
    text: 'Quebre 6 caixas ou barris',
    goal: 'boxes',
    target: 6,
    rewards: [
      { kind: 'moedas', amount: 70 },
      { kind: 'passXp', amount: 50 },
    ],
  },
  {
    id: 'd_tank',
    text: 'Jogue 2 partidas com um Tanque',
    goal: 'playRole',
    role: 'tanque',
    target: 2,
    rewards: [
      { kind: 'moedas', amount: 90 },
      { kind: 'passXp', amount: 60 },
    ],
  },
  {
    id: 'd_support',
    text: 'Jogue 2 partidas com um Suporte',
    goal: 'playRole',
    role: 'suporte',
    target: 2,
    rewards: [
      { kind: 'moedas', amount: 90 },
      { kind: 'passXp', amount: 60 },
    ],
  },
  {
    id: 'd_sniper',
    text: 'Jogue 2 partidas com um Atirador',
    goal: 'playRole',
    role: 'atirador',
    target: 2,
    rewards: [
      { kind: 'moedas', amount: 90 },
      { kind: 'passXp', amount: 60 },
    ],
  },
  {
    id: 'd_ffa_top3',
    text: 'Fique no top 3 do Todos contra Todos',
    goal: 'top3',
    target: 1,
    rewards: [
      { kind: 'moedas', amount: 120 },
      { kind: 'passXp', amount: 80 },
    ],
  },
  {
    id: 'd_guerra',
    text: 'Vença 1 Guerra de Gangues',
    goal: 'winMode',
    mode: 'guerra',
    target: 1,
    rewards: [
      { kind: 'moedas', amount: 110 },
      { kind: 'passXp', amount: 70 },
    ],
  },
];

export const WEEKLY_MISSIONS: MissionDef[] = [
  {
    id: 'w_play20',
    text: 'Jogue 20 partidas',
    goal: 'play',
    target: 20,
    rewards: [
      { kind: 'chest', id: 'bau_caveira' },
      { kind: 'passXp', amount: 300 },
    ],
  },
  {
    id: 'w_win10',
    text: 'Vença 10 partidas',
    goal: 'win',
    target: 10,
    rewards: [
      { kind: 'isvoid', amount: 25 },
      { kind: 'passXp', amount: 300 },
    ],
  },
  {
    id: 'w_kills80',
    text: 'Elimine 80 inimigos',
    goal: 'kills',
    target: 80,
    rewards: [
      { kind: 'moedas', amount: 500 },
      { kind: 'passXp', amount: 250 },
    ],
  },
  {
    id: 'w_dmg150k',
    text: 'Cause 150.000 de dano',
    goal: 'damage',
    target: 150000,
    rewards: [
      { kind: 'moedas', amount: 500 },
      { kind: 'passXp', amount: 250 },
    ],
  },
  {
    id: 'w_supers30',
    text: 'Use o SUPER 30 vezes',
    goal: 'supers',
    target: 30,
    rewards: [
      { kind: 'isvoid', amount: 15 },
      { kind: 'passXp', amount: 250 },
    ],
  },
  { id: 'w_skulls80', text: 'Pegue 80 caveiras', goal: 'skulls', target: 80, rewards: [{ kind: 'chest', id: 'bau_mega' }] },
];

export const DAILY_COUNT = 3;
export const WEEKLY_COUNT = 3;
