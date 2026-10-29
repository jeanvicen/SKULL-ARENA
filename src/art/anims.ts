import type { AnimStyle } from '../content/types';
import type { BoneName, Clip } from './rig';

/**
 * BIBLIOTECA DE ANIMAÇÕES (quadros-chave editáveis à mão)
 * --------------------------------------------------------
 * Cada clipe = { duration, loop, keys: [{ t, osso: { r, x, y, sx, sy } }] }.
 * Lembrete da convenção: r POSITIVO = pra frente. Canela NEGATIVA dobra o joelho.
 * Osso não citado num quadro = posição de repouso.
 *
 * Pra criar uma animação nova: copie um clipe, mude os números e registre em CLIPS.
 * Pra um personagem usar: escolha no `anim` dele (ex.: idle: 'cocky') ou crie um
 * estilo novo aqui e adicione o nome no tipo AnimStyle (content/types.ts).
 */

const UPPER: BoneName[] = ['torso', 'head', 'uArmF', 'fArmF', 'handF', 'uArmB', 'fArmB', 'handB'];
const ARMS_F: BoneName[] = ['uArmF', 'fArmF', 'handF'];

// ---------------------------------------------------------------- IDLE
const idleChill: Clip = {
  duration: 2.6,
  loop: true,
  keys: [
    { t: 0, ease: 'inout', root: { y: 0 }, hips: { r: -2 }, torso: { r: -5, sy: 1 }, head: { r: 9 }, uArmF: { r: -4 }, fArmF: { r: 8 }, uArmB: { r: 6 }, fArmB: { r: 10 }, thighF: { r: 6 }, shinF: { r: -4 }, footF: { r: -2 }, thighB: { r: -8 }, shinB: { r: 3 } },
    { t: 1.3, ease: 'inout', root: { y: 0.6 }, hips: { r: -2 }, torso: { r: -4, sy: 1.025 }, head: { r: 5 }, uArmF: { r: -2 }, fArmF: { r: 10 }, uArmB: { r: 4 }, fArmB: { r: 12 }, thighF: { r: 6 }, shinF: { r: -4 }, footF: { r: -2 }, thighB: { r: -8 }, shinB: { r: 3 } },
    { t: 2.6, root: { y: 0 }, hips: { r: -2 }, torso: { r: -5, sy: 1 }, head: { r: 9 }, uArmF: { r: -4 }, fArmF: { r: 8 }, uArmB: { r: 6 }, fArmB: { r: 10 }, thighF: { r: 6 }, shinF: { r: -4 }, footF: { r: -2 }, thighB: { r: -8 }, shinB: { r: 3 } },
  ],
};

const idleBounce: Clip = {
  duration: 0.9,
  loop: true,
  keys: [
    { t: 0, ease: 'out', root: { y: 0, sy: 0.97, sx: 1.02 }, torso: { r: 4 }, head: { r: -4 }, uArmF: { r: 18 }, fArmF: { r: 40 }, uArmB: { r: -12 }, fArmB: { r: 50 }, thighF: { r: 10 }, shinF: { r: -12 }, thighB: { r: -6 }, shinB: { r: -6 } },
    { t: 0.45, ease: 'in', root: { y: -2.2, sy: 1.02, sx: 0.99 }, torso: { r: 2 }, head: { r: 0 }, uArmF: { r: 22 }, fArmF: { r: 46 }, uArmB: { r: -8 }, fArmB: { r: 56 }, thighF: { r: 8 }, shinF: { r: -8 }, thighB: { r: -4 }, shinB: { r: -3 } },
    { t: 0.9, root: { y: 0, sy: 0.97, sx: 1.02 }, torso: { r: 4 }, head: { r: -4 }, uArmF: { r: 18 }, fArmF: { r: 40 }, uArmB: { r: -12 }, fArmB: { r: 50 }, thighF: { r: 10 }, shinF: { r: -12 }, thighB: { r: -6 }, shinB: { r: -6 } },
  ],
};

