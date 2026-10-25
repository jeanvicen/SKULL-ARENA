import type { ContentDB } from '../content/registry';
import { BotBrain } from '../entities/bot';
import { Rng } from '../engine/rng';
import { World, type MatchSetup } from './world';

/**
 * Partida local = mundo + cérebros dos bots. Independente de UI: a tela de jogo
 * usa isto, e os testes headless também. Um servidor futuro trocaria os
 * cérebros locais por inputs vindos da rede (ver src/net/contract.ts).
 */
export class LocalMatch {
  readonly world: World;
  readonly brains: BotBrain[] = [];
  private readonly aiRng: Rng;

  constructor(content: ContentDB, setup: MatchSetup) {
    this.world = new World(content, setup);
    this.aiRng = new Rng(setup.seed ^ 0x5bd1e995);
    for (const f of this.world.fighters) if (f.isBot && !f.isMinion) this.brains.push(new BotBrain(this.world, f, this.aiRng));
  }

  step(dt: number): void {
    for (const b of this.brains) b.update(dt);
    this.world.step(dt);
  }
}
