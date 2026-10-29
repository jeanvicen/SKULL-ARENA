import { DEFAULT_CONTROLS, type ControlSettings } from '../input/controls';
import type { PromoCodeDef } from '../content/types';
import { Rng } from '../engine/rng';
import { net } from '../net/online';
import { ACTIONS, type ActionArgs, type ActionName, type ActionResult } from './actions';
import { EconomyError } from './economy';
import { migrate, newProfile, type Profile } from './profile';

/**
 * ARMAZENAMENTO (modo local)
 * --------------------------
 * • Contas ficam neste aparelho (localStorage). A senha NUNCA é salva: guardamos
 *   só um hash PBKDF2 com sal (WebCrypto). Isso protege a conta de quem usa o
 *   mesmo aparelho, mas NÃO é um servidor — a tela de login avisa isso.
 * • No modo online (npm run server) as contas ficam no servidor (ver net/online.ts).
 */

const K_ACCOUNTS = 'skull.accounts';
const K_SESSION = 'skull.session';
const K_SETTINGS = 'skull.settings';
const K_CODES = 'skull.customCodes';
const kProfile = (id: string) => `skull.profile.${id}`;

export interface LocalAccount {
  id: string;
  name: string;
  salt: string;
  hash: string;
  created: number;
}

export interface Settings {
  music: number;
  sfx: number;
  voice: number;
  /** 'auto' ajusta sozinho se o FPS cair */
  quality: 'alta' | 'media' | 'baixa' | 'auto';
  controls: ControlSettings;
  showFps: boolean;
  /** tremidas de tela */
  shake: boolean;
  /** dificuldade dos BOTs 0..1 */
  botLevel: number;
}

export const DEFAULT_SETTINGS: Settings = {
  music: 0.55,
  sfx: 0.85,
  voice: 0.9,
  quality: 'auto',
  controls: { ...DEFAULT_CONTROLS },
  showFps: false,
  shake: true,
  botLevel: 0.55,
};

function read<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* armazenamento cheio/bloqueado: segue sem salvar */
  }
}

// ---------------------------------------------------------------- senhas

function b64(buf: ArrayBuffer | Uint8Array): string {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const x of u) s += String.fromCharCode(x);
  return btoa(s);
}

async function hashPassword(password: string, saltB64: string): Promise<string> {
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 120_000 }, key, 256);
  return b64(bits);
}

export function validName(name: string): string | null {
  const n = name.trim();
  if (n.length < 3) return 'O nome precisa de pelo menos 3 letras.';
  if (n.length > 16) return 'Máximo de 16 caracteres.';
  if (!/^[\p{L}\p{N}_ .-]+$/u.test(n)) return 'Use só letras, números, espaço, ponto, _ ou -.';
  return null;
}

// ---------------------------------------------------------------- loja de estado

type Listener = () => void;

export class Store {
  profile: Profile | null = null;
  account: LocalAccount | null = null;
  settings: Settings;
  private listeners = new Set<Listener>();
  /** sorteios do cliente (baús etc.) */
  rng = new Rng((Math.random() * 2 ** 32) >>> 0);

  constructor() {
    const s = read<Partial<Settings>>(K_SETTINGS, {});
    this.settings = { ...DEFAULT_SETTINGS, ...s, controls: { ...DEFAULT_CONTROLS, ...(s.controls ?? {}) } };
  }

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(): void {
    for (const l of this.listeners) l();
  }

  accounts(): LocalAccount[] {
    return read<LocalAccount[]>(K_ACCOUNTS, []);
  }

  /** Modo online ligado? (servidor configurado) */
  get online(): boolean {
    return net.configured();
  }

  /** Tenta voltar pra última conta logada (servidor ou aparelho). */
  async resume(): Promise<boolean> {
    if (net.configured()) {
      const p = await net.resume();
      if (!p) return false;
      this.profile = migrate(p);
      this.account = null;
      return !!this.profile;
    }
    const id = read<string | null>(K_SESSION, null);
    if (!id) return false;
    const acc = this.accounts().find((a) => a.id === id);
    if (!acc) return false;
    const p = migrate(read(kProfile(id), null));
    if (!p) return false;
    this.account = acc;
    this.profile = p;
    return true;
  }

