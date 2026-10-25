import { audio } from '../../audio/audio';
import type { ChestDef } from '../../content/types';
import { Rng } from '../../engine/rng';
import { ParticleSystem } from '../../render/particles';
import {
  buyCharacter, buyChest, buyPet, buySkin, canAfford, chestOdds, claimDailyGift, dailyOffers, openChest, type ChestDrop,
} from '../../systems/economy';
import { drawPet } from '../../render/art/fxart';
import type { App, Screen } from '../app';
import { drawChest, menuBg, notice, portraitOf, priceLabel, rarityTag, topbar } from '../components';
import { fmt, h, ICON, svg } from '../dom';

function chestCanvas(chest: ChestDef, size = 110): HTMLCanvasElement {
  const cv = h('canvas', { width: String(size * 2), height: String(Math.round(size * 1.8)) }) as HTMLCanvasElement;
  drawChest(cv.getContext('2d')!, chest, cv.width, cv.height);
  return cv;
}

function oddsTable(app: App, chest: ChestDef): HTMLElement {
  const rows = chestOdds(app.content, chest);
  return h('div', { class: 'odds' },
    h('span', null, `Por rolagem (${chest.rolls}x):`), h('span', null, ''),
    ...rows.flatMap((r) => [h('span', { style: `color:${app.content.rarity(r.rarity).color}` }, app.content.rarity(r.rarity).name), h('span', null, `${(r.p * 100).toFixed(r.p < 0.01 ? 2 : 1)}%`)]),
    h('span', null, 'Moedas'), h('span', null, `${chest.coins[0]}–${chest.coins[1]}`),
    h('span', null, 'Diamantes'), h('span', null, `${Math.round(chest.gems.chance * 100)}% · ${chest.gems.min}–${chest.gems.max}`),
  );
}

