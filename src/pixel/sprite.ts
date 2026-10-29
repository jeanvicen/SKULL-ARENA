import type { CharacterDef, SheetDef } from '../content/types';
import type { ClipName } from '../art/anims';
import { PixelAnimator, type BaseState } from './animator';
import { FRAME_H, FRAME_W, ORIGIN_X, ORIGIN_Y, renderCharacter } from './character';
import { newCanvas } from './buffer';

type Canvas = HTMLCanvasElement | OffscreenCanvas;

/**
 * SPRITES DOS PERSONAGENS
 * -----------------------
 * • Personagem SEM `sheet`: os quadros são desenhados pelo gerador de pixel art.
 * • Personagem COM `sheet: 'sprites/meu-personagem.png'`: usa SEU desenho.
 *
 * Formato da folha (igual ao "Exportar sprite" do Estúdio):
 *   cada quadro 72×84 px, pés no ponto (36, 76); uma ANIMAÇÃO por LINHA:
 *     linha 0 parado (8 quadros) · 1 correndo (8) · 2 ataque (6) · 3 habilidade (6)
 *     linha 4 dano (3) · 5 vitória (8) · 6 derrota (4) · 7 arrancada (2)
 *   Quadros vazios no fim da linha são ignorados.
 */

export const SHEET_ROWS: Array<{ name: 'idle' | 'run' | 'attack' | 'cast' | 'hit' | 'victory' | 'defeat' | 'dash'; frames: number; fps: number }> = [
  { name: 'idle', frames: 8, fps: 8 },
  { name: 'run', frames: 8, fps: 12 },
  { name: 'attack', frames: 6, fps: 16 },
  { name: 'cast', frames: 6, fps: 14 },
  { name: 'hit', frames: 3, fps: 12 },
  { name: 'victory', frames: 8, fps: 8 },
  { name: 'defeat', frames: 4, fps: 6 },
  { name: 'dash', frames: 2, fps: 10 },
];

// --------------------------------------------------------------------------
// Cache global de quadros (LRU)
// --------------------------------------------------------------------------

const MAX_FRAMES = 900;
const frames = new Map<string, Canvas>();

function cached(key: string, make: () => Canvas): Canvas {
  const hit = frames.get(key);
  if (hit) {
    frames.delete(key);
    frames.set(key, hit);
    return hit;
  }
  const c = make();
  frames.set(key, c);
  if (frames.size > MAX_FRAMES) {
    const old = frames.keys().next().value;
    if (old !== undefined) frames.delete(old);
  }
  return c;
}

// --------------------------------------------------------------------------
// Folhas de sprite feitas à mão
// --------------------------------------------------------------------------

const sheets = new Map<string, { img: HTMLImageElement | null; ok: boolean }>();

function loadSheet(src: string): HTMLImageElement | null {
  let s = sheets.get(src);
  if (!s) {
    s = { img: null, ok: false };
    sheets.set(src, s);
    if (typeof Image !== 'undefined') {
      const img = new Image();
      img.onload = () => {
        s!.img = img;
        s!.ok = true;
      };
      img.onerror = () => console.warn(`[Skull Arena] Não achei a folha de sprite "${src}". Usando o desenho gerado.`);
      img.src = src.startsWith('http') || src.startsWith('/') || src.startsWith('data:') ? src : `${import.meta.env?.BASE_URL ?? './'}${src}`;
    }
  }
  return s.ok ? s.img : null;
}

function normSheet(sheet: CharacterDef['sheet']): SheetDef | null {
  if (!sheet) return null;
  return typeof sheet === 'string' ? { src: sheet } : sheet;
}

// --------------------------------------------------------------------------
// Sprite de um personagem
// --------------------------------------------------------------------------

export class CharSprite {
  readonly anim: PixelAnimator;
  private readonly sheet: SheetDef | null;
  private sheetT = 0;
  private sheetRow: (typeof SHEET_ROWS)[number] = SHEET_ROWS[0]!;
  private actionRow: (typeof SHEET_ROWS)[number] | null = null;
  private actionT = 0;

  constructor(
    readonly def: CharacterDef,
    /** variação de cor (skins) — muda a chave do cache */
    readonly variant = 0,
  ) {
    this.anim = new PixelAnimator(def.anim);
    this.sheet = normSheet(def.sheet);
  }

  get facing(): 1 | -1 {
    return this.anim.facing;
  }

