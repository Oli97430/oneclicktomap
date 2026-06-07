import type { Vec2 } from '@/types';

/**
 * Ordonne 4 points quelconques dans l'ordre [HG, HD, BD, BG] (haut-gauche,
 * haut-droite, bas-droite, bas-gauche), via les extrêmes de (x+y) et (x−y).
 * Convention écran : y croît vers le bas.
 */
export function orderCorners(points: Vec2[]): Vec2[] {
  if (points.length !== 4) return points;
  let tl = points[0];
  let br = points[0];
  let tr = points[0];
  let bl = points[0];
  let minSum = Infinity;
  let maxSum = -Infinity;
  let minDiff = Infinity;
  let maxDiff = -Infinity;
  for (const p of points) {
    const sum = p.x + p.y;
    const diff = p.x - p.y;
    if (sum < minSum) {
      minSum = sum;
      tl = p;
    }
    if (sum > maxSum) {
      maxSum = sum;
      br = p;
    }
    if (diff > maxDiff) {
      maxDiff = diff;
      tr = p;
    }
    if (diff < minDiff) {
      minDiff = diff;
      bl = p;
    }
  }
  return [tl, tr, br, bl];
}

/** Aire d'un polygone (formule du lacet), toujours positive. */
export function polygonArea(points: Vec2[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

/**
 * Quadrilatère englobant (éventuellement incliné) d'un nuage de pixels de
 * contour. Prend les 4 extrêmes de (x±y) — méthode simple et robuste pour un
 * rectangle vu de biais (surface plane projetée). Renvoie `null` si le contour
 * est vide ou dégénéré (aire trop faible).
 *
 * @param edges  carte binaire (≠ 0 = pixel de contour), longueur w*h
 * @param minAreaRatio  aire minimale du quad relative à l'image (rejet du bruit)
 */
export function boundingQuadFromEdges(
  edges: Uint8Array,
  width: number,
  height: number,
  minAreaRatio = 0.02,
): Vec2[] | null {
  let found = false;
  let tl = { x: 0, y: 0 };
  let br = { x: 0, y: 0 };
  let tr = { x: 0, y: 0 };
  let bl = { x: 0, y: 0 };
  let minSum = Infinity;
  let maxSum = -Infinity;
  let minDiff = Infinity;
  let maxDiff = -Infinity;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (edges[y * width + x] === 0) continue;
      found = true;
      const sum = x + y;
      const diff = x - y;
      if (sum < minSum) {
        minSum = sum;
        tl = { x, y };
      }
      if (sum > maxSum) {
        maxSum = sum;
        br = { x, y };
      }
      if (diff > maxDiff) {
        maxDiff = diff;
        tr = { x, y };
      }
      if (diff < minDiff) {
        minDiff = diff;
        bl = { x, y };
      }
    }
  }

  if (!found) return null;
  const quad = [tl, tr, br, bl];
  if (polygonArea(quad) < minAreaRatio * width * height) return null;
  return quad;
}
