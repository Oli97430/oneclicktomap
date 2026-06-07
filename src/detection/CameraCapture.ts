import { detectSurface, type DetectSurfaceOptions, type SurfaceDetection } from './detectSurface';

export interface CameraDevice {
  deviceId: string;
  label: string;
}

/**
 * Capture caméra côté renderer (getUserMedia). Attache le flux à un élément
 * <video> fourni, et extrait des images réduites pour la détection de surface.
 * Le pipeline de vision lui-même est pur (voir detectSurface).
 */
export class CameraCapture {
  private stream: MediaStream | null = null;
  private readonly canvas = document.createElement('canvas');

  constructor(private readonly video: HTMLVideoElement) {}

  async start(deviceId?: string): Promise<void> {
    this.stop();
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
      audio: false,
    });
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.srcObject = null;
  }

  get active(): boolean {
    return this.stream !== null;
  }

  /** Capture l'image courante, réduite à `maxWidth` de large (perf). */
  grabFrame(maxWidth = 320): ImageData | null {
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    if (!vw || !vh) return null;

    const scale = Math.min(1, maxWidth / vw);
    const w = Math.max(1, Math.round(vw * scale));
    const h = Math.max(1, Math.round(vh * scale));
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(this.video, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  }

  /** Capture une image et lance la détection de surface dessus. */
  detect(options?: DetectSurfaceOptions): SurfaceDetection | null {
    const frame = this.grabFrame();
    return frame ? detectSurface(frame, options) : null;
  }

  /** Liste les caméras disponibles (libellés visibles après autorisation). */
  static async listCameras(): Promise<CameraDevice[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'videoinput')
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Caméra ${i + 1}` }));
  }
}
