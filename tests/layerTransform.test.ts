import { describe, expect, it } from 'vitest';
import {
  clampOffset,
  clampScale,
  contentUvFromSurfaceUv,
  isContentUvInBounds,
  LAYER_TRANSFORM_IDENTITY,
  MAX_LAYER_SCALE,
  MIN_LAYER_SCALE,
  normalizeTransform,
  quadPoint,
  surfaceCorners,
  surfaceDeltaFromOutputDelta,
} from '@/utils/layerTransform';
import type { LayerTransform, Vec2 } from '@/types';

const UNIT_QUAD: [Vec2, Vec2, Vec2, Vec2] = [
  { x: 0, y: 0 }, // HG
  { x: 1, y: 0 }, // HD
  { x: 1, y: 1 }, // BD
  { x: 0, y: 1 }, // BG
];

const id = (): LayerTransform => ({ ...LAYER_TRANSFORM_IDENTITY });

describe('contentUvFromSurfaceUv (miroir du shader)', () => {
  it('identité : uv inchangée', () => {
    const r = contentUvFromSurfaceUv({ x: 0.3, y: 0.7 }, id(), 1);
    expect(r.x).toBeCloseTo(0.3);
    expect(r.y).toBeCloseTo(0.7);
  });

  it("offset : le centre du contenu apparaît à l'uv décalée", () => {
    const t: LayerTransform = { offsetX: 0.2, offsetY: -0.1, scale: 1, rotation: 0 };
    const r = contentUvFromSurfaceUv({ x: 0.5 + 0.2, y: 0.5 - 0.1 }, t, 1);
    expect(r.x).toBeCloseTo(0.5);
    expect(r.y).toBeCloseTo(0.5);
  });

  it('échelle : zoom autour du centre', () => {
    const t: LayerTransform = { offsetX: 0, offsetY: 0, scale: 2, rotation: 0 };
    // surface 0.75 -> contenu (0.75-0.5)/2 + 0.5 = 0.625
    expect(contentUvFromSurfaceUv({ x: 0.75, y: 0.5 }, t, 1).x).toBeCloseTo(0.625);
  });

  it('rotation 90° (aspect 1) : mapping prévisible', () => {
    const t: LayerTransform = { offsetX: 0, offsetY: 0, scale: 1, rotation: Math.PI / 2 };
    const r = contentUvFromSurfaceUv({ x: 1, y: 0.5 }, t, 1);
    expect(r.x).toBeCloseTo(0.5);
    expect(r.y).toBeCloseTo(0.0);
  });

  it('hors cadre détecté après transformation', () => {
    const t: LayerTransform = { offsetX: 0.6, offsetY: 0, scale: 1, rotation: 0 };
    // contenu.x = surface.x - offset ; le contenu n'est dans [0,1] que pour surface.x ∈ [0.6, 1].
    expect(isContentUvInBounds(contentUvFromSurfaceUv({ x: 0, y: 0.5 }, t, 1))).toBe(false); // -0.6
    expect(isContentUvInBounds(contentUvFromSurfaceUv({ x: 0.5, y: 0.5 }, t, 1))).toBe(false); // -0.1
    expect(isContentUvInBounds(contentUvFromSurfaceUv({ x: 0.8, y: 0.5 }, t, 1))).toBe(true); // 0.2
  });
});

describe('quadPoint', () => {
  it('mappe les coins de surface vers la sortie (y vers le bas)', () => {
    expect(quadPoint(UNIT_QUAD, 0, 1)).toEqual({ x: 0, y: 0 }); // HG (v=1 haut)
    expect(quadPoint(UNIT_QUAD, 1, 1)).toEqual({ x: 1, y: 0 }); // HD
    expect(quadPoint(UNIT_QUAD, 1, 0)).toEqual({ x: 1, y: 1 }); // BD (v=0 bas)
    expect(quadPoint(UNIT_QUAD, 0.5, 0.5)).toEqual({ x: 0.5, y: 0.5 }); // centre
  });
});

describe('surfaceDeltaFromOutputDelta', () => {
  it('quad unité : un déplacement écran se traduit 1:1 en offset', () => {
    const right = surfaceDeltaFromOutputDelta(UNIT_QUAD, 0.1, 0);
    expect(right.x).toBeCloseTo(0.1);
    expect(right.y).toBeCloseTo(0);
    // souris vers le bas (dny>0) -> offsetY diminue (contenu descend)
    const down = surfaceDeltaFromOutputDelta(UNIT_QUAD, 0, 0.1);
    expect(down.x).toBeCloseTo(0);
    expect(down.y).toBeCloseTo(-0.1);
  });

  it('quad dégénéré : renvoie 0', () => {
    const flat: [Vec2, Vec2, Vec2, Vec2] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
    expect(surfaceDeltaFromOutputDelta(flat, 0.1, 0.1)).toEqual({ x: 0, y: 0 });
  });
});

describe('surfaceCorners', () => {
  it('quad : renvoie les 4 points de contrôle', () => {
    const cp = [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 },
    ];
    expect(surfaceCorners('quad', cp, { cols: 1, rows: 1 })).toEqual(cp);
  });

  it('grille : extrait les coins externes du maillage', () => {
    // grille 2x2 -> 3x3 = 9 points, row-major
    const cp: Vec2[] = [];
    for (let r = 0; r < 3; r += 1) for (let c = 0; c < 3; c += 1) cp.push({ x: c / 2, y: r / 2 });
    const [hg, hd, bd, bg] = surfaceCorners('grid', cp, { cols: 2, rows: 2 });
    expect(hg).toEqual({ x: 0, y: 0 });
    expect(hd).toEqual({ x: 1, y: 0 });
    expect(bd).toEqual({ x: 1, y: 1 });
    expect(bg).toEqual({ x: 0, y: 1 });
  });
});

describe('normalisation & bornes', () => {
  it('normalizeTransform : défauts et bornes', () => {
    expect(normalizeTransform(undefined)).toEqual(LAYER_TRANSFORM_IDENTITY);
    expect(normalizeTransform(null)).toEqual(LAYER_TRANSFORM_IDENTITY);
    const r = normalizeTransform({ offsetX: 99, scale: 999 });
    expect(r.offsetX).toBeLessThanOrEqual(1.5);
    expect(r.scale).toBe(MAX_LAYER_SCALE);
    expect(r.offsetY).toBe(0);
    expect(r.rotation).toBe(0);
  });

  it('clampScale / clampOffset', () => {
    expect(clampScale(0)).toBe(MIN_LAYER_SCALE);
    expect(clampScale(1000)).toBe(MAX_LAYER_SCALE);
    expect(clampScale(Number.NaN)).toBe(1);
    expect(clampOffset(5)).toBe(1.5);
    expect(clampOffset(-5)).toBe(-1.5);
    expect(clampOffset(Number.NaN)).toBe(0);
  });
});
