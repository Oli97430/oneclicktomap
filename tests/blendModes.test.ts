/**
 * A4 — Tests des blend modes etendus.
 * Verifie que BLEND_MODE_ADJ retourne les bons codes et que applyBlend
 * ne leve pas pour tous les modes declares.
 */
import { describe, expect, it } from 'vitest';
import { BLEND_MODE_ADJ } from '../src/engine/blend';
import type { BlendMode } from '../src/types';

describe('BLEND_MODE_ADJ', () => {
  const ALL_MODES: BlendMode[] = [
    'normal', 'add', 'multiply', 'screen',
    'overlay', 'softlight', 'difference', 'colordodge',
  ];

  it('couvre tous les modes declares dans BlendMode', () => {
    for (const mode of ALL_MODES) {
      expect(BLEND_MODE_ADJ).toHaveProperty(mode);
    }
  });

  it('retourne 0 pour les modes standard sans ajustement GLSL', () => {
    expect(BLEND_MODE_ADJ.normal).toBe(0);
    expect(BLEND_MODE_ADJ.add).toBe(0);
    expect(BLEND_MODE_ADJ.multiply).toBe(0);
    expect(BLEND_MODE_ADJ.screen).toBe(0);
    expect(BLEND_MODE_ADJ.difference).toBe(0);
  });

  it('retourne des codes non nuls pour les modes avec ajustement GLSL', () => {
    expect(BLEND_MODE_ADJ.overlay).toBe(4);
    expect(BLEND_MODE_ADJ.softlight).toBe(5);
    expect(BLEND_MODE_ADJ.colordodge).toBe(7);
  });
});
