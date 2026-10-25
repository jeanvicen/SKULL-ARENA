/**
 * ════════════════════════════════════════════════════════════════════
 *  CAMADA DE REDE — CONTRATO (Fase 5). NADA AQUI É MULTIPLAYER ONLINE AINDA.
 * ════════════════════════════════════════════════════════════════════
 * O núcleo do jogo já fala com estas interfaces. Hoje só existe a
 * implementação LOCAL (bots no próprio aparelho). A implementação online
 * exige um servidor autoritativo (ver docs/ONLINE.md):
 *   - o servidor roda a MESMA simulação (src/combat/world.ts, determinística);
 *   - o cliente só envia intenções (ClientInputFrame) — nunca dano, vida,
 *     recompensa, inventário ou resultado de ranked;
 *   - o servidor envia snapshots; o cliente interpola e faz predição só do
 *     próprio movimento.
 */
import type { FighterInput, GameEvent } from '../combat/state';

export type NetStatus = 'offline' | 'connecting' | 'online' | 'reconnecting' | 'error';

/** Intenção do jogador em um tick (é tudo que o cliente pode mandar). */
export interface ClientInputFrame {
  tick: number;
  seq: number;
  input: Pick<FighterInput, 'moveX' | 'moveY' | 'aimX' | 'aimY' | 'attackHeld' | 'special' | 'specialAimX' | 'specialAimY'>;
}

/** Estado mínimo de um lutador num snapshot do servidor. */
export interface FighterSnapshot {
  id: number;
  x: number;
  y: number;
  facing: number;
  hp: number;
  maxHp: number;
  shield: number;
  alive: boolean;
  statuses: string[];
}

export interface ServerSnapshot {
  tick: number;
  /** Último seq de input do cliente já processado (reconciliação). */
  ackSeq: number;
  fighters: FighterSnapshot[];
  projectiles: Array<{ id: number; defId: string; x: number; y: number; vx: number; vy: number }>;
  events: GameEvent[];
}

export interface MatchResultAuthoritative {
  matchId: string;
  placement: number;
  won: boolean;
  /** Recompensas calculadas e gravadas PELO SERVIDOR. */
  rewards: { xp: number; coins: number; trophies: number };
  signature: string;
}

export interface MatchTransport {
  readonly status: NetStatus;
  connect(matchId: string, token: string): Promise<void>;
  sendInput(frame: ClientInputFrame): void;
  onSnapshot(cb: (s: ServerSnapshot) => void): void;
  onResult(cb: (r: MatchResultAuthoritative) => void): void;
  disconnect(): void;
}

export interface MatchmakingTicket {
  ticketId: string;
  mode: string;
  characterId: string;
  partyId?: string;
}

export interface MatchmakingService {
  enqueue(mode: string, characterId: string, petId: string | null): Promise<MatchmakingTicket>;
  cancel(ticketId: string): Promise<void>;
  onMatchFound(cb: (matchId: string, token: string) => void): void;
}

export interface Friend {
  id: string;
  name: string;
  online: boolean;
  trophies: number;
}

export interface SocialService {
  friends(): Promise<Friend[]>;
  sendFriendRequest(code: string): Promise<void>;
  respondFriendRequest(id: string, accept: boolean): Promise<void>;
  sendGift(friendId: string, gift: { coins?: number }): Promise<void>;
  createParty(): Promise<{ partyId: string; code: string }>;
  joinParty(code: string): Promise<void>;
}

export interface RoomService {
  createRoom(mode: string, mapId: string | null): Promise<{ code: string }>;
  joinRoom(code: string): Promise<void>;
}

/**
 * Implementação atual: tudo offline. Cada método de rede rejeita com uma
 * mensagem honesta para a UI exibir. Trocar por `OnlineServices` na Fase 5.
 */
export class OfflineServices {
  readonly status: NetStatus = 'offline';
  private notReady(): Promise<never> {
    return Promise.reject(new Error('Recurso online ainda não disponível: requer servidor (Fase 5). Jogue offline contra bots.'));
  }
  friends(): Promise<Friend[]> {
    return this.notReady();
  }
  sendFriendRequest(): Promise<void> {
    return this.notReady();
  }
  joinRoom(): Promise<void> {
    return this.notReady();
  }
  joinParty(): Promise<void> {
    return this.notReady();
  }
}

export const net = new OfflineServices();
