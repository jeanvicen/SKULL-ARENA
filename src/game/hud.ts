import { RARITY } from '../content/rarities';
import { fmtTime } from '../engine/math';
import { T } from '../sim/map';
import type { World } from '../sim/world';

/**
 * HUD da partida (DOM por cima do canvas): placar, tempo, feed de abates,
 * anúncios grandes, minimapa, contador de renascimento e botão de pausa.
 */
export class Hud {
  readonly root: HTMLDivElement;
  private timer: HTMLDivElement;
  private score: HTMLDivElement;
  private feed: HTMLDivElement;
  private ann: HTMLDivElement;
  private respawn: HTMLDivElement;
  private mini: HTMLCanvasElement;
  private miniBase: HTMLCanvasElement | null = null;
  private miniVersion = -1;
  private annT = 0;
  private lastScoreKey = '';
  onPause: () => void = () => {};

  constructor(
    host: HTMLElement,
    private readonly world: World,
    private readonly localId: number,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-score"></div>
        <div class="hud-timer">0:00</div>
      </div>
      <div class="hud-feed"></div>
      <div class="hud-ann"></div>
      <div class="hud-respawn"></div>
      <canvas class="hud-mini" width="150" height="100"></canvas>
      <button class="hud-pause" aria-label="Pausar">❚❚</button>
      <div class="hud-mode">${world.mode.icon} ${world.mode.name}</div>`;
    host.appendChild(this.root);
    this.timer = this.root.querySelector('.hud-timer')!;
    this.score = this.root.querySelector('.hud-score')!;
    this.feed = this.root.querySelector('.hud-feed')!;
    this.ann = this.root.querySelector('.hud-ann')!;
    this.respawn = this.root.querySelector('.hud-respawn')!;
    this.mini = this.root.querySelector('.hud-mini')!;
    this.root.querySelector('.hud-pause')!.addEventListener('click', () => this.onPause());
  }

  announce(text: string, kind: 'kill' | 'streak' | 'info' | 'warn' | 'big'): void {
    this.ann.className = `hud-ann show ${kind}`;
    this.ann.textContent = text;
    // reinicia a animação
    void this.ann.offsetWidth;
    this.ann.classList.add('pop');
    this.annT = kind === 'big' ? 0.9 : 1.6;
  }

  killFeed(killer: string, victim: string, kt: number, vt: number): void {
    const me = this.world.fighters[this.localId];
    const myTeam = me?.team ?? -1;
    const row = document.createElement('div');
    row.className = 'feed-row';
    const kc = kt === myTeam ? 'ally' : 'enemy';
    const vc = vt === myTeam ? 'ally' : 'enemy';
    row.innerHTML = `<b class="${kc}">${esc(killer)}</b> <span>💀</span> <b class="${vc}">${esc(victim)}</b>`;
    this.feed.prepend(row);
    while (this.feed.children.length > 4) this.feed.lastChild?.remove();
    setTimeout(() => row.classList.add('fade'), 3500);
    setTimeout(() => row.remove(), 4200);
  }

  update(dt: number): void {
    const w = this.world;
    const me = w.fighters[this.localId];
    this.timer.textContent = w.started ? fmtTime(w.timeLeft()) : fmtTime(w.mode.duration);
    this.timer.classList.toggle('low', w.started && w.timeLeft() < 30);
    // placar
    let key = '';
    let html = '';
    if (w.mode.teams === 2) {
      const my = me?.team ?? 0;
      const a = w.scores[my] ?? 0;
      const b = w.scores[1 - my] ?? 0;
      key = `${a}-${b}`;
      if (w.mode.modifiers?.boss && w.boss) {
        const frac = Math.max(0, w.boss.hp / w.boss.maxHp);
        key = `boss${Math.round(frac * 100)}`;
        html = `<div class="boss-bar"><span>👑 CAVEIRA GIGANTE</span><i style="width:${frac * 100}%"></i></div>`;
      } else html = `<span class="s ally">${a}</span><span class="vs">💀 ${w.mode.scoreToWin}</span><span class="s enemy">${b}</span>`;
    } else if (w.mode.teams === 0) {
      const ranked = w.fighters.slice().sort((x, y) => (w.scores[y.team] ?? 0) - (w.scores[x.team] ?? 0) || y.stats.kills - x.stats.kills);
      const pos = me ? ranked.indexOf(me) + 1 : 0;
      key = ranked
        .slice(0, 3)
        .map((f) => `${f.id}:${w.scores[f.team]}`)
        .join('|') + `#${pos}:${me ? w.scores[me.team] : 0}`;
      html =
        ranked
          .slice(0, 3)
          .map((f, i) => `<span class="ffa-row ${f.id === this.localId ? 'me' : ''}"><i>${i + 1}º</i> ${esc(f.name)} <b>${w.scores[f.team] ?? 0}</b></span>`)
          .join('') + (pos > 3 && me ? `<span class="ffa-row me"><i>${pos}º</i> Você <b>${w.scores[me.team] ?? 0}</b></span>` : '');
    } else {
      key = 'treino';
      html = '<span class="vs">🎯 TREINO</span>';
    }
    if (key !== this.lastScoreKey) {
      this.lastScoreKey = key;
      this.score.innerHTML = html;
      this.score.classList.remove('bump');
      void this.score.offsetWidth;
      this.score.classList.add('bump');
    }
    // renascimento
    if (me && !me.alive && !w.over) {
      this.respawn.classList.add('show');
      this.respawn.innerHTML = `<small>Renascendo em</small><b>${Math.max(1, Math.ceil(me.respawnT))}</b>`;
    } else this.respawn.classList.remove('show');
    // anúncio
    if (this.annT > 0) {
      this.annT -= dt;
      if (this.annT <= 0) this.ann.classList.remove('show', 'pop');
    }
    this.drawMini();
  }

  private drawMini(): void {
    const w = this.world;
    const m = w.map;
    const c = this.mini;
    const g = c.getContext('2d')!;
    const sx = c.width / m.w;
    const sy = c.height / m.h;
    if (!this.miniBase || this.miniVersion !== m.version) {
      this.miniVersion = m.version;
      this.miniBase = document.createElement('canvas');
      this.miniBase.width = c.width;
      this.miniBase.height = c.height;
      const b = this.miniBase.getContext('2d')!;
      b.fillStyle = 'rgba(20,12,34,0.85)';
      b.fillRect(0, 0, c.width, c.height);
      for (let y = 0; y < m.h; y++)
        for (let x = 0; x < m.w; x++) {
          const t = m.at(x, y);
          if (t === T.Floor || t === T.Rubble || t === T.Pad) continue;
          b.fillStyle = t === T.Bush ? '#2f7a52' : t === T.Water ? '#2d5a9a' : t === T.Hazard ? '#7a8a20' : t === T.Brick ? '#8a5a48' : '#6a6080';
          b.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
        }
    }
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(this.miniBase, 0, 0);
    const me = w.fighters[this.localId];
    const team = me?.team ?? -1;
    for (const p of w.pickups) {
      if (p.kind !== 'skull') continue;
      g.fillStyle = '#efe6d2';
      g.fillRect((p.x / 64) * sx - 1.5, (p.y / 64) * sy - 1.5, 3, 3);
    }
    for (const f of w.fighters) {
      if (!f.alive || !w.visibleTo(f, team)) continue;
      g.fillStyle = f.id === this.localId ? '#ffe14d' : f.team === team ? '#3db8ff' : '#ff3d4d';
      const r = f.id === this.localId ? 3.4 : 2.4;
      g.beginPath();
      g.arc((f.x / 64) * sx, (f.y / 64) * sy, r, 0, Math.PI * 2);
      g.fill();
    }
  }

  dispose(): void {
    this.root.remove();
  }
}

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export { RARITY };
