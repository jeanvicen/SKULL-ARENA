import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Plugin mínimo de Service Worker (sem Workbox): depois do build, lista todos os
 * arquivos emitidos e gera /sw.js a partir de /src/sw-template.js com:
 *  - __PRECACHE__  → lista de URLs do core (cache offline)
 *  - __VERSION__   → hash do conteúdo (troca o cache a cada deploy)
 * Resultado: PWA instalável que roda o modo bots 100% offline.
 */
function skullServiceWorker(): Plugin {
  return {
    name: 'skull-service-worker',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const staticFiles = [
        '/',
        '/index.html',
        '/manifest.webmanifest',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
        '/icons/maskable-512.png',
        '/icons/apple-touch-icon.png',
        '/icons/favicon.svg',
      ];
      const urls = [...new Set([...staticFiles, ...files.map((f) => '/' + f)])];
      const hash = createHash('sha256');
      for (const f of files) {
        const item = bundle[f];
        hash.update(item.type === 'chunk' ? item.code : typeof item.source === 'string' ? item.source : Buffer.from(item.source));
      }
      const version = hash.digest('hex').slice(0, 12);
      const template = readFileSync(resolve(__dirname, 'src/sw-template.js'), 'utf8');
      const source = template
        .replace('__PRECACHE__', JSON.stringify(urls, null, 2))
        .replace('__VERSION__', JSON.stringify(version));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [skullServiceWorker()],
  resolve: {
    alias: { '@data': resolve(__dirname, 'data') },
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    assetsInlineLimit: 0,
  },
  server: { port: 5173 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
