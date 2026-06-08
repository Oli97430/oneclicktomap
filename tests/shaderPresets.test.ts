/**
 * Tests des presets de shaders (Phases de base, audio et avancé).
 */
import { describe, expect, it } from 'vitest';
import { SHADER_PRESETS, type PresetCategory } from '../src/content/shaderPresets';
import { parseShaderParams } from '../src/utils/shaderParams';

const PHASE9_IDS = ['glitch', 'kaleidoscope', 'fire', 'matrix', 'lissajous', 'displacement', 'hexagons', 'feedback'];
const AUDIO_IDS  = ['audio-bars', 'audio-pulse', 'feedback'];

describe('SHADER_PRESETS', () => {
  it('contient au moins 21 presets (11 base + 3 audio + 7 avancé)', () => {
    expect(SHADER_PRESETS.length).toBeGreaterThanOrEqual(21);
  });

  it('tous les presets Phase 9 sont présents', () => {
    const ids = SHADER_PRESETS.map((p) => p.id);
    for (const id of PHASE9_IDS) {
      expect(ids, `preset ${id} manquant`).toContain(id);
    }
  });

  it('chaque preset a id, name, category et code non vides', () => {
    const validCategories: PresetCategory[] = ['base', 'audio', 'avance'];
    for (const preset of SHADER_PRESETS) {
      expect(preset.id,   `${preset.id}: id vide`).toBeTruthy();
      expect(preset.name, `${preset.id}: nom vide`).toBeTruthy();
      expect(preset.code, `${preset.id}: code vide`).toBeTruthy();
      expect(validCategories, `${preset.id}: catégorie invalide`).toContain(preset.category);
    }
  });

  it('les presets audio sont dans la catégorie "audio"', () => {
    for (const id of AUDIO_IDS) {
      const preset = SHADER_PRESETS.find((p) => p.id === id);
      expect(preset?.category, `${id} doit être audio`).toBe('audio');
    }
  });

  it('tous les presets exposent des paramètres uP_* valides via parseShaderParams', () => {
    for (const preset of SHADER_PRESETS) {
      const defs = parseShaderParams(preset.code);
      // Tous les presets doivent avoir au moins 1 paramètre
      expect(defs.length, `${preset.id} n'a aucun paramètre uP_*`).toBeGreaterThan(0);
      for (const def of defs) {
        expect(def.uniformName, `${preset.id}: uniformName invalide`).toMatch(/^uP_/);
        expect(def.min,  `${preset.id}/${def.name}: min > max`).toBeLessThanOrEqual(def.max);
        expect(def.default, `${preset.id}/${def.name}: default < min`).toBeGreaterThanOrEqual(def.min);
        expect(def.default, `${preset.id}/${def.name}: default > max`).toBeLessThanOrEqual(def.max);
        expect(def.step, `${preset.id}/${def.name}: step <= 0`).toBeGreaterThan(0);
        expect(def.label, `${preset.id}/${def.name}: label vide`).toBeTruthy();
      }
    }
  });

  it('les presets de base incluent les effets fondamentaux', () => {
    const baseIds = SHADER_PRESETS.filter((p) => p.category === 'base').map((p) => p.id);
    for (const id of ['plasma', 'fbm', 'voronoi', 'rings', 'tunnel', 'gradient',
                       'grid', 'waves', 'stripes', 'checker', 'sparkle']) {
      expect(baseIds, `preset base ${id} manquant`).toContain(id);
    }
  });
});