const idleHype: Clip = {
  duration: 0.7,
  loop: true,
  keys: [
    { t: 0, ease: 'out', root: { y: 0, sy: 0.96 }, torso: { r: 8 }, head: { r: -8 }, uArmF: { r: 40 }, fArmF: { r: 70 }, uArmB: { r: 30 }, fArmB: { r: 80 }, thighF: { r: 18 }, shinF: { r: -22 }, thighB: { r: -10 }, shinB: { r: -16 } },
    { t: 0.35, ease: 'in', root: { y: -3, sy: 1.03 }, torso: { r: 4 }, head: { r: -2 }, uArmF: { r: 55 }, fArmF: { r: 60 }, uArmB: { r: 20 }, fArmB: { r: 90 }, thighF: { r: 14 }, shinF: { r: -14 }, thighB: { r: -8 }, shinB: { r: -10 } },
    { t: 0.7, root: { y: 0, sy: 0.96 }, torso: { r: 8 }, head: { r: -8 }, uArmF: { r: 40 }, fArmF: { r: 70 }, uArmB: { r: 30 }, fArmB: { r: 80 }, thighF: { r: 18 }, shinF: { r: -22 }, thighB: { r: -10 }, shinB: { r: -16 } },
  ],
};

const idleStoic: Clip = {
  duration: 3.2,
  loop: true,
  keys: [
    { t: 0, ease: 'inout', torso: { r: 0, sy: 1 }, head: { r: 0 }, uArmF: { r: 4 }, fArmF: { r: 6 }, uArmB: { r: -4 }, fArmB: { r: 6 }, thighF: { r: 4 }, thighB: { r: -4 } },
    { t: 1.6, ease: 'inout', torso: { r: 0, sy: 1.02 }, head: { r: 2 }, uArmF: { r: 5 }, fArmF: { r: 8 }, uArmB: { r: -3 }, fArmB: { r: 8 }, thighF: { r: 4 }, thighB: { r: -4 } },
    { t: 3.2, torso: { r: 0, sy: 1 }, head: { r: 0 }, uArmF: { r: 4 }, fArmF: { r: 6 }, uArmB: { r: -4 }, fArmB: { r: 6 }, thighF: { r: 4 }, thighB: { r: -4 } },
  ],
};

const idleNervous: Clip = {
  duration: 1.2,
  loop: true,
  keys: [
    { t: 0, ease: 'inout', root: { x: 0 }, torso: { r: 6 }, head: { r: 10 }, uArmF: { r: 30 }, fArmF: { r: 100 }, uArmB: { r: 26 }, fArmB: { r: 96 }, thighF: { r: 4 }, thighB: { r: -2 }, shinB: { r: -6 } },
    { t: 0.3, ease: 'inout', root: { x: 0.6 }, torso: { r: 7 }, head: { r: 6 } },
    { t: 0.6, ease: 'inout', root: { x: -0.4 }, torso: { r: 5 }, head: { r: 12 }, uArmF: { r: 32 }, fArmF: { r: 104 }, uArmB: { r: 24 }, fArmB: { r: 92 }, thighF: { r: 4 }, thighB: { r: -2 }, shinB: { r: -6 } },
    { t: 1.2, root: { x: 0 }, torso: { r: 6 }, head: { r: 10 }, uArmF: { r: 30 }, fArmF: { r: 100 }, uArmB: { r: 26 }, fArmB: { r: 96 }, thighF: { r: 4 }, thighB: { r: -2 }, shinB: { r: -6 } },
  ],
};

const idleFloat: Clip = {
  duration: 2.4,
  loop: true,
  keys: [
    { t: 0, ease: 'inout', root: { y: -4 }, torso: { r: 2 }, head: { r: 4 }, uArmF: { r: 24 }, fArmF: { r: 20 }, uArmB: { r: 18 }, fArmB: { r: 24 }, thighF: { r: 14 }, shinF: { r: -26 }, footF: { r: -20 }, thighB: { r: 4 }, shinB: { r: -30 }, footB: { r: -24 } },
    { t: 1.2, ease: 'inout', root: { y: -8 }, torso: { r: 0 }, head: { r: 0 }, uArmF: { r: 30 }, fArmF: { r: 26 }, uArmB: { r: 22 }, fArmB: { r: 30 }, thighF: { r: 10 }, shinF: { r: -20 }, footF: { r: -16 }, thighB: { r: 2 }, shinB: { r: -24 }, footB: { r: -20 } },
    { t: 2.4, root: { y: -4 }, torso: { r: 2 }, head: { r: 4 }, uArmF: { r: 24 }, fArmF: { r: 20 }, uArmB: { r: 18 }, fArmB: { r: 24 }, thighF: { r: 14 }, shinF: { r: -26 }, footF: { r: -20 }, thighB: { r: 4 }, shinB: { r: -30 }, footB: { r: -24 } },
  ],
};

