import { gaussianBlur, sobel } from './imageProcessing';

export interface CannyOptions {
  /** Sigma du flou gaussien préalable. */
  blurSigma?: number;
  /** Seuil haut, en fraction de la magnitude maximale (0..1). */
  highRatio?: number;
  /** Seuil bas, en fraction de la magnitude maximale (0..1). */
  lowRatio?: number;
}

const NMS_NONE = 0;
const WEAK = 1;
const STRONG = 255;

/**
 * Détection de contours de Canny : flou → gradient de Sobel → suppression des
 * non-maxima → double seuillage + hystérésis. Renvoie une carte binaire (0/255).
 *
 * Implémentation pure (CPU). Pour de très grandes images, sous-échantillonner en
 * amont (voir CameraCapture).
 */
export function cannyEdges(
  gray: Float32Array,
  width: number,
  height: number,
  options: CannyOptions = {},
): Uint8Array {
  const { blurSigma = 1.4, highRatio = 0.2, lowRatio = 0.1 } = options;

  const blurred = gaussianBlur(gray, width, height, blurSigma);
  const { mag, dir } = sobel(blurred, width, height);

  // Suppression des non-maxima : on amincit les crêtes à 1 px le long du gradient.
  const thin = new Float32Array(width * height);
  let maxMag = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const m = mag[i];
      if (m === 0) continue;
      // Direction quantifiée en 4 secteurs (0/45/90/135°).
      const angle = ((dir[i] * 180) / Math.PI + 180) % 180;
      let a: number;
      let b: number;
      if (angle < 22.5 || angle >= 157.5) {
        // Gradient horizontal (0°) : voisins est / ouest.
        a = mag[i - 1];
        b = mag[i + 1];
      } else if (angle < 67.5) {
        // Gradient ~45° : voisins le long de la diagonale principale (HG / BD).
        a = mag[i - width - 1];
        b = mag[i + width + 1];
      } else if (angle < 112.5) {
        // Gradient vertical (90°) : voisins nord / sud.
        a = mag[i - width];
        b = mag[i + width];
      } else {
        // Gradient ~135° : voisins le long de l'anti-diagonale (HD / BG).
        a = mag[i - width + 1];
        b = mag[i + width - 1];
      }
      if (m >= a && m >= b) {
        thin[i] = m;
        if (m > maxMag) maxMag = m;
      }
    }
  }

  const out = new Uint8Array(width * height);
  if (maxMag === 0) return out;

  const high = highRatio * maxMag;
  const low = lowRatio * maxMag;
  const stack: number[] = [];
  for (let i = 0; i < thin.length; i += 1) {
    if (thin[i] >= high) {
      out[i] = STRONG;
      stack.push(i);
    } else if (thin[i] >= low) {
      out[i] = WEAK;
    }
  }

  // Hystérésis : propage les contours forts vers les voisins faibles connexes.
  const neighbors = [-1, 1, -width, width, -width - 1, -width + 1, width - 1, width + 1];
  while (stack.length > 0) {
    const i = stack.pop()!;
    const x = i % width;
    for (const off of neighbors) {
      const j = i + off;
      if (j < 0 || j >= out.length) continue;
      // Évite de traverser le bord gauche/droit.
      const jx = j % width;
      if (Math.abs(jx - x) > 1) continue;
      if (out[j] === WEAK) {
        out[j] = STRONG;
        stack.push(j);
      }
    }
  }

  // Les pixels faibles non connectés sont éliminés.
  for (let i = 0; i < out.length; i += 1) {
    if (out[i] === WEAK) out[i] = NMS_NONE;
  }
  return out;
}
