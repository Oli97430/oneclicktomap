// Transformée de Hough (lignes) sur une carte de contours binaire.
// Repère normal : une droite est (rho, theta) avec rho = x·cosθ + y·sinθ.

export interface HoughLine {
  /** Distance signée à l'origine (pixels). */
  rho: number;
  /** Angle de la normale en radians, dans [0, π). */
  theta: number;
  /** Nombre de votes (force de la droite). */
  votes: number;
}

export interface HoughOptions {
  /** Nombre de pas angulaires sur [0, π). */
  thetaSteps?: number;
  /** Seuil de votes minimal pour retenir une droite. */
  threshold?: number;
  /** Nombre maximal de droites renvoyées. */
  maxLines?: number;
}

/**
 * Extrait les droites dominantes par accumulation de Hough puis sélection des
 * pics (suppression locale des non-maxima dans l'accumulateur).
 */
export function houghLines(
  edges: Uint8Array,
  width: number,
  height: number,
  options: HoughOptions = {},
): HoughLine[] {
  const { thetaSteps = 180, threshold = 0, maxLines = 8 } = options;

  const diag = Math.ceil(Math.hypot(width, height));
  const rhoSize = 2 * diag + 1;
  const acc = new Int32Array(rhoSize * thetaSteps);

  const cos = new Float32Array(thetaSteps);
  const sin = new Float32Array(thetaSteps);
  for (let t = 0; t < thetaSteps; t += 1) {
    const theta = (t * Math.PI) / thetaSteps;
    cos[t] = Math.cos(theta);
    sin[t] = Math.sin(theta);
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (edges[y * width + x] === 0) continue;
      for (let t = 0; t < thetaSteps; t += 1) {
        const rho = Math.round(x * cos[t] + y * sin[t]) + diag;
        acc[rho * thetaSteps + t] += 1;
      }
    }
  }

  // Sélection des pics avec NMS dans une fenêtre (rho ± 2, theta ± 2).
  const lines: HoughLine[] = [];
  for (let r = 0; r < rhoSize; r += 1) {
    for (let t = 0; t < thetaSteps; t += 1) {
      const votes = acc[r * thetaSteps + t];
      if (votes <= threshold) continue;
      let isPeak = true;
      for (let dr = -2; dr <= 2 && isPeak; dr += 1) {
        for (let dt = -2; dt <= 2; dt += 1) {
          const rr = r + dr;
          const tt = t + dt;
          if (rr < 0 || rr >= rhoSize || tt < 0 || tt >= thetaSteps) continue;
          if (acc[rr * thetaSteps + tt] > votes) {
            isPeak = false;
            break;
          }
        }
      }
      if (isPeak) {
        lines.push({ rho: r - diag, theta: (t * Math.PI) / thetaSteps, votes });
      }
    }
  }

  lines.sort((a, b) => b.votes - a.votes);
  return lines.slice(0, maxLines);
}