const idleHeavy: Clip = {
  duration: 2,
  loop: true,
  keys: [
    { t: 0, ease: 'inout', root: { y: 0 }, torso: { r: 6, sy: 1 }, head: { r: -4 }, uArmF: { r: 12 }, fArmF: { r: 18 }, uArmB: { r: -10 }, fArmB: { r: 16 }, thighF: { r: 12 }, shinF: { r: -8 }, footF: { r: -4 }, thighB: { r: -12 }, shinB: { r: -2 }, footB: { r: 6 } },
    { t: 1, ease: 'inout', root: { y: 0.8 }, torso: { r: 7, sy: 1.03 }, head: { r: -6 }, uArmF: { r: 14 }, fArmF: { r: 20 }, uArmB: { r: -8 }, fArmB: { r: 18 }, thighF: { r: 12 }, shinF: { r: -9 }, footF: { r: -3 }, thighB: { r: -12 }, shinB: { r: -3 }, footB: { r: 6 } },
    { t: 2, root: { y: 0 }, torso: { r: 6, sy: 1 }, head: { r: -4 }, uArmF: { r: 12 }, fArmF: { r: 18 }, uArmB: { r: -10 }, fArmB: { r: 16 }, thighF: { r: 12 }, shinF: { r: -8 }, footF: { r: -4 }, thighB: { r: -12 }, shinB: { r: -2 }, footB: { r: 6 } },
  ],
};

// "Cocky": mão na cintura, peso numa perna só (atitude)
const idleCocky: Clip = {
  duration: 2.2,
  loop: true,
  keys: [
    { t: 0, ease: 'inout', root: { x: -0.5 }, hips: { r: 4 }, torso: { r: -6 }, head: { r: -6 }, uArmF: { r: -28 }, fArmF: { r: 110 }, handF: { r: 10 }, uArmB: { r: -6 }, fArmB: { r: 14 }, thighF: { r: 16 }, shinF: { r: -10 }, footF: { r: 6 }, thighB: { r: -6 }, shinB: { r: 2 } },
    { t: 1.1, ease: 'inout', root: { x: 0 }, hips: { r: 3 }, torso: { r: -5, sy: 1.02 }, head: { r: -2 }, uArmF: { r: -26 }, fArmF: { r: 112 }, handF: { r: 10 }, uArmB: { r: -4 }, fArmB: { r: 18 }, thighF: { r: 16 }, shinF: { r: -10 }, footF: { r: 6 }, thighB: { r: -6 }, shinB: { r: 2 } },
    { t: 2.2, root: { x: -0.5 }, hips: { r: 4 }, torso: { r: -6 }, head: { r: -6 }, uArmF: { r: -28 }, fArmF: { r: 110 }, handF: { r: 10 }, uArmB: { r: -6 }, fArmB: { r: 14 }, thighF: { r: 16 }, shinF: { r: -10 }, footF: { r: 6 }, thighB: { r: -6 }, shinB: { r: 2 } },
  ],
};

// ---------------------------------------------------------------- CORRIDA
function runCycle(dur: number, lean: number, stride: number, bob: number, arm: number): Clip {
  const L = (s: number) => s * stride;
  return {
    duration: dur,
    loop: true,
    keys: [
      { t: 0, root: { y: 0 }, torso: { r: lean }, head: { r: -lean * 0.6 }, thighF: { r: L(34) }, shinF: { r: L(-14) }, footF: { r: 10 }, thighB: { r: L(-28) }, shinB: { r: L(-38) }, footB: { r: -10 }, uArmF: { r: -arm }, fArmF: { r: 40 }, uArmB: { r: arm }, fArmB: { r: 60 } },
      { t: dur * 0.25, root: { y: -bob }, torso: { r: lean + 2 }, head: { r: -lean * 0.6 }, thighF: { r: L(4) }, shinF: { r: L(-6) }, thighB: { r: L(10) }, shinB: { r: L(-80) }, footB: { r: -20 }, uArmF: { r: 0 }, fArmF: { r: 50 }, uArmB: { r: 0 }, fArmB: { r: 50 } },
      { t: dur * 0.5, root: { y: 0 }, torso: { r: lean }, head: { r: -lean * 0.6 }, thighF: { r: L(-28) }, shinF: { r: L(-38) }, footF: { r: -10 }, thighB: { r: L(34) }, shinB: { r: L(-14) }, footB: { r: 10 }, uArmF: { r: arm }, fArmF: { r: 60 }, uArmB: { r: -arm }, fArmB: { r: 40 } },
      { t: dur * 0.75, root: { y: -bob }, torso: { r: lean + 2 }, head: { r: -lean * 0.6 }, thighF: { r: L(10) }, shinF: { r: L(-80) }, footF: { r: -20 }, thighB: { r: L(4) }, shinB: { r: L(-6) }, uArmF: { r: 0 }, fArmF: { r: 50 }, uArmB: { r: 0 }, fArmB: { r: 50 } },
      { t: dur, root: { y: 0 }, torso: { r: lean }, head: { r: -lean * 0.6 }, thighF: { r: L(34) }, shinF: { r: L(-14) }, footF: { r: 10 }, thighB: { r: L(-28) }, shinB: { r: L(-38) }, footB: { r: -10 }, uArmF: { r: -arm }, fArmF: { r: 40 }, uArmB: { r: arm }, fArmB: { r: 60 } },
    ],
  };
}

