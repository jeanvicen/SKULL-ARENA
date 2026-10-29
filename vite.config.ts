/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/**
 * Service Worker próprio (sem Workbox): no fim do build gera `sw.js` com a lista
 * de arquivos do build pra precache. O jogo abre e joga offline depois da 1ª visita.
 * Tudo de public/ (áudio, ícones) também entra no precache.
 */
function serviceWorker(): Plugin {
  return {
    name: 'skull-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== 'sw.js');
      // Arquivos de public/ (áudio, ícones, manifest) também vão pro precache: o jogo roda 100% offline.
      const publicDir = new URL('./public', import.meta.url).pathname;
      const walk = (dir: string): string[] =>
        readdirSync(dir).flatMap((name) => {
          const full = join(dir, name);
          return statSync(full).isDirectory() ? walk(full) : [relative(publicDir, full).split('\\').join('/')];
        });
      try {
        files.push(...walk(publicDir).filter((f) => !f.endsWith('.html')));
      } catch {
        /* sem public/ */
      }
      const version = `${pkg.version}-${Date.now().toString(36)}`;
      const template = readFileSync(new URL('./src/sw-template.js', import.meta.url), 'utf8');
      const source = template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(['./', ...files]));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [serviceWorker()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    assetsInlineLimit: 0,
  },
  server: { host: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
