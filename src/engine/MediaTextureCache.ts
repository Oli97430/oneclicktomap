import * as THREE from 'three';
import type { TextParams } from '@/types';
import { setMediaStatus, clearMediaStatus } from '@/utils/mediaStatusBus';
import { subscribeWebFrame, subscribeWebError } from '@/utils/webSourceBus';

export interface MediaDescriptor {
  kind: 'image' | 'video' | 'webcam' | 'text' | 'stream' | 'web' | 'window';
  dataUrl?: string;
  deviceId?: string;
  textParams?: TextParams;
  streamUrl?: string;
  /** Pour web : chemin/URL de la page rendue hors-écran (clé de signature). */
  webUrl?: string;
  /** Pour window : identifiant desktopCapturer (écran/fenêtre). */
  windowSourceId?: string;
  /** Pour window : nom de la source (re-matching après redémarrage). */
  windowName?: string;
}

/** État de chargement d'une entrée (G2 : progressive video loading). */
export type LoadingState = 'ready' | 'loading' | 'error';

interface Entry {
  sig: string;
  texture: THREE.Texture | null;
  video?: HTMLVideoElement;
  stream?: MediaStream;
  /** URL blob créée via URL.createObjectURL — à révoquer à la libération (vidéo). */
  blobUrl?: string;
  /** Pour web : désabonnement du bus de frames hors-écran. */
  unsub?: () => void;
  loadingState: LoadingState;
}

// ──────────────────────────────────────────────────────────────────────────────
// Conteneur DOM caché pour les éléments <video>.
//
// CAUSE RACINE du bug « les vidéos ne sont pas lues » : Chromium/Electron
// suspend (ou throttle agressivement) le décodage des <video> qui ne sont PAS
// attachés au document. `play()` peut résoudre mais `currentTime` n'avance pas,
// donc aucune frame n'est jamais décodée → la VideoTexture reste noire, peu
// importe combien de fois on force `needsUpdate`.
//
// On attache donc chaque <video> à un conteneur hors-écran (1px, invisible, mais
// PAS `display:none` — ce qui re-suspendrait le décodage). Ce conteneur est un
// singleton par renderer (éditeur ET fenêtre de sortie ont chacun le leur).
// ──────────────────────────────────────────────────────────────────────────────
let videoHost: HTMLDivElement | null = null;
function getVideoHost(): HTMLDivElement {
  if (!videoHost || !videoHost.isConnected) {
    videoHost = document.createElement('div');
    videoHost.setAttribute('aria-hidden', 'true');
    videoHost.dataset.role = 'ocm-video-host';
    // Hors-écran mais « rendu » : 1px, opacité nulle. display:none interdit.
    videoHost.style.cssText =
      'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;' +
      'opacity:0;pointer-events:none;z-index:-1;';
    document.body.appendChild(videoHost);
  }
  return videoHost;
}

/** Tente de lancer la lecture ; ignore le rejet (autoplay policy) sans casser. */
function tryPlay(video: HTMLVideoElement): void {
  const p = video.play();
  if (p && typeof p.catch === 'function') {
    p.catch((err: unknown) => {
      console.warn('[OCM] video.play() rejected:', err);
    });
  }
}

/**
 * Convertit une data URL en Blob de façon SYNCHRONE (décodage base64 manuel).
 *
 * On évite `fetch(dataUrl)` : sur une data URL de plusieurs Mo, dans le renderer
 * sandboxé d'Electron, `fetch` peut échouer ou être bloqué par la politique de
 * sécurité — ce qui laissait la vidéo se charger via une data URL géante directe
 * (peu fiable) et aboutissait à un écran noir. Le décodage manuel est robuste.
 */
function dataUrlToBlob(dataUrl: string): Blob | null {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;
  const header = dataUrl.slice(5, comma); // après "data:"
  const isBase64 = /;base64$/i.test(header);
  const mime = header.replace(/;base64$/i, '') || 'application/octet-stream';
  const payload = dataUrl.slice(comma + 1);
  try {
    if (isBase64) {
      const bin = atob(payload);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(payload)], { type: mime });
  } catch (err) {
    console.warn('[OCM] dataUrlToBlob a échoué:', err);
    return null;
  }
}