const runGlide: Clip = {
  duration: 1.2,
  loop: true,
  keys: [
    { t: 0, ease: 'inout', root: { y: -5 }, torso: { r: 14 }, head: { r: -8 }, uArmF: { r: -40 }, fArmF: { r: 10 }, uArmB: { r: -50 }, fArmB: { r: 12 }, thighF: { r: 10 }, shinF: { r: -30 }, footF: { r: -30 }, thighB: { r: -10 }, shinB: { r: -40 }, footB: { r: -30 } },
    { t: 0.6, ease: 'inout', root: { y: -8 }, torso: { r: 16 }, head: { r: -10 }, uArmF: { r: -44 }, fArmF: { r: 14 }, uArmB: { r: -54 }, fArmB: { r: 16 }, thighF: { r: 6 }, shinF: { r: -26 }, footF: { r: -26 }, thighB: { r: -14 }, shinB: { r: -36 }, footB: { r: -26 } },
    { t: 1.2, root: { y: -5 }, torso: { r: 14 }, head: { r: -8 }, uArmF: { r: -40 }, fArmF: { r: 10 }, uArmB: { r: -50 }, fArmB: { r: 12 }, thighF: { r: 10 }, shinF: { r: -30 }, footF: { r: -30 }, thighB: { r: -10 }, shinB: { r: -40 }, footB: { r: -30 } },
  ],
};

// ---------------------------------------------------------------- AÇÕES (camada de cima)
const atkPistol: Clip = {
  duration: 0.16,
  loop: false,
  mask: ['torso', 'fArmF', 'handF', 'root'],
  keys: [
    { t: 0, ease: 'out', torso: { r: -4 }, fArmF: { r: 14 }, root: { x: -1 }, face: 'focus' },
    { t: 0.16, torso: { r: 0 }, fArmF: { r: 0 }, root: { x: 0 } },
  ],
};

const atkRifle: Clip = {
  duration: 0.12,
  loop: false,
  mask: ['torso', 'fArmF', 'root'],
  keys: [
    { t: 0, ease: 'out', torso: { r: -3 }, fArmF: { r: 6 }, root: { x: -0.8 }, face: 'focus' },
    { t: 0.12, torso: { r: 0 }, fArmF: { r: 0 }, root: { x: 0 } },
  ],
};

const atkSwing: Clip = {
  duration: 0.36,
  loop: false,
  mask: UPPER,
  keys: [
    { t: 0, ease: 'in', torso: { r: -14 }, head: { r: -4 }, uArmF: { r: 190 }, fArmF: { r: 30 }, uArmB: { r: -20 }, fArmB: { r: 40 }, face: 'shout' },
    { t: 0.1, ease: 'out', torso: { r: 18 }, head: { r: 6 }, uArmF: { r: 40 }, fArmF: { r: -10 }, uArmB: { r: 30 }, fArmB: { r: 50 }, face: 'shout' },
    { t: 0.36, torso: { r: 6 }, head: { r: 2 }, uArmF: { r: 20 }, fArmF: { r: 10 }, uArmB: { r: 10 }, fArmB: { r: 30 } },
  ],
};

const atkHeavy: Clip = {
  duration: 0.5,
  loop: false,
  mask: [...UPPER, 'root'],
  keys: [
    { t: 0, ease: 'out', root: { y: 0, sy: 1 }, torso: { r: -18 }, head: { r: -8 }, uArmF: { r: 175 }, fArmF: { r: 10 }, uArmB: { r: 165 }, fArmB: { r: 20 }, face: 'focus' },
    { t: 0.18, ease: 'in', root: { y: -1, sy: 1.04 }, torso: { r: -22 }, head: { r: -10 }, uArmF: { r: 190 }, fArmF: { r: 10 }, uArmB: { r: 180 }, fArmB: { r: 20 }, face: 'shout' },
    { t: 0.28, ease: 'out', root: { y: 1.5, sy: 0.92 }, torso: { r: 28 }, head: { r: 10 }, uArmF: { r: 60 }, fArmF: { r: 0 }, uArmB: { r: 50 }, fArmB: { r: 10 }, face: 'shout' },
    { t: 0.5, root: { y: 0, sy: 1 }, torso: { r: 10 }, head: { r: 2 }, uArmF: { r: 40 }, fArmF: { r: 10 }, uArmB: { r: 30 }, fArmB: { r: 20 } },
  ],
};

