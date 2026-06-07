/**
 * D5 — Tests des presets de shaders Phase 9.
 */
import { describe, expect, it } from 'vitest';
import { SHADER_PRESETS } from '../src/content/shaderPresets';

const PHASE9_IDS = ['glitch', 'kaleidoscope', 'fire', 'matrix', 'lissajous', 'displacement', 'hexagons', 'feedback'];

describe('SHADER_PRESETS (Phase 9)', () => {
  it('contient au moins 21 presets (13 originaux + 8 Phase 9)', () => {
    expect(SHADER_PRESETS.length).toBeGreaterThanOrEqual(21);
  });

  it('tous les presets Phase 9 sont presents', () => {
    const ids = SHADER_PRESETS.map((p) => p.id);
    for (const id of PHASE9_IDS) {
      expect(ids, `preset ${id} manquant`).toContain(id);
    }
  });

  it('chaque preset a un id, un nom et un code non vides', () => {
    for (const preset of SHADER_PRESETS) {
      expect(preset.id, `id vide`).toBeTruthy();
      expect(preset.name, `${preset.id}: nom vide`).toBeTruthy();
      expect(preset.code, `${preset.id}: code vide`).toBeTruthy();
    }
  });

  it('les presets Phase 9 avec params ont des definitions valides', () => {
    for (const id of PHASE9_IDS) {
      const preset = SHADER_PRESETS.find((p) => p.id === id);
      if (preset?.params && preset.params.length > 0) {
        for (const param of preset.params) {
          expect(param.uniformName).toMatch(/^uP_/);
          expect(param.min).toBeLessThanOrEqual(param.max);
          expect(param.default).toBeGreaterThanOrEqual(param.min);
          expect(param.default).toBeLessThanOrEqual(param.max);
        }
      }
    }
  });
});
