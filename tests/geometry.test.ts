import { describe, expect, it } from 'vitest';
import { distance, lineIntersection, perspectiveQuadWeights } from '@/utils/geometry';
import type { Vec2 } from '@/types';

describe('distance', () => {
  it('calcule la distance euclidienne', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe('lineIntersection', () => {
  it('trouve le croisement de deux diagonales', () => {
    const point = lineIntersection({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 });
    expect(point?.x).toBeCloseTo(0.5);
    expect(point?.y).toBeCloseTo(0.5);
  });

  it('renvoie null pour des droites parallèles', () => {
    const point = lineIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 });
    expect(point).toBeNull();
  });
});

describe('perspectiveQuadWeights', () => {
  it('renvoie des poids uniformes (=2) pour un carré (mapping affine)', () => {
    const square: Vec2[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const q = perspectiveQuadWeights(square);
    q.forEach((value) => expect(value).toBeCloseTo(2));
  });

  it("donne des poids plus grands au bord proche (long) d'un trapèze", () => {
    // Bord haut court (loin), bord bas long (proche) : effet perspective.
    const trapezoid: Vec2[] = [
      { x: 0.25, y: 0 }, // HG
      { x: 0.75, y: 0 }, // HD
      { x: 1, y: 1 }, // BD
      { x: 0, y: 1 }, // BG
    ];
    const [qTL, qTR, qBR, qBL] = perspectiveQuadWeights(trapezoid);

    expect(qBR).toBeGreaterThan(qTL);
    expect(qBL).toBeGreaterThan(qTR);
    // Symétrie gauche/droite du trapèze.
    expect(qTL).toBeCloseTo(qTR);
    expect(qBR).toBeCloseTo(qBL);
    // Valeurs attendues calculées analytiquement.
    expect(qTL).toBeCloseTo(1.5);
    expect(qBR).toBeCloseTo(3);
  });

  it('retombe sur un mapping affine si le quad est dégénéré (points colinéaires)', () => {
    const degenerate: Vec2[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];
    expect(perspectiveQuadWeights(degenerate)).toEqual([1, 1, 1, 1]);
  });
});
