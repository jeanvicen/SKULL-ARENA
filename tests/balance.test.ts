import { describe, expect, it } from 'vitest';
import { duelMatrix } from './tools/balance';
import { db } from './helpers';

/**
 * Relatório de balanceamento 1v1 (lento). Roda com: npm run balance
 * Meta: nenhum personagem fora de 35%–65% de vitória contra o roster.
 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

describe.skipIf(!env.BALANCE)('balanceamento 1v1 (relatório)', () => {
  it('todo personagem fica numa faixa saudável', () => {
    const rows = duelMatrix(db);
    for (const r of rows) console.log(`${r.id.padEnd(14)} ${(r.rate * 100).toFixed(0)}%`);
    for (const r of rows) {
      expect(r.rate, r.id).toBeGreaterThan(0.35);
      expect(r.rate, r.id).toBeLessThan(0.65);
    }
  }, 900000);
});