const atkThrow: Clip = {
  duration: 0.34,
  loop: false,
  mask: UPPER,
  keys: [
    { t: 0, ease: 'out', torso: { r: -12 }, uArmF: { r: -50 }, fArmF: { r: 70 }, uArmB: { r: 50 }, fArmB: { r: 20 }, handF: { r: 0 }, face: 'focus' },
    { t: 0.12, ease: 'out', torso: { r: 14 }, uArmF: { r: 150 }, fArmF: { r: 0 }, uArmB: { r: -20 }, fArmB: { r: 30 }, face: 'shout' },
    { t: 0.34, torso: { r: 4 }, uArmF: { r: 40 }, fArmF: { r: 20 }, uArmB: { r: 0 }, fArmB: { r: 20 } },
  ],
};

const atkCast: Clip = {
  duration: 0.42,
  loop: false,
  mask: UPPER,
  keys: [
    { t: 0, ease: 'out', torso: { r: -8 }, head: { r: -6 }, uArmF: { r: 60 }, fArmF: { r: 60 }, uArmB: { r: 50 }, fArmB: { r: 70 }, shapeF: 'open', shapeB: 'open', face: 'focus' },
    { t: 0.14, ease: 'out', torso: { r: 6 }, head: { r: 2 }, uArmF: { r: 100 }, fArmF: { r: 0 }, uArmB: { r: 90 }, fArmB: { r: 10 }, shapeF: 'open', shapeB: 'open', face: 'shout' },
    { t: 0.42, torso: { r: 0 }, uArmF: { r: 40 }, fArmF: { r: 20 }, uArmB: { r: 20 }, fArmB: { r: 20 } },
  ],
};

const atkPunch: Clip = {
  duration: 0.24,
  loop: false,
  mask: UPPER,
  keys: [
    { t: 0, ease: 'out', torso: { r: -6 }, uArmF: { r: 30 }, fArmF: { r: 110 }, uArmB: { r: 60 }, fArmB: { r: 90 }, face: 'focus' },
    { t: 0.07, ease: 'out', torso: { r: 14 }, uArmF: { r: 95 }, fArmF: { r: 0 }, uArmB: { r: 40 }, fArmB: { r: 100 }, face: 'shout' },
    { t: 0.24, torso: { r: 4 }, uArmF: { r: 40 }, fArmF: { r: 90 }, uArmB: { r: 40 }, fArmB: { r: 90 } },
  ],
};

const atkBoombox: Clip = {
  duration: 0.4,
  loop: false,
  mask: UPPER,
  keys: [
    { t: 0, ease: 'out', torso: { r: -6 }, head: { r: -10 }, uArmF: { r: 70 }, fArmF: { r: 30 }, uArmB: { r: 20 }, fArmB: { r: 120 }, shapeB: 'peace', face: 'happy' },
    { t: 0.14, ease: 'out', torso: { r: 8 }, head: { r: 6 }, uArmF: { r: 110 }, fArmF: { r: 10 }, uArmB: { r: 30 }, fArmB: { r: 130 }, shapeB: 'peace', face: 'shout' },
    { t: 0.4, torso: { r: 0 }, head: { r: 0 }, uArmF: { r: 40 }, fArmF: { r: 20 }, uArmB: { r: 10 }, fArmB: { r: 30 } },
  ],
};

const atkBow: Clip = {
  duration: 0.3,
  loop: false,
  mask: ['torso', 'uArmB', 'fArmB', 'handB', 'fArmF'],
  keys: [
    { t: 0, ease: 'out', torso: { r: -6 }, uArmB: { r: 80 }, fArmB: { r: 110 }, fArmF: { r: 0 }, face: 'focus' },
    { t: 0.08, ease: 'out', torso: { r: 2 }, uArmB: { r: 60 }, fArmB: { r: 60 }, fArmF: { r: 4 } },
    { t: 0.3, torso: { r: 0 }, uArmB: { r: 80 }, fArmB: { r: 100 }, fArmF: { r: 0 } },
  ],
};

