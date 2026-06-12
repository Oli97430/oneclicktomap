import { describe, it, expect } from 'vitest';
import { bgraToRgbaFlipped } from '../src/engine/MediaTextureCache';

// Construit une frame BGRA (origine haut-gauche) de w×h, pixel (x,y) -> [B,G,R,A].
function makeBgra(
  w: number,
  h: number,
  color: (x: number, y: number) => [number, number, number, number],
): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const [b, g, r, a] = color(x, y);
      const i = (y * w + x) * 4;
      out[i] = b;
      out[i + 1] = g;
      out[i + 2] = r;
      out[i + 3] = a;
    }
  }
  return out;
}

describe('bgraToRgbaFlipped', () => {
  it('permute R<->B et conserve G/A (un pixel)', () => {
    const src = new Uint8Array([10, 20, 30, 40]); // B=10, G=20, R=30, A=40
    const dst = new Uint8Array(4);
    bgraToRgbaFlipped(src, dst, 1, 1);
    expect(Array.from(dst)).toEqual([30, 20, 10, 40]); // R=30, G=20, B=10, A=40
  });

  it('retourne verticalement (la ligne du haut va en bas)', () => {
    const w = 2;
    const h = 2;
    // ligne du haut (y=0) rouge, ligne du bas (y=1) bleue
    const src = makeBgra(w, h, (_x, y) => (y === 0 ? [0, 0, 255, 255] : [255, 0, 0, 255]));
    const dst = new Uint8Array(w * h * 4);
    bgraToRgbaFlipped(src, dst, w, h);
    // Après flip : la ligne 0 de dst doit être le bleu (ancienne ligne du bas).
    // dst ligne 0, pixel 0 -> RGBA
    expect(Array.from(dst.slice(0, 4))).toEqual([0, 0, 255, 255]); // bleu en RGBA
    // dst ligne 1 (offset = w*4 = 8), pixel 0 -> rouge
    expect(Array.from(dst.slice(8, 12))).toEqual([255, 0, 0, 255]); // rouge en RGBA
  });

  it('gère un alignement non multiple de 4 (chemin de repli octet par octet)', () => {
    const w = 1;
    const h = 1;
    // Buffer plus grand, vue décalée de 1 octet (byteOffset = 1, non aligné sur 4).
    const backing = new Uint8Array(8);
    backing.set([99, 10, 20, 30, 40, 0, 0, 0]);
    const src = backing.subarray(1, 5); // [10,20,30,40], byteOffset=1
    expect(src.byteOffset % 4).not.toBe(0);
    const dst = new Uint8Array(4);
    bgraToRgbaFlipped(src, dst, w, h);
    expect(Array.from(dst)).toEqual([30, 20, 10, 40]);
  });

  it('ne déborde pas si src est trop court', () => {
    const src = new Uint8Array(4); // trop court pour 2×2
    const dst = new Uint8Array(2 * 2 * 4);
    expect(() => bgraToRgbaFlipped(src, dst, 2, 2)).not.toThrow();
    expect(Array.from(dst)).toEqual(new Array(16).fill(0)); // inchangé
  });
});
