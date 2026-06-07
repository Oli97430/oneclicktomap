import * as THREE from 'three';

export interface MediaDescriptor {
  kind: 'image' | 'video' | 'webcam';
  dataUrl?: string;
  deviceId?: string;
}

interface Entry {
  sig: string;
  texture: THREE.Texture | null;
  video?: HTMLVideoElement;
  stream?: MediaStream;
}

// Signature légère (évite de comparer des data URLs de plusieurs Mo à chaque sync).
function signature(d: MediaDescriptor): string {
  return `${d.kind}:${d.deviceId ?? ''}:${d.dataUrl ? d.dataUrl.length : 0}`;
}

/**
 * Cache de textures de calque, tous types confondus :
 * - image : THREE.Texture chargée de manière asynchrone (null tant qu'absente) ;
 * - video : THREE.VideoTexture lue en boucle (muette) depuis une data URL ;
 * - webcam : THREE.VideoTexture alimentée par getUserMedia(deviceId).
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
      const entry: Entry = { sig, texture: null };
      this.entries.set(key, entry);
      new THREE.TextureLoader().load(descriptor.dataUrl, (texture) => {
        if (this.disposed || this.entries.get(key) !== entry) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        entry.texture = texture;
        this.onLoad();
      });
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
      void video.play().catch(() => {});
      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      this.entries.set(key, { sig, texture, video });
      return texture;
    }

    // webcam
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    const entry: Entry = { sig, texture, video };
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
        void video.play().catch(() => {});
        this.onLoad();
      })
      .catch(() => {});
    return texture;
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
      entry.video.load(); // stoppe la production de frames -> le rVFC interne reste dormant
    }
    // three r168 n'expose pas de hook pour annuler le requestVideoFrameCallback de
    // VideoTexture ; on libère au moins nos références fortes (le cache ne retient
    // plus la vidéo/texture/stream).
    entry.texture = null;
    entry.video = undefined;
    entry.stream = undefined;
  }
}
