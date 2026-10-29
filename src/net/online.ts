import type { Profile } from '../meta/profile';

/**
 * CLIENTE ONLINE (opcional)
 * -------------------------
 * Só liga se você configurar um servidor (Configurações → Servidor online, ou
 * abrir o jogo pelo próprio servidor: `npm run server` serve o jogo + API).
 * Sem servidor o jogo funciona 100% local e as telas avisam isso.
 *
 * HTTP  /api/register  /api/login  /api/me  /api/act
 * WS    /ws  → amigos, chat, salas e partidas online (mensagens JSON {t: ...})
 */

export interface FriendInfo {
  id: string;
  name: string;
  tag: string;
  online: boolean;
  status: 'menu' | 'sala' | 'partida' | 'offline';
  trophies: number;
  char: string;
}

export interface ChatMsg {
  from: string;
  fromName: string;
  to: string;
  text: string;
  at: number;
}

export interface RoomMember {
  id: string;
  name: string;
  char: string;
  pet: string | null;
  level: number;
  ready: boolean;
  leader: boolean;
}

export interface RoomInfo {
  code: string;
  mode: string;
  members: RoomMember[];
  state: 'lobby' | 'playing';
}

type Handler = (msg: Record<string, unknown>) => void;

const K_TOKEN = 'skull.token';
const K_SERVER = 'skull.server';

class Net {
  url = '';
  token: string | null = null;
  ws: WebSocket | null = null;
  me: { id: string; name: string; tag: string } | null = null;
  friends: FriendInfo[] = [];
  requests: FriendInfo[] = [];
  chat: ChatMsg[] = [];
  room: RoomInfo | null = null;
  connected = false;
  private handlers = new Map<string, Set<Handler>>();
  private retry = 0;
  private retryTimer = 0;

  constructor() {
    try {
      this.token = localStorage.getItem(K_TOKEN);
      this.url = localStorage.getItem(K_SERVER) ?? '';
      // aberto pelo próprio servidor? usa a mesma origem
      if (!this.url && typeof location !== 'undefined' && (window as unknown as { __SKULL_SERVER__?: boolean }).__SKULL_SERVER__) this.url = location.origin;
    } catch {
      /* sem storage */
    }
  }

  configured(): boolean {
    return !!this.url;
  }

  setServer(url: string): void {
    this.url = url.trim().replace(/\/+$/, '');
    try {
      localStorage.setItem(K_SERVER, this.url);
    } catch {
      /* ok */
    }
    this.disconnect();
  }

  on(t: string, fn: Handler): () => void {
    let s = this.handlers.get(t);
    if (!s) this.handlers.set(t, (s = new Set()));
    s.add(fn);
    return () => s!.delete(fn);
  }
  private emit(t: string, msg: Record<string, unknown>): void {
    for (const fn of this.handlers.get(t) ?? []) fn(msg);
    for (const fn of this.handlers.get('*') ?? []) fn(msg);
  }

  private async http<T>(path: string, body?: unknown): Promise<T> {
    let r: Response;
    try {
      r = await fetch(`${this.url}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'content-type': 'application/json', ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error('Servidor fora do ar. Confira o endereço em Configurações.');
    }
    const data = (await r.json().catch(() => ({}))) as { error?: string } & T;
    if (!r.ok) throw new Error(data.error ?? `Erro do servidor (${r.status}).`);
    return data;
  }

  private setToken(t: string | null): void {
    this.token = t;
    try {
      if (t) localStorage.setItem(K_TOKEN, t);
      else localStorage.removeItem(K_TOKEN);
    } catch {
      /* ok */
    }
  }

  async register(name: string, password: string): Promise<Profile> {
    const r = await this.http<{ token: string; profile: Profile }>('/api/register', { name, password });
    this.setToken(r.token);
    this.connect();
    return r.profile;
  }

  async login(name: string, password: string): Promise<Profile> {
    const r = await this.http<{ token: string; profile: Profile }>('/api/login', { name, password });
    this.setToken(r.token);
    this.connect();
    return r.profile;
  }

  async resume(): Promise<Profile | null> {
    if (!this.token) return null;
    try {
      const r = await this.http<{ profile: Profile }>('/api/me');
      this.connect();
      return r.profile;
    } catch {
      return null;
    }
  }

  logout(): void {
    this.setToken(null);
    this.disconnect();
  }

  async act<R>(name: string, args: unknown): Promise<{ profile: Profile; result: R }> {
    return this.http('/api/act', { name, args });
  }

  /** Painel do Criador (servidor): lista/salva códigos. */
  async adminCodes(pin: string, list?: unknown[]): Promise<unknown[]> {
    const r = await this.http<{ codes: unknown[] }>('/api/admin/codes', { pin, list });
    return r.codes;
  }

  // ------------------------------------------------------------- tempo real

  connect(): void {
    if (!this.url || !this.token || this.ws) return;
    const wsUrl = `${this.url.replace(/^http/, 'ws')}/ws?token=${encodeURIComponent(this.token)}`;
    const ws = new WebSocket(wsUrl);
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true;
      this.retry = 0;
      this.emit('status', { connected: true });
    };
    ws.onmessage = (ev) => {
      let m: Record<string, unknown>;
      try {
        m = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      const t = String(m.t);
      if (t === 'hello') this.me = m.me as Net['me'];
      else if (t === 'friends') {
        this.friends = m.list as FriendInfo[];
        this.requests = m.requests as FriendInfo[];
      } else if (t === 'chat') {
        this.chat.push(m as unknown as ChatMsg);
        if (this.chat.length > 200) this.chat.shift();
      } else if (t === 'chatHistory') this.chat = m.list as ChatMsg[];
      else if (t === 'room') this.room = (m.room as RoomInfo | null) ?? null;
      this.emit(t, m);
    };
    ws.onclose = () => {
      this.ws = null;
      this.connected = false;
      this.emit('status', { connected: false });
      if (this.token && this.url) {
        clearTimeout(this.retryTimer);
        this.retryTimer = window.setTimeout(() => this.connect(), Math.min(15000, 1000 * 2 ** this.retry++));
      }
    };
  }

  disconnect(): void {
    clearTimeout(this.retryTimer);
    const ws = this.ws;
    this.ws = null;
    this.connected = false;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  }

  send(t: string, data: Record<string, unknown> = {}): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ t, ...data }));
    return true;
  }
}

export const net = new Net();
