import { audio } from '../../audio/audio';
import { getCharacter } from '../../content/characters';
import { CHEST } from '../../content/chests';
import { getPet } from '../../content/pets';
import { RARITY, ROLES } from '../../content/rarities';
import type { RarityId } from '../../content/types';
import { darken, lighten } from '../../art/color';
import type { ChestCard, ChestOpen, DropOpen } from '../../meta/economy';
import { store } from '../../meta/store';
import type { App } from '../app';
import { btn, coinIcon, h, num, toast, fill } from '../dom';
import { CharView, PetView } from '../pixelView';
import { gainCard } from '../rewards';

/**
 * ABERTURA DE BAÚ
 * 1) o baú cai e quica  2) toque pra sacudir (a cor do brilho entrega a raridade!)
 * 3) abre com explosão de luz  4) cartas uma a uma (toque pra virar)  5) resumo
 */

const CW = 56;
const CH = 48;
const INK = '#160d22';

function paintChest(g: CanvasRenderingContext2D, color: string, glow: string, open: number, tier: number, t = 0): void {
  g.clearRect(0, 0, CW, CH);
  const r = (x: number, y: number, w: number, hh: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(x, y, w, hh);
  };
  const lite = lighten(color, 0.35);
  const base = color;
  const dark = darken(color, 0.3);
  const dark2 = darken(color, 0.55);
  const metal = tier >= 4 ? '#ffd23f' : tier >= 3 ? '#e8e8f0' : '#c9b48a';
  const metalL = lighten(metal, 0.45);
  const metalD = darken(metal, 0.45);
  const opened = open > 0.15;
  // ---------------- tampa aberta (atrás do corpo)
  if (opened) {
    const ly = 4;
    r(7, ly, 42, 13, INK);
    r(8, ly + 1, 40, 11, dark2);
    r(8, ly + 1, 40, 2, dark);
    for (let x = 16; x < 46; x += 8) r(x, ly + 3, 1, 8, INK);
    r(11, ly + 1, 3, 11, metalD);
    r(42, ly + 1, 3, 11, metalD);
  }
  // ---------------- corpo
  r(5, 23, 46, 23, INK);
  r(6, 24, 44, 21, base);
  r(6, 24, 44, 2, lite);
  r(6, 39, 44, 5, dark);
  r(6, 44, 44, 1, dark2);
  for (let x = 6; x < 50; x += 9) r(x + 8, 27, 1, 12, dark);
  // cantoneiras e cintas
  for (const x of [10, 42]) {
    r(x, 24, 4, 21, metal);
    r(x, 24, 4, 1, metalL);
    r(x + 3, 24, 1, 21, metalD);
    r(x + 1, 30, 1, 1, metalD);
    r(x + 1, 38, 1, 1, metalD);
  }
  r(6, 42, 4, 3, metal);
  r(46, 42, 4, 3, metal);
  // ---------------- interior + luz
  if (opened) {
    r(7, 21, 42, 4, INK);
    r(8, 22, 40, 3, '#1a0d24');
    g.globalAlpha = Math.min(1, open * 1.4);
    r(9, 22, 38, 2, glow);
    // feixes de luz subindo
    g.globalAlpha = 0.35 * Math.min(1, open * 1.4);
    for (let i = 0; i < 5; i++) {
      const bx = 11 + i * 7 + Math.round(Math.sin(t * 3 + i) * 1);
      const bh = 18 + ((i * 7 + Math.floor(t * 10)) % 5);
      r(bx, 22 - bh, 3, bh, glow);
    }
    g.globalAlpha = 1;
    // brilhinhos
    for (let i = 0; i < 6; i++) {
      const sx = 10 + ((i * 13 + Math.floor(t * 20)) % 36);
      const sy = 2 + ((i * 7 + Math.floor(t * 30)) % 18);
      r(sx, sy, 1, 1, '#ffffff');
    }
  } else {
    // ---------------- tampa fechada (abaulada)
    const lift = Math.round(open * 6);
    const ly = 8 - lift;
    r(10, ly - 1, 36, 1, INK);
    r(7, ly, 42, 1, INK);
    r(5, ly + 1, 46, 16, INK);
    r(10, ly, 36, 1, lite);
    r(7, ly + 1, 42, 1, lite);
    r(6, ly + 2, 44, 3, lite);
    r(6, ly + 5, 44, 8, base);
    r(6, ly + 13, 44, 3, dark);
    r(6, ly + 16, 44, 1, INK);
    for (let x = 6; x < 50; x += 9) r(x + 8, ly + 5, 1, 8, dark);
    for (const x of [10, 42]) {
      r(x, ly, 4, 16, metal);
      r(x, ly, 4, 1, metalL);
      r(x + 3, ly, 1, 16, metalD);
    }
    // fechadura de caveira
    r(23, ly + 10, 10, 11, INK);
    r(24, ly + 11, 8, 9, metal);
    r(24, ly + 11, 8, 1, metalL);
    r(25, ly + 13, 2, 2, INK);
    r(29, ly + 13, 2, 2, INK);
    r(27, ly + 16, 2, 1, INK);
    r(25, ly + 18, 6, 1, metalD);
  }
  // gema nos baús raros
  if (tier >= 3) {
    r(26, 33, 5, 5, INK);
    r(27, 34, 3, 3, glow);
    r(27, 34, 1, 1, '#ffffff');
  }
}