  setState(s: BaseState): void {
    if (s !== this.anim.state) {
      this.sheetT = 0;
      this.sheetRow = SHEET_ROWS.find((r) => r.name === (s === 'stunned' ? 'hit' : s))!;
    }
    this.anim.setState(s);
  }

  playAction(kind: 'attack' | 'cast' | 'hit' | ClipName): void {
    if (kind === 'attack') this.anim.playAttack();
    else if (kind === 'hit') this.anim.playHit();
    else if (kind === 'cast') this.anim.playNamed('atk_cast');
    else this.anim.playNamed(kind);
    const row = kind === 'hit' ? 'hit' : kind === 'attack' ? 'attack' : 'cast';
    this.actionRow = SHEET_ROWS.find((r) => r.name === row)!;
    this.actionT = 0;
  }

  update(dt: number): void {
    this.anim.update(dt);
    this.sheetT += dt;
    if (this.actionRow) {
      this.actionT += dt;
      if (this.actionT > this.actionRow.frames / this.actionRow.fps) this.actionRow = null;
    }
  }

  /** Quadro atual (72×84). Desenhe com os pés em (ORIGIN_X, ORIGIN_Y). */
  frame(): Canvas {
    const sh = this.sheet ? loadSheet(this.sheet.src) : null;
    if (sh && this.sheet) return this.sheetFrame(sh, this.sheet);
    const a = this.anim;
    const key = `${this.def.id}#${this.variant}:${a.key()}`;
    return cached(key, () => {
      a.build();
      const buf = renderCharacter(this.def.look, a.pose, a.solved, { view: a.view });
      return buf.toCanvas();
    });
  }

  private sheetFrame(img: HTMLImageElement, s: SheetDef): Canvas {
    const fw = s.frameW ?? FRAME_W;
    const fh = s.frameH ?? FRAME_H;
    const row = this.actionRow ?? this.sheetRow;
    const t = this.actionRow ? this.actionT : this.sheetT;
    const rowIdx = SHEET_ROWS.indexOf(row);
    const count = s.frames?.[row.name] ?? row.frames;
    const f = this.actionRow ? Math.min(count - 1, Math.floor(t * row.fps)) : Math.floor(t * row.fps) % count;
    const key = `sheet:${s.src}:${rowIdx}:${f}`;
    return cached(key, () => {
      const c = newCanvas(FRAME_W, FRAME_H);
      const g = c.getContext('2d') as CanvasRenderingContext2D;
      g.imageSmoothingEnabled = false;
      // alinha a origem da folha com a origem padrão
      const ox = ORIGIN_X - (s.originX ?? ORIGIN_X);
      const oy = ORIGIN_Y - (s.originY ?? ORIGIN_Y);
      g.drawImage(img, f * fw, rowIdx * fh, fw, fh, ox, oy, fw, fh);
      return c;
    });
  }
}

/**
 * Gera a FOLHA DE SPRITE completa de um personagem (PNG pronto pra editar
 * no Piskel/Aseprite). Usado pelo botão "Exportar sprite" do Estúdio.
 */
export function buildSheet(def: CharacterDef): Canvas {
  const cols = Math.max(...SHEET_ROWS.map((r) => r.frames));
  const c = newCanvas(cols * FRAME_W, SHEET_ROWS.length * FRAME_H);
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.imageSmoothingEnabled = false;
  SHEET_ROWS.forEach((row, ri) => {
    const sp = new CharSprite({ ...def, sheet: undefined });
    const a = sp.anim;
    if (row.name === 'idle' || row.name === 'run' || row.name === 'victory' || row.name === 'defeat' || row.name === 'dash') sp.setState(row.name);
    for (let f = 0; f < row.frames; f++) {
      if (row.name === 'attack' || row.name === 'cast' || row.name === 'hit') {
        sp.playAction(row.name);
        a.actionT = f / row.fps;
      } else {
        // avança o tempo até o quadro certo
        a.baseT = f / row.fps;
      }
      a.build();
      const buf = renderCharacter(def.look, a.pose, a.solved, { view: 'front' });
      g.drawImage(buf.toCanvas() as CanvasImageSource, f * FRAME_W, ri * FRAME_H);
    }
  });
  return c;
}

/** Retrato estático (quadro parado) pra cards da coleção. */
export function portrait(def: CharacterDef): Canvas {
  return cached(`portrait:${def.id}`, () => {
    const sp = new CharSprite(def);
    return sp.frame();
  });
}

export { FRAME_W, FRAME_H, ORIGIN_X, ORIGIN_Y };
