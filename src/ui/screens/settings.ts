import { audio } from '../../audio/audio';
import { inputProfile } from '../../input/profile';
import { canInstall, promptInstall } from '../../pwa';
import { migrate, newSave } from '../../systems/save';
import type { App, Screen } from '../app';
import { menuBg, notice, topbar } from '../components';
import { h, ICON, svg } from '../dom';
import { logo } from './boot';

function toggle(on: boolean, set: (v: boolean) => void): HTMLElement {
  const b = h('button', { class: `toggle${on ? ' on' : ''}`, 'aria-pressed': String(on) });
  b.onclick = () => {
    on = !on;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    set(on);
  };
  return b;
}

function seg<T extends string>(opts: Array<[T, string]>, cur: T, set: (v: T) => void): HTMLElement {
  const wrap = h('div', { class: 'seg' });
  for (const [v, l] of opts) {
    wrap.append(h('button', { class: v === cur ? 'on' : '', onclick: (e: Event) => {
      for (const b of wrap.querySelectorAll('button')) b.classList.remove('on');
      (e.currentTarget as HTMLElement).classList.add('on');
      set(v);
    } }, l));
  }
  return wrap;
}

function slider(min: number, max: number, step: number, value: number, set: (v: number) => void): HTMLInputElement {
  return h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value), oninput: (e: Event) => set(Number((e.target as HTMLInputElement).value)) }) as HTMLInputElement;
}