export function shopScreen(app: App): Screen {
  const s = app.save;
  const content = app.content;
  const body = h('div', { class: 'scroll' });

  const render = () => {
    body.innerHTML = '';
    // Presente diário
    const today = new Date().toISOString().slice(0, 10);
    const claimed = s.lastDailyGift === today;
    body.append(h('div', { class: 'panel', style: 'padding:12px;display:flex;align-items:center;gap:12px;margin-top:4px' },
      h('div', { style: 'width:54px;height:54px;flex:none' }, svg(ICON.gift)),
      h('div', { style: 'flex:1' }, h('div', { class: 'display', style: 'font-size:17px' }, 'Presente diário'), h('div', { class: 'small muted', style: 'font-weight:800' }, `+${content.shop.dailyFreeCoins} moedas · +${content.shop.dailyFreeGems} diamantes · grátis todo dia`)),
      h('button', { class: `btn small ${claimed ? 'dark disabled' : 'green'}`, disabled: claimed, onclick: () => {
        if (claimDailyGift(content, s)) {
          audio.play('reward');
          app.toast(`+${content.shop.dailyFreeCoins} moedas e +${content.shop.dailyFreeGems} diamantes!`, 'gold');
          app.persist();
          render();
        }
      } }, claimed ? 'Amanhã tem mais' : 'Pegar'),
    ));

    // Vitrine do dia
    const offers = dailyOffers(content, s);
    body.append(h('div', { class: 'section-title' }, 'Vitrine do dia', h('small', null, 'renova à meia-noite')));
    const og = h('div', { class: 'shop-grid' });
    if (!offers.length) og.append(h('div', { class: 'muted small' }, 'Você já tem tudo da vitrine de hoje!'));
    for (const o of offers) {
      if (o.kind === 'character') {
        const def = content.characters.get(o.id)!;
        og.append(h('div', { class: 'offer', style: `border-color:${content.rarity(def.rarity).color}` },
          h('div', { class: 'ribbon' }, 'PERSONAGEM'),
          h('img', { src: portraitOf(app, def, 'default', 160), alt: '' }),
          h('div', { class: 'on stroke' }, def.name), rarityTag(app, def.rarity),
          h('button', { class: `btn small ${canAfford(s, o.price) ? 'gold' : 'dark'}`, onclick: async () => {
            if (!(await app.confirm(`Comprar ${def.name}?`, `${def.title}. Ele entra no seu inventário na hora.`, 'Comprar'))) return;
            if (buyCharacter(content, s, def.id)) {
              audio.play('legendary', 0.7);
              app.toast(`${def.name} entrou para o seu exército!`, 'gold');
              app.persist();
              render();
            } else app.toast('Saldo insuficiente', 'bad');
          } }, priceLabel(o.price)),
        ));
      } else if (o.kind === 'skin') {
        const sk = content.skins.get(o.id)!;
        const def = content.characters.get(o.characterId!)!;
        og.append(h('div', { class: 'offer', style: sk.tier === 'lendaria' ? 'border-color:var(--gold)' : '' },
          h('div', { class: 'ribbon', style: sk.tier === 'lendaria' ? 'background:var(--gold);color:#3a1f00' : '' }, sk.tier === 'lendaria' ? 'LENDÁRIA' : 'SKIN'),
          h('img', { src: portraitOf(app, def, sk.id, 160), alt: '' }),
          h('div', { class: 'on stroke' }, sk.name), h('div', { class: 'os' }, `para ${def.name}`),
          h('button', { class: `btn small ${canAfford(s, o.price) ? 'gold' : 'dark'}`, onclick: async () => {
            if (!(await app.confirm(`Comprar ${sk.name}?`, `Skin para ${def.name}.`, 'Comprar'))) return;
            if (buySkin(content, s, def.id, sk.id)) {
              s.characters[def.id].skin = sk.id;
              audio.play('reward');
              app.toast(`${sk.name} equipada em ${def.name}!`, 'gold');
              app.persist();
              render();
            } else app.toast('Saldo insuficiente', 'bad');
          } }, priceLabel(o.price)),
        ));
      }
    }
    body.append(og);

    // Baús
    body.append(h('div', { class: 'section-title' }, 'Baús', h('small', null, 'chances sempre visíveis')));
    const cg = h('div', { class: 'shop-grid' });
    for (const id of content.shop.chests) {
      const chest = content.chests.get(id)!;
      let showOdds = false;
      const odds = h('div');
      const card = h('div', { class: 'offer', style: `border-color:${chest.color}66` },
        chestCanvas(chest, 70),
        h('div', { class: 'on stroke' }, chest.name),
        h('div', { class: 'os' }, chest.description),
        h('button', { class: 'btn small dark', onclick: () => { showOdds = !showOdds; odds.innerHTML = ''; if (showOdds) odds.append(oddsTable(app, chest)); } }, 'Ver chances'),
        odds,
        h('button', { class: `btn small ${canAfford(s, chest.price) ? 'gold' : 'dark'}`, onclick: () => {
          if (buyChest(content, s, id)) {
            audio.play('coin');
            app.persist();
            render();
            app.toast(`${chest.name} comprado! Abrindo…`, 'gold');
            openChestSequence(app, chest.id, () => render());
          } else app.toast('Saldo insuficiente', 'bad');
        } }, priceLabel(chest.price)),
      );
      cg.append(card);
    }
    body.append(cg);

    // Pets
    body.append(h('div', { class: 'section-title' }, 'Pets'));
    const pg = h('div', { class: 'shop-grid' });
    for (const pet of content.pets.values()) {
      const has = s.pets.includes(pet.id);
      const cv = h('canvas', { width: '192', height: '160' }) as HTMLCanvasElement;
      const c = cv.getContext('2d')!;
      c.scale(3, 3);
      drawPet(c, pet, 32, 24, 0.4, 0, false);
      pg.append(h('div', { class: 'offer' }, cv, h('div', { class: 'on stroke' }, pet.name), rarityTag(app, pet.rarity), h('div', { class: 'os' }, pet.description),
        has ? h('div', { class: 'chip', style: 'color:var(--green)' }, 'Você já tem')
          : pet.price ? h('button', { class: `btn small ${canAfford(s, pet.price) ? 'gold' : 'dark'}`, onclick: () => {
              if (buyPet(content, s, pet.id)) {
                audio.play('reward');
                app.toast(`${pet.name} agora te acompanha!`, 'gold');
                s.selectedPet = pet.id;
                app.persist();
                render();
              } else app.toast('Saldo insuficiente', 'bad');
            } }, priceLabel(pet.price)) : h('div', { class: 'chip' }, 'Inicial')));
    }
    body.append(pg);

    // Personagens (compra direta)
    const buyables = content.sortedCharacters().filter((c) => !s.characters[c.id] && c.obtain.includes('shop') && content.rarity(c.rarity).shopPrice);
    if (buyables.length) {
      body.append(h('div', { class: 'section-title' }, 'Personagens', h('small', null, 'compra direta (GOD e CREATOR só em baús)')));
      const chg = h('div', { class: 'shop-grid' });
      for (const def of buyables) {
        const price = content.rarity(def.rarity).shopPrice!;
        chg.append(h('div', { class: 'offer', style: `border-color:${content.rarity(def.rarity).color}88` },
          h('img', { src: portraitOf(app, def, 'default', 160), alt: '' }), h('div', { class: 'on stroke' }, def.name), rarityTag(app, def.rarity),
          h('button', { class: `btn small ${canAfford(s, price) ? 'gold' : 'dark'}`, onclick: async () => {
            if (!(await app.confirm(`Comprar ${def.name}?`, def.title, 'Comprar'))) return;
            if (buyCharacter(content, s, def.id)) {
              audio.play('legendary', 0.7);
              app.toast(`${def.name} desbloqueado!`, 'gold');
              app.persist();
              render();
            } else app.toast('Saldo insuficiente', 'bad');
          } }, priceLabel(price))));
      }
      body.append(chg);
    }

    // Diamantes (sem cobrança real)
    body.append(h('div', { class: 'section-title' }, 'Diamantes'));
    body.append(notice(content.shop.realPaymentsEnabled ? 'Pagamentos processados pela loja oficial.' : 'Compras com dinheiro real estão DESATIVADAS neste protótipo — nenhum valor é cobrado. Ganhe diamantes com o presente diário, níveis, missões, conquistas e baús.'));
    const gg = h('div', { class: 'shop-grid', style: 'margin-top:10px' });
    for (const g of content.shop.gemPacks) {
      gg.append(h('div', { class: 'offer', style: 'opacity:.75' }, h('div', { style: 'width:70px;height:70px' }, svg(ICON.gem)), h('div', { class: 'on stroke' }, `${fmt(g.gems)} diamantes`), h('div', { class: 'os' }, g.label),
        h('button', { class: 'btn small dark disabled', disabled: true, title: 'Pagamentos reais desativados' }, `${g.realPrice} · indisponível`)));
    }
    body.append(gg);
  };
  render();
  const el = h('div', { class: 'screen' }, menuBg(), topbar(app, { back: 'menu', title: 'Loja' }), body);
  return { el, back: 'menu' };
}

