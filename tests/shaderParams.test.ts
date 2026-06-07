/**
 * D2 — Tests du parseur de parametres shader.
 */
import { describe, expect, it } from 'vitest';
import { parseShaderParams, defaultShaderParams } from '../src/utils/shaderParams';

const SAMPLE_CODE = `
uniform float uP_speed;  // [0.0, 2.0, 0.5]  label: Vitesse
uniform float uP_count;  // [1, 32, 8]        label: Nombre
uniform float uP_plain;
`;

describe('parseShaderParams', () => {
  it('extrait les parametres avec plage et libelle', () => {
    const defs = parseShaderParams(SAMPLE_CODE);
    expect(defs).toHaveLength(3);

    const speed = defs.find((d) => d.name === 'speed');
    expect(speed).toBeDefined();
    expect(speed!.uniformName).toBe('uP_speed');
    expect(speed!.label).toBe('Vitesse');
    expect(speed!.min).toBe(0);
    expect(speed!.max).toBe(2);
    expect(speed!.default).toBe(0.5);
  });

  it('applique les valeurs par defaut quand le commentaire est absent', () => {
    const defs = parseShaderParams(SAMPLE_CODE);
    const plain = defs.find((d) => d.name === 'plain');
    expect(plain).toBeDefined();
    expect(plain!.min).toBe(0);
    expect(plain!.max).toBe(1);
    expect(plain!.default).toBeCloseTo(0.5);
  });

  it('retourne [] pour un code sans uniform uP_*', () => {
    expect(parseShaderParams('void main() { gl_FragColor = vec4(1.0); }')).toHaveLength(0);
  });
});

describe('defaultShaderParams', () => {
  it('genere un objet avec les valeurs par defaut', () => {
    const defs = parseShaderParams(SAMPLE_CODE);
    const params = defaultShaderParams(defs);
    expect(params['uP_speed']).toBeCloseTo(0.5);
    expect(params['uP_count']).toBeCloseTo(8);
  });

  it('retourne {} pour une liste vide', () => {
    expect(defaultShaderParams([])).toEqual({});
  });
});
