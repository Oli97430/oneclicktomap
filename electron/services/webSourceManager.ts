import { BrowserWindow, type NativeImage } from 'electron';
import type { WebSourceFrame, WebSourceOptions } from '../../shared/contract';

interface WebSourceInstance {
  win: BrowserWindow;
  sig: string;
  /** Timer forçant des repeintures régulières (cf. invalidate ci-dessous). */
  ticker: ReturnType<typeof setInterval>;
}

interface WebSourceManagerDeps {
  /** Diffuse une frame à toutes les fenêtres consommatrices (éditeur + sorties). */
  broadcast: (frame: WebSourceFrame) => void;
  /** Signale l'échec de chargement d'une source (chemin/URL invalide). */
  reportError: (id: string, description: string) => void;
}

const DEFAULT_W = 1280;
const DEFAULT_H = 720;
const DEFAULT_FPS = 30;
const MIN_DIM = 64;
const MAX_DIM = 3840;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));

/**
 * Rend des pages web (fichiers HTML locaux ou URLs) hors-écran via des
 * `BrowserWindow` offscreen (OSR). Chaque page WebGL/2D est composée par
 * Chromium puis ses frames (`paint`) sont diffusées au renderer, qui les
 * téléverse dans une texture Three.js — permettant d'utiliser des visionneuses
 * SuperSplat, des shaders WebGL externes, etc. comme calques déformables.
 *
 * Une fenêtre par `id` de calque ; recréée si l'URL ou la taille change.
 */
export class WebSourceManager {
  private readonly instances = new Map<string, WebSourceInstance>();

  constructor(private readonly deps: WebSourceManagerDeps) {}

  start(id: string, options: WebSourceOptions): void {
    const url = typeof options?.url === 'string' ? options.url.trim() : '';
    if (!url) return;
    const width = clamp(options.width ?? DEFAULT_W, MIN_DIM, MAX_DIM);
    const height = clamp(options.height ?? DEFAULT_H, MIN_DIM, MAX_DIM);
    const fps = clamp(options.fps ?? DEFAULT_FPS, 1, 60);
    const sig = `${url}|${width}x${height}@${fps}`;

    const existing = this.instances.get(id);
    if (existing && existing.sig === sig && !existing.win.isDestroyed()) return; // déjà à jour
    if (existing) this.destroy(id);

    const win = new BrowserWindow({
      show: false,
      width,
      height,
      frame: false,
      webPreferences: {
        offscreen: true,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
        // Pas de preload : la page rendue est du contenu tiers, isolé de l'API de l'app.
      },
    });
    win.webContents.setAudioMuted(true);

    // Chargement échoué (fichier déplacé/introuvable, URL injoignable) : on le
    // remonte pour afficher un indicateur d'erreur plutôt qu'une page blanche muette.
    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, _url, isMainFrame) => {
      if (!isMainFrame || win.isDestroyed()) return;
      // -3 = ERR_ABORTED (navigation remplacée) : pas une vraie erreur.
      if (errorCode === -3) return;
      this.deps.reportError(id, errorDescription || `Erreur ${errorCode}`);
    });

    win.webContents.on('paint', (_event, _dirty, image: NativeImage) => {
      if (win.isDestroyed()) return;
      const size = image.getSize();
      if (size.width === 0 || size.height === 0) return;
      this.deps.broadcast({
        id,
        width: size.width,
        height: size.height,
        // getBitmap() renvoie un Buffer BGRA (origine haut-gauche). Copie défensive
        // (le tampon interne peut être réutilisé après l'événement).
        data: Uint8Array.from(image.getBitmap()),
      });
    });

    win.webContents.setFrameRate(fps);
    this.loadInto(win, url);

    // Force des repeintures régulières. Sans cela, une page en « rendu à la
    // demande » (visionneuses 3D / SuperSplat qui ne redessinent que sur
    // interaction) cesse d'invalider sa surface après le premier rendu → l'OSR
    // n'émet plus d'événement 'paint' et la texture reste figée sur la frame
    // initiale (blanche). invalidate() recapture en continu le framebuffer GPU.
    const ticker = setInterval(() => {
      if (win.isDestroyed()) return;
      try {
        win.webContents.invalidate();
      } catch {
        /* fenêtre en cours de destruction */
      }
    }, Math.max(16, Math.round(1000 / fps)));

    this.instances.set(id, { win, sig, ticker });
  }

  stop(id: string): void {
    this.destroy(id);
  }

  stopAll(): void {
    for (const id of [...this.instances.keys()]) this.destroy(id);
  }

  private destroy(id: string): void {
    const inst = this.instances.get(id);
    if (!inst) return;
    this.instances.delete(id);
    clearInterval(inst.ticker);
    if (!inst.win.isDestroyed()) inst.win.destroy();
  }

  private loadInto(win: BrowserWindow, url: string): void {
    // Schémas explicites → loadURL ; sinon chemin de fichier → loadFile.
    // N.B. on liste les schémas connus pour ne PAS confondre une lettre de lecteur
    // Windows (« C:\… ») avec un schéma d'URL.
    if (/^(https?|file|data|blob):/i.test(url)) {
      void win.loadURL(url);
    } else {
      void win.loadFile(url);
    }
  }
}