export function chestsScreen(app: App): Screen {
  const s = app.save;
  const content = app.content;
  const body = h('div', { class: 'scroll' });
  const render = () => {
    body.innerHTML = '';
    const counts = new Map<string, number>();
    for (const c of s.chests) counts.set(c, (counts.get(c) ?? 0) + 1);
    if (!counts.size) {
      body.append(h('div', { class: 'panel', style: 'padding:20px;text-align:center;margin-top:10px' },
        h('div', { style: 'width:90px;height:90px;margin:0 auto;opacity:.6' }, svg(ICON.chest)),
        h('h3', { class: 'stroke', style: 'margin:8px 0' }, 'Nenhum baú'),
        h('p', { class: 'muted', style: 'font-weight:700' }, 'Ganhe baús subindo de nível, na trilha de troféus, em missões, conquistas — e com sorte depois das partidas.'),
        h('button', { class: 'btn pink', onclick: () => void app.go('shop') }, 'Ir para a loja')));
    } else {
      const list = h('div', { class: 'chest-list', style: 'margin-top:6px' });
      for (const [id, n] of counts) {
        const chest = content.chests.get(id)!;
        list.append(h('div', { class: 'chest-card', style: `border-color:${chest.color}88`, onclick: () => { app.click(); openChestSequence(app, id, render); } },
          h('span', { class: 'chip cc' }, `x${n}`),
          chestCanvas(chest, 55),
          h('div', { class: 'cn stroke' }, chest.name),
          h('button', { class: 'btn small gold', style: 'margin-top:6px' }, 'Abrir')));
      }
      body.append(list);
    }
    body.append(h('div', { class: 'section-title' }, 'Chances por baú', h('small', null, 'transparência total')));
    for (const chest of content.chests.values()) {
      body.append(h('div', { class: 'panel', style: 'padding:10px 12px;margin-bottom:8px' }, h('div', { class: 'display' }, chest.name), oddsTable(app, chest)));
    }
  };
  render();
  const el = h('div', { class: 'screen' }, menuBg(), topbar(app, { back: 'menu', title: 'Baús' }), body);
  return { el, back: 'menu' };
}

