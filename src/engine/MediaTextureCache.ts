import * as THREE from 'three';
import type { TextParams } from '@/types';

export interface MediaDescriptor {
  kind: 'image' | 'video' | 'webcam' | 'text' | 'stream';
  dataUrl?: string;
  deviceId?: string;
  textParams?: TextParams;
  streamUrl?: string;
}

/** État de chargement d'une entrée (G2 : progressive video loading). */
export type LoadingState = 'ready' | 'loading' | 'error';

interface Entry {
  sig: string;
  texture: THREE.Texture | null;
  video?: HTMLVideoElement;
  stream?: MediaStream;
  loadingState: LoadingState;
}

// Signature légère (évite de comparer des data URLs de plusieurs Mo à chaque sync).
function signature(d: MediaDescriptor): string {
  if (d.kind === 'text') {
    // Hash rapide : contenu + quelques param visuels
    return `text:${d.textParams?.content ?? ''}:${d.textParams?.fontSize ?? 0}:${d.textParams?.color ?? ''}:${d.textParams?.fontFamily ?? ''}`;
  }
  if (d.kind === 'stream') return `stream:${d.streamUrl ?? ''}`;
  return `${d.kind}:${d.deviceId ?? ''}:${d.dataUrl ? d.dataUrl.length : 0}`;
}

/** Résolution : 1024 × 512 pour les calques texte. */
const TEXT_W = 1024;
const TEXT_H = 256;

/** Rend les paramètres TextParams sur un OffscreenCanvas et renvoie la texture. */
function buildTextTexture(params: TextParams): THREE.Texture {
  const canvas = new OffscreenCanvas(TEXT_W, TEXT_H);
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, TEXT_W, TEXT_H);

  // Fond
  ctx.fillStyle = params.background || 'transparent';
  ctx.fillRect(0, 0, TEXT_W, TEXT_H);

  // Texte
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

  // THREE.CanvasTexture n'accepte pas OffscreenCanvas directement sur tous les
  // environnements — on passe par un ImageBitmap via createImageBitmap.
  // Pour rester synchrone, on crée une canvas HTML classique comme fallback.
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

  constructor(private readonly onLoad: () => void) {}

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
      const video = document.createElement('video');
      video.src = descriptor.dataUrl;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      video.preload = 'auto';
      const entry: Entry = { sig, texture: null, video, loadingState: 'loading' };
      this.entries.set(key, entry);
      // G2 : piste readyState pour l'indicateur de chargement.
      const onReady = () => {
        entry.loadingState = 'ready';
        this.onLoad();
      };
      video.addEventListener('canplay', onReady, { once: true });
      video.addEventListener('error', () => {
        if (this.entries.get(key) === entry) entry.loadingState = 'error';
      });
      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      entry.texture = texture;
      void video.play().catch(() => {});
      return texture;
    }

    // C6 : stream HLS / WebRTC (URL externe, Electron Chromium supporte .m3u8)
    if (descriptor.kind === 'stream') {
      if (!descriptor.streamUrl) return null;
      const video = document.createElement('video');
      video.src = descriptor.streamUrl;
      video.loop = false;
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      const entry: Entry = { sig, texture, video, loadingState: 'loading' };
      this.entries.set(key, entry);
      video.addEventListener('canplay', () => {
        if (this.entries.get(key) === entry) {
          entry.loadingState = 'ready';
          this.onLoad();
        }
      }, { once: true });
      void video.play().catch(() => {});
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

    // webcam
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    const entry: Entry = { sig, texture, video, loadingState: 'loading' };
    this.entries.set(key, entry);

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
        void video.play().catch(() => {});
        this.onLoad();
      })
      .catch(() => {
        if (this.entries.get(key) === entry) entry.loadingState = 'error';
      });
    return texture;
  }

  /**
   * Tick par frame : force la mise à jour des textures vidéo (video/webcam/stream).
   *
   * THREE.VideoTexture ne marque `needsUpdate` que via `requestVideoFrameCallback`,
   * qui n'est PAS déclenché de façon fiable pour un <video> détaché du DOM dans
   * Electron/Chromium (l'élément n'étant jamais composité). On reproduit donc le
   * fallback de Three : dès que la vidéo a des données, on réuploade la frame.
   * Doit être appelé une fois par frame depuis la boucle de rendu.
   */
  update(): void {
    for (const entry of this.entries.values()) {
      const video = entry.video;
      if (video && entry.texture && video.readyState >= video.HAVE_CURRENT_DATA) {
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
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const entry of this.entries.values()) this.disposeEntry(entry);
    this.entries.clear();
  }

  private disposeEntry(entry: Entry): void {
    entry.texture?.dispose();
    entry.stream?.getTracks().forEach((t) => t.stop());
    if (entry.video) {
      entry.video.pause();
      entry.video.srcObject = null;
      entry.video.removeAttribute('src');
      entry.video.load();
    }
    entry.texture = null;
    entry.video = undefined;
    entry.stream = undefined;
  }
}
