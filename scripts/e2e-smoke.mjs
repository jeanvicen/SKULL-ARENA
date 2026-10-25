// Teste de fumaça e2e: abre o build (vite preview), cria conta, entra numa partida
// em modo retrato (celular) e desktop, e salva screenshots em ./screenshots.
// Uso: npm run build && (npx vite preview --port 4173 &) && node scripts/e2e-smoke.mjs
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

// Playwright pode estar instalado globalmente (CI/containers) — resolve via require para honrar NODE_PATH.
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT = process.env.OUT ?? 'screenshots';
mkdirSync(OUT, { recursive: true });
const errors = [];

async function run(name, ctxOpts, flow) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] console: ${m.text()}`); });
  try {
    await flow(page, async (label) => page.screenshot({ path: `${OUT}/${name}-${label}.png` }));
  } catch (e) {
    errors.push(`[${name}] flow: ${e.message}`);
    await page.screenshot({ path: `${OUT}/${name}-ERROR.png` }).catch(() => {});
  }
  await browser.close();
}

async function login(page, shot) {
  await page.goto(BASE + '/?autopilot=1');
  await page.waitForSelector('.login-card', { timeout: 15000 });
  await shot('01-login');
  await page.fill('.text-in', 'Tester');
  await page.click('text=ENTRAR');
  await page.waitForSelector('.play-btn', { timeout: 10000 });
  await page.waitForTimeout(900);
  await shot('02-menu');
}

const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

for (const [name, opts] of [['mobile', mobile], ['desktop', desktop]]) {
  await run(name, opts, async (page, shot) => {
    await login(page, shot);
    await page.click('.play-btn');
    await page.waitForSelector('.cta-bar .btn', { timeout: 10000 });
    await page.waitForTimeout(500);
    await shot('03-select');
    await page.click('text=LUTAR!');
    await page.waitForSelector('.radar', { timeout: 10000 });
    await page.waitForTimeout(1200);
    await shot('04-matchmaking');
    await page.waitForSelector('canvas.view', { timeout: 15000 });
    await page.waitForTimeout(2500);
    await shot('05-countdown');
    await page.waitForTimeout(5000);
    await shot('06-fight');
    await page.waitForTimeout(6000);
    await shot('07-fight2');
    await page.waitForSelector('.results', { timeout: 200000 });
    await page.waitForTimeout(1800);
    await shot('08-results');
  });
}

console.log(errors.length ? `ERROS:\n${errors.join('\n')}` : 'OK sem erros de página');
process.exit(errors.length ? 1 : 0);
