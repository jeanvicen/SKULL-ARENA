import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { PromoCodeDef } from '../src/content/types';
import { migrate, newProfile, type Profile } from '../src/meta/profile';

/**
 * BANCO DE DADOS DO SERVIDOR — um arquivo JSON (server-data/db.json).
 * Simples de ler, fazer backup e mexer na mão. Salva sozinho (com atraso curto)
 * e de forma atômica (escreve num .tmp e renomeia).
 * Pra muitos jogadores (milhares), troque por SQLite/Postgres mantendo esta interface.
 */

export interface Account {
  id: string;
  name: string;
  nameLower: string;
  salt: string;
  hash: string;
  created: number;
  profile: Profile;
  friends: string[];
  /** pedidos de amizade recebidos */
  requests: string[];
  lastMatchAt: number;
  banned?: boolean;
}

interface Data {
  v: 1;
  accounts: Record<string, Account>;
  tokens: Record<string, { id: string; exp: number }>;
  codes: PromoCodeDef[];
}

const TOKEN_DAYS = 60;

export class Db {
  private data: Data;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly file: string) {
    mkdirSync(dirname(file), { recursive: true });
    if (existsSync(file)) {
      this.data = JSON.parse(readFileSync(file, 'utf8')) as Data;
      for (const a of Object.values(this.data.accounts)) a.profile = migrate(a.profile) ?? newProfile(a.id, a.name);
    } else this.data = { v: 1, accounts: {}, tokens: {}, codes: [] };
  }

  save(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), 1500);
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data));
    renameSync(tmp, this.file);
  }

  // ------------------------------------------------------------- contas

  byName(name: string): Account | undefined {
    const k = name.trim().toLowerCase();
    return Object.values(this.data.accounts).find((a) => a.nameLower === k);
  }
  byId(id: string): Account | undefined {
    return this.data.accounts[id];
  }
  byTag(tag: string): Account | undefined {
    const t = tag.trim().toUpperCase();
    return Object.values(this.data.accounts).find((a) => a.profile.tag === t);
  }

  create(name: string, password: string): Account {
    const id = `acc_${randomBytes(8).toString('hex')}`;
    const salt = randomBytes(16).toString('hex');
    const acc: Account = {
      id,
      name: name.trim(),
      nameLower: name.trim().toLowerCase(),
      salt,
      hash: hashPw(password, salt),
      created: Date.now(),
      profile: newProfile(id, name.trim()),
      friends: [],
      requests: [],
      lastMatchAt: 0,
    };
    // TAG única
    while (Object.values(this.data.accounts).some((a) => a.profile.tag === acc.profile.tag)) acc.profile.tag = randomBytes(3).toString('hex').toUpperCase();
    this.data.accounts[id] = acc;
    this.save();
    return acc;
  }

  checkPassword(acc: Account, password: string): boolean {
    const a = Buffer.from(hashPw(password, acc.salt), 'hex');
    const b = Buffer.from(acc.hash, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  newToken(id: string): string {
    const t = randomBytes(32).toString('hex');
    this.data.tokens[t] = { id, exp: Date.now() + TOKEN_DAYS * 86400000 };
    this.save();
    return t;
  }

  auth(token: string | undefined | null): Account | null {
    if (!token) return null;
    const s = this.data.tokens[token];
    if (!s) return null;
    if (s.exp < Date.now()) {
      delete this.data.tokens[token];
      return null;
    }
    const a = this.data.accounts[s.id];
    return a && !a.banned ? a : null;
  }

  // ------------------------------------------------------------- códigos

  get codes(): PromoCodeDef[] {
    return this.data.codes;
  }
  set codes(list: PromoCodeDef[]) {
    this.data.codes = list;
    this.save();
  }
}

function hashPw(password: string, salt: string): string {
  return scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex');
}
