import { gaussianBlur } from './imageProcessing';

export interface DepthOptions {
  /** Poids de l'indice de contraste local (détail → plus proche). */
  contrastWeight?: number;
  /** Sigma du lissage. */
  sigma?: number;
}

/**
 * Estimation de profondeur monoculaire — heuristique légère (substitut testable
 * de MiDaS). Combine la luminance lissée (les zones claires sont supposées plus
 * proches) et le contraste local (le détail traduit la proximité), puis normalise
 * en [0,1]. Pour une vraie estimation ML, brancher un modèle (MiDaS small ONNX)
 * derrière cette même signature.
 */
export function estimateDepth(
  gray: Float32Array,
  width: number,
  height: number,
  options: DepthOptions = {},
): Float32Array {
  const { contrastWeight = 0.5, sigma = 2 } = options;
  const blurred = gaussianBlur(gray, width, height, sigma);

  const raw = new Float32Array(width * height);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < raw.length; i += 1) {
    const contrast = Math.abs(gray[i] - blurred[i]);
    const v = blurred[i] + contrastWeight * contrast;
    raw[i] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const range = max - min;
  const out = new Float32Array(width * height);
  if (range < 1e-6) return out; // image plate → profondeur uniforme (0)
  for (let i = 0; i < raw.length; i += 1) out[i] = (raw[i] - min) / range;
  return out;
}

/** Colorise une carte de profondeur [0,1] en RGBA (bleu lointain → rouge proche). */
export function depthToHeatmapRGBA(depth: Float32Array): Uint8ClampedArray<ArrayBuffer> {
  const rgba = new Uint8ClampedArray(depth.length * 4);
  for (let i = 0; i < depth.length; i += 1) {
    const d = Math.min(1, Math.max(0, depth[i]));
    const o = i * 4;
    rgba[o] = Math.round(255 * Math.min(1, d * 2)); // rouge monte avec la proximité
    rgba[o + 1] = Math.round(255 * (1 - Math.abs(d - 0.5) * 2)); // vert au milieu
    rgba[o + 2] = Math.round(255 * Math.min(1, (1 - d) * 2)); // bleu pour le lointain
    rgba[o + 3] = 255;
  }
  return rgba;
}
