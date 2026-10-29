import { atk, skill, sup, st } from '../../abilities';
import { defineCharacter } from '../define';

/** Chefão do evento "Caveira Gigante" (não aparece na coleção). */
export default defineCharacter({
  id: 'boss_caveira',
  name: 'Caveira Gigante',
  rarity: 'god',
  role: 'tanque',
  title: 'A Risada que Ganhou Corpo',
  quote: 'HA... HA... HA-HA-HA!',
  bio: {
    origem: 'A tela de abertura',
    idade: 'Do tamanho do medo de vocês',
    historia: ['A caveira de pixel da abertura cansou de só rir. Agora ela quer jogar.'],
    sonho: 'Rir por último.',
    medo: 'Time unido.',
    curiosidade: 'Cada vez que é derrotada, a risada da abertura fica um pouco mais travada.',
  },
  stats: { hp: 3000, speed: 190, ammo: 4, reload: 1.1 },
  attack: atk.shotgun({ name: 'Dentada', dmg: 380, n: 7, spread: 70, range: 380, color: '#ff3df2', shape: 'skull' }),
  skills: [skill.nova({ name: 'Risada Sísmica', dmg: 900, radius: 260, cd: 6, status: st.slow(1, 0.4) }), skill.minions({ name: 'Ossinhos', n: 3, dmg: 260, cd: 9 })],
  super: sup.nuke({ name: 'GAME OVER', dmg: 2400, radius: 260 }),
  look: {
    species: 'skeleton',
    skin: '#efe6d2',
    body: 'heavy',
    hair: { style: 'none', color: '#000' },
    eyes: { style: 'glow', color: '#ff3df2' },
    top: { style: 'hoodie', color: '#120c1c', color2: '#ff3df2', print: 'skull', hood: 'up' },
    pants: { style: 'baggy', color: '#120c1c' },
    shoes: { style: 'chunky', color: '#ff3df2', sole: '#120c1c' },
    acc: { hat: 'crown', hatColor: '#ff3df2' },
    weapon: { kind: 'gloves', color: '#ff3df2', color2: '#120c1c' },
    aura: { kind: 'glitch', color: '#ff3df2', color2: '#3df2ff' },
    scale: 2.1,
  },
  anim: { idle: 'heavy', run: 'stomp', attack: 'punch', victory: 'laugh' },
  voice: 'skull',
  unlock: { kind: 'event', eventId: 'caveira_gigante' },
  status: 'test',
});
