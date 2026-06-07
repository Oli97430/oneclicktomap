import { describe, expect, it } from 'vitest';
import { detectSurface } from '@/detection/detectSurface';
import type { RasterImage } from '@/detection/imageProcessing';

/** Image RGBA avec un rectangle clair sur fond sombre. */
function rectImage(
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): RasterImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const o = (y * w + x) * 4;
      const on = x >= x0 && x <= x1 && y >= y0 && y <= y1;
      data[o] = data[o + 1] = data[o + 2] = on ? 255 : 0;
      data[o + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

describe('detectSurface', () => {
  it('détecte un quadrilatère et propose des points de contrôle normalisés', () => {
    const image = rectImage(40, 40, 10, 8, 30, 28);
    const result = detectSurface(image);

    expect(result.quad).not.toBeNull();
    expect(result.controlPoints).not.toBeNull();
    expect(result.controlPoints).toHaveLength(4);

    const [tl, tr, br, bl] = result.controlPoints!;

    // Invariants robustes au halo du flou (vs valeurs absolues biaisées).
    // Centre du rectangle réel (10,8)-(30,28) sur 40px = (0.5, 0.45).
    const cx = (tl.x + tr.x + br.x + bl.x) / 4;
    const cy = (tl.y + tr.y + br.y + bl.y) / 4;
    expect(cx).toBeCloseTo(0.5, 1);
    expect(cy).toBeCloseTo(0.45, 1);

    // Le quad détecté ENGLOBE le rectangle vrai (le détecteur renvoie le bord extérieur).
    expect(tl.x).toBeLessThanOrEqual(0.25);
    expect(tl.y).toBeLessThanOrEqual(0.2);
    expect(br.x).toBeGreaterThanOrEqual(0.75);
    expect(br.y).toBeGreaterThanOrEqual(0.7);

    // Ordre des coins [HG,HD,BD,BG].
    expect(tl.x).toBeLessThan(tr.x);
    expect(tl.y).toBeLessThan(bl.y);
    expect(br.x).toBeGreaterThan(bl.x);
    expect(br.y).toBeGreaterThan(tr.y);
  });

  it('ne renvoie pas de quad sur une image uniforme', () => {
    const blank: RasterImage = {
      data: new Uint8ClampedArray(20 * 20 * 4).fill(0),
      width: 20,
      height: 20,
    };
    const result = detectSurface(blank);
    expect(result.quad).toBeNull();
    expect(result.controlPoints).toBeNull();
  });
});