const hit: Clip = {
  duration: 0.26,
  loop: false,
  mask: ['root', 'torso', 'head'],
  keys: [
    { t: 0, ease: 'out', root: { x: -2.2, sx: 0.94, sy: 1.05 }, torso: { r: -14 }, head: { r: -14 }, face: 'hurt' },
    { t: 0.26, root: { x: 0, sx: 1, sy: 1 }, torso: { r: 0 }, head: { r: 0 } },
  ],
};

const dash: Clip = {
  duration: 0.3,
  loop: true,
  keys: [
    { t: 0, root: { y: -2, sx: 1.08, sy: 0.94 }, torso: { r: 30 }, head: { r: -18 }, uArmF: { r: -70 }, fArmF: { r: 10 }, uArmB: { r: -80 }, fArmB: { r: 10 }, thighF: { r: 50 }, shinF: { r: -70 }, thighB: { r: -40 }, shinB: { r: -50 }, face: 'focus' },
    { t: 0.3, root: { y: -2, sx: 1.08, sy: 0.94 }, torso: { r: 30 }, head: { r: -18 }, uArmF: { r: -70 }, fArmF: { r: 10 }, uArmB: { r: -80 }, fArmB: { r: 10 }, thighF: { r: 50 }, shinF: { r: -70 }, thighB: { r: -40 }, shinB: { r: -50 } },
  ],
};

const stunned: Clip = {
  duration: 0.8,
  loop: true,
  keys: [
    { t: 0, ease: 'inout', root: { x: -1 }, torso: { r: -8 }, head: { r: 14 }, uArmF: { r: 6 }, fArmF: { r: 4 }, uArmB: { r: 4 }, fArmB: { r: 4 }, thighF: { r: 4 }, thighB: { r: -4 }, face: 'hurt' },
    { t: 0.4, ease: 'inout', root: { x: 1 }, torso: { r: 4 }, head: { r: -10 }, face: 'hurt' },
    { t: 0.8, root: { x: -1 }, torso: { r: -8 }, head: { r: 14 }, uArmF: { r: 6 }, fArmF: { r: 4 }, uArmB: { r: 4 }, fArmB: { r: 4 }, thighF: { r: 4 }, thighB: { r: -4 } },
  ],
};

// ---------------------------------------------------------------- VITÓRIA / DERROTA / EMOTE
const winPeace: Clip = {
  duration: 1.6,
  loop: true,
  keys: [
    { t: 0, ease: 'back', root: { y: 0 }, torso: { r: -4 }, head: { r: -6 }, uArmF: { r: 70 }, fArmF: { r: 70 }, shapeF: 'peace', uArmB: { r: -10 }, fArmB: { r: 30 }, thighF: { r: 8 }, thighB: { r: -6 }, face: 'smug' },
    { t: 0.8, ease: 'inout', root: { y: -0.8 }, torso: { r: -2 }, head: { r: -10 }, uArmF: { r: 76 }, fArmF: { r: 66 }, shapeF: 'peace', uArmB: { r: -8 }, fArmB: { r: 34 }, thighF: { r: 8 }, thighB: { r: -6 }, face: 'smug' },
    { t: 1.6, root: { y: 0 }, torso: { r: -4 }, head: { r: -6 }, uArmF: { r: 70 }, fArmF: { r: 70 }, shapeF: 'peace', uArmB: { r: -10 }, fArmB: { r: 30 }, thighF: { r: 8 }, thighB: { r: -6 }, face: 'smug' },
  ],
};

const winFlex: Clip = {
  duration: 1.2,
  loop: true,
  keys: [
    { t: 0, ease: 'inout', root: { y: 0, sy: 1 }, torso: { r: -6 }, head: { r: -8 }, uArmF: { r: 100 }, fArmF: { r: 120 }, uArmB: { r: 100 }, fArmB: { r: 120 }, thighF: { r: 14 }, shinF: { r: -6 }, thighB: { r: -14 }, face: 'shout' },
    { t: 0.6, ease: 'inout', root: { y: -1, sy: 1.04 }, torso: { r: -8 }, head: { r: -12 }, uArmF: { r: 110 }, fArmF: { r: 130 }, uArmB: { r: 110 }, fArmB: { r: 130 }, thighF: { r: 14 }, shinF: { r: -6 }, thighB: { r: -14 }, face: 'happy' },
    { t: 1.2, root: { y: 0, sy: 1 }, torso: { r: -6 }, head: { r: -8 }, uArmF: { r: 100 }, fArmF: { r: 120 }, uArmB: { r: 100 }, fArmB: { r: 120 }, thighF: { r: 14 }, shinF: { r: -6 }, thighB: { r: -14 }, face: 'shout' },
  ],
};

