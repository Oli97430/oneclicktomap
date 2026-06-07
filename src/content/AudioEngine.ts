import { analyzeBands, BeatDetector } from './audioAnalysis';
import { setAudioFeatures, type AudioFeatures } from './audioBus';

/**
 * Capture le micro / line-in via Web Audio, analyse le spectre (FFT) à chaque
 * frame (bandes + niveau + beats) et publie les features sur le bus audio.
 * `onFeatures` permet aussi de relayer vers la fenêtre de sortie (IPC).
 */
export class AudioEngine {
  private ctx?: AudioContext;
  private analyser?: AnalyserNode;
  private stream?: MediaStream;
  private data?: Uint8Array<ArrayBuffer>;
  private frameId = 0;
  private readonly beat = new BeatDetector();
  private beatLevel = 0;

  constructor(private readonly onFeatures?: (features: AudioFeatures) => void) {}

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.ctx = new AudioContext();
    const source = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.8;
    source.connect(this.analyser);
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
    this.loop();
  }

  stop(): void {
    cancelAnimationFrame(this.frameId);
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.ctx = undefined;
    this.analyser = undefined;
    this.stream = undefined;
  }

  private loop = (): void => {
    this.frameId = requestAnimationFrame(this.loop);
    if (!this.analyser || !this.data) return;
    this.analyser.getByteFrequencyData(this.data);
    const bands = analyzeBands(this.data);
    const now = performance.now();
    if (this.beat.push(bands.bass, now)) this.beatLevel = 1;
    else this.beatLevel *= 0.9;
    const features: AudioFeatures = { ...bands, beat: this.beatLevel };
    setAudioFeatures(features);
    this.onFeatures?.(features);
  };
}
