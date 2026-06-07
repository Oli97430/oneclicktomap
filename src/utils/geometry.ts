import type { Vec2 } from '@/types';

const EPSILON = 1e-9;

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Intersection de deux droites (p1→p2) et (p3→p4).
 * Renvoie null si les droites sont parallèles ou confondues.
 */
export function lineIntersection(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): Vec2 | null {
  const denominator = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (Math.abs(denominator) < EPSILON) return null;

  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denominator;

  return {
    x: p1.x + t * (p2.x - p1.x),
    y: p1.y + t * (p2.y - p1.y),
  };
}

/**
 * Poids homogènes (q) pour un mapping de texture perspective-correct sur un quad.
 *
 * Les coins doivent être fournis dans l'ordre [HG, HD, BD, BG] ; les diagonales
 * sont donc HG–BD et HD–BG. Pour chaque coin i on renvoie q_i tel qu'en
 * interpolant (u·q, v·q, q) puis en divisant par q dans le fragment shader, la
 * texture reste sans distorsion sur un quad non rectangulaire (effet perspective).
 *
 * Retombe sur un mapping affine (q = 1) si le quad est dégénéré.
 */
export function perspectiveQuadWeights(corners: Vec2[]): [number, number, number, number] {
  const [tl, tr, br, bl] = corners;
  const center = lineIntersection(tl, br, tr, bl);
  if (!center) return [1, 1, 1, 1];

  const d0 = distance(center, tl);
  const d1 = distance(center, tr);
  const d2 = distance(center, br);
  const d3 = distance(center, bl);
  if (d0 < EPSILON || d1 < EPSILON || d2 < EPSILON || d3 < EPSILON) {
    return [1, 1, 1, 1];
  }

  return [(d0 + d2) / d2, (d1 + d3) / d3, (d2 + d0) / d0, (d3 + d1) / d1];
}
