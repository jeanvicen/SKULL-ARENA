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

const press = (page, sel) => (page.context()._options?.hasTouch ? page.tap(sel) : page.click(sel));

async function login(page, shot, query = '?autopilot=1') {
  await page.goto(BASE + '/' + query);
  await page.waitForSelector('.login-card', { timeout: 15000 });
  await shot('01-login');
  await page.fill('.text-in', 'Tester');
  await press(page, 'text=ENTRAR');
  await page.waitForSelector('.play-btn', { timeout: 10000 });
  await page.waitForTimeout(900);
  await shot('02-menu');
}

const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

for (const [name, opts] of [['mobile', mobile], ['desktop', desktop]]) {
  await run(name, opts, async (page, shot) => {
    await login(page, shot);
    await press(page, '.play-btn');
    await page.waitForSelector('.cta-bar .btn', { timeout: 10000 });
    await page.waitForTimeout(500);
    await shot('03-select');
    await press(page, 'text=LUTAR!');
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

// Telas de menu (retrato)
await run('screens', mobile, async (page, shot) => {
  await login(page, shot, '');
  const nav = async (label) => { await press(page, `.nav-btn:has-text("${label}")`); await page.waitForTimeout(800); };
  await nav('Loja'); await shot('01-shop');
  await page.mouse.wheel(0, 900); await page.evaluate(() => document.querySelector('.scroll')?.scrollBy(0, 700)); await page.waitForTimeout(300); await shot('02-shop-chests');
  await press(page, '.topbar .icon-btn'); await page.waitForTimeout(700);
  await nav('Baús'); await shot('03-chests');
  await press(page, '.chest-card'); await page.waitForTimeout(900); await shot('04-chest-drop');
  for (let i = 0; i < 2; i++) { await page.tap('.chest-stage'); await page.waitForTimeout(250); }
  await page.waitForTimeout(1200); await shot('05-chest-reveal');
  for (let i = 0; i < 8; i++) { if (await page.locator('.chest-stage .btn').count()) break; await page.tap('.chest-stage'); await page.waitForTimeout(450); }
  await shot('06-chest-summary');
  await press(page, '.chest-stage .btn'); await page.waitForTimeout(500);
  await press(page, '.topbar .icon-btn'); await page.waitForTimeout(700);
  await nav('Coleção'); await shot('07-collection');
  await press(page, '.char-card.locked'); await page.waitForTimeout(900); await shot('08-detail-locked');
  await press(page, '.topbar .icon-btn'); await page.waitForTimeout(700);
  await press(page, '.topbar .icon-btn'); await page.waitForTimeout(700);
  await nav('Eventos'); await shot('09-events');
  await press(page, '.seg button:has-text("Troféus")'); await page.waitForTimeout(300); await shot('10-trophies');
  await press(page, '.seg button:has-text("Perfil")'); await page.waitForTimeout(300); await shot('11-profile');
  await press(page, '.topbar .icon-btn'); await page.waitForTimeout(700);
  await nav('Social'); await shot('12-social');
  await press(page, '.topbar .icon-btn'); await page.waitForTimeout(700);
  await press(page, '.rail-btn:has-text("Config") button'); await page.waitForTimeout(800); await shot('13-settings');
  await press(page, 'text=Créditos'); await page.waitForTimeout(800); await shot('14-credits');
  await press(page, '.topbar .icon-btn'); await page.waitForTimeout(700);
  await press(page, '.topbar .icon-btn'); await page.waitForTimeout(700);
  await press(page, '.rail-btn:has-text("Salas") button'); await page.waitForTimeout(800); await shot('15-rooms');
});

// Controle touch real (sem autopiloto): arrasta o joystick com eventos de ponteiro
await run('touch', mobile, async (page, shot) => {
  await login(page, shot, '');
  await press(page, '.play-btn');
  await page.waitForSelector('.cta-bar .btn');
  await press(page, 'text=LUTAR!');
  await page.waitForSelector('canvas.view', { timeout: 15000 });
  await page.waitForTimeout(3800);
  const before = await page.evaluate(() => { const w = window.__skull; return null; });
  void before;
  const box = await page.locator('.joyzone').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.evaluate(([x, y]) => {
    const zone = document.querySelector('.joyzone');
    zone.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 11, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 11, pointerType: 'touch', clientX: x, clientY: y - 60, bubbles: true }));
  }, [cx, cy]);
  await page.waitForTimeout(1200);
  await shot('01-joystick-up');
  // segura o especial (prévia) e solta (dispara)
  const sb = await page.locator('.special-btn').boundingBox();
  await page.evaluate(([x, y]) => {
    const b = document.querySelector('.special-btn');
    b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 12, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
  }, [sb.x + sb.width / 2, sb.y + sb.height / 2]);
  await page.waitForTimeout(500);
  await shot('02-special-preview');
  await page.evaluate(([x, y]) => {
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 12, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
  }, [sb.x + sb.width / 2, sb.y + sb.height / 2]);
  await page.waitForTimeout(350);
  await shot('03-special-cast');
  await page.evaluate(([x, y]) => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 11, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })), [cx, cy]);
});

console.log(errors.length ? `ERROS:\n${errors.join('\n')}` : 'OK sem erros de página');
process.exit(errors.length ? 1 : 0);
