import { audio } from '../../audio/audio';
import { allCharacters, getCharacter } from '../../content/characters';
import { randomLook } from '../../content/generator/characters';
import { ROLES } from '../../content/rarities';
import type { CharacterDef, RoleId } from '../../content/types';
import { buildSheet, FRAME_H, FRAME_W, ORIGIN_X, ORIGIN_Y, SHEET_ROWS } from '../../pixel/sprite';
import type { App, Screen } from '../app';
import { btn, fill, h, toast } from '../dom';
import { CharView } from '../pixelView';

/**
 * ESTÚDIO — ferramentas pra CRIAR personagens:
 *  • ver qualquer personagem em todas as animações
 *  • 🎲 visual aleatório + "copiar código" pra colar no seu personagem novo
 *  • exportar a FOLHA DE SPRITE (PNG) pra redesenhar no Piskel/Aseprite
 *  • testar a SUA folha (PNG) aqui antes de colocar no jogo
 */
export function studioScreen(app: App): Screen {
  const chars = allCharacters();
  let def: CharacterDef = getCharacter('kaze');
  let seed = 1;
  let role: RoleId = 'atacante';
  const stage = h('div.studio-stage');
  const code = h('pre.studio-code');
  let view: CharView;

  const show = (d: CharacterDef) => {
    def = d;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const scale = Math.max(2, Math.floor((Math.min(window.innerHeight * 0.5, 380) * dpr) / FRAME_H));
    view = new CharView(d, scale, { showOff: false });
    view.el.style.width = `${view.el.width / dpr}px`;
    fill(stage, h('div.stage-glow'), view.el);
  };

  const sel = h<'select'>('select.inp', null, ...chars.map((c) => h('option', { value: c.id }, `${c.name} (${c.rarity})`)));
  sel.value = def.id;
  sel.addEventListener('change', () => {
    show(getCharacter(sel.value));
    fill(code);
  });
  const roleSel = h<'select'>('select.inp', null, ...Object.values(ROLES).map((r) => h('option', { value: r.id }, `${r.icon} ${r.name}`)));
  roleSel.addEventListener('change', () => (role = roleSel.value as RoleId));

  const anim = (label: string, fn: () => void) => btn(label, 'chip', fn);
  const anims = h(
    'div.anim-row',
    null,
    anim('Parado', () => view.setState('idle')),
    anim('Correndo', () => view.setState('run')),
    anim('Ataque', () => view.play('attack')),
    anim('Habilidade', () => view.play('cast')),
    anim('Dano', () => view.play('hit')),
    anim('Vitória', () => view.setState('victory')),
    anim('Derrota', () => view.setState('defeat')),
    anim('Arrancada', () => view.setState('dash')),
    anim('Costas', () => view.sprite.anim.lookAt(0.1, -1, false)),
    anim('Frente', () => view.sprite.anim.lookAt(1, 0.2, false)),
  );

  const download = (canvas: HTMLCanvasElement | OffscreenCanvas, name: string) => {
    const go = (blob: Blob | null) => {
      if (!blob) return toast('Não deu pra gerar o PNG.', 'err');
      const a = h<'a'>('a', { href: URL.createObjectURL(blob), download: name });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    if (canvas instanceof HTMLCanvasElement) canvas.toBlob(go, 'image/png');
    else void canvas.convertToBlob({ type: 'image/png' }).then(go);
  };

  const exportSheet = () => {
    audio.play('ui_buy');
    download(buildSheet(def), `${def.id}.png`);
    toast(`Folha de ${def.name} exportada!`, 'ok');
  };

  const exportGuide = () => {
    // modelo vazio com a grade e o ponto dos pés
    const cols = Math.max(...SHEET_ROWS.map((r) => r.frames));
    const c = document.createElement('canvas');
    c.width = cols * FRAME_W;
    c.height = SHEET_ROWS.length * FRAME_H;
    const g = c.getContext('2d')!;
    SHEET_ROWS.forEach((row, ri) => {
      for (let f = 0; f < cols; f++) {
        g.fillStyle = f < row.frames ? ((f + ri) % 2 ? 'rgba(255,61,242,0.08)' : 'rgba(61,242,255,0.08)') : 'rgba(0,0,0,0.25)';
        g.fillRect(f * FRAME_W, ri * FRAME_H, FRAME_W, FRAME_H);
        g.fillStyle = '#ff3df2';
        g.fillRect(f * FRAME_W + ORIGIN_X - 2, ri * FRAME_H + ORIGIN_Y, 5, 1);
        g.fillRect(f * FRAME_W + ORIGIN_X, ri * FRAME_H + ORIGIN_Y - 2, 1, 5);
      }
    });
    download(c, 'modelo-folha-skull-arena.png');
  };

  const testPng = () => {
    const f = h<'input'>('input', { type: 'file', accept: 'image/png' });
    f.addEventListener('change', () => {
      const file = f.files?.[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = () => {
        show({ ...def, sheet: String(r.result) });
        toast('Sua folha carregou! Teste as animações.', 'ok');
      };
      r.readAsDataURL(file);
    });
    f.click();
  };

  const randomize = () => {
    seed = (Math.random() * 1e9) | 0;
    const { look, anim: an } = randomLook(seed, role, def.rarity);
    show({ ...def, id: `studio_${seed}`, look, anim: an, sheet: undefined });
    fill(code, `// cole isto no seu personagem (src/content/characters/handmade/SEU.ts)\nlook: ${JSON.stringify(look, null, 2)},\nanim: ${JSON.stringify(an)},`);
  };

  const copy = async () => {
    if (!code.textContent) return toast('Gere um visual aleatório primeiro.', 'info');
    try {
      await navigator.clipboard.writeText(code.textContent);
      toast('Código copiado!', 'ok');
    } catch {
      toast('Não deu pra copiar — selecione o texto e copie.', 'err');
    }
  };

  show(def);
  const body = h(
    'div.studio',
    null,
    h('div.studio-left', null, stage, anims),
    h(
      'div.studio-right',
      null,
      h('section.pixel-panel', null, h('h3', null, 'VER PERSONAGEM'), sel),
      h(
        'section.pixel-panel',
        null,
        h('h3', null, '🎲 CRIAR VISUAL'),
        h('p.muted.small', null, 'Gera uma roupa/cabelo/arma aleatória no estilo do jogo. Gostou? Copie o código e cole no arquivo do seu personagem.'),
        h(
          'div.row.wrap',
          null,
          roleSel,
          btn('🎲 VISUAL ALEATÓRIO', 'btn-yellow small', randomize),
          btn('📋 COPIAR CÓDIGO', 'btn-dark small', () => void copy()),
        ),
        code,
      ),
      h(
        'section.pixel-panel',
        null,
        h('h3', null, '🖼️ SPRITE (PNG)'),
        h(
          'p.muted.small',
          null,
          `Folha: quadros ${FRAME_W}×${FRAME_H}, pés no ponto (${ORIGIN_X}, ${ORIGIN_Y}). Uma animação por linha: ${SHEET_ROWS.map((r) => `${r.name} (${r.frames})`).join(' · ')}.`,
        ),
        h('div.row.wrap', null, btn('EXPORTAR FOLHA DESTE', 'btn-dark small', exportSheet), btn('MODELO VAZIO', 'btn-dark small', exportGuide), btn('TESTAR MEU PNG', 'btn-yellow small', testPng)),
      ),
      h(
        'section.pixel-panel',
        null,
        h('h3', null, '📘 COMO CRIAR UM PERSONAGEM'),
        h(
          'ol.howto',
          null,
          h('li', null, 'No terminal: ', h('code', null, 'npm run novo:personagem -- "Nome" raro atacante')),
          h('li', null, 'Abra o arquivo criado em ', h('code', null, 'src/content/characters/handmade/'), ' e mude história, atributos e habilidades.'),
          h(
            'li',
            null,
            'Visual: use o 🎲 acima e cole o código, OU desenhe sua folha e coloque em ',
            h('code', null, 'public/sprites/ID.png'),
            ' com ',
            h('code', null, "sheet: 'sprites/ID.png'"),
            '.',
          ),
          h('li', null, 'Rode ', h('code', null, 'npm run validar'), ' pra conferir se está tudo certo.'),
        ),
      ),
    ),
  );
  return app.page('ESTÚDIO', body, { cls: 'page-studio' });
}