interface FlowOpts {
  title: string;
  color: string;
  glow: string;
  tier: number;
  best: RarityId;
  vicen: boolean;
  cards: ChestCard[];
}

/** Compra/abre um baú e roda a animação. */
export async function openChestFlow(app: App, chestId: string, paid: boolean, onDone: () => void): Promise<void> {
  let res: ChestOpen;
  try {
    res = await store.run('openChest', { id: chestId, paid });
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), 'err');
    return;
  }
  if (paid) audio.play('ui_buy');
  const c = CHEST[chestId]!;
  runChestAnimation({ title: c.name, color: c.color, glow: c.glow, tier: c.tier, best: res.best, vicen: res.vicen, cards: res.cards }, onDone);
  void app;
}

function runChestAnimation(o: FlowOpts, onDone: () => void): void {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const S = Math.max(3, Math.floor((Math.min(window.innerWidth * 0.3, window.innerHeight * 0.42) * dpr) / CW));
  const cv = h<'canvas'>('canvas.chest-canvas.pix-canvas');
  cv.width = CW * S;
  cv.height = CH * S;
  cv.style.width = `${(CW * S) / dpr}px`;
  const low = document.createElement('canvas');
  low.width = CW;
  low.height = CH;
  const lg = low.getContext('2d')!;
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const hint = h('div.chest-hint', null, 'TOQUE!');
  const counter = h('div.chest-count');
  const stageEl = h('div.chest-stage', null, h('div.chest-rays'), cv, hint, counter);
  const root = h('div.chest-overlay', { style: `--cc:${o.color};--cg:${o.glow}` }, h('div.chest-title', null, o.title), stageEl);
  document.body.appendChild(root);
  audio.play('chest_drop');
  let open = 0;
  let taps = 0;
  const need = Math.min(4, 1 + Math.ceil(o.tier / 2));
  let glow = o.glow;
  let raf = 0;
  let opened = false;
  const bestColor = RARITY[o.best].color;
  // a raridade vai "subindo" a cada toque (suspense)
  const escalate = (i: number) => {
    const tiers: string[] = ['#ffffff', RARITY.raro.color, RARITY.epico.color, RARITY.god.color];
    const bestTier = RARITY[o.best].tier;
    const cap = bestTier >= 5 ? 3 : bestTier >= 4 ? 2 : bestTier >= 2 ? 1 : 0;
    return tiers[Math.min(cap, i)]!;
  };
  const t0 = performance.now();
  const draw = () => {
    if (opened) open = Math.min(1, open + 0.06);
    paintChest(lg, o.color, glow, open, o.tier, (performance.now() - t0) / 1000);
    g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(low, 0, 0, CW * S, CH * S);
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  setTimeout(() => stageEl.classList.add('landed'), 450);
  counter.textContent = `${o.cards.length} prêmio${o.cards.length > 1 ? 's' : ''}`;

  const onTap = () => {
    if (opened) return;
    taps++;
    glow = escalate(taps - 1);
    root.style.setProperty('--cg', glow);
    stageEl.classList.remove('shake');
    void stageEl.offsetWidth;
    stageEl.classList.add('shake');
    stageEl.style.setProperty('--shk', String(Math.min(3, taps)));
    audio.play('chest_shake');
    if (navigator.vibrate) navigator.vibrate(20 + taps * 10);
    if (taps >= need) {
      opened = true;
      glow = o.vicen ? '#ff3df2' : bestColor;
      root.style.setProperty('--cg', glow);
      root.classList.add('opened');
      if (o.vicen) root.classList.add('vicen');
      audio.play('chest_open');
      hint.textContent = '';
      setTimeout(() => {
        root.removeEventListener('pointerdown', onTap);
        cancelAnimationFrame(raf);
        showCards(root, o, onDone);
      }, 900);
    }
  };
  root.addEventListener('pointerdown', onTap);
}

function cardFace(c: ChestCard): HTMLElement {
  const r = RARITY[c.rarity];
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  if (c.kind === 'moedas' || c.kind === 'isvoid')
    return h(
      `div.card-face.${c.kind}`,
      null,
      h('div.cf-big', null, coinIcon(c.kind)),
      h('div.cf-amt', null, `+${num(c.amount ?? 0)}`),
      h('div.cf-lbl', null, c.kind === 'moedas' ? 'Moedas da Morte' : 'Isvoid'),
    );
  if (c.kind === 'character' && c.id) {
    const def = getCharacter(c.id);
    const scale = Math.max(2, Math.floor((window.innerHeight * 0.32 * dpr) / 84));
    const v = new CharView(def, scale, { state: 'victory' });
    v.el.style.width = `${v.el.width / dpr}px`;
    return h(
      'div.card-face.char',
      { style: `--rc:${r.color};--rc2:${r.color2}` },
      h('div.cf-rar', null, r.name.toUpperCase()),
      v.el,
      h('div.cf-name', null, def.name),
      h('div.cf-role', null, `${ROLES[def.role].icon} ${ROLES[def.role].name}`),
      h('div.cf-tag', null, c.isNew ? 'NOVO!' : `repetido → +${num(c.dupMoedas ?? 0)} moedas${c.dupIsvoid ? ` · +${c.dupIsvoid} Isvoid` : ''}`),
    );
  }
  if (c.kind === 'pet' && c.id) {
    const pet = getPet(c.id)!;
    const scale = Math.max(3, Math.floor((window.innerHeight * 0.26 * dpr) / 36));
    const v = new PetView(pet, scale);
    v.el.style.width = `${v.el.width / dpr}px`;
    return h(
      'div.card-face.pet',
      { style: `--rc:${r.color};--rc2:${r.color2}` },
      h('div.cf-rar', null, `PET ${r.name.toUpperCase()}`),
      v.el,
      h('div.cf-name', null, pet.name),
      h('div.cf-tag', null, c.isNew ? 'NOVO PET!' : `repetido → +${num(c.dupMoedas ?? 0)} moedas`),
    );
  }
  return h('div.card-face');
}

function showCards(root: HTMLElement, o: FlowOpts, onDone: () => void): void {
  root.classList.add('cards');
  const left = h('div.cards-left');
  const slot = h('div.card-slot');
  const tip = h('div.chest-hint', null, 'toque pra continuar');
  fill(root, h('div.chest-rays'), slot, left, tip);
  let i = 0;
  const next = () => {
    if (i >= o.cards.length) return summary();
    const c = o.cards[i++]!;
    left.textContent = o.cards.length - i > 0 ? `+${o.cards.length - i}` : '';
    const rare = c.kind === 'character' || c.kind === 'pet';
    const tier = RARITY[c.rarity].tier;
    root.style.setProperty('--cg', rare ? RARITY[c.rarity].color : o.glow);
    root.classList.toggle('vicen', c.rarity === 'creators');
    const card = h(`div.card.flip${rare ? `.rare.t${tier}` : ''}`, null, h('div.card-back'), cardFace(c));
    fill(slot, card);
    audio.play('card_flip');
    if (rare) setTimeout(() => audio.play(tier >= 5 ? 'god_reveal' : tier >= 3 ? 'epic_reveal' : 'rare_reveal'), 260);
    if (rare && tier >= 4 && navigator.vibrate) navigator.vibrate([40, 40, 80]);
  };
  const summary = () => {
    root.removeEventListener('pointerdown', next);
    const grid = h('div.gains');
    o.cards.forEach((c, k) => {
      const g =
        c.kind === 'moedas' || c.kind === 'isvoid'
          ? gainCard({ kind: c.kind, amount: c.amount ?? 0 })
          : c.kind === 'character'
            ? gainCard({ kind: 'character', id: c.id!, isNew: !!c.isNew, dupMoedas: c.dupMoedas ?? 0, dupIsvoid: c.dupIsvoid ?? 0 })
            : gainCard({ kind: 'pet', id: c.id!, isNew: !!c.isNew, dupMoedas: c.dupMoedas ?? 0 });
      g.style.animationDelay = `${k * 70}ms`;
      grid.appendChild(g);
    });
    root.classList.remove('vicen');
    fill(
      root,
      h(
        'div.chest-summary.pixel-panel',
        null,
        h('h2', null, o.title),
        grid,
        h(
          'div.row.center',
          null,
          btn('CONTINUAR', 'btn-yellow big', () => close()),
        ),
      ),
    );
  };
  const close = () => {
    root.classList.add('out');
    setTimeout(() => {
      root.remove();
      onDone();
    }, 250);
  };
  root.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    next();
  });
  next();
}

