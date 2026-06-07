import { describe, expect, it } from 'vitest';
import {
  blendZonesToEdgeBlend,
  edgeBlendFactor,
  NO_BLEND,
  type EdgeBlend,
} from '@/utils/edgeBlend';
import type { BlendZone } from '@/types';

describe('edgeBlendFactor', () => {
  it('vaut 1 partout sans fondu', () => {
    expect(edgeBlendFactor(0, 0, NO_BLEND)).toBe(1);
    expect(edgeBlendFactor(0.5, 0.5, NO_BLEND)).toBe(1);
  });

  it('atténue le bord gauche selon size (rampe linéaire)', () => {
    const b: EdgeBlend = { size: [0.2, 0, 0, 0], gamma: [1, 1, 1, 1] };
    expect(edgeBlendFactor(0, 0.5, b)).toBe(0); // au bord
    expect(edgeBlendFactor(0.1, 0.5, b)).toBeCloseTo(0.5); // mi-rampe
    expect(edgeBlendFactor(0.2, 0.5, b)).toBe(1); // fin de rampe
    expect(edgeBlendFactor(0.4, 0.5, b)).toBe(1); // au-delà : plein
  });

  it('gamma>1 assombrit davantage près du bord', () => {
    const lin: EdgeBlend = { size: [0.2, 0, 0, 0], gamma: [1, 1, 1, 1] };
    const g2: EdgeBlend = { size: [0.2, 0, 0, 0], gamma: [2, 1, 1, 1] };
    expect(edgeBlendFactor(0.1, 0.5, g2)).toBeLessThan(edgeBlendFactor(0.1, 0.5, lin));
  });

  it('atténue le bord droit (uv.x→1)', () => {
    const right: EdgeBlend = { size: [0, 0.2, 0, 0], gamma: [1, 1, 1, 1] };
    expect(edgeBlendFactor(1, 0.5, right)).toBe(0); // bord droit
    expect(edgeBlendFactor(0.9, 0.5, right)).toBeCloseTo(0.5);
    expect(edgeBlendFactor(0.8, 0.5, right)).toBeCloseTo(1);
  });

  it('atténue le bord bas (v=0) et le haut (v=1)', () => {
    const bottom: EdgeBlend = { size: [0, 0, 0, 0.2], gamma: [1, 1, 1, 1] };
    expect(edgeBlendFactor(0.5, 0, bottom)).toBe(0);
    expect(edgeBlendFactor(0.5, 0.2, bottom)).toBeCloseTo(1);
    const top: EdgeBlend = { size: [0, 0, 0.2, 0], gamma: [1, 1, 1, 1] };
    expect(edgeBlendFactor(0.5, 1, top)).toBe(0);
    expect(edgeBlendFactor(0.5, 0.8, top)).toBeCloseTo(1);
  });
});

describe('blendZonesToEdgeBlend', () => {
  it('mappe les bords vers les vecteurs [g,d,h,b]', () => {
    const zones: BlendZone[] = [
      { id: 'l', edge: 'left', size: 0.1, gamma: 2 },
      { id: 'b', edge: 'bottom', size: 0.3, gamma: 1.5 },
    ];
    const eb = blendZonesToEdgeBlend(zones);
    expect(eb.size).toEqual([0.1, 0, 0, 0.3]);
    expect(eb.gamma).toEqual([2, 1, 1, 1.5]);
  });

  it('borne size à [0,1] et force gamma>0', () => {
    const eb = blendZonesToEdgeBlend([{ id: 'r', edge: 'right', size: 9, gamma: 0 }]);
    expect(eb.size[1]).toBe(1);
    expect(eb.gamma[1]).toBe(1);
  });
});
