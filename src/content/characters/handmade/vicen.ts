import { skill, look, proj } from '../../abilities';
import type { SummonDef } from '../../types';
import { defineCharacter } from '../define';

/**
 * VICEN₹ — raridade CREATORs. O personagem mais forte do jogo.
 * ID interno ASCII estável: "vicen_creator". 1% de chance no Baú do Vazio
 * (com garantia de 100 aberturas) ou via evento "Semana dos Criadores".
 */
const glyphTotem: SummonDef = {
  id: 'vicen_glyph',
  name: 'Código-Fonte',
  hp: 2600,
  duration: 9,
  speed: 0,
  radius: 22,
  attack: { projectile: proj({ damage: 420, speed: 1100, range: 620, radius: 12, homing: 4, look: look('glyph', '#ff3df2', { trail: 'void', spin: true }) }), interval: 0.45, range: 620 },
  look: { kind: 'totem', color: '#ff3df2', color2: '#3df2ff' },
};

export default defineCharacter({
  id: 'vicen_creator',
  name: 'Vicen₹',
  rarity: 'creators',
  role: 'controle',
  title: 'O Autor da Arena',
  quote: 'Essa arena roda no MEU código. Cuidado com o que você deseja.',
  bio: {
    origem: 'Fora do mapa — a linha zero do código de Necrópolis',
    idade: 'Desconhecida (o relógio dele conta em versões)',
    historia: [
      'Antes da Skull Arena existir, existia um terminal piscando num quarto sem janela, e um moleque de moletom preto que não dormia. Vicen₹ escreveu a primeira linha da arena numa madrugada de chuva: uma caveira em pixel que ria toda vez que alguém caía. A risada travou. O código rodou. E a cidade inteira passou a existir em volta daquela tela.',
      'Hoje ele anda entre os lutadores como se fosse só mais um — mas as paredes se reorganizam quando ele passa e as moedas no chão viram do lado da coroa. Os outros CREATORs dizem que ele entrou na própria criação pra testar se ela era justa. Ele diz que entrou porque ficou entediado. Ninguém sabe qual das duas é verdade, e o símbolo ₹ bordado em ouro no moletom é a única assinatura que ele deixa.',
      'Enfrentar Vicen₹ é enfrentar alguém que leu o roteiro antes de você: ele reescreve onde estava, apaga os próprios erros com um Ctrl+Z e encerra partidas com um feixe que ele chama, rindo, de "GAME OVER".',
    ],
    sonho: 'Ver alguém derrotá-lo de forma limpa — e então escrever um chefe ainda maior.',
    medo: 'Um bug que ele não consegue reproduzir.',
    rival: 'A própria caveira de pixel da tela de abertura',
    curiosidade: 'A risada quebrada da abertura do jogo é a voz dele, gravada numa madrugada às 3h33.',
  },
  stats: { hp: 4900, speed: 275, ammo: 3, reload: 1.15 },
  attack: {
    id: 'vicen_attack',
    name: 'Moeda Maldita',
    desc: 'Três moedas do vazio que ricocheteiam nas paredes e curvam atrás do inimigo.',
    icon: '🪙',
    aim: 'direction',
    range: 660,
    indicator: 'cone',
    indicatorSize: 18,
    pose: 'cast',
    sfx: 'coin_shot',
    cooldown: 0.38,
    effects: [{ kind: 'projectile', count: 3, spread: 16, proj: proj({ damage: 470, speed: 1350, range: 660, radius: 12, bounces: 2, homing: 1.6, look: look('coin', '#ffd23f', { color2: '#ff3df2', spin: true, trail: 'void' }) }) }],
  },
  skills: [
    { ...skill.blink({ name: 'Reescrever', dist: 360, cd: 6, dmg: 950 }), desc: 'Reescreve a própria posição: teleporta e detona o lugar onde aparece.' },
    { ...skill.turret({ name: 'Código-Fonte', dmg: 420, cd: 12 }), effects: [{ kind: 'summon', at: 'target', unit: glyphTotem }], desc: 'Planta um glifo que dispara código teleguiado por 9s.' },
    { ...skill.rewind({ name: 'Ctrl+Z', secs: 3, heal: 1500, cd: 14 }), desc: 'Desfaz os últimos 3 segundos: volta de posição, recupera a vida e ainda cura 1500.' },
  ],
  super: {
    id: 'vicen_super',
    name: 'GAME OVER',
    desc: 'Feixe prismático de 3s que derrete tudo, deixa lento e silencia quem tocar.',
    icon: '☠️',
    aim: 'direction',
    range: 880,
    indicator: 'line',
    indicatorSize: 54,
    pose: 'cast',
    sfx: 'super_laser',
    effects: [
      { kind: 'beam', length: 880, width: 54, duration: 3, dps: 2700, color: '#ff3df2', status: { kind: 'silence', duration: 1.2 } },
      { kind: 'buff', stat: 'armor', mult: 1.35, duration: 3 },
    ],
  },
  passive: { name: 'Direitos de Autor', desc: 'Regenera 130/s, recebe 10% menos dano, cura 1200 ao eliminar e carrega o super 15% mais rápido.', regen: 130, armor: 0.1, killHeal: 1200, superChargeMult: 1.15 },
  look: {
    species: 'human',
    skin: '#e8c4a8',
    body: 'slim',
    hair: { style: 'messy', color: '#f2efff', color2: '#ff3df2' },
    eyes: { style: 'glow', color: '#ff3df2' },
    brows: 'angry',
    mouth: 'smirk',
    face: { tattoo: '₹', piercings: 2 },
    top: { style: 'hoodie', color: '#0f0b18', color2: '#ffd23f', print: 'text', text: '₹' },
    pants: { style: 'cargo', color: '#181226', color2: '#ffd23f' },
    shoes: { style: 'chunky', color: '#121018', sole: '#ffd23f', accent: '#ff3df2' },
    acc: { chain: '#ffd23f', hat: 'crown', hatColor: '#ffd23f', mask: 'skull', wings: 'void' },
    weapon: { kind: 'orb', color: '#ff3df2', color2: '#3df2ff' },
    aura: { kind: 'prism', color: '#ff3df2', color2: '#3df2ff' },
  },
  anim: { idle: 'float', run: 'glide', attack: 'cast', victory: 'laugh', tempo: 1.05 },
  voice: 'skull',
  unlock: { kind: 'chest' },
  tags: ['creators', 'assinatura'],
});
