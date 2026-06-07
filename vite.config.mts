import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import glsl from 'vite-plugin-glsl';

// CSP de production (defense-in-depth). En dev, le HMR de Vite (inline + ws +
// eval) casserait avec cette politique : on ne l'injecte donc qu'au build.
const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-src 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'oneclicktomap-csp',
    transformIndexHtml(html, ctx) {
      if (ctx.server) return html; // dev : pas de CSP (HMR)
      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content: PROD_CSP },
            injectTo: 'head',
          },
        ],
      };
    },
  };
}

// Sortie : renderer -> dist/, main + preload -> dist-electron/.
// Le paquet est en CommonJS (pas de "type": "module"), donc main/preload
// sont émis en CJS, ce qui évite les écueils ESM côté processus principal.
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    glsl(),
    cspPlugin(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: { output: { format: 'cjs' } },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: { output: { format: 'cjs', entryFileNames: 'preload.js' } },
          },
        },
      },
    }),
  ],
});
