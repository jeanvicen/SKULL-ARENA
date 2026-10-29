#!/usr/bin/env node
/**
 * npm run e2e — teste de ponta a ponta no navegador (Playwright + Chromium).
 * Sobe o servidor de desenvolvimento, cria uma conta, passa por TODAS as telas,
 * joga uma partida, e salva prints em e2e-shots/. Falha se aparecer erro no console.
 *
 * Precisa do Playwright: `npx playwright install chromium` (uma vez).
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const PORT = 5199;
const URL = `http://localhost:${PORT}/`;
const OUT = join(process.cwd(), 'e2e-shots');
mkdirSync(OUT, { recursive: true });

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    // Playwright instalado globalmente (require respeita NODE_PATH)
    ({ chromium } = createRequire(import.meta.url)('playwright'));
  } catch {
    console.error('Instale o Playwright: npm i -D playwright && npx playwright install chromium');
    process.exit(1);
  }
}

const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const stop = () => server.kill('SIGTERM');
process.on('exit', stop);

async function waitServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('servidor não subiu');
}

const errors = [];
let lastPage = null;
const step = (m) => console.log(`  • ${m}`);
try {
  await waitServer();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 960, height: 460 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  lastPage = p;
  p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  const shot = (n) => p.screenshot({ path: join(OUT, `${n}.png`) });
  const wait = (ms) => p.waitForTimeout(ms);
  const click = async (sel) => (await p.waitForSelector(sel, { timeout: 8000 })).click({ force: true });
  const closeModals = async () => {
    for (let i = 0; i < 5; i++) {
      const x = await p.$('.modal-x');
      if (!x) break;
      await x.click({ force: true });
      await wait(250);
    }
  };
  const back = async () => {
    await click('#app > .screen:last-child .btn-back');
    await wait(600);
  };

  step('abertura');
  await p.goto(URL);
  await wait(800);
  await shot('01-abertura');
  await p.mouse.click(480, 230);
  await wait(3500);

  step('criar conta');
  const inputs = await p.$$('.auth-form input');
  await inputs[0].fill('Teste E2E');
  await inputs[1].fill('senha123');
  await inputs[2]?.fill('senha123');
  await shot('02-conta');
  await click('.auth-form button[type=submit]');
  await wait(2500);
  await closeModals();
  await wait(500);
  await shot('03-menu');

  for (const [label, name] of [
    ['PERSONAGENS', '04-personagens'],
    ['PETS', '05-pets'],
    ['LOJA', '06-loja'],
    ['SKULL PASS', '07-passe'],
    ['MISSÕES', '08-missoes'],
    ['SOCIAL', '09-social'],
    ['ESTÚDIO', '10-estudio'],
  ]) {
    step(label.toLowerCase());
    await p.getByText(label, { exact: false }).first().click({ force: true });
    await wait(1200);
    await shot(name);
    if (label === 'PERSONAGENS') {
      await click('.char-card');
      await wait(1000);
      await shot('04b-detalhes');
      await back();
    }
    await back();
    await closeModals();
  }
  step('estrada da morte');
  await click('.road-btn');
  await wait(800);
  await shot('11-estrada');
  await back();
  step('configurações');
  await click('.menu-top .btn-icon');
  await wait(800);
  await shot('12-config');
  await back();

  step('partida');
  await click('.btn-play');
  await wait(5500);
  await p.keyboard.down('d');
  await wait(1200);
  await p.keyboard.up('d');
  await p.mouse.click(700, 200);
  await wait(150);
  await shot('13-partida');
  const ok = await p.evaluate(() => {
    const s = window.__session;
    if (!s) return false;
    s.world.finish(s.world.fighters[0].team);
    return true;
  });
  if (!ok) errors.push('sessão de partida não encontrada');
  await wait(6000);
  await shot('14-resultado');
  await browser.close();
} catch (e) {
  errors.push(String(e?.stack ?? e));
  await lastPage?.screenshot({ path: join(OUT, 'zz-falha.png') }).catch(() => {});
} finally {
  stop();
}

if (errors.length) {
  console.error(`\n✗ ${errors.length} erro(s):\n${errors.join('\n')}`);
  process.exit(1);
}
console.log(`\n✔ E2E ok — prints em e2e-shots/\n`);
process.exit(0);
