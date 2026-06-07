import { describe, expect, it } from 'vitest';
import { smoothClosedPath } from '@/utils/mask';
import type { Vec2 } from '@/types';

const SQUARE: Vec2[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

describe('smoothClosedPath', () => {
  it('renvoie un vide en dessous de 3 points', () => {
    expect(smoothClosedPath([])).toEqual([]);
    expect(
      smoothClosedPath([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toEqual([]);
  });

  it('produit un segment par côté (boucle fermée)', () => {
    const segs = smoothClosedPath(SQUARE);
    expect(segs.length).toBe(4);
  });

  it('chaque segment finit sur le point suivant', () => {
    const segs = smoothClosedPath(SQUARE);
    expect(segs[0].end).toEqual({ x: 1, y: 0 });
    expect(segs[3].end).toEqual({ x: 0, y: 0 }); // bouclage vers le premier
  });

  it('calcule les poignées Catmull-Rom (1/6 du vecteur des voisins)', () => {
    const segs = smoothClosedPath(SQUARE);
    // segment 0 : p0=(0,1) p1=(0,0) p2=(1,0) p3=(1,1)
    // c1 = p1 + (p2-p0)/6 = (0,0)+((1-0)/6,(0-1)/6) = (1/6,-1/6)
    expect(segs[0].c1.x).toBeCloseTo(1 / 6);
    expect(segs[0].c1.y).toBeCloseTo(-1 / 6);
    // c2 = p2 - (p3-p1)/6 = (1,0)-((1-0)/6,(1-0)/6) = (5/6,-1/6)
    expect(segs[0].c2.x).toBeCloseTo(5 / 6);
    expect(segs[0].c2.y).toBeCloseTo(-1 / 6);
  });
});
