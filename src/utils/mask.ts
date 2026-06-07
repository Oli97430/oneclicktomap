import type { Vec2 } from '@/types';

export interface BezierSegment {
  c1: Vec2;
  c2: Vec2;
  end: Vec2;
}

/**
 * Convertit un polygone fermé d'anchors en segments de Bézier cubiques lisses
 * (tangentes de type Catmull-Rom). Renvoie un segment par côté (du point i au
 * point i+1, en bouclant). Vide si moins de 3 points.
 */
export function smoothClosedPath(points: Vec2[]): BezierSegment[] {
  const n = points.length;
  if (n < 3) return [];

  const segments: BezierSegment[] = [];
  for (let i = 0; i < n; i += 1) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    segments.push({
      c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      end: { x: p2.x, y: p2.y },
    });
  }
  return segments;
}
