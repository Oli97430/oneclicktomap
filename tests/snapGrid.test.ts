import { describe, it, expect } from 'vitest';
import { snapToGrid, distToGridNode } from '../src/utils/snapGrid';
import type { SnapGrid } from '../src/utils/snapGrid';

const grid: SnapGrid = { enabled: true, cols: 4, rows: 4 };

describe('snapToGrid', () => {
  it('retourne le point inchangé si la grille est désactivée', () => {
    const pt = { x: 0.3, y: 0.7 };
    expect(snapToGrid(pt, { ...grid, enabled: false })).toEqual(pt);
  });

  it('retourne le point inchangé si grid est undefined', () => {
    const pt = { x: 0.3, y: 0.7 };
    expect(snapToGrid(pt, undefined)).toEqual(pt);
  });

  it('aimante au nœud le plus proche (4×4)', () => {
    // 0.3 est plus proche de 0.25 (1/4) que de 0.5 (2/4)
    const pt = { x: 0.3, y: 0.7 };
    const snapped = snapToGrid(pt, grid);
    expect(snapped.x).toBeCloseTo(0.25);
    // 0.7 est plus proche de 0.75 (3/4) que de 0.5 (2/4)
    expect(snapped.y).toBeCloseTo(0.75);
  });

  it('aimante à 0 et 1 aux extrémités', () => {
    expect(snapToGrid({ x: 0.05, y: 0.95 }, grid)).toEqual({ x: 0, y: 1 });
  });
});

describe('distToGridNode', () => {
  it('est 0 pour un point déjà sur un nœud', () => {
    expect(distToGridNode({ x: 0.25, y: 0.5 }, grid)).toBeCloseTo(0);
  });

  it('est > 0 pour un point entre deux nœuds', () => {
    expect(distToGridNode({ x: 0.3, y: 0.3 }, grid)).toBeGreaterThan(0);
  });
});
