import { describe, expect, it } from 'vitest';
import { bilerp, gridPointCount, gridToQuad, quadToGrid, resampleGrid } from '@/utils/warp';
import type { Vec2 } from '@/types';

const UNIT_QUAD: Vec2[] = [
  { x: 0, y: 0 }, // HG
  { x: 1, y: 0 }, // HD
  { x: 1, y: 1 }, // BD
  { x: 0, y: 1 }, // BG
];

describe('bilerp', () => {
  it('renvoie les coins aux extrémités et le centre au milieu', () => {
    const [tl, tr, br, bl] = UNIT_QUAD;
    expect(bilerp(tl, tr, br, bl, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(bilerp(tl, tr, br, bl, 1, 1)).toEqual({ x: 1, y: 1 });
    const mid = bilerp(tl, tr, br, bl, 0.5, 0.5);
    expect(mid.x).toBeCloseTo(0.5);
    expect(mid.y).toBeCloseTo(0.5);
  });
});

describe('quadToGrid', () => {
  it('génère (cols+1)*(rows+1) points', () => {
    const size = { cols: 3, rows: 2 };
    const grid = quadToGrid(UNIT_QUAD, size);
    expect(grid.length).toBe(gridPointCount(size));
    expect(grid.length).toBe(12);
  });

  it("place le centre d'une grille 2x2 au milieu", () => {
    const grid = quadToGrid(UNIT_QUAD, { cols: 2, rows: 2 });
    // 9 points ; le centre est l'index 4.
    expect(grid[4].x).toBeCloseTo(0.5);
    expect(grid[4].y).toBeCloseTo(0.5);
  });
});

describe('gridToQuad', () => {
  it('récupère les 4 coins extérieurs', () => {
    const size = { cols: 3, rows: 3 };
    const grid = quadToGrid(UNIT_QUAD, size);
    expect(gridToQuad(grid, size)).toEqual(UNIT_QUAD);
  });
});

describe('resampleGrid', () => {
  it("est l'identité à taille égale", () => {
    const size = { cols: 2, rows: 2 };
    const grid = quadToGrid(UNIT_QUAD, size);
    const resampled = resampleGrid(grid, size, size);
    resampled.forEach((p, i) => {
      expect(p.x).toBeCloseTo(grid[i].x);
      expect(p.y).toBeCloseTo(grid[i].y);
    });
  });

  it('préserve les coins en montant en résolution', () => {
    const oldSize = { cols: 1, rows: 1 };
    const newSize = { cols: 4, rows: 4 };
    const grid = quadToGrid(UNIT_QUAD, oldSize); // = UNIT_QUAD
    const fine = resampleGrid(grid, oldSize, newSize);
    expect(fine.length).toBe(25);
    expect(gridToQuad(fine, newSize)).toEqual(UNIT_QUAD);
  });
});