// Signature légère (évite de comparer des data URLs de plusieurs Mo à chaque sync).
function signature(d: MediaDescriptor): string {
  if (d.kind === 'text') {
    return `text:${d.textParams?.content ?? ''}:${d.textParams?.fontSize ?? 0}:${d.textParams?.color ?? ''}:${d.textParams?.fontFamily ?? ''}`;
  }
  if (d.kind === 'stream') return `stream:${d.streamUrl ?? ''}`;
  if (d.kind === 'web') return `web:${d.webUrl ?? ''}`;
  if (d.kind === 'window') return `window:${d.windowSourceId ?? ''}:${d.windowName ?? ''}`;
  return `${d.kind}:${d.deviceId ?? ''}:${d.dataUrl ? d.dataUrl.length : 0}`;
}

/**
 * Re-résout l'id de capture courant à partir du nom mémorisé (les ids
 * desktopCapturer changent entre sessions). Renvoie null si introuvable.
 */
async function resolveWindowIdByName(name: string): Promise<string | null> {
  try {
    const sources = (await window.oneClickToMap?.getDesktopSources()) ?? [];
    return sources.find((s) => s.name === name)?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Convertit une frame BGRA (origine haut-gauche, fournie par Electron) en RGBA
 * retournée verticalement (origine bas-gauche) — pour s'aligner sur l'orientation
 * des textures image (flipY) et apparaître à l'endroit. Écrit dans `dst`.
 * Exporté pour les tests unitaires.
 */
export function bgraToRgbaFlipped(src: Uint8Array, dst: Uint8Array, w: number, h: number): void {
  const need = w * h * 4;
  if (src.length < need || dst.length < need) return;
  // Chemin rapide 32 bits si l'alignement le permet.
  if (src.byteOffset % 4 === 0) {
    const s32 = new Uint32Array(src.buffer, src.byteOffset, w * h);
    const d32 = new Uint32Array(dst.buffer, dst.byteOffset, w * h);
    for (let y = 0; y < h; y += 1) {
      const sRow = y * w;
      const dRow = (h - 1 - y) * w;
      for (let x = 0; x < w; x += 1) {
        const v = s32[sRow + x]; // octets B,G,R,A (little-endian)
        // R<->B : garde G (0x0000ff00) et A (0xff000000), permute R et B.
        d32[dRow + x] = (v & 0xff00ff00) | ((v >>> 16) & 0xff) | ((v & 0xff) << 16);
      }
    }
    return;
  }
  // Repli octet par octet (alignement non garanti).
  for (let y = 0; y < h; y += 1) {
    const sRow = y * w * 4;
    const dRow = (h - 1 - y) * w * 4;
    for (let x = 0; x < w * 4; x += 4) {
      dst[dRow + x] = src[sRow + x + 2]; // R <- R
      dst[dRow + x + 1] = src[sRow + x + 1]; // G
      dst[dRow + x + 2] = src[sRow + x]; // B <- B(src position 0)
      dst[dRow + x + 3] = src[sRow + x + 3]; // A
    }
  }
}

/** Résolution : 1024 × 256 pour les calques texte. */
const TEXT_W = 1024;
const TEXT_H = 256;

/** Rend les paramètres TextParams sur un OffscreenCanvas et renvoie la texture. */
function buildTextTexture(params: TextParams): THREE.Texture {
  const canvas = new OffscreenCanvas(TEXT_W, TEXT_H);
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, TEXT_W, TEXT_H);

  ctx.fillStyle = params.background || 'transparent';
  ctx.fillRect(0, 0, TEXT_W, TEXT_H);

  const weight = params.bold ? 'bold ' : '';
  const style = params.italic ? 'italic ' : '';
  ctx.font = `${style}${weight}${params.fontSize}px ${params.fontFamily || 'sans-serif'}`;
  ctx.fillStyle = params.color || '#ffffff';
  ctx.textAlign = params.align || 'center';
  ctx.textBaseline = 'middle';

  const lines = params.content.split('\n');
  const lineH = params.fontSize * 1.35;
  const startY = TEXT_H / 2 - ((lines.length - 1) * lineH) / 2;
  const x = params.align === 'left' ? 16 : params.align === 'right' ? TEXT_W - 16 : TEXT_W / 2;

  lines.forEach((line, i) => ctx.fillText(line, x, startY + i * lineH));

  const html = document.createElement('canvas');
  html.width = TEXT_W;
  html.height = TEXT_H;
  const hctx = html.getContext('2d')!;
  hctx.drawImage(canvas as unknown as CanvasImageSource, 0, 0);
  const texture = new THREE.CanvasTexture(html);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Cache de textures de calque, tous types confondus :
 * - image : THREE.Texture chargée de manière asynchrone (null tant qu'absente) ;
 * - video : THREE.VideoTexture lue en boucle (muette) depuis une data URL ;
 * - webcam : THREE.VideoTexture alimentée par getUserMedia(deviceId) ;
 * - text : THREE.CanvasTexture rendue depuis TextParams (C4) ;
 * - stream : THREE.VideoTexture depuis URL HLS/WebRTC (C6).
 * `onLoad` redéclenche un rendu quand une ressource asynchrone devient prête.
 */
export class MediaTextureCache {
  private readonly entries = new Map<string, Entry>();
  private disposed = false;
  /** H2 : quand vrai, update() ne pousse plus de nouvelles frames (dernière frame figée). */
  private frozen = false;

  constructor(private readonly onLoad: () => void) {}

  /** H2 : active/désactive le freeze vidéo. */
  setFrozen(on: boolean): void {
    this.frozen = on;
  }

  /** Prépare un <video> commun (vidéo / stream / webcam) et l'attache au DOM caché. */
  private createVideoElement(): HTMLVideoElement {
    const video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    // Attache au document : indispensable pour que Chromium décode les frames.
    getVideoHost().appendChild(video);
    return video;
  }

  get(key: string, descriptor: MediaDescriptor): THREE.Texture | null {
    const sig = signature(descriptor);
    const existing = this.entries.get(key);
    if (existing && existing.sig === sig) return existing.texture;
    if (existing) {
      this.disposeEntry(existing);
      this.entries.delete(key);
    }

    if (descriptor.kind === 'image') {
      if (!descriptor.dataUrl) return null;
      const entry: Entry = { sig, texture: null, loadingState: 'loading' };
      this.entries.set(key, entry);
      new THREE.TextureLoader().load(
        descriptor.dataUrl,
        (texture) => {
          if (this.disposed || this.entries.get(key) !== entry) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          entry.texture = texture;
          entry.loadingState = 'ready';
          this.onLoad();
        },
        undefined,
        () => {
          if (this.entries.get(key) === entry) entry.loadingState = 'error';
        },
      );
      return null;
    }

    if (descriptor.kind === 'video') {
      if (!descriptor.dataUrl) return null;

      const video = this.createVideoElement();
      const entry: Entry = { sig, texture: null, video, loadingState: 'loading' };
      this.entries.set(key, entry);
      setMediaStatus(key, 'loading');

      // Lance la lecture dès que des données sont décodées. `loadeddata` arrive
      // avant `canplay` ; on écoute les deux pour démarrer au plus tôt.
      const start = () => {
        if (this.entries.get(key) !== entry) return;
        entry.loadingState = 'ready';
        setMediaStatus(key, 'ready');
        tryPlay(video);
        this.onLoad();
      };
      video.addEventListener('loadeddata', start, { once: true });
      video.addEventListener('canplay', start, { once: true });
      video.addEventListener('error', () => {
        if (this.entries.get(key) === entry) {
          console.warn('[OCM] échec de chargement vidéo (codec non supporté ?) :', video.error?.message ?? '(inconnu)');
          entry.loadingState = 'error';
          setMediaStatus(key, 'error');
        }
      });

      // data URL → Blob URL via décodage base64 SYNCHRONE (pas de fetch, cf.
      // dataUrlToBlob). Indispensable pour les gros fichiers et le sandbox Electron.
      const blob = dataUrlToBlob(descriptor.dataUrl);
      if (blob) {
        const url = URL.createObjectURL(blob);
        entry.blobUrl = url;
        video.src = url;
      } else {
        // Dernier recours : data URL directe.
        video.src = descriptor.dataUrl;
      }
      video.load();

      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      entry.texture = texture;
      return texture;
    }

    // C6 : stream HLS / WebRTC (URL externe, Electron Chromium supporte .m3u8)
    if (descriptor.kind === 'stream') {
      if (!descriptor.streamUrl) return null;
      const video = this.createVideoElement();
      video.loop = false;
      video.src = descriptor.streamUrl;
      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      const entry: Entry = { sig, texture, video, loadingState: 'loading' };
      this.entries.set(key, entry);
      setMediaStatus(key, 'loading');
      const start = () => {
        if (this.entries.get(key) !== entry) return;
        entry.loadingState = 'ready';
        setMediaStatus(key, 'ready');
        tryPlay(video);
        this.onLoad();
      };
      video.addEventListener('loadeddata', start, { once: true });
      video.addEventListener('canplay', start, { once: true });
      video.addEventListener('error', () => {
        if (this.entries.get(key) === entry) {
          console.warn('[OCM] échec de chargement du flux :', video.error?.message ?? '(inconnu)');
          entry.loadingState = 'error';
          setMediaStatus(key, 'error');
        }
      });
      video.load();
      return texture;
    }

    // C4 : calque texte
    if (descriptor.kind === 'text') {
      if (!descriptor.textParams) return null;
      const texture = buildTextTexture(descriptor.textParams);
      const entry: Entry = { sig, texture, loadingState: 'ready' };
      this.entries.set(key, entry);
      return texture;
    }

    // Source web : DataTexture alimentée par les frames hors-écran (IPC).
    if (descriptor.kind === 'web') {
      if (!descriptor.webUrl) return null;
      // Placeholder noir 2×2 ; redimensionné à la première frame.
      const data = new Uint8Array(2 * 2 * 4);
      const texture = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.generateMipmaps = false;
      texture.flipY = false; // ignoré pour DataTexture : on retourne déjà en CPU
      texture.needsUpdate = true;
      const entry: Entry = { sig, texture, loadingState: 'loading' };
      this.entries.set(key, entry);
      setMediaStatus(key, 'loading');

      const offFrame = subscribeWebFrame(key, (frame) => {
        if (this.frozen) return; // H2 : freeze
        if (this.entries.get(key) !== entry || !entry.texture) return;
        const { width: w, height: h } = frame;
        if (w <= 0 || h <= 0) return;
        const img = entry.texture.image as { data: Uint8Array; width: number; height: number };
        if (img.width !== w || img.height !== h || img.data.length !== w * h * 4) {
          img.data = new Uint8Array(w * h * 4);
          img.width = w;
          img.height = h;
        }
        bgraToRgbaFlipped(frame.data, img.data, w, h);
        entry.texture.needsUpdate = true;
        if (entry.loadingState !== 'ready') {
          entry.loadingState = 'ready';
          setMediaStatus(key, 'ready');
          this.onLoad();
        }
      });
      const offError = subscribeWebError(key, () => {
        if (this.entries.get(key) !== entry) return;
        entry.loadingState = 'error';
        setMediaStatus(key, 'error');
      });
      entry.unsub = () => {
        offFrame();
        offError();
      };
      return texture;
    }

    // Capture de fenêtre / écran (desktopCapturer → getUserMedia → MediaStream).
    if (descriptor.kind === 'window') {
      if (!descriptor.windowSourceId && !descriptor.windowName) return null;
      const video = this.createVideoElement();
      video.loop = false;
      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      const entry: Entry = { sig, texture, video, loadingState: 'loading' };
      this.entries.set(key, entry);
      setMediaStatus(key, 'loading');

      // Contraintes non standard Electron (capture desktop) → cast nécessaire.
      const captureWith = (sourceId: string): Promise<MediaStream> => {
        if (!navigator.mediaDevices) return Promise.reject(new Error('mediaDevices indisponible'));
        const constraints = {
          audio: false,
          video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId } },
        } as unknown as MediaStreamConstraints;
        return navigator.mediaDevices.getUserMedia(constraints);
      };
      const onStream = (stream: MediaStream): void => {
        if (this.disposed || this.entries.get(key) !== entry) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        entry.stream = stream;
        video.srcObject = stream;
        entry.loadingState = 'ready';
        setMediaStatus(key, 'ready');
        tryPlay(video);
        this.onLoad();
      };

      // 1) id mémorisé (cas même session) ; 2) repli : re-matching par nom (les ids
      // ne survivent pas au redémarrage). Erreur seulement si les deux échouent.
      void (async () => {
        if (descriptor.windowSourceId) {
          try {
            onStream(await captureWith(descriptor.windowSourceId));
            return;
          } catch {
            /* id périmé → re-matching par nom ci-dessous */
          }
        }
        if (descriptor.windowName) {
          const reId = await resolveWindowIdByName(descriptor.windowName);
          if (reId) {
            try {
              onStream(await captureWith(reId));
              return;
            } catch {
              /* échec malgré le re-matching */
            }
          }
        }
        console.warn('[OCM] capture de fenêtre indisponible (fenêtre fermée ?)');
        if (this.entries.get(key) === entry) {
          entry.loadingState = 'error';
          setMediaStatus(key, 'error');
        }
      })();
      return texture;
    }

    // webcam
    const video = this.createVideoElement();
    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    const entry: Entry = { sig, texture, video, loadingState: 'loading' };
    this.entries.set(key, entry);
    setMediaStatus(key, 'loading');

    const constraints: MediaStreamConstraints = {
      video: descriptor.deviceId ? { deviceId: { exact: descriptor.deviceId } } : true,
      audio: false,
    };
    navigator.mediaDevices
      ?.getUserMedia(constraints)
      .then((stream) => {
        if (this.disposed || this.entries.get(key) !== entry) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        entry.stream = stream;
        video.srcObject = stream;
        entry.loadingState = 'ready';
        setMediaStatus(key, 'ready');
        tryPlay(video);
        this.onLoad();
      })
      .catch(() => {
        if (this.entries.get(key) === entry) {
          entry.loadingState = 'error';
          setMediaStatus(key, 'error');
        }
      });
    return texture;
  }

  /**
   * Tick par frame : force la mise à jour des textures vidéo (video/webcam/stream).
   *
   * THREE.VideoTexture ne marque `needsUpdate` que via `requestVideoFrameCallback`,
   * qui n'est PAS déclenché de façon fiable pour un <video> dans Electron/Chromium.
   * On reproduit le fallback de Three : dès que la vidéo a une nouvelle frame, on
   * réuploade. On relance aussi la lecture si elle s'est arrêtée (sécurité).
   * Doit être appelé une fois par frame depuis la boucle de rendu.
   */
  update(): void {
    if (this.frozen) return; // H2 : freeze — dernière frame figée
    for (const entry of this.entries.values()) {
      const video = entry.video;
      if (!video || !entry.texture) continue;
      // Relance si la lecture s'est interrompue alors que des données existent.
      if (video.paused && video.readyState >= video.HAVE_CURRENT_DATA && !video.ended) {
        tryPlay(video);
      }
      if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        entry.texture.needsUpdate = true;
      }
    }
  }

  /** G2 : état de chargement d'une entrée (pour l'indicateur dans LayersPanel). */
  getLoadingState(key: string): LoadingState {
    return this.entries.get(key)?.loadingState ?? 'loading';
  }

  prune(activeKeys: Set<string>): void {
    for (const [key, entry] of this.entries) {
      if (!activeKeys.has(key)) {
        this.disposeEntry(entry);
        this.entries.delete(key);
        clearMediaStatus(key);
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const key of this.entries.keys()) clearMediaStatus(key);
    for (const entry of this.entries.values()) this.disposeEntry(entry);
    this.entries.clear();
  }

  private disposeEntry(entry: Entry): void {
    entry.unsub?.();
    entry.texture?.dispose();
    entry.stream?.getTracks().forEach((t) => t.stop());
    if (entry.video) {
      entry.video.pause();
      entry.video.srcObject = null;
      entry.video.removeAttribute('src');
      entry.video.load();
      entry.video.remove(); // retire du conteneur DOM caché
    }
    if (entry.blobUrl) URL.revokeObjectURL(entry.blobUrl);
    entry.texture = null;
    entry.video = undefined;
    entry.stream = undefined;
    entry.blobUrl = undefined;
    entry.unsub = undefined;
  }
}