const winDance: Clip = {
  duration: 1,
  loop: true,
  keys: [
    { t: 0, ease: 'inout', root: { x: -2, y: 0 }, hips: { r: -8 }, torso: { r: 10 }, head: { r: -10 }, uArmF: { r: 150 }, fArmF: { r: 20 }, shapeF: 'point', uArmB: { r: -30 }, fArmB: { r: 90 }, thighF: { r: 30 }, shinF: { r: -40 }, thighB: { r: -6 }, face: 'happy' },
    { t: 0.5, ease: 'inout', root: { x: 2, y: -2 }, hips: { r: 8 }, torso: { r: -10 }, head: { r: 10 }, uArmF: { r: -20 }, fArmF: { r: 90 }, shapeF: 'fist', uArmB: { r: 150 }, fArmB: { r: 20 }, thighF: { r: -6 }, thighB: { r: 30 }, shinB: { r: -40 }, face: 'happy' },
    { t: 1, root: { x: -2, y: 0 }, hips: { r: -8 }, torso: { r: 10 }, head: { r: -10 }, uArmF: { r: 150 }, fArmF: { r: 20 }, shapeF: 'point', uArmB: { r: -30 }, fArmB: { r: 90 }, thighF: { r: 30 }, shinF: { r: -40 }, thighB: { r: -6 } },
  ],
};

const winBow: Clip = {
  duration: 2,
  loop: true,
  keys: [
    { t: 0, ease: 'inout', torso: { r: 0 }, head: { r: 0 }, uArmF: { r: 30 }, fArmF: { r: 110 }, uArmB: { r: -20 }, fArmB: { r: 20 }, face: 'smug' },
    { t: 0.6, ease: 'inout', torso: { r: 34 }, head: { r: 14 }, uArmF: { r: 40 }, fArmF: { r: 120 }, uArmB: { r: -40 }, fArmB: { r: 10 }, face: 'blink' },
    { t: 1.4, ease: 'inout', torso: { r: 34 }, head: { r: 14 }, uArmF: { r: 40 }, fArmF: { r: 120 }, uArmB: { r: -40 }, fArmB: { r: 10 }, face: 'blink' },
    { t: 2, torso: { r: 0 }, head: { r: 0 }, uArmF: { r: 30 }, fArmF: { r: 110 }, uArmB: { r: -20 }, fArmB: { r: 20 }, face: 'smug' },
  ],
};

const winLaugh: Clip = {
  duration: 0.5,
  loop: true,
  keys: [
    { t: 0, ease: 'inout', root: { y: 0 }, torso: { r: -14 }, head: { r: -22 }, uArmF: { r: 30 }, fArmF: { r: 100 }, uArmB: { r: 26 }, fArmB: { r: 96 }, face: 'shout' },
    { t: 0.25, ease: 'inout', root: { y: -1.2 }, torso: { r: -10 }, head: { r: -14 }, uArmF: { r: 26 }, fArmF: { r: 104 }, uArmB: { r: 22 }, fArmB: { r: 100 }, face: 'happy' },
    { t: 0.5, root: { y: 0 }, torso: { r: -14 }, head: { r: -22 }, uArmF: { r: 30 }, fArmF: { r: 100 }, uArmB: { r: 26 }, fArmB: { r: 96 }, face: 'shout' },
  ],
};

const winPoint: Clip = {
  duration: 1.4,
  loop: true,
  keys: [
    { t: 0, ease: 'back', torso: { r: 4 }, head: { r: -4 }, uArmF: { r: 92 }, fArmF: { r: 4 }, shapeF: 'point', uArmB: { r: -16 }, fArmB: { r: 110 }, thighF: { r: 18 }, shinF: { r: -6 }, thighB: { r: -10 }, face: 'smug' },
    { t: 0.7, ease: 'inout', torso: { r: 6 }, head: { r: -2 }, uArmF: { r: 96 }, fArmF: { r: 0 }, shapeF: 'point', uArmB: { r: -14 }, fArmB: { r: 114 }, thighF: { r: 18 }, shinF: { r: -6 }, thighB: { r: -10 }, face: 'happy' },
    { t: 1.4, torso: { r: 4 }, head: { r: -4 }, uArmF: { r: 92 }, fArmF: { r: 4 }, shapeF: 'point', uArmB: { r: -16 }, fArmB: { r: 110 }, thighF: { r: 18 }, shinF: { r: -6 }, thighB: { r: -10 }, face: 'smug' },
  ],
};

