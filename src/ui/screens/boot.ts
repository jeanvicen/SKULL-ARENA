import { audio } from '../../audio/audio';
import { newSave } from '../../systems/save';
import { refreshQuests } from '../../systems/economy';
import type { App, Screen } from '../app';
import { charCard, menuBg, notice, portraitOf } from '../components';
import { h } from '../dom';

export const LOGO_SVG = `<svg viewBox="0 0 120 120" class="lskull">
  <defs>
    <radialGradient id="lg-b" cx="40%" cy="30%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f3ead8"/><stop offset="1" stop-color="#b8a98c"/></radialGradient>
    <filter id="lg-g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
  </defs>
  <g stroke="#2a1450" stroke-width="5" stroke-linecap="round">
    <path d="M18 100 102 30M18 30l84 70" stroke="#f3ead8" stroke-width="10"/>
    <path d="M18 100 102 30M18 30l84 70" stroke="#2a1450" stroke-width="3" opacity=".25"/>
  </g>
  <circle cx="14" cy="27" r="7" fill="#f3ead8" stroke="#2a1450" stroke-width="3"/><circle cx="106" cy="27" r="7" fill="#f3ead8" stroke="#2a1450" stroke-width="3"/>
  <circle cx="14" cy="103" r="7" fill="#f3ead8" stroke="#2a1450" stroke-width="3"/><circle cx="106" cy="103" r="7" fill="#f3ead8" stroke="#2a1450" stroke-width="3"/>
  <path d="M60 14C36 14 22 31 22 52c0 13 6 22 14 27v13h48V79c8-5 14-14 14-27 0-21-14-38-38-38z" fill="url(#lg-b)" stroke="#2a1450" stroke-width="4"/>
  <path d="M38 92v-7M48 92v-7M60 92v-7M72 92v-7M82 92v-7" stroke="#2a1450" stroke-width="3"/>
  <ellipse cx="45" cy="55" rx="11" ry="12" fill="#1a0f24"/><ellipse cx="75" cy="55" rx="11" ry="12" fill="#1a0f24"/>
  <circle cx="45" cy="56" r="5" fill="#ff2d95" filter="url(#lg-g)"/><circle cx="75" cy="56" r="5" fill="#ff2d95" filter="url(#lg-g)"/>
  <circle cx="45" cy="56" r="3.5" fill="#ff7ac0"/><circle cx="75" cy="56" r="3.5" fill="#ff7ac0"/>
  <path d="M60 66l-5 9h10z" fill="#1a0f24"/>
  <path d="M38 34q8-10 20-11" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".8"/>
</svg>`;

export function logo(): HTMLElement {
  const el = h('div', { class: 'logo' });
  el.innerHTML = `${LOGO_SVG}<div class="l1">SKULL</div><div class="l2">ARENA</div>`;
  return el;
}

export function loadingScreen(app: App): Screen {
  const fill = h('i', { style: 'width:0%' });
  const status = h('div', { class: 'muted small', style: 'margin-top:8px;font-weight:800;text-align:center' }, 'Acordando as caveiras…');
  const el = h('div', { class: 'screen loading-screen', style: 'justify-content:center;align-items:center' },
    menuBg(),
    h('div', { class: 'studio display', style: 'letter-spacing:4px;color:var(--ink3);margin-bottom:14px;font-size:13px' }, 'KLIPZA STUDIO APRESENTA'),
    logo(),
    h('div', { class: 'loading-bar' }, h('div', { class: 'bar violet' }, fill), status),
  );
  const steps: Array<[string, () => void]> = [
    ['Carregando fontes…', () => undefined],
    ['Desenhando caveiras…', () => {
      for (const id of app.content.progression.starterCharacters) {
        const def = app.content.characters.get(id);
        if (def) portraitOf(app, def);
      }
    }],
    ['Montando arenas…', () => undefined],
    ['Afiando foices…', () => undefined],
  ];
  const t0 = performance.now();
  void (async () => {
    try {
      await Promise.race([document.fonts?.load('30px "Lilita One"'), new Promise((r) => setTimeout(r, 1500))]);
    } catch {
      /* fonte opcional */
    }
    for (let i = 0; i < steps.length; i++) {
      status.textContent = steps[i][0];
      steps[i][1]();
      fill.style.width = `${((i + 1) / steps.length) * 100}%`;
      await new Promise((r) => setTimeout(r, 140));
    }
    const wait = Math.max(0, 1100 - (performance.now() - t0));
    await new Promise((r) => setTimeout(r, wait));
    const existing = app.store.load(app.content);
    if (existing) {
      app.save = existing;
      refreshQuests(app.content, app.save);
      audio.sfxVolume = app.save.settings.sfxVolume;
      audio.musicVolume = app.save.settings.musicVolume;
      audio.muted = app.save.settings.muted;
      void app.go('menu', {}, 'iris');
    } else {
      void app.go('login', {}, 'iris');
    }
  })();
  return { el };
}

export function loginScreen(app: App): Screen {
  const starters = app.content.progression.starterCharacters.map((id) => app.content.characters.get(id)!).filter(Boolean);
  let fav = starters[0]?.id;
  const input = h('input', { class: 'text-in', maxlength: '16', placeholder: 'Seu nome de caveira', autocomplete: 'off', enterkeyhint: 'go' }) as HTMLInputElement;
  const pick = h('div', { class: 'fav-pick' });
  const renderPick = () => {
    pick.innerHTML = '';
    for (const c of starters) pick.append(charCard(app, c, { selected: c.id === fav, onClick: () => { fav = c.id; renderPick(); } }));
  };
  renderPick();
  const enter = () => {
    audio.unlock();
    const name = input.value.trim() || `Caveira${Math.floor(Math.random() * 900 + 100)}`;
    app.save = newSave(app.content, name);
    if (fav) app.save.selectedCharacter = fav;
    refreshQuests(app.content, app.save);
    app.persist(true);
    audio.play('reward', 0.8);
    void app.go('menu', {}, 'iris');
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') enter();
  });
  const el = h('div', { class: 'screen login-screen', style: 'justify-content:center;align-items:center;padding:16px;overflow-y:auto' },
    menuBg(),
    h('div', { style: 'transform:scale(0.72);margin:-30px 0 -24px' }, logo()),
    h('div', { class: 'panel login-card' },
      h('h2', { class: 'stroke', style: 'text-align:center;font-size:24px' }, 'Bem-vindo à Cripta'),
      input,
      h('div', { class: 'display', style: 'font-size:14px;color:var(--ink2)' }, 'Escolha sua primeira caveira:'),
      pick,
      h('button', { class: 'btn pink big block', onclick: enter }, 'ENTRAR'),
      h('button', { class: 'btn dark block disabled', disabled: true, title: 'Requer servidor (Fase 5)' }, 'Conta online · em breve'),
      notice('Conta local: seu progresso fica salvo NESTE aparelho. Login online, amigos e ranked chegam com o servidor (Fase 5).', 'info'),
    ),
  );
  setTimeout(() => input.focus(), 400);
  return { el };
}