// ---------------------------------------------------------------------------
// Drop da Caveira
// ---------------------------------------------------------------------------

export async function openDropFlow(app: App, onDone: () => void): Promise<void> {
  let res: DropOpen;
  try {
    res = await store.run('openDrop');
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), 'err');
    return;
  }
  void app;
  const orb = h('div.drop-orb', null, h('span', null, '💀'));
  const label = h('div.drop-label', null, RARITY[res.steps[0]!].name.toUpperCase());
  const hint = h('div.chest-hint', null, 'TOQUE!');
  const root = h('div.chest-overlay.drop', { style: `--cg:${RARITY[res.steps[0]!].color}` }, h('div.chest-title', null, 'DROP DA CAVEIRA'), h('div.chest-rays'), orb, label, hint);
  document.body.appendChild(root);
  audio.play('chest_drop');
  let step = 0;
  let done = false;
  const tap = () => {
    if (done) return;
    if (step < res.steps.length - 1) {
      step++;
      const r = RARITY[res.steps[step]!];
      root.style.setProperty('--cg', r.color);
      label.textContent = r.name.toUpperCase();
      orb.classList.remove('pop');
      void orb.offsetWidth;
      orb.classList.add('pop');
      audio.play(step >= 3 ? 'epic_reveal' : 'rare_reveal');
      return;
    }
    done = true;
    audio.play('chest_open');
    root.removeEventListener('pointerdown', tap);
    const grid = h('div.gains');
    for (const g of res.gains) grid.appendChild(gainCard(g));
    fill(
      root,
      h(
        'div.chest-summary.pixel-panel',
        null,
        h('h2', { style: `color:${RARITY[res.rarity].color}` }, `DROP ${RARITY[res.rarity].name.toUpperCase()}`),
        grid,
        h(
          'div.row.center',
          null,
          btn('CONTINUAR', 'btn-yellow big', () => {
            root.remove();
            onDone();
          }),
        ),
      ),
    );
  };
  root.addEventListener('pointerdown', tap);
}
