// Verifica o PWA: manifest instalável (CDP) + Service Worker + jogo abrindo e rodando OFFLINE.
// Uso: npm run build && (npx vite preview --port 4173 &) && node scripts/e2e-offline.mjs
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const fail = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => fail.push('pageerror: ' + e.message));

await page.goto(BASE + '/');
await page.waitForSelector('.login-card', { timeout: 15000 });
const swOk = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  return !!reg.active;
});
if (!swOk) fail.push('Service Worker não ativou');

const cdp = await ctx.newCDPSession(page);
const inst = await cdp.send('Page.getInstallabilityErrors');
if (inst.installabilityErrors?.length) fail.push('Instalabilidade: ' + JSON.stringify(inst.installabilityErrors));
const manifest = await cdp.send('Page.getAppManifest');
if (manifest.errors?.length) fail.push('Manifest: ' + JSON.stringify(manifest.errors));
console.log('manifest url:', manifest.url, '| erros de instalabilidade:', inst.installabilityErrors?.length ?? 0);

// Recarrega para a página ficar controlada pelo SW e cacheia tudo
await page.reload();
await page.waitForSelector('.login-card', { timeout: 15000 });
await page.waitForTimeout(1500);

// OFFLINE
await ctx.setOffline(true);
await page.goto(BASE + '/?autopilot=1');
await page.waitForSelector('.login-card', { timeout: 15000 });
await page.fill('.text-in', 'Offline');
await page.tap('text=ENTRAR');
await page.waitForSelector('.play-btn', { timeout: 10000 });
await page.tap('.play-btn');
await page.waitForSelector('text=LUTAR!', { timeout: 10000 });
await page.tap('text=LUTAR!');
await page.waitForSelector('canvas.view', { timeout: 15000 });
await page.waitForTimeout(6000);
const running = await page.evaluate(() => document.querySelector('.hud-status .timer')?.textContent);
console.log('timer offline:', running);
if (!running) fail.push('partida offline não rodou');
await page.screenshot({ path: (process.env.OUT ?? 'screenshots') + '/offline-match.png' }).catch(() => {});
await browser.close();
console.log(fail.length ? 'FALHAS:\n' + fail.join('\n') : 'OK: instalável e jogável offline');
process.exit(fail.length ? 1 : 0);
