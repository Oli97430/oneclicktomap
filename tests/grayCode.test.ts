import { describe, expect, it } from 'vitest';
import {
  binaryToGray,
  buildGrayPatterns,
  decodeGray,
  grayCodeBits,
  grayToBinary,
  numPatternsForResolution,
} from '@/detection/grayCode';

const popcount = (n: number): number => {
  let c = 0;
  let v = n;
  while (v) {
    v &= v - 1;
    c += 1;
  }
  return c;
};

describe('codes de Gray', () => {
  it('binaryToGray / grayToBinary font un aller-retour exact', () => {
    for (let n = 0; n < 1024; n += 1) {
      expect(grayToBinary(binaryToGray(n))).toBe(n);
    }
  });

  it('deux valeurs consécutives ne diffèrent que d’un seul bit', () => {
    for (let n = 0; n < 1024; n += 1) {
      expect(popcount(binaryToGray(n) ^ binaryToGray(n + 1))).toBe(1);
    }
  });

  it('calcule le nombre de motifs requis', () => {
    expect(numPatternsForResolution(1)).toBe(1);
    expect(numPatternsForResolution(2)).toBe(1);
    expect(numPatternsForResolution(8)).toBe(3);
    expect(numPatternsForResolution(1024)).toBe(10);
    expect(numPatternsForResolution(1920)).toBe(11);
    expect(numPatternsForResolution(1080)).toBe(11);
  });

  it('grayCodeBits puis decodeGray reconstruit la valeur', () => {
    const bits = grayCodeBits(173, 8);
    expect(bits).toHaveLength(8);
    expect(decodeGray(bits)).toBe(173);
  });

  it('génère des motifs de bandes cohérents', () => {
    const size = 8;
    const patterns = buildGrayPatterns(size);
    expect(patterns).toHaveLength(3);
    // Pour chaque colonne, la pile de bits (MSB→LSB) doit décoder vers la colonne.
    for (let x = 0; x < size; x += 1) {
      const bits = patterns.map((p) => p.stripes[x]);
      expect(decodeGray(bits)).toBe(x);
    }
  });
});