/**
 * Abertura de baú: o resultado é sorteado e SALVO antes da animação
 * (fechar no meio não perde nada). Depois: tremer → explodir → revelar 1 a 1.
 */
export function openChestSequence(app: App, chestId: string, onDone: () => void): void {
  const s = app.save;
  const content = app.content;
  const idx = s.chests.indexOf(chestId);
  if (idx < 0) return;
  const chest = content.chests.get(chestId)!;
  s.chests.splice(idx, 1);
  const drops = openChest(content, s, chestId, new Rng((Date.now() ^ (Math.random() * 1e9)) >>> 0));
  app.persist(true);
  audio.unlock();

  const best = drops.filter((d): d is Extract<ChestDrop, { kind: 'character' }> => d.kind === 'character').sort((a, b) => content.rarity(b.rarity).order - content.rarity(a.rarity).order)[0];
  const glow = best ? content.rarity(best.rarity).color : chest.color;

  const stage = h('div', { class: 'chest-stage' });
  const cv = h('canvas', { class: 'cs' }) as HTMLCanvasElement;
  const tap = h('div', { class: 'tap' }, 'Toque para abrir');
  const center = h('div', { style: 'position:relative;z-index:2;display:flex;flex-direction:column;align-items:center' });
  stage.append(cv, center, tap);
  app.root.append(stage);

  const P = new ParticleSystem();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  const fit = () => {
    W = stage.clientWidth;
    H = stage.clientHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
  };
  fit();
  let phase: 'idle' | 'shake' | 'open' | 'reveal' | 'summary' = 'idle';
  let taps = 0;
  let shake = 0;
  let open = 0;
  let t = 0;
  let raf = 0;
  let last = performance.now();
  let revealIdx = -1;

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    shake = Math.max(0, shake - dt * 3);
    if (phase === 'open' || phase === 'reveal' || phase === 'summary') open = Math.min(1, open + dt * 3);
    P.update(dt);
    const c = cv.getContext('2d')!;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    // raios
    c.save();
    c.translate(W / 2, H * 0.45);
    c.globalCompositeOperation = 'lighter';
    const rays = phase === 'idle' || phase === 'shake' ? 0.05 : 0.12;
    for (let i = 0; i < 14; i++) {
      const a = t * 0.3 + (i / 14) * Math.PI * 2;
      const g = c.createRadialGradient(0, 0, 0, 0, 0, Math.max(W, H));
      g.addColorStop(0, glow + 'aa');
      g.addColorStop(1, glow + '00');
      c.globalAlpha = rays * 4;
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, Math.max(W, H), a, a + 0.12);
      c.fill();
    }
    c.restore();
    c.globalAlpha = 1;
    if (phase !== 'summary' && phase !== 'reveal') {
      const size = Math.min(W * 0.7, 300);
      c.save();
      c.translate(W / 2 - size / 2, H * 0.45 - size * 0.55);
      const drop = phase === 'idle' ? Math.max(0, 1 - t * 2.5) : 0;
      c.translate(0, -drop * 300);
      drawChest(c, chest, size, size * 0.9, open, shake, t);
      c.restore();
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    P.draw(c, false);
    c.globalCompositeOperation = 'lighter';
    P.draw(c, true);
    c.globalCompositeOperation = 'source-over';
  };
  raf = requestAnimationFrame(loop);

  const burst = (color: string, n = 40) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 200 + Math.random() * 500;
      P.emit({ kind: Math.random() < 0.4 ? 'star' : Math.random() < 0.5 ? 'bone' : 'dot', x: W / 2, y: H * 0.45, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 100, size: 4 + Math.random() * 5, color: Math.random() < 0.5 ? color : '#ffffff', life: 1.2, drag: 1.4, vr: 6, gravity: 0 });
    }
    P.emit({ kind: 'ring', x: W / 2, y: H * 0.45, size: 10, size2: Math.max(W, H) * 0.6, arc: 12, color, life: 0.7, drag: 0 });
  };

  const showDrop = (i: number) => {
    revealIdx = i;
    center.innerHTML = '';
    const d = drops[i];
    tap.textContent = i < drops.length - 1 ? `Toque para o próximo (${i + 1}/${drops.length})` : 'Toque para ver tudo';
    if (d.kind === 'coins' || d.kind === 'gems') {
      center.append(h('div', { class: 'drop-card', style: `--rc:${d.kind === 'coins' ? '#ffc21a' : '#3df2ff'}` },
        h('div', { class: 'big-ico' }, svg(d.kind === 'coins' ? ICON.coin : ICON.gem)),
        h('div', { class: 'dn stroke' }, `+${fmt(d.amount)}`),
        h('div', { class: 'dsub' }, d.kind === 'coins' ? 'Moedas' : 'Diamantes')));
      audio.play('coin', 0.9);
      burst(d.kind === 'coins' ? '#ffc21a' : '#3df2ff', 20);
    } else {
      const def = content.characters.get(d.id)!;
      const r = content.rarity(d.rarity);
      center.append(h('div', { class: 'drop-card', style: `--rc:${r.color}` },
        h('div', { class: 'chip', style: `position:absolute;top:-14px;left:50%;transform:translateX(-50%);background:${d.duplicate ? '#3a2766' : r.color};color:${d.duplicate ? '#fff' : '#1a0d33'}` }, d.duplicate ? 'REPETIDO' : 'NOVO!'),
        h('img', { src: portraitOf(app, def, 'default', 300), alt: '' }),
        h('div', { class: 'dn stroke' }, def.name),
        h('div', { style: 'margin:4px 0' }, rarityTag(app, def.rarity)),
        h('div', { class: 'dsub' }, d.duplicate ? `Convertido em +${fmt(d.coins)} moedas` : `“${def.voiceLines.select[0]}”`)));
      const rare = r.order >= 3;
      audio.play(rare ? 'legendary' : 'reward', 1);
      burst(r.color, rare ? 90 : 40);
      if (rare && 'vibrate' in navigator && s.settings.haptics) navigator.vibrate?.([40, 60, 80]);
    }
  };

  const summary = () => {
    phase = 'summary';
    center.innerHTML = '';
    tap.textContent = '';
    const chips = h('div', { class: 'drop-summary' });
    for (const d of drops) {
      if (d.kind === 'coins') chips.append(h('span', { class: 'pill' }, svg(ICON.coin), h('span', { style: 'padding-right:8px' }, `+${fmt(d.amount)}`)));
      else if (d.kind === 'gems') chips.append(h('span', { class: 'pill' }, svg(ICON.gem), h('span', { style: 'padding-right:8px' }, `+${fmt(d.amount)}`)));
      else {
        const def = content.characters.get(d.id)!;
        chips.append(h('span', { class: 'pill', style: `border-color:${content.rarity(d.rarity).color}` }, h('img', { src: portraitOf(app, def, 'default', 64), style: 'width:28px;height:28px' }), h('span', { style: 'padding-right:8px' }, d.duplicate ? `${def.name} (+${d.coins})` : `${def.name} · NOVO`)));
      }
    }
    center.append(h('h2', { class: 'stroke', style: 'font-size:34px' }, chest.name), chips,
      h('button', { class: 'btn pink', style: 'margin-top:18px', onclick: (e: Event) => { e.stopPropagation(); close(); } }, 'Continuar'));
  };

  const close = () => {
    cancelAnimationFrame(raf);
    stage.remove();
    app.changed();
    onDone();
  };

  stage.addEventListener('pointerdown', () => {
    if (phase === 'idle' || phase === 'shake') {
      phase = 'shake';
      taps++;
      shake = 1;
      audio.play('chest_shake', 1);
      burst(chest.color, 8);
      if (taps >= 2) {
        phase = 'open';
        audio.play('chest_open', 1);
        burst(glow, 70);
        setTimeout(() => {
          phase = 'reveal';
          showDrop(0);
        }, 650);
      }
    } else if (phase === 'reveal') {
      if (revealIdx < drops.length - 1) showDrop(revealIdx + 1);
      else summary();
    }
  });
}
