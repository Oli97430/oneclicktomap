import { describe, expect, it } from 'vitest';
import { applyHomography, computeHomography } from '@/detection/homography';
import { invertMat3 } from '@/detection/matrix';
import type { Vec2 } from '@/types';

const square: Vec2[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 80 },
  { x: 0, y: 80 },
];

describe('computeHomography', () => {
  it('reconstruit une correspondance identité', () => {
    const H = computeHomography(square, square);
    expect(H).not.toBeNull();
    for (const p of square) {
      const q = applyHomography(H!, p);
      expect(q.x).toBeCloseTo(p.x, 3);
      expect(q.y).toBeCloseTo(p.y, 3);
    }
  });

  it('mappe exactement 4 coins vers un quad arbitraire', () => {
    const dst: Vec2[] = [
      { x: 12, y: 7 },
      { x: 220, y: 30 },
      { x: 190, y: 160 },
      { x: 40, y: 140 },
    ];
    const H = computeHomography(square, dst);
    expect(H).not.toBeNull();
    for (let i = 0; i < 4; i += 1) {
      const q = applyHomography(H!, square[i]);
      expect(q.x).toBeCloseTo(dst[i].x, 2);
      expect(q.y).toBeCloseTo(dst[i].y, 2);
    }
  });

  it('retrouve une homographie projective connue (sur-déterminé, moindres carrés)', () => {
    const Htrue = [1.2, 0.1, 5, 0.05, 0.9, -3, 0.0003, 0.0002, 1];
    const src: Vec2[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 80 },
      { x: 0, y: 80 },
      { x: 50, y: 40 },
      { x: 20, y: 60 },
    ];
    const dst = src.map((p) => applyHomography(Htrue, p));
    const H = computeHomography(src, dst);
    expect(H).not.toBeNull();

    const test: Vec2 = { x: 33, y: 55 };
    const got = applyHomography(H!, test);
    const expected = applyHomography(Htrue, test);
    // Données exactes (sans bruit) ⇒ reconstruction à la précision machine.
    expect(got.x).toBeCloseTo(expected.x, 6);
    expect(got.y).toBeCloseTo(expected.y, 6);
  });

  it('renvoie null pour des entrées invalides', () => {
    expect(computeHomography(square.slice(0, 3), square.slice(0, 3))).toBeNull();
    expect(computeHomography(square, square.slice(0, 3))).toBeNull();
  });

  it('renvoie null pour une configuration dégénérée (colinéaire / dupliquée)', () => {
    const collinear: Vec2[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
    ];
    const dst: Vec2[] = [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 20, y: 10 },
      { x: 30, y: 9 },
    ];
    expect(computeHomography(collinear, dst)).toBeNull(); // source colinéaire
    expect(computeHomography(dst, collinear)).toBeNull(); // cible colinéaire
    const duplicate: Vec2[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 20, y: 5 },
    ];
    expect(computeHomography(duplicate, dst)).toBeNull(); // point dupliqué (rang insuffisant)
  });
});

describe('applyHomography', () => {
  it("est l'inverse via la matrice inverse (aller-retour)", () => {
    const dst: Vec2[] = [
      { x: 12, y: 7 },
      { x: 220, y: 30 },
      { x: 190, y: 160 },
      { x: 40, y: 140 },
    ];
    const H = computeHomography(square, dst)!;
    const Hinv = invertMat3(H)!;
    const p: Vec2 = { x: 64, y: 51 };
    const round = applyHomography(Hinv, applyHomography(H, p));
    expect(round.x).toBeCloseTo(p.x, 2);
    expect(round.y).toBeCloseTo(p.y, 2);
  });
});
