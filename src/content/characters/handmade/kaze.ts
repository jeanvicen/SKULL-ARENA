import { atk, skill, look, proj } from '../../abilities';
import { defineCharacter } from '../define';

/**
 * KAZE — Atacante inicial (grátis). Exemplo COMPLETO de personagem feito à mão:
 * copie este arquivo pra criar um novo (ou rode `npm run novo:personagem`).
 */
export default defineCharacter({
  id: 'kaze',
  name: 'Kaze',
  rarity: 'comum',
  role: 'atacante',
  title: 'O Fantasma do Beco 13',
  quote: 'Nem vi você chegar. Nem você vai me ver sair.',
  bio: {
    origem: 'Beco 13, Necrópolis Baixa',
    idade: '19 anos',
    historia: [
      'Kaze cresceu entre os varais e as escadas de incêndio do Beco 13, onde a luz dos letreiros nunca apaga e ninguém pergunta seu nome. Aprendeu cedo que quem anda rápido não leva conta pra pagar — e que o moletom preto grande demais é a melhor armadura que um moleque magrelo pode ter.',
      'Quando a Skull Arena abriu as portas pros vivos, Kaze entrou por um motivo só: recuperar a moto do irmão mais velho, apostada e perdida numa noite errada contra a Gangue da Ferrugem. Joga calado, nunca para de se mexer e fala pouco — mas cada rajada das pistolas gêmeas é uma frase completa.',
    ],
    sonho: 'Ganhar a moto de volta e atravessar a ponte de Necrópolis sem olhar pra trás.',
    medo: 'Ficar parado. Literalmente: se ficar parado demais, ele começa a pensar.',
    rival: 'Marreta',
    curiosidade: 'Nunca tira o capuz pra dormir e tem 14 moletons pretos idênticos.',
  },
  stats: { hp: 3300, speed: 265, ammo: 3, reload: 1.3 },
  attack: atk.burst({ name: 'Rajada Fantasma', dmg: 380, range: 600, n: 3, color: '#cfe8ff', sfx: 'pistol' }),
  skills: [skill.dash({ name: 'Passo Sombrio', dist: 300, cd: 5.5, invuln: true })],
  super: {
    id: 'kaze_super',
    name: 'Tempestade de Chumbo',
    desc: 'Descarrega as duas pistolas num leque enorme de 16 tiros.',
    icon: '🌪️',
    aim: 'direction',
    range: 640,
    indicator: 'cone',
    indicatorSize: 40,
    pose: 'shoot',
    sfx: 'super_barrage',
    effects: [{ kind: 'projectile', burst: 8, burstDelay: 0.05, count: 2, spread: 40, proj: proj({ damage: 420, speed: 1600, range: 640, radius: 10, knockback: 40, look: look('bullet', '#ffe08a', { trail: 'spark', size: 1.2 }) }) }],
  },
  passive: { name: 'Sangue Frio', desc: '+15% de dano quando está com menos de 40% de vida.', lowHpRage: 0.15 },
  look: {
    species: 'human',
    skin: '#f1d2bf',
    body: 'slim',
    hair: { style: 'messy', color: '#15121c' },
    eyes: { style: 'sleepy', color: '#5a4a6e' },
    brows: 'flat',
    mouth: 'neutral',
    top: { style: 'hoodie', color: '#1a1820', color2: '#d9d9e3', print: 'skull' },
    pants: { style: 'wide_jeans', color: '#3e6a8a' },
    shoes: { style: 'hightop', color: '#16141c', sole: '#f6f4ee', accent: '#16141c' },
    acc: { earbuds: true },
    weapon: { kind: 'dual_pistols', color: '#2b2d38', color2: '#7a7f8f' },
  },
  anim: { idle: 'chill', run: 'sprint', attack: 'dual', victory: 'point' },
  voice: 'male',
  unlock: { kind: 'starter' },
  tags: ['inicial'],
});
