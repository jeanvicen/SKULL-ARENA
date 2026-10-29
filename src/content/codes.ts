import type { PromoCodeDef } from './types';

/**
 * CÓDIGOS DE PRÊMIO
 * -----------------
 * Três jeitos de criar/apagar códigos:
 *  1) Aqui no arquivo (vale pra todo mundo depois de publicar o jogo).
 *  2) No jogo: Configurações → Painel do Criador (PIN abaixo) → Códigos.
 *     Esses ficam salvos no aparelho (modo local) ou no servidor (modo online).
 *  3) Terminal: `npm run novo:codigo -- VICEN100 moedas=500 isvoid=20`
 *
 * Prêmios possíveis (Reward): moedas, isvoid, xp, passXp, trophies, character,
 * pet, chest, randomCharacter, randomPet, title.
 * `perAccount` = quantas vezes cada conta pode usar (padrão 1).
 * `active: false` desliga sem apagar.
 */
export const CODES: PromoCodeDef[] = [
  {
    code: 'BEMVINDO',
    rewards: [
      { kind: 'moedas', amount: 500 },
      { kind: 'isvoid', amount: 20 },
    ],
    note: 'Presente de boas-vindas',
  },
  { code: 'SKULLARENA', rewards: [{ kind: 'chest', id: 'bau_caveira' }], note: 'Lançamento' },
  {
    code: 'CAVEIRA2026',
    rewards: [
      { kind: 'isvoid', amount: 50 },
      { kind: 'title', id: 'pioneiro', text: 'Pioneiro 2026' },
    ],
    validUntil: '2026-12-31T23:59:59-03:00',
  },
  {
    code: 'VICENRUPI',
    rewards: [
      { kind: 'passXp', amount: 500 },
      { kind: 'moedas', amount: 250 },
    ],
    note: 'Código do criador',
  },
  { code: 'HALLOWEEN', rewards: [{ kind: 'chest', id: 'bau_evento_halloween' }], validFrom: '2026-10-24T00:00:00-03:00', validUntil: '2026-11-08T23:59:59-03:00' },
  // <novo-codigo> (o script `npm run novo:codigo` adiciona códigos aqui)
];

/**
 * PIN do Painel do Criador (criar/apagar códigos, eventos de teste, dar moedas).
 * TROQUE antes de publicar! No modo online o servidor usa ADMIN_PIN do ambiente.
 */
export const ADMIN_PIN = '6666';
