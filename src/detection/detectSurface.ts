import type { Vec2 } from '@/types';
import { cannyEdges, type CannyOptions } from './canny';
import { toGrayscale, type RasterImage } from './imageProcessing';
import { boundingQuadFromEdges } from './quadDetect';
import { quadToControlPoints } from './autoMap';

export interface DetectSurfaceOptions extends CannyOptions {
  /** Aire minimale du quad relative à l'image (rejet du bruit). */
  minAreaRatio?: number;
}

export interface SurfaceDetection {
  width: number;
  height: number;
  /** Carte de contours binaire (0/255). */
  edges: Uint8Array;
  /** Quadrilatère détecté en pixels image, ordre [HG,HD,BD,BG] (ou null). */
  quad: Vec2[] | null;
  /** Points de contrôle normalisés [0,1] prêts pour une Surface (ou null). */
  controlPoints: Vec2[] | null;
}

/**
 * Pipeline complet de détection de surface : niveaux de gris → Canny →
 * quadrilatère englobant → points de contrôle normalisés. Pur étant donné une
 * `RasterImage` (testable hors navigateur).
 */
export function detectSurface(
  image: RasterImage,
  options: DetectSurfaceOptions = {},
): SurfaceDetection {
  const { width, height } = image;
  const gray = toGrayscale(image);
  const edges = cannyEdges(gray, width, height, options);
  const quad = boundingQuadFromEdges(edges, width, height, options.minAreaRatio);
  const controlPoints = quad ? quadToControlPoints(quad, width, height) : null;
  return { width, height, edges, quad, controlPoints };
}