  async register(name: string, password: string): Promise<void> {
    if (net.configured()) {
      this.profile = migrate(await net.register(name, password));
      this.emit();
      return;
    }
    const err = validName(name);
    if (err) throw new EconomyError(err);
    if (password.length < 4) throw new EconomyError('A senha precisa de pelo menos 4 caracteres.');
    const list = this.accounts();
    if (list.some((a) => a.name.toLowerCase() === name.trim().toLowerCase())) throw new EconomyError('Já existe uma conta com esse nome neste aparelho.');
    const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    const acc: LocalAccount = {
      id: `loc_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
      name: name.trim(),
      salt,
      hash: await hashPassword(password, salt),
      created: Date.now(),
    };
    list.push(acc);
    write(K_ACCOUNTS, list);
    this.account = acc;
    this.profile = newProfile(acc.id, acc.name);
    this.save();
    write(K_SESSION, acc.id);
    this.emit();
  }

  async login(name: string, password: string): Promise<void> {
    if (net.configured()) {
      this.profile = migrate(await net.login(name, password));
      this.emit();
      return;
    }
    const acc = this.accounts().find((a) => a.name.toLowerCase() === name.trim().toLowerCase());
    if (!acc) throw new EconomyError('Conta não encontrada neste aparelho.');
    if ((await hashPassword(password, acc.salt)) !== acc.hash) throw new EconomyError('Senha errada.');
    this.account = acc;
    this.profile = migrate(read(kProfile(acc.id), null)) ?? newProfile(acc.id, acc.name);
    write(K_SESSION, acc.id);
    this.save();
    this.emit();
  }

  logout(): void {
    if (net.configured()) net.logout();
    this.account = null;
    this.profile = null;
    write(K_SESSION, null);
    this.emit();
  }

  save(): void {
    if (this.profile && !net.configured()) write(kProfile(this.profile.id), this.profile);
  }

  /**
   * Executa uma AÇÃO do jogador (ver meta/actions.ts).
   * Local: roda aqui. Online: o servidor roda e devolve o perfil atualizado.
   * Se der erro (ex.: sem moedas), lança EconomyError e nada muda.
   */
  async run<K extends ActionName>(name: K, ...args: ActionArgs<K> extends undefined ? [] : [ActionArgs<K>]): Promise<ActionResult<K>> {
    const a = args[0];
    if (net.configured()) {
      const r = await net.act<ActionResult<K>>(name, a ?? {});
      this.profile = migrate(r.profile);
      this.emit();
      return r.result;
    }
    const fn = ACTIONS[name] as (p: Profile, c: { rng: Rng; codes: PromoCodeDef[] }, a: unknown) => ActionResult<K>;
    return this.act((p, rng) => fn(p, { rng, codes: this.customCodes() }, a));
  }

  saveSettings(): void {
    write(K_SETTINGS, this.settings);
    this.emit();
  }

  /**
   * Roda uma ação da economia num RASCUNHO do perfil. Se der erro, nada muda.
   * Se der certo, salva e avisa as telas.
   */
  act<T>(fn: (p: Profile, rng: Rng) => T): T {
    if (!this.profile) throw new EconomyError('Entre na sua conta primeiro.');
    const draft = structuredClone(this.profile);
    const out = fn(draft, this.rng);
    this.profile = draft;
    this.save();
    this.emit();
    return out;
  }

  // ------------------------------------------------ códigos criados no jogo

  customCodes(): PromoCodeDef[] {
    return read<PromoCodeDef[]>(K_CODES, []);
  }
  setCustomCodes(list: PromoCodeDef[]): void {
    write(K_CODES, list);
    this.emit();
  }

  /** Exporta o perfil (backup) como texto. */
  exportProfile(): string {
    return JSON.stringify(this.profile);
  }
  importProfile(text: string): void {
    const p = migrate(JSON.parse(text));
    if (!p || !this.account) throw new EconomyError('Backup inválido.');
    p.id = this.account.id;
    this.profile = p;
    this.save();
    this.emit();
  }
}

export const store = new Store();
