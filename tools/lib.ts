/**
 * Ajudantes das ferramentas de terminal (tools/*.ts).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = join(import.meta.dirname, '..');

/** "Zé Neon!" → "ze_neon" */
export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

/** Insere `text` logo antes da linha que contém `marker`. */
export function insertBefore(file: string, marker: string, text: string): void {
  const path = join(ROOT, file);
  const src = readFileSync(path, 'utf8');
  const i = src.indexOf(marker);
  if (i < 0) throw new Error(`Marcador "${marker}" não encontrado em ${file}. Não apague os comentários <novo-...>!`);
  const lineStart = src.lastIndexOf('\n', i) + 1;
  writeFileSync(path, src.slice(0, lineStart) + text + src.slice(lineStart));
}

/** Lê argumentos: posicionais + chave=valor + --flag */
export function parseArgs(argv: string[]): { pos: string[]; kv: Record<string, string>; flags: Set<string> } {
  const pos: string[] = [];
  const kv: Record<string, string> = {};
  const flags = new Set<string>();
  for (const a of argv) {
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v === undefined) flags.add(k!);
      else kv[k!] = v;
    } else if (/^[a-zA-Z_]+=/.test(a)) {
      const [k, ...rest] = a.split('=');
      kv[k!] = rest.join('=');
    } else pos.push(a);
  }
  return { pos, kv, flags };
}

export function die(msg: string): never {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

export const RARITIES = ['comum', 'incomum', 'raro', 'extremo', 'epico', 'god', 'creators'] as const;
export const ROLES = ['atacante', 'tanque', 'suporte', 'assassino', 'atirador', 'controle', 'lancador'] as const;
