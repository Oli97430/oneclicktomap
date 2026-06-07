import { describe, expect, it } from 'vitest';
import { boundingQuadFromEdges, orderCorners, polygonArea } from '@/detection/quadDetect';
import { quadToControlPoints, quadToGridPoints } from '@/detection/autoMap';
import type { Vec2 } from '@/types';

const rect: Vec2[] = [
  { x: 4, y: 3 },
  { x: 15, y: 3 },
  { x: 15, y: 16 },
  { x: 4, y: 16 },
];

describe('orderCorners', () => {
  it('réordonne des coins mélangés en [HG, HD, BD, BG]', () => {
    const shuffled = [rect[2], rect[0], rect[3], rect[1]];
    expect(orderCorners(shuffled)).toEqual(rect);
  });
});

describe('polygonArea', () => {
  it('calcule l’aire d’un carré unité', () => {
    expect(
      polygonArea([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ]),
    ).toBeCloseTo(1);
  });
});

describe('boundingQuadFromEdges', () => {
  const W = 20;
  const H = 20;

  function rectangleOutline(): Uint8Array {
    const edges = new Uint8Array(W * H);
    for (let x = 4; x <= 15; x += 1) {
      edges[3 * W + x] = 255;
      edges[16 * W + x] = 255;
    }
    for (let y = 3; y <= 16; y += 1) {
      edges[y * W + 4] = 255;
      edges[y * W + 15] = 255;
    }
    return edges;
  }

  it('retrouve les 4 coins d’un rectangle de contour', () => {
    const quad = boundingQuadFromEdges(rectangleOutline(), W, H);
    expect(quad).not.toBeNull();
    expect(quad).toEqual(rect);
  });

  it('renvoie null sur une carte vide', () => {
    expect(boundingQuadFromEdges(new Uint8Array(W * H), W, H)).toBeNull();
  });

  it('rejette un contour d’aire négligeable', () => {
    const edges = new Uint8Array(W * H);
    edges[5 * W + 5] = 255; // un seul pixel -> aire nulle
    expect(boundingQuadFromEdges(edges, W, H)).toBeNull();
  });
});

describe('quadToControlPoints', () => {
  it('normalise les pixels en [0,1] dans l’ordre des coins', () => {
    const quad: Vec2[] = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(quadToControlPoints(quad, 200, 100)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ]);
  });

  it('borne les coordonnées hors cadre à [0,1]', () => {
    const quad: Vec2[] = [
      { x: -10, y: -10 },
      { x: 250, y: -5 },
      { x: 250, y: 120 },
      { x: -10, y: 120 },
    ];
    const cps = quadToControlPoints(quad, 200, 100);
    for (const p of cps) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });
});

describe('quadToGridPoints', () => {
  it('subdivise un quad en grille cols×rows', () => {
    const unit: Vec2[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const grid = quadToGridPoints(unit, 3, 3);
    expect(grid).toHaveLength(9);
    expect(grid[0]).toEqual({ x: 0, y: 0 });
    expect(grid[4].x).toBeCloseTo(0.5);
    expect(grid[4].y).toBeCloseTo(0.5);
    expect(grid[8]).toEqual({ x: 1, y: 1 });
  });
});
