import type { RarityId, RoleId } from './types';

/**
 * RARIDADES — ordem, nomes, cores e "orçamento de poder".
 * Este é o ÚNICO lugar onde a raridade é definida. Mudou aqui, muda no jogo todo.
 */
export interface RarityInfo {
  id: RarityId;
  name: string;
  /** posição (0 = mais comum) */
  tier: number;
  color: string;
  color2: string;
  /** ícone/sigla pra não depender só da cor (acessibilidade) */
  badge: string;
  /** multiplicador de vida/dano (personagens mais raros são mais fortes) */
  power: number;
  /** quantas habilidades (botões) o gerador dá pra essa raridade [min, max] */
  skills: [number, number];
  /** preço base na loja (Moedas da Morte) */
  shopPrice: number;
  /** quantos Isvoid vale se vier repetido (convertido) */
  duplicateIsvoid: number;
  /** quantas Moedas vale se vier repetido */
  duplicateMoedas: number;
  /** efeito visual no card: brilho animado */
  shine: 'none' | 'soft' | 'strong' | 'rainbow' | 'void';
}

export const RARITIES: RarityInfo[] = [
  { id: 'comum', name: 'Comum', tier: 0, color: '#a7b6c6', color2: '#5d6b7a', badge: 'C', power: 1.0, skills: [1, 1], shopPrice: 400, duplicateIsvoid: 0, duplicateMoedas: 60, shine: 'none' },
  { id: 'incomum', name: 'Incomum', tier: 1, color: '#5ee08a', color2: '#1f8a4c', badge: 'I', power: 1.02, skills: [1, 1], shopPrice: 900, duplicateIsvoid: 0, duplicateMoedas: 120, shine: 'none' },
  { id: 'raro', name: 'Raro', tier: 2, color: '#47b9ff', color2: '#1b5fc2', badge: 'R', power: 1.04, skills: [1, 2], shopPrice: 1800, duplicateIsvoid: 2, duplicateMoedas: 220, shine: 'soft' },
  { id: 'extremo', name: 'Extremo', tier: 3, color: '#ff8a3d', color2: '#c2410c', badge: 'X', power: 1.06, skills: [2, 2], shopPrice: 3500, duplicateIsvoid: 5, duplicateMoedas: 400, shine: 'soft' },
  { id: 'epico', name: 'Épico', tier: 4, color: '#b26bff', color2: '#6d28d9', badge: 'E', power: 1.09, skills: [2, 3], shopPrice: 7000, duplicateIsvoid: 12, duplicateMoedas: 800, shine: 'strong' },
  { id: 'god', name: 'GOD', tier: 5, color: '#ffd23f', color2: '#c98a00', badge: 'G', power: 1.13, skills: [3, 3], shopPrice: 15000, duplicateIsvoid: 30, duplicateMoedas: 1600, shine: 'rainbow' },
  { id: 'creators', name: 'CREATORs', tier: 6, color: '#ff3df2', color2: '#3df2ff', badge: '₹', power: 1.2, skills: [3, 3], shopPrice: 0, duplicateIsvoid: 120, duplicateMoedas: 5000, shine: 'void' },
];

export const RARITY: Record<RarityId, RarityInfo> = Object.fromEntries(RARITIES.map((r) => [r.id, r])) as Record<RarityId, RarityInfo>;
export const RARITY_ORDER: RarityId[] = RARITIES.map((r) => r.id);

export function rarityTier(id: RarityId): number {
  return RARITY[id].tier;
}

/** Papéis: nome, descrição e ícone. */
export interface RoleInfo {
  id: RoleId;
  name: string;
  desc: string;
  icon: string;
  color: string;
}

export const ROLES: Record<RoleId, RoleInfo> = {
  atacante: { id: 'atacante', name: 'Atacante', desc: 'Dano constante a média distância. Fácil de aprender.', icon: '🎯', color: '#ff5d5d' },
  tanque: { id: 'tanque', name: 'Tanque', desc: 'Muita vida. Abre espaço e segura a linha de frente.', icon: '🛡️', color: '#ffb02e' },
  suporte: { id: 'suporte', name: 'Suporte', desc: 'Cura, escudos e utilidade pro time.', icon: '💚', color: '#4be08c' },
  assassino: { id: 'assassino', name: 'Assassino', desc: 'Rápido e letal de perto. Caça quem está sozinho.', icon: '🗡️', color: '#c06bff' },
  atirador: { id: 'atirador', name: 'Atirador', desc: 'Alcance enorme e pouca vida. Mantenha distância.', icon: '🔭', color: '#47b9ff' },
  controle: { id: 'controle', name: 'Controle', desc: 'Áreas, lentidão e atordoamento. Domina o espaço.', icon: '🌀', color: '#3de0d0' },
  lancador: { id: 'lancador', name: 'Lançador', desc: 'Arremessa por cima das paredes. Expulsa quem se esconde.', icon: '💣', color: '#ff7ac8' },
};
