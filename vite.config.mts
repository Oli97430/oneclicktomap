import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import glsl from 'vite-plugin-glsl';

// CSP de production (defense-in-depth). En dev, le HMR de Vite (inline + ws +
// eval) casserait avec cette politique : on ne l'injecte donc qu'au build.
const PROD_CSP = [
  "default-src 'self'",
  // blob: requis pour l'AudioWorklet LTC (timecode F1), chargé via une blob URL
  // (ctx.audioWorklet.addModule). Les worklets sont régis par script-src ; sans
  // blob: le décodeur LTC est bloqué en prod (invisible en dev, sans CSP).
  "script-src 'self' blob:",
  // worker-src : Web Workers / Worklets éventuels (défense en profondeur).
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  // media-src : INDISPENSABLE pour les calques vidéo. Sans cette directive, les
  // <video src="blob:…"> / "data:…" retombent sur default-src 'self' et sont
  // bloqués par la CSP en build de prod → calque vidéo noir (invisible en dev,
  // où aucune CSP n'est injectée). https : pour les flux HLS/RTSP distants (C6).
  "media-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // data:/blob: pour fetch local (lecture de médias) ; https: pour les flux.
  "connect-src 'self' data: blob: https:",
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