const winSpin: Clip = {
  duration: 0.8,
  loop: true,
  keys: [
    { t: 0, ease: 'inout', root: { y: 0, sx: 1 }, torso: { r: 0 }, uArmF: { r: 120 }, fArmF: { r: 10 }, shapeF: 'open', uArmB: { r: 120 }, fArmB: { r: 10 }, shapeB: 'open', face: 'happy' },
    { t: 0.2, ease: 'inout', root: { y: -3, sx: 0.2 } },
    { t: 0.4, ease: 'inout', root: { y: -4, sx: -1 }, uArmF: { r: 130 }, uArmB: { r: 130 }, face: 'happy' },
    { t: 0.6, ease: 'inout', root: { y: -3, sx: 0.2 } },
    { t: 0.8, root: { y: 0, sx: 1 }, uArmF: { r: 120 }, fArmF: { r: 10 }, uArmB: { r: 120 }, fArmB: { r: 10 } },
  ],
};

const defeat: Clip = {
  duration: 2,
  loop: true,
  keys: [
    { t: 0, ease: 'inout', root: { y: 2 }, torso: { r: 24 }, head: { r: 26 }, uArmF: { r: -4 }, fArmF: { r: 2 }, uArmB: { r: 4 }, fArmB: { r: 2 }, thighF: { r: 10 }, shinF: { r: -12 }, thighB: { r: -2 }, shinB: { r: -10 }, face: 'sad' },
    { t: 1, ease: 'inout', root: { y: 2.6 }, torso: { r: 26 }, head: { r: 30 }, uArmF: { r: -2 }, fArmF: { r: 4 }, uArmB: { r: 6 }, fArmB: { r: 4 }, thighF: { r: 10 }, shinF: { r: -12 }, thighB: { r: -2 }, shinB: { r: -10 }, face: 'sad' },
    { t: 2, root: { y: 2 }, torso: { r: 24 }, head: { r: 26 }, uArmF: { r: -4 }, fArmF: { r: 2 }, uArmB: { r: 4 }, fArmB: { r: 2 }, thighF: { r: 10 }, shinF: { r: -12 }, thighB: { r: -2 }, shinB: { r: -10 }, face: 'sad' },
  ],
};

// ---------------------------------------------------------------- REGISTRO
export const CLIPS = {
  idle_chill: idleChill,
  idle_bounce: idleBounce,
  idle_hype: idleHype,
  idle_stoic: idleStoic,
  idle_nervous: idleNervous,
  idle_float: idleFloat,
  idle_heavy: idleHeavy,
  idle_cocky: idleCocky,
  run_normal: runCycle(0.52, 10, 1, 2.2, 34),
  run_sprint: runCycle(0.42, 16, 1.2, 2.8, 50),
  run_stomp: runCycle(0.62, 6, 0.8, 3.2, 22),
  run_skip: runCycle(0.5, 4, 0.9, 4.2, 40),
  run_glide: runGlide,
  atk_pistol: atkPistol,
  atk_dual: atkPistol,
  atk_rifle: atkRifle,
  atk_swing: atkSwing,
  atk_heavy_swing: atkHeavy,
  atk_throw: atkThrow,
  atk_cast: atkCast,
  atk_punch: atkPunch,
  atk_boombox: atkBoombox,
  atk_bow: atkBow,
  hit,
  dash,
  stunned,
  win_peace: winPeace,
  win_flex: winFlex,
  win_dance: winDance,
  win_bow: winBow,
  win_laugh: winLaugh,
  win_point: winPoint,
  win_spin: winSpin,
  defeat,
} satisfies Record<string, Clip>;

export type ClipName = keyof typeof CLIPS;

export interface ClipSet {
  idle: Clip;
  run: Clip;
  attack: Clip;
  victory: Clip;
}

export function clipSet(style: AnimStyle): ClipSet {
  return {
    idle: CLIPS[`idle_${style.idle}`],
    run: CLIPS[`run_${style.run}`],
    attack: CLIPS[`atk_${style.attack}`],
    victory: CLIPS[`win_${style.victory}`],
  };
}

/** Armas de mira: o braço da frente aponta pra mira (as outras usam o clipe). */
export function aimsWithArm(style: AnimStyle['attack']): boolean {
  return style === 'pistol' || style === 'dual' || style === 'rifle' || style === 'bow';
}

export { ARMS_F };
