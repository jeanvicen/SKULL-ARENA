// Gera os ícones do PWA (PNG) a partir do SVG do logo, renderizando no Chromium.
// Uso: node scripts/gen-icons.mjs   (saída em public/icons)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const SKULL = `
  <defs>
    <radialGradient id="b" cx="40%" cy="30%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#f3ead8"/><stop offset="1" stop-color="#b8a98c"/></radialGradient>
    <filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
  </defs>
  <path d="M18 100 102 30M18 30l84 70" stroke="#f3ead8" stroke-width="12" stroke-linecap="round"/>
  <path d="M18 100 102 30M18 30l84 70" stroke="#2a1450" stroke-width="3" stroke-linecap="round" opacity=".25"/>
  <g fill="#f3ead8" stroke="#2a1450" stroke-width="3"><circle cx="14" cy="27" r="8"/><circle cx="106" cy="27" r="8"/><circle cx="14" cy="103" r="8"/><circle cx="106" cy="103" r="8"/></g>
  <path d="M60 14C36 14 22 31 22 52c0 13 6 22 14 27v13h48V79c8-5 14-14 14-27 0-21-14-38-38-38z" fill="url(#b)" stroke="#2a1450" stroke-width="4"/>
  <path d="M38 92v-7M48 92v-7M60 92v-7M72 92v-7M82 92v-7" stroke="#2a1450" stroke-width="3"/>
  <ellipse cx="45" cy="55" rx="11" ry="12" fill="#1a0f24"/><ellipse cx="75" cy="55" rx="11" ry="12" fill="#1a0f24"/>
  <circle cx="45" cy="56" r="6" fill="#ff2d95" filter="url(#g)"/><circle cx="75" cy="56" r="6" fill="#ff2d95" filter="url(#g)"/>
  <circle cx="45" cy="56" r="3.8" fill="#ff7ac0"/><circle cx="75" cy="56" r="3.8" fill="#ff7ac0"/>
  <path d="M60 66l-5 9h10z" fill="#1a0f24"/>
  <path d="M38 34q8-10 20-11" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".8"/>`;

function iconSvg({ maskable = false, round = false } = {}) {
  // maskable: conteúdo dentro da zona segura (círculo de 80%)
  const scale = maskable ? 0.62 : 0.8;
  const off = (120 - 120 * scale) / 2;
  const bg = `<radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#5a2fb0"/><stop offset=".6" stop-color="#2a1258"/><stop offset="1" stop-color="#120826"/></radialGradient>`;
  const rect = round ? `<rect width="120" height="120" rx="26" fill="url(#bg)"/>` : `<rect width="120" height="120" fill="url(#bg)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs>${bg}</defs>${rect}
    <circle cx="60" cy="62" r="46" fill="#ff2d95" opacity=".18"/>
    <g transform="translate(${off} ${off + 2}) scale(${scale})">${SKULL}</g></svg>`;
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/favicon.svg', iconSvg({ round: true }));
const browser = await chromium.launch();
const page = await browser.newPage();
const jobs = [
  ['icon-192.png', 192, iconSvg({ round: false })],
  ['icon-512.png', 512, iconSvg({ round: false })],
  ['maskable-512.png', 512, iconSvg({ maskable: true })],
  ['apple-touch-icon.png', 180, iconSvg({ round: false })],
  ['play-store-512.png', 512, iconSvg({ round: false })],
];
for (const [name, size, svg] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('ok', name);
}
await browser.close();