export function settingsScreen(app: App): Screen {
  const s = app.save;
  const st = s.settings;
  const save = () => app.persist();
  const row = (label: string, hint: string | null, control: HTMLElement) => h('div', { class: 'setting' }, h('label', null, label, hint ? h('small', null, hint) : null), control);

  // Pré-visualização da dead zone do joystick
  const dzPreview = h('canvas', { width: '120', height: '120', style: 'width:60px;height:60px;flex:none' }) as HTMLCanvasElement;
  const drawDz = () => {
    const c = dzPreview.getContext('2d')!;
    c.clearRect(0, 0, 120, 120);
    c.strokeStyle = '#c9a0ff';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(60, 60, 54, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = 'rgba(255,77,109,0.45)';
    c.beginPath();
    c.arc(60, 60, 54 * st.joystick.deadZone, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(61,242,255,0.35)';
    c.beginPath();
    c.arc(60, 60, 54 * 0.75, 0, Math.PI * 2);
    c.arc(60, 60, 54 * st.joystick.deadZone, 0, Math.PI * 2, true);
    c.fill();
  };
  drawDz();

  const install = canInstall()
    ? h('button', { class: 'btn green block', onclick: () => void promptInstall() }, 'Instalar na tela inicial')
    : h('div', { class: 'small muted', style: 'font-weight:700' }, 'Para instalar: no Chrome/Android use “Adicionar à tela inicial”; no iPhone, Compartilhar → “Adicionar à Tela de Início”.');

  const body = h('div', { class: 'scroll' },
    h('div', { class: 'section-title' }, 'Áudio'),
    row('Música', null, slider(0, 1, 0.05, st.musicVolume, (v) => { st.musicVolume = v; audio.musicVolume = v; audio.applyVolumes(); save(); })),
    row('Efeitos', null, slider(0, 1, 0.05, st.sfxVolume, (v) => { st.sfxVolume = v; audio.sfxVolume = v; audio.applyVolumes(); audio.play('click'); save(); })),
    row('Silenciar tudo', null, toggle(st.muted, (v) => { st.muted = v; audio.muted = v; audio.applyVolumes(); save(); })),

    h('div', { class: 'section-title' }, 'Controles'),
    row('Perfil de controle', 'Auto troca sozinho entre toque e teclado/mouse', seg([['auto', 'Auto'], ['touch', 'Toque'], ['desktop', 'PC']], st.input, (v) => { st.input = v; inputProfile.setPreference(v); save(); })),
    h('div', { class: 'setting' }, h('label', null, 'Zona morta do joystick', h('small', null, 'vermelho = ignorado · azul = acelera até o máximo')), dzPreview,
      slider(0.05, 0.4, 0.01, st.joystick.deadZone, (v) => { st.joystick.deadZone = v; drawDz(); save(); })),
    row('Tamanho do joystick', null, slider(44, 90, 1, st.joystick.radius, (v) => { st.joystick.radius = v; save(); })),
    row('Suavização', 'menos = mais cru e instantâneo', slider(0, 1, 0.05, st.joystick.smoothing, (v) => { st.joystick.smoothing = v; save(); })),
    row('Joystick flutuante', 'nasce onde você encosta o dedo', toggle(st.joystick.floating, (v) => { st.joystick.floating = v; save(); })),
    row('Mostrar cone de ataque', 'mostra quando o ataque vai disparar', toggle(st.aimCone, (v) => { st.aimCone = v; save(); })),
    row('PC: mira', '“Clássico” = mira segue o movimento, igual ao celular', seg([['mouse', 'Mouse'], ['move', 'Clássico']], st.aimMode, (v) => { st.aimMode = v; save(); })),
    row('PC: tiro automático', 'ataca sozinho quando o alvo entra na mira', toggle(st.autoFire, (v) => { st.autoFire = v; save(); })),
    row('Vibração', null, toggle(st.haptics, (v) => { st.haptics = v; save(); if (v) navigator.vibrate?.(30); })),

    h('div', { class: 'section-title' }, 'Jogo'),
    row('Dificuldade dos bots', 'Auto acompanha seus troféus', seg([['auto', 'Auto'], ['facil', 'Fácil'], ['normal', 'Normal'], ['dificil', 'Difícil']], st.botDifficulty, (v) => { st.botDifficulty = v; save(); })),
    row('Qualidade gráfica', 'Baixa = mais FPS em celular fraco', seg([['alta', 'Alta'], ['media', 'Média'], ['baixa', 'Baixa']], st.quality, (v) => { st.quality = v; save(); })),
    row('Tremor de tela', null, slider(0, 1.5, 0.1, st.screenShake, (v) => { st.screenShake = v; save(); })),
    row('Mostrar FPS / desempenho', null, toggle(st.showFps, (v) => { st.showFps = v; save(); })),

    h('div', { class: 'section-title' }, 'App'),
    h('div', { class: 'setting', style: 'display:block' }, install),
    h('div', { class: 'section-title' }, 'Progresso'),
    notice('Seu progresso é salvo neste aparelho (conta local). Exporte um backup para não perder ao trocar de celular.', 'info'),
    h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px' },
      h('button', { class: 'btn dark', onclick: () => {
        const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
        const a = h('a', { href: URL.createObjectURL(blob), download: `skull-arena-save-${new Date().toISOString().slice(0, 10)}.json` });
        a.click();
        app.toast('Backup exportado!', 'good');
      } }, 'Exportar'),
      h('button', { class: 'btn dark', onclick: () => {
        const input = h('input', { type: 'file', accept: 'application/json' }) as HTMLInputElement;
        input.onchange = async () => {
          const f = input.files?.[0];
          if (!f) return;
          try {
            const data = migrate(JSON.parse(await f.text()), app.content);
            if (!data) throw new Error('inválido');
            app.save = data;
            app.persist(true);
            app.toast('Backup importado!', 'good');
            void app.go('menu');
          } catch {
            app.toast('Arquivo de backup inválido', 'bad');
          }
        };
        input.click();
      } }, 'Importar'),
    ),
    h('button', { class: 'btn red block', style: 'margin-top:10px', onclick: async () => {
      if (!(await app.confirm('Apagar progresso?', 'Isso apaga TUDO deste aparelho: personagens, moedas, diamantes e troféus. Não dá para desfazer.', 'Apagar', true))) return;
      app.store.wipe();
      app.save = newSave(app.content, s.player.name);
      app.store.wipe();
      void app.go('login');
    } }, 'Apagar progresso'),
    h('button', { class: 'btn pink block', style: 'margin-top:16px', onclick: () => { app.click(); void app.go('credits'); } }, 'Créditos'),
    h('div', { class: 'small muted', style: 'text-align:center;margin-top:12px;font-weight:700' }, `SKULL ARENA v${__APP_VERSION__} · ${app.store.persistent ? 'salvamento local ativo' : 'armazenamento indisponível: progresso só nesta sessão'}`),
  );
  const el = h('div', { class: 'screen' }, menuBg(), topbar(app, { back: 'menu', title: 'Configurações' }), body);
  return { el, back: 'menu' };
}

export function creditsScreen(app: App): Screen {
  const el = h('div', { class: 'screen' }, menuBg(), topbar(app, { back: 'settings', title: 'Créditos' }),
    h('div', { class: 'scroll', style: 'display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;padding-top:6px' },
      h('div', { style: 'transform:scale(.8);margin:-16px 0 -18px' }, logo()),
      h('div', { class: 'panel', style: 'padding:18px;width:min(420px,100%)' },
        h('div', { class: 'display muted', style: 'font-size:13px;letter-spacing:3px' }, 'UM JOGO DE'),
        h('div', { class: 'display stroke', style: 'font-size:34px;color:var(--pink)' }, 'KLIPZA STUDIO'),
        h('div', { style: 'height:12px' }),
        h('div', { class: 'display muted', style: 'font-size:13px;letter-spacing:3px' }, 'CRIADOR'),
        h('div', { class: 'display stroke', style: 'font-size:30px' }, 'jeanvicen'),
        h('a', { href: 'https://instagram.com/0neajx', target: '_blank', rel: 'noopener', class: 'btn pink', style: 'margin-top:10px;text-decoration:none' }, '📸 Instagram @0neajx'),
      ),
      h('div', { class: 'panel', style: 'padding:14px;width:min(420px,100%);font-size:13px;font-weight:700;color:var(--ink2);line-height:1.6' },
        h('div', { class: 'display', style: 'color:var(--ink);font-size:16px;margin-bottom:4px' }, 'Feito com'),
        'TypeScript · Vite · Canvas 2D · Web Audio',
        h('br'), 'Personagens, arenas, efeitos, sons e música gerados proceduralmente — slots prontos para arte final.',
        h('br'), 'Fontes: Lilita One e Nunito (SIL Open Font License).',
        h('br'), 'Inspiração de game feel: brawlers de arena mobile. Nenhum asset de terceiros copiado.'),
      h('div', { style: 'width:46px;height:46px' }, svg(ICON.skull)),
      h('div', { class: 'small muted', style: 'font-weight:800' }, 'Obrigado por jogar. A caveira encara, não foge. 💀'),
      h('a', { href: '/privacidade.html', target: '_blank', rel: 'noopener', class: 'small', style: 'color:var(--ink3);font-weight:800' }, 'Política de privacidade'),
    ));
  return { el, back: 'settings' };
}
