/**
 * C4 — Tests du calque texte (serialisation + valeurs par defaut).
 */
import { describe, expect, it } from 'vitest';
import type { TextParams } from '../src/types';
import { DEFAULT_TEXT_PARAMS } from '../src/stores/projectStore';

describe('DEFAULT_TEXT_PARAMS', () => {
  it('a les valeurs attendues', () => {
    const p: TextParams = DEFAULT_TEXT_PARAMS;
    expect(p.content).toBe('Texte');
    expect(p.fontFamily).toBe('sans-serif');
    expect(p.fontSize).toBeGreaterThan(0);
    expect(p.color).toMatch(/^#/);
    expect(p.align).toMatch(/^(left|center|right)$/);
    expect(p.scrollSpeed).toBe(0);
  });
});

describe('TextParams validation', () => {
  it('peut etre serialise et deserialise en JSON sans perte', () => {
    const params: TextParams = {
      content: 'Hello world',
      fontFamily: 'serif',
      fontSize: 72,
      color: '#ff0000',
      background: 'transparent',
      align: 'center',
      bold: true,
      italic: false,
      scrollSpeed: 50,
    };
    const json = JSON.stringify(params);
    const parsed = JSON.parse(json) as TextParams;
    expect(parsed.content).toBe('Hello world');
    expect(parsed.fontFamily).toBe('serif');
    expect(parsed.fontSize).toBe(72);
    expect(parsed.bold).toBe(true);
    expect(parsed.scrollSpeed).toBe(50);
  });
});
